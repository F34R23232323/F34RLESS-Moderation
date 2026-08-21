import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type BaseInteraction,
  type Message,
  type MessageCreateOptions,
} from 'discord.js';

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

export interface ReportCardOptions {
  /** 'open' = pending; 'actioned' = accepted; 'ignored' = ignored; 'false' = false report */
  status: 'open' | 'actioned' | 'ignored' | 'false';
  reportId: number;
  reporterCount: number;
  /** Tag/display name + mention of the target user */
  targetTag: string | null;
  targetId: string | null;
  targetAvatarUrl: string | null;
  /** Unix seconds */
  targetCreatedAt: number | null;
  /** Unix seconds — null if not in server */
  targetJoinedAt: number | null;
  /** e.g. "WARN" */
  lastCaseType: string | null;
  /** Unix seconds of the last case */
  lastCaseAt: number | null;
  reason: string | null;
  targetContent: string | null;
  sourceChannelId: string | null;
  targetMessageId: string | null;
  guildId: string;
  /** Tag of the original reporter */
  reporterTag: string;
  reporterId: string;
  /** Populated when the card is a resolved archive */
  resolvedBy?: string | null;
  resolvedByTag?: string | null;
  resolvedNote?: string | null;
  /** First image attachment URL (shown in thumbnail when no avatar) */
  imageUrl?: string | null;
  pingRoleId?: string | null;
}

const ACCENT: Record<string, number> = {
  open: 0xf0b232,      // amber
  actioned: 0x57f287,  // green
  ignored: 0xed4245,   // red
  false: 0xed4245,     // red
};

const STATUS_LABEL: Record<string, string> = {
  open: '🏅 New report',
  actioned: '✅ Report accepted',
  ignored: '❌ Report ignored',
  false: '❌ Report ignored',
};

function relTime(unixSeconds: number): string {
  return `<t:${unixSeconds}:R>`;
}

export function buildReportCard(opts: ReportCardOptions): { components: unknown[]; flags: number; allowedMentions: { parse: []; roles?: string[] } } {
  const accentColor = ACCENT[opts.status] ?? ACCENT.open;

  const container = new ContainerBuilder().setAccentColor(accentColor as never);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerLabel = STATUS_LABEL[opts.status] ?? STATUS_LABEL.open;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${headerLabel}**`),
  );

  // ── User section (with avatar thumbnail) ──────────────────────────────────
  const userLines: string[] = ['**User**'];
  if (opts.targetTag && opts.targetId) {
    userLines.push(`User: ${opts.targetTag} (<@${opts.targetId}>)`);
  } else if (opts.targetId) {
    userLines.push(`User: <@${opts.targetId}>`);
  }
  if (opts.targetId) userLines.push(`ID: ${opts.targetId}`);
  if (opts.targetCreatedAt != null) {
    userLines.push(`Created: ${relTime(opts.targetCreatedAt)}`);
  }
  if (opts.targetJoinedAt != null) {
    userLines.push(`Joined: ${relTime(opts.targetJoinedAt)}`);
  }
  if (opts.lastCaseType && opts.lastCaseAt != null) {
    userLines.push(`Last case: ${opts.lastCaseType} ${relTime(opts.lastCaseAt)}`);
  }

  const avatarUrl = opts.targetAvatarUrl ?? opts.imageUrl;
  if (avatarUrl) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(userLines.join('\n')))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
    container.addSectionComponents(section as never);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(userLines.join('\n')));
  }

  // ── Reason(s) ─────────────────────────────────────────────────────────────
  if (opts.reason) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Reason(s)**\n> ${opts.reason.replace(/\n/g, '\n> ')}`),
    );
  }

  // ── Highlighted message(s) ────────────────────────────────────────────────
  if (opts.targetContent) {
    container.addSeparatorComponents(new SeparatorBuilder());
    let msgLine = `> ${String(opts.targetContent).slice(0, 800).replace(/\n/g, '\n> ')}`;
    if (opts.sourceChannelId && opts.targetMessageId) {
      const jumpUrl = `https://discord.com/channels/${opts.guildId}/${opts.sourceChannelId}/${opts.targetMessageId}`;
      msgLine += ` ( <#${opts.sourceChannelId}> · [↗](${jumpUrl}) )`;
    } else if (opts.sourceChannelId) {
      msgLine += ` ( <#${opts.sourceChannelId}> )`;
    }
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Highlighted message(s)**\n${msgLine}`),
    );
  }

  // ── Reported by ───────────────────────────────────────────────────────────
  container.addSeparatorComponents(new SeparatorBuilder());
  const reportedByLine = opts.reporterTag
    ? `> ${opts.reporterTag} (<@${opts.reporterId}>)`
    : `> <@${opts.reporterId}>`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Reported by**\n${reportedByLine}`),
  );

  // ── Resolved footer ───────────────────────────────────────────────────────
  if (opts.resolvedBy) {
    const note = opts.resolvedNote ? `: ${opts.resolvedNote}` : '';
    const tag = opts.resolvedByTag ?? `<@${opts.resolvedBy}>`;
    const verb = opts.status === 'actioned' ? 'accepted' : 'ignored';
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${tag} ${verb} this report${note} • <t:${Math.floor(Date.now() / 1000)}:t>`),
    );
  }

  // ── Buttons (open reports only) ────────────────────────────────────────────
  if (opts.status === 'open') {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`report:action:${opts.reportId}`)
          .setLabel('Take action')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`report:ignore:${opts.reportId}`)
          .setLabel('Ignore')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`report:userinfo:${opts.reportId}`)
          .setLabel('User info')
          .setStyle(ButtonStyle.Secondary),
      );
    const archiveRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`report:archive:${opts.reportId}`)
          .setLabel('Archive Messages')
          .setStyle(ButtonStyle.Success),
      );
    container.addActionRowComponents(row as never);
    container.addActionRowComponents(archiveRow as never);
  }

  const allowedMentions: { parse: []; roles?: string[] } = opts.pingRoleId
    ? { parse: [], roles: [opts.pingRoleId] }
    : { parse: [] };

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions,
  };
}

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