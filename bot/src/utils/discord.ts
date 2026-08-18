import type { ChatInputCommandInteraction, Guild, User } from 'discord.js';
import type { App } from '../core/context';

export async function resolveUserOption(
  interaction: ChatInputCommandInteraction,
  app: App,
  optionName = 'user',
): Promise<User | null> {
  const value = interaction.options.getUser(optionName);
  if (value) return value;
  const id = interaction.options.getString(optionName);
  if (!id) return null;
  return app.client.users.fetch(id).catch(() => null);
}

export async function resolveMemberOption(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  app: App,
  optionName = 'user',
): Promise<{ member: any; user: User | null } | null> {
  const user = await resolveUserOption(interaction, app, optionName);
  if (!user) return null;
  const member = await guild.members.fetch(user.id).catch(() => null);
  return { member, user };
}

export function getOptionString(interaction: ChatInputCommandInteraction, name: string): string | undefined {
  return interaction.options.getString(name) ?? undefined;
}

export function getOptionInt(interaction: ChatInputCommandInteraction, name: string): number | undefined {
  const v = interaction.options.getInteger(name);
  return v ?? undefined;
}

export function getOptionBoolean(interaction: ChatInputCommandInteraction, name: string): boolean | undefined {
  const v = interaction.options.getBoolean(name);
  return v ?? undefined;
}