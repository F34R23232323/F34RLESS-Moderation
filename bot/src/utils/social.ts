import type { Pool } from 'mysql2/promise';
import type { App } from '../core/context';
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface SocialAction {
  name: string;
  apiPath: string;
  verb: string;
  pastTense: string;
  emoji: string;
  description: string;
  reverseAction: string;
  lines: string[];
  backLines: string[];
}

export const SOCIAL_ACTIONS: SocialAction[] = [
  { name: 'kiss', apiPath: 'kiss', verb: 'kisses', pastTense: 'kissed', emoji: '💋', description: 'Kiss someone', reverseAction: 'kiss',
    lines: ['Mmm, steamy! 🔥', 'Get a room!', 'Somebody\'s in love~', 'So romantic! 🥰', 'Did you feel the spark? ⚡', 'Spicy! 🌶️'],
    backLines: ['Ooh, they kissed them back! 💋', 'Right back at ya! 😘', 'The feeling is mutual! 💕', 'Plot twist: they liked it!'] },
  { name: 'hug', apiPath: 'hug', verb: 'hugs', pastTense: 'hugged', emoji: '🤗', description: 'Hug someone', reverseAction: 'hug',
    lines: ['Group hug! 🫂', 'So wholesome!', 'Wholesome content right here', 'Aww, how sweet! 🥺', 'Free hugs!'],
    backLines: ['Hug received, hug returned! 🫂', 'The hug was so good they had to return it!', 'Double hug combo! 💗', 'Hug-ception!'] },
  { name: 'slap', apiPath: 'slap', verb: 'slaps', pastTense: 'slapped', emoji: '👋', description: 'Slap someone', reverseAction: 'slap',
    lines: ['Ouch! That had to hurt!', 'Violence is not the answer... but it is a question', 'F in the chat', 'Did that leave a mark? 👋', 'RIP 💀'],
    backLines: [' slapped them back! 💥', 'The tables have turned!', 'Revenge is sweet! 👋', 'And the award for comeback goes to...'] },
  { name: 'pat', apiPath: 'pat', verb: 'pats', pastTense: 'patted', emoji: '🫳', description: 'Pat someone', reverseAction: 'pat',
    lines: ['Good human! 🐕', '*happy noises*', 'Head pats are the best pats', 'You deserve all the pats! 🫶', '*purrs*'],
    backLines: ['Pat returned! 🫳', 'They patted back! *happy tail wags*', 'Mutual pats! The best kind!', 'Pat for a pat! Fair trade!'] },
  { name: 'oke', apiPath: 'poke', verb: 'pokes', pastTense: 'poked', emoji: '👉', description: 'Poke someone', reverseAction: 'poke',
    lines: ['Boop! 👉', 'Hey! Watch it!', '*pokes back*', 'PokeWars have begun!', 'Stop poking me! ...or don\'t 😏'],
    backLines: ['Poked them back! Boop! 👉', 'The poke wars continue!', 'Poke-ception!', 'Right back at ya! Boop!'] },
  { name: 'bite', apiPath: 'bite', verb: 'bites', pastTense: 'bit', emoji: '🦷', description: 'Bite someone', reverseAction: 'bite',
    lines: ['Ouch! Vampire much? 🧛', 'Nom nom!', 'Did you just bite them?!', 'Rough! 🦷', 'That\'s gonna leave a mark!'],
    backLines: ['Bit them back! 🦷', 'The bitten becomes the biter!', 'Vampire vs Vampire!', 'Fight bite! 💥'] },
  { name: 'cuddle', apiPath: 'cuddle', verb: 'cuddles', pastTense: 'cuddled', emoji: '🫂', description: 'Cuddle someone', reverseAction: 'cuddle',
    lines: ['So cozy! 🥰', 'Cuddle puddle!', 'The best kind of warmth', 'Who\'s cutting onions? 🥺', 'Wholesome overload!'],
    backLines: ['Cuddle returned! 🫂', 'Now they\'re BOTH cozy!', 'Mutual cuddling activated!', 'Cuddle level: MAXIMUM'] },
  { name: 'tickle', apiPath: 'tickle', verb: 'tickles', pastTense: 'tickled', emoji: '🫳', description: 'Tickle someone', reverseAction: 'tickle',
    lines: ['Hahahaha! Stop it! 😂', 'Tickle fight!', 'That\'s illegal! 😆', 'No mercy!', '*runs away*'],
    backLines: ['Tickled them back! 😂', 'The tickle wars have begun!', 'Oh no, they\'re fighting back!', 'Mutual tickling! Chaos!'] },
  { name: 'kill', apiPath: 'slap', verb: 'playfully kills', pastTense: 'playfully killed', emoji: '💀', description: 'Playfully kill someone', reverseAction: 'kill',
    lines: ['RIP 💀', '*dramatic death scene*', 'They will be missed... not', 'Call an ambulance! 🚑', 'GG wp'],
    backLines: ['REVENGE KILL! 💀', 'The ghost returns!', 'You can\'t kill what\'s already dead!', 'Plot armor was not enough!'] },
  { name: 'lick', apiPath: 'lick', verb: 'licks', pastTense: 'licked', emoji: '👅', description: 'Lick someone', reverseAction: 'lick',
    lines: ['Eww! 🤢', 'What are you, a cat?', 'That\'s... unexpected', 'Tastes like friendship!', '*confused noises*'],
    backLines: ['Licked them back! 👅', 'The licker got licked!', 'Return to sender!', 'Mutual licking? This server is weird!'] },
  { name: 'blush', apiPath: 'blush', verb: 'blushes at', pastTense: 'blushed at', emoji: '😳', description: 'Blush at someone', reverseAction: 'blush',
    lines: ['So shy! 🥺', '*giggles*', 'Somebody\'s flustered!', 'Cute overload! 😊', 'Stop it, you\'re making them blush more!'],
    backLines: ['Blushed back! 😳', 'Double blush! How adorable!', 'Mutual blushing! 💕', 'The embarrassment is shared!'] },
  { name: 'wave', apiPath: 'smile', verb: 'waves at', pastTense: 'waved at', emoji: '👋', description: 'Wave at someone', reverseAction: 'wave',
    lines: ['Hello there! 👋', 'Friendly wave incoming!', 'Hi friend!', 'So polite! ✨'],
    backLines: ['Waved back! 👋', 'The wave was returned!', 'Mutual waving! How wholesome!', 'Wave-ception!'] },
  { name: 'dance', apiPath: 'dance', verb: 'dances with', pastTense: 'danced with', emoji: '💃', description: 'Dance with someone', reverseAction: 'dance',
    lines: ['🕺 💃 *disco music*', 'Dance battle!', 'Groovy! 🎵', 'They\'re vibing!', 'Floor is lava!'],
    backLines: ['Dance battle initiated! 💃🕺', 'The dance was returned!', 'Now they\'re REALLY dancing!', 'Dance-Off! Winner gets bragging rights!'] },
  { name: 'cry', apiPath: 'cry', verb: 'cries on', pastTense: 'cried on', emoji: '😢', description: 'Cry on someone', reverseAction: 'cry',
    lines: ['*hands tissue* 🥺', 'Who hurt you?', 'It\'s okay to cry!', '*hugs tightly*', 'Emotional damage!'],
    backLines: ['Now they\'re BOTH crying! 😭', 'Cry buddies!', 'The tears are contagious!', 'Mutual sadness! Group hug!'] },
  { name: 'smile', apiPath: 'smile', verb: 'smiles at', pastTense: 'smiled at', emoji: '😊', description: 'Smile at someone', reverseAction: 'smile',
    lines: [' wholesome! 😊', 'That smile is contagious!', 'So precious!', 'Melting hearts! ❤️'],
    backLines: ['Smiled back! 😊', 'The smile was returned!', 'Double smile! The world is better!', 'Mutual happiness!'] },
];

