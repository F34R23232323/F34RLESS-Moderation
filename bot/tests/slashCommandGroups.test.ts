import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SlashCommandBuilder } from 'discord.js';
import { buildGroupedSlashCommands, resolveGroupedSlashCommand, slashPathForCommand } from '../src/core/slashCommandGroups';
import type { BotCommand } from '../src/types/command';

function command(name: string, configure?: (builder: SlashCommandBuilder) => void): BotCommand {
  const data = new SlashCommandBuilder().setName(name).setDescription(`${name} description`);
  configure?.(data);
  return { name, category: 'music', description: `${name} description`, data, async execute() {} };
}

describe('slash command groups', () => {
  test('combines enabled leaf commands and preserves their options', () => {
    const commands = new Map<string, BotCommand>([
      ['play', command('play', (builder) => builder.addStringOption((option) => option.setName('query').setDescription('Song').setRequired(true)))],
      ['pause', command('pause')],
    ]);
    const result = buildGroupedSlashCommands(commands, () => true);
    const music = result.bodies.find((body) => body.name === 'music');
    assert.ok(music);
    assert.deepEqual(result.grouped, new Set(['play', 'pause']));
    assert.equal(music.options?.length, 2);
    assert.equal((music.options?.[0] as any).options[0].name, 'query');
  });

  test('skips disabled or already-nested commands', () => {
    const commands = new Map<string, BotCommand>([
      ['play', command('play', (builder) => builder.addSubcommand((subcommand) => subcommand.setName('song').setDescription('Play a song')))],
      ['pause', command('pause')],
    ]);
    const result = buildGroupedSlashCommands(commands, (name) => name !== 'pause');
    assert.equal(result.bodies.some((body) => body.name === 'music'), false);
    assert.equal(result.grouped.size, 0);
  });

  test('routes grouped interactions to original handlers', () => {
    assert.equal(resolveGroupedSlashCommand('music', 'play'), 'play');
    assert.equal(resolveGroupedSlashCommand('economy', 'settings'), 'economy');
    assert.equal(resolveGroupedSlashCommand('music', 'missing'), undefined);
    assert.equal(slashPathForCommand('play'), '/music play');
    assert.equal(slashPathForCommand('help'), '/help');
  });
});
