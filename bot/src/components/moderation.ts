import type { ButtonInteraction, ChatInputCommandInteraction, Message } from 'discord.js';
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
import { buildModerationCard } from '../utils/moderationResponse';

/** How long a confirmation card stays actionable. */
export const CONFIRM_TTL_MS = 300_000;

/** Pending moderation action awaiting confirmation. Stored in-memory with a
 *  TTL so stale entries are cleaned up automatically. */
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
  /** For purge: only delete messages authored by this user (null = everyone). */
  purgeUserId?: string | null;
  actorId: string;
  expiresAt: number;
  anonymous?: boolean;
  /** Extra evidence (e.g. stored images) attached when the action executes. */
  evidence?: CaseEvidenceItem[];
  /** Set once Confirm is pressed — blocks double execution. */
  running?: boolean;
  /** Invoked when the TTL lapses while the card is live (disables buttons). */
  onExpire?: () => Promise<void> | void;
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
      if (action.expiresAt < now) void expireAction(key, action);
    }
    if (pending.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

async function expireAction(id: string, action: PendingAction): Promise<void> {
  if (action.running) return; // execution in flight — let it finish and release itself
  pending.delete(id);
  try {
    await action.onExpire?.();
  } catch {
    // card may already be gone; nothing to do
  }
}

let actionCounter = 0;
function nextId(): string {
  return `${Date.now()}-${++actionCounter}`;
}

/* ─── Builders ──────────────────────────────────────────────────────────── */

function v2Container(text: string, accent?: number) {
  const container = new ContainerBuilder();
  if (accent !== undefined) container.setAccentColor(accent as never);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return container;
}

export interface ConfirmSpec {
  /** Executor key matched by executeAction's switch (e.g. 'purge'). */
  action: string;
  /** Card title; defaults to action (e.g. "Purge 12 messages"). */
  display?: string;
  targetUserId: string;
  reason: string;
  durationMs?: number;
  guildId: string;
  channelId: string;
  actorId: string;
  deleteDays?: number;
  purgeAfterId?: string;
  purgeAmount?: number;
  purgeUserId?: string | null;
  anonymous?: boolean;
  evidence?: CaseEvidenceItem[];
  /** Custom card renderer (defaults to buildConfirmEmbed). */
  card?: (actionId: string) => { components: unknown[]; flags: number };
}

/** Store a pending action (5-minute TTL) and render its confirmation card on
 *  an already-deferred interaction. When the TTL lapses the card's buttons are
 *  disabled in place so users never click a dead button. */
export async function sendConfirmation(
  interaction: ChatInputCommandInteraction | { editReply: (payload: never) => Promise<unknown> },
  spec: ConfirmSpec,
): Promise<string> {
  const { onExpire, display: _display, card: cardOption, ...rest } = spec as ConfirmSpec & { onExpire?: () => Promise<void> | void };
  const expiresAt = Date.now() + CONFIRM_TTL_MS;
  const card = cardOption ?? ((id: string) => buildConfirmEmbed(
    spec.display ?? spec.action,
    spec.targetUserId,
    spec.reason,
    spec.durationMs,
    id,
    expiresAt,
  ));
  const actionId = storePendingAction({
    ...rest,
    expiresAt,
    onExpire: onExpire ?? (async () => { await (interaction as ChatInputCommandInteraction).editReply(buildExpiredCard() as never).catch(() => undefined); }),
  });
  const { components, flags } = card(actionId);
  await (interaction as ChatInputCommandInteraction).editReply({ components, flags } as never);
  return actionId;
}

export function buildConfirmEmbed(
  action: string,
  targetUserId: string,
  reason: string,
  durationMs?: number,
  actionId?: string,
  expiresAt?: number,
): { components: unknown[]; flags: number } {
  const { humanizeDuration } = require('../../../shared/src/index') as typeof import('../../../shared/src/index');
  const durLine = durationMs ? `\nDuration: ${humanizeDuration(durationMs)}` : '';
  const expiry = expiresAt ? `\n⏱ Expires <t:${Math.floor(expiresAt / 1000)}:R>` : '';
  const confirmId = actionId ? `confirm:${actionId}` : 'confirm';
  const cancelId = actionId ? `cancel:${actionId}` : 'cancel';

  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${emojiPrefix('Warning')}**Confirm ${action.toUpperCase()}**\n` +
      `Target: <@${targetUserId}> (\`${targetUserId}\`)\n` +
      `Reason: ${reason}${durLine}${expiry}\n\n` +
      `**Press Confirm to proceed, or Cancel to abort.**`,
    ))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        setButtonEmoji(new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success), 'vyxia_tick'),
        setButtonEmoji(new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary), 'vyxia_cross'),
      ) as never,
    );
  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

