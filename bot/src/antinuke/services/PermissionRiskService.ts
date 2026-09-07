import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const dangerous = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.ManageEvents, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.MentionEveryone] as const;

export interface PermissionDelta { readonly added: readonly string[]; readonly removed: readonly string[]; readonly risk: number }

export class PermissionRiskService {
  public analyze(before: Readonly<PermissionsBitField>, after: Readonly<PermissionsBitField>): PermissionDelta {
    const added = dangerous.filter((permission) => !before.has(permission) && after.has(permission)).map(String);
    const removed = dangerous.filter((permission) => before.has(permission) && !after.has(permission)).map(String);
    return { added, removed, risk: added.length * 20 + removed.length * 5 };
  }
}
