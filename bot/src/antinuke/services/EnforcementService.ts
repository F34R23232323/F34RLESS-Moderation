import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits, type GuildMember, type Role } from 'discord.js';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AntiNukeConfig } from '../schemas/config';
import { evaluateFinalSafety, type FinalSafetyContext } from '../policies/invariants';
import type { EnforcementResult, ProposedEnforcement } from '../types/domain';

const dangerousPermissions = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageGuildExpressions, PermissionFlagsBits.ManageEvents, PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.MentionEveryone] as const;

export class EnforcementService {
  public constructor(private readonly db: Pool) {}

  public async enforce(member: GuildMember, incidentId: string, proposal: ProposedEnforcement,
    buildSafetyContext: () => Promise<FinalSafetyContext>): Promise<EnforcementResult> {
    const safetyContext = await buildSafetyContext();
    const safety = evaluateFinalSafety(safetyContext);
    if (!safety.allowed) return { action: proposal.action, targetId: member.id, status: 'suppressed', details: { reason: safety.reason } };
    if (safety.proposal.evidence.auditEntryId !== proposal.evidence.auditEntryId) {
      return { action: proposal.action, targetId: member.id, status: 'suppressed', details: { reason: 'proposal_changed' } };
    }
    const idempotencyKey = `${incidentId}:${member.id}:${proposal.action}`;
    const existing = await this.existingAction(idempotencyKey);
    if (existing) return { action: proposal.action, targetId: member.id, status: 'already_applied', details: { idempotencyKey } };
    const actionId = randomUUID();
    await this.db.execute(
      `INSERT INTO antinuke_enforcement_actions (id, incident_id, guild_id, target_id, action_type, status, idempotency_key, requested_at, result_json)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(3), '{}')`,
      [actionId, incidentId, member.guild.id, member.id, proposal.action, idempotencyKey],
    );
    if (safety.proposal.action === 'alert') return this.finish(actionId, proposal, member.id, 'succeeded', { alertOnly: true });
    if (safety.proposal.action === 'restrict_commands') return this.finish(actionId, proposal, member.id, 'succeeded', { restricted: true });
    try {
      const result = await this.mutate(member, incidentId, safety.proposal.action, safetyContext.config);
      return this.finish(actionId, proposal, member.id, 'succeeded', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown enforcement error';
      await this.db.execute("UPDATE antinuke_enforcement_actions SET status = 'failed', completed_at = NOW(3), error_text = ?, result_json = ? WHERE id = ?",
        [message.slice(0, 1000), JSON.stringify({ error: message }), actionId]);
      return { action: proposal.action, targetId: member.id, status: 'failed', details: { error: message } };
    }
  }

  private async mutate(member: GuildMember, incidentId: string, action: ProposedEnforcement['action'], config: AntiNukeConfig): Promise<Record<string, unknown>> {
    if (action === 'quarantine' || action === 'remove_dangerous_roles') {
      const manageable = member.roles.cache.filter((role) => this.isManageable(role, member));
      await this.db.execute('INSERT INTO antinuke_role_snapshots (id, guild_id, incident_id, member_id, roles_json) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), member.guild.id, incidentId, member.id, JSON.stringify(manageable.map((role) => role.id))]);
      const dangerous = manageable.filter((role) => dangerousPermissions.some((permission) => role.permissions.has(permission)));
      const removed: string[] = [];
      for (const role of dangerous.values()) {
        await member.roles.remove(role, `Anti-nuke incident ${incidentId}`);
        removed.push(role.id);
      }
      if (action === 'quarantine') {
        if (!config.quarantineRoleId) throw new Error('Quarantine role is not configured');
        const quarantineRole = member.guild.roles.cache.get(config.quarantineRoleId);
        if (!quarantineRole || !this.isManageable(quarantineRole, member)) throw new Error('Quarantine role is missing or unmanageable');
        if (quarantineRole.permissions.bitfield !== 0n) throw new Error('Quarantine role grants permissions');
        await member.roles.add(quarantineRole, `Anti-nuke incident ${incidentId}: pending review`);
        return { removedRoleIds: removed, quarantineRoleId: quarantineRole.id };
      }
      return { removedRoleIds: removed };
    }
    if (action === 'timeout') {
      await member.timeout(60 * 60 * 1000, `Anti-nuke incident ${incidentId}`);
      return { timeoutMs: 3_600_000 };
    }
    if (action === 'kick') { await member.kick(`Anti-nuke incident ${incidentId}`); return { kicked: true }; }
    if (action === 'ban') { await member.ban({ reason: `Anti-nuke incident ${incidentId}` }); return { banned: true }; }
    throw new Error(`Unsupported enforcement action: ${action}`);
  }

  private isManageable(role: Role, member: GuildMember): boolean {
    return role.id !== member.guild.id && !role.managed && role.editable && role.position < (member.guild.members.me?.roles.highest.position ?? 0);
  }

  private async existingAction(idempotencyKey: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT 1 FROM antinuke_enforcement_actions WHERE idempotency_key = ? LIMIT 1', [idempotencyKey]);
    return rows.length > 0;
  }

  private async finish(actionId: string, proposal: ProposedEnforcement, targetId: string, status: 'succeeded', details: Record<string, unknown>): Promise<EnforcementResult> {
    await this.db.execute("UPDATE antinuke_enforcement_actions SET status = ?, completed_at = NOW(3), result_json = ? WHERE id = ?", [status, JSON.stringify(details), actionId]);
    return { action: proposal.action, targetId, status, details };
  }
}