export interface SoloAction {
  name: string;
  apiPath: string;
  verb: string;
  emoji: string;
  description: string;
  lines: string[];
}

export const SOLO_ACTIONS: SoloAction[] = [
  { name: 'angry', apiPath: 'angry', verb: 'is angry', emoji: '😠', description: 'Show an angry GIF',
    lines: ['Rage mode activated! 🔥', 'Don\'t mess with them right now!', 'Furious!', '*breathing intensifies*'] },
  { name: 'comfy', apiPath: 'comfy', verb: 'is feeling comfy', emoji: '😌', description: 'Show a comfy GIF',
    lines: ['Maximum cozy achieved! ☕', 'Living the dream!', 'So relaxing!', 'Vibes: immaculate'] },
  { name: 'fluff', apiPath: 'fluff', verb: 'is feeling fluffy', emoji: '🦊', description: 'Show a fluffy GIF',
    lines: ['Maximum fluffiness! 🦊', 'So soft and fluffy!', 'Fluff level: OVER 9000!', '*aggressive head pats*'] },
  { name: 'lay', apiPath: 'lay', verb: 'is laying down', emoji: '😴', description: 'Show a laying down GIF',
    lines: ['Nap time! 😴', 'Too tired for this!', 'Do not disturb!', 'Shhh... resting!'] },
  { name: 'pout', apiPath: 'pout', verb: 'is pouting', emoji: '😤', description: 'Show a pouting GIF',
    lines: ['So dramatic! 😤', 'The pout is real!', 'Someone needs attention!', 'Cute anger!'] },
  { name: 'tail', apiPath: 'tail', verb: 'wags their tail', emoji: '🐕', description: 'Show a tail wagging GIF',
    lines: ['*happy tail wags* 🐕', 'So excited!', 'Who\'s a good boy/girl?', 'Tail: maximum speed!'] },
];

