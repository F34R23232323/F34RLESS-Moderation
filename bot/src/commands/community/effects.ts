import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('effects')
  .setDescription('View your active item effects');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const effects = await app.economy.items.getActiveEffects(interaction.guildId!, interaction.user.id);
  if (effects.length === 0) { await v2Reply(interaction, 'No active effects.'); return; }
  const lines = effects.map((e: any) => {
    const expiry = e.expires_at ? `Expires <t:${Math.floor(new Date(e.expires_at).getTime() / 1000)}:R>` : 'Permanent';
    return `${e.item_emoji ?? ''} **${e.item_name}** — ${e.effect_type} (${expiry})`;
  });
  await v2Reply(interaction, `**Active Effects**\n\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const effects = await app.economy.items.getActiveEffects(message.guildId!, message.author.id);
  if (effects.length === 0) { await v2MessageReply(message, { content: 'No active effects.' }); return; }
  const lines = effects.map((e: any) => `${e.item_emoji ?? ''} **${e.item_name}** — ${e.effect_type}`);
  await v2MessageReply(message, { content: `**Active Effects**\n${lines.join('\n')}` });
}

const command: BotCommand = {
  name: 'effects',
  category: 'community',
  description: 'View active item effects',
  data,
  aliases: ['activeeffects'],
  execute,
  prefixExecute,
};

export default command;
