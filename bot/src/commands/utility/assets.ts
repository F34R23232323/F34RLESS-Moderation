import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';

function assetCommand(name: string, description: string, resolve: (ctx: { app: App; interaction: ChatInputCommandInteraction }) => Promise<string | null>): BotCommand {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false));
  return {
    name,
    category: 'utility',
    description,
    data,
    permissions: [],
    aliases: [],
    async execute(interaction, app) {
      await interaction.deferReply();
      const url = await resolve({ app, interaction });
      if (!url) {
        await v2Reply(interaction, 'No asset available.', { ephemeral: true });
        return;
      }
      await v2Reply(interaction, `<@${interaction.user.id}>`, { imageUrl: url });
    },
  };
}

const avatar = assetCommand('avatar', 'Full-size avatar (server or global)', async ({ app, interaction }) => {
  const user = await resolveUserOption(interaction, app);
  if (!user) return null;
  const guild = interaction.guild;
  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
  const serverUrl = member?.avatarURL({ size: 1024 });
  return serverUrl ?? user.displayAvatarURL({ size: 1024 });
});

const banner = assetCommand('banner', 'Full-size user banner', async ({ app, interaction }) => {
  const user = await resolveUserOption(interaction, app);
  if (!user) return null;
  return user.bannerURL({ size: 1024 }) ?? null;
});

const servericon = assetCommand('servericon', 'Full-size server icon', async ({ interaction }) => {
  return interaction.guild?.iconURL({ size: 1024 }) ?? null;
});

const serverbanner = assetCommand('serverbanner', 'Full-size server banner', async ({ interaction }) => {
  return interaction.guild?.bannerURL({ size: 1024 }) ?? null;
});

const serversplash = assetCommand('serversplash', 'Full-size server splash', async ({ interaction }) => {
  return interaction.guild?.splashURL({ size: 1024 }) ?? null;
});

export default [avatar, banner, servericon, serverbanner, serversplash];