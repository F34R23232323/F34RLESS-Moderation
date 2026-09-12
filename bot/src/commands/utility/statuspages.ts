import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply, buildRichV2, buildV2Content } from '../../utils/v2';

const DEFAULT_BASE_URL = 'https://status.f34r.rip';

const data = new SlashCommandBuilder()
  .setName('statuspages')
  .setDescription('Fetch all OneUptime status pages');

async function fetchStatusPages(apiKey: string, baseUrl: string): Promise<Record<string, unknown>[]> {
  const root = baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${root}/api/status-page/get-list?skip=0&limit=100`, {
    method: 'POST',
    headers: {
      ApiKey: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      select: { _id: true, name: true, slug: true, description: true, pageTitle: true, pageDescription: true },
      query: {},
      sort: { createdAt: -1 },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('OneUptime rejected the API key. Generate a key with ReadProjectStatusPage permission and set ONEUPTIME_API_KEY.');
    }
    throw new Error(`OneUptime returned HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  const obj = json && typeof json === 'object' ? json as Record<string, unknown> : {};
  if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  throw new Error('OneUptime returned an unexpected response.');
}

function buildResponse(pages: Record<string, unknown>[], baseUrl: string) {
  if (!pages.length) {
    return buildV2Content('No status pages found.');
  }

  const lines: string[] = [];
  for (const p of pages.slice(0, 25)) {
    const name = String(p.name ?? p.pageTitle ?? 'Unnamed').slice(0, 100);
    const slug = String(p.slug ?? 'N/A');
    const url = String(p.url ?? `${baseUrl.replace(/\/+$/, '')}/status-page/${encodeURIComponent(slug)}`);
    const rawDescription = String(p.pageDescription ?? p.description ?? 'No description');
    const desc = rawDescription.length > 300 ? `${rawDescription.slice(0, 297)}...` : rawDescription;
    lines.push(`**${name}**\nURL: [${url}](${url})\nSlug: ${slug}\nDescription: ${desc}`);
  }
  if (pages.length > 25) lines.push(`*And ${pages.length - 25} more status pages.*`);

  return buildRichV2({
    accentColor: 0x5865f2,
    header: 'OneUptime Status Pages',
    text: lines.join('\n\n'),
  });
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  try {
    const apiKey = app.env.ONEUPTIME_API_KEY?.trim();
    if (!apiKey) throw new Error('ONEUPTIME_API_KEY is not configured.');
    const baseUrl = app.env.ONEUPTIME_BASE_URL?.trim() || DEFAULT_BASE_URL;
    const pages = await fetchStatusPages(apiKey, baseUrl);
    const payload = buildResponse(pages, baseUrl);
    await interaction.editReply({ ...payload, allowedMentions: { parse: [] } } as never);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.editReply({ ...buildV2Content(`Failed to fetch status pages: ${msg}`) } as never);
  }
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const sent = await v2MessageReply(message, { content: 'Fetching status pages...' });
  try {
    const apiKey = app.env.ONEUPTIME_API_KEY?.trim();
    if (!apiKey) throw new Error('ONEUPTIME_API_KEY is not configured.');
    const baseUrl = app.env.ONEUPTIME_BASE_URL?.trim() || DEFAULT_BASE_URL;
    const pages = await fetchStatusPages(apiKey, baseUrl);
    const payload = buildResponse(pages, baseUrl);
    await sent.edit(payload as never);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sent.edit({ ...buildV2Content(`Failed to fetch status pages: ${errMsg}`) } as never);
  }
}

const command: BotCommand = {
  name: 'statuspages',
  category: 'social',
  description: 'Fetch all OneUptime status pages',
  data,
  permissions: [],
  aliases: ['status', 'sp'],
  execute,
  prefixExecute,
};

export default command;
