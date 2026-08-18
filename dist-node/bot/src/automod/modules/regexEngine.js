"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegexEngineModule = createRegexEngineModule;
const cache = new Map();
function compile(pattern, flags) {
    const key = `${pattern}:${flags}`;
    let re = cache.get(key);
    if (!re) {
        re = new RegExp(pattern, flags);
        cache.set(key, re);
    }
    return re;
}
function createRegexEngineModule() {
    return {
        name: 'regex_engine',
        async check(ctx) {
            const cfg = ctx.app.config.regex_engine;
            if (!cfg.enabled)
                return null;
            const member = ctx.member;
            const nickname = member.nickname ?? member.user.username;
            const username = member.user.username;
            for (const rule of cfg.rules) {
                if (!rule.enabled)
                    continue;
                if (rule.immune_roles.length > 0 && member.roles.cache.some((r) => rule.immune_roles.includes(r.id)))
                    continue;
                let haystack = '';
                switch (rule.scope) {
                    case 'message':
                        haystack = ctx.content;
                        break;
                    case 'nickname':
                        haystack = nickname;
                        break;
                    case 'username':
                        haystack = username;
                        break;
                }
                if (!haystack)
                    continue;
                const re = compile(rule.pattern, rule.flags);
                if (re.test(haystack)) {
                    return {
                        module: 'regex_engine',
                        rule: rule.name,
                        reason: `matched regex rule "${rule.name}" on ${rule.scope}`,
                        content: haystack,
                    };
                }
            }
            return null;
        },
    };
}
//# sourceMappingURL=regexEngine.js.map