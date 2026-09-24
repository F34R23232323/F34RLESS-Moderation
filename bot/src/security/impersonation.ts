import type { RowDataPacket } from 'mysql2/promise';
import { AuditLogEvent, type Guild, type GuildMember } from 'discord.js';
import type { App } from '../core/context';
import { parseDuration } from '../../../shared/src/index';
import { buildRichV2 } from '../utils/v2';
import { notificationDmGuard } from '../moderation/notificationDmGuard';

/** Hardcoded so a scan can never be tuned into a gateway/REST rate-limit problem. */
const SCAN_INTERVAL_MS = 30 * 60 * 1000;

export type ImpersonationTrigger = 'join' | 'nick_change' | 'username_change' | 'scan' | 'manual';
export type ImpersonationAction = 'warn' | 'mute' | 'kick' | 'ban';

export interface ImpersonationMatch {
  kind: 'member' | 'server_name';
  /** Member being impersonated (null when the match is the server name). */
  matchedUserId: string | null;
  /** Raw name on the other side that was matched. */
  matchedName: string;
  /** Raw name of the checked member that caused the match. */
  subjectName: string;
}

export interface ImpersonationResult {
  targetId: string;
  match: ImpersonationMatch;
  trigger: ImpersonationTrigger;
  action: ImpersonationAction;
  offense: number;
  nicknameReset: boolean;
  applied: boolean;
  caseCode: string | null;
  error: string | null;
}

