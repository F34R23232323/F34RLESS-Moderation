import * as fs from 'fs';
import * as path from 'path';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { loadEnv, buildDatabaseUrl, createDbPool } from '../shared/src/index';
import type { MessageSpec, MessageComponentRow, MessageButtonSpec, MessageSelectSpec, MessageSelectOptionSpec, MessageAction } from '../bot/src/utils/messageBuilder';

const GUILD = '1466990155020898413';
const DEFAULT_ACCENT = '#5865F2';

// ---------------------------------------------------------------------------
// Sapphire data shapes
// ---------------------------------------------------------------------------

interface SapEmoji {
  name?: string;
  id?: string;
  animated?: boolean;
}

interface SapAction {
  type: string;
  value?: unknown;
  roleIds?: string[];
  roleMode?: string;
  actions?: SapAction[];
}

interface SapButton {
  type: number;
  style?: number;
  label?: string;
  url?: string;
  custom_id?: string;
  disabled?: boolean;
  emoji?: SapEmoji;
}

interface SapSelectOption {
  name?: string;
  label?: string;
  value?: string;
  description?: string;
  emoji?: SapEmoji;
  default?: boolean;
  actions?: SapAction[];
}

interface SapSelect {
  type: number;
  custom_id?: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options?: SapSelectOption[];
}

interface SapRow {
  type: number;
  components?: Array<SapButton | SapSelect>;
}

interface SapEmbed {
  title?: string;
  description?: string | string[];
  color?: number | string;
  url?: string;
  timestamp?: string;
  thumbnail?: string;
  image?: string;
  author?: { name?: string; url?: string; icon?: string };
  fields?: Array<{ name?: string; value?: string; inline?: boolean }>;
  footer?: { text?: string; icon?: string };
  type?: string;
}

interface SapTemplate {
  name: string;
  json?: {
    content?: string;
    embeds?: SapEmbed[];
    components?: SapRow[];
    removeEmptyLines?: boolean;
  };
  userId?: string;
  timestamp?: number;
  editedUserId?: string;
}

interface SapFile {
  templates: SapTemplate[];
  messages: SapTemplate[];
  customButtons: Array<{ name?: string; actions?: SapAction[] }>;
  customSelectMenus: Array<{
    name?: string;
    placeholder?: string;
    minValues?: number;
    maxValues?: number;
    options?: SapSelectOption[];
  }>;
  kits?: unknown[];
}

// ---------------------------------------------------------------------------
// Placeholder mapping (Sapphire ${...} -> this bot's {placeholder})
// ---------------------------------------------------------------------------

const PLACEHOLDER_PAIRS: Array<[RegExp, string]> = [
  [/<@\$\{userid\}>/g, '{user}'],
  [/\$\{usermention\}/g, '{user}'],
  [/\$\{userid\}/g, '{user}'],
  [/\$\{usertag\}/g, '{user.tag}'],
  [/\$\{guildname\}/g, '{guild}'],
  [/\$\{membercount\}/g, '{member_count}'],
  [/\$\{reason\}/g, '{reason}'],
  [/\$\{rule\}/g, '{rule}'],
  [/\$\{channelmention\}/g, '{channel}'],
  [/\$\{channelname\}/g, '{channel}'],
];

function mapPlaceholders(s: unknown): string {
  let out = s === undefined || s === null ? '' : String(s);
  for (const [re, to] of PLACEHOLDER_PAIRS) out = out.replace(re, to);
  return out;
}

function timestampMarkdown(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  if (ts === '${nowtimestamp}') return '{nowtimestamp}';
  const parsed = Date.parse(ts);
  if (!Number.isNaN(parsed)) return `<t:${Math.floor(parsed / 1000)}:f>`;
  return undefined;
}

function emojiToString(emoji: SapEmoji | undefined): string | undefined {
  if (!emoji) return undefined;
  const name = emoji.name ?? '';
  if (emoji.id) return `<${emoji.animated ? 'a' : ''}:${name}:${emoji.id}>`;
  return name || undefined;
}