/** Rendered in place of a confirmation card once its TTL lapses. */
export function buildExpiredCard(): { components: unknown[]; flags: number } {
  return {
    components: [v2Container(`${emojiPrefix('disabled')}**Confirmation expired**\nRun the command again to start over.`, 0x80848e)] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}

function setButtonEmoji(button: ButtonBuilder, name: string): ButtonBuilder {
  const resolved = applicationEmoji(name);
  return resolved ? button.setEmoji(resolved) : button;
}

export function storePendingAction(action: PendingAction): string {
  ensureCleanup();
  const id = nextId();
  pending.set(id, action);
  const ttl = Math.max(action.expiresAt - Date.now(), 0);
  setTimeout(() => {
    const current = pending.get(id);
    if (current) void expireAction(id, current);
  }, ttl).unref?.();
  return id;
}

export function peekPendingAction(id: string): PendingAction | null {
  const action = pending.get(id);
  if (!action) return null;
  if (action.expiresAt < Date.now()) { void expireAction(id, action); return null; }
  return action;
}

/** Atomically claim a pending action for execution. Returns 'running' when a
 *  previous click is still executing (blocks double-click races). */
export function claimPendingAction(id: string): { ok: true; action: PendingAction } | { ok: false; reason: 'expired' | 'running' } {
  const action = peekPendingAction(id);
  if (!action) return { ok: false, reason: 'expired' };
  if (action.running) return { ok: false, reason: 'running' };
  action.running = true;
  return { ok: true, action };
}

export function releasePendingAction(id: string): void {
  pending.delete(id);
}

/* ─── Result delivery ───────────────────────────────────────────────────── */

/** Deliver a card to the confirmation interaction, falling back to a fresh
 *  ephemeral follow-up when the original card was dismissed mid-run. */
async function deliver(
  interaction: ButtonInteraction,
  payload: { components: unknown[]; flags: number },
): Promise<void> {
  try {
    await interaction.editReply(payload as never);
  } catch {
    try {
      await interaction.followUp({
        components: payload.components,
        flags: payload.flags | MessageFlags.Ephemeral,
      } as never);
    } catch {
      // user dismissed everything — the log entry still records the outcome
    }
  }
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
    if (!id) { await deliver(interaction, { components: [v2Container('Invalid action.')], flags: MessageFlags.IsComponentsV2 }); return; }
    const peeked = peekPendingAction(id);
    if (!peeked) { await deliver(interaction, buildExpiredCard()); return; }
    if (interaction.user.id !== peeked.actorId) {
      await interaction.followUp({ content: 'Only the command invoker can confirm this action.', ephemeral: true }).catch(() => undefined);
      return;
    }
    const claim = claimPendingAction(id);
    if (!claim.ok) {
      const msg = claim.reason === 'running'
        ? `${emojiPrefix('Warning')}**Already in progress**\nThis action is being applied right now.`
        : undefined;
      await deliver(interaction, msg
        ? { components: [v2Container(msg, 0xfee75c)], flags: MessageFlags.IsComponentsV2 }
        : buildExpiredCard());
      return;
    }
    const action = claim.action;
    await deliver(interaction, {
      components: [v2Container(`${emojiPrefix('Loading')}**Applying ${action.action}** to <@${action.targetUserId}>…`, 0x5865f2)],
      flags: MessageFlags.IsComponentsV2,
    });
    try {
      await executeAction(app, interaction, action);
    } finally {
      releasePendingAction(id);
    }
  },
};