export interface NameCandidate {
  id: string;
  names: Array<string | null | undefined>;
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    // Strip invisible/format characters (ZWSP, ZWJ, ZWNJ, bidi marks, BOM...)
    // and variation selectors so lookalike evasion still counts as a match.
    .replace(/[\p{Cf}\u200B]/gu, '')
    .replace(/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '')
    // Collapse whitespace runs so "Angel  <emoji>" matches "Angel <emoji>".
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normalized reset marker — a scrubbed nickname is never an impersonation signal. */
function resetMarkerNorm(app: App): string {
  const marker = app.config.anti_impersonation.reset_nickname;
  return marker.trim().length === 0 ? '' : normalizeName(marker);
}

/** Member names with the reset marker removed so scrubbed users can't match each other or re-trigger. */
function matchableNames(member: GuildMember, markerNorm: string): Array<string | null | undefined> {
  const names: Array<string | null | undefined> = [member.nickname, member.user.displayName, member.user.username];
  if (markerNorm.length === 0) return names;
  return names.map((n) => (typeof n === 'string' && normalizeName(n) === markerNorm ? null : n));
}

/**
 * Compare a member's names against every other member's names (and the server
 * name). Comparison is NFKC-normalized, trimmed and case-insensitive so trivial
 * casing/width tricks do not slip past an "exact same name" check.
 */
export function findImpersonationMatch(
  subjectNames: Array<string | null | undefined>,
  candidates: NameCandidate[],
  guildName: string,
  options: { matchMemberNames: boolean; matchServerName: boolean },
): ImpersonationMatch | null {
  const subject = subjectNames
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map((raw) => ({ raw, norm: normalizeName(raw) }))
    .filter((n) => n.norm.length > 0)
    .filter((n, i, arr) => arr.findIndex((x) => x.norm === n.norm) === i);
  if (subject.length === 0) return null;

  if (options.matchMemberNames) {
    for (const candidate of candidates) {
      const names = candidate.names
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((raw) => ({ raw, norm: normalizeName(raw) }))
        .filter((n) => n.norm.length > 0);
      for (const s of subject) {
        const hit = names.find((n) => n.norm === s.norm);
        if (hit) {
          return { kind: 'member', matchedUserId: candidate.id, matchedName: hit.raw, subjectName: s.raw };
        }
      }
    }
  }

  if (options.matchServerName && guildName.trim().length > 0) {
    const norm = normalizeName(guildName);
    const hit = norm.length > 0 ? subject.find((s) => s.norm === norm) : undefined;
    if (hit) {
      return { kind: 'server_name', matchedUserId: null, matchedName: guildName, subjectName: hit.raw };
    }
  }

  return null;
}

export interface ScanMemberInput {
  id: string;
  /** joinedAt in ms; 0 when unknown — unknown joiners sort as oldest. */
  joinedAt: number;
  names: Array<string | null | undefined>;
}

export interface ScanCollision {
  norm: string;
  /** Members holding the same normalized name besides the earliest joiner. */
  offenderIds: string[];
  /** The earliest joiner — treated as the original holder of the name. */
  counterpartId: string;
}

/**
 * Group members by normalized name; every member that joined after the first
 * holder of a name is the impersonator. Server-name matches are deliberately
 * not enforced by scans (event triggers cover those) to avoid mass actions on
 * members whose name merely resembles the server's.
 */
export function findScanCollisions(members: ScanMemberInput[]): ScanCollision[] {
  const groups = new Map<string, Array<{ id: string; joinedAt: number }>>();
  for (const member of members) {
    const seen = new Set<string>();
    for (const name of member.names) {
      if (typeof name !== 'string' || name.trim().length === 0) continue;
      const norm = normalizeName(name);
      if (norm.length === 0 || seen.has(norm)) continue;
      seen.add(norm);
      const group = groups.get(norm) ?? [];
      group.push({ id: member.id, joinedAt: member.joinedAt });
      groups.set(norm, group);
    }
  }

  const collisions: ScanCollision[] = [];
  for (const [norm, entries] of groups) {
    const byId = new Map<string, number>();
    for (const e of entries) byId.set(e.id, Math.min(byId.get(e.id) ?? Infinity, e.joinedAt));
    if (byId.size < 2) continue;
    const sorted = [...byId.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const [counterpartId] = sorted[0];
    const offenderIds = sorted.slice(1).map(([id]) => id);
    collisions.push({ norm, offenderIds, counterpartId });
  }
  return collisions;
}

/**
 * Who arrived at the colliding name later (and is therefore the impersonator)?
 * Returns the later id, or null on a tie / equal knowledge.
 */
export function laterArrival(
  a: { id: string; arrivalMs: number },
  b: { id: string; arrivalMs: number },
): string | null {
  if (a.arrivalMs === b.arrivalMs) return null;
  return a.arrivalMs > b.arrivalMs ? a.id : b.id;
}

/**
 * Map of `${userId}:${normalizedNickname}` -> timestamp of the most recent
 * audit-logged nickname change to that name. Discord does not audit username
 * or global-name changes, so those never appear — callers fall back to join
 * time for them. Returns an empty map when the audit log is unavailable
 * (missing View Audit Log permission).
 */
export async function fetchNickRenameTimes(app: App, guild: Guild): Promise<Map<string, number>> {
  const times = new Map<string, number>();
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 100 });
    for (const entry of logs.entries.values()) {
      if (!entry.targetId) continue;
      const change = entry.changes.find((c) => c.key === 'nick');
      if (change?.new == null) continue;
      const key = `${entry.targetId}:${normalizeName(String(change.new))}`;
      const prev = times.get(key);
      if (prev === undefined || entry.createdTimestamp > prev) times.set(key, entry.createdTimestamp);
    }
  } catch (err) {
    app.logger.debug(`impersonation audit lookup failed: ${(err as Error).message}`);
  }
  return times;
}

/** Arrival at the colliding name: an audit-logged rename to it when known, otherwise the join time. */
function nameArrivalMs(
  renameTimes: Map<string, number>,
  member: GuildMember,
  norm: string,
): number {
  return renameTimes.get(`${member.id}:${norm}`) ?? member.joinedAt?.getTime() ?? 0;
}

function describeMatch(match: ImpersonationMatch): string {
  return match.kind === 'member'
    ? `matches the name of <@${match.matchedUserId}> ("${match.matchedName}")`
    : `matches the server name ("${match.matchedName}")`;
}

