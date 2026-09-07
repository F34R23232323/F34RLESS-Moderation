import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits, type Guild } from 'discord.js';
import type { App } from '../../core/context';
import { evaluateFinalSafety } from '../policies/invariants';
import { protectionRegistry } from '../policies/registry';
import type { SecurityEvent, TargetType } from '../types/domain';
import { AuditAttributionService } from './AuditAttributionService';
import { AuthorizationService } from './AuthorizationService';
import { ConfigService } from './ConfigService';
import { DistributedLockService, type LockRedis } from './DistributedLockService';
import { EnforcementService } from './EnforcementService';
import { IncidentService } from './IncidentService';
import { RiskScoringService } from './RiskScoringService';
import { ThresholdService } from './ThresholdService';

export interface ObserveInput {
  readonly guild: Guild;
  readonly type: SecurityEvent['type'];
  readonly targetType: TargetType;
  readonly targetId: string;
  readonly before?: Readonly<Record<string, unknown>> | null;
  readonly after?: Readonly<Record<string, unknown>> | null;
  readonly observedAtMs?: number;
}

export class AntiNukeService {
  private readonly config: ConfigService;
  private readonly attribution: AuditAttributionService;
  private readonly authorization: AuthorizationService;
  private readonly thresholds: ThresholdService;
  private readonly risks = new RiskScoringService();
  private readonly incidents: IncidentService;
  private readonly enforcement: EnforcementService;
  private readonly locks: DistributedLockService;

  public constructor(private readonly app: App, redis: LockRedis | null, private readonly startedAtMs = Date.now()) {
    this.config = new ConfigService(app.db);
    this.attribution = new AuditAttributionService(app.db);
    this.authorization = new AuthorizationService(app.db, () => app.client.user?.id ?? null);
    this.thresholds = new ThresholdService(redis);
    this.incidents = new IncidentService(app.db, `${process.pid}`);
    this.enforcement = new EnforcementService(app.db);
    this.locks = new DistributedLockService(redis);
  }

  public getConfig(guildId: string) { return this.config.get(guildId); }

  public async updateConfig(guild: Guild, actorId: string, expectedVersion: number, input: unknown, action: string) {
    if (!await this.authorization.isRootOwner(guild, actorId) && ['enable', 'disable', 'automatic_ban', 'pending_review_mute', 'ownership'].includes(action)) {
      throw new Error('Only the current Discord guild owner can perform this action');
    }
    return this.config.update(guild.id, actorId, expectedVersion, input, action);
  }

  public async observe(input: ObserveInput): Promise<void> {
    const event: SecurityEvent = { eventId: randomUUID(), guildId: input.guild.id, type: input.type,
      targetType: input.targetType, targetId: input.targetId, observedAtMs: input.observedAtMs ?? Date.now(),
      shardId: input.guild.shardId, gatewaySequence: null, before: input.before ?? null, after: input.after ?? null };
    const loaded = await this.config.get(event.guildId);
    if (!loaded.config.enabled || !loaded.config.setupCompletedAt) return;
    const definition = protectionRegistry.get(event.type);
    if (!definition) return;
    let attribution;
    try {
      attribution = await this.attribution.attribute(input.guild, event, loaded.config);
    } catch (error) {
      await this.recordUnresolved(event, loaded.version, error);
      return;
    }
    if (attribution.status !== 'confirmed') {
      await this.incidents.recordEvent(event, attribution, null, null, loaded.version);
      return;
    }
    const trust = await this.authorization.trustDecision(input.guild, attribution.executorId, event.type);
    if (trust.trusted || definition.defaultPolicy.monitorOnly) {
      await this.incidents.recordEvent(event, { ...attribution, status: 'trusted', reason: trust.trusted ? trust.reason : 'monitor_only' }, null, null, loaded.version);
      return;
    }
    const threshold = await this.thresholds.record(event, attribution.executorId, definition.defaultPolicy);
    const risk = this.risks.calculate(event, threshold);
    const correlationId = await this.incidents.recordEvent(event, attribution, threshold, risk, loaded.version);
    if (!threshold.crossed || threshold.reason === 'dependency_unavailable') return;
    const proposedAction = definition.defaultPolicy.defaultAction;
    const proposal = { action: proposedAction, executorId: attribution.executorId, reason: `${event.type} rolling threshold crossed`,
      evidence: attribution.evidence, threshold, risk } as const;
    const initial = evaluateFinalSafety({ config: loaded.config, attribution, trust, proposal,
      databaseAvailable: true, redisAvailable: true, auditLogAvailable: true,
      warmupComplete: Date.now() - this.startedAtMs >= loaded.config.startupWarmupSeconds * 1000,
      incidentAlreadyHandled: false, currentGuildOwnerId: input.guild.ownerId, botUserId: this.app.client.user?.id ?? '' });
    if (!initial.allowed) return;
    const lock = await this.locks.acquire(event.guildId, attribution.executorId);
    if (!lock) return;
    try {
      const member = await input.guild.members.fetch(attribution.executorId).catch(() => null);
      if (!member) return;
      const incidentId = await this.incidents.open(event, attribution.executorId, risk, loaded.version, correlationId);
      await this.enforcement.enforce(member, incidentId, proposal, async () => {
        const current = await this.config.get(event.guildId);
        const currentTrust = await this.authorization.trustDecision(input.guild, attribution.executorId, event.type);
        return { config: current.config, attribution, trust: currentTrust, proposal,
          databaseAvailable: true, redisAvailable: true,
          auditLogAvailable: input.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog) ?? false,
          warmupComplete: Date.now() - this.startedAtMs >= current.config.startupWarmupSeconds * 1000,
          incidentAlreadyHandled: false, currentGuildOwnerId: input.guild.ownerId, botUserId: this.app.client.user?.id ?? '' };
      });
    } finally {
      await lock.release();
    }
  }

  private async recordUnresolved(event: SecurityEvent, configVersion: number, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : 'Audit attribution failed';
    await this.incidents.recordEvent(event, { status: 'unresolved', reason, candidates: [] }, null, null, configVersion)
      .catch((persistenceError: unknown) => this.app.logger.error('Failed to persist anti-nuke unresolved event', persistenceError));
    this.app.logger.warn(`Anti-nuke alert-only: ${reason}`);
  }
}
