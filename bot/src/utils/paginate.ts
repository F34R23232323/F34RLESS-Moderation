import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { hexToInt } from './v2';

export interface PaginateOptions {
  trigger: ChatInputCommandInteraction | Message;
  authorId: string;
  /** Bold title line + optional usage hint — shown in the first text block. */
  title: string;
  pages: string[];
  timeoutMs?: number;
  accentColor?: string;
}

function isInteraction(t: unknown): t is ChatInputCommandInteraction {
  return typeof (t as ChatInputCommandInteraction).editReply === 'function';
}

/**
 * Build a Sapphire-style paginated Components V2 container:
 *
 *   ContainerBuilder (accent bar)
 *     TextDisplayBuilder  — title / usage hint
 *     SeparatorBuilder
 *     TextDisplayBuilder  — page content
 *     TextDisplayBuilder  — "Page N/M" (when > 1 page)
 *     ActionRow           — [Previous page] [Next page]  (blurple, only when > 1 page)
 */
function buildPage(
  id: string,
  page: number,
  total: number,
  title: string,
  pages: string[],
  accentColor?: string,
  includeButtons = true,
): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder();
  if (accentColor) {
    const num = hexToInt(accentColor);
    if (num !== undefined) container.setAccentColor(num as never);
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(pages[page]));

  if (total > 1) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Page ${page + 1}/${total}`),
    );

    if (includeButtons) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`paginate:prev:${id}`)
          .setLabel('Previous page')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`paginate:next:${id}`)
          .setLabel('Next page')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === total - 1),
      );
      container.addActionRowComponents(row as never);
    }
  }

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

export async function paginateV2(opts: PaginateOptions): Promise<void> {
  const { trigger, authorId, title, pages } = opts;
  const timeout = opts.timeoutMs ?? 180_000;
  const total = pages.length;

  if (total === 0) return;

  const id = Math.random().toString(36).slice(2, 10);
  const noPing = { parse: [] as string[] };

  let page = 0;
  const payload = buildPage(id, page, total, title, pages, opts.accentColor);

  let sent: Message;
  if (isInteraction(trigger)) {
    const intr = trigger as ChatInputCommandInteraction;
    const body: any = { components: payload.components, flags: payload.flags, allowedMentions: noPing };
    if (intr.replied || intr.deferred) {
      await intr.editReply(body);
      sent = (await intr.fetchReply()) as Message;
    } else {
      sent = (await intr.reply({ ...body, fetchReply: true })) as unknown as Message;
    }
  } else {
    sent = await (trigger as Message).reply({
      components: payload.components as any,
      flags: payload.flags,
      allowedMentions: noPing,
    } as any);
  }

  if (total <= 1) return;

  const collector = sent.createMessageComponentCollector({ time: timeout });

  collector.on('collect', async (i) => {
    if (i.user.id !== authorId) {
      await i.reply({ content: 'This pagination is not yours to control.', ephemeral: true }).catch(() => undefined);
      return;
    }
    if (!i.isButton()) return;
    if (i.customId === `paginate:prev:${id}` || i.customId === `${id}_prev`) page = Math.max(0, page - 1);
    else if (i.customId === `paginate:next:${id}` || i.customId === `${id}_next`) page = Math.min(total - 1, page + 1);
    else return;
    try {
      const updated = buildPage(id, page, total, title, pages, opts.accentColor);
      await i.update({ components: updated.components as any, allowedMentions: noPing } as any);
    } catch {
      await i.followUp({ content: 'Could not update the page.', ephemeral: true }).catch(() => undefined);
    }
  });


  collector.on('end', async () => {
    try {
      // Remove buttons once the collector expires.
      const expired = buildPage(id, page, total, title, pages, opts.accentColor, false);
      await sent.edit({ components: expired.components as any, allowedMentions: noPing } as any);
    } catch {
      /* message may be gone */
    }
  });
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
