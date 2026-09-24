import type { ButtonInteraction, Message } from 'discord.js';
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
import { mapDiscordError } from '../utils/moderationErrors';
import type { CaseEvidenceItem } from '../utils/evidence';
import { applicationEmoji, emojiPrefix } from '../emoji';

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
  /** For purge: max number of messages to delete */
  purgeAmount?: number;
  actorId: string;
  expiresAt: number;
  anonymous?: boolean;
  /** Extra evidence (e.g. stored images) attached when the action executes. */
  evidence?: CaseEvidenceItem[];
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

function v2Ephemeral(text: string) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as never;
}

function v2Update(text: string) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 } as never;
}

export function buildConfirmEmbed(
  action: string,
  targetUserId: string,
  reason: string,
  durationMs?: number,
  actionId?: string,
): { components: unknown[]; flags: number } {
  const { humanizeDuration } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');
  const durLine = durationMs ? `\nDuration: ${humanizeDuration(durationMs)}` : '';
  const confirmId = actionId ? `confirm:${actionId}` : 'confirm';
  const cancelId = actionId ? `cancel:${actionId}` : 'cancel';

  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${emojiPrefix('Warning')}**Confirm ${action.toUpperCase()}**\n` +
      `Target: <@${targetUserId}>\n` +
      `Reason: ${reason}${durLine}\n\n` +
      `**Press Confirm to proceed, or Cancel to abort.**`,
    ))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        setButtonEmoji(new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Danger), 'vyxia_tick'),
        setButtonEmoji(new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary), 'vyxia_cross'),
      ) as never,
    );
  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

function setButtonEmoji(button: ButtonBuilder, name: string): ButtonBuilder {
  const resolved = applicationEmoji(name);
  return resolved ? button.setEmoji(resolved) : button;
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

export function peekPendingAction(id: string): PendingAction | null {
  const action = pending.get(id);
  if (!action) return null;
  if (action.expiresAt < Date.now()) { pending.delete(id); return null; }
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
    // Acknowledge immediately — the checks and the punishment itself can take
    // well over Discord's 3-second component window.
    await interaction.deferUpdate();
    const id = extractActionId(interaction);
    if (!id) { await interaction.editReply(v2Update('Invalid action.')); return; }
    const action = peekPendingAction(id);
    if (!action) { await interaction.editReply(v2Update('This confirmation has expired.')); return; }
    if (interaction.user.id !== action.actorId) {
      await interaction.followUp({ content: 'Only the command invoker can confirm this action.', ephemeral: true });
      return;
    }
    consumePendingAction(id);
    await executeAction(app, interaction, action);
  },
};

export const cancelButton = {
  type: 'button' as const,
  id: 'cancel:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = extractActionId(interaction);
    if (!id) { await interaction.editReply(v2Update('Invalid action.')); return; }
    const action = peekPendingAction(id);
    if (!action) { await interaction.editReply(v2Update('This confirmation has expired.')); return; }
    if (interaction.user.id !== action.actorId) {
      await interaction.followUp({ content: 'Only the command invoker can cancel this action.', ephemeral: true });
      return;
    }
    consumePendingAction(id);
    await interaction.editReply(v2Update('❌ Action cancelled.'));
  },
};

async function executeAction(app: App, interaction: ButtonInteraction, action: PendingAction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.editReply(v2Update('Guild not found.')); return; }

  if (action.targetUserId === guild.ownerId) {
    await interaction.editReply(v2Update('❌ The server owner cannot be moderated.'));
    return;
  }

  if (await app.whitelist.isWhitelisted(guild.id, action.targetUserId, 'moderation')) {
    await interaction.editReply(v2Update('❌ This user is whitelisted from moderation actions.'));
    return;
  }

  const {
    humanizeDuration,
  } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');

  const pm = app.punishmentManager;
  try {
    let result: { ok: boolean; error?: string; case?: { case_code: string } } | null = null;

    switch (action.action) {
      case 'ban': {
        const user = await app.client.users.fetch(action.targetUserId).catch(() => null);
        if (!user) { await interaction.editReply(v2Update('User not found.')); return; }
        result = await pm.ban(user as never, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          durationMs: action.durationMs,
          deleteMessageDays: action.deleteDays,
          anonymous: action.anonymous,
          evidence: action.evidence,
        });
        break;
      }
      case 'kick': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        if (!member) { await interaction.editReply(v2Update('User not found in server.')); return; }
        result = await pm.kick(member, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          anonymous: action.anonymous,
          evidence: action.evidence,
        });
        break;
      }
      case 'mute':
      case 'timeout': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        if (!member) { await interaction.editReply(v2Update('User not found in server.')); return; }
        result = await pm.timeout(member, action.durationMs ?? 3_600_000, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          logEvent: action.action === 'mute' ? 'member_mute' : 'member_timeout',
          anonymous: action.anonymous,
          evidence: action.evidence,
        });
        break;
      }
      case 'warn': {
        const member = await guild.members.fetch(action.targetUserId).catch(() => null);
        const target = member ?? (await app.client.users.fetch(action.targetUserId).catch(() => null));
        if (!target) { await interaction.editReply(v2Update('User not found.')); return; }
        result = await pm.warn(target, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          anonymous: action.anonymous,
          evidence: action.evidence,
        });
        break;
      }
      case 'softban': {
        const user = await app.client.users.fetch(action.targetUserId).catch(() => null);
        if (!user) { await interaction.editReply(v2Update('User not found.')); return; }
        result = await pm.softban(user as never, {
          reason: action.reason,
          moderatorId: action.actorId,
          archiveChannelId: action.channelId,
          anonymous: action.anonymous,
          evidence: action.evidence,
        });
        break;
      }
      case 'purge': {
        const channel = guild.channels.cache.get(action.channelId);
        if (!channel || !('bulkDelete' in channel)) { await interaction.editReply(v2Update('Channel not found.')); return; }
        const purgeLimit = action.purgeAmount ?? 100;
        let toDelete;
        if (action.purgeAfterId) {
          const after = await (channel as any).messages.fetch({ after: action.purgeAfterId, limit: purgeLimit });
          toDelete = [...after.values()];
        } else {
          const fetched = await (channel as any).messages.fetch({ limit: Math.min(purgeLimit + 10, 100) });
          toDelete = fetched.filter((m: any) => m.author.id !== action.targetUserId).first(purgeLimit);
        }
        const ids = toDelete.map((m: any) => m.id);
        if (ids.length > 0) {
          try { await channel.bulkDelete(ids, true); } catch { for (const m of toDelete) await m.delete().catch(() => undefined); }
        }
        const purgeCount = ids.length;
        await app.logManager.log({ event: 'moderation_action', guildId: guild.id, channelId: action.channelId, actorId: action.actorId, message: `Purged ${purgeCount} messages in <#${action.channelId}>`, details: { amount: purgeCount } });
        await interaction.editReply(v2Update(`✅ Purged ${purgeCount} message(s).`));
        return;
      }
      case 'clearwarnings': {
        const { executeClear } = await import('../commands/moderation/clearwarnings');
        const cleared = await executeClear(app, guild, action.targetUserId, undefined, action.actorId);
        await interaction.editReply(v2Update(
          cleared > 0
            ? `✅ Cleared ${cleared} warning(s) for <@${action.targetUserId}>.`
            : `<@${action.targetUserId}> has no active warnings.`,
        ));
        return;
      }
      default:
        await interaction.editReply(v2Update('Unknown action.'));
        return;
    }

    if (!result) { await interaction.editReply(v2Update('Unknown action.')); return; }
    const dur = action.durationMs ? ` for ${humanizeDuration(action.durationMs)}` : '';
    if (result.ok) {
      await interaction.editReply(v2Update(`✅ ${action.action} applied to <@${action.targetUserId}>${dur} — case ${result.case!.case_code}.`));
    } else {
      await interaction.editReply(v2Update(`❌ Failed: ${mapDiscordError(result.error!)}`));
    }
  } catch (err) {
    await interaction.editReply(v2Update(`❌ Error: ${(err as Error).message}`));
  }
}

