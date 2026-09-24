import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { emojiPrefix } from '../../emoji';
import { type WhitelistScope } from '../../services/whitelistService';

const SCOPE_CHOICES: { name: string; value: WhitelistScope }[] = [
  { name: 'All — Immune to everything', value: 'all' },
  { name: 'Automod — Spam, links, scams, regex, etc.', value: 'automod' },
  { name: 'Moderation — Warn, ban, kick, mute, etc.', value: 'moderation' },
  { name: 'Escalation — Warning ladder & automod escalation', value: 'escalation' },
  { name: 'Raid — Anti-raid timeout/quarantine', value: 'raid' },
  { name: 'Blacklist — Join blacklist checks', value: 'blacklist' },
  { name: 'Verification — Verification gate', value: 'verification' },
  { name: 'NSFW — NSFW image moderation', value: 'nsfw' },
  { name: 'Reply Ping — Reply ping protection', value: 'reply_ping' },
  { name: 'Voice — Voice mute/deafen/kick', value: 'voice' },
  { name: 'Slowmode — Custom slowmode rate limiting', value: 'slowmode' },
  { name: 'API — External API punishment queue', value: 'api' },
  { name: 'Nick Lock — Forced nickname reset', value: 'nick_lock' },
];

const SCOPE_DESCRIPTIONS: Record<WhitelistScope, string> = {
  all: 'Immune to every system — automod, moderation, escalation, raid, NSFW, voice, and more',
  automod: 'Immune to automod triggers (spam, links, scams, mass ping, regex, etc.)',
  moderation: 'Immune to manual moderation commands (warn, ban, kick, mute, timeout, quarantine)',
  escalation: 'Immune to automatic punishment escalation (warning ladder & automod trigger escalation)',
  raid: 'Immune to anti-raid actions (timeout, quarantine, force verify)',
  blacklist: 'Immune to join-time blacklist checks',
  verification: 'Immune to verification gate (role removal, re-verification)',
  nsfw: 'Immune to NSFW image moderation (message deletion)',
  reply_ping: 'Immune to reply-ping protection (message deletion, escalation)',
  voice: 'Immune to voice moderation (server mute, deafen, kick)',
  slowmode: 'Immune to custom slowmode rate limiting',
  api: 'Immune to external API punishment queue',
  nick_lock: 'Immune to forced nickname reset (nickname lock)',
};

