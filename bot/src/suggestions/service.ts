import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { GuildMember } from 'discord.js';
import { ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import type { BotConfig } from '../../../shared/src/index';
import { hexToInt } from '../utils/v2';

export interface SuggestionRow extends RowDataPacket {
  id: number;
  guild_id: string;
  message_id: string | null;
  thread_id: string | null;
  user_id: string;
  content: string;
  status: string;
  handled_by: string | null;
  handled_at: Date | null;
  note: string | null;
  created_at: Date;
}

export class SuggestionService {
  private _client: import('discord.js').Client | null = null;

  constructor(
    private readonly db: Pool,
    private readonly config: BotConfig,
  ) {}

  setClient(client: import('discord.js').Client): void {
    this._client = client;
  }

  async create(guildId: string, userId: string, content: string, messageId: string): Promise<number> {
    const [result] = await this.db.execute(
      'INSERT INTO suggestions (guild_id, user_id, content, message_id, status) VALUES (?, ?, ?, ?, ?)',
      [guildId, userId, content, messageId, this.config.community.suggestions.default_status],
    );
    return (result as any).insertId as number;
  }

  async setThread(suggestionId: number, threadId: string): Promise<void> {
    await this.db.execute('UPDATE suggestions SET thread_id = ? WHERE id = ?', [threadId, suggestionId]);
  }

  async setMessage(suggestionId: number, messageId: string): Promise<void> {
    await this.db.execute('UPDATE suggestions SET message_id = ? WHERE id = ?', [messageId, suggestionId]);
  }

  async getById(id: number): Promise<SuggestionRow | null> {
    const [rows] = await this.db.query<SuggestionRow[]>('SELECT * FROM suggestions WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async getByGuild(guildId: string, status?: string): Promise<SuggestionRow[]> {
    if (status) {
      const [rows] = await this.db.query<SuggestionRow[]>(
        'SELECT * FROM suggestions WHERE guild_id = ? AND status = ? ORDER BY created_at DESC LIMIT 25',
        [guildId, status],
      );
      return rows;
    }
    const [rows] = await this.db.query<SuggestionRow[]>(
      'SELECT * FROM suggestions WHERE guild_id = ? ORDER BY created_at DESC LIMIT 25',
      [guildId],
    );
    return rows;
  }

  async setStatus(id: number, status: string, handledBy: string, note?: string): Promise<void> {
    await this.db.execute(
      'UPDATE suggestions SET status = ?, handled_by = ?, handled_at = NOW(), note = COALESCE(?, note) WHERE id = ?',
      [status, handledBy, note ?? null, id],
    );
  }

  isStaff(member: GuildMember): boolean {
    const { staff_role_ids } = this.config.community.suggestions;
    if (staff_role_ids.length === 0) {
      return member.permissions.has('ModerateMembers');
    }
    return staff_role_ids.some((roleId) => member.roles.cache.has(roleId)) || member.permissions.has('ModerateMembers');
  }

  isBlacklisted(member: GuildMember): boolean {
    const { blacklisted_roles } = this.config.community.suggestions;
    if (blacklisted_roles.length === 0) return false;
    return blacklisted_roles.some((roleId) => member.roles.cache.has(roleId));
  }

  isBlacklistedChannel(channelId: string): boolean {
    return this.config.community.suggestions.blacklisted_channels.includes(channelId);
  }

  hasBypassRole(member: GuildMember): boolean {
    const { bypass_roles } = this.config.community.suggestions;
    if (bypass_roles.length === 0) return false;
    return bypass_roles.some((roleId) => member.roles.cache.has(roleId));
  }

  async sendStatusDm(userId: string, suggestionId: number, status: string, handledByTag?: string, note?: string, guildName?: string): Promise<void> {
    const cfg = this.config.community.suggestions;
    const statusDef = cfg.statuses.find((s) => s.name === status);
    const color = statusDef?.color ? hexToInt(statusDef.color) : 0x5865f2;

    const lines: string[] = [`Your suggestion **#${suggestionId}** has been updated.`];
    if (handledByTag) lines.push(`**Staff:** ${handledByTag}`);
    if (note) lines.push(`**Note:** ${note}`);

    const container = new ContainerBuilder()
      .setAccentColor((color ?? 0x5865f2) as never)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Suggestion #${suggestionId}`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Status:** ${status}${guildName ? `\n**Server:** ${guildName}` : ''}`),
      );

    try {
      const user = await this._client?.users.fetch(userId);
      if (user) {
        await user.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        } as never).catch(() => undefined);
      }
    } catch {
      // User has DMs disabled
    }
  }

  async sendConfirmationDm(userId: string, suggestionId: number, content: string, status: string, guildName?: string): Promise<void> {
    const cfg = this.config.community.suggestions;
    const statusDef = cfg.statuses.find((s) => s.name === status);
    const color = statusDef?.color ? hexToInt(statusDef.color) : 0x5865f2;

    const container = new ContainerBuilder()
      .setAccentColor((color ?? 0x5865f2) as never)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Suggestion #${suggestionId} Submitted`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Your suggestion:**\n> ${content.replace(/\n/g, '\n> ')}`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Status:** ${status}${guildName ? `\n**Server:** ${guildName}` : ''}`),
      );

    try {
      const user = await this._client?.users.fetch(userId);
      if (user) {
        await user.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        } as never).catch(() => undefined);
      }
    } catch {
      // User has DMs disabled
    }
  }

  async sendValidationDm(userId: string, text: string, accentColor = 0xed4245): Promise<void> {
    const container = new ContainerBuilder()
      .setAccentColor(accentColor as never)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    try {
      const user = await this._client?.users.fetch(userId);
      if (user) {
        await user.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        } as never).catch(() => undefined);
      }
    } catch {
      // User has DMs disabled
    }
  }
}
