import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, Role } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const MAX_ICON_SIZE = 256 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

const data = new SlashCommandBuilder()
  .setName('roleimagedit')
  .setDescription('Set or remove a role\'s icon')
  .addRoleOption((o) => o.setName('role').setDescription('Target role').setRequired(true))
  .addAttachmentOption((o) => o.setName('image').setDescription('Image to set (JPEG/PNG, max 256KB)').setRequired(false))
  .addBooleanOption((o) => o.setName('remove').setDescription('Remove the role icon').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const roleOpt = interaction.options.getRole('role');
  if (!roleOpt || !('setIcon' in roleOpt)) {
    await v2Reply(interaction, 'Role not found.', { ephemeral: true });
    return;
  }
  const role = roleOpt as Role;
  const guard = app.modGuard.isAboveRole(interaction.member as never, role as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot modify that role: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const remove = interaction.options.getBoolean('remove') ?? false;
  const attachment = interaction.options.getAttachment('image');

  if (remove) {
    try {
      await role.setIcon(null, `Icon removed by ${interaction.user.tag}`);
      await v2Reply(interaction, `Removed the icon from **${role.name}**.`);
    } catch (err) {
      await v2Reply(interaction, `Failed: ${mapDiscordError((err as Error).message)}`, { ephemeral: true });
    }
    return;
  }

  if (!attachment) {
    await v2Reply(interaction, 'Provide an image attachment or set `remove` to true.', { ephemeral: true });
    return;
  }

  if (!ALLOWED_TYPES.includes(attachment.contentType ?? '')) {
    await v2Reply(interaction, 'Image must be JPEG or PNG.', { ephemeral: true });
    return;
  }
  if (attachment.size > MAX_ICON_SIZE) {
    await v2Reply(interaction, `Image must be under 256KB (got ${(attachment.size / 1024).toFixed(0)}KB).`, { ephemeral: true });
    return;
  }

  try {
    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error('Failed to download image');
    const buffer = Buffer.from(await res.arrayBuffer());
    await role.setIcon(buffer, `Icon set by ${interaction.user.tag}`);
    await v2Reply(interaction, `Set the icon for **${role.name}**.`);
  } catch (err) {
    await v2Reply(interaction, `Failed: ${mapDiscordError((err as Error).message)}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!roleimagedit <role> [image attachment]` — or `!roleimagedit <role> remove`' });
    return;
  }
  const roleId = args[0]?.replace(/[<@&>]/g, '');
  const action = args[1]?.toLowerCase();
  if (!roleId) {
    await v2MessageReply(message, { content: 'Usage: `!roleimagedit <role> [image attachment]` — or `!roleimagedit <role> remove`' });
    return;
  }
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await v2MessageReply(message, { content: 'Role not found.' });
    return;
  }
  const guard = app.modGuard.isAboveRole(message.member!, role);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot modify that role: ${guard.reason}` });
    return;
  }

  if (action === 'remove' || action === 'clear' || action === 'delete') {
    try {
      await role.setIcon(null, `Icon removed by ${message.author.tag}`);
      await v2MessageReply(message, { content: `Removed the icon from **${role.name}**.` });
    } catch (err) {
      await v2MessageReply(message, { content: `Failed: ${mapDiscordError((err as Error).message)}` });
    }
    return;
  }

  const attachment = message.attachments.first();
  if (!attachment) {
    await v2MessageReply(message, { content: 'Upload an image attachment (JPEG/PNG, max 256KB), or use `remove` to clear the icon.' });
    return;
  }

  if (!ALLOWED_TYPES.includes(attachment.contentType ?? '')) {
    await v2MessageReply(message, { content: 'Image must be JPEG or PNG.' });
    return;
  }
  if (attachment.size > MAX_ICON_SIZE) {
    await v2MessageReply(message, { content: `Image must be under 256KB (got ${(attachment.size / 1024).toFixed(0)}KB).` });
    return;
  }

  try {
    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error('Failed to download image');
    const buffer = Buffer.from(await res.arrayBuffer());
    await role.setIcon(buffer, `Icon set by ${message.author.tag}`);
    await v2MessageReply(message, { content: `Set the icon for **${role.name}**.` });
  } catch (err) {
    await v2MessageReply(message, { content: `Failed: ${mapDiscordError((err as Error).message)}` });
  }
}

const command: BotCommand = {
  name: 'roleimagedit',
  category: 'moderation',
  description: 'Set or remove a role\'s icon via image upload',
  usage: ['!roleimagedit <role> [image attachment]', '!roleimagedit <role> remove'],
  data,
  permissions: ['ManageRoles'],
  aliases: ['roleicon', 'ri'],
  execute,
  prefixExecute,
};

export default command;
