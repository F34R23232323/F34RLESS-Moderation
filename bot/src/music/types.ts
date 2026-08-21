export interface PersistedSong {
  url: string;
  name?: string;
}

export interface PersistedQueue {
  songs: PersistedSong[];
}

export interface MusicSettings {
  guildId: string;
  twentyFourSeven: boolean;
  volume: number;
  textChannelId: string | null;
  voiceChannelId: string | null;
  autoplay: boolean;
  queue: PersistedQueue | null;
}

export interface PanelRef {
  channelId: string;
  messageId: string;
}