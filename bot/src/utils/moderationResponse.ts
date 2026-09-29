import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  type User,
} from 'discord.js';
import { humanizeDuration } from '../../../shared/src/index';
import { mapDiscordError } from './moderationErrors';

const VERBS: Record<string, string> = {
  ban: 'banned',
  tempban: 'banned',
  softban: 'softbanned',
  kick: 'kicked',
  mute: 'muted',
  timeout: 'muted',
  unmute: 'unmuted',
  unban: 'unbanned',
  warn: 'warned',
  temprole: 'role added',
};

export interface ModerationResultOptions {
  action: string;
  target: User | GuildMember | { id: string; username?: string; discriminator?: string; tag?: string };
  ok: boolean;
  durationMs?: number | null;
  reason?: string | null;
  dmSent?: boolean;
  error?: string | null;
}

export function formatTargetTag(target: unknown): string {
  if (!target) return 'Unknown User';
  if (typeof target === 'string') return target;
  const user = 'user' in (target as any) ? (target as any).user : target;
  if (!user) return 'Unknown User';
  if (user.discriminator && user.discriminator !== '0') {
    return `${user.username}#${user.discriminator}`;
  }
  return user.tag ?? user.username ?? 'Unknown User';
}

/**
 * Build Sapphire-style moderation command result card:
 *
 *   [green/red left border]
 *   ✅ User#0000 banned
 *   > Duration: Permanent
 *   > Reason: ...
 *
 *   Errors
 *   DM not sent: User disabled DMs.
 */
export function buildModerationCard(opts: ModerationResultOptions): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder();
  const tag = formatTargetTag(opts.target);

  if (opts.ok) {
    container.setAccentColor(0x57f287 as never);
    const verb = VERBS[opts.action] ?? `${opts.action}ed`;
    const lines: string[] = [`✅ **${tag} ${verb}**`];

    const details: string[] = [];
    if (['ban', 'tempban'].includes(opts.action)) {
      details.push(`> Duration: ${opts.durationMs && opts.durationMs > 0 ? humanizeDuration(opts.durationMs) : 'Permanent'}`);
    } else if (['mute', 'timeout'].includes(opts.action) && opts.durationMs && opts.durationMs > 0) {
      details.push(`> Duration: ${humanizeDuration(opts.durationMs)}`);
    }

    if (opts.reason && opts.reason !== 'No reason provided') {
      details.push(`> Reason: ${opts.reason}`);
    }

    if (details.length > 0) {
      lines.push(details.join('\n'));
    }

    if (opts.dmSent === false) {
      lines.push('\nErrors\nDM not sent: User disabled DMs.');
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  } else {
    container.setAccentColor(0xed4245 as never);
    const lines: string[] = [`❌ **Failed to ${opts.action} ${tag}**`];
    if (opts.error) {
      lines.push(`\nErrors\n${mapDiscordError(opts.error)}`);
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  }

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

/** Reply to a message or interaction with Sapphire's moderation style. */
export async function sendModerationResponse(
  trigger: Message | ChatInputCommandInteraction,
  opts: ModerationResultOptions,
): Promise<void> {
  const payload = buildModerationCard(opts);
  const noPing = { parse: [] as string[], repliedUser: false };

  if ('editReply' in trigger && typeof trigger.editReply === 'function') {
    const intr = trigger as ChatInputCommandInteraction;
    const body: any = { components: payload.components, flags: payload.flags, allowedMentions: noPing };
    if (intr.replied || intr.deferred) {
      await intr.editReply(body);
    } else {
      await intr.reply(body);
    }
  } else {
    await (trigger as Message).reply({
      components: payload.components as any,
      flags: payload.flags,
      allowedMentions: noPing,
    } as any).catch(async () => {
      await (trigger.channel as any).send({
        components: payload.components as any,
        flags: payload.flags,
        allowedMentions: noPing,
      } as any).catch(() => undefined);
    });
  }
}
