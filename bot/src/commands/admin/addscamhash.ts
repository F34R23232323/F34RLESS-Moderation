import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { computeAHash } from '../../automod/scamHashStore';

const data = new SlashCommandBuilder()
  .setName('addscamhash')
  .setDescription('Add a known scam image hash to the detection database')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((o) => o.setName('image').setDescription('The scam image to hash').setRequired(true))
  .addStringOption((o) => o.setName('description').setDescription('Short description (e.g. "MrBeast Crypto Scam")').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!app.modGuard.isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
    return;
  }

  const attachment = interaction.options.getAttachment('image', true);
  const description = interaction.options.getString('description', true);

  if (!attachment.contentType?.startsWith('image/') && !/\.(png|jpe?g|gif|webp)$/i.test(attachment.name)) {
    await interaction.reply({ content: 'The attached file must be an image.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const hex = await computeAHash(attachment.url);
  if (!hex) {
    await interaction.editReply('Failed to compute image hash. The image may be invalid or too large.');
    return;
  }

  const added = await app.scamHashStore.add(hex, description, interaction.user.id);
  if (!added) {
    await interaction.editReply(`Failed to add hash \`${hex}\` — it may already exist in the database.`);
    return;
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x57F287)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Scam Image Hash Added'))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Hash:** \`${hex}\`\n**Description:** ${description}\n**Added by:** <@${interaction.user.id}>\n\nTotal known hashes: ${app.scamHashStore.count()}`,
      ),
    );

  await interaction.editReply({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.modGuard.isOwner(message.author.id)) {
    await message.reply('Only the bot owner can use this command.');
    return;
  }

  const attachment = message.attachments.first();
  if (!attachment) {
    await message.reply('Please attach an image to this message.');
    return;
  }

  if (!attachment.contentType?.startsWith('image/') && !/\.(png|jpe?g|gif|webp)$/i.test(attachment.name)) {
    await message.reply('The attached file must be an image.');
    return;
  }

  const description = args.join(' ') || 'Unknown scam image';

  const hex = await computeAHash(attachment.url);
  if (!hex) {
    await message.reply('Failed to compute image hash. The image may be invalid or too large.');
    return;
  }

  const added = await app.scamHashStore.add(hex, description, message.author.id);
  if (!added) {
    await message.reply(`Failed to add hash \`${hex}\` — it may already exist in the database.`);
    return;
  }

  await message.reply(
    `**Scam hash added**\nHash: \`${hex}\`\nDescription: ${description}\nTotal hashes: ${app.scamHashStore.count()}`,
  );
}

const command: BotCommand = {
  name: 'addscamhash',
  category: 'admin',
  description: 'Add a scam image hash to the detection database',
  data,
  ownerOnly: true,
  permissions: ['Administrator'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
