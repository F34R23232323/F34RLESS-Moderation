import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { renderPlaceholders, type PlaceholderContext } from '../../../shared/src/index';
import { hexToInt } from './v2';

export interface MessageAction {
  type: string;
  roleId?: string;
  content?: string;
  messageId?: number | string;
  channelId?: string;
  ephemeral?: boolean;
  [k: string]: unknown;
}

export interface MessageButtonSpec {
  type: 'button';
  id: string;
  label: string;
  style?: string;
  url?: string;
  customId?: string;
  emoji?: string;
  disabled?: boolean;
  action?: MessageAction;
  actions?: MessageAction[];
}

export interface MessageSelectOptionSpec {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  action?: MessageAction;
  actions?: MessageAction[];
}

export interface MessageSelectSpec {
  type: 'select';
  id: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  customId?: string;
  options: MessageSelectOptionSpec[];
  action?: MessageAction;
  actions?: MessageAction[];
}

export function componentActions(comp: MessageButtonSpec | MessageSelectSpec): MessageAction[] {
  if (comp.actions && comp.actions.length > 0) return comp.actions;
  if (comp.action) return [comp.action];
  return [];
}

export function optionActions(option: MessageSelectOptionSpec): MessageAction[] {
  if (option.actions && option.actions.length > 0) return option.actions;
  if (option.action) return [option.action];
  return [];
}

export interface MessageComponentRow {
  components: Array<MessageButtonSpec | MessageSelectSpec>;
}

export interface MessageEmbedSpec {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  timestamp?: boolean;
  image?: string;
  thumbnail?: string;
  author?: { name?: string; url?: string; icon?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text?: string; icon?: string };
}

export interface MessageSpec {
  kind: 'v1' | 'v2';
  content?: string;
  embeds?: MessageEmbedSpec[];
  components?: MessageComponentRow[];
  container?: {
    accentColor?: string;
    textDisplays?: string[];
    media?: string[];
    separators?: boolean;
  };
}

export function componentCustomId(savedMessageId: string, compId: string): string {
  return `mb:${savedMessageId}:${compId}`;
}

const STYLE: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

export function clientEmojiIds(client: { emojis: { cache: Map<string, unknown> } }): Set<string> {
  return new Set(client.emojis.cache.keys());
}

// Custom emojis (<name:id>) are validated by Discord when used on components:
// if the bot can't use the emoji, the ENTIRE message is rejected. Drop any that
// are not in `availableEmojis` (unicode emojis are always kept).
function usableEmoji(emoji: string | undefined, availableEmojis: Set<string> | undefined): string | undefined {
  if (!emoji) return undefined;
  const m = /^<a?:(\w+):(\d+)>$/.exec(emoji);
  if (m && availableEmojis && !availableEmojis.has(m[2])) return undefined;
  return emoji;
}

function buildComponents(spec: MessageSpec, savedMessageId: string, availableEmojis?: Set<string>): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const clamp = (s: string | undefined, max: number): string => (s === undefined ? '' : s.length > max ? s.slice(0, max) : s);
  for (const row of spec.components ?? []) {
    const actionRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>();
    for (const comp of row.components) {
      if (comp.type === 'button') {
        const button = new ButtonBuilder().setLabel(clamp(comp.label, 80)).setDisabled(comp.disabled ?? false);
        const emoji = usableEmoji(comp.emoji, availableEmojis);
        if (emoji) button.setEmoji(emoji);
        if (comp.url) {
          actionRow.addComponents(button.setStyle(ButtonStyle.Link).setURL(comp.url));
        } else {
          actionRow.addComponents(
            button
              .setStyle(STYLE[comp.style ?? 'secondary'] ?? ButtonStyle.Secondary)
              .setCustomId(comp.customId ?? componentCustomId(savedMessageId, comp.id)),
          );
        }
      } else {
        const optCount = Math.max(1, comp.options.length);
        const minValues = Math.max(1, Math.min(comp.minValues ?? 1, optCount, 25));
        const maxValues = Math.max(minValues, Math.min(comp.maxValues ?? minValues, optCount, 25));
        const select = new StringSelectMenuBuilder()
          .setCustomId(comp.customId ?? componentCustomId(savedMessageId, comp.id))
          .setPlaceholder(clamp(comp.placeholder, 150) || 'Select an option')
          .setMinValues(minValues)
          .setMaxValues(maxValues);
        for (const opt of comp.options) {
          const builder = new StringSelectMenuOptionBuilder()
            .setLabel(clamp(opt.label, 100))
            .setValue(clamp(opt.value, 100));
          if (opt.description) builder.setDescription(clamp(opt.description, 100));
          const emoji = usableEmoji(opt.emoji, availableEmojis);
          if (emoji) builder.setEmoji(emoji);
          select.addOptions(builder);
        }
        actionRow.addComponents(select);
      }
    }
    rows.push(actionRow);
  }
  return rows;
}

