export interface CustomEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface CustomEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface CustomEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface EmbedSpec {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  timestamp?: boolean;
  image?: string;
  thumbnail?: string;
  author?: CustomEmbedAuthor;
  fields?: CustomEmbedField[];
  footer?: CustomEmbedFooter;
}

export interface ButtonSpec {
  type: 'button';
  id: string;
  custom_id?: string;
  label: string;
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  emoji?: string;
  url?: string;
  disabled?: boolean;
}

export interface SelectOptionSpec {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
}

export interface SelectSpec {
  type: 'select';
  id: string;
  custom_id?: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options: SelectOptionSpec[];
}

export interface MessagePayload {
  content?: string;
  embeds?: EmbedSpec[];
  components?: Array<{ components: Array<ButtonSpec | SelectSpec> }>;
  files?: string[];
}

export interface CustomCommandTarget {
  target?: 'author' | 'mentioned' | 'first_arg' | 'args';
  user_id?: string;
}

export type CustomCommandActionUnion =
  | { type: 'send_message'; content?: string; embeds?: EmbedSpec[]; components?: MessagePayload['components']; files?: string[]; reply?: boolean; ephemeral?: boolean; delete_after_seconds?: number; mention?: boolean }
  | { type: 'edit_message'; content?: string; embeds?: EmbedSpec[]; components?: MessagePayload['components']; files?: string[] }
  | { type: 'send_channel'; channel_id: string; content?: string; embeds?: EmbedSpec[]; components?: MessagePayload['components']; files?: string[]; delete_after_seconds?: number }
  | { type: 'dm'; content?: string; embeds?: EmbedSpec[]; components?: MessagePayload['components']; files?: string[] }
  | { type: 'delete_message'; delete_after_seconds: number }
  | { type: 'react'; emojis: string[] }
  | ({ type: 'add_role'; role_id: string } & CustomCommandTarget)
  | ({ type: 'remove_role'; role_id: string } & CustomCommandTarget)
  | ({ type: 'add_roles'; role_ids: string[] } & CustomCommandTarget)
  | ({ type: 'remove_roles'; role_ids: string[] } & CustomCommandTarget)
  | ({ type: 'kick'; reason?: string } & CustomCommandTarget)
  | ({ type: 'ban'; reason?: string; delete_message_days: number; duration?: string } & CustomCommandTarget)
  | ({ type: 'unban'; user_id: string; reason?: string })
  | ({ type: 'timeout'; duration: string; reason?: string } & CustomCommandTarget)
  | ({ type: 'untimeout'; reason?: string } & CustomCommandTarget)
  | { type: 'create_thread'; name: string; auto_archive_duration: number; reason?: string }
  | ({ type: 'set_nickname'; nickname: string; reason?: string } & CustomCommandTarget)
  | ({ type: 'move_channel'; channel_id: string; reason?: string } & CustomCommandTarget)
  | ({ type: 'disconnect'; reason?: string } & CustomCommandTarget)
  | { type: 'create_role'; name: string; color?: string; hoist: boolean; mentionable: boolean; permissions: string[]; reason?: string }
  | { type: 'delete_role'; role_id: string; reason?: string }
  | { type: 'rename_channel'; name: string; channel_id?: string; reason?: string }
  | { type: 'wait'; ms: number }
  | { type: 'random_pick'; choices: MessagePayload[] }
  | { type: 'run_command'; command: string; args?: string }
  | { type: 'stop' }
  | { type: 'log'; content: string; channel_id?: string }
  | { type: 'webhook'; url: string; content?: string; embeds?: EmbedSpec[]; components?: MessagePayload['components']; files?: string[] }
  | { type: 'counter'; name: string; increment_by: number; persist?: boolean; send_result?: boolean }
  | {
      type: 'if';
      condition: 'has_role' | 'not_has_role' | 'is_bot' | 'has_permission' | 'equals_arg';
      role_id?: string;
      permission?: string;
      arg_index?: number;
      equals?: string;
      then?: CustomCommandActionUnion[];
      else?: CustomCommandActionUnion[];
    };

export interface CustomCommandConfig {
  enabled: boolean;
  slash: boolean;
  prefix: boolean;
  cooldown_seconds: number;
  delete_input: boolean | number;
  delete_output: boolean | number;
  ephemeral: boolean;
  suppress_reply: boolean;
  allowed_users: string[];
  allowed_roles: string[];
  denied_roles: string[];
  permissions: string[];
  channel_ids: string[];
  channel_mode: 'allow' | 'deny';
  aliases: string[];
  description: string;
  actions: CustomCommandActionUnion[];
}
