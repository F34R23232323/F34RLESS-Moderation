import * as fs from 'fs';
import * as YAML from 'yaml';
import {
  ChannelType,
  PermissionFlagsBits,
  type ForumChannel,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import type { App } from '../core/context';
import { LOG_EVENT_NAMES, type LogEventName } from '../../../shared/src/index';

export const LOG_LAYOUTS = ['single', 'split', 'compact_categories', 'categories', 'forum', 'event_forum', 'forums', 'hybrid'] as const;
export type LogLayout = (typeof LOG_LAYOUTS)[number];

interface LogGroup {
  key: string;
  label: string;
  description: string;
  events: readonly LogEventName[];
}

export const LOG_GROUPS: readonly LogGroup[] = [
  {
    key: 'messages', label: 'Message Logs',
    description: 'Deleted, edited, and bulk-deleted message activity.',
    events: ['message_edit', 'message_delete', 'message_bulk_delete', 'archive_created'],
  },
  {
    key: 'members', label: 'Member Logs',
    description: 'Member joins, departures, bans, kicks, timeouts, and nickname changes.',
    events: ['member_join', 'member_leave', 'member_ban', 'member_unban', 'member_kick', 'member_mute', 'member_unmute', 'member_timeout', 'member_warn', 'member_unwarn', 'member_boost', 'member_unboost', 'member_avatar_update', 'member_username_update', 'nickname_change', 'impersonation_detected'],
  },
  {
    key: 'roles', label: 'Role Logs',
    description: 'Role assignments, removals, edits, creation, and deletion.',
    events: ['role_add', 'role_remove', 'role_change', 'role_update', 'role_create', 'role_delete'],
  },
  {
    key: 'channels', label: 'Channel Logs',
    description: 'Channel, thread, voice-state, invite, and webhook changes.',
    events: ['channel_create', 'channel_update', 'channel_delete', 'channel_pins_update', 'thread_create', 'thread_update', 'thread_delete', 'voice_state_update', 'invite_create', 'invite_delete', 'invite_use'],
  },
  {
    key: 'moderation', label: 'Moderation Logs',
    description: 'Moderator actions, automod triggers, reports, cases, and appeals.',
    events: ['moderation_action', 'automod_trigger', 'report_created', 'report_resolved', 'case_edit', 'case_voided', 'case_unvoided', 'case_linked', 'case_closed', 'note_add', 'note_edit', 'note_remove', 'appeal_created', 'appeal_resolved', 'emergency_ping_triggered'],
  },
  {
    key: 'server', label: 'Server & App Logs',
    description: 'Server, emoji, sticker, integration, and webhook changes.',
    events: ['guild_update', 'emoji_create', 'emoji_update', 'emoji_delete', 'sticker_create', 'sticker_update', 'sticker_delete', 'integration_create', 'integration_update', 'integration_delete', 'webhook_create', 'webhook_update', 'webhook_delete'],
  },
  {
    key: 'system', label: 'System Logs',
    description: 'Command usage, errors, and Discord rate-limit warnings.',
    events: ['command_usage', 'error_event', 'rate_limit_event'],
  },
  {
    key: 'economy', label: 'Economy Logs',
    description: 'Currency, shop, trade, marketplace, reward, job, and economy administration events.',
    events: ['economy_balance_change', 'economy_purchase', 'economy_sale', 'economy_trade', 'economy_marketplace', 'economy_steal', 'economy_role_reward', 'economy_admin_action', 'economy_quest', 'economy_achievement', 'economy_item_use', 'economy_daily', 'economy_work', 'economy_job', 'economy_craft', 'economy_gift', 'economy_reversal', 'economy_error'],
  },
] as const;

/** Every route the setup command promises to configure. Kept tied to the
 * shared canonical registry and checked at module load to prevent drift. */
export const ALL_LOG_EVENTS: readonly LogEventName[] = LOG_GROUPS.flatMap((group) => group.events);
const missingEvents = LOG_EVENT_NAMES.filter((event) => !ALL_LOG_EVENTS.includes(event));
const duplicateEvents = ALL_LOG_EVENTS.filter((event, index) => ALL_LOG_EVENTS.indexOf(event) !== index);
if (missingEvents.length || duplicateEvents.length || ALL_LOG_EVENTS.length !== LOG_EVENT_NAMES.length) {
  throw new Error(`Invalid logging setup catalog (missing: ${missingEvents.join(', ') || 'none'}; duplicates: ${[...new Set(duplicateEvents)].join(', ') || 'none'})`);
}

export interface LogSetupResult {
  layout: LogLayout;
  categoryCount: number;
  channelCount: number;
  postCount: number;
  configuredEvents: number;
  mentions: string[];
}

function eventTitle(event: string): string {
  return event.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function eventDescription(event: string, group: LogGroup): string {
  return `Automatic **${eventTitle(event)}** audit log.\n\n${group.description}\nEvents are posted here by F34RLESS Moderation.`;
}

async function persistLoggingConfig(app: App, routes: Map<string, { channel_id?: string; thread_id?: string }>): Promise<void> {
  const raw = fs.readFileSync(app.configPath, 'utf8');
  const document = YAML.parseDocument(raw);
  if (document.errors.length > 0) throw new Error(document.errors[0].message);

  for (const [event, target] of routes) {
    const previous = app.config.logging[event];
    const next = {
      enabled: previous?.enabled ?? true,
      ...target,
      ignore: previous?.ignore ?? { channels: [], categories: [], users: [], roles: [] },
    };
    document.setIn(['logging', event], next);
  }

  const temporaryPath = `${app.configPath}.logsetup-${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, document.toString(), 'utf8');
  // copyFileSync replaces an existing destination on Windows, while renameSync
  // does not reliably do so. Building the complete file separately still keeps
  // a serialization failure from truncating the live configuration.
  try {
    fs.copyFileSync(temporaryPath, app.configPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }

  for (const [event, target] of routes) {
    const previous = app.config.logging[event];
    app.config.logging[event] = {
      enabled: previous?.enabled ?? true,
      ...target,
      ignore: previous?.ignore ?? { channels: [], categories: [], users: [], roles: [] },
    };
  }
}

export class LogChannelSetupService {
  public constructor(private readonly app: App) {}

  public async create(guild: Guild, actorId: string, layout: LogLayout): Promise<LogSetupResult> {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('I need the Manage Channels permission to build a logging layout.');
    }

    const created: GuildBasedChannel[] = [];
    const routes = new Map<string, { channel_id?: string; thread_id?: string }>();
    const mentions: string[] = [];
    let categoryCount = 0;
    let channelCount = 0;
    let postCount = 0;

    // Logging destinations are always private. Child channels inherit this
    // overwrite from their category; standalone layouts receive it directly.
    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: actorId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.ReadMessageHistory] },
    ];

    try {
      if (layout === 'single') {
        const channel = await guild.channels.create({
          name: 'moderation-logs', type: ChannelType.GuildText,
          topic: 'All F34RLESS moderation and server audit events.', permissionOverwrites,
          reason: `Logging layout created by ${actorId}`,
        });
        created.push(channel); channelCount++; mentions.push(`<#${channel.id}>`);
        for (const group of LOG_GROUPS) for (const event of group.events) routes.set(event, { channel_id: channel.id });
      } else if (layout === 'split') {
        for (const group of LOG_GROUPS) {
          const channel = await guild.channels.create({
            name: `${group.key}-logs`, type: ChannelType.GuildText,
            topic: group.description, permissionOverwrites,
            reason: `Logging layout created by ${actorId}`,
          });
          created.push(channel); channelCount++; mentions.push(`<#${channel.id}>`);
          for (const event of group.events) routes.set(event, { channel_id: channel.id });
        }
      } else if (layout === 'compact_categories') {
        const category = await guild.channels.create({
          name: 'F34RLESS Logs', type: ChannelType.GuildCategory, permissionOverwrites,
          reason: `Logging layout created by ${actorId}`,
        });
        created.push(category); categoryCount++; mentions.push(`<#${category.id}>`);
        for (const group of LOG_GROUPS) {
          const channel = await guild.channels.create({
            name: `${group.key}-logs`, type: ChannelType.GuildText, parent: category.id,
            topic: group.description, reason: `Logging layout created by ${actorId}`,
          });
          created.push(channel); channelCount++;
          for (const event of group.events) routes.set(event, { channel_id: channel.id });
        }
      } else if (layout === 'categories') {
        for (const group of LOG_GROUPS) {
          const category = await guild.channels.create({
            name: `Logs — ${group.label.replace(' Logs', '')}`, type: ChannelType.GuildCategory,
            permissionOverwrites, reason: `Logging layout created by ${actorId}`,
          });
          created.push(category); categoryCount++; mentions.push(`<#${category.id}>`);
          for (const event of group.events) {
            const channel = await guild.channels.create({
              name: event.replaceAll('_', '-'), type: ChannelType.GuildText, parent: category.id,
              topic: eventDescription(event, group).replaceAll('**', '').replaceAll('\n', ' ').slice(0, 1024),
              reason: `Logging layout created by ${actorId}`,
            });
            created.push(channel); channelCount++;
            routes.set(event, { channel_id: channel.id });
          }
        }
      } else {
        const category = await guild.channels.create({
          name: 'F34RLESS Logs', type: ChannelType.GuildCategory, permissionOverwrites,
          reason: `Logging layout created by ${actorId}`,
        });
        created.push(category); categoryCount++; mentions.push(`<#${category.id}>`);

        if (layout === 'forum') {
          const forum = await this.createForum(guild, category.id, 'audit-logs', 'Organized audit streams. Each post contains one family of related events.', actorId);
          created.push(forum); channelCount++;
          for (const group of LOG_GROUPS) {
            const thread = await forum.threads.create({ name: group.label, message: { content: `# ${group.label}\n${group.description}\n\nThis post is updated automatically.` }, autoArchiveDuration: 10080, reason: `Logging layout created by ${actorId}` });
            created.push(thread); postCount++;
            for (const event of group.events) routes.set(event, { channel_id: forum.id, thread_id: thread.id });
          }
        } else if (layout === 'event_forum') {
          const forum = await this.createForum(guild, category.id, 'audit-logs', 'One automatically named post for every supported logging event.', actorId);
          created.push(forum); channelCount++;
          for (const group of LOG_GROUPS) {
            for (const event of group.events) {
              const thread = await forum.threads.create({ name: eventTitle(event), message: { content: eventDescription(event, group) }, autoArchiveDuration: 10080, reason: `Logging layout created by ${actorId}` });
              created.push(thread); postCount++;
              routes.set(event, { channel_id: forum.id, thread_id: thread.id });
            }
          }
        } else if (layout === 'hybrid') {
          const forumGroupKeys = new Set(['messages', 'members', 'moderation', 'economy']);
          for (const group of LOG_GROUPS) {
            if (forumGroupKeys.has(group.key)) {
              const forum = await this.createForum(guild, category.id, `${group.key}-logs`, group.description, actorId);
              created.push(forum); channelCount++;
              for (const event of group.events) {
                const thread = await forum.threads.create({ name: eventTitle(event), message: { content: eventDescription(event, group) }, autoArchiveDuration: 10080, reason: `Logging layout created by ${actorId}` });
                created.push(thread); postCount++;
                routes.set(event, { channel_id: forum.id, thread_id: thread.id });
              }
            } else {
              const channel = await guild.channels.create({
                name: `${group.key}-logs`, type: ChannelType.GuildText, parent: category.id,
                topic: group.description, reason: `Logging layout created by ${actorId}`,
              });
              created.push(channel); channelCount++;
              for (const event of group.events) routes.set(event, { channel_id: channel.id });
            }
          }
        } else {
          for (const group of LOG_GROUPS) {
            const forum = await this.createForum(guild, category.id, `${group.key}-logs`, group.description, actorId);
            created.push(forum); channelCount++;
            for (const event of group.events) {
              const thread = await forum.threads.create({ name: eventTitle(event), message: { content: eventDescription(event, group) }, autoArchiveDuration: 10080, reason: `Logging layout created by ${actorId}` });
              created.push(thread); postCount++;
              routes.set(event, { channel_id: forum.id, thread_id: thread.id });
            }
          }
        }
      }

      await persistLoggingConfig(this.app, routes);
      return { layout, categoryCount, channelCount, postCount, configuredEvents: routes.size, mentions };
    } catch (error) {
      await Promise.allSettled([...created].reverse().map((channel) => channel.delete('Rolling back failed logging layout setup')));
      throw error;
    }
  }

  private async createForum(guild: Guild, parentId: string, name: string, topic: string, actorId: string): Promise<ForumChannel> {
    return guild.channels.create({
      name, type: ChannelType.GuildForum, parent: parentId, topic,
      defaultAutoArchiveDuration: 10080,
      reason: `Logging layout created by ${actorId}`,
    });
  }
}