const RELATIONSHIP_LINES: Record<string, { range: [number, number]; lines: string[] }> = {
  soulmates: { range: [90, 100], lines: ['Soulmates for real! 💕', 'Made in heaven! ✨', 'True love exists! 🥺', 'Perfect match! 💖'] },
  amazing: { range: [70, 89], lines: ['Amazing chemistry! 🔥', 'Sparks are flying! ⚡', 'Power couple energy! 💪', 'Ship it! 🚢'] },
  good: { range: [50, 69], lines: ['There\'s potential here! 👀', 'Getting along nicely! 😊', 'Friendship goals! 🤝', 'Not bad at all!'] },
  meh: { range: [30, 49], lines: ['It\'s complicated... 🤷', 'Maybe just friends?', 'The spark is... lukewarm.', 'Work in progress! 🔧'] },
  bad: { range: [10, 29], lines: ['Oof... that\'s rough. 💀', 'Enemies to lovers? Maybe.', 'The vibes are off. 😬', 'Try again next life!'] },
  worst: { range: [0, 9], lines: ['Oil and water. 🚫', 'It\'s a no from me.', 'Toxic! Run! 🏃', 'The universe said no.'] },
};

function getRelationshipTier(percent: number): { lines: string[] } {
  for (const tier of Object.values(RELATIONSHIP_LINES)) {
    if (percent >= tier.range[0] && percent <= tier.range[1]) return tier;
  }
  return RELATIONSHIP_LINES.meh;
}

