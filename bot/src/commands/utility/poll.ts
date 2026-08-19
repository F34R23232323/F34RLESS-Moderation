import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { parseDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';

function pollContent(question: string, options: string[]): string {
  return [`**${question}**`, ...options.map((o, i) => `**${i + 1}.** ${o}`)].join('\n');
}

function buildPollComponents(pollId: string, options: string[]): Array<{ type: number; components: Array<{ type: number; custom_id: string; label: string; style: number }> }> {
  return [
    {
      type: 1,
      components: options.slice(0, 5).map((_, i) => ({
        type: 2,
        custom_id: `${pollId}:${i}`,
        label: String(i + 1),
        style: 1,
      })),
    },
    { type: 1, components: [{ type: 2, custom_id: `${pollId}:close`, label: 'Close poll', style: 4 }] },
  ];
}

const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Create a poll with buttons')
  .addStringOption((o) => o.setName('question').setDescription('Poll question').setRequired(true))
  .addStringOption((o) => o.setName('option1').setDescription('Option 1').setRequired(true))
  .addStringOption((o) => o.setName('option2').setDescription('Option 2').setRequired(true))
  .addStringOption((o) => o.setName('option3').setDescription('Option 3').setRequired(false))
  .addStringOption((o) => o.setName('option4').setDescription('Option 4').setRequired(false))
  .addStringOption((o) => o.setName('duration').setDescription('Duration e.g. 10m, 1h').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const question = interaction.options.getString('question', true);
  const options = [
    interaction.options.getString('option1', true),
    interaction.options.getString('option2', true),
    interaction.options.getString('option3'),
    interaction.options.getString('option4'),
  ].filter(Boolean) as string[];

  const votes = new Map<string, Set<string>>();
  const pollId = `poll:${interaction.id}`;
  const durationStr = interaction.options.getString('duration');
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;

  const sent = await interaction.editReply({
    content: pollContent(question, options),
    components: buildPollComponents(pollId, options) as never,
  });

  app.polls.set(pollId, { votes, options, question, messageId: sent.id, channelId: interaction.channelId! });

  if (durationMs > 0) {
    app.scheduler.setTimeout(`poll:${pollId}`, durationMs, async () => {
      const p = app.polls.get(pollId);
      if (!p) return;
      await closePoll(app, pollId);
    });
  }
}

export async function closePoll(app: App, pollId: string): Promise<void> {
  const poll = app.polls.get(pollId);
  if (!poll) return;
  app.polls.delete(pollId);
  const totals = poll.options.map((o, i) => {
    const set = poll.votes.get(String(i)) ?? new Set();
    return { option: o, votes: set.size };
  });
  const channel = app.client.channels.cache.get(poll.channelId);
  if (!channel || !('messages' in channel)) return;
  const message = await channel.messages.fetch(poll.messageId).catch(() => null);
  if (!message) return;
  const lines = [`**${poll.question}** (closed)`, ...totals.map((t) => `**${t.votes}** vote(s) — ${t.option}`)];
  await message.edit({ content: lines.join('\n'), components: [] });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const question = args[0];
  const options = args.slice(1);
  if (!question || options.length < 2) {
    await v2MessageReply(message, { content: 'Usage: `!poll <question> | <option1> | <option2> [option3] [option4]`' });
    return;
  }
  const votes = new Map<string, Set<string>>();
  const pollId = `poll:${message.id}`;
  const sent = await (message.channel as any).send({
    content: pollContent(question, options),
    components: buildPollComponents(pollId, options),
    allowedMentions: { parse: [], repliedUser: false },
  });
  app.polls.set(pollId, { votes, options, question, messageId: sent.id, channelId: message.channelId });
}

const command: BotCommand = {
  name: 'poll',
  category: 'utility',
  description: 'Create a poll with buttons',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;