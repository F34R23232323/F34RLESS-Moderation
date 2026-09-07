import type { AntiNukeConfig } from '../schemas/config';

export class NightModeService {
  public isActive(config: AntiNukeConfig, now = new Date()): boolean {
    if (!config.nightModeEnabled) return false;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const weekdayName = parts.find((part) => part.type === 'weekday')?.value;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName ?? '');
    if (!config.nightWeekdays.includes(weekday)) return false;
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
    const current = `${hour}:${minute}`;
    return config.nightStart <= config.nightEnd
      ? current >= config.nightStart && current < config.nightEnd
      : current >= config.nightStart || current < config.nightEnd;
  }
}