function describeMatchPlain(match: ImpersonationMatch): string {
  return match.kind === 'member'
    ? `matches the name of ${match.matchedUserId} ("${match.matchedName}")`
    : `matches the server name ("${match.matchedName}")`;
}

const TRIGGER_LABEL: Record<ImpersonationTrigger, string> = {
  join: 'joining the server',
  nick_change: 'changing their nickname',
  username_change: 'changing their username',
  scan: 'a routine name scan',
  manual: 'a manual staff check',
};

async function sendGuardedV2Dm(
  app: App,
  userId: string,
  guardKey: string,
  payload: { components: unknown[]; flags: number },
): Promise<boolean> {
  const cooldown = app.config.punishment_dms.cooldown_seconds;
  if (!notificationDmGuard.allow(userId, guardKey, 3, cooldown)) return false;
  try {
    const user = await app.client.users.fetch(userId);
    const dm = await user.createDM();
    await dm.send({ ...payload } as never);
    return true;
  } catch {
    notificationDmGuard.release(userId, guardKey);
    return false;
  }
}

/** Why a member is exempt from anti-impersonation enforcement, or null when not exempt.
 *  Only the configured exempt roles, the bot, and the server owner exempt — whitelist
 *  entries deliberately do NOT exempt from this module. */
export async function impersonationExemption(app: App, member: GuildMember): Promise<string | null> {
  if (member.user.bot) return 'bot account';
  if (member.id === member.guild.ownerId) return 'server owner';

  const exemptRole = app.config.anti_impersonation.exempt_role_ids.find((roleId) => member.roles.cache.has(roleId));
  if (exemptRole) {
    const role = member.guild.roles.cache.get(exemptRole);
    return role ? `configured exempt role "${role.name}"` : `configured exempt role ${exemptRole}`;
  }

  return null;
}

export async function isImpersonationExempt(app: App, member: GuildMember): Promise<boolean> {
  return (await impersonationExemption(app, member)) !== null;
}

/** One enforcement per (guild, user) at a time — a scan and a re-fired nick_change event can race. */
const enforcementInFlight = new Set<string>();

async function enforceImpersonation(
  app: App,
  member: GuildMember,
  trigger: ImpersonationTrigger,
  match: ImpersonationMatch,
): Promise<ImpersonationResult | null> {
  const flightKey = `${member.guild.id}:${member.id}`;
  if (enforcementInFlight.has(flightKey)) return null;
  enforcementInFlight.add(flightKey);
  try {
    return await runEnforcement(app, member, trigger, match);
  } finally {
    enforcementInFlight.delete(flightKey);
  }
}

