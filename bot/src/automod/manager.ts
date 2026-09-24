import type { TextChannel, GuildMember, Message } from 'discord.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import type { App } from '../core/context';
import { DEFAULT_ACTION_CHAIN } from '../../../shared/src/index';
import { ActionChainExecutor } from './chainExecutor';
import { ResponseThrottle } from './responseThrottle';

export interface ModuleContext {
  app: App;
  member: GuildMember;
  message?: Message | null;
  channel?: TextChannel | null;
  content: string;
}

export interface AutomodHit {
  module: string;
  rule: string;
  reason: string;
  content: string;
  action_chain?: unknown[];
  suppress_repeat_response_seconds?: number;
  suppressed_response_mode?: 'silent' | 'batched_summary';
  purge_message_ids?: string[];
  suppress_actions?: boolean;
  /** User IDs to DM with an explanation after the action chain executes (e.g. mass-ping victims). */
  dm_mentioned_users?: string[];
}

export interface AutomodModule {
  name: string;
  check: (ctx: ModuleContext) => Promise<AutomodHit | null>;
}

export class AutomodManager {
  private readonly app: App;
  public readonly executor: ActionChainExecutor;
  public readonly throttle: ResponseThrottle;
  private modules: AutomodModule[] = [];
  private readonly joinModules = new Map<string, AutomodModule>();
  /** Per-user-per-rule last action timestamp — used to skip repeat warn/DM actions. */
  private readonly recentActions = new Map<string, number>();
  /** Per-target-user last ping-DM timestamp — prevents the same user being
   *  DM'd about pings more than once within this window. */
  private readonly recentPingedDms = new Map<string, number>();
  /** Pending spam purges, debounced per channel until the message burst is quiet. */
  private readonly pendingPurges = new Map<string, { ids: Set<string>; timer: NodeJS.Timeout }>();
  private static readonly DM_COOLDOWN_MS = 120_000;

  constructor(app: App) {
    this.app = app;
    this.throttle = new ResponseThrottle();
    this.executor = new ActionChainExecutor(app, this.throttle);
  }

  public registerModule(module: AutomodModule): void {
    this.modules.push(module);
  }

  public registerJoinModule(module: AutomodModule): void {
    this.joinModules.set(module.name, module);
  }

  public async handleMessage(message: Message): Promise<void> {
    if (!this.app.config.automod.enabled) return;
    if (message.author.bot) return;
    const guild = message.guild;
    const member = message.member;
    const channel = message.channel as TextChannel;
    if (!guild || !member || !('id' in channel)) return;

    if (member.id === guild.ownerId) return;
    if (await this.app.whitelist.isWhitelisted(guild.id, member.id, 'automod')) return;

    const globalImmune = this.app.config.automod.global_immune_roles;
    if (member.roles.cache.some((r) => globalImmune.includes(r.id))) return;

    const allPurgeIds: string[] = [];

    for (const mod of this.modules) {
      try {
        const cfg = this.getModuleConfig(mod.name);
        if (!cfg || !cfg.enabled) continue;
        if (cfg.shadow_mode) continue;
        if (cfg.channel_ignore_list.includes(channel.id) || (channel.parentId && cfg.channel_ignore_list.includes(channel.parentId))) continue;
        if (cfg.immune_roles.length > 0 && member.roles.cache.some((r) => cfg.immune_roles.includes(r.id))) continue;

        const hit = await mod.check({ app: this.app, member, message, channel, content: message.content });
        if (!hit) continue;

        await this.handleHit(hit, member, message, channel, cfg);
        if (hit.purge_message_ids) allPurgeIds.push(...hit.purge_message_ids);
      } catch (err) {
        this.app.logger.error(`Automod module ${mod.name} threw:`, err);
        await this.app.logManager.reportError(`Automod module ${mod.name}`, err);
      }
    }

    // Merge triggered messages into one per-channel purge after the burst ends.
    if (allPurgeIds.length > 0) {
      this.queuePurge(channel, allPurgeIds);
    }
  }

  public getModuleConfig(moduleName: string): (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules] | null {
    if (moduleName === 'regex_engine') {
      // Regex rules live in the top-level regex_engine config, not under
      // automod.modules. Return a synthetic gate config; each rule supplies its
      // own action_chain (see regexEngine module + handleHit overrides).
      return {
        enabled: this.app.config.regex_engine.enabled,
        immune_roles: [],
        channel_ignore_list: [],
        action_chain: [...DEFAULT_ACTION_CHAIN] as never,
        suppress_repeat_response_seconds: 30,
        suppressed_response_mode: 'silent',
        shadow_mode: false,
      } as never;
    }
    const modules = this.app.config.automod.modules as Record<string, unknown>;
    if (modules[moduleName]) {
      return (modules[moduleName] as (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules]) ?? null;
    }
    const heuristics = this.app.config.automod.heuristics as unknown as Record<string, unknown>;
    if (heuristics[moduleName]) {
      return (heuristics[moduleName] as (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules]) ?? null;
    }
    return null;
  }

