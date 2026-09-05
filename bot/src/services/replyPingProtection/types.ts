import type { RowDataPacket } from 'mysql2/promise';

export interface GuildReplyPingConfig {
  guild_id: string;
  enabled: boolean;
  native_rule_id: string | null;
  notice_channel_id: string | null;
  log_channel_id: string | null;
  notice_title: string;
  notice_description: string | null;
  notice_accent_color: string;
  notice_delete_after_seconds: number;
  escalation_enabled: boolean;
}

export interface ProtectedEntityRow extends RowDataPacket {
  id: number;
  guild_id: string;
  entity_type: 'user' | 'role';
  entity_id: string;
}

export interface ExemptionRow extends RowDataPacket {
  id: number;
  guild_id: string;
  entity_type: 'user' | 'role' | 'channel';
  entity_id: string;
}

export interface EscalationLevelRow extends RowDataPacket {
  id: number;
  guild_id: string;
  level: number;
  violation_count: number;
  window_seconds: number;
  action_type: 'warn' | 'mute' | 'timeout' | 'kick' | 'ban';
  action_duration: string | null;
}

export interface IncidentRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  channel_id: string | null;
  message_id: string | null;
  original_content: string | null;
  sanitized_content: string | null;
  blocked_user_id: string | null;
  escalation_level: number;
  action_taken: string | null;
  case_id: number | null;
  created_at: Date;
}

export interface ViolationCountRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  window_start: Date;
  violation_count: number;
  last_violation_at: Date;
}

export const DEFAULT_NOTICE_TITLE = 'Reply Mention Blocked';
export const DEFAULT_NOTICE_COLOR = '#FEE75C';
export const DEFAULT_ESCALATION_WINDOW = 3600;
export const DEFAULT_DELETE_AFTER = 0;
