import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { App } from '../core/context';
import { getMusicFilter } from '../music/filters';
import { getQueue, isUserInBotChannel, queueListText } from '../music/helpers';
import { buildPanelPayload } from '../music/panel';

interface MusicComponent {
  type: 'button' | 'select';
  id: string;
  run: (app: App, interaction: ButtonInteraction | StringSelectMenuInteraction) => Promise<void>;
}

async function musicDisabled(
  app: App,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<boolean> {
  if (app.config.music.enabled) return false;
  await interaction.reply({ content: 'The music module is disabled in the bot config.', ephemeral: true });
  return true;
}

async function sameVoiceOrError(
  app: App,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<boolean> {
  if (await musicDisabled(app, interaction)) return false;
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This can only be used inside a server.', ephemeral: true });
    return false;
  }
  const queue = getQueue(app, guildId);
  if (!queue) {
    await interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    return false;
  }
  if (!isUserInBotChannel(app, guildId, interaction.member as never)) {
    await interaction.reply({
      content: 'You must be in the same voice channel as the bot to control playback.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

const musicPause: MusicComponent = {
  type: 'button',
  id: 'music:pause',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const queue = getQueue(app, guildId)!;
    if (queue.paused) {
      await queue.resume();
      await interaction.reply({ content: '▶ Resumed.', ephemeral: true });
    } else {
      await queue.pause();
      await interaction.reply({ content: '⏸ Paused.', ephemeral: true });
    }
    await app.music.refreshPanel(guildId, getQueue(app, guildId));
  },
};

const musicSkip: MusicComponent = {
  type: 'button',
  id: 'music:skip',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const queue = getQueue(app, guildId)!;
    if (queue.songs.length <= 1 && !queue.autoplay) {
      await interaction.reply({ content: 'There is no next song to skip to.', ephemeral: true });
      return;
    }
    const skipped = queue.songs[0]?.name ?? 'song';
    await queue.jump(1);
    await interaction.reply({ content: `⏭ Skipped **${skipped}**.`, ephemeral: true });
    await app.music.refreshPanel(guildId, getQueue(app, guildId));
  },
};

const musicStop: MusicComponent = {
  type: 'button',
  id: 'music:stop',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    await app.music.stop(guildId);
    await interaction.reply({ content: '⏹ Stopped and cleared the queue.', ephemeral: true });
  },
};

const musicShuffle: MusicComponent = {
  type: 'button',
  id: 'music:shuffle',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const queue = getQueue(app, guildId)!;
    if (queue.songs.length < 2) {
      await interaction.reply({ content: 'Not enough songs to shuffle.', ephemeral: true });
      return;
    }
    await queue.shuffle();
    await interaction.reply({ content: '🔀 Shuffled the queue.', ephemeral: true });
    await app.music.refreshPanel(guildId, queue);
  },
};

const musicPrev: MusicComponent = {
  type: 'button',
  id: 'music:prev',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const queue = getQueue(app, guildId)!;
    if (queue.previousSongs.length === 0) {
      await interaction.reply({ content: 'There is no previous song.', ephemeral: true });
      return;
    }
    await queue.previous();
    await interaction.reply({ content: '↩ Playing the previous song.', ephemeral: true });
    await app.music.refreshPanel(guildId, getQueue(app, guildId));
  },
};

const musicVolDown: MusicComponent = {
  type: 'button',
  id: 'music:vol:down',
  async run(app, interaction) {
    if (await musicDisabled(app, interaction)) return;
    const guildId = interaction.guildId;
    if (!guildId) return;
    const settings = await app.music.getSettings(guildId);
    const next = Math.max(0, settings.volume - 10);
    await app.music.setVolume(guildId, next);
    await interaction.reply({ content: `🔉 Volume: **${next}%**.`, ephemeral: true });
  },
};

const musicVolUp: MusicComponent = {
  type: 'button',
  id: 'music:vol:up',
  async run(app, interaction) {
    if (await musicDisabled(app, interaction)) return;
    const guildId = interaction.guildId;
    if (!guildId) return;
    const settings = await app.music.getSettings(guildId);
    const next = settings.volume + 10;
    await app.music.setVolume(guildId, next);
    await interaction.reply({ content: `🔊 Volume: **${next}%**.`, ephemeral: true });
  },
};

const musicLoop: MusicComponent = {
  type: 'button',
  id: 'music:loop',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const queue = getQueue(app, guildId)!;
    const mode = queue.setRepeatMode();
    await interaction.reply({
      content: `🔁 Loop: **${['Off', 'Song', 'Queue'][mode] ?? 'Off'}**.`,
      ephemeral: true,
    });
    await app.music.refreshPanel(guildId, queue);
  },
};

const musicAutoplay: MusicComponent = {
  type: 'button',
  id: 'music:autoplay',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const next = await app.music.toggleAutoplay(guildId);
    await interaction.reply({ content: `✨ Autoplay is now **${next ? 'ON' : 'OFF'}**.`, ephemeral: true });
  },
};

const music247: MusicComponent = {
  type: 'button',
  id: 'music:247',
  async run(app, interaction) {
    if (await musicDisabled(app, interaction)) return;
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This can only be used inside a server.', ephemeral: true });
      return;
    }
    const settings = await app.music.getSettings(guildId);
    const updated = await app.music.set247(guildId, !settings.twentyFourSeven);
    await interaction.reply({
      content: `🌙 24/7 mode is now **${updated.twentyFourSeven ? 'ON' : 'OFF'}**.`,
      ephemeral: true,
    });
  },
};

const musicRefresh: MusicComponent = {
  type: 'button',
  id: 'music:refresh',
  async run(app, interaction) {
    if (await musicDisabled(app, interaction)) return;
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This can only be used inside a server.', ephemeral: true });
      return;
    }
    await app.music.refreshPanel(guildId, getQueue(app, guildId));
    await interaction.reply({ content: '🔄 Panel refreshed.', ephemeral: true });
  },
};

const musicQueue: MusicComponent = {
  type: 'button',
  id: 'music:queue',
  async run(app, interaction) {
    if (await musicDisabled(app, interaction)) return;
    const guildId = interaction.guildId;
    if (!guildId) return;
    const queue = getQueue(app, guildId);
    if (!queue) {
      await interaction.reply({ content: 'The queue is empty.', ephemeral: true });
      return;
    }
    const text = queueListText(queue, 1);
    await interaction.reply({ content: text.slice(0, 1900), ephemeral: true });
  },
};

const musicFilter: MusicComponent = {
  type: 'select',
  id: 'music:filter',
  async run(app, interaction) {
    if (!(await sameVoiceOrError(app, interaction))) return;
    const guildId = interaction.guildId!;
    const value = (interaction as StringSelectMenuInteraction).values[0] ?? 'off';
    await app.music.setFilter(guildId, value);
    const def = value === 'off' ? null : getMusicFilter(value);
    await interaction.reply({
      content: value === 'off' ? '🎚️ Filters disabled.' : `🎚️ Filter set: **${def?.emoji ?? ''} ${def?.label ?? value}**.`,
      ephemeral: true,
    });
  },
};

export default [
  musicPause,
  musicSkip,
  musicStop,
  musicShuffle,
  musicPrev,
  musicVolDown,
  musicVolUp,
  musicLoop,
  musicAutoplay,
  music247,
  musicRefresh,
  musicQueue,
  musicFilter,
];