export default [confirmButton, cancelButton];

/* ─── User Context Menu Confirmation ─────────────────────────────────────── */

export async function contextUserConfirm(
  app: App,
  interaction: any,
  action: string,
  reason: string,
  executeFn: () => Promise<{ ok: boolean; error?: string; case?: { case_code: string } }>,
  opts?: { durationMs?: number; deleteDays?: number },
): Promise<void> {
  const { humanizeDuration } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');
  const targetId = interaction.targetUser.id;
  const guild = interaction.guild;
  if (!guild) { await interaction.reply({ content: 'Not in a guild.', ephemeral: true }); return; }

  await interaction.deferReply({ ephemeral: true });

  const actionId = storePendingAction({
    action,
    targetUserId: targetId,
    guildId: guild.id,
    channelId: interaction.channelId,
    reason,
    durationMs: opts?.durationMs,
    deleteDays: opts?.deleteDays,
    actorId: interaction.user.id,
    expiresAt: Date.now() + 60_000,
  });

  const { components, flags } = buildConfirmEmbed(action, targetId, reason, opts?.durationMs, actionId);
  await interaction.editReply({ components, flags } as never);
}

/* ─── CV2 Button Confirmation for Prefix Commands ────────────────────────── */

export async function sendButtonConfirm(
  app: App,
  message: Message,
  action: string,
  targetUserId: string,
  reason: string,
  durationMs?: number,
): Promise<{ confirmed: boolean }> {
  const { humanizeDuration } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');
  const { v2MessageReply } = await import('../utils/v2');
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = await import('discord.js');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');

  const actionId = nextId();

  const durLine = durationMs ? ` for ${humanizeDuration(durationMs)}` : '';
  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(new (await import('discord.js')).TextDisplayBuilder().setContent(
      `⚠️ **Confirm ${action.toUpperCase()}**\nTarget: <@${targetUserId}>${durLine}\nReason: ${reason}\n\n**Press Confirm to proceed, or Cancel to abort.**`,
    ))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pconfirm:${actionId}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`pcancel:${actionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      ) as never,
    );

  const sent = await (message.channel as any).send({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });

  return new Promise((resolve) => {
    const filter = (i: any) => (i.customId.startsWith('pconfirm:') || i.customId.startsWith('pcancel:')) && i.user.id === message.author.id;
    const collector = sent.createMessageComponentCollector({ filter, time: 60_000, max: 1 });
    collector.on('collect', async (i: any) => {
      if (i.customId.startsWith('pcancel:')) {
        const cancelContainer = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('❌ Action cancelled.'));
        await i.update({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 } as never);
        resolve({ confirmed: false });
      } else {
        await i.deferUpdate();
        await sent.delete().catch(() => undefined);
        resolve({ confirmed: true });
      }
    });
    collector.on('end', async (_collected: any, reason: string) => {
      if (reason === 'time') {
        await sent.delete().catch(() => undefined);
        await message.reply('Confirmation expired.').catch(() => undefined);
        resolve({ confirmed: false });
      }
    });
  });
}