export function buildMessagePayload(spec: MessageSpec, savedMessageId: string, availableEmojis?: Set<string>): Record<string, unknown> {
  if (spec.kind === 'v2') {
    let displays = [spec.content ?? '', ...(spec.container?.textDisplays ?? [])].filter(Boolean);
    const withSeparators = spec.container?.separators !== false;
    // Media gallery only accepts real URLs; template placeholders that never
    // resolved would otherwise fail the whole message build.
    const media = (spec.container?.media ?? [])
      .map((m) => String(m).trim())
      .filter((m) => /^(https?|attachment):\/\//i.test(m))
      .slice(0, 10);
const rows = buildComponents(spec, savedMessageId, availableEmojis);

    // Discord caps a v2 message at 40 total components (every nested one
    // counts). Build the full layout, then degrade gracefully when a large
    // template would exceed the cap: drop separators first, then merge text
    // blocks — nothing is ever dropped.
    const MAX_TOTAL_ITEMS = 40;
    const buildItems = (ds: string[], seps: boolean): Array<{ kind: 'display' | 'sep' | 'media' | 'row'; value: string | string[] | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> }> => {
      const items: Array<{ kind: 'display' | 'sep' | 'media' | 'row'; value: string | string[] | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> }> = [];
      ds.forEach((d, i) => {
        items.push({ kind: 'display', value: d });
        if (seps && i < ds.length - 1) items.push({ kind: 'sep', value: '' });
      });
      if (media.length > 0) items.push({ kind: 'media', value: media });
      for (const row of rows) items.push({ kind: 'row', value: row });
      return items;
    };

    let items = buildItems(displays, withSeparators);
    if (items.length > MAX_TOTAL_ITEMS) items = buildItems(displays, false);
    while (items.length > MAX_TOTAL_ITEMS && displays.length > 1) {
      const last = displays.pop()!;
      displays[displays.length - 1] = `${displays[displays.length - 1]}\n\n${last}`;
      items = buildItems(displays, false);
    }

    const MAX_CONTAINER_ITEMS = 36;
    const chunks: Array<typeof items> = [];
    for (let i = 0; i < items.length; i += MAX_CONTAINER_ITEMS) {
      chunks.push(items.slice(i, i + MAX_CONTAINER_ITEMS));
    }
    if (chunks.length === 0) chunks.push([]);

    const containers = chunks.map((chunk) => {
      const container = new ContainerBuilder();
      if (spec.container?.accentColor) {
        const num = hexToInt(spec.container.accentColor);
        if (num !== undefined) container.setAccentColor(num as never);
      }
      for (const item of chunk) {
        if (item.kind === 'display') {
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(item.value)));
        } else if (item.kind === 'sep') {
          container.addSeparatorComponents(new SeparatorBuilder());
        } else if (item.kind === 'media') {
          const gallery = new MediaGalleryBuilder();
          for (const url of item.value as string[]) gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
          container.addMediaGalleryComponents(gallery);
        } else {
          container.addActionRowComponents(item.value as never);
        }
      }
      return container;
    });

    return { components: containers as unknown[], flags: MessageFlags.IsComponentsV2 };
  }

  const payload: Record<string, unknown> = {};
  if (spec.content) payload.content = spec.content;
  if (spec.embeds && spec.embeds.length > 0) {
    payload.embeds = spec.embeds.map((e) => {
      const b = new EmbedBuilder();
      if (e.title) b.setTitle(e.title);
      if (e.description) b.setDescription(e.description);
      if (e.color) b.setColor(hexToInt(e.color) ?? 0x5865f2);
      if (e.url) b.setURL(e.url);
      if (e.timestamp) b.setTimestamp();
      if (e.image) b.setImage(e.image);
      if (e.thumbnail) b.setThumbnail(e.thumbnail);
      if (e.author?.name) b.setAuthor({ name: e.author.name, url: e.author.url, iconURL: e.author.icon });
      for (const f of e.fields ?? []) b.addFields({ name: f.name, value: f.value, inline: f.inline ?? false });
      if (e.footer?.text) b.setFooter({ text: e.footer.text, iconURL: e.footer.icon });
      return b;
    });
  }
  const rows = buildComponents(spec, savedMessageId);
  if (rows.length > 0) payload.components = rows;
  return payload;
}

export function findComponent(spec: MessageSpec, compId: string): (MessageButtonSpec | MessageSelectSpec) | undefined {
  for (const row of spec.components ?? []) {
    const found = row.components.find((c) => c.id === compId);
    if (found) return found;
  }
  return undefined;
}

export function renderMessageSpecPlaceholders(spec: MessageSpec, placeholders: PlaceholderContext): MessageSpec {
  const render = (s?: string): string | undefined => (s !== undefined ? renderPlaceholders(s, placeholders) : s);
  const renderAction = (a: MessageAction): MessageAction =>
    a.content !== undefined ? { ...a, content: render(a.content) } : a;
  const renderActions = (list?: MessageAction[]): MessageAction[] | undefined => list?.map(renderAction);

  const rendered: MessageSpec = { kind: spec.kind, content: render(spec.content) };

  if (spec.embeds && spec.embeds.length > 0) {
    rendered.embeds = spec.embeds.map((e) => ({
      ...e,
      title: render(e.title),
      description: render(e.description),
      url: render(e.url),
      image: render(e.image),
      thumbnail: render(e.thumbnail),
      author: e.author ? { ...e.author, name: render(e.author.name) } : e.author,
      footer: e.footer ? { ...e.footer, text: render(e.footer.text) } : e.footer,
      fields: e.fields?.map((f) => ({ ...f, name: render(f.name) ?? '', value: render(f.value) ?? '' })),
    }));
  }

  if (spec.container) {
    rendered.container = {
      ...spec.container,
      textDisplays: spec.container.textDisplays?.map((d) => renderPlaceholders(d, placeholders)),
    };
  }

  if (spec.components && spec.components.length > 0) {
    rendered.components = spec.components.map((row) => ({
      components: row.components.map((c) =>
        c.type === 'button'
          ? {
              ...c,
              label: renderPlaceholders(c.label, placeholders),
              actions: renderActions(c.actions),
              ...(c.action ? { action: renderAction(c.action) } : {}),
            }
          : {
              ...c,
              placeholder: render(c.placeholder),
              options: c.options.map((o) => ({
                ...o,
                label: renderPlaceholders(o.label, placeholders),
                description: render(o.description),
                actions: renderActions(o.actions),
                ...(o.action ? { action: renderAction(o.action) } : {}),
              })),
            },
      ),
    }));
  }

  return rendered;
}