import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, buildRichV2 } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const APPROVED_ROLE_ID = '1485003950888456335';

const TERMS_TEXT = [
  '**By accepting these terms, you are granted the ability to ping the staff team in emergencies.**',
  '',
  '**1. DEFINITION OF AN EMERGENCY**\n'
  + 'An emergency is a **serious, time-sensitive situation** that requires immediate staff intervention:\n'
  + '• Ongoing raids, nukes, or mass harassment campaigns\n'
  + '• Active threats of real-world harm or violence\n'
  + '• Severe rule violations in progress (CSAM, doxxing, grooming)\n'
  + '• Compromised staff accounts or bot tokens being exploited',
  '',
  '**2. WHAT IS NOT AN EMERGENCY**\n'
  + 'The following are **not** valid reasons to use emergency pings:\n'
  + '• General questions or support requests\n'
  + '• Disputes with other members\n'
  + '• Requesting a role change or server setting modification\n'
  + '• Reporting something that already happened (non-urgent)\n'
  + '• Testing or curiosity',
  '',
  '**3. CONSEQUENCES OF ABUSE**\n'
  + '• Your first 3 uses in a 24-hour window are allowed.\n'
  + '• **On the 4th use within 24 hours**, you will be automatically muted for 1 hour.\n'
  + '• Repeated abuse (multiple mutes) will result in a **permanent ban** from the server.\n'
  + '• False emergency pings are treated as abuse and carry the same penalties.\n'
  + '• Staff may manually revoke your emergency ping access at any time for misuse.',
  '',
  '**4. RESPONSIBILITIES**\n'
  + '• You **must** provide a clear, detailed reason when using the emergency ping.\n'
  + '• You are responsible for verifying the emergency is real before pinging.\n'
  + '• You must not use this feature to target, harass, or inconvenience staff.\n'
  + '• You understand that misuse damages the trust system for everyone.',
  '',
  '**5. REVOCATION**\n'
  + '• Staff reserve the right to revoke your emergency ping access at any time, without warning, for any reason.\n'
  + '• Revoked access can only be restored by staff approval.',
].join('\n');

async function executeSlash(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guild) {
    await v2Reply(interaction, '**Error**\n\nThis command can only be used in a server.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await v2Reply(interaction, '**Error**\n\nCould not find your membership.', { ephemeral: true, accentColor: '#ED4245' });
    return;
  }

  if (member.roles.cache.has(APPROVED_ROLE_ID)) {
    await v2Reply(interaction,
      '**Already Approved**\n\nYou already have emergency ping access. Use `/emergency <reason>` or `!emergency <reason>` to ping staff.',
      { ephemeral: true, accentColor: '#57F287' },
    );
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('emergency_access:accept')
      .setLabel('I Agree')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('emergency_access:decline')
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    ...buildRichV2({
      accentColor: 0xF0B232,
      header: '⚠️ Emergency Staff Ping — Terms & Conditions',
      text: TERMS_TEXT,
      footer: 'You must agree to these terms before you can use emergency pings.',
    }),
    components: [row],
    flags: MessageFlags.Ephemeral,
  } as never);
}

async function executePrefix(message: Message, args: string[], app: App): Promise<void> {
  if (!message.guild) {
    await v2MessageReply(message, { content: '**Error**\n\nThis command can only be used in a server.', accentColor: '#ED4245' });
    return;
  }

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: '**Error**\n\nCould not find your membership.', accentColor: '#ED4245' });
    return;
  }

  if (member.roles.cache.has(APPROVED_ROLE_ID)) {
    await v2MessageReply(message, {
      content: '**Already Approved**\n\nYou already have emergency ping access. Use `!emergency <reason>` to ping staff.',
      accentColor: '#57F287',
    });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`emergency_access:accept:${message.author.id}`)
      .setLabel('I Agree')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`emergency_access:decline:${message.author.id}`)
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary),
  );

  await (message.channel as any).send({
    ...buildRichV2({
      accentColor: 0xF0B232,
      header: '⚠️ Emergency Staff Ping — Terms & Conditions',
      text: TERMS_TEXT,
      footer: 'You must agree to these terms before you can use emergency pings.',
    }),
    components: [row],
    allowedMentions: { parse: [] },
  }).catch(() => {});
}

const command: BotCommand = {
  name: 'emergencyaccess',
  category: 'moderation',
  description: 'Review and agree to the emergency staff ping terms',
  data: new SlashCommandBuilder()
    .setName('emergencyaccess')
    .setDescription('Review and agree to the emergency staff ping terms'),
  permissions: [],
  aliases: ['eaccess', 'eagree'],
  execute: executeSlash,
  prefixExecute: executePrefix,
};

export default command;