async function runEnforcement(
  app: App,
  member: GuildMember,
  trigger: ImpersonationTrigger,
  match: ImpersonationMatch,
): Promise<ImpersonationResult> {
  const cfg = app.config.anti_impersonation;
  const guild = member.guild;

  const [countRows] = await app.db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM cases WHERE guild_id = ? AND user_id = ? AND reason LIKE 'Anti-impersonation%'",
    [guild.id, member.id],
  );
  const offense = Number(countRows[0]?.count ?? 0) + 1;
  const action = cfg.actions[Math.min(offense, cfg.actions.length) - 1];

  const resetTo = cfg.reset_nickname.trim() === '' ? null : cfg.reset_nickname;
  let nicknameReset = true;
  if (member.nickname !== resetTo) {
    nicknameReset = await member
      .setNickname(resetTo, 'Anti-impersonation: exact name match')
      .then(() => true)
      .catch(() => false);
  }

  const durationMs = action === 'mute' ? (parseDuration(cfg.mute_duration)?.milliseconds ?? 3600000) : undefined;
  let applied = false;
  let caseCode: string | null = null;
  let actionError: string | null = null;
  try {
    const result = await app.punishmentManager.applyFromAction(guild, action, member, {
      reason: `Anti-impersonation: ${describeMatchPlain(match)}`,
      moderatorId: app.client.user?.id ?? null,
      durationMs,
    });
    applied = result.ok;
    caseCode = result.case?.case_code ?? null;
    actionError = result.ok ? null : (result.error ?? 'punishment failed');
  } catch (err) {
    actionError = err instanceof Error ? err.message : String(err);
  }

  await app.logManager.log({
    event: 'impersonation_detected',
    guildId: guild.id,
    targetId: member.id,
    message: `Impersonation detected: <@${member.id}> used "${match.subjectName}" — ${describeMatchPlain(match)}`,
    details: {
      trigger,
      usedName: match.subjectName,
      matchedName: match.matchedName,
      ...(match.matchedUserId ? { matchedUserId: match.matchedUserId } : {}),
      resetNickname: nicknameReset ? (resetTo ?? '(cleared)') : 'failed (role hierarchy)',
      action,
      count: offense,
      ...(caseCode ? { caseCode } : {}),
      ...(actionError ? { failed: actionError } : {}),
    },
  });

  const actionLine = caseCode
    ? `**${action}** — offense #${offense} (case ${caseCode})`
    : applied
      ? `**${action}** — offense #${offense}`
      : `**${action}** — offense #${offense} (not applied: ${actionError ?? 'failed'})`;

  if (cfg.notify_user) {
    const offenderDm = buildRichV2({
      accentColor: 0xed4245,
      header: 'Impersonation detected',
      text: [
        `Your name in **${guild.name}** was flagged for impersonation.`,
        '',
        '**What happened**',
        `• Name used: \`${match.subjectName}\``,
        `• It ${describeMatch(match)}`,
        '',
        '**Actions taken**',
        `• Nickname: ${nicknameReset ? `reset to **${resetTo ?? 'no nickname'}**` : 'could not be reset (role hierarchy)'}`,
        `• Moderation: ${actionLine}`,
        '',
        'If you believe this is a mistake, contact the staff team.',
      ].join('\n'),
      footer: `${guild.name} • detected by ${TRIGGER_LABEL[trigger]}`,
    });
    await sendGuardedV2Dm(app, member.id, `impersonation:offender:${guild.id}:${offense}`, offenderDm);
  }

  if (cfg.notify_target && match.kind === 'member' && match.matchedUserId) {
    const victimDm = buildRichV2({
      accentColor: 0xf0b232,
      header: 'Someone impersonated you',
      text: [
        `A user in **${guild.name}** was using the exact same name as you.`,
        '',
        '**What happened**',
        `• User: <@${member.id}> (\`${member.user.username}\`)`,
        `• Name used: \`${match.matchedName}\``,
        `• Detected: ${TRIGGER_LABEL[trigger]}`,
        '',
        '**Actions taken**',
        `• Their nickname: ${nicknameReset ? `reset to **${resetTo ?? 'no nickname'}**` : 'reset attempted (failed)'}`,
        `• Moderation: ${actionLine}`,
        '',
        'If you are being harassed, contact the staff team.',
      ].join('\n'),
      footer: `${guild.name} • anti-impersonation`,
    });
    await sendGuardedV2Dm(
      app,
      match.matchedUserId,
      `impersonation:victim:${guild.id}:${member.id}:${offense}`,
      victimDm,
    );
  }

  return {
    targetId: member.id,
    match,
    trigger,
    action,
    offense,
    nicknameReset,
    applied,
    caseCode,
    error: actionError,
  };
}

/**
 * Event-driven check (join / nickname change / username change).
 *
 * The event itself identifies who just moved onto the name — for a nickname
 * or username change the actor's change is by definition the most recent
 * arrival, and a joiner arrives after everyone already in the guild — so no
 * audit lookup is needed here; scans and manual checks do the audit lookup
 * because they have no event to tell them who moved.
 */
