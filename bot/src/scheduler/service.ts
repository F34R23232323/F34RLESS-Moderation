import type { RowDataPacket } from 'mysql2/promise';
import * as cron from 'node-cron';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';

interface ScheduledJob {
  id: string;
  cron: string;
  run: () => Promise<void> | void;
}

export class SchedulerService {
  private readonly app: App;
  private readonly jobs: ScheduledJob[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(app: App) {
    this.app = app;
  }

  public start(): void {
    this.schedulePunishmentExpiry();
    this.scheduleReminders();
    this.scheduleLockdowns();
    this.scheduleAnnouncements();
    this.scheduleBackups();
    this.scheduleSlowmodeRevert();
    this.scheduleBirthdays();
    this.scheduleTrustLevels();
    this.schedulePendingMessageSends();
    this.schedulePendingDashboardLogs();
    this.scheduleChannelSync();
    this.scheduleRoleConnections();
    this.scheduleSnapshotPurge();
    this.app.logger.info('Scheduler started');
  }

  private schedulePendingMessageSends(): void {
    this.addCron('message-sends', '*/1 * * * * *', async () => {
      await this.app.messages.processPendingSends();
    });
  }

  private schedulePendingDashboardLogs(): void {
    this.addCron('dashboard-log-sends', '*/5 * * * * *', async () => {
      await this.app.dashboardLogs.processPending();
    });
  }

  private scheduleChannelSync(): void {
    this.addCron('channel-sync', '*/10 * * * *', async () => {
      await this.app.messages.syncChannels();
      await this.app.messages.syncRoles();
    });
  }

  private scheduleRoleConnections(): void {
    const rc = this.app.config.role_connections;
    if (!rc.enabled) return;
    const minutes = Math.max(1, rc.sync_interval_minutes);
    this.addCron(`role-connections-sync`, `*/${minutes} * * * *`, async () => {
      await this.app.roleConnections.resyncAllGuilds();
    });
  }

  private scheduleSnapshotPurge(): void {
    this.addCron('snapshot-purge', '0 4 * * *', async () => {
      const removed = await this.app.messageLogs.purgeOld();
      if (removed > 0) {
        this.app.logger.info(`Purged ${removed} message snapshots older than retention`);
      }
    });
  }

  public addCron(id: string, expression: string, run: () => Promise<void> | void): void {
    if (!cron.validate(expression)) {
      this.app.logger.warn(`Invalid cron expression for job ${id}: ${expression}`);
      return;
    }
    this.jobs.push({ id, cron: expression, run });
    cron.schedule(expression, () => {
      void Promise.resolve(run()).catch((err: unknown) => this.app.logManager.reportError(`cron job ${id}`, err));
    });
  }

  public setTimeout(id: string, delayMs: number, run: () => Promise<void> | void): void {
    this.clearTimeout(id);
    const timer = setTimeout(() => {
      this.timers.delete(id);
      void Promise.resolve(run()).catch((err: unknown) => this.app.logManager.reportError(`timer job ${id}`, err));
    }, delayMs);
    timer.unref?.();
    this.timers.set(id, timer);
  }

  public clearTimeout(id: string): void {
    const existing = this.timers.get(id);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(id);
    }
  }

  private schedulePunishmentExpiry(): void {
    this.addCron('punishment-expiry', '*/30 * * * * *', async () => {
      const [rows] = await this.app.db.query<RowDataPacket[]>(
        'SELECT id, guild_id, user_id, type, role_id, case_id FROM punishments WHERE active = 1 AND expires_at <= NOW()',
      );
      for (const row of rows) {
        const guild = this.app.client.guilds.cache.get(row.guild_id);
        if (!guild) continue;
        try {
          if (row.type === 'mute') {
            const member = await guild.members.fetch(row.user_id).catch(() => null);
            if (member) await member.timeout(null);
          } else if (row.type === 'ban') {
            await guild.bans.remove(row.user_id, 'temp ban expired');
          } else if (row.type === 'temp_role' && row.role_id) {
            const member = await guild.members.fetch(row.user_id).catch(() => null);
            if (member) await member.roles.remove(row.role_id, 'temp role expired');
          }
          await this.app.db.execute('UPDATE punishments SET active = 0 WHERE id = ?', [row.id]);
        } catch (err) {
          this.app.logger.warn(`Failed to expire punishment ${row.id}:`, err);
        }
      }
    });
  }

