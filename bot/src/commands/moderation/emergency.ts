import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const APPROVED_ROLE_ID = '1485003950888456335';
const STAFF_PING_ROLE_ID = '1485003903891275977';
const COOLDOWN_SECONDS = 3600;
const ABUSE_THRESHOLD = 3;
const ABUSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const AUTO_MUTE_DURATION_MS = 60 * 60 * 1000;
const AUTO_MUTE_REASON = '[EMERGENCY] Abuse of emergency staff ping system';

async function getUsageCount(app: App, guildId: string, userId: string): Promise<number> {
  const windowStart = new Date(Date.now() - ABUSE_WINDOW_MS).toISOString().slice(0, 23);
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM emergency_ping_usage WHERE guild_id = ? AND user_id = ? AND created_at > ?',
    [guildId, userId, windowStart],
  );
  return (rows[0]?.cnt as number) ?? 0;
}

async function getCooldownRemaining(app: App, guildId: string, userId: string): Promise<number> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT created_at FROM emergency_ping_usage WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    [guildId, userId],
  );
  if (rows.length === 0) return 0;
  const lastUsed = new Date(rows[0].created_at).getTime();
  const elapsed = Math.floor((Date.now() - lastUsed) / 1000);
  return Math.max(0, COOLDOWN_SECONDS - elapsed);
}

async function recordUse(app: App, guildId: string, userId: string, channelId: string, reason: string): Promise<void> {
  await app.db.execute(
    'INSERT INTO emergency_ping_usage (guild_id, user_id, channel_id, reason) VALUES (?, ?, ?, ?)',
    [guildId, userId, channelId, reason],
  );
}

function hasApprovedRole(member: { roles: { cache: { has: (id: string) => boolean } } } | null): boolean {
  if (!member) return false;
  return member.roles.cache.has(APPROVED_ROLE_ID);
}

function getUserArg(interaction: ChatInputCommandInteraction | Message): string {
  return 'author' in interaction ? interaction.author.id : interaction.user.id;
}

