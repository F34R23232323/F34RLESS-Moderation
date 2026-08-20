import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
  type BaseInteraction,
  type Message,
  type MessageCreateOptions,
} from 'discord.js';

export interface V2MessageOptions {
  imageUrl?: string;
  imageUrls?: string[];
  buttons?: Array<{ customId?: string; label: string; style?: ButtonStyle; disabled?: boolean; url?: string }>;
  accentColor?: string;
  allowedMentions?: MessageCreateOptions['allowedMentions'];
}

export function buildV2Content(content: string, opts: V2MessageOptions = {}): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder();
  if (opts.accentColor) {
    const num = hexToInt(opts.accentColor);
    if (num !== undefined) container.setAccentColor(num as never);
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

  if (opts.buttons && opts.buttons.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const b of opts.buttons.slice(0, 5)) {
      const btn = new ButtonBuilder().setLabel(b.label).setDisabled(b.disabled ?? false);
      if (b.url) {
        btn.setStyle(b.style ?? ButtonStyle.Link).setURL(b.url);
      } else {
        btn.setStyle(b.style ?? ButtonStyle.Secondary).setCustomId(b.customId ?? `v2_${Date.now()}`);
      }
      row.addComponents(btn);
    }
    container.addActionRowComponents(row as never);
  }

  const urls = [...(opts.imageUrl ? [opts.imageUrl] : []), ...(opts.imageUrls ?? [])];
  if (urls.length > 0) {
    const gallery = new MediaGalleryBuilder();
    for (const url of urls.slice(0, 10)) gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
    container.addMediaGalleryComponents(gallery);
  }

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

export interface RichV2Options {
  accentColor: number;
  header: string;
  text: string;
  footer?: string;
  mediaUrls?: string[];
}

export function buildRichV2(opts: RichV2Options): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder()
    .setAccentColor(opts.accentColor as never)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${opts.header}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.text));

  if (opts.footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.footer));
  }

  if (opts.mediaUrls && opts.mediaUrls.length > 0) {
    const gallery = new MediaGalleryBuilder();
    for (const url of opts.mediaUrls.slice(0, 10)) {
      gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
    }
    container.addMediaGalleryComponents(gallery);
  }

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

export function hexToInt(hex: string | undefined): number | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : undefined;
}

export function v2Send(channel: any, content: string, opts: V2MessageOptions = {}) {
  const payload = buildV2Content(content, opts);
  return channel.send({
    ...payload,
    ...(opts.allowedMentions ? { allowedMentions: opts.allowedMentions } : {}),
  } as MessageCreateOptions);
}

export interface MessageReplyOptions {
  content?: string;
  imageUrl?: string;
  imageUrls?: string[];
  accentColor?: string;
  buttons?: Array<{ customId?: string; label: string; style?: ButtonStyle; disabled?: boolean; url?: string }>;
}

export async function v2MessageReply(message: Message, options: MessageReplyOptions = {}): Promise<Message> {
  const { content, ...opts } = options;
  const payload = buildV2Content(content ?? '', opts);
  return message.reply({ ...payload, allowedMentions: { parse: [], repliedUser: false } } as MessageCreateOptions);
}

export async function v2EditMessage(message: Message, content: string, opts: V2MessageOptions = {}): Promise<Message> {
  return message.edit({ ...buildV2Content(content, opts), allowedMentions: { parse: [], repliedUser: false } } as never);
}

export async function v2Reply(
  interaction: any,
  content: string,
  opts: V2MessageOptions & { ephemeral?: boolean } = {},
): Promise<void> {
  const payload = buildV2Content(content, opts);
  const flags = opts.ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;
  const allowedMentions = opts.allowedMentions ?? { parse: [] };
  const body = { components: payload.components, flags, allowedMentions };
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(body);
  } else {
    await interaction.reply(body);
  }
}