// Sapphire's old custom emojis (hosted in servers our bot isn't in, or deleted)
// are unusable on components — Discord rejects the whole message. Map the known
// ones to a working unicode equivalent so nothing is lost.
const SAPPHIRE_EMOJI_TO_UNICODE: Record<string, string> = {
  x_red: '❌',
  shield: '🛡️',
  exclamation_mark_red: '❗',
  exclamation_mark_orange: '⚠️',
  link: '🔗',
  blue_link: '🔗',
  blue_pin: '📌',
  clock: '⏰',
  pen: '✏️',
  check_mark_green: '✅',
  crown: '👑',
  hammer: '🔨',
  topggstar: '⭐',
  search: '🔍',
  key: '🔑',
  sapphcelebrate: '🎉',
  book: '📖',
  blue_hexagon: '🔷',
  mute: '🔇',
  '18plus': '🔞',
  bell: '🔔',
  bulb: '💡',
  sapphtada: '🎉',
  verified: '✅',
  sapphangry: '😠',
  appealgg: '⚖️',
  gavelbadge_1: '⚖️',
  shieldbadge_1: '🛡️',
  crossbadge_1: '❌',
  unhappyfacebadge_1: '😞',
  personbadge_1: '👤',
  foldedpaperbadge_1: '📄',
  moderatefacebadge_1: '😠',
  clipboardbadge_1: '📋',
  faqbadge_1: '❓',
  robotbadge_1: '🤖',
  ticketbadge_1: '🎫',
};

const EMOJI_FALLBACK = '⭐';

async function fetchAvailableEmojiIds(env: ReturnType<typeof loadEnv>): Promise<Set<string>> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD}/emojis`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
    if (!res.ok) return new Set();
    const emojis = (await res.json()) as Array<{ id: string }>;
    return new Set(emojis.map((e) => e.id));
  } catch {
    return new Set();
  }
}

// Replace a custom emoji with its unicode equivalent if it isn't available to
// the bot; keep unicode and available custom emojis untouched.
function fixEmojiString(emoji: string, availableIds: Set<string>): string {
  const m = /^<a?:(\w+):(\d+)>$/.exec(emoji);
  if (!m) return emoji;
  if (availableIds.has(m[2])) return emoji;
  return SAPPHIRE_EMOJI_TO_UNICODE[m[1].toLowerCase()] ?? EMOJI_FALLBACK;
}

// Fix every custom emoji inside a text block (descriptions etc.).
function fixEmojisInText(text: string, availableIds: Set<string>): string {
  return text.replace(/<a?:(\w+):(\d+)>/g, (full, name: string, id: string) =>
    availableIds.has(id) ? full : (SAPPHIRE_EMOJI_TO_UNICODE[name.toLowerCase()] ?? EMOJI_FALLBACK),
  );
}

function sanitizeEmojis(spec: MessageSpec, availableIds: Set<string>): MessageSpec {
  if (spec.content) spec.content = fixEmojisInText(spec.content, availableIds);
  if (spec.container?.textDisplays) {
    spec.container.textDisplays = spec.container.textDisplays.map((t) => fixEmojisInText(t, availableIds));
  }
  for (const row of spec.components ?? []) {
    for (const c of row.components) {
      if (c.type === 'button' && c.emoji) c.emoji = fixEmojiString(c.emoji, availableIds);
      if (c.type === 'select') {
        for (const o of c.options) {
          if (o.emoji) o.emoji = fixEmojiString(o.emoji, availableIds);
        }
      }
    }
  }
  return spec;
}

function normalizeName(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function colorToHex(color: number | string | undefined): string | undefined {
  if (color === undefined || color === null) return undefined;
  if (typeof color === 'number') return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
  const s = String(color).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^\d{1,10}$/.test(s)) return `#${(Number(s) & 0xffffff).toString(16).padStart(6, '0')}`;
  return undefined;
}

// ---------------------------------------------------------------------------
// Action mapping (Sapphire actions -> this bot's MessageActions)
// ---------------------------------------------------------------------------

type NameResolver = (name: string) => number | null;

function mapSapAction(
  a: SapAction,
  resolve: NameResolver,
  notes: string[],
  context: string,
): MessageAction[] {
  switch (a.type) {
    case 'sendmessage': {
      const v = (a.value ?? {}) as { name?: string; ephemeral?: boolean };
      if (!v.name) return [];
      return [
        {
          type: 'send_message_template',
          templateName: v.name,
          messageId: resolve(v.name) ?? undefined,
          ephemeral: v.ephemeral === true,
        },
      ];
    }
    case 'editmessage': {
      const name = String(a.value ?? '');
      if (!name) return [];
      return [
        {
          type: 'edit_message_template',
          templateName: name,
          messageId: resolve(name) ?? undefined,
        },
      ];
    }
    case 'addroles': {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      return ids.filter(Boolean).map((roleId) => ({ type: 'role_add' as const, roleId }));
    }
    case 'toggleroles': {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      return ids.filter(Boolean).map((roleId) => ({ type: 'role_toggle' as const, roleId }));
    }
    case 'removeroles': {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      return ids.filter(Boolean).map((roleId) => ({ type: 'role_remove' as const, roleId }));
    }
    default:
      notes.push(`[${context}] skipped action type "${a.type}"`);
      return [];
  }
}