async function executeSlash(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guild) {
    await v2Reply(interaction, 'This command can only be used in a server.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }

  if (!hasApprovedRole(interaction.member as any)) {
    await v2Reply(interaction,
      '**Access Required**\n\nYou do not have permission to use emergency staff pings.\n\nRun `/emergencyaccess` or `!emergencyaccess` to review the terms and request access.',
      { ephemeral: true, accentColor: '#F0B232' },
    );
    return;
  }

  const reason = interaction.options.getString('reason', true).trim();
  if (reason.length < 5) {
    await v2Reply(interaction, '**Invalid Reason**\n\nReason must be at least 5 characters.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }
  if (reason.length > 500) {
    await v2Reply(interaction, '**Invalid Reason**\n\nReason must be 500 characters or fewer.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }

  const userId = getUserArg(interaction);
  const guildId = interaction.guildId!;
  const uses = await getUsageCount(app, guildId, userId);

  if (uses >= ABUSE_THRESHOLD) {
    await interaction.deferReply({ ephemeral: true });
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.timeout(AUTO_MUTE_DURATION_MS, AUTO_MUTE_REASON).catch(() => {});
    }
    await v2Reply(interaction,
      '**Auto-Muted for Abuse**\n\nYou have been automatically muted for **1 hour** due to abuse of the emergency ping system. Further abuse may result in a permanent ban.',
      { ephemeral: true, accentColor: '#ED4245' },
    );
    return;
  }

  const cooldownRemaining = await getCooldownRemaining(app, guildId, userId);
  if (cooldownRemaining > 0) {
    const expiresAt = Math.floor((Date.now() + cooldownRemaining * 1000) / 1000);
    await v2Reply(interaction,
      `**Cooldown Active**\n\nYou must wait <t:${expiresAt}:R> before using this command again.`,
      { ephemeral: true, accentColor: '#F0B232' },
    );
    return;
  }

  await recordUse(app, guildId, userId, interaction.channelId, reason);

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await v2Reply(interaction, '**Error**\n\nCannot send messages in this channel.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }

  const nextUse = uses + 1;
  const warning = nextUse < ABUSE_THRESHOLD
    ? `\n\n*Warning: ${nextUse}/${ABUSE_THRESHOLD} uses in 24h. Exceeding this limit will auto-mute you.*`
    : nextUse === ABUSE_THRESHOLD
      ? '\n\n***This is your last allowed use before auto-mute. Use this wisely.***'
      : '';

  const { buildRichV2 } = await import('../../utils/v2');
  await (channel as any).send({
    content: `<@&${STAFF_PING_ROLE_ID}>`,
    ...buildRichV2({
      accentColor: 0xED4245,
      header: '🚨 Emergency Staff Ping',
      text: `**Triggered by:** <@${userId}>\n**Reason:** ${reason}`,
      footer: `Channel: <#${interaction.channelId}>`,
    }),
    allowedMentions: { roles: [STAFF_PING_ROLE_ID] },
  }).catch(() => {});

  await interaction.deferReply({ ephemeral: true });
  const expiresAt = Math.floor((Date.now() + COOLDOWN_SECONDS * 1000) / 1000);
  await v2Reply(interaction,
    `**Emergency Ping Sent**\n\nStaff will respond as soon as possible.\nYou can use this command again <t:${expiresAt}:R>.${warning}`,
    { ephemeral: true, accentColor: '#57F287' },
  );

  await app.logManager.log({
    event: 'emergency_ping_triggered',
    guildId,
    actorId: userId,
    channelId: interaction.channelId,
    message: `<@${userId}> triggered emergency staff ping`,
    details: { reason, usesToday: nextUse, threshold: ABUSE_THRESHOLD },
  });
}

async function executePrefix(message: Message, args: string[], app: App): Promise<void> {
  if (!message.guild) {
    await v2MessageReply(message, { content: 'This command can only be used in a server.', accentColor: '#ED4245' });
    return;
  }

  if (!hasApprovedRole(message.member as any)) {
    await v2MessageReply(message, {
      content: '**Access Required**\n\nYou do not have permission to use emergency staff pings.\n\nRun `!emergencyaccess` to review the terms and request access.',
      accentColor: '#F0B232',
    });
    return;
  }

  const reason = args.join(' ').trim();
  if (!reason) {
    await v2MessageReply(message, { content: '**Usage**\n\n`!emergency <reason>` — You must provide a reason.', accentColor: '#ED4245' });
    return;
  }
  if (reason.length < 5) {
    await v2MessageReply(message, { content: '**Invalid Reason**\n\nReason must be at least 5 characters.', accentColor: '#ED4245' });
    return;
  }
  if (reason.length > 500) {
    await v2MessageReply(message, { content: '**Invalid Reason**\n\nReason must be 500 characters or fewer.', accentColor: '#ED4245' });
    return;
  }

  const userId = getUserArg(message);
  const guildId = message.guildId!;
  const uses = await getUsageCount(app, guildId, userId);

  if (uses >= ABUSE_THRESHOLD) {
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.timeout(AUTO_MUTE_DURATION_MS, AUTO_MUTE_REASON).catch(() => {});
    }
    await v2MessageReply(message, {
      content: '**Auto-Muted for Abuse**\n\nYou have been automatically muted for **1 hour** due to abuse of the emergency ping system. Further abuse may result in a permanent ban.',
      accentColor: '#ED4245',
    });
    return;
  }

  const cooldownRemaining = await getCooldownRemaining(app, guildId, userId);
  if (cooldownRemaining > 0) {
    const expiresAt = Math.floor((Date.now() + cooldownRemaining * 1000) / 1000);
    await v2MessageReply(message, {
      content: `**Cooldown Active**\n\nYou must wait <t:${expiresAt}:R> before using this command again.`,
      accentColor: '#F0B232',
    });
    return;
  }

  await recordUse(app, guildId, userId, message.channelId, reason);

  const nextUse = uses + 1;
  const warning = nextUse < ABUSE_THRESHOLD
    ? `\n\n*Warning: ${nextUse}/${ABUSE_THRESHOLD} uses in 24h. Exceeding this limit will auto-mute you.*`
    : nextUse === ABUSE_THRESHOLD
      ? '\n\n***This is your last allowed use before auto-mute. Use this wisely.***'
      : '';

  const { buildRichV2 } = await import('../../utils/v2');
  await (message.channel as any).send({
    content: `<@&${STAFF_PING_ROLE_ID}>`,
    ...buildRichV2({
      accentColor: 0xED4245,
      header: '🚨 Emergency Staff Ping',
      text: `**Triggered by:** <@${userId}>\n**Reason:** ${reason}`,
      footer: `Channel: <#${message.channelId}>`,
    }),
    allowedMentions: { roles: [STAFF_PING_ROLE_ID] },
  }).catch(() => {});

  const expiresAt = Math.floor((Date.now() + COOLDOWN_SECONDS * 1000) / 1000);
  await v2MessageReply(message, {
    content: `**Emergency Ping Sent**\n\nStaff will respond as soon as possible.\nYou can use this command again <t:${expiresAt}:R>.${warning}`,
    accentColor: '#57F287',
  });

  await app.logManager.log({
    event: 'emergency_ping_triggered',
    guildId,
    actorId: userId,
    channelId: message.channelId,
    message: `<@${userId}> triggered emergency staff ping`,
    details: { reason, usesToday: nextUse, threshold: ABUSE_THRESHOLD },
  });
}

const command: BotCommand = {
  name: 'emergency',
  category: 'moderation',
  description: 'Ping the staff team for an emergency situation',
  data: new SlashCommandBuilder()
    .setName('emergency')
    .setDescription('Ping the staff team for an emergency situation')
    .addStringOption((o) =>
      o.setName('reason')
        .setDescription('Detailed reason for the emergency ping (5-500 chars)')
        .setRequired(true),
    ),
  permissions: [],
  aliases: ['estaff', 'eping'],
  execute: executeSlash,
  prefixExecute: executePrefix,
};

export default command;
