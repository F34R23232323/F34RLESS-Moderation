import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ApplicationEmoji, Client, Collection } from 'discord.js';
import type { Logger } from '../core/logger';
import { replaceEmojiCatalog, type LiveEmoji } from './catalog';

export interface EmojiSyncFailure { readonly filename: string; readonly reason: string }
export interface EmojiSyncReport { readonly discovered: number; readonly alreadyPresent: number; readonly uploaded: number; readonly failed: number; readonly failures: readonly EmojiSyncFailure[] }
interface LocalEmoji { readonly filename: string; readonly filePath: string; readonly name: string; readonly animated: boolean }

export class EmojiManager {
  private syncPromise: Promise<EmojiSyncReport> | null = null;
  private resolveReady!: (report: EmojiSyncReport) => void;
  private readonly readiness = new Promise<EmojiSyncReport>((resolve) => { this.resolveReady = resolve; });

  public constructor(private readonly client: Client, private readonly logger: Logger, private readonly rootDirectory: string) {}

  public synchronize(): Promise<EmojiSyncReport> {
    this.syncPromise ??= this.performSynchronization()
      .catch((error: unknown) => {
        const reason = safeError(error);
        replaceEmojiCatalog([]);
        this.logger.error(`Application emoji sync failed before inventory completed: ${reason}`);
        return { discovered: 0, alreadyPresent: 0, uploaded: 0, failed: 1,
          failures: [{ filename: 'emojis/', reason }] } satisfies EmojiSyncReport;
      })
      .then((report) => {
        this.resolveReady(report);
        return report;
      });
    return this.syncPromise;
  }

  public waitUntilReady(): Promise<EmojiSyncReport> {
    return this.readiness;
  }

  private async performSynchronization(): Promise<EmojiSyncReport> {
    const inventory = await this.inventory();
    const failures: EmojiSyncFailure[] = [...inventory.failures];
    if (!this.client.application) return this.failEntireInventory(inventory, 'Discord application is unavailable after login');
    let existing: Collection<string, ApplicationEmoji>;
    try {
      existing = await this.client.application.emojis.fetch();
    } catch (error) {
      return this.failEntireInventory(inventory, `Could not fetch application emojis: ${safeError(error)}`);
    }
    const byName = new Map<string, ApplicationEmoji>();
    for (const remote of [...existing.values()].sort((left, right) => left.id.localeCompare(right.id))) {
      const normalizedName = remote.name.toLowerCase();
      if (!byName.has(normalizedName)) byName.set(normalizedName, remote);
    }

    const live = new Map<string, LiveEmoji>();
    let alreadyPresent = 0;
    let uploaded = 0;
    for (const local of inventory.emojis) {
      const normalizedName = local.name.toLowerCase();
      const remote = byName.get(normalizedName);
      if (remote) {
        alreadyPresent += 1;
        live.set(normalizedName, toLive(remote));
        continue;
      }
      try {
        const created = await this.client.application.emojis.create({ attachment: local.filePath, name: local.name });
        uploaded += 1;
        byName.set(normalizedName, created);
        live.set(normalizedName, toLive(created, local.animated));
      } catch (error) {
        failures.push({ filename: local.filename, reason: safeError(error) });
      }
    }

    for (const remote of byName.values()) {
      const normalizedName = remote.name.toLowerCase();
      if (!live.has(normalizedName)) live.set(normalizedName, toLive(remote));
    }
    replaceEmojiCatalog(live.values());
    const report = { discovered: inventory.discovered, alreadyPresent, uploaded, failed: failures.length, failures } satisfies EmojiSyncReport;
    this.logger.info(`Application emoji sync complete: ${alreadyPresent} already uploaded, ${uploaded} newly uploaded, ${failures.length} failed.`);
    for (const failure of failures) this.logger.warn(`Application emoji failed: ${failure.filename} — ${failure.reason}`);
    return report;
  }

  private failEntireInventory(inventory: { emojis: LocalEmoji[]; failures: EmojiSyncFailure[]; discovered: number }, reason: string): EmojiSyncReport {
    const failures = [...inventory.failures, ...inventory.emojis.map((local) => ({ filename: local.filename, reason }))];
    replaceEmojiCatalog([]);
    const report = { discovered: inventory.discovered, alreadyPresent: 0, uploaded: 0, failed: failures.length, failures } satisfies EmojiSyncReport;
    this.logger.error(`Application emoji sync failed: 0 already uploaded, 0 newly uploaded, ${failures.length} failed. ${reason}`);
    for (const failure of failures) this.logger.warn(`Application emoji failed: ${failure.filename} — ${failure.reason}`);
    return report;
  }

  private async inventory(): Promise<{ emojis: LocalEmoji[]; failures: EmojiSyncFailure[]; discovered: number }> {
    const directory = path.join(this.rootDirectory, 'emojis');
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && ['.png', '.gif'].includes(path.extname(entry.name).toLowerCase()))
      .sort((left, right) => {
        const leftName = left.name.toLowerCase();
        const rightName = right.name.toLowerCase();
        if (leftName === rightName) return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
        return leftName < rightName ? -1 : 1;
      });
    const seen = new Set<string>();
    const emojis: LocalEmoji[] = [];
    const failures: EmojiSyncFailure[] = [];
    for (const file of files) {
      const extension = path.extname(file.name).toLowerCase();
      const name = path.basename(file.name, extension);
      const normalizedName = name.toLowerCase();
      if (seen.has(normalizedName)) {
        failures.push({ filename: file.name, reason: `Duplicate local emoji name "${name}"; the first sorted file is authoritative` });
        continue;
      }
      seen.add(normalizedName);
      emojis.push({ filename: file.name, filePath: path.join(directory, file.name), name, animated: extension === '.gif' });
    }
    return { emojis, failures, discovered: files.length };
  }
}

function toLive(emoji: ApplicationEmoji, localAnimated?: boolean): LiveEmoji {
  return { id: emoji.id, name: emoji.name, animated: emoji.animated ?? localAnimated ?? false };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:Bot\s+)?[A-Za-z0-9._-]{24,}/g, '[redacted]').slice(0, 500);
}
