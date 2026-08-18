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
  type MessageCreateOptions,
} from 'discord.js';

export interface V2MessageOptions {
  imageUrl?: string;
  buttons?: Array<{ customId: string; label: string; style?: ButtonStyle; disabled?: boolean }>;
  accentColor?: string;
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
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(b.customId)
          .setLabel(b.label)
          .setStyle(b.style ?? ButtonStyle.Secondary)
          .setDisabled(b.disabled ?? false),
      );
    }
    container.addActionRowComponents(row as never);
  }

  if (opts.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(opts.imageUrl)),
    );
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
  return channel.send(payload as MessageCreateOptions);
}

export async function v2Reply(
  interaction: any,
  content: string,
  opts: V2MessageOptions & { ephemeral?: boolean } = {},
): Promise<void> {
  const payload = buildV2Content(content, opts);
  const flags = opts.ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;
  const body = { components: payload.components, flags };
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(body);
  } else {
    await interaction.reply(body);
  }
}