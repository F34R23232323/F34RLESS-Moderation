import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';
import type { PunishOptions } from '../moderation/punishmentManager';

interface PendingRequest {
  id: number;
  source: string;
  guild_id: string;
  type: string;
  user_id: string;
  reason: string;
  duration_ms: number | null;
  delete_message_days: number | null;
  evidence: string | null;
}

/**
 * Executes queued punishment requests created by external bots via the HTTP
 * API (POST /api/v1/punish with action=execute). Each request is performed as
 * a native Discord action through PunishmentManager (creating a case + log),
 * then marked done/failed.
 */
export class ApiCaseService {
  private readonly app: App;
  /** In-flight guard so overlapping cron ticks can't double-execute rows. */
  private processing = false;

  constructor(app: App) {
    this.app = app;
  }

  public async processPending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.processPendingInner();
    } finally {
      this.processing = false;
    }
  }

  private async processPendingInner(): Promise<void> {
    // Recover rows stranded by a crash mid-execution (>5 min in 'processing').
    await this.app.db.execute(
      "UPDATE api_case_requests SET status = 'pending', processed_at = NULL WHERE status = 'processing' AND processed_at < NOW() - INTERVAL 5 MINUTE",
    );
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      "SELECT id, source, guild_id, type, user_id, reason, duration_ms, delete_message_days, evidence FROM api_case_requests WHERE status = 'pending' ORDER BY id ASC LIMIT 20",
    );
    for (const raw of rows) {
      const req = raw as unknown as PendingRequest;
      // Claim the row atomically — a racing tick (or another process) that
      // already claimed it sees affectedRows === 0 and skips.
      const [claim] = await this.app.db.execute(
        "UPDATE api_case_requests SET status = 'processing', processed_at = NOW() WHERE id = ? AND status = 'pending'",
        [req.id],
      );
      if ((claim as { affectedRows: number }).affectedRows === 0) continue;
      try {
        const caseRow = await this.execute(req);
        await this.app.db.execute(
          "UPDATE api_case_requests SET status = 'done', case_id = ?, processed_at = NOW() WHERE id = ?",
          [caseRow ? caseRow.id : null, req.id],
        );
      } catch (err) {
        const message = (err as Error).message.slice(0, 1000);
        await this.app.db.execute(
          "UPDATE api_case_requests SET status = 'failed', error = ?, processed_at = NOW() WHERE id = ?",
          [message, req.id],
        );
        this.app.logger.warn(`API case request ${req.id} (${req.type} @${req.guild_id}) failed:`, err);
        await this.app.logManager.log({
          event: 'moderation_action',
          guildId: req.guild_id,
          targetId: req.user_id,
          message: `API (${req.source}): punishment ${req.type} failed — ${message}`,
          details: { type: req.type, source: req.source, error: message },
        });
      }
    }
  }

  private async execute(req: PendingRequest): Promise<{ id: number; case_code: string } | null> {
    const guild = this.app.client.guilds.cache.get(req.guild_id);
    if (!guild) {
      throw new Error('bot is not in the target guild');
    }

    if (await this.app.whitelist.isWhitelisted(req.guild_id, req.user_id, 'api')) {
      throw new Error('target user is whitelisted from API punishments');
    }

    const evidence = req.evidence ? parseJson(req.evidence, undefined) : undefined;
    const opts: PunishOptions = {
      reason: req.reason || 'No reason provided',
      durationMs: req.duration_ms,
      moderatorId: null,
      evidence: Array.isArray(evidence) ? (evidence as unknown[]) : undefined,
      deleteMessageDays: req.delete_message_days ?? undefined,
    };

    const member = await guild.members.fetch(req.user_id).catch(() => null);
    let user = member?.user ?? null;
    if (!user) {
      user = await this.app.client.users.fetch(req.user_id).catch(() => null);
    }

    let result;
    switch (req.type) {
      case 'warn':
        if (!member) throw new Error('target is not a member of the guild');
        result = await this.app.punishmentManager.warn(member, opts);
        break;
      case 'mute':
      case 'timeout': {
        if (!member) throw new Error('target is not a member of the guild');
        const logEvent = req.type === 'mute' ? 'member_mute' : 'member_timeout';
        result = await this.app.punishmentManager.timeout(member, req.duration_ms ?? 3600000, {
          ...opts,
          logEvent,
        });
        break;
      }
      case 'kick':
        if (!member) throw new Error('target is not a member of the guild');
        result = await this.app.punishmentManager.kick(member, opts);
        break;
      case 'ban':
        if (!user) throw new Error('could not resolve target user');
        result = await this.app.punishmentManager.ban(member ?? user, opts);
        break;
      case 'softban':
        if (!user) throw new Error('could not resolve target user');
        result = await this.app.punishmentManager.softban(member ?? user, opts);
        break;
      case 'unban':
        result = await this.app.punishmentManager.unban(guild, req.user_id, opts);
        break;
      case 'unmute':
        if (!member) throw new Error('target is not a member of the guild');
        result = await this.app.punishmentManager.unmute(member, opts);
        break;
      default:
        throw new Error(`unsupported punishment type: ${req.type}`);
    }

    if (!result.ok) {
      throw new Error(result.error ?? 'punishment failed');
    }

    if (!result.case) {
      throw new Error('no case was created');
    }

    // Attribute the action to the external bot source.
    await this.app.logManager.log({
      event: 'moderation_action',
      guildId: guild.id,
      actorId: null,
      targetId: req.user_id,
      message: `API (${req.source}): performed ${req.type} on <@${req.user_id}> (case ${result.case.case_code})`,
      details: { type: req.type, source: req.source, caseCode: result.case.case_code, reason: opts.reason },
    });

    return { id: result.case.id, case_code: result.case.case_code };
  }
}
