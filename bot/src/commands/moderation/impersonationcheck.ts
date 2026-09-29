import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Guild, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';
import { checkMemberManually, scanGuild } from '../../security/impersonation';
import type { ImpersonationResult } from '../../security/impersonation';

function formatResult(r: ImpersonationResult): string {
  const matchDesc =
    r.match.kind === 'member'
      ? `matched <@${r.match.matchedUserId}> ("${r.match.matchedName}")`
      : `matched the server name ("${r.match.matchedName}")`;
  const parts = [`- <@${r.targetId}> ${matchDesc} → **${r.action}** (offense #${r.offense})`];
  if (r.caseCode) parts.push(`case ${r.caseCode}`);
  if (!r.nicknameReset) parts.push('nickname reset failed (role hierarchy)');
  if (!r.applied) parts.push(`action failed: ${r.error ?? 'unknown error'}`);
  return parts.join(' — ');
}

async function checkOne(app: App, guild: Guild, targetId: string): Promise<string> {
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) return `User not found in this server.`;

  const { result, exemption } = await checkMemberManually(app, member);
  const note = automationNote(app);
  const header = `**Impersonation check: <@${targetId}>**`;
  if (exemption) {
    const what =
      exemption.targetId === targetId
        ? 'Exempt from anti-impersonation checks'
        : `Match found, but the impersonator <@${exemption.targetId}> is exempt — no action taken`;
    return `${header}\n${what} (${exemption.reason}).${note}`;
  }
  if (!result) return `${header}\nNo impersonation detected.${note}`;
  return `${header}\n${formatResult(result)}${note}`;
}

/** Shown when the running process has automation off, so a manual run still works but the state is visible. */
function automationNote(app: App): string {
  if (app.config.anti_impersonation.enabled) return '';
  return '\n\n_ℹ️ Automatic anti-impersonation checks are disabled in the running config (`anti_impersonation.enabled`) — scheduled scans and join/nick/username triggers will not fire until it is enabled and the bot restarted._';
}

async function checkGuild(app: App, guild: Guild): Promise<string> {
  const report = await scanGuild(app, guild, { force: true });
  const header = `**Impersonation scan — ${guild.name}** (scanned ${report.scanned} of ${guild.memberCount} members)`;
  const lines: string[] = [];
  if (report.results.length > 0) {
    lines.push(`${report.results.length} actioned:`);
    lines.push(...report.results.map((r) => formatResult(r)));
  }
  for (const s of report.exemptSkipped) {
    const who = s.matchedUserId ? `<@${s.matchedUserId}>` : 'the server name';
    lines.push(`- <@${s.targetId}> matched ${who} ("${s.matchedName}") — exempt (${s.reason}), no action taken`);
  }
  if (lines.length === 0) lines.push('No impersonation detected.');
  return `${header}\n${lines.join('\n')}${automationNote(app)}`;
}

const data = new SlashCommandBuilder()
  .setName('impersonationcheck')
  .setDescription('Check one user or the whole server for name impersonation')
  .addUserOption((o) =>
    o.setName('user').setDescription('Target user (omit to scan the whole server)').setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await v2Reply(interaction, 'This command can only be used in a server.', { ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user');
  const content = user ? await checkOne(app, guild, user.id) : await checkGuild(app, guild);
  await v2Reply(interaction, content);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  if (args.length === 0) {
    await v2MessageReply(message, { content: await checkGuild(app, guild) });
    return;
  }
  const targetId = parseTargetId(args[0]);
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!impersonationcheck [user]`' });
    return;
  }
  await v2MessageReply(message, { content: await checkOne(app, guild, targetId) });
}

const command: BotCommand = {
  name: 'impersonationcheck',
  category: 'moderation',
  description: 'Check one user or the whole server for exact name impersonation',
  usage: '!impersonationcheck [user]',
  details:
    'Compares every member name (nickname, display name, username) for exact collisions. With a user argument it checks and actioned that member only; without one it scans the whole server. The nickname is reset, the user is notified, and the configured escalation action is applied.',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['impcheck', 'impersonation'],
  execute,
  prefixExecute,
};

export default command;
