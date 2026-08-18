import type { TextChannel, GuildMember, Message } from 'discord.js';
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

    const globalImmune = this.app.config.automod.global_immune_roles;
    if (member.roles.cache.some((r) => globalImmune.includes(r.id))) return;

    for (const mod of this.modules) {
      try {
        const cfg = this.getModuleConfig(mod.name);
        if (!cfg || !cfg.enabled) continue;
        if (cfg.shadow_mode) continue;
        if (cfg.channel_ignore_list.includes(channel.id)) continue;
        if (cfg.immune_roles.length > 0 && member.roles.cache.some((r) => cfg.immune_roles.includes(r.id))) continue;

        const hit = await mod.check({ app: this.app, member, message, channel, content: message.content });
        if (!hit) continue;

        await this.handleHit(hit, member, message, channel, cfg);
      } catch (err) {
        this.app.logger.error(`Automod module ${mod.name} threw:`, err);
        await this.app.logManager.reportError(`Automod module ${mod.name}`, err);
      }
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
    const guild = member.guild;
    const globalImmune = this.app.config.automod.global_immune_roles;
    if (member.roles.cache.some((r) => globalImmune.includes(r.id))) return;

    for (const moduleName of ['mass_identical_joins', 'new_account_velocity'] as const) {
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

    if (hit.suppress_actions) {
      if (hit.purge_message_ids && channel) {
        await this.purgeMessages(channel, hit.purge_message_ids);
      }
      return;
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

    if (hit.purge_message_ids && channel) {
      await this.purgeMessages(channel, hit.purge_message_ids);
    }

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
    });

    if (result.responseSuppressed && cfg.suppressed_response_mode === 'batched_summary' && channel) {
      this.maybePostSummary(hit, member, channel, cfg);
    }
  }

  private async purgeMessages(channel: TextChannel, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    try {
      await channel.bulkDelete(unique);
    } catch {
      for (const id of unique) {
        await channel.messages.delete(id).catch(() => undefined);
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