  public async handleJoin(member: GuildMember): Promise<void> {
    if (!this.app.config.automod.enabled) return;
    if (member.id === member.guild.ownerId) return;
    if (await this.app.whitelist.isWhitelisted(member.guild.id, member.id, 'automod')) return;
    const guild = member.guild;
    const globalImmune = this.app.config.automod.global_immune_roles;
    if (member.roles.cache.some((r) => globalImmune.includes(r.id))) return;

    for (const moduleName of ['mass_identical_joins', 'new_account_velocity', 'spam_rejoins'] as const) {
      try {
        const cfg = this.getModuleConfig(moduleName);
        if (!cfg || !cfg.enabled || cfg.shadow_mode) continue;
        const mod = this.joinModules.get(moduleName);
        if (!mod) continue;
        const hit = await mod.check({ app: this.app, member, content: '' });
        if (!hit) continue;
        await this.handleHit(hit, member, null, null, cfg);
      } catch (err) {
        this.app.logger.error(`Automod join heuristic ${moduleName} threw:`, err);
        await this.app.logManager.reportError(`Automod join heuristic ${moduleName}`, err);
      }
    }
  }

  public async handleNickname(member: GuildMember, nickname: string): Promise<void> {
    if (!this.app.config.regex_engine.enabled) return;
    if (member.id === member.guild.ownerId) return;
    if (await this.app.whitelist.isWhitelisted(member.guild.id, member.id, 'automod')) return;
    const cfg = this.getModuleConfig('regex_engine');
    if (!cfg || !cfg.enabled || cfg.shadow_mode) return;
    const mod = this.modules.find((m) => m.name === 'regex_engine');
    if (!mod) return;
    try {
      const hit = await mod.check({ app: this.app, member, content: nickname });
      if (hit && hit.rule) {
        await this.handleHit(hit, member, null, null, cfg);
      }
      } catch (err) {
      this.app.logger.error('Automod nickname check threw:', err);
    }
  }

  private async handleHit(
    hit: AutomodHit,
    member: GuildMember,
    message: Message | null,
    channel: TextChannel | null,
    cfg: (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules],
  ): Promise<void> {
    const guild = member.guild;
    await this.app.db.execute(
      `INSERT INTO automod_triggers (guild_id, rule, module, user_id, channel_id, message_id, content_snippet)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guild.id, hit.rule, hit.module, member.id, channel?.id ?? null, message?.id ?? null, hit.content.slice(0, 500)],
    );

    // suppress_actions from the module itself (e.g. spam repeat).
    // Also skip actions if this user+rule was already actioned within the
    // suppress window — prevents duplicate warns/DMs when the same user
    // triggers the same rule from multiple messages in quick succession.
    const suppressWindowMs = (hit.suppress_repeat_response_seconds ?? cfg.suppress_repeat_response_seconds ?? 0) * 1000;
    const actionKey = `${member.id}:${hit.rule}`;
    const now = Date.now();
    const lastAction = this.recentActions.get(actionKey) ?? 0;
    const alreadyActioned = suppressWindowMs > 0 && now - lastAction < suppressWindowMs;

    if (hit.suppress_actions || alreadyActioned) {
      return;
    }

    let archiveCode: string | null = null;
    let archiveLink: string | null = null;
    if (this.app.config.archives.enabled && message && channel) {
      try {
        const archive = await this.app.archives.archiveContext({
          guild,
          channel,
          messageId: message.id,
          amount: this.app.config.archives.automod_context_amount,
          kind: 'automod_evidence',
          createdBy: this.app.client.user?.id ?? null,
          reason: hit.reason,
        });
        archiveCode = archive?.code ?? null;
        archiveLink = archive?.link ?? null;
      } catch (err) {
        this.app.logger.warn(`Automod archive failed (${hit.module}/${hit.rule}):`, err);
      }
    }

    if (this.app.config.automod.risk_scoring.enabled) {
      await this.app.riskScoring.add(member.id, this.app.config.automod.risk_scoring.automod_hit_weight, guild.id);
    }

    const chain = (hit.action_chain ?? cfg.action_chain) as never;
    const suppress = hit.suppress_repeat_response_seconds ?? cfg.suppress_repeat_response_seconds;
    const mode = hit.suppressed_response_mode ?? cfg.suppressed_response_mode;

    const result = await this.executor.execute(
      {
        rule: hit.rule,
        module: hit.module,
        guild,
        user: member.user,
        member,
        message: message ?? null,
        channel: channel ?? null,
        reason: hit.reason,
        content: hit.content,
      },
      chain,
      suppress,
      mode,
    );

    // Record this action so the same user+rule won't trigger again within the window
    this.recentActions.set(actionKey, now);
    this.pruneRecentActions();

    await this.app.logManager.logAutomodTrigger({
      guildId: guild.id,
      rule: hit.rule,
      module: hit.module,
      userId: member.id,
      channelId: channel?.id ?? null,
      messageId: message?.id ?? null,
      contentSnippet: hit.content.slice(0, 500),
      storedContent: hit.content,
      actionsTaken: result.actionsTaken,
      actionsFailed: result.actionsFailed,
      responseSuppressed: result.responseSuppressed,
      caseIds: result.caseIds,
      archiveCode,
      archiveLink,
    });

    if (result.responseSuppressed && cfg.suppressed_response_mode === 'batched_summary' && channel) {
      this.maybePostSummary(hit, member, channel, cfg);
    }

    // DM users who were mass-pinged so they understand why they received a notification
    if (hit.dm_mentioned_users && hit.dm_mentioned_users.length > 0 && channel) {
      this.dmMentionedUsers(hit, member, channel).catch(() => undefined);
    }
  }

  /** Send a brief DM to each mass-pinged user explaining the situation. */
  private async dmMentionedUsers(
    hit: AutomodHit,
    pinger: GuildMember,
    channel: TextChannel,
  ): Promise<void> {
    const now = Date.now();
    for (const userId of hit.dm_mentioned_users!) {
      // Prevent the same user from being DM'd about pings more than once within the cooldown window.
      const lastDm = this.recentPingedDms.get(userId) ?? 0;
      if (now - lastDm < AutomodManager.DM_COOLDOWN_MS) continue;
      this.recentPingedDms.set(userId, now);

      try {
        const user = await this.app.client.users.fetch(userId).catch(() => null);
        if (!user || user.bot) continue;
        const dm = await user.createDM().catch(() => null);
        if (!dm) continue;

        const container = new ContainerBuilder()
          .setAccentColor(0xed4245)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('**Mass Ping Alert**'))
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `You were pinged by <@${pinger.id}> in <#${channel.id}>.\n` +
              `The message was flagged for mass pinging and has been removed.\n` +
              `If you believe this was done in error, please contact a staff member.`,
            ),
          );

