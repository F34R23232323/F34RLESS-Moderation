import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply } from '../../utils/v2';
import { generateShipImage } from '../../utils/shipImage';

function consistentRandom(id1: string, id2: string): number {
  const sorted = [id1, id2].sort();
  let hash = 0;
  const str = `${sorted[0]}:${sorted[1]}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 101;
}

function getPercentColor(percent: number): number {
  if (percent >= 80) return 0xff69b4;
  if (percent >= 60) return 0xff9a5c;
  if (percent >= 40) return 0xffd700;
  if (percent >= 20) return 0xff6347;
  return 0x888888;
}

function getLabel(percent: number): string {
  if (percent >= 90) return 'Soulmates';
  if (percent >= 75) return 'Perfect Match';
  if (percent >= 60) return 'Great Match';
  if (percent >= 40) return 'Just Friends';
  if (percent >= 20) return 'Unlikely';
  return 'Toxic';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SHIP_LINES: Record<string, string[]> = {
  soulmates: ['Soulmates for real! 💕', 'Made in heaven! ✨', 'True love exists! 🥺', 'Perfect match! 💖'],
  amazing: ['Amazing chemistry! 🔥', 'Sparks are flying! ⚡', 'Power couple energy! 💪', 'Ship it! 🚢'],
  good: ['There\'s potential here! 👀', 'Getting along nicely! 😊', 'Friendship goals! 🤝', 'Not bad at all!'],
  meh: ['It\'s complicated... 🤷', 'Maybe just friends?', 'The spark is... lukewarm.', 'Work in progress! 🔧'],
  bad: ['Oof... that\'s rough. 💀', 'Enemies to lovers? Maybe.', 'The vibes are off. 😬', 'Try again next life!'],
  worst: ['Oil and water. 🚫', 'It\'s a no from me.', 'Toxic! Run! 🏃', 'The universe said no.'],
};

function getShipLines(percent: number): string[] {
  if (percent >= 90) return SHIP_LINES.soulmates;
  if (percent >= 75) return SHIP_LINES.amazing;
  if (percent >= 50) return SHIP_LINES.good;
  if (percent >= 30) return SHIP_LINES.meh;
  if (percent >= 15) return SHIP_LINES.bad;
  return SHIP_LINES.worst;
}

function buildShipCV2(
  user1Tag: string,
  user1Id: string,
  user2Tag: string,
  user2Id: string,
): { components: unknown[]; flags: number } {
  const percent = consistentRandom(user1Id, user2Id);
  const color = getPercentColor(percent);
  const label = getLabel(percent);
  const line = pick(getShipLines(percent));

  const container = new ContainerBuilder()
    .setAccentColor(color as never)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 💕 Relationship 💕`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${user1Tag}** + **${user2Tag}**`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${percent}%** — ${label}`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${line}*`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://ship.png'),
      ),
    );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}

const data = new SlashCommandBuilder()
  .setName('ship')
  .setDescription('Check compatibility between two users')
  .addUserOption((o) => o.setName('user1').setDescription('First user').setRequired(true))
  .addUserOption((o) => o.setName('user2').setDescription('Second user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const user1 = interaction.options.getUser('user1', true);
  const user2 = interaction.options.getUser('user2', true);

  if (user1.id === user2.id) {
    await interaction.reply({ content: 'You need two different people for this!', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const imageBuf = await generateShipImage(
    user1.username,
    user1.displayAvatarURL({ extension: 'png', size: 256 }),
    user2.username,
    user2.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  const payload = buildShipCV2(user1.username, user1.id, user2.username, user2.id);
  const attachment = new AttachmentBuilder(imageBuf, { name: 'ship.png' });

  await interaction.editReply({
    ...payload,
    files: [attachment],
    allowedMentions: { parse: [] },
  } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (args.length < 2) {
    await v2MessageReply(message, { content: 'Usage: ?ship @user1 @user2' });
    return;
  }

  const id1 = args[0].replace(/[<@!>]/g, '');
  const id2 = args[1].replace(/[<@!>]/g, '');

  if (!/^\d{15,20}$/.test(id1) || !/^\d{15,20}$/.test(id2)) {
    await v2MessageReply(message, { content: 'Invalid users. Mention two people or provide user IDs.' });
    return;
  }

  if (id1 === id2) {
    await v2MessageReply(message, { content: 'You need two different people for this!' });
    return;
  }

  let user1: any;
  let user2: any;
  try { user1 = await app.client.users.fetch(id1); } catch { user1 = { username: 'Unknown', displayAvatarURL: () => null }; }
  try { user2 = await app.client.users.fetch(id2); } catch { user2 = { username: 'Unknown', displayAvatarURL: () => null }; }

  const imageBuf = await generateShipImage(
    user1.username,
    typeof user1.displayAvatarURL === 'function' ? user1.displayAvatarURL({ extension: 'png', size: 256 }) : null,
    user2.username,
    typeof user2.displayAvatarURL === 'function' ? user2.displayAvatarURL({ extension: 'png', size: 256 }) : null,
  );

  const payload = buildShipCV2(user1.username, id1, user2.username, id2);
  const attachment = new AttachmentBuilder(imageBuf, { name: 'ship.png' });

  await message.reply({
    ...payload,
    files: [attachment],
    allowedMentions: { parse: [] },
  } as any);
}

const command: BotCommand = {
  name: 'ship',
  category: 'social',
  description: 'Check compatibility between two users',
  data,
  permissions: [],
  aliases: ['relationship', 'compat', 'love'],
  execute,
  prefixExecute,
};

export default command;
