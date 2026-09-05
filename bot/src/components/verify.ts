import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

const CAPTCHA_EMOJIS = ['🍕', '🎮', '🎲', '🎯', '🔑', '🔒', '💎', '⭐', '⚔️', '🛡️', '👑', '🎭', '🎪', '🎨', '🎬'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function logToChannel(app: App, guildId: string, content: string, color: string): Promise<void> {
  const cfg = app.config.verification_gate;
  if (!cfg.log_channel_id) return;
  const guild = app.client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(cfg.log_channel_id);
  if (!channel || !('send' in channel)) return;
  await v2Send(channel as never, content, { accentColor: color, allowedMentions: { parse: [] } }).catch(() => undefined);
}

async function grantVerified(app: App, interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  const cfg = app.config.verification_gate;
  const roleId = cfg.verified_role_id;
  if (!roleId) {
    await interaction.reply({ content: 'No verified role configured.', ephemeral: true });
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'Could not find your membership.', ephemeral: true });
    return;
  }

  const role = interaction.guild?.roles.cache.get(roleId);
  const me = interaction.guild?.members.me;
  if (!role || !me || role.position >= me.roles.highest.position) {
    await interaction.reply({ content: 'Verified role is misconfigured (bot role too low).', ephemeral: true });
    return;
  }

  await member.roles.add(roleId, 'Verified via captcha');

  if (cfg.unverified_role_id && member.roles.cache.has(cfg.unverified_role_id)) {
    await member.roles.remove(cfg.unverified_role_id, 'Verified').catch(() => undefined);
  }

  await app.db.execute("UPDATE gates SET state = 'verified' WHERE guild_id = ? AND user_id = ?", [interaction.guildId!, interaction.user.id]);
  await app.logManager.log({
    event: 'member_join',
    guildId: interaction.guildId!,
    targetId: interaction.user.id,
    message: `<@${interaction.user.id}> verified via captcha gate`,
  });

  await logToChannel(
    app,
    interaction.guildId!,
    `**Verification Successful**\n**User:** <@${interaction.user.id}> (\`${interaction.user.id}\`)\n**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
    '#57F287',
  );

  await interaction.reply({ content: 'You are now verified! Welcome to the server.', ephemeral: true });
}

async function logFailedAttempt(app: App, guildId: string, userId: string, reason: string): Promise<void> {
  await logToChannel(
    app,
    guildId,
    `**Verification Failed**\n**User:** <@${userId}> (\`${userId}\`)\n**Reason:** ${reason}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
    '#ED4245',
  );
}

// Main panel button — generates captcha and shows challenge
const startHandler = {
  type: 'button' as const,
  id: 'verify:start',
  async run(app: App, interaction: ButtonInteraction) {
    const cfg = app.config.verification_gate;
    if (!cfg.enabled) {
      await interaction.reply({ content: 'Verification is disabled.', ephemeral: true });
      return;
    }

    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    if (member && cfg.verified_role_id && member.roles.cache.has(cfg.verified_role_id)) {
      await interaction.reply({ content: 'You are already verified.', ephemeral: true });
      return;
    }

    await app.db.execute(
      `INSERT INTO gates (guild_id, user_id, state) VALUES (?, ?, 'pending')
       ON DUPLICATE KEY UPDATE state = 'pending'`,
      [interaction.guildId!, interaction.user.id],
    );

    const types = cfg.captcha.types;
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'math') {
      const max = cfg.captcha.math_max;
      const a = Math.floor(Math.random() * max) + 1;
      const b = Math.floor(Math.random() * max) + 1;
      const ops = ['+', '-', '×'] as const;
      const op = ops[Math.floor(Math.random() * ops.length)];
      let answer: number;
      if (op === '+') answer = a + b;
      else if (op === '-') answer = a - b;
      else answer = a * b;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify:open:math:${answer}`)
          .setLabel('Submit Answer')
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({
        content: `**Captcha Challenge**\n\nSolve: **${a} ${op} ${b} = ?**\n\nClick the button below to type your answer.`,
        components: [row],
        ephemeral: true,
      });
    } else if (type === 'text') {
      const words = cfg.captcha.text_words;
      const word = words[Math.floor(Math.random() * words.length)];

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify:open:text:${word}`)
          .setLabel('Submit Answer')
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({
        content: `**Captcha Challenge**\n\nType the word: **${word}**\n\nClick the button below to type the word.`,
        components: [row],
        ephemeral: true,
      });
    } else if (type === 'button') {
      const count = cfg.captcha.button_count;
      const shuffled = shuffle(CAPTCHA_EMOJIS);
      const selected = shuffled.slice(0, count);
      const correctIndex = Math.floor(Math.random() * count);

      const row = new ActionRowBuilder<ButtonBuilder>();
      for (let i = 0; i < count; i++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`verify:btn:${i === correctIndex ? 'ok' : 'no'}:${i}`)
            .setLabel(selected[i])
            .setStyle(ButtonStyle.Secondary),
        );
      }

      await interaction.reply({
        content: `**Captcha Challenge**\n\nClick the **${selected[correctIndex]}** button to verify.`,
        components: [row],
        ephemeral: true,
      });
    }
  },
};

// "Submit Answer" button — opens the modal for math/text captchas
const openModalHandler = {
  type: 'button' as const,
  id: 'verify:open:',
  async run(_app: App, interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const captchaType = parts[2]; // 'math' or 'text'
    const answer = parts.slice(3).join(':');

    const modal = new ModalBuilder()
      .setCustomId(`verify:check:${captchaType}:${answer}`)
      .setTitle('Captcha Verification')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('answer')
            .setLabel(captchaType === 'math' ? 'Type the answer' : 'Type the word')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50),
        ),
      );

    await interaction.showModal(modal);
  },
};

// Modal submit — validates math/text captcha answer
const checkHandler = {
  type: 'modal' as const,
  id: 'verify:check:',
  async run(app: App, interaction: ModalSubmitInteraction) {
    const cfg = app.config.verification_gate;
    if (!cfg.enabled) return;

    const parts = interaction.customId.split(':');
    const captchaType = parts[2];
    const expected = parts.slice(3).join(':');
    const answer = interaction.fields.getTextInputValue('answer').trim();

    if (captchaType === 'math') {
      if (answer !== expected) {
        await logFailedAttempt(app, interaction.guildId!, interaction.user.id, `Math captcha: answered \`${answer}\`, expected \`${expected}\``);
        await interaction.reply({ content: 'Incorrect answer. Click the verify button to try again.', ephemeral: true });
        return;
      }
    } else if (captchaType === 'text') {
      if (answer.toLowerCase() !== expected.toLowerCase()) {
        await logFailedAttempt(app, interaction.guildId!, interaction.user.id, `Text captcha: answered \`${answer}\`, expected \`${expected}\``);
        await interaction.reply({ content: 'Incorrect word. Click the verify button to try again.', ephemeral: true });
        return;
      }
    }

    await grantVerified(app, interaction);
  },
};

// Button captcha — checks which button was clicked
const btnHandler = {
  type: 'button' as const,
  id: 'verify:btn:',
  async run(app: App, interaction: ButtonInteraction) {
    const cfg = app.config.verification_gate;
    if (!cfg.enabled) return;

    const isCorrect = interaction.customId.split(':')[2] === 'ok';
    if (!isCorrect) {
      await logFailedAttempt(app, interaction.guildId!, interaction.user.id, 'Button captcha: clicked wrong button');
      await interaction.reply({ content: 'Wrong button. Click the verify button to try again.', ephemeral: true });
      return;
    }

    await grantVerified(app, interaction);
  },
};

export default [startHandler, openModalHandler, checkHandler, btnHandler];
