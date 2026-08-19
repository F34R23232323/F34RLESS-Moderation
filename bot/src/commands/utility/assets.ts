import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Guild, GuildMember, Message, User } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';

interface AssetCtx {
  user: User;
  member: GuildMember | null;
  guild: Guild | null;
}

async function resolveTarget(
  app: App,
  interaction?: ChatInputCommandInteraction,
  message?: Message,
  args: string[] = [],
): Promise<AssetCtx | null> {
  if (interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const guild = interaction.guild;
    const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
    return { user, member, guild };
  }
  const guild = message?.guild ?? null;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  const user = targetId ? await app.client.users.fetch(targetId).catch(() => null) : message?.author ?? null;
  if (!user) return null;
  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
  return { user, member, guild };
}

function assetCommand(name: string, description: string, resolve: (ctx: AssetCtx) => string | null | Promise<string | null>): BotCommand {
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
      const ctx = await resolveTarget(app, interaction);
      if (!ctx) {
        await v2Reply(interaction, 'User not found.', { ephemeral: true });
        return;
      }
      const url = await resolve(ctx);
      if (!url) {
        await v2Reply(interaction, 'No asset available.', { ephemeral: true });
        return;
      }
      await v2Reply(interaction, `<@${ctx.user.id}>`, { imageUrl: url });
    },
    async prefixExecute(message, args, app) {
      const ctx = await resolveTarget(app, undefined, message, args);
      if (!ctx) {
        await v2MessageReply(message, { content: 'User not found.' });
        return;
      }
      const url = await resolve(ctx);
      if (!url) {
        await v2MessageReply(message, { content: 'No asset available.' });
        return;
      }
      await v2MessageReply(message, { content: `**${name}** — ${ctx.user.username}`, imageUrl: url });
    },
  };
}

const avatarData = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Show a user\'s global and server avatars')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false));

const avatar: BotCommand = {
  name: 'avatar',
  category: 'utility',
  description: "Show a user's global and server avatars",
  data: avatarData,
  permissions: [],
  aliases: ['pfp', 'av'],
  async execute(interaction, app) {
    await interaction.deferReply();
    const ctx = await resolveTarget(app, interaction);
    if (!ctx) {
      await v2Reply(interaction, 'User not found.', { ephemeral: true });
      return;
    }
    await sendAvatars(app, interaction, ctx);
  },
  async prefixExecute(message, args, app) {
    const ctx = await resolveTarget(app, undefined, message, args);
    if (!ctx) {
      await v2MessageReply(message, { content: 'User not found.' });
      return;
    }
    const payload = buildAvatarPayload(ctx);
    await v2MessageReply(message, payload);
  },
};

function buildAvatarPayload(ctx: AssetCtx): { content: string; imageUrls: string[]; buttons: Array<{ label: string; url: string }> } {
  const globalUrl = ctx.user.displayAvatarURL({ size: 1024, extension: 'png' });
  const serverUrl = ctx.member?.avatarURL({ size: 1024, extension: 'png' }) ?? null;

  const imageUrls = [globalUrl];
  const buttons: Array<{ label: string; url: string }> = [{ label: 'Download global', url: globalUrl }];
  const parts = [`**${ctx.user.username}**`];
  parts.push(`Global avatar: [link](${globalUrl})`);
  if (serverUrl) {
    imageUrls.push(serverUrl);
    buttons.push({ label: 'Download server', url: serverUrl });
    parts.push(`Server avatar: [link](${serverUrl})`);
  } else {
    parts.push('Server avatar: none (using global)');
  }

  return { content: parts.join('\n'), imageUrls, buttons };
}

async function sendAvatars(app: App, interaction: ChatInputCommandInteraction, ctx: AssetCtx): Promise<void> {
  const payload = buildAvatarPayload(ctx);
  await v2Reply(interaction, payload.content, { imageUrls: payload.imageUrls, buttons: payload.buttons });
}

const banner = assetCommand('banner', 'Full-size user banner', async (ctx) => {
  // The banner hash isn't included on user objects from slash options / message
  // authors — force-fetch from the API so bannerURL() actually resolves.
  const fresh = await ctx.user.fetch(true).catch(() => ctx.user);
  return fresh.bannerURL({ size: 1024 }) ?? null;
});

const servericon = assetCommand('servericon', 'Full-size server icon', (ctx) => ctx.guild?.iconURL({ size: 1024 }) ?? null);

const serverbanner = assetCommand('serverbanner', 'Full-size server banner', (ctx) => ctx.guild?.bannerURL({ size: 1024 }) ?? null);

const serversplash = assetCommand('serversplash', 'Full-size server splash', (ctx) => ctx.guild?.splashURL({ size: 1024 }) ?? null);

export default [avatar, banner, servericon, serverbanner, serversplash];