function consistentRandom(id1: string, id2: string): number {
  const sorted = [id1, id2].sort();
  let hash = 0;
  const str = `${sorted[0]}:${sorted[1]}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 101;
}

function progressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';
}

const PURRBOT_API = 'https://api.purrbot.site/v2';

export async function fetchSocialGif(apiPath: string): Promise<string | null> {
  try {
    const res = await fetch(`${PURRBOT_API}/img/sfw/${apiPath}/gif`);
    if (!res.ok) return null;
    const data = await res.json() as { error: boolean; link?: string };
    if (data.error || !data.link) return null;
    return data.link;
  } catch {
    return null;
  }
}

export async function isBlocked(db: Pool, blockerId: string, blockedId: string): Promise<boolean> {
  const [rows] = await db.execute('SELECT 1 FROM social_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]) as any[];
  return rows.length > 0;
}

export async function isDisabled(db: Pool, userId: string): Promise<boolean> {
  const [rows] = await db.execute('SELECT 1 FROM social_disabled WHERE user_id = ?', [userId]) as any[];
  return rows.length > 0;
}

export async function blockUser(db: Pool, blockerId: string, blockedId: string): Promise<void> {
  await db.execute('INSERT IGNORE INTO social_blocks (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
}

export async function unblockUser(db: Pool, blockerId: string, blockedId: string): Promise<void> {
  await db.execute('DELETE FROM social_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]);
}

export async function setDisabled(db: Pool, userId: string, disabled: boolean): Promise<void> {
  if (disabled) {
    await db.execute('INSERT IGNORE INTO social_disabled (user_id) VALUES (?)', [userId]);
  } else {
    await db.execute('DELETE FROM social_disabled WHERE user_id = ?', [userId]);
  }
}

export function buildSocialResponse(
  action: SocialAction,
  actorTag: string,
  actorId: string,
  targetTag: string,
  targetId: string,
  gifUrl: string,
  isBack = false,
): { components: unknown[]; flags: number } {
  const line = pick(isBack ? action.backLines : action.lines);
  const header = isBack
    ? `${action.emoji} **${actorTag}** returned the ${action.pastTense}! ${action.emoji}`
    : `${action.emoji} **${actorTag}** ${action.verb} **${targetTag}**! ${action.emoji}`;
  const subline = isBack
    ? `*${actorTag} ${action.pastTense} ${targetTag} back — ${line}*`
    : `*${line}*`;

  const container = new ContainerBuilder()
    .setAccentColor(isBack ? 0x00d2ff : 0xff69b4)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(header),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(subline),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`social:back:${action.name}:${actorId}:${targetId}`)
          .setLabel(isBack ? 'Again!' : 'Do it back!')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`social:block:${targetId}:${actorId}`)
          .setLabel('Block user')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`social:disable:${targetId}`)
          .setLabel('Disable all')
          .setStyle(ButtonStyle.Secondary),
      ) as never,
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(gifUrl)),
    );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function handleSocialCommand(
  interaction: any,
  app: App,
  action: SocialAction,
  targetId: string,
): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.user.id;

  if (userId === targetId) {
    await interaction.editReply({ content: 'You can\'t use this on yourself!', components: [], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (await isDisabled(app.db, targetId)) {
    await interaction.editReply({ content: 'This user has disabled social commands.', components: [], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (await isBlocked(app.db, targetId, userId)) {
    await interaction.editReply({ content: 'This user has blocked you from using social commands on them.', components: [], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const gifUrl = await fetchSocialGif(action.apiPath);
  if (!gifUrl) {
    await interaction.editReply({ content: 'Failed to fetch GIF. Try again later.', components: [], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  let targetTag: string;
  try {
    const targetUser = await app.client.users.fetch(targetId);
    targetTag = targetUser.username;
  } catch {
    targetTag = 'Unknown User';
  }

  const actorTag = interaction.user.username;
  const payload = buildSocialResponse(action, actorTag, userId, targetTag, targetId, gifUrl, false);
  await interaction.editReply(payload);
}

export function buildSoloResponse(
  action: SoloAction,
  userTag: string,
  userId: string,
  gifUrl: string,
): { components: unknown[]; flags: number } {
  const line = pick(action.lines);

  const container = new ContainerBuilder()
    .setAccentColor(0xff69b4)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${action.emoji} **${userTag}** ${action.verb}! ${action.emoji}`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${line}*`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`social:disable:${userId}`)
          .setLabel('Disable all')
          .setStyle(ButtonStyle.Secondary),
      ) as never,
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(gifUrl)),
    );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function handleSoloCommand(
  interaction: any,
  app: App,
  action: SoloAction,
): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.user.id;

  const gifUrl = await fetchSocialGif(action.apiPath);
  if (!gifUrl) {
    await interaction.editReply({ content: 'Failed to fetch GIF. Try again later.', components: [], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const payload = buildSoloResponse(action, interaction.user.username, userId, gifUrl);
  await interaction.editReply(payload);
}

export function buildRelationshipResponse(
  user1Tag: string,
  user1Id: string,
  user2Tag: string,
  user2Id: string,
): { components: unknown[]; flags: number } {
  const percent = consistentRandom(user1Id, user2Id);
  const tier = getRelationshipTier(percent);
  const line = pick(tier.lines);
  const bar = progressBar(percent);

  let heartColor: number;
  if (percent >= 70) heartColor = 0xff69b4;
  else if (percent >= 40) heartColor = 0xffa500;
  else heartColor = 0x999999;

  const container = new ContainerBuilder()
    .setAccentColor(heartColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 💕 Relationship 💕`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${user1Tag}** + **${user2Tag}**`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${bar} **${percent}%**`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${line}*`),
    );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}