export const cancelButton = {
  type: 'button' as const,
  id: 'cancel:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = extractActionId(interaction);
    if (!id) { await deliver(interaction, { components: [v2Container('Invalid action.')], flags: MessageFlags.IsComponentsV2 }); return; }
    const peeked = peekPendingAction(id);
    if (!peeked) { await deliver(interaction, buildExpiredCard()); return; }
    if (interaction.user.id !== peeked.actorId) {
      await interaction.followUp({ content: 'Only the command invoker can cancel this action.', ephemeral: true }).catch(() => undefined);
      return;
    }
    if (peeked.running) {
      await deliver(interaction, {
        components: [v2Container(`${emojiPrefix('Warning')}**Already in progress**\nThis action is being applied right now.`, 0xfee75c)],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }
    releasePendingAction(id);
    await deliver(interaction, {
      components: [v2Container('❌ Action cancelled.', 0x80848e)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

async function executeAction(app: App, interaction: ButtonInteraction, action: PendingAction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await deliver(interaction, { components: [v2Container('Guild not found.')], flags: MessageFlags.IsComponentsV2 }); return; }

  if (action.targetUserId === guild.ownerId) {
    await deliver(interaction, { components: [v2Container('❌ The server owner cannot be moderated.', 0xed4245)], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (await app.whitelist.isWhitelisted(guild.id, action.targetUserId, 'moderation')) {
    await deliver(interaction, { components: [v2Container('❌ This user is whitelisted from moderation actions.', 0xed4245)], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // Re-check hierarchy at execution time — the moderator may have been
  // demoted since the command ran.
  const targetMember = await guild.members.fetch(action.targetUserId).catch(() => null);
  const actorMember = await guild.members.fetch(action.actorId).catch(() => null);
  if (targetMember && actorMember) {
    const guard = app.modGuard.canModerate(targetMember, actorMember);
    if (!guard.ok) {
      await deliver(interaction, { components: [v2Container(`❌ Cannot ${action.action}: ${guard.reason}`, 0xed4245)], flags: MessageFlags.IsComponentsV2 });
      return;
    }
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
        if (!user) { await deliver(interaction, { components: [v2Container('User not found.')], flags: MessageFlags.IsComponentsV2 }); return; }
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
        const member = targetMember ?? (await guild.members.fetch(action.targetUserId).catch(() => null));
        if (!member) { await deliver(interaction, { components: [v2Container('User not found in server.')], flags: MessageFlags.IsComponentsV2 }); return; }
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
        const member = targetMember ?? (await guild.members.fetch(action.targetUserId).catch(() => null));
        if (!member) { await deliver(interaction, { components: [v2Container('User not found in server.')], flags: MessageFlags.IsComponentsV2 }); return; }
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
        const member = targetMember;
        const target = member ?? (await app.client.users.fetch(action.targetUserId).catch(() => null));
        if (!target) { await deliver(interaction, { components: [v2Container('User not found.')], flags: MessageFlags.IsComponentsV2 }); return; }
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
        if (!user) { await deliver(interaction, { components: [v2Container('User not found.')], flags: MessageFlags.IsComponentsV2 }); return; }
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
        if (!channel || !('bulkDelete' in channel)) { await deliver(interaction, { components: [v2Container('Channel not found.')], flags: MessageFlags.IsComponentsV2 }); return; }
        const purgeLimit = action.purgeAmount ?? 100;
        let toDelete;
        if (action.purgeAfterId) {
          const after = await (channel as any).messages.fetch({ after: action.purgeAfterId, limit: purgeLimit });
          toDelete = [...after.values()];
        } else {
          const fetched = await (channel as any).messages.fetch({ limit: Math.min(purgeLimit + 10, 100) });
          // Keep only the requested author's messages when a user filter is set.
          const filtered = action.purgeUserId
            ? fetched.filter((m: any) => m.author.id === action.purgeUserId)
            : fetched;
          toDelete = filtered.first(purgeLimit);
        }
        const ids = toDelete.map((m: any) => m.id);
        if (ids.length > 0) {
          try { await channel.bulkDelete(ids, true); } catch { for (const m of toDelete) await m.delete().catch(() => undefined); }
        }
        const purgeCount = ids.length;
        await app.logManager.log({ event: 'moderation_action', guildId: guild.id, channelId: action.channelId, actorId: action.actorId, message: `Purged ${purgeCount} messages in <#${action.channelId}>`, details: { amount: purgeCount } });
        await deliver(interaction, { components: [v2Container(`✅ Purged ${purgeCount} message(s).`, 0x57f287)], flags: MessageFlags.IsComponentsV2 });
        return;
      }
      case 'clearwarnings': {
        const { executeClear } = await import('../commands/moderation/clearwarnings');
        const cleared = await executeClear(app, guild, action.targetUserId, undefined, action.actorId);
        await deliver(interaction, {
          components: [v2Container(
            cleared > 0
              ? `✅ Cleared ${cleared} warning(s) for <@${action.targetUserId}>.`
              : `<@${action.targetUserId}> has no active warnings.`,
            0x57f287,
          )],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
      default:
        await deliver(interaction, { components: [v2Container('Unknown action.')], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    if (!result) { await deliver(interaction, { components: [v2Container('Unknown action.')], flags: MessageFlags.IsComponentsV2 }); return; }
    const targetUser = targetMember?.user ?? await app.client.users.fetch(action.targetUserId).catch(() => null);
    const card = buildModerationCard({
      action: action.action,
      target: targetUser ?? { id: action.targetUserId },
      ok: result.ok,
      durationMs: action.durationMs,
      reason: action.reason,
      dmSent: (result as any).dmSent,
      error: result.error,
    });
    await deliver(interaction, {
      components: card.components,
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    await deliver(interaction, {
      components: [v2Container(`❌ Error: ${(err as Error).message}`, 0xed4245)],
      flags: MessageFlags.IsComponentsV2,
    });

  }
}

export default [confirmButton, cancelButton];

/* ─── User Context Menu Confirmation ─────────────────────────────────────── */

export async function contextUserConfirm(
  app: App,
  interaction: any,
  action: string,
  reason: string,
  opts?: { durationMs?: number; deleteDays?: number },
): Promise<void> {
  const targetId = interaction.targetUser.id;
  const guild = interaction.guild;
  if (!guild) { await interaction.reply({ content: 'Not in a guild.', ephemeral: true }); return; }

  await interaction.deferReply({ ephemeral: true });

  await sendConfirmation(interaction, {
    action,
    targetUserId: targetId,
    reason,
    durationMs: opts?.durationMs,
    deleteDays: opts?.deleteDays,
    guildId: guild.id,
    channelId: interaction.channelId,
    actorId: interaction.user.id,
  });
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
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = await import('discord.js');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');

  const actionId = nextId();
  const expiresAt = Date.now() + CONFIRM_TTL_MS;

  const durLine = durationMs ? ` for ${humanizeDuration(durationMs)}` : '';
  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(new (await import('discord.js')).TextDisplayBuilder().setContent(
      `⚠️ **Confirm ${action.toUpperCase()}**\nTarget: <@${targetUserId}> (\`${targetUserId}\`)${durLine}\nReason: ${reason}\n` +
      `⏱ Expires <t:${Math.floor(expiresAt / 1000)}:R>\n\n**Press Confirm to proceed, or Cancel to abort.**`,
    ))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pconfirm:${actionId}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`pcancel:${actionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      ) as never,
    );

  const sent = await (message.channel as any).send({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed: boolean): void => {
      if (settled) return;
      settled = true;
      resolve({ confirmed });
    };
    const filter = (i: any) => (i.customId.startsWith('pconfirm:') || i.customId.startsWith('pcancel:')) && i.user.id === message.author.id;
    const collector = sent.createMessageComponentCollector({ filter, time: CONFIRM_TTL_MS, max: 1 });
    collector.on('collect', async (i: any) => {
      if (i.customId.startsWith('pcancel:')) {
        const cancelContainer = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('❌ Action cancelled.'));
        await i.update({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 } as never).catch(() => undefined);
        finish(false);
      } else {
        // Acknowledge, then remove the card; the command posts the result.
        await i.deferUpdate().catch(() => undefined);
        await sent.delete().catch(() => undefined);
        finish(true);
      }
    });
    collector.on('end', async (_collected: any, reason: string) => {
      if (reason === 'time' && !settled) {
        const expiredContainer = new ContainerBuilder()
          .setAccentColor(0x80848e)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('⌛ Confirmation expired. Run the command again to start over.'));
        await sent.edit({ components: [expiredContainer], flags: MessageFlags.IsComponentsV2 } as never).catch(() => undefined);
        finish(false);
      }
    });
  });
}