const data = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Manage user whitelists for moderation, automod, and more')
  .addSubcommand((cmd) =>
    cmd
      .setName('add')
      .setDescription('Add a user to the whitelist')
      .addUserOption((o) => o.setName('user').setDescription('User to whitelist').setRequired(true))
      .addStringOption((o) =>
        o
          .setName('scope')
          .setDescription('What to whitelist them from')
          .setRequired(true)
          .addChoices(...SCOPE_CHOICES),
      )
      .addStringOption((o) => o.setName('reason').setDescription('Reason for whitelisting').setRequired(false)),
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('remove')
      .setDescription('Remove a user from the whitelist')
      .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true))
      .addStringOption((o) =>
        o
          .setName('scope')
          .setDescription('Scope to remove (leave empty to remove all)')
          .setRequired(false)
          .addChoices(...SCOPE_CHOICES),
      ),
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('list')
      .setDescription('List all whitelisted users')
      .addUserOption((o) => o.setName('user').setDescription('Filter by user').setRequired(false)),
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('info')
      .setDescription('Show details about a specific scope')
      .addStringOption((o) =>
        o
          .setName('scope')
          .setDescription('Scope to learn about')
          .setRequired(true)
          .addChoices(...SCOPE_CHOICES),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) {
    await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}This command is only available in a server.`, { ephemeral: true });
    return;
  }

  if (interaction.user.id !== guild.ownerId) {
    await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}Only the server owner can manage whitelists.`, { ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const user = interaction.options.getUser('user', true);
    const scope = interaction.options.getString('scope', true) as WhitelistScope;
    const reason = interaction.options.getString('reason');

    if (user.id === guild.ownerId) {
      await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}The server owner is always immune to everything — no whitelist entry is needed.`, { ephemeral: true });
      return;
    }

    await app.whitelist.add(guild.id, user.id, scope, interaction.user.id, reason ?? undefined);

    const scopeLabel = scope === 'all' ? 'all actions' : scope.replace(/_/g, ' ');
    await v2Reply(interaction, `${emojiPrefix('antinuke_tick1')}<@${user.id}> has been whitelisted from **${scopeLabel}**.${reason ? `\nReason: ${reason}` : ''}\n\n${emojiPrefix('vyxia_info')}${SCOPE_DESCRIPTIONS[scope]}`, { ephemeral: true });
    return;
  }

  if (subcommand === 'remove') {
    const user = interaction.options.getUser('user', true);
    const scope = interaction.options.getString('scope') as WhitelistScope | null;

    const removed = await app.whitelist.remove(guild.id, user.id, scope ?? undefined);
    if (removed === 0) {
      await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}No whitelist entries found for <@${user.id}>${scope ? ` in scope **${scope.replace(/_/g, ' ')}**` : ''}.`, { ephemeral: true });
      return;
    }

    const scopeLabel = scope ? ` from **${scope.replace(/_/g, ' ')}**` : ' (all scopes)';
    await v2Reply(interaction, `${emojiPrefix('antinuke_tick1')}Removed <@${user.id}> from whitelist${scopeLabel}.`, { ephemeral: true });
    return;
  }

  if (subcommand === 'list') {
    const filterUser = interaction.options.getUser('user');
    let entries = await app.whitelist.list(guild.id);
    if (filterUser) {
      entries = entries.filter((e) => e.user_id === filterUser.id);
    }

    if (entries.length === 0) {
      await v2Reply(interaction, `${emojiPrefix('vyxia_info')}No whitelist entries found${filterUser ? ` for <@${filterUser.id}>` : ''}.`, { ephemeral: true });
      return;
    }

    const lines = entries.map((e) => {
      const scopeLabel = e.scope === 'all' ? 'All' : e.scope.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const reasonPart = e.reason ? ` — ${e.reason}` : '';
      return `<@${e.user_id}> · **${scopeLabel}**${reasonPart} (by <@${e.added_by}>)`;
    });

    const title = filterUser ? `Whitelist entries for <@${filterUser.id}>` : 'All whitelist entries';
    await v2Reply(interaction, `**${emojiPrefix('vyxia_shield')} ${title}**\n\n${lines.join('\n')}`, { ephemeral: true });
    return;
  }

  if (subcommand === 'info') {
    const scope = interaction.options.getString('scope', true) as WhitelistScope;
    const desc = SCOPE_DESCRIPTIONS[scope];
    const scopeLabel = scope === 'all' ? 'All' : scope.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    await v2Reply(interaction, `**${emojiPrefix('vyxia_shield')} Scope: ${scopeLabel}**\n\n${desc}`, { ephemeral: true });
  }
}

const VALID_SCOPES = SCOPE_CHOICES.map((c) => c.value);