  private scheduleReminders(): void {
    this.addCron('reminders', '*/15 * * * * *', async () => {
      const [rows] = await this.app.db.query<RowDataPacket[]>(
        "SELECT id, user_id, channel_id, message FROM reminders WHERE status = 'pending' AND remind_at <= NOW()",
      );
      for (const row of rows) {
        try {
          if (row.channel_id) {
            const channel = this.app.client.channels.cache.get(row.channel_id);
            if (channel && 'send' in channel) {
              await channel.send({ content: `<@${row.user_id}> reminder: ${row.message}` });
            }
          } else {
            const user = await this.app.client.users.fetch(row.user_id).catch(() => null);
            if (user) await user.send({ content: `Reminder: ${row.message}` });
          }
          await this.app.db.execute("UPDATE reminders SET status = 'done' WHERE id = ?", [row.id]);
        } catch {
          await this.app.db.execute("UPDATE reminders SET status = 'failed' WHERE id = ?", [row.id]);
        }
      }
    });
  }

  private scheduleLockdowns(): void {
    for (const preset of this.app.config.channel_locking.presets) {
      for (const sched of preset.schedule) {
        this.addCron(`lockdown-${preset.name}-${sched.action}`, sched.cron, async () => {
          const channelLocking = this.app.lockingService;
          if (sched.action === 'lock') await channelLocking.lock(preset.name);
          else await channelLocking.unlock(preset.name);
        });
      }
    }
  }

  private scheduleAnnouncements(): void {
    this.addCron('announcements', '*/30 * * * * *', async () => {
      const [rows] = await this.app.db.query<RowDataPacket[]>(
        'SELECT id, guild_id, channel_id, content, cron FROM scheduled_announcements WHERE enabled = 1 AND next_run IS NOT NULL AND next_run <= NOW()',
      );
      for (const row of rows) {
        try {
          const channel = this.app.client.channels.cache.get(row.channel_id);
          if (channel && 'send' in channel) {
            const content = parseJson(row.content, {}) as any;
            await channel.send({ content: content.content ?? '', ...(content.components ? { components: content.components } : {}) });
          }
          if (cron.validate(row.cron)) {
            const next = cron.schedule(row.cron, () => undefined);
            const nextRun = next.nextRun();
            await this.app.db.execute('UPDATE scheduled_announcements SET next_run = ? WHERE id = ?', [nextRun, row.id]);
          } else {
            await this.app.db.execute('UPDATE scheduled_announcements SET enabled = 0 WHERE id = ?', [row.id]);
          }
        } catch (err) {
          this.app.logger.warn(`Scheduled announcement ${row.id} failed:`, err);
        }
      }
    });
  }

  private scheduleBackups(): void {
    if (!this.app.config.ops.backups_enabled) return;
    this.addCron('backup', '0 3 * * *', async () => {
      const backup = await import('../management/backup');
      await backup.runBackup(this.app);
    });
  }

  private scheduleSlowmodeRevert(): void {
    const ssm = this.app.slowmodeScheduler;
    ssm.revertLoop();
  }

  private scheduleBirthdays(): void {
    if (!this.app.config.community.birthdays.enabled) return;
    this.addCron('birthdays', '0 9 * * *', async () => {
      const bday = await import('../community/birthdays');
      await bday.announceBirthdays(this.app);
    });
  }

  private scheduleTrustLevels(): void {
    if (!this.app.config.trust_levels.enabled) return;
    this.addCron('trust-levels', '*/10 * * * * *', async () => {
      const trust = await import('../management/trustLevels');
      await trust.checkAll(this.app);
    });
  }
}