function buttonActions(customId: string | undefined, customButtons: Record<string, SapAction[]>, resolve: NameResolver, notes: string[], context: string): MessageAction[] {
  if (!customId) return [];
  const groups = customButtons[customId] ?? [];
  const out: MessageAction[] = [];
  for (const group of groups) {
    for (const a of group.actions ?? []) out.push(...mapSapAction(a, resolve, notes, `${context}/${customId}`));
  }
  return out;
}

function optionActions(option: SapSelectOption, resolve: NameResolver, notes: string[], context: string): MessageAction[] {
  const out: MessageAction[] = [];
  for (const a of option.actions ?? []) out.push(...mapSapAction(a, resolve, notes, context));
  return out;
}

// ---------------------------------------------------------------------------
// Message conversion: Sapphire template -> Components V2 MessageSpec
// ---------------------------------------------------------------------------

const BTN_STYLE: Record<number, string> = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link' };

function embedToBlocks(e: SapEmbed): { blocks: string[]; media: string[] } {
  const blocks: string[] = [];
  if (e.author?.name) blocks.push(`**${mapPlaceholders(e.author.name)}**`);
  const title = e.title ? mapPlaceholders(e.title).trim() : '';
  if (title) blocks.push(e.url ? `[**${title}**](${e.url})` : `# ${title}`);
  if (e.description) {
    const desc = (Array.isArray(e.description) ? e.description : [e.description])
      .map((line) => mapPlaceholders(String(line)))
      .join('\n');
    if (desc.trim()) blocks.push(desc);
  }
  for (const f of e.fields ?? []) {
    const name = mapPlaceholders(f.name ?? '').trim();
    const value = mapPlaceholders(f.value ?? '');
    if (!name && !value.trim()) continue;
    blocks.push(name ? `**${name}**${value.trim() ? `\n${value}` : ''}` : value);
  }
  const footerBits: string[] = [];
  if (e.footer?.text) footerBits.push(mapPlaceholders(e.footer.text));
  const ts = timestampMarkdown(e.timestamp);
  if (ts) footerBits.push(ts);
  if (footerBits.length > 0) blocks.push(`-# ${footerBits.join(' · ')}`);

  const media: string[] = [];
  const mediaUrl = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v.trim() || undefined;
    if (v && typeof v === 'object' && 'url' in (v as Record<string, unknown>)) {
      const u = (v as { url?: unknown }).url;
      if (typeof u === 'string') return u.trim() || undefined;
    }
    return undefined;
  };
  const thumb = mediaUrl(e.thumbnail);
  if (thumb) media.push(mapPlaceholders(thumb));
  const img = mediaUrl(e.image);
  if (img) media.push(mapPlaceholders(img));
  return { blocks, media };
}

