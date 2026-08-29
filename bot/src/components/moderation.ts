import type { ButtonInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { App } from '../core/context';

/** Pending moderation action awaiting confirmation. Stored in-memory with a
 *  60-second TTL so stale entries are cleaned up automatically. */
interface PendingAction {
  action: string;
  targetUserId: string;
  guildId: string;
  channelId: string;
  reason: string;
  durationMs?: number;
  deleteDays?: number;
  /** For purge: messages after this ID are deleted */
  purgeAfterId?: string;
  actorId: string;
  expiresAt: number;
}

/** Temporary in-memory store for pending confirmations (keyed by action ID). */
const pending = new Map<string, PendingAction>();

const CLEANUP_INTERVAL_MS = 10_000;
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, action] of pending) {
      if (action.expiresAt < now) pending.delete(key);
    }
    if (pending.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

let actionCounter = 0;
function nextId(): string {
  return `${Date.now()}-${++actionCounter}`;
}

/* ─── Builders ──────────────────────────────────────────────────────────── */

function v2Ephemeral(text: string): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

export function buildConfirmEmbed(
  action: string,
  targetUserId: string,
  reason: string,
  durationMs?: number,
): { components: unknown[]; flags: number } {
  const { humanizeDuration } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');
  const durLine = durationMs ? `\nDuration: ${humanizeDuration(durationMs)}` : '';

  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `⚠️ **Confirm ${action.toUpperCase()}**\n` +
      `Target: <@${targetUserId}>\n` +
      `Reason: ${reason}${durLine}\n\n` +
      `**Press Confirm to proceed, or Cancel to abort.**`,
    ))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      ) as never,
    );
  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

export function storePendingAction(action: PendingAction): string {
  ensureCleanup();
  const id = nextId();
  pending.set(id, action);
  // auto-expire
  setTimeout(() => pending.delete(id), 60_000).unref?.();
  return id;
}

export function consumePendingAction(id: string): PendingAction | null {
  const action = pending.get(id);
  if (!action) return null;
  if (action.expiresAt < Date.now()) { pending.delete(id); return null; }
  pending.delete(id);
  return action;
}

/* ─── Confirm / Cancel button handler ───────────────────────────────────── */

function extractActionId(interaction: ButtonInteraction): string | null {
  // customId is "confirm:actionId" or "cancel:actionId"
  const parts = interaction.customId.split(':');
  return parts.length >= 2 ? parts.slice(1).join(':') : null;
}

export const confirmButton = {
  type: 'button' as const,
  id: 'confirm:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    const id = extractActionId(interaction);
    if (!id) { await interaction.update({ content: 'Invalid action.', components: [] }); return; }
    const action = consumePendingAction(id);
    if (!action) { await interaction.update({ content: 'This confirmation has expired.', components: [] }); return; }
    await executeAction(app, interaction, action);
  },
};

export const cancelButton = {
  type: 'button' as const,
  id: 'cancel:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    const id = extractActionId(interaction);
    if (id) consumePendingAction(id); // discard
    await interaction.update({ content: '❌ Action cancelled.', components: [] });
  },
};

async function executeAction(app: App, interaction: ButtonInteraction, action: PendingAction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.update({ content: 'Guild not found.', components: [] }); return; }

  const {
    humanizeDuration,
  } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');

  const pm = app.punishmentManager;
  try {
    let result: { ok: boolean; error?: string; case?: { case_code: string } } | null = null;

    switch (action.action) {
      case 'ban': {
        const user = await app.client.users.fetch(action.targetUserId).catch(() => null);
        if (!user) { await interaction.update({ content: 'User not found.', components: [] }); return; }
        result = await pm.ban(user as never, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          durationMs: action.durationMs,
          deleteMessageDays: action.deleteDays,
        });
        break;
      }
      case 'kick': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        if (!member) { await interaction.update({ content: 'User not found in server.', components: [] }); return; }
        result = await pm.kick(member, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
        });
        break;
      }
      case 'mute':
      case 'timeout': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        if (!member) { await interaction.update({ content: 'User not found in server.', components: [] }); return; }
        result = await pm.timeout(member, action.durationMs ?? 3_600_000, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          logEvent: action.action === 'mute' ? 'member_mute' : 'member_timeout',
        });
        break;
      }
      case 'warn': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        const target = member ?? (await app.client.users.fetch(action.targetUserId).catch(() => null));
        if (!target) { await interaction.update({ content: 'User not found.', components: [] }); return; }
        result = await pm.warn(target, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
        });
        break;
      }
      case 'softban': {
        const user = await app.client.users.fetch(action.targetUserId).catch(() => null);
        if (!user) { await interaction.update({ content: 'User not found.', components: [] }); return; }
        result = await pm.softban(user as never, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
        });
        break;
      }
      case 'purge': {
        const channel = guild.channels.cache.get(action.channelId);
        if (!channel || !('bulkDelete' in channel)) { await interaction.update({ content: 'Channel not found.', components: [] }); return; }
        const fetched = await (channel as any).messages.fetch({ limit: 100 });
        const toDelete = fetched.filter((m: any) => m.id !== action.targetUserId).first(100);
        const ids = toDelete.map((m: any) => m.id);
        try { await channel.bulkDelete(ids, true); } catch { for (const m of toDelete) await m.delete().catch(() => undefined); }
        const purgeCount = ids.length;
        await app.logManager.log({ event: 'moderation_action', guildId: guild.id, channelId: action.channelId, actorId: action.actorId, message: `Purged ${purgeCount} messages in <#${action.channelId}>`, details: { amount: purgeCount } });
        await interaction.update({ content: `✅ Purged ${purgeCount} message(s).`, components: [] });
        return;
      }
      default:
        await interaction.update({ content: 'Unknown action.', components: [] });
        return;
    }

    if (!result) { await interaction.update({ content: 'Unknown action.', components: [] }); return; }
    const dur = action.durationMs ? ` for ${humanizeDuration(action.durationMs)}` : '';
    if (result.ok) {
      await interaction.update({ content: `✅ ${action.action} applied to <@${action.targetUserId}>${dur} — case ${result.case!.case_code}.`, components: [] });
    } else {
      await interaction.update({ content: `❌ Failed: ${result.error}`, components: [] });
    }
  } catch (err) {
    await interaction.update({ content: `❌ Error: ${(err as Error).message}`, components: [] });
  }
}

export default [confirmButton, cancelButton];
