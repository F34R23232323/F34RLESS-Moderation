import type {
  ChatInputCommandInteraction,
  Message,
  MessageContextMenuCommandInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { App } from '../core/context';

export interface BotCommand {
  name: string;
  category: string;
  description: string;
  details?: string;
  usage?: string | string[];
  data: any;
  permissions?: PermissionResolvable[];
  aliases?: string[];
  guildOnly?: boolean;
  ownerOnly?: boolean;
  execute(interaction: ChatInputCommandInteraction, app: App): Promise<void>;
  prefixExecute?(message: Message, args: string[], app: App): Promise<void>;
  asMessageContext?: boolean;
  asUserContext?: boolean;
  contextExecute?(interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction, app: App): Promise<void>;
}