function convertComponents(
  rows: SapRow[] | undefined,
  customButtons: Record<string, SapAction[]>,
  customSelectMenus: Record<string, SapFile['customSelectMenus'][number]>,
  resolve: NameResolver,
  notes: string[],
  context: string,
): MessageComponentRow[] {
  let uid = 0;
  const out: MessageComponentRow[] = [];
  for (const row of rows ?? []) {
    const comps: Array<MessageButtonSpec | MessageSelectSpec> = [];
    for (const raw of row.components ?? []) {
      if (raw.type === 2) {
        const b = raw as SapButton;
        const btn: MessageButtonSpec = {
          type: 'button',
          id: `c${++uid}`,
          label: b.label ?? 'Button',
          style: BTN_STYLE[b.style ?? 2] ?? 'secondary',
          disabled: b.disabled ?? false,
        };
        if (b.emoji) btn.emoji = emojiToString(b.emoji);
        if (b.url) {
          btn.style = 'link';
          btn.url = b.url;
        } else {
          const actions = buttonActions(b.custom_id, customButtons, resolve, notes, context);
          if (actions.length > 0) btn.actions = actions;
        }
        comps.push(btn);
      } else if (raw.type === 3) {
        const s = raw as SapSelect;
        const menu = customSelectMenus[s.custom_id ?? ''] ?? null;
        const sel: MessageSelectSpec = {
          type: 'select',
          id: `c${++uid}`,
          placeholder: s.placeholder ?? menu?.placeholder,
          minValues: s.min_values ?? menu?.minValues ?? 1,
          maxValues: s.max_values ?? menu?.maxValues ?? 1,
          options: [],
        };
        // The template's own options carry the display data (label, description,
        // emoji); the menu definition carries the actions per option. Sapphire
        // stores menu options by a name that is often truncated to 20 chars and
        // sometimes differs from the template's value, so match leniently.
        const matchMenuOption = (value: string, index: number): SapSelectOption | undefined => {
          const menuOptions = menu?.options ?? [];
          const target = normalizeName(value);
          if (target) {
            const exact = menuOptions.find((o) => normalizeName(o.name ?? o.value ?? '') === target);
            if (exact) return exact;
            const prefix = menuOptions.find(
              (o) => normalizeName(o.name ?? o.value ?? '').startsWith(target) || target.startsWith(normalizeName(o.name ?? o.value ?? '')),
            );
            if (prefix) return prefix;
          }
          return menuOptions[index];
        };
        const templateOptions = s.options ?? [];
        for (let i = 0; i < templateOptions.length; i++) {
          const o = templateOptions[i];
          const opt: MessageSelectOptionSpec = {
            label: o.label ?? o.name ?? o.value ?? 'Option',
            value: o.value ?? o.name ?? 'option',
          };
          if (o.description) opt.description = o.description;
          if (o.emoji) opt.emoji = emojiToString(o.emoji);
          const acts = optionActions(matchMenuOption(opt.value, i) ?? {}, resolve, notes, context);
          if (acts.length > 0) opt.actions = acts;
          sel.options.push(opt);
        }
        if (sel.options.length === 0) {
          for (const o of menu?.options ?? []) {
            const opt: MessageSelectOptionSpec = {
              label: o.label ?? o.name ?? o.value ?? 'Option',
              value: o.value ?? o.name ?? 'option',
            };
            if (o.description) opt.description = o.description;
            if (o.emoji) opt.emoji = emojiToString(o.emoji);
            const acts = optionActions(o, resolve, notes, context);
            if (acts.length > 0) opt.actions = acts;
            sel.options.push(opt);
          }
        }
        comps.push(sel);
      }
    }
    if (comps.length > 0) out.push({ components: comps });
  }
  return out;
}

function buildSpec(
  t: SapTemplate,
  customButtons: Record<string, SapAction[]>,
  customSelectMenus: Record<string, SapFile['customSelectMenus'][number]>,
  resolve: NameResolver,
  notes: string[],
): MessageSpec {
  const json = (t.json ?? t) as NonNullable<SapTemplate['json']>;
  const embeds = (json.embeds ?? []).filter((e): e is SapEmbed => Boolean(e && typeof e === 'object'));
  const blocks: string[] = [];
  const media: string[] = [];
  let accent: string | undefined;
  for (const e of embeds) {
    if (!accent) accent = colorToHex(e.color);
    const r = embedToBlocks(e);
    blocks.push(...r.blocks);
    media.push(...r.media);
  }
  const content = json.content ? mapPlaceholders(String(json.content)).trim() : '';

  const spec: MessageSpec = {
    kind: 'v2',
    content: content || undefined,
    container: {
      accentColor: accent ?? DEFAULT_ACCENT,
      textDisplays: blocks,
      media: media.length > 0 ? media : undefined,
      separators: true,
    },
  };
  const components = convertComponents(json.components, customButtons, customSelectMenus, resolve, notes, t.name);
  if (components.length > 0) spec.components = components;
  return spec;
}

// ---------------------------------------------------------------------------
// DB import (idempotent: upserts by (guild_id, name))
// ---------------------------------------------------------------------------

async function upsertRow(pool: Pool, guildId: string, name: string, spec: MessageSpec, createdBy: string | null): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM saved_messages WHERE guild_id = ? AND name = ? ORDER BY id LIMIT 1',
    [guildId, name],
  );
  const payload = JSON.stringify(spec);
  if (rows.length > 0) {
    await pool.execute('UPDATE saved_messages SET kind = ?, payload = ?, created_by = ? WHERE id = ?', ['v2', payload, createdBy, rows[0].id]);
    return Number(rows[0].id);
  }
  const [result] = await pool.execute(
    'INSERT INTO saved_messages (guild_id, name, kind, payload, created_by) VALUES (?, ?, ?, ?, ?)',
    [guildId, name, 'v2', payload, createdBy],
  );
  return (result as { insertId: number }).insertId;
}