        await dm.send({
          components: [container] as unknown[],
          flags: MessageFlags.IsComponentsV2,
        } as never).catch(() => undefined);
      } catch {
        // Don't let a failed DM crash the handler
      }
    }
    this.pruneRecentPingedDms();
  }

  private pruneRecentPingedDms(): void {
    if (this.recentPingedDms.size > 500) {
      const now = Date.now();
      for (const [key, ts] of this.recentPingedDms) {
        if (now - ts > AutomodManager.DM_COOLDOWN_MS * 2) this.recentPingedDms.delete(key);
      }
    }
  }

  private pruneRecentActions(): void {
    if (this.recentActions.size > 2000) {
      const now = Date.now();
      for (const [key, ts] of this.recentActions) {
        if (now - ts > 300_000) this.recentActions.delete(key); // 5 min max
      }
    }
  }

  private queuePurge(channel: TextChannel, ids: string[]): void {
    const existing = this.pendingPurges.get(channel.id);
    const pendingIds = existing?.ids ?? new Set<string>();
    for (const id of ids) pendingIds.add(id);
    if (existing) clearTimeout(existing.timer);

    const quietMs = this.app.config.automod.bulk_delete_quiet_seconds * 1000;
    const timer = setTimeout(() => {
      this.pendingPurges.delete(channel.id);
      void this.purgeMessages(channel, [...pendingIds]);
    }, quietMs);
    timer.unref();
    this.pendingPurges.set(channel.id, { ids: pendingIds, timer });
  }

  private async purgeMessages(channel: TextChannel, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)].filter((id) => channel.messages.cache.has(id));
    for (let index = 0; index < unique.length; index += 100) {
      const batch = unique.slice(index, index + 100);
      try {
        if (batch.length === 1) {
          await channel.messages.delete(batch[0]);
        } else if (batch.length > 1) {
          await channel.bulkDelete(batch);
        }
      } catch (err) {
      // Rate limited or messages too old — log and move on. The messages
      // will be caught by the next trigger or Discord's auto-purge.
        this.app.logger.warn(`Queued automod purge failed for channel ${channel.id}: ${(err as Error).message}`);
      }
    }
  }

  private maybePostSummary(
    hit: AutomodHit,
    member: GuildMember,
    channel: TextChannel,
    cfg: (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules],
  ): void {
    const summary = this.throttle.consumeSummary(hit.rule, channel.id);
    if (!summary || summary.count === 0) return;
    const text = `Removed ${summary.count} message(s) / actioned ${summary.users} user(s) for ${hit.module} (${hit.rule}) in the last window.`;
    channel.send({ content: text }).catch(() => undefined);
  }
}
