import type { AutomodModule, ModuleContext } from '../manager';

const cache = new Map<string, RegExp>();

function compile(pattern: string, flags: string): RegExp {
  const key = `${pattern}:${flags}`;
  let re = cache.get(key);
  if (!re) {
    re = new RegExp(pattern, flags);
    cache.set(key, re);
  }
  return re;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function hasValidCardIssuer(digits: string): boolean {
  const prefix2 = digits.slice(0, 2);
  if (digits.length === 15) {
    return prefix2 === '34' || prefix2 === '37';
  }
  if (digits.length !== 16) return false;
  if (digits[0] === '4') return true;
  if (/^5[1-5]/.test(digits)) return true;
  const p4 = Number(digits.slice(0, 4));
  if (p4 >= 2221 && p4 <= 2720) return true;
  if (digits.startsWith('6011') || digits.startsWith('65')) return true;
  const p3 = Number(digits.slice(0, 3));
  if (p3 >= 644 && p3 <= 649) return true;
  const p6 = Number(digits.slice(0, 6));
  if (p6 >= 622126 && p6 <= 622925) return true;
  return p4 >= 3528 && p4 <= 3589;
}

function isValidCardNumber(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 15 || digits.length > 16) return false;
  return luhnValid(digits) && hasValidCardIssuer(digits);
}

// Scan for a real card number in the matched text. Luhn + issuer prefix means
// random digit runs (e.g. Discord snowflake user IDs) almost never qualify,
// while genuine card numbers always do.
function containsValidCardNumber(text: string): boolean {
  const candidateRe = /\d[\d \-]{13,18}/g;
  let m: RegExpExecArray | null;
  while ((m = candidateRe.exec(text)) !== null) {
    if (isValidCardNumber(m[0])) return true;
  }
  return false;
}

export function createRegexEngineModule(): AutomodModule {
  return {
    name: 'regex_engine',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.regex_engine;
      if (!cfg.enabled) return null;

      const member = ctx.member;
      const nickname = member.nickname ?? member.user.username;
      const username = member.user.username;

      for (const rule of cfg.rules) {
        if (!rule.enabled) continue;
        if (rule.immune_roles.length > 0 && member.roles.cache.some((r) => rule.immune_roles.includes(r.id))) continue;
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
        if (!haystack) continue;

        const patterns = rule.patterns && rule.patterns.length > 0 ? rule.patterns : rule.pattern ? [rule.pattern] : [];
        for (const p of patterns) {
          const pattern = typeof p === 'string' ? p : p.pattern;
          const re = compile(pattern, rule.flags);
          re.lastIndex = 0;
          if (re.test(haystack)) {
            if (typeof p === 'object' && p.luhn && !containsValidCardNumber(haystack)) {
              continue;
            }
            return {
              module: 'regex_engine',
              rule: rule.name,
              reason: `matched regex rule "${rule.name}" on ${rule.scope}`,
              content: haystack,
              action_chain: rule.action_chain,
              suppress_repeat_response_seconds: 30,
              suppressed_response_mode: 'silent',
            };
          }
        }
      }
      return null;
    },
  };
}