function parseMentionOrId(arg: string): string | null {
  const match = arg.match(/^<@!?(\d+)>$/);
  if (match) return match[1];
  if (/^\d{17,20}$/.test(arg)) return arg;
  return null;
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: `${emojiPrefix('antinuke_cross1')}This command is only available in a server.`, accentColor: '#ED4245' });
    return;
  }

  if (message.author.id !== guild.ownerId) {
    await v2MessageReply(message, { content: `${emojiPrefix('antinuke_cross1')}Only the server owner can manage whitelists.`, accentColor: '#ED4245' });
    return;
  }

  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || !['add', 'remove', 'list', 'info'].includes(sub)) {
    await v2MessageReply(message, {
      content: '**Usage**\n\n'
        + '`!whitelist add <user> <scope> [reason]`\n'
        + '`!whitelist remove <user> [scope]`\n'
        + '`!whitelist list [user]`\n'
        + '`!whitelist info <scope>`\n\n'
        + `**Scopes:** ${VALID_SCOPES.join(', ')}`,
      accentColor: '#ED4245',
    });
    return;
  }

  if (sub === 'add') {
    const targetId = parseMentionOrId(args[1] ?? '');
    const scope = (args[2] ?? '').toLowerCase() as WhitelistScope;
    const reason = args.slice(3).join(' ').trim() || undefined;

    if (!targetId) {
      await v2MessageReply(message, { content: '**Usage**\n\n`!whitelist add <user> <scope> [reason]`', accentColor: '#ED4245' });
      return;
    }
    if (!VALID_SCOPES.includes(scope)) {
      await v2MessageReply(message, { content: `**Invalid Scope**\n\nValid scopes: ${VALID_SCOPES.join(', ')}`, accentColor: '#ED4245' });
      return;
    }

    if (targetId === guild.ownerId) {
      await v2MessageReply(message, { content: `${emojiPrefix('antinuke_cross1')}The server owner is always immune — no whitelist entry is needed.`, accentColor: '#ED4245' });
      return;
    }

    await app.whitelist.add(guild.id, targetId, scope, message.author.id, reason);
    const scopeLabel = scope === 'all' ? 'all actions' : scope.replace(/_/g, ' ');
    await v2MessageReply(message, {
      content: `${emojiPrefix('antinuke_tick1')}<@${targetId}> has been whitelisted from **${scopeLabel}**.${reason ? `\nReason: ${reason}` : ''}\n\n${emojiPrefix('vyxia_info')}${SCOPE_DESCRIPTIONS[scope]}`,
      accentColor: '#57F287',
    });
    return;
  }

  if (sub === 'remove') {
    const targetId = parseMentionOrId(args[1] ?? '');
    const scope = args[2]?.toLowerCase() as WhitelistScope | undefined;

    if (!targetId) {
      await v2MessageReply(message, { content: '**Usage**\n\n`!whitelist remove <user> [scope]`', accentColor: '#ED4245' });
      return;
    }
    if (scope && !VALID_SCOPES.includes(scope)) {
      await v2MessageReply(message, { content: `**Invalid Scope**\n\nValid scopes: ${VALID_SCOPES.join(', ')}`, accentColor: '#ED4245' });
      return;
    }

    const removed = await app.whitelist.remove(guild.id, targetId, scope);
    if (removed === 0) {
      await v2MessageReply(message, { content: `${emojiPrefix('antinuke_cross1')}No whitelist entries found for <@${targetId}>${scope ? ` in scope **${scope.replace(/_/g, ' ')}**` : ''}.`, accentColor: '#ED4245' });
      return;
    }

    const scopeLabel = scope ? ` from **${scope.replace(/_/g, ' ')}**` : ' (all scopes)';
    await v2MessageReply(message, { content: `${emojiPrefix('antinuke_tick1')}Removed <@${targetId}> from whitelist${scopeLabel}.`, accentColor: '#57F287' });
    return;
  }

  if (sub === 'list') {
    const filterId = parseMentionOrId(args[1] ?? '');
    let entries = await app.whitelist.list(guild.id);
    if (filterId) {
      entries = entries.filter((e) => e.user_id === filterId);
    }

    if (entries.length === 0) {
      await v2MessageReply(message, { content: `${emojiPrefix('vyxia_info')}No whitelist entries found${filterId ? ` for <@${filterId}>` : ''}.`, accentColor: '#5865F2' });
      return;
    }

    const lines = entries.map((e) => {
      const scopeLabel = e.scope === 'all' ? 'All' : e.scope.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const reasonPart = e.reason ? ` — ${e.reason}` : '';
      return `<@${e.user_id}> · **${scopeLabel}**${reasonPart} (by <@${e.added_by}>)`;
    });

    const title = filterId ? `Whitelist entries for <@${filterId}>` : 'All whitelist entries';
    await v2MessageReply(message, { content: `**${emojiPrefix('vyxia_shield')} ${title}**\n\n${lines.join('\n')}`, accentColor: '#5865F2' });
    return;
  }

  if (sub === 'info') {
    const scope = (args[1] ?? '').toLowerCase() as WhitelistScope;
    if (!scope || !VALID_SCOPES.includes(scope)) {
      await v2MessageReply(message, { content: `**Usage**\n\n\`!whitelist info <scope>\`\n\n**Scopes:** ${VALID_SCOPES.join(', ')}`, accentColor: '#ED4245' });
      return;
    }

    const desc = SCOPE_DESCRIPTIONS[scope];
    const scopeLabel = scope === 'all' ? 'All' : scope.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    await v2MessageReply(message, { content: `**${emojiPrefix('vyxia_shield')} Scope: ${scopeLabel}**\n\n${desc}`, accentColor: '#5865F2' });
  }
}

const command: BotCommand = {
  name: 'whitelist',
  category: 'admin',
  description: 'Manage user whitelists for moderation, automod, and more',
  usage: ['!whitelist add <user> <scope> [reason]', '!whitelist remove <user> [scope]', '!whitelist list [user]', '!whitelist info <scope>'],
  details: 'Server-owner only. Whitelisting makes a user immune to the chosen scope (automod, moderation, raid, etc.) — run `!whitelist info <scope>` to see what each scope covers.',
  data,
  permissions: [],
  aliases: [],
  guildOnly: true,
  execute,
  prefixExecute,
};

export default command;
