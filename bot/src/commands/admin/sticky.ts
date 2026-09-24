import { ChannelType, SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import type { MessageSpec } from '../../utils/messageBuilder';
import { v2MessageReply, v2Reply } from '../../utils/v2';

const channelOption = (o: any) => o.setName('channel').setDescription('Target channel (defaults to this channel)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false);

const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Create and manage sticky channel messages')
  .addSubcommand((s) => s.setName('set').setDescription('Create a text or embed sticky')
    .addStringOption((o) => o.setName('message').setDescription('Sticky message body').setRequired(true).setMaxLength(4000))
    .addChannelOption(channelOption)
    .addStringOption((o) => o.setName('title').setDescription('Optional embed title').setMaxLength(256))
    .addStringOption((o) => o.setName('color').setDescription('Embed color, e.g. #5865F2'))
    .addStringOption((o) => o.setName('button_label').setDescription('Optional link button label').setMaxLength(80))
    .addStringOption((o) => o.setName('button_url').setDescription('Link button URL'))
    .addIntegerOption((o) => o.setName('after').setDescription('Repost after this many messages').setMinValue(1).setMaxValue(1000)))
  .addSubcommand((s) => s.setName('saved').setDescription('Use a saved message-builder message (embeds, buttons, selects, v2)')
    .addStringOption((o) => o.setName('name').setDescription('Saved message name').setRequired(true))
    .addChannelOption(channelOption)
    .addIntegerOption((o) => o.setName('after').setDescription('Repost after this many messages').setMinValue(1).setMaxValue(1000)))
  .addSubcommand((s) => s.setName('config').setDescription('Tune anti-spam behavior')
    .addChannelOption(channelOption)
    .addBooleanOption((o) => o.setName('conversation_detection').setDescription('Delay while people are actively conversing'))
    .addIntegerOption((o) => o.setName('quiet_seconds').setDescription('Wait this long after conversation activity').setMinValue(5).setMaxValue(3600))
    .addIntegerOption((o) => o.setName('minimum_interval').setDescription('Minimum seconds between reposts').setMinValue(10).setMaxValue(86400))
    .addIntegerOption((o) => o.setName('hourly_limit').setDescription('Maximum reposts per hour').setMinValue(1).setMaxValue(100))
    .addIntegerOption((o) => o.setName('conversation_messages').setDescription('Messages needed to detect a conversation').setMinValue(2).setMaxValue(100))
    .addIntegerOption((o) => o.setName('delay_min_seconds').setDescription('Minimum delay after the threshold').setMinValue(0).setMaxValue(86400))
    .addIntegerOption((o) => o.setName('delay_max_seconds').setDescription('Maximum randomized delay').setMinValue(0).setMaxValue(86400))
    .addBooleanOption((o) => o.setName('count_bots').setDescription('Count messages sent by other bots'))
    .addBooleanOption((o) => o.setName('delete_previous').setDescription('Delete the prior sticky before reposting')))
  .addSubcommand((s) => s.setName('remove').setDescription('Remove a sticky').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('pause').setDescription('Pause a sticky').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('resume').setDescription('Resume a sticky').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('refresh').setDescription('Repost a sticky now').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('status').setDescription('Show sticky settings').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('list').setDescription('List all configured stickies'));

function targetId(interaction: ChatInputCommandInteraction): string | null {
  return interaction.options.getChannel('channel')?.id ?? interaction.channelId ?? null;
}

function defaults(app: App) {
  const c = app.config.sticky_messages;
  return [c.re_post_after_messages, c.conversation_detection ? 1 : 0, c.conversation_window_seconds,
    c.conversation_min_messages, c.quiet_period_seconds, c.min_interval_seconds,
    c.max_reposts_per_hour, c.delete_previous ? 1 : 0];
}

async function upsert(app: App, guildId: string, channelId: string, creator: string, savedId: number | null, spec: MessageSpec | null, after?: number | null): Promise<void> {
  const d = defaults(app);
  await app.db.execute(
    `INSERT INTO sticky_messages
      (guild_id, channel_id, saved_message_id, payload, enabled, repost_after_messages, conversation_detection,
       conversation_window_seconds, conversation_min_messages, quiet_period_seconds, min_interval_seconds,
       max_reposts_per_hour, delete_previous, created_by)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE saved_message_id = VALUES(saved_message_id), payload = VALUES(payload), enabled = 1,
       repost_after_messages = VALUES(repost_after_messages), messages_since_post = 0, created_by = VALUES(created_by)`,
    [guildId, channelId, savedId, spec ? JSON.stringify(spec) : null, after ?? d[0], ...d.slice(1), creator],
  );
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (!app.config.sticky_messages.enabled) {
    await v2Reply(interaction, 'Sticky messages are disabled globally in `config.yml`.', { ephemeral: true });
    return;
  }
  if (sub === 'list') {
    const [rows] = await app.db.query<RowDataPacket[]>('SELECT channel_id, enabled, repost_after_messages, conversation_detection FROM sticky_messages WHERE guild_id = ? ORDER BY id', [interaction.guildId]);
    const text = rows.length ? rows.map((r) => `<#${r.channel_id}> — ${r.enabled ? 'active' : 'paused'}, every ${r.repost_after_messages} messages, conversation detection ${r.conversation_detection ? 'on' : 'off'}`).join('\n') : 'No sticky messages configured.';
    await v2Reply(interaction, text, { ephemeral: true });
    return;
  }
  const channelId = targetId(interaction);
  if (!channelId) return;

  if (sub === 'set') {
    const body = interaction.options.getString('message', true);
    const title = interaction.options.getString('title');
    const color = interaction.options.getString('color') ?? '#5865F2';
    const label = interaction.options.getString('button_label');
    const url = interaction.options.getString('button_url');
    if ((label && !url) || (!label && url)) {
      await v2Reply(interaction, 'Provide both `button_label` and `button_url`.', { ephemeral: true }); return;
    }
    if (url && !/^https?:\/\//i.test(url)) {
      await v2Reply(interaction, 'Button URL must begin with `http://` or `https://`.', { ephemeral: true }); return;
    }
    const embed = Boolean(title || interaction.options.getString('color'));
    const spec: MessageSpec = {
      kind: 'v1',
      ...(embed ? { embeds: [{ title: title ?? undefined, description: body, color }] } : { content: body }),
      ...(label && url ? { components: [{ components: [{ type: 'button', id: 'link', label, url }] }] } : {}),
    };
    await upsert(app, interaction.guildId, channelId, interaction.user.id, null, spec, interaction.options.getInteger('after'));
  } else if (sub === 'saved') {
    const saved = await app.messages.getByName(interaction.guildId, interaction.options.getString('name', true));
    if (!saved) { await v2Reply(interaction, 'Saved message not found.', { ephemeral: true }); return; }
    await upsert(app, interaction.guildId, channelId, interaction.user.id, saved.id, null, interaction.options.getInteger('after'));
  } else if (sub === 'remove') {
    const sticky = await app.stickyMessages.get(interaction.guildId, channelId);
    if (!sticky) { await v2Reply(interaction, 'No sticky is configured there.', { ephemeral: true }); return; }
    app.stickyMessages.cancel(channelId);
    await app.db.execute('DELETE FROM sticky_messages WHERE id = ?', [sticky.id]);
    await v2Reply(interaction, 'Sticky removed. The last posted message was left in place.', { ephemeral: true }); return;
  } else if (sub === 'pause' || sub === 'resume') {
    const existing = await app.stickyMessages.get(interaction.guildId, channelId);
    if (!existing) { await v2Reply(interaction, 'No sticky is configured there.', { ephemeral: true }); return; }
    await app.db.execute('UPDATE sticky_messages SET enabled = ? WHERE guild_id = ? AND channel_id = ?', [sub === 'resume' ? 1 : 0, interaction.guildId, channelId]);
    if (sub === 'pause') {
      app.stickyMessages.cancel(channelId);
      await v2Reply(interaction, 'Sticky paused.', { ephemeral: true }); return;
    }
  } else if (sub === 'refresh') {
    const sticky = await app.stickyMessages.get(interaction.guildId, channelId);
    if (!sticky) { await v2Reply(interaction, 'No sticky is configured there.', { ephemeral: true }); return; }
    const id = await app.stickyMessages.post(sticky, true);
    await v2Reply(interaction, id ? `Sticky reposted: https://discord.com/channels/${interaction.guildId}/${channelId}/${id}` : 'The sticky could not be posted. Check channel permissions and content.', { ephemeral: true }); return;
  } else if (sub === 'config') {
    const values: Array<[string, unknown]> = [
      ['conversation_detection', interaction.options.getBoolean('conversation_detection')],
      ['quiet_period_seconds', interaction.options.getInteger('quiet_seconds')],
      ['min_interval_seconds', interaction.options.getInteger('minimum_interval')],
      ['max_reposts_per_hour', interaction.options.getInteger('hourly_limit')],
      ['conversation_min_messages', interaction.options.getInteger('conversation_messages')],
      ['delay_min_seconds', interaction.options.getInteger('delay_min_seconds')],
      ['delay_max_seconds', interaction.options.getInteger('delay_max_seconds')],
      ['count_bot_messages', interaction.options.getBoolean('count_bots')],
      ['delete_previous', interaction.options.getBoolean('delete_previous')],
    ];
    const selected = values.filter(([, v]) => v !== null);
    if (!selected.length) { await v2Reply(interaction, 'Provide at least one setting to change.', { ephemeral: true }); return; }
    const current = await app.stickyMessages.get(interaction.guildId, channelId);
    if (!current) { await v2Reply(interaction, 'No sticky is configured there.', { ephemeral: true }); return; }
    const requestedMin = interaction.options.getInteger('delay_min_seconds') ?? current.delay_min_seconds;
    const requestedMax = interaction.options.getInteger('delay_max_seconds') ?? current.delay_max_seconds;
    if (requestedMax < requestedMin) { await v2Reply(interaction, '`delay_max_seconds` cannot be lower than `delay_min_seconds`.', { ephemeral: true }); return; }
    const set = selected.map(([k]) => `${k} = ?`).join(', ');
    const params: any[] = [...selected.map(([, v]) => typeof v === 'boolean' ? (v ? 1 : 0) : v), interaction.guildId, channelId];
    await app.db.execute(`UPDATE sticky_messages SET ${set} WHERE guild_id = ? AND channel_id = ?`, params);
    await v2Reply(interaction, 'Sticky settings updated.', { ephemeral: true }); return;
  } else if (sub === 'status') {
    const s = await app.stickyMessages.get(interaction.guildId, channelId);
    if (!s) { await v2Reply(interaction, 'No sticky is configured there.', { ephemeral: true }); return; }
    await v2Reply(interaction, `**Sticky in <#${channelId}>**\nStatus: ${s.enabled ? 'active' : 'paused'}\nSource: ${s.saved_message_id ? `saved message #${s.saved_message_id}` : 'inline'}\nRepost after: ${s.repost_after_messages} messages\nDelay: ${s.delay_min_seconds}–${s.delay_max_seconds}s\nCount bot messages: ${s.count_bot_messages ? 'yes' : 'no'}\nConversation detection: ${s.conversation_detection ? `on (${s.conversation_min_messages} messages, ${s.quiet_period_seconds}s quiet period)` : 'off'}\nMinimum interval: ${s.min_interval_seconds}s\nHourly limit: ${s.max_reposts_per_hour}\nDelete previous: ${s.delete_previous ? 'yes' : 'no'}`, { ephemeral: true }); return;
  }

  const sticky = await app.stickyMessages.get(interaction.guildId, channelId);
  const posted = sticky ? await app.stickyMessages.post(sticky, true) : null;
  await v2Reply(interaction, posted ? `Sticky ${sub === 'resume' ? 'resumed' : 'configured'} and posted in <#${channelId}>.` : `Sticky ${sub === 'pause' ? 'paused' : 'saved'}, but it could not be posted right now.`, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!message.guildId) return;
  const first = args[0]?.toLowerCase();
  if (first === 'remove' || first === 'delete' || first === 'off') {
    app.stickyMessages.cancel(message.channelId);
    await app.db.execute('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?', [message.guildId, message.channelId]);
    await v2MessageReply(message, { content: 'Sticky removed.' }); return;
  }
  if (first === 'saved') {
    const name = args.slice(1).join(' ');
    const saved = await app.messages.getByName(message.guildId, name);
    if (!saved) { await v2MessageReply(message, { content: 'Saved message not found.' }); return; }
    await upsert(app, message.guildId, message.channelId, message.author.id, saved.id, null);
  } else {
    const body = args.join(' ');
    if (!body) { await v2MessageReply(message, { content: 'Usage: `!sticky <message>`, `!sticky saved <name>`, or `!unstick`' }); return; }
    await upsert(app, message.guildId, message.channelId, message.author.id, null, { kind: 'v1', content: body });
  }
  const sticky = await app.stickyMessages.get(message.guildId, message.channelId);
  if (sticky) await app.stickyMessages.post(sticky, true);
  await v2MessageReply(message, { content: 'Sticky configured.' });
}

const sticky: BotCommand = { name: 'sticky', category: 'admin', description: 'Manage sticky channel messages', usage: ['!sticky <message>', '!sticky saved <name>'], details: 'Reposts the sticky in the current channel with anti-spam and conversation detection. Use `!sticky remove` or `!unstick` to remove it.', data, permissions: ['ManageMessages'], aliases: ['stick'], execute, prefixExecute };

const unstickData = new SlashCommandBuilder().setName('unstick').setDescription('Remove the sticky from this channel').addChannelOption(channelOption);
const unstick: BotCommand = {
  name: 'unstick', category: 'admin', description: 'Remove a sticky message', usage: '!unstick [channel]', data: unstickData,
  permissions: ['ManageMessages'], aliases: [],
  async execute(interaction, app) {
    if (!interaction.guildId) return;
    const channelId = targetId(interaction);
    if (!channelId) return;
    app.stickyMessages.cancel(channelId);
    await app.db.execute('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?', [interaction.guildId, channelId]);
    await v2Reply(interaction, 'Sticky removed. The last posted message was left in place.', { ephemeral: true });
  },
  async prefixExecute(message, _args, app) {
    if (!message.guildId) return;
    app.stickyMessages.cancel(message.channelId);
    await app.db.execute('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?', [message.guildId, message.channelId]);
    await v2MessageReply(message, { content: 'Sticky removed.' });
  },
};

export default [sticky, unstick];
