"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCrossFieldChecks = runCrossFieldChecks;
function add(issues, path, expected, found) {
    issues.push({ path, expected, found });
}
function runCrossFieldChecks(config) {
    const issues = [];
    const lower = (s) => s.toLowerCase();
    const commandNames = Object.keys(config.commands);
    const seenNames = new Set();
    for (const name of commandNames) {
        if (seenNames.has(lower(name))) {
            add(issues, `commands.${name}`, 'unique command name (case-insensitive)', `duplicates ${name}`);
        }
        seenNames.add(lower(name));
    }
    const aliasOwner = new Map();
    for (const name of commandNames) {
        const cmd = config.commands[name];
        for (const alias of cmd.aliases) {
            const key = lower(alias);
            if (seenNames.has(key)) {
                add(issues, `commands.${name}.aliases`, `alias "${alias}" must not clash with a command name`, `conflicts with command "${key}"`);
            }
            else if (aliasOwner.has(key)) {
                add(issues, `commands.${name}.aliases`, `alias "${alias}" must be unique`, `already used by command "${aliasOwner.get(key)}"`);
            }
            else {
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
        if (r.within_seconds < 0)
            add(issues, `escalation.rules[${i}].within_seconds`, 'positive integer', String(r.within_seconds));
    }
    const levels = config.trust_levels.levels;
    const levelSeen = new Set();
    for (const lv of levels) {
        if (levelSeen.has(lv.level)) {
            add(issues, `trust_levels.levels`, 'unique level numbers', `duplicate level ${lv.level}`);
        }
        levelSeen.add(lv.level);
    }
    const presetNames = new Set();
    for (const p of config.channel_locking.presets) {
        if (presetNames.has(p.name)) {
            add(issues, `channel_locking.presets`, 'unique preset name', `duplicate preset "${p.name}"`);
        }
        presetNames.add(p.name);
        if (p.channels.length === 0 && p.categories.length === 0 && !p.all_channels) {
            add(issues, `channel_locking.presets.${p.name}`, 'at least one of channels/categories/all_channels', 'none specified');
        }
    }
    const ruleNames = new Set();
    for (const rule of config.regex_engine.rules) {
        if (ruleNames.has(rule.name)) {
            add(issues, `regex_engine.rules.${rule.name}`, 'unique rule name', 'duplicate name');
        }
        ruleNames.add(rule.name);
        try {
            new RegExp(rule.pattern, rule.flags);
        }
        catch (e) {
            add(issues, `regex_engine.rules.${rule.name}.pattern`, 'valid regular expression', `failed to compile: ${e.message}`);
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
        if (!cmd.enabled)
            continue;
        if (cmd.permission_group) {
            const groups = config.staff_permission_groups.groups;
            if (!groups.some((g) => g.name === cmd.permission_group)) {
                add(issues, `commands.${name}.permission_group`, `existing group in staff_permission_groups`, `unknown group "${cmd.permission_group}"`);
            }
        }
    }
    const groupNames = new Set();
    for (const g of config.staff_permission_groups.groups) {
        if (groupNames.has(g.name)) {
            add(issues, `staff_permission_groups.groups`, 'unique group name', `duplicate "${g.name}"`);
        }
        groupNames.add(g.name);
    }
    for (const [type, dm] of Object.entries(config.punishment_dms.types)) {
        if (!dm.enabled)
            continue;
        if (dm.format === 'embed' || dm.format === 'components_v2') {
            if (dm.content.trim().length === 0) {
                add(issues, `punishment_dms.types.${type}.content`, 'non-empty template content', 'empty');
            }
        }
    }
    const dbgOk = (s) => /^(\d+(\.\d+)?[smhdwy])+$/i.test(s) || /^perm$/i.test(s);
    for (let i = 0; i < ladder.length; i++) {
        if (ladder[i].duration !== undefined && !dbgOk(ladder[i].duration)) {
            add(issues, `warnings.escalation_ladder[${i}].duration`, 'valid duration or "perm"', String(ladder[i].duration));
        }
    }
    for (let i = 0; i < esc.rules.length; i++) {
        if (esc.rules[i].action.duration !== undefined && !dbgOk(esc.rules[i].action.duration)) {
            add(issues, `escalation.rules[${i}].action.duration`, 'valid duration or "perm"', String(esc.rules[i].action.duration));
        }
    }
    for (let i = 0; i < esc.global.length; i++) {
        if (esc.global[i].action.duration !== undefined && !dbgOk(esc.global[i].action.duration)) {
            add(issues, `escalation.global[${i}].action.duration`, 'valid duration or "perm"', String(esc.global[i].action.duration));
        }
    }
    return issues;
}
//# sourceMappingURL=crossField.js.map