function resolveUnresolved(spec: MessageSpec, byName: Map<string, number>): { spec: MessageSpec; unresolved: string[]; changed: boolean } {
  const unresolved: string[] = [];
  let changed = false;
  const fixAction = (a: MessageAction): MessageAction => {
    if (a.messageId === undefined && typeof a.templateName === 'string') {
      changed = true;
      const id = byName.get(a.templateName);
      if (id !== undefined) return { ...a, messageId: id };
      unresolved.push(a.templateName);
    }
    return a;
  };
  const fixList = (list?: MessageAction[]): MessageAction[] | undefined => list?.map(fixAction);
  const specCopy: MessageSpec = JSON.parse(JSON.stringify(spec));
  if (specCopy.components) {
    specCopy.components = specCopy.components.map((row) => ({
      components: row.components.map((c) =>
        c.type === 'button'
          ? { ...c, actions: fixList(c.actions), ...(c.action ? { action: fixAction(c.action) } : {}) }
          : {
              ...c,
              actions: fixList(c.actions),
              ...(c.action ? { action: fixAction(c.action) } : {}),
              options: c.options.map((o) => ({
                ...o,
                actions: fixList(o.actions),
                ...(o.action ? { action: fixAction(o.action) } : {}),
              })),
            },
      ),
    }));
  }
  return { spec: specCopy, unresolved, changed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const fileArg = process.argv[2];
  const filePath = path.resolve(process.cwd(), fileArg ?? 'messagesData-1466990155020898413.json');
  if (!fs.existsSync(filePath)) throw new Error(`Missing import file: ${filePath}`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SapFile;

  const env = loadEnv();
  const pool = createDbPool(buildDatabaseUrl(env));
  const availableEmojiIds = await fetchAvailableEmojiIds(env);
  const notes: string[] = [];
  const createdBy = (data.templates[0]?.userId || data.templates[0]?.editedUserId || null) ?? null;

  const customButtons: Record<string, SapAction[]> = {};
  for (const cb of data.customButtons ?? []) if (cb.name) customButtons[cb.name] = cb.actions ?? [];
  const customSelectMenus: Record<string, SapFile['customSelectMenus'][number]> = {};
  for (const sm of data.customSelectMenus ?? []) if (sm.name) customSelectMenus[sm.name] = sm;

  // Initial pass: everything except messageId resolution (names not known yet).
  const initial: Array<{ name: string; spec: MessageSpec }> = [];
  const entries: SapTemplate[] = [...(data.templates ?? []), ...(data.messages ?? [])];
  const seen = new Set<string>();
  const noResolve = () => null;
  for (const t of entries) {
    if (!t.name) continue;
    const key = t.name.toLowerCase();
    if (seen.has(key)) {
      notes.push(`[${t.name}] duplicate name, skipped`);
      continue;
    }
    seen.add(key);
    initial.push({ name: t.name, spec: buildSpec(t, customButtons, customSelectMenus, noResolve, notes) });
  }

  // Insert/update everything, then resolve name -> id references.
  const byName = new Map<string, number>();
  for (const { name, spec } of initial) {
    const id = await upsertRow(pool, GUILD, name, sanitizeEmojis(spec, availableEmojiIds), createdBy);
    byName.set(name, id);
  }

  const unresolvedNames = new Set<string>();
  let updated = 0;
  for (const { name, spec } of initial) {
    const id = byName.get(name)!;
    const { spec: resolved, unresolved, changed } = resolveUnresolved(spec, byName);
    for (const u of unresolved) unresolvedNames.add(u);
    if (!changed) continue;
    await pool.execute('UPDATE saved_messages SET payload = ? WHERE id = ?', [JSON.stringify(resolved), id]);
    updated++;
  }

  // mysql2's pool.end() can hang when the pool was created via `uri`; the work
  // is already committed, so just close best-effort and exit.
  void pool.end().catch(() => undefined);
  setTimeout(() => process.exit(0), 1000);

  console.log(`Imported ${initial.length} messages into saved_messages (guild ${GUILD})`);
  const templateCount = data.templates?.length ?? 0;
  const messageCount = data.messages?.length ?? 0;
  console.log(`  templates: ${templateCount}, system messages: ${messageCount}`);
  console.log(`  custom buttons wired: ${Object.keys(customButtons).length}, select menus wired: ${Object.keys(customSelectMenus).length}`);
  if (unresolvedNames.size > 0) {
    console.log('UNRESOLVED action targets (messageId left unset):');
    for (const u of unresolvedNames) console.log(`  - ${u}`);
  }
  if (notes.length > 0) {
    console.log('Import notes:');
    for (const n of notes) console.log(`  - ${n}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