export async function runImpersonationCheck(
  app: App,
  member: GuildMember,
  trigger: ImpersonationTrigger,
): Promise<void> {
  try {
    const cfg = app.config.anti_impersonation;
    if (!cfg.enabled) return;
    if (trigger === 'join' && !cfg.check_on_join) return;
    if (trigger === 'nick_change' && !cfg.check_on_nick_change) return;
    if (trigger === 'username_change' && !cfg.check_on_username_change) return;
    if (await isImpersonationExempt(app, member)) return;

    const markerNorm = resetMarkerNorm(app);
    // The displayed name is already scrubbed (our own reset fired this event) —
    // re-checking would punish the same user again for a username we cannot change.
    if (
      trigger === 'nick_change' &&
      markerNorm.length > 0 &&
      member.nickname &&
      normalizeName(member.nickname) === markerNorm
    ) {
      return;
    }

    const guild = member.guild;
    if (guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch().catch(() => undefined);
    }

    const candidates: NameCandidate[] = [];
    for (const other of guild.members.cache.values()) {
      if (other.id === member.id || other.user.bot) continue;
      candidates.push({ id: other.id, names: matchableNames(other, markerNorm) });
    }

    const match = findImpersonationMatch(
      matchableNames(member, markerNorm),
      candidates,
      guild.name,
      { matchMemberNames: cfg.match_member_names, matchServerName: cfg.match_server_name },
    );
    if (!match) return;

    await enforceImpersonation(app, member, trigger, match);
  } catch (err) {
    app.logger.error(`impersonation check (${trigger}) threw:`, err);
  }
}

/** Explicit staff check of one member — runs even when the feature is disabled. */
export async function checkMemberManually(
  app: App,
  member: GuildMember,
): Promise<{ result: ImpersonationResult | null; exemption: { targetId: string; reason: string } | null }> {
  const earlyExemption = await impersonationExemption(app, member);
  if (earlyExemption) return { result: null, exemption: { targetId: member.id, reason: earlyExemption } };

  const markerNorm = resetMarkerNorm(app);
  const guild = member.guild;
  if (guild.members.cache.size < guild.memberCount) {
    await guild.members.fetch().catch(() => undefined);
  }

  const candidates: NameCandidate[] = [];
  for (const other of guild.members.cache.values()) {
    if (other.id === member.id || other.user.bot) continue;
    candidates.push({ id: other.id, names: matchableNames(other, markerNorm) });
  }

  const match = findImpersonationMatch(
    matchableNames(member, markerNorm),
    candidates,
    guild.name,
    { matchMemberNames: true, matchServerName: true },
  );
  if (!match) return { exemption: null, result: null };

  // Resolve who actually arrived at the name later — the audit log may show
  // the *other* member renamed onto it most recently, making them the
  // impersonator instead of the member that was checked.
  let offender = member;
  let effectiveMatch = match;
  if (match.kind === 'member' && match.matchedUserId) {
    const counterpart = guild.members.cache.get(match.matchedUserId);
    if (counterpart) {
      const renameTimes = await fetchNickRenameTimes(app, guild);
      const norm = normalizeName(match.matchedName);
      const later = laterArrival(
        { id: member.id, arrivalMs: nameArrivalMs(renameTimes, member, norm) },
        { id: counterpart.id, arrivalMs: nameArrivalMs(renameTimes, counterpart, norm) },
      );
      if (later === counterpart.id) {
        offender = counterpart;
        effectiveMatch = {
          kind: 'member',
          matchedUserId: member.id,
          matchedName: match.subjectName,
          subjectName: match.matchedName,
        };
      }
    }
  }

  const offenderExemption = await impersonationExemption(app, offender);
  if (offenderExemption) {
    return { result: null, exemption: { targetId: offender.id, reason: offenderExemption } };
  }
  return { exemption: null, result: await enforceImpersonation(app, offender, 'manual', effectiveMatch) };
}

