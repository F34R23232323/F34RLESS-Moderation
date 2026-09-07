import { ButtonStyle, MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { buildV2Content } from './v2';
import type { App } from '../core/context';

export interface PaginateOptions {
  trigger: ChatInputCommandInteraction | Message;
  authorId: string;
  title: string;
  pages: string[];
  timeoutMs?: number;
  accentColor?: string;
}

function isInteraction(t: unknown): t is ChatInputCommandInteraction {
  return typeof (t as ChatInputCommandInteraction).editReply === 'function';
}

export async function paginateV2(opts: PaginateOptions): Promise<void> {
  const { trigger, authorId, title, pages } = opts;
  const timeout = opts.timeoutMs ?? 180_000;
  const total = pages.length;

  if (total === 0) return;

  const header = (p: number): string =>
    title.replace(/\{page\}/g, String(p + 1)).replace(/\{total\}/g, String(total));

  const id = Math.random().toString(36).slice(2, 10);

  const render = (p: number) => {
    const content = `${header(p)}\n\n${pages[p]}`;
    const disabled = total <= 1;
    return buildV2Content(content, {
      accentColor: opts.accentColor,
      buttons: [
        { customId: `${id}_prev`, label: 'Previous', emojiName: 'vyxia_arrowLeft', style: ButtonStyle.Secondary, disabled: disabled || p === 0 },
        { customId: `${id}_page`, label: `Page ${p + 1}/${total}`, style: ButtonStyle.Secondary, disabled: true },
        { customId: `${id}_next`, label: 'Next', emojiName: 'vyxia_arrowRight', style: ButtonStyle.Secondary, disabled: disabled || p === total - 1 },
      ],
    });
  };

  let page = 0;
  const payload = render(0);

  let sent: Message;
  const noPing = { parse: [] as string[] };
  if (isInteraction(trigger)) {
    const intr = trigger as ChatInputCommandInteraction;
    const body: any = { components: payload.components, flags: payload.flags, allowedMentions: noPing };
    if (intr.replied || intr.deferred) {
      sent = (await intr.editReply(body)) as unknown as Message;
    } else {
      sent = (await intr.reply({ ...body, fetchReply: true })) as unknown as Message;
    }
  } else {
    sent = await (trigger as Message).reply({ components: payload.components as any, flags: payload.flags, allowedMentions: noPing } as any);
  }

  if (total <= 1) return;

  const collector = sent.createMessageComponentCollector({ time: timeout });
  collector.on('collect', async (i) => {
    if (i.user.id !== authorId) {
      await i.reply({ content: 'This is not your pagination.', ephemeral: true }).catch(() => undefined);
      return;
    }
    if (!i.isButton()) return;
    if (i.customId === `${id}_prev`) page = Math.max(0, page - 1);
    else if (i.customId === `${id}_next`) page = Math.min(total - 1, page + 1);
    else return;
    await i.update({ components: render(page).components as any, allowedMentions: noPing } as any);
  });

  collector.on('end', async () => {
    try {
      const body = buildV2Content(`${header(page)}\n\n${pages[page]}`, { accentColor: opts.accentColor });
      await sent.edit({ components: body.components as any, allowedMentions: noPing } as any);
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
