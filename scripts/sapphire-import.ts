import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { configSchema, LOG_EVENT_NAMES } from '../shared/src/config/schema';
import { runCrossFieldChecks } from '../shared/src/config/crossField';

const GUILD = '1466990155020898413';

interface SapCondition {
  type: number;
  value: string;
}

interface SapAction {
  type: string;
  value: unknown;
  delay?: number;
}

interface SapTrigger {
  condition?: number[];
  channelIds?: string[];
  channelMode?: string;
  actions: SapAction[];
}

const FILES = {
  automod: 'auto-moderationData-1466990155020898413.json',
  welcome: 'welcome-messagesData-1466990155020898413.json',
  roles: 'role-connectionsData-1466990155020898413.json',
  logging: 'loggingData-1466990155020898413.json',
  commands: 'commandsData-1466990155020898413.json',
  moderation: 'moderationData-1466990155020898413.json',
  messages: 'messagesData-1466990155020898413.json',
};

function readJson<T>(name: string): T {
  const p = path.resolve(process.cwd(), name);
  if (!fs.existsSync(p)) throw new Error(`Missing import file: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const PERM_MAP: Record<string, string> = {
  ADD_REACTIONS: 'AddReactions',
  ADMINISTRATOR: 'Administrator',
  ATTACH_FILES: 'AttachFiles',
  BAN_MEMBERS: 'BanMembers',
  CHANGE_NICKNAME: 'ChangeNickname',
  CONNECT: 'Connect',
  CREATE_INSTANT_INVITE: 'CreateInstantInvite',
  CREATE_PRIVATE_THREADS: 'CreatePrivateThreads',
  CREATE_PUBLIC_THREADS: 'CreatePublicThreads',
  DEAFEN_MEMBERS: 'DeafenMembers',
  EMBED_LINKS: 'EmbedLinks',
  KICK_MEMBERS: 'KickMembers',
  MANAGE_CHANNELS: 'ManageChannels',
  MANAGE_GUILD: 'ManageGuild',
  MANAGE_MESSAGES: 'ManageMessages',
  MANAGE_NICKNAMES: 'ManageNicknames',
  MANAGE_ROLES: 'ManageRoles',
  MANAGE_THREADS: 'ManageThreads',
  MANAGE_WEBHOOKS: 'ManageWebhooks',
  MENTION_EVERYONE: 'MentionEveryone',
  MODERATE_MEMBERS: 'ModerateMembers',
  MOVE_MEMBERS: 'MoveMembers',
  MUTE_MEMBERS: 'MuteMembers',
  PRIORITY_SPEAKER: 'PrioritySpeaker',
  READ_MESSAGE_HISTORY: 'ReadMessageHistory',
  REQUEST_TO_SPEAK: 'RequestToSpeak',
  SEND_MESSAGES: 'SendMessages',
  SEND_MESSAGES_IN_THREADS: 'SendMessagesInThreads',
  SEND_TTS_MESSAGES: 'SendTTSMessages',
  SPEAK: 'Speak',
  STREAM: 'Stream',
  USE_APPLICATION_COMMANDS: 'UseApplicationCommands',
  USE_EXTERNAL_EMOJIS: 'UseExternalEmojis',
  USE_EXTERNAL_STICKERS: 'UseExternalStickers',
  USE_VAD: 'UseVAD',
  VIEW_AUDIT_LOG: 'ViewAuditLog',
  VIEW_CHANNEL: 'ViewChannel',
  VIEW_GUILD_INSIGHTS: 'ViewGuildInsights',
};

function mapPerms(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((p) => PERM_MAP[p]).filter((p): p is string => Boolean(p));
}

function fixDuration(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.replace(/^(\d+)hr$/, '$1h').replace(/^(\d+)min$/, '$1m').replace(/^(\d+)sec$/, '$1s');
}

function stripEmoji(s: string): string {
  return s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function replacePlaceholders(s: string): string {
  return stripEmoji(
    s
      .replace(/\$\{userid\}/g, '{mention}')
      .replace(/\$\{user\}/g, '{user}')
      .replace(/\$\{guildname\}/g, '{guild}')
      .replace(/\$\{membercount\}/g, '{member_count}')
      .replace(/\$\{(?:useravatarurl|memberavatarurl)\}/g, ''),
  );
}

interface ImportedActions {
  chain: unknown[];
  notes: string[];
}

function buildChain(actions: SapAction[], ruleName: string, escalate = true): ImportedActions {
  const chain: unknown[] = [];
  const notes: string[] = [];
  for (const a of actions) {
    if (a.type === 'delete') {
      chain.push({ type: 'delete_message' });
    } else if (a.type === 'message') {
      const v = a.value as { name?: string; deleteAfter?: number };
      const deleteAfter = v?.deleteAfter ? Math.round(v.deleteAfter / 1000) : 30;
      chain.push({
        type: 'send_channel_message',
        format: 'components_v2',
        content: `Your message was removed in {channel}.`,
        title: 'Message Removed',
        description: `A message you posted was removed by the moderation bot.\n\nReason: {reason}\nRule: {rule}\nChannel: {channel}\nUser: {user}`,
        footer: 'If you believe this was a mistake, contact staff.',
        accent_color: '#ED4245',
        delete_after_seconds: deleteAfter,
      });
    } else if (a.type === 'moderation') {
      const list = (a.value as Array<{ type: string; duration: string | null; reason: string }>) ?? [];
      for (const m of list) {
        const reason = m.reason || `Automod: ${ruleName}`;
        const duration = fixDuration(m.duration);
        if (m.type === 'warn') {
          chain.push({ type: 'warn', reason });
        } else if (m.type === 'mute') {
          chain.push({ type: 'timeout', duration: duration ?? '1h', reason });
        } else if (m.type === 'ban') {
          chain.push({ type: 'ban', duration: duration ?? 'perm', reason });
        } else if (m.type === 'kick') {
          chain.push({ type: 'kick', reason });
        } else {
          notes.push(`skipped moderation action type "${m.type}"`);
        }
      }
    } else if (a.type === 'report') {
      notes.push('report action not representable in a chain (staff report card is separate)');
    } else {
      notes.push(`skipped unknown action type "${a.type}"`);
    }
  }
  if (chain.length === 0) chain.push({ type: 'warn', reason: `Automod: ${ruleName}` });
  if (escalate) chain.push({ type: 'run_escalation_check' });
  return { chain, notes };
}

function thresholdFromCondition(cond: number[] | undefined): { threshold: number; windowSeconds: number } {
  if (!cond || cond.length < 3) return { threshold: 5, windowSeconds: 3 };
  return { threshold: cond[0], windowSeconds: cond[1] };
}

function compileRule(pattern: string, flags: string): { ok: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function normalizePattern(raw: string): { pattern: string; needsS: boolean; needsM: boolean; needsI: boolean } {
  const needsI = /\(\?i\)/.test(raw);
  const needsS = /\(\?s\)/.test(raw);
  const needsM = /\(\?m\)/.test(raw);
  const pattern = raw.replace(/\(\?[a-zA-Z-]+\)/g, '');
  return { pattern, needsS, needsM, needsI };
}

const LOG_MAP: Array<[RegExp, string]> = [
  [/^channelcreate/, 'channel_create'],
  [/^channeldelete/, 'channel_delete'],
  [/^channel/, 'channel_update'],
  [/^messageupdate/, 'message_edit'],
  [/^messagedelete/, 'message_delete'],
  [/^memberjoin/, 'member_join'],
  [/^memberleave/, 'member_leave'],
  [/^memberban|^memberunban/, 'member_ban'],
  [/^memberunban/, 'member_unban'],
  [/^memberkick/, 'member_kick'],
  [/^membertimeout/, 'member_timeout'],
  [/^voicestate|^voice/, 'voice_state_update'],
  [/^invitecreate/, 'invite_create'],
  [/^invitedelete/, 'invite_delete'],
  [/^nickname/, 'nickname_change'],
  [/^moderationaction|punish|case/, 'moderation_action'],
  [/^automodtrigger/, 'automod_trigger'],
  [/^commandusage/, 'command_usage'],
  [/^error/, 'error_event'],
  [/^ratelimit/, 'rate_limit_event'],
  [/^report/, 'report_created'],
  [/^appeal/, 'appeal_created'],
];

function mapLogEvent(sapEvent: string): string | null {
  const lower = sapEvent.toLowerCase();
  for (const [re, mapped] of LOG_MAP) {
    if (re.test(lower)) return mapped;
  }
  if ((LOG_EVENT_NAMES as readonly string[]).includes(sapEvent)) return sapEvent;
  return null;
}

// ---- custom commands helpers ----
const BUILTIN_SLASH_NAMES = new Set([
  'afk', 'antiraid', 'appeal', 'ban', 'base64', 'birthday', 'botinfo', 'calculator', 'case',
  'caseclose', 'cases', 'color', 'config', 'customcommand', 'decode', 'disarm', 'embed', 'encode',
  'firstmessage', 'giveaway', 'hash', 'help', 'kick', 'leaderboard', 'level', 'lock', 'lookup',
  'massban', 'md5', 'membercount', 'modstats', 'mute', 'nick', 'note', 'permissions', 'ping',
  'poll', 'prefix', 'purge', 'qrcode', 'quarantine', 'remindme', 'report', 'restore', 'roles',
  'schedule', 'serverinfo', 'sha1', 'sha256', 'snapshot', 'softban', 'suggest', 'temprole',
  'ticket', 'timeout', 'timestamp', 'translate', 'trigger', 'unban', 'unlock', 'unmute',
  'unquarantine', 'uptime', 'userinfo', 'verify', 'warn', 'warns', 'weather',
]);

function hexColorToStr(num: unknown): string | undefined {
  if (typeof num !== 'number') return undefined;
  return '#' + num.toString(16).padStart(6, '0');
}

function joinValue(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x)).join('\n');
  return String(v);
}

function normalizePlaceholders(s: string): string {
  return s.replace(/\$\{/g, '{');
}

function emojiToString(emoji: unknown): string | undefined {
  if (typeof emoji === 'string') return emoji;
  if (emoji && typeof emoji === 'object') {
    const e = emoji as { id?: string; name?: string; animated?: boolean };
    if (e.id) return `<${e.animated ? 'a' : ''}:${e.name ?? 'emoji'}:${e.id}>`;
    return e.name;
  }
  return undefined;
}

function convertSapphireComponents(comps: unknown): any[] | undefined {
  if (!Array.isArray(comps)) return undefined;
  const rows: any[] = [];
  for (const row of comps) {
    if (!row || !Array.isArray(row.components)) continue;
    const outComps: any[] = [];
    for (const c of row.components) {
      if (c?.type === 2) {
        const styleMap: Record<number, string> = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link' };
        const b: Record<string, unknown> = { type: 'button', id: String(c.customId ?? `b${outComps.length}`), label: String(c.label ?? '') };
        b.style = styleMap[c.style] ?? 'secondary';
        if (c.url) b.url = String(c.url);
        if (c.customId && !c.url) b.custom_id = String(c.customId);
        const emoji = emojiToString(c.emoji);
        if (emoji) b.emoji = emoji;
        if (c.disabled) b.disabled = true;
        outComps.push(b);
      } else if (c?.type === 3) {
        const opts = ((c.options ?? []) as any[]).map((o) => {
          const ob: Record<string, unknown> = { label: String(o.label ?? ''), value: String(o.value ?? o.label ?? '') };
          if (o.description) ob.description = String(o.description);
          const emoji = emojiToString(o.emoji);
          if (emoji) ob.emoji = emoji;
          return ob;
        });
        outComps.push({
          type: 'select',
          id: String(c.customId ?? `s${outComps.length}`),
          placeholder: String(c.placeholder ?? 'Select an option'),
          min_values: c.minValues ?? 1,
          max_values: c.maxValues ?? 1,
          custom_id: c.customId ? String(c.customId) : undefined,
          options: opts,
        });
      }
    }
    if (outComps.length > 0) rows.push({ components: outComps });
  }
  return rows.length > 0 ? rows : undefined;
}

function convertTemplateToPayload(template: any): Record<string, unknown> {
  const json = template && typeof template.json === 'object' ? template.json : template ?? {};
  const payload: Record<string, unknown> = {};
  if (json.content) payload.content = normalizePlaceholders(String(json.content));

  const embeds: any[] = [];
  for (const e of json.embeds ?? []) {
    const out: Record<string, unknown> = {};
    if (e.title) out.title = normalizePlaceholders(String(e.title));
    const desc = joinValue(e.description);
    if (desc) out.description = normalizePlaceholders(desc);
    const color = hexColorToStr(e.color);
    if (color) out.color = color;
    if (e.url) out.url = String(e.url);
    if (e.timestamp) out.timestamp = true;
    if (e.image?.url) out.image = normalizePlaceholders(String(e.image.url));
    if (e.thumbnail?.url) out.thumbnail = normalizePlaceholders(String(e.thumbnail.url));
    if (e.author) {
      const author: Record<string, unknown> = {};
      if (e.author.name) author.name = normalizePlaceholders(String(e.author.name));
      if (e.author.url) author.url = String(e.author.url);
      if (e.author.icon_url) author.icon_url = normalizePlaceholders(String(e.author.icon_url));
      out.author = author;
    }
    if (Array.isArray(e.fields) && e.fields.length > 0) {
      out.fields = e.fields.map((f: any) => ({
        name: normalizePlaceholders(String(f.name)),
        value: normalizePlaceholders(joinValue(f.value) ?? ''),
        ...(f.inline ? { inline: true } : {}),
      }));
    }
    if (e.footer) {
      const footer: Record<string, unknown> = { text: normalizePlaceholders(String(e.footer.text ?? '')) };
      if (e.footer.icon_url) footer.icon_url = normalizePlaceholders(String(e.footer.icon_url));
      out.footer = footer;
    }
    embeds.push(out);
  }
  if (embeds.length > 0) payload.embeds = embeds;

  const components = convertSapphireComponents(json.components);
  if (components && components.length > 0) payload.components = components;
  return payload;
}

async function main(): Promise<void> {
  const automod = readJson<any>(FILES.automod);
  const welcome = readJson<any>(FILES.welcome);
  const roles = readJson<any>(FILES.roles);
  const logging = readJson<any>(FILES.logging);
  const commands = readJson<any>(FILES.commands);
  const moderation = readJson<any>(FILES.moderation);
  const messagesData = readJson<any>(FILES.messages);

  const configPath = path.resolve(process.cwd(), 'config.yml');
  const existing = YAML.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, any>;

  const cfg = existing;

  // ---- bot prefixes ----
  if (Array.isArray(commands.prefixes) && commands.prefixes.length > 0) {
    cfg.bot.prefixes = commands.prefixes;
  }

  // ---- commands: toggles, restrictions, aliases ----
  const cmdMap = cfg.commands ?? {};
  const sapCommands = (commands.defaultCommands ?? []) as any[];
  for (const sc of sapCommands) {
    if (sc.enabled === false) {
      cmdMap[sc.name] = { ...(cmdMap[sc.name] ?? {}), enabled: false };
      continue;
    }
    const entry: Record<string, unknown> = { ...(cmdMap[sc.name] ?? {}) };
    entry.enabled = true;
    if (sc.restrictions) {
      const perms = mapPerms(sc.restrictions.permissions);
      if (perms.length > 0) entry.permissions = perms;
      if (sc.restrictions.roleIds && sc.restrictions.roleIds.length > 0) {
        entry.immune_roles = sc.restrictions.roleIds;
      }
    }
    if (Array.isArray(sc.aliases) && sc.aliases.length > 0) {
      const existingAliases = Array.isArray(entry.aliases) ? (entry.aliases as string[]) : [];
      entry.aliases = [...new Set([...existingAliases, ...sc.aliases.filter((a: string) => a !== sc.name)])];
    }
    cmdMap[sc.name] = entry;
  }
  cfg.commands = cmdMap;

  // drop aliases that collide with any real command name (e.g. sapphire has both
  // `purge` and `prune` commands, so `prune` must not also be a purge alias)
  const commandNames = new Set(Object.keys(cmdMap));
  for (const [name, entry] of Object.entries(cmdMap) as Array<[string, Record<string, unknown>]>) {
    if (Array.isArray(entry.aliases)) {
      entry.aliases = (entry.aliases as string[]).filter((a) => !(commandNames.has(a) && a !== name));
      if ((entry.aliases as string[]).length === 0) delete entry.aliases;
    }
  }
  cfg.commands = cmdMap;

  // ---- automod ----
  const immuneRoles = [...new Set<string>([
    ...(automod.spam?.roleIds ?? []),
    ...(automod.channelSpam?.roleIds ?? []),
  ])];
  const globalImmune = [...new Set<string>([
    ...immuneRoles,
    ...(moderation.immuneToPunishRoleIds?.global ?? []),
  ])];

  const am = cfg.automod;
  am.enabled = automod.enabled ?? true;
  if (globalImmune.length > 0) am.global_immune_roles = globalImmune;

  const spamCond = thresholdFromCondition(automod.spam?.actions?.[0]?.condition);
  const spamChain = buildChain(automod.spam?.actions?.[0]?.actions ?? [], 'spam');
  am.modules.spam.enabled = automod.enabled ?? true;
  am.modules.spam.threshold = spamCond.threshold;
  am.modules.spam.window_seconds = spamCond.windowSeconds;
  am.modules.spam.immune_roles = automod.spam?.roleIds ?? [];
  am.modules.spam.action_chain = spamChain.chain;

  const ccCond = thresholdFromCondition(automod.channelSpam?.actions?.[0]?.condition);
  const ccChain = buildChain(automod.channelSpam?.actions?.[0]?.actions ?? [], 'cross_channel');
  am.modules.cross_channel.enabled = automod.enabled ?? true;
  am.modules.cross_channel.threshold = ccCond.threshold;
  am.modules.cross_channel.window_seconds = ccCond.windowSeconds;
  am.modules.cross_channel.immune_roles = automod.channelSpam?.roleIds ?? [];
  am.modules.cross_channel.action_chain = ccChain.chain;

  // ---- links: allowlist of domains + roles/channels exempt from link moderation ----
  const linksGroup = (automod.links?.groups ?? [])[0];
  if (linksGroup) {
    const linkRoles = [...new Set<string>([
      ...(automod.links?.roleIds ?? []),
      ...(linksGroup.roleIds ?? []),
    ])];
    const linkChannels = [...new Set<string>([
      ...(automod.links?.channels ?? []).map((c: { id?: string }) => c?.id).filter(Boolean),
      ...(linksGroup.actions?.[0]?.channelIds ?? []),
    ])];
    const allowlist = [...new Set(
      (linksGroup.list ?? [])
        .map((d: string) => String(d).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/\*$/, '').toLowerCase())
        .filter((h: string) => /^[a-z0-9.-]+$/.test(h) && h.includes('.')),
    )];
    const linkChain = buildChain(linksGroup.actions?.[0]?.actions ?? [], 'links', false);
    am.modules.link_filter.enabled = true;
    am.modules.link_filter.mode = 'allowlist';
    am.modules.link_filter.allowlist = allowlist;
    am.modules.link_filter.immune_roles = linkRoles;
    am.modules.link_filter.channel_ignore_list = linkChannels;
    am.modules.link_filter.suppress_repeat_response_seconds = 30;
    am.modules.link_filter.suppressed_response_mode = 'silent';
    am.modules.link_filter.action_chain = linkChain.chain;
  }

  // ---- discord invites: allow own guild + exempt roles/channels ----
  const inviteGroup = (automod.discordInvites?.groups ?? [])[0];
  if (inviteGroup) {
    const inviteRoles = [...new Set<string>([
      ...(automod.discordInvites?.roleIds ?? []),
      ...(inviteGroup.roleIds ?? []),
    ])];
    const inviteChannels = [...new Set<string>([
      ...(automod.discordInvites?.channels ?? []).map((c: { id?: string }) => c?.id).filter(Boolean),
      ...(inviteGroup.actions?.[0]?.channelIds ?? []),
    ])];
    const guildAllowlist = (inviteGroup.list ?? [])
      .filter((v: string) => /^\d{15,20}$/.test(String(v)))
      .map((v: string) => String(v));
    const inviteChain = buildChain(inviteGroup.actions?.[0]?.actions ?? [], 'invites');
    am.modules.invites.enabled = true;
    am.modules.invites.guild_allowlist = guildAllowlist;
    am.modules.invites.immune_roles = inviteRoles;
    am.modules.invites.channel_ignore_list = inviteChannels;
    am.modules.invites.suppress_repeat_response_seconds = 30;
    am.modules.invites.suppressed_response_mode = 'silent';
    am.modules.invites.action_chain = inviteChain.chain;
  }

  for (const moduleName of ['image_spam', 'executable_files', 'mass_images', 'emoji_spam', 'line_spam', 'poll_spam', 'duplicate_spam'] as const) {
    am.modules[moduleName].enabled = false;
  }

  // ---- regex engine: word groups -> rules ----
  const regexRules: any[] = [];
  const importNotes: string[] = [];
  const groups = (automod.words?.groups ?? []) as any[];
  for (const group of groups) {
    const list = (group.list ?? []) as Array<{ value: string; flags?: string }>;
    const rawPatterns = list.map((p) => p.value).filter(Boolean);
    if (rawPatterns.length === 0) continue;

    const normalized = rawPatterns.map(normalizePattern);
    const patterns = normalized.map((n) => n.pattern);
    const needU = patterns.some((p) => /\\u\{/.test(p));
    const needS = normalized.some((n) => n.needsS);
    const needM = normalized.some((n) => n.needsM);
    const needI = normalized.some((n) => n.needsI) || group.ignoreCaps !== false;
    const flags = 'g' + (needI ? 'i' : '') + (needS ? 's' : '') + (needM ? 'm' : '') + (needU ? 'u' : '');

    const groupChain = buildChain(group.actions?.[0]?.actions ?? [], group.name);
    for (const note of groupChain.notes) importNotes.push(`[${group.name}] ${note}`);

    let combinedOk = false;
    try {
      const combined = `(?:${patterns.join(')|(?:')})`;
      if (compileRule(combined, flags).ok) {
        regexRules.push({
          name: group.name,
          pattern: combined,
          flags,
          scope: 'message',
          enabled: true,
          immune_roles: group.roleIds ?? [],
          action_chain: groupChain.chain,
        });
        combinedOk = true;
      }
    } catch {
      /* fall through to per-pattern */
    }

    if (!combinedOk) {
      let i = 0;
      for (const p of patterns) {
        const compiled = compileRule(p, flags);
        if (!compiled.ok) {
          importNotes.push(`[${group.name}] skipped pattern that does not compile: ${p} (${compiled.error})`);
          continue;
        }
        regexRules.push({
          name: `${group.name}-${++i}`,
          pattern: p,
          flags,
          scope: 'message',
          enabled: true,
          immune_roles: group.roleIds ?? [],
          action_chain: groupChain.chain,
        });
      }
    }
  }
  cfg.regex_engine.enabled = true;
  cfg.regex_engine.rules = regexRules;

  // ---- reports ----
  cfg.reports.enabled = true;
  const reportChannel =
    automod.channelSpam?.actions?.[0]?.actions?.find((a: SapAction) => a.type === 'report')?.value as
      | { channelId?: string; pingRoleIds?: string[] }
      | undefined;
  if (reportChannel?.channelId) cfg.reports.channel_id = reportChannel.channelId;
  if (reportChannel?.pingRoleIds?.length) cfg.reports.action_roles = reportChannel.pingRoleIds;

  // ---- punishment DMs ----
  cfg.punishment_dms.enabled = moderation.notify?.userOnPunish ?? true;

  // ---- welcome / goodbye / booster ----
  const messages = (welcome.messages ?? []) as any[];
  const byEvent: Record<string, any> = {};
  for (const m of messages) {
    if (m.eventName) byEvent[m.eventName] = m;
  }
  const buildGreeting = (m: any): string | undefined => {
    if (!m) return undefined;
    const json = m.json ?? {};
    const parts: string[] = [];
    if (json.content) parts.push(replacePlaceholders(String(json.content)));
    const embeds = (json.embeds ?? []) as any[];
    for (const e of embeds) {
      if (e.title) parts.push(`**${replacePlaceholders(String(e.title))}**`);
      if (e.description) parts.push(replacePlaceholders(String(e.description)));
    }
    return parts.join('\n');
  };
  const joinMsg = byEvent['userJoin'];
  const leaveMsg = byEvent['userLeave'];
  const boostMsg = byEvent['userBoost'];
  cfg.welcome = {
    enabled: Boolean(joinMsg),
    channel_id: joinMsg?.channelId ?? undefined,
    message: buildGreeting(joinMsg) ?? 'Welcome {user} to {guild}!',
  };
  cfg.goodbye = {
    enabled: Boolean(leaveMsg),
    channel_id: leaveMsg?.channelId ?? undefined,
    message: buildGreeting(leaveMsg) ?? '{user} has left {guild}.',
  };
  cfg.booster = {
    enabled: Boolean(boostMsg),
    channel_id: boostMsg?.channelId ?? undefined,
    message: buildGreeting(boostMsg) ?? 'Thank you for boosting {guild}, {user}!',
  };

  // ---- role connections ----
  const connections = (roles.connections ?? []) as Array<{ id: string; conditions: SapCondition[] }>;
  const rc: any[] = [];
  for (const conn of connections) {
    for (const cond of conn.conditions) {
      if (cond.type === 1 && cond.value) {
        rc.push({ enabled: true, if_has_role: cond.value, held_for_seconds: 0, then_add: [conn.id], then_remove: [] });
      }
    }
  }
  cfg.role_connections = rc;

  // ---- channel locking preset ----
  const lockCfg = moderation.channelLock;
  if (lockCfg) {
    cfg.channel_locking.presets = [
      {
        name: 'lockdown-all',
        channels: lockCfg.lockAllChannelIds ?? [],
        categories: [],
        all_channels: false,
        exclude_roles: lockCfg.whitelistedRoleIds ?? [],
        deny_permissions: ['SendMessages', 'AddReactions'],
        schedule: [],
      },
    ];
  }

  // ---- logging ----
  const enabledLogTypes = (logging.enabledLogTypes ?? {}) as Record<string, string>;
  const logMap: Record<string, unknown> = {};
  let unmapped = 0;
  for (const [sapEvent, channelId] of Object.entries(enabledLogTypes)) {
    const mapped = mapLogEvent(sapEvent);
    if (mapped && typeof channelId === 'string' && channelId) {
      if (logMap[mapped] && logMap[mapped] !== channelId) {
        // keep first routing, note collision
      }
      logMap[mapped] = { enabled: true, channel_id: channelId };
    } else {
      unmapped++;
    }
  }
  cfg.logging = logMap;

  // ---- custom commands (config-driven) ----
  const sapCustomCommands = (commands.customCommands ?? []) as any[];
  const templateByName = new Map<string, any>();
  for (const t of (messagesData.templates ?? []) as any[]) templateByName.set(String(t.name), t);
  for (const m of (messagesData.messages ?? []) as any[]) {
    if (m?.name && !templateByName.has(String(m.name))) templateByName.set(String(m.name), m);
  }

  const ccMap: Record<string, any> = cfg.custom_commands ?? {};
  for (const sc of sapCustomCommands) {
    const name = String(sc.name ?? '').toLowerCase().trim();
    if (!name) continue;
    const entry: Record<string, unknown> = { ...(ccMap[name] ?? {}) };
    entry.enabled = sc.enabled !== false;
    entry.slash = !BUILTIN_SLASH_NAMES.has(name);
    entry.prefix = true;
    if (sc.restrictions) {
      const perms = mapPerms(sc.restrictions.permissions);
      if (perms.length > 0) entry.permissions = perms;
      if (Array.isArray(sc.restrictions.roleIds) && sc.restrictions.roleIds.length > 0) {
        entry.allowed_roles = sc.restrictions.roleIds;
      }
      if (Array.isArray(sc.restrictions.channelIds) && sc.restrictions.channelIds.length > 0) {
        entry.channel_ids = sc.restrictions.channelIds;
      }
    }
    if (Array.isArray(sc.aliases) && sc.aliases.length > 0) {
      entry.aliases = (sc.aliases as string[]).map((a) => a.toLowerCase());
    }
    if (typeof sc.ephemeral === 'boolean') entry.ephemeral = sc.ephemeral;
    if (sc.deleteInput !== undefined) {
      entry.delete_input = sc.deleteInput === false ? false : sc.deleteInput === true ? 0 : Math.max(0, Number(sc.deleteInput) || 0);
    }
    if (sc.deleteOutput !== undefined) {
      entry.delete_output = sc.deleteOutput === false ? false : sc.deleteOutput === true ? 0 : Math.max(0, Number(sc.deleteOutput) || 0);
    }
    if (typeof sc.suppressMessageReply === 'boolean') entry.suppress_reply = sc.suppressMessageReply;
    if (Array.isArray(sc.cooldown) && sc.cooldown.length > 0) {
      const n = Number(sc.cooldown[0]);
      if (Number.isFinite(n) && n > 0) entry.cooldown_seconds = n;
    }

    const actions: any[] = [];
    for (const group of sc.actions ?? []) {
      for (const a of group ?? []) {
        if (a?.type === 'sendmessage') {
          const template = templateByName.get(String(a.value));
          if (template) {
            actions.push({ type: 'send_message', ...convertTemplateToPayload(template) });
          } else {
            importNotes.push(`[custom:${name}] no template found for sendmessage value "${a.value}"`);
          }
        } else if (a?.type === 'delete') {
          actions.push({ type: 'delete_message' });
        } else {
          importNotes.push(`[custom:${name}] skipped unknown action type "${a?.type}"`);
        }
      }
    }
    if (actions.length === 0) {
      importNotes.push(`[custom:${name}] produced no actions — skipped`);
      continue;
    }
    entry.actions = actions;
    ccMap[name] = entry;
  }
  cfg.custom_commands = ccMap;

  fs.writeFileSync(configPath, YAML.stringify(cfg, { indent: 2, lineWidth: 0 }), 'utf8');

  const result = configSchema.safeParse(cfg);
  const issues: string[] = [];
  if (!result.success) {
    for (const i of result.error.issues) {
      issues.push(`  ${i.path.join('.')}: ${i.message}`);
    }
  } else {
    for (const i of runCrossFieldChecks(result.data)) {
      issues.push(`  ${i.path}: ${i.expected} (found ${i.found})`);
    }
  }

  console.log(`Wrote ${configPath}`);
  console.log(`Imported: ${groups.length} word groups -> ${regexRules.length} regex rules, ${rc.length} role connections, ${Object.keys(logMap).length} log routes, ${Object.keys(cmdMap).length} command entries, ${Object.keys(ccMap).length} custom commands`);
  console.log(`Unmapped Sapphire log events: ${unmapped}`);
  if (importNotes.length > 0) {
    console.log('Import notes:');
    for (const n of importNotes) console.log(`  - ${n}`);
  }
  if (issues.length > 0) {
    console.log('VALIDATION ISSUES:');
    for (const i of issues) console.log(i);
    process.exit(1);
  }
  console.log('Config validated OK.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});