export interface ScanReport {
  results: ImpersonationResult[];
  /** Members actually examined (may be below guild.memberCount if the cache fetch failed). */
  scanned: number;
  /** Collisions that were detected but not actioned because the offender is exempt. */
  exemptSkipped: Array<{ targetId: string; matchedUserId: string | null; matchedName: string; reason: string }>;
}

/** Full-guild name collision scan. Returns the results that were enforced. */
export async function scanGuild(
  app: App,
  guild: Guild,
  opts: { force?: boolean } = {},
): Promise<ScanReport> {
  const report: ScanReport = { results: [], scanned: 0, exemptSkipped: [] };
  try {
    const cfg = app.config.anti_impersonation;
    if (!cfg.enabled && !opts.force) return report;

    if (guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch().catch(() => undefined);
    }

    const markerNorm = resetMarkerNorm(app);
    const inputs: ScanMemberInput[] = [];
    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;
      inputs.push({
        id: member.id,
        joinedAt: member.joinedAt?.getTime() ?? 0,
        names: matchableNames(member, markerNorm),
      });
    }
    report.scanned = guild.members.cache.size;

    const collisions = findScanCollisions(inputs);
    if (collisions.length === 0) return report;

    // One audit fetch per scan; pairs whose arrival it can't resolve fall back
    // to the join-date order produced by findScanCollisions.
    const renameTimes = await fetchNickRenameTimes(app, guild);

    const handled = new Set<string>();
    for (const collision of collisions) {
      const counterpart = guild.members.cache.get(collision.counterpartId);
      if (!counterpart) continue;
      for (const offenderId of collision.offenderIds) {
        if (handled.has(offenderId)) continue;
        const offender = guild.members.cache.get(offenderId);
        if (!offender) continue;

        const match = findImpersonationMatch(
          matchableNames(offender, markerNorm),
          [{ id: counterpart.id, names: matchableNames(counterpart, markerNorm) }],
          guild.name,
          { matchMemberNames: true, matchServerName: false },
        );
        if (!match) continue;

        // The member who arrived at the name later is the impersonator; only
        // the audit log can reveal that the earliest joiner copied a newer
        // member by renaming onto their name.
        let effective = offender;
        let effectiveMatch = match;
        const later = laterArrival(
          { id: offender.id, arrivalMs: nameArrivalMs(renameTimes, offender, collision.norm) },
          { id: counterpart.id, arrivalMs: nameArrivalMs(renameTimes, counterpart, collision.norm) },
        );
        if (later === counterpart.id) {
          effective = counterpart;
          effectiveMatch = {
            kind: 'member',
            matchedUserId: offender.id,
            matchedName: match.subjectName,
            subjectName: match.matchedName,
          };
        }

        if (handled.has(effective.id)) continue;
        handled.add(effective.id);
        const exemption = await impersonationExemption(app, effective);
        if (exemption) {
          report.exemptSkipped.push({
            targetId: effective.id,
            matchedUserId: effectiveMatch.matchedUserId,
            matchedName: effectiveMatch.matchedName,
            reason: exemption,
          });
          continue;
        }

        const enforced = await enforceImpersonation(app, effective, 'scan', effectiveMatch);
        if (enforced) report.results.push(enforced);
      }
    }
  } catch (err) {
    app.logger.error('impersonation scan threw:', err);
  }
  return report;
}

let scanRunning = false;

export function startImpersonationScans(app: App): void {
  setInterval(() => {
    if (!app.config.anti_impersonation.enabled || scanRunning) return;
    scanRunning = true;
    void (async () => {
      try {
        for (const guild of app.client.guilds.cache.values()) {
          await scanGuild(app, guild);
        }
      } catch (err) {
        app.logger.error('scheduled impersonation scan threw:', err);
      } finally {
        scanRunning = false;
      }
    })();
  }, SCAN_INTERVAL_MS).unref?.();
}
