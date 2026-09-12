import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { BotCommand } from '../types/command';

type GroupMember = string | { command: string; subcommand: string };

interface SlashCommandGroup {
  name: string;
  description: string;
  members: GroupMember[];
}

/** Slash-only families. Prefix commands and their original handlers stay separate. */
export const SLASH_COMMAND_GROUPS: readonly SlashCommandGroup[] = [
  {
    name: 'music', description: 'Music playback and queue controls',
    members: ['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'nowplaying', 'shuffle', 'loop', 'volume', 'seek', 'filter', 'autoplay', '247', 'panel'],
  },
  {
    name: 'social', description: 'Social actions, reactions and fun commands',
    members: ['kiss', 'hug', 'slap', 'pat', 'oke', 'bite', 'cuddle', 'tickle', 'kill', 'lick', 'blush', 'wave', 'dance', 'cry', 'smile', 'angry', 'comfy', 'fluff', 'lay', 'pout', 'tail', 'ship', 'statuspages'],
  },
  {
    name: 'economy', description: 'Economy, rewards, inventory and progression',
    members: [
      { command: 'economy', subcommand: 'settings' },
      'balance', 'daily', 'weekly', 'shop', 'buy', 'sell', 'inventory', 'deposit', 'withdraw',
      'economyprofile', 'economyleaderboard', 'achievements', 'collectables', 'effects', 'use',
      'gift', 'work', 'pay', 'steal', 'streak', 'level', 'leaderboard',
    ],
  },
  {
    name: 'info', description: 'Information, assets and bot status',
    members: [
      'avatar', 'banner', 'servericon', 'serverbanner', 'serversplash', 'roleinfo', 'channelinfo',
      'emojiinfo', 'stickerinfo', 'inviteinfo', 'userinfo', 'serverinfo', 'membercount', 'botinfo',
      'stats', 'uptime', 'ping', 'imageinfo', 'color', 'firstmessage',
    ],
  },
  {
    name: 'modtools', description: 'Moderation records, roles and staff utilities',
    members: [
      'archive', 'archives', 'caseclose', 'appeal-reply', 'block-appeal-user', 'unblock-appeal-user',
      'note', 'modstats', 'snapshot', 'restore', 'roleadd', 'roleremove', 'roleimagedit', 'temprole',
      'clearwarnings', 'automodtest', 'lockall', 'unlockall', 'emergencyaccess',
    ],
  },
] as const;

const slashRouteByCommand = new Map<string, { group: string; subcommand: string }>();
for (const group of SLASH_COMMAND_GROUPS) {
  for (const member of group.members) {
    const command = typeof member === 'string' ? member : member.command;
    const subcommand = typeof member === 'string' ? member : member.subcommand;
    slashRouteByCommand.set(command, { group: group.name, subcommand });
  }
}

export function resolveGroupedSlashCommand(group: string, subcommand: string): string | undefined {
  for (const [command, route] of slashRouteByCommand) {
    if (route.group === group && route.subcommand === subcommand) return command;
  }
  return undefined;
}

export function slashPathForCommand(command: string): string {
  const route = slashRouteByCommand.get(command);
  return route ? `/${route.group} ${route.subcommand}` : `/${command}`;
}

export function buildGroupedSlashCommands(
  commands: Map<string, BotCommand>,
  slashEnabled: (command: string) => boolean,
): { bodies: RESTPostAPIChatInputApplicationCommandsJSONBody[]; grouped: Set<string> } {
  const bodies: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  const grouped = new Set<string>();

  for (const group of SLASH_COMMAND_GROUPS) {
    const options: any[] = [];
    for (const member of group.members) {
      const commandName = typeof member === 'string' ? member : member.command;
      const subcommandName = typeof member === 'string' ? member : member.subcommand;
      const command = commands.get(commandName);
      if (!command || !slashEnabled(commandName)) continue;

      const body = command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
      const hasNestedCommands = body.options?.some((option: any) => option.type === 1 || option.type === 2);
      if (hasNestedCommands) continue;

      options.push({
        type: 1,
        name: subcommandName,
        description: body.description,
        ...(body.options?.length ? { options: body.options } : {}),
      });
      grouped.add(commandName);
    }
    if (options.length > 0) bodies.push({ name: group.name, description: group.description, type: 1, options });
  }

  return { bodies, grouped };
}
