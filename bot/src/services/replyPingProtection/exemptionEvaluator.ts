import type { GuildMember } from 'discord.js';
import type { ReplyPingProtectionConfig } from '../../../../shared/src/index';

export interface ExemptionCheckResult {
  exempt: boolean;
  reason?: string;
}

export function isExemptFromConfig(
  config: ReplyPingProtectionConfig,
  userId: string,
  member: GuildMember | null,
  channelId: string,
): ExemptionCheckResult {
  if (config.exempt_channels.includes(channelId)) {
    return { exempt: true, reason: 'exempt_channel' };
  }

  if (config.exempt_users.includes(userId)) {
    return { exempt: true, reason: 'exempt_user' };
  }

  if (member) {
    const hasExemptRole = member.roles.cache.some((r) => config.exempt_roles.includes(r.id));
    if (hasExemptRole) {
      return { exempt: true, reason: 'exempt_role' };
    }

    if (member.permissions.has('ManageMessages')) {
      return { exempt: true, reason: 'manage_messages_permission' };
    }
    if (member.permissions.has('Administrator')) {
      return { exempt: true, reason: 'administrator' };
    }
  }

  return { exempt: false };
}

export function isReplyMessage(
  messageReference: { message_id?: string | null; channel_id?: string | null } | null,
): boolean {
  return !!(messageReference && messageReference.message_id);
}
