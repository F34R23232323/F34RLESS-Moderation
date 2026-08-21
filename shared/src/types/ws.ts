export type WsServerMessage =
  | { type: 'log'; payload: unknown }
  | { type: 'automod_log'; payload: unknown }
  | { type: 'metric'; payload: unknown }
  | { type: 'hello'; payload: { connected: true } }
  | { type: 'error'; payload: { message: string } }
  // Appeals portal live updates (scope: { guildId, appealId }).
  | { type: 'appeal_status'; payload: { guildId: string; appealId: number; status: string; decidedAt: string | null; decidedBy: string | null; decisionReason: string | null } }
  | { type: 'appeal_message'; payload: { guildId: string; appealId: number; message: { id: number; senderType: string; senderId: string; content: string; sentAt: string } } };

export interface AppealWsSubscription {
  guildId: string;
  appealId: number;
}

export type WsClientMessage =
  | { type: 'subscribe'; payload: { streams: Array<'logs' | 'automod' | 'metrics' | 'appeals'>; appeals?: AppealWsSubscription[] } }
  | { type: 'ping' }
  | { type: 'pong' };