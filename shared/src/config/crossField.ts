import type { ConfigIssue } from './errors';
import type { ActionChain } from './actions';
import type { BotConfig } from './schema';

function add(issues: ConfigIssue[], path: string, expected: string, found: string): void {
  issues.push({ path, expected, found });
}

export function runCrossFieldChecks(config: BotConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  const lower = (s: string): string => s.toLowerCase();

  const commandNames = Object.keys(config.commands);
  const seenNames = new Set<string>();
  for (const name of commandNames) {
    if (seenNames.has(lower(name))) {
      add(issues, `commands.${name}`, 'unique command name (case-insensitive)', `duplicates ${name}`);
    }
    seenNames.add(lower(name));
  }

  const aliasOwner = new Map<string, string>();
  for (const name of commandNames) {
    const cmd = config.commands[name];
    for (const alias of cmd.aliases) {
      const key = lower(alias);
      if (seenNames.has(key)) {
        add(issues, `commands.${name}.aliases`, `alias "${alias}" must not clash with a command name`, `conflicts with command "${key}"`);
      } else if (aliasOwner.has(key)) {
        add(issues, `commands.${name}.aliases`, `alias "${alias}" must be unique`, `already used by command "${aliasOwner.get(key)}"`);
      } else {
        aliasOwner.set(key, name);
      }
    }
  }

  const ladder = config.warnings.escalation_ladder;
  for (let i = 1; i < ladder.length; i++) {
    if (ladder[i].count <= ladder[i - 1].count) {
      add(issues, `warnings.escalation_ladder[${i}].count`, `count must be greater than ${ladder[i - 1].count} (ascending order)`, String(ladder[i].count));
    }
  }

  const esc = config.escalation;
  for (let i = 0; i < esc.rules.length; i++) {
    const r = esc.rules[i];
    if (r.within_seconds < 0) add(issues, `escalation.rules[${i}].within_seconds`, 'positive integer', String(r.within_seconds));
  }

  const levels = config.trust_levels.levels;
  const levelSeen = new Set<number>();
  for (const lv of levels) {
    if (levelSeen.has(lv.level)) {
      add(issues, `trust_levels.levels`, 'unique level numbers', `duplicate level ${lv.level}`);
    }
    levelSeen.add(lv.level);
  }

  const presetNames = new Set<string>();
  for (const p of config.channel_locking.presets) {
    if (presetNames.has(p.name)) {
      add(issues, `channel_locking.presets`, 'unique preset name', `duplicate preset "${p.name}"`);
    }
    presetNames.add(p.name);
    if (p.channels.length === 0 && p.categories.length === 0 && !p.all_channels) {
      add(issues, `channel_locking.presets.${p.name}`, 'at least one of channels/categories/all_channels', 'none specified');
    }
  }

  const ruleNames = new Set<string>();
  for (const rule of config.regex_engine.rules) {
    if (ruleNames.has(rule.name)) {
      add(issues, `regex_engine.rules.${rule.name}`, 'unique rule name', 'duplicate name');
    }
    ruleNames.add(rule.name);
    const patterns = rule.patterns && rule.patterns.length > 0 ? rule.patterns : rule.pattern ? [rule.pattern] : [];
    if (patterns.length === 0) {
      add(issues, `regex_engine.rules.${rule.name}`, 'at least one of pattern / patterns', 'none provided');
      continue;
    }
    for (const p of patterns) {
      try {
        new RegExp(typeof p === 'string' ? p : p.pattern, rule.flags);
      } catch (e) {
        add(issues, `regex_engine.rules.${rule.name}`, 'valid regular expression', `failed to compile: ${(e as Error).message}`);
      }
    }
  }

  const roleConns = config.role_connections.connections;
  for (let i = 0; i < roleConns.length; i++) {
    const conn = roleConns[i];
    if (!conn.enabled) continue;
    for (let j = 0; j < conn.conditions.length; j++) {
      const cond = conn.conditions[j];
      if (cond.role_id === conn.main_role) {
        add(
          issues,
          `role_connections.connections[${i}].conditions[${j}]`,
          `condition role must not equal the connection's main role (self-reference would flip the role every sync)`,
          `same as main_role`,
        );
      }
    }
  }

  const logEvents = Object.keys(config.logging);
  for (const ev of logEvents) {
    const entry = config.logging[ev];
    if (entry.enabled && !entry.channel_id && !entry.thread_id) {
      add(issues, `logging.${ev}`, 'channel_id or thread_id when enabled', 'neither provided');
    }
  }

  for (const [name, cmd] of Object.entries(config.commands)) {
    if (!cmd.enabled) continue;
    if (cmd.permission_group) {
      const groups = config.staff_permission_groups.groups;
      if (!groups.some((g) => g.name === cmd.permission_group)) {
        add(issues, `commands.${name}.permission_group`, `existing group in staff_permission_groups`, `unknown group "${cmd.permission_group}"`);
      }
    }
  }

  const groupNames = new Set<string>();
  for (const g of config.staff_permission_groups.groups) {
    if (groupNames.has(g.name)) {
      add(issues, `staff_permission_groups.groups`, 'unique group name', `duplicate "${g.name}"`);
    }
    groupNames.add(g.name);
  }

  for (const [type, dm] of Object.entries(config.punishment_dms.types)) {
    if (!dm.enabled) continue;
    if (dm.format === 'embed' || dm.format === 'components_v2') {
      if (dm.content.trim().length === 0) {
        add(issues, `punishment_dms.types.${type}.content`, 'non-empty template content', 'empty');
      }
    }
  }

  const dbgOk = (s: string): boolean => /^(\d+(\.\d+)?[smhdwy])+$/i.test(s) || /^perm$/i.test(s);
  for (let i = 0; i < ladder.length; i++) {
    if (ladder[i].duration !== undefined && !dbgOk(ladder[i].duration as string)) {
      add(issues, `warnings.escalation_ladder[${i}].duration`, 'valid duration or "perm"', String(ladder[i].duration));
    }
  }
  for (let i = 0; i < esc.rules.length; i++) {
    if (esc.rules[i].action.duration !== undefined && !dbgOk(esc.rules[i].action.duration as string)) {
      add(issues, `escalation.rules[${i}].action.duration`, 'valid duration or "perm"', String(esc.rules[i].action.duration));
    }
  }
  for (let i = 0; i < esc.global.length; i++) {
    if (esc.global[i].action.duration !== undefined && !dbgOk(esc.global[i].action.duration as string)) {
      add(issues, `escalation.global[${i}].action.duration`, 'valid duration or "perm"', String(esc.global[i].action.duration));
    }
  }

  const chainLocations: Array<readonly [string, ActionChain]> = [
    ...Object.entries(config.automod.modules).map(([name, m]) => [`automod.modules.${name}.action_chain`, m.action_chain] as const),
    ...Object.entries(config.automod.heuristics).map(([name, h]) => [`automod.heuristics.${name}.action_chain`, h.action_chain] as const),
    ...config.regex_engine.rules.map((r, i) => [`regex_engine.rules[${i}].action_chain`, r.action_chain] as const),
  ];
  for (const [path, chain] of chainLocations) {
    for (const [i, step] of chain.entries()) {
      if (step.type !== 'send_channel_message') continue;
      if (!step.content && step.template_id === undefined && step.template_name === undefined) {
        add(issues, `${path}[${i}]`, 'content or template_id/template_name', 'none provided');
      }
    }
  }

  // ── Appeals ────────────────────────────────────────────────────────────────
  const checkAppealsConfig = (cfg: { enabled: boolean; log_channel_id?: string | null; ping_role_id?: string | null; form: Array<{ id: string; min_length?: number; max_length?: number; type: string }> }, path: string): void => {
    if (cfg.enabled && !cfg.log_channel_id) {
      add(issues, `${path}.log_channel_id`, 'a Discord channel ID when enabled', 'not set — appeal embeds have nowhere to go');
    }
    const seenQuestionIds = new Set<string>();
    for (const q of cfg.form) {
      if (seenQuestionIds.has(q.id)) {
        add(issues, `${path}.form`, 'unique question ids', `duplicate question id "${q.id}"`);
      }
      seenQuestionIds.add(q.id);
      if (q.type !== 'checkbox') {
        if (q.min_length !== undefined && q.max_length !== undefined && q.min_length > q.max_length) {
          add(issues, `${path}.form`, `min_length <= max_length for question "${q.id}"`, `min_length ${q.min_length} > max_length ${q.max_length}`);
        }
      }
    }
  };
  checkAppealsConfig(config.appeals, 'appeals');
  for (const [guildId, override] of Object.entries(config.appeals.guild_overrides ?? {})) {
    checkAppealsConfig(override as Parameters<typeof checkAppealsConfig>[0], `appeals.guild_overrides.${guildId}`);
  }

  return issues;
}