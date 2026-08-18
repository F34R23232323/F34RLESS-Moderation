import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

export async function announceBirthdays(app: App): Promise<void> {
  const cfg = app.config.community.birthdays;
  if (!cfg.enabled || !cfg.channel_id) return;

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT user_id, month, day FROM birthdays WHERE month = ? AND day = ?',
    [new Date().getUTCMonth() + 1, new Date().getUTCDate()],
  );

  const channel = app.client.channels.cache.get(cfg.channel_id);
  if (!channel || !('send' in channel)) return;

  for (const row of rows) {
    await v2Send(channel as never, `Happy birthday to <@${row.user_id}>!`, { accentColor: '#FEE75C' }).catch(() => undefined);
  }
}