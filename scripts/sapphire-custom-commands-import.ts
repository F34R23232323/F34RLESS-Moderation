import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { configSchema } from '../shared/src/config/schema';

const GUILD = '1466990155020898413';

const COMMANDS_FILE = `commandsData-${GUILD}.json`;
const MESSAGES_FILE = `messagesData-${GUILD}.json`;

// Builtin slash commands this bot registers. Custom commands with the same
// name would collide at slash-registration time, so they are imported
// prefix-only (matching how Sapphire shadowed the builtins).
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

function readJson<T>(name: string): T {
  const p = path.resolve(process.cwd(), name);
  if (!fs.existsSync(p)) throw new Error(`Missing import file: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function mapPerms(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((p) => PERM_MAP[p]).filter((p): p is string => Boolean(p));
}

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
  const commands = readJson<any>(COMMANDS_FILE);
  const messagesData = readJson<any>(MESSAGES_FILE);

  const configPath = path.resolve(process.cwd(), 'config.yml');
  const cfg = YAML.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, any>;

  const templateByName = new Map<string, any>();
  for (const t of (messagesData.templates ?? []) as any[]) templateByName.set(String(t.name), t);
  for (const m of (messagesData.messages ?? []) as any[]) {
    if (m?.name && !templateByName.has(String(m.name))) templateByName.set(String(m.name), m);
  }

  const sapCustomCommands = (commands.customCommands ?? []) as any[];
  const ccMap: Record<string, any> = cfg.custom_commands ?? {};
  const notes: string[] = [];
  let imported = 0;

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
            notes.push(`[${name}] no template found for sendmessage value "${a.value}"`);
          }
        } else if (a?.type === 'delete') {
          actions.push({ type: 'delete_message' });
        } else {
          notes.push(`[${name}] skipped unknown action type "${a?.type}"`);
        }
      }
    }
    if (actions.length === 0) {
      notes.push(`[${name}] produced no actions — skipped`);
      continue;
    }
    entry.actions = actions;
    ccMap[name] = entry;
    imported++;
  }

  cfg.custom_commands = ccMap;
  fs.writeFileSync(configPath, YAML.stringify(cfg, { indent: 2, lineWidth: 0 }), 'utf8');

  const result = configSchema.safeParse(cfg);
  if (!result.success) {
    console.log('VALIDATION ISSUES:');
    for (const i of result.error.issues) {
      const received = (i as unknown as { received?: unknown }).received;
      console.log(`  ${i.path.join('.')}: ${i.message}${received !== undefined ? ` (received ${JSON.stringify(received)})` : ''}`);
    }
    process.exit(1);
  }

  console.log(`Wrote ${configPath}`);
  console.log(`Imported ${imported} custom commands (slash disabled for ${sapCustomCommands.filter((s) => BUILTIN_SLASH_NAMES.has(String(s.name).toLowerCase())).length} name collisions)`);
  if (notes.length > 0) {
    console.log('Import notes:');
    for (const n of notes) console.log(`  - ${n}`);
  }
  console.log('Config validated OK.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});