import { Guild, GuildMember, User } from 'discord.js';
import { isValidSnowflake } from '../../../shared/src/index';

const ERROR_MAP: [RegExp, string][] = [
  [/missing permissions/i, 'I don\'t have permission to do that.'],
  [/missing access/i, 'I don\'t have access to do that.'],
  [/not have permission/i, 'I don\'t have permission to do that.'],
  [/target is a server owner/i, 'Cannot moderate the server owner.'],
  [/cannot (?:ban|kick|mute|timeout|manage|modify) (?:a )?(?:guild )?member with (?:a )?higher role/i, 'Cannot moderate: target has a higher role than me.'],
  [/you (?:do not|don't) have permission/i, 'You don\'t have permission to do that.'],
  [/user is a server owner/i, 'Cannot moderate the server owner.'],
  [/cannot modify a member who has a higher role/i, 'Cannot moderate: target has a higher role than you.'],
  [/unknown ban/i, 'That user is not banned in this server.'],
  [/unknown user/i, 'User not found.'],
  [/unknown member/i, 'User not found in this server.'],
  [/not found/i, 'User not found.'],
  [/invalid form body/i, 'Invalid input provided.'],
  [/could not find/i, 'User not found.'],
];

export function mapDiscordError(error: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(error)) return message;
  }
  return 'An error occurred. Please try again.';
}

export function parseTargetId(raw: string | undefined): string | null {
  if (!raw) return null;
  const id = raw.replace(/[<@!>]/g, '');
  if (!id || !isValidSnowflake(id)) return null;
  return id;
}

export async function resolveTargetMember(
  guild: Guild,
  targetId: string,
): Promise<{ member: GuildMember | null; error: string | null }> {
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) return { member: null, error: 'User not found in this server.' };
  return { member, error: null };
}

export async function resolveTargetUser(
  client: { users: { fetch(id: string): Promise<User> } },
  targetId: string,
): Promise<{ user: User | null; error: string | null }> {
  const user = await client.users.fetch(targetId).catch(() => null);
  if (!user) return { user: null, error: 'User not found.' };
  return { user, error: null };
}
