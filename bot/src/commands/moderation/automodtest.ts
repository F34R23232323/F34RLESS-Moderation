import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply } from '../../utils/v2';
import { InviteResolver } from '../../automod/inviteResolver';
import { extractHosts } from '../../automod/blocklistStore';
import { stripZeroWidth } from '../../../../shared/src/index';

const CUSTOM_EMOJI_RE = /<a?:\w+:\d{15,20}>/g;
const URL_RE = /https?:\/\/[^\s]+/gi;
const MENTION_RE = /<@!?(\d{15,20})>/g;
const INVITE_RE = /(?:discord\.(?:gg|com\/invite)|dsc\.gg|discord\.me)\/([A-Za-z0-9_-]+)/gi;

const CACHE = new Map<string, RegExp>();

function compile(pattern: string, flags: string): RegExp {
  const key = `${pattern}:${flags}`;
  let re = CACHE.get(key);
  if (!re) {
    re = new RegExp(pattern, flags);
    CACHE.set(key, re);
  }
  return re;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function formatAction(step: { type: string; [k: string]: unknown }): string {
  switch (step.type) {
    case 'delete_message':
      return 'Delete the message';
    case 'dm_user':
      return 'DM the user';
    case 'warn':
      return `Warn the user${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'mute':
      return `Mute the user${step.duration ? ` for **${step.duration}**` : ''}${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'timeout':
      return `Timeout the user${step.duration ? ` for **${step.duration}**` : ''}${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'kick':
      return `Kick the user${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'ban':
      return `Ban the user${typeof step.duration === 'string' && step.duration ? ` for **${step.duration}**` : ''}${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'add_role':
      return `Add role <@&${step.role_id}>`;
    case 'remove_role':
      return `Remove role <@&${step.role_id}>`;
    case 'run_escalation_check':
      return 'Run escalation check (may apply a harsher punishment)';
    case 'create_report':
      return `Create a report${step.reason ? ` — *"${step.reason}"*` : ''}`;
    case 'send_channel_message':
      return `Post a message in the channel${step.dm_first ? ' (DM first, fall back to channel)' : ''}${step.title ? ` — **${step.title}**` : ''}`;
    default:
      return `Run action \`${step.type}\``;
  }
}

interface TestResult {
  module: string;
  rule: string;
  reason: string;
  actions: Array<{ type: string; [k: string]: unknown }>;
}

export async function testAutomodContent(
  app: App,
  content: string,
  opts: { includeInvites?: boolean; currentGuildId?: string } = {},
): Promise<TestResult[]> {
  const hits: TestResult[] = [];

  // ── Regex engine rules (message scope) ───────────────────────────────────
  const regex = app.config.regex_engine;
  if (regex.enabled && content) {
    for (const rule of regex.rules) {
      if (!rule.enabled) continue;
      if (rule.scope !== 'message') continue;
      const patterns = rule.patterns && rule.patterns.length > 0 ? rule.patterns : rule.pattern ? [rule.pattern] : [];
      for (const p of patterns) {
        const pattern = typeof p === 'string' ? p : p.pattern;
        const re = compile(pattern, rule.flags);
        re.lastIndex = 0;
        if (re.test(content)) {
          hits.push({
            module: 'regex_engine',
            rule: rule.name,
            reason: `matched regex pattern \`${pattern}\``,
            actions: (rule.action_chain as never) ?? [],
          });
          break;
        }
      }
    }
  }

  // ── Link filter ──────────────────────────────────────────────────────────
  const link = app.config.automod.modules.link_filter;
  if (link.enabled && content) {
    const urls = content.match(URL_RE) ?? [];
    if (urls.length > 0) {
      const allowlist = link.allowlist.map((h) => h.toLowerCase().replace(/^www\./, ''));
      const denylist = link.denylist.map((h) => h.toLowerCase().replace(/^www\./, ''));
      for (const url of urls) {
        const host = hostname(url);
        let hit = false;
        if (link.mode === 'deny_all') hit = true;
        else if (link.mode === 'denylist' && denylist.includes(host)) hit = true;
        else if (link.mode === 'allowlist' && !allowlist.includes(host)) hit = true;
        if (hit) {
          hits.push({
            module: 'link_filter',
            rule: 'link_filter',
            reason: `${link.mode === 'deny_all' ? 'link posted' : link.mode === 'denylist' ? 'denylisted host' : 'non-allowlisted host'}: ${host}`,
            actions: (link.action_chain as never) ?? [],
          });
          break;
        }
      }
    }
  }

  // ── Remote link blocklists (NSFW / malicious domains) ───────────────────
  if (content && app.blocklistStore) {
    const hosts = extractHosts(content);
    if (hosts.length > 0) {
      const checks = [
        { module: 'nsfw_link_blocklist' as const, category: 'nsfw' as const, cfg: app.config.automod.modules.nsfw_link_blocklist },
        { module: 'malicious_link_blocklist' as const, category: 'malicious' as const, cfg: app.config.automod.modules.malicious_link_blocklist },
      ];
      for (const check of checks) {
        if (!check.cfg.enabled) continue;
        for (const host of hosts) {
          const source = app.blocklistStore.match(check.category, host);
          if (source) {
            hits.push({
              module: check.module,
              rule: check.module,
              reason: `blocked ${check.category} link: ${host} (blocklist: ${source})`,
              actions: (check.cfg.action_chain as never) ?? [],
            });
            break;
          }
        }
      }
    }
  }

  // ── Emoji spam ───────────────────────────────────────────────────────────
  const emoji = app.config.automod.modules.emoji_spam;
  if (emoji.enabled && content) {
    const count = (content.match(CUSTOM_EMOJI_RE) ?? []).length;
    if (count >= emoji.threshold) {
      hits.push({
        module: 'emoji_spam',
        rule: 'emoji_spam',
        reason: `${count} emojis in one message (threshold ${emoji.threshold})`,
        actions: (emoji.action_chain as never) ?? [],
      });
    }
  }

  // ── Line spam (single message) ───────────────────────────────────────────
  const line = app.config.automod.modules.line_spam;
  if (line.enabled && content) {
    const lines = content.split('\n').length;
    if (lines >= line.per_message_lines) {
      hits.push({
        module: 'line_spam',
        rule: 'line_spam',
        reason: `${lines} lines in one message (threshold ${line.per_message_lines})`,
        actions: (line.action_chain as never) ?? [],
      });
    }
  }

  // ── Mass ping (single-message mention count) ─────────────────────────────
  const ping = app.config.automod.modules.mass_ping;
  if (ping.enabled && content) {
    const mentions = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(MENTION_RE.source, 'g');
    while ((m = re.exec(content)) !== null) mentions.add(m[1]);
    if (mentions.size > ping.max_mentions) {
      hits.push({
        module: 'mass_ping',
        rule: 'mass_mentions',
        reason: `${mentions.size} mentions in one message (limit ${ping.max_mentions})`,
        actions: (ping.action_chain as never) ?? [],
      });
    }
  }

  // ── Invites ──────────────────────────────────────────────────────────────
  const invites = app.config.automod.modules.invites;
  if (invites.enabled && opts.includeInvites && content) {
    const normalized = stripZeroWidth(content);
    const codes = new Set<string>();
    let inv: RegExpExecArray | null;
    while ((inv = INVITE_RE.exec(normalized)) !== null) codes.add(inv[1]);
    if (codes.size > 0) {
      const resolver = new InviteResolver(app.client);
      const allowlist = invites.guild_allowlist;
      for (const code of codes) {
        const resolved = await resolver.resolve(code).catch(() => null);
        if (!resolved) continue;
        if (opts.currentGuildId && resolved.guildId === opts.currentGuildId) continue;
        if (allowlist.includes(resolved.guildId)) continue;
        hits.push({
          module: 'invites',
          rule: 'invites',
          reason: `discord invite to "${resolved.guildName}" (${resolved.guildId})`,
          actions: (invites.action_chain as never) ?? [],
        });
        break;
      }
    }
  }

  return hits;
}

const data = new SlashCommandBuilder()
  .setName('automodtest')
  .setDescription('Test whether a word or sentence would be caught by any automod rule')
  .addStringOption((o) => o.setName('content').setDescription('The word or sentence to test').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const content = interaction.options.getString('content', true);

  const hits = await testAutomodContent(app, content, { includeInvites: true, currentGuildId: interaction.guild?.id });

  const container = new ContainerBuilder().setAccentColor((hits.length > 0 ? 0xed4245 : 0x57f287) as never);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(hits.length > 0 ? '**Automod Test — CAUGHT**' : '**Automod Test — CLEAR**'),
  );
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Testing content:\n> ${content.slice(0, 500).replace(/\n/g, '\n> ')}`,
    ),
  );

  if (hits.length === 0) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('No configured automod rule would catch this content.'),
    );
  } else {
    for (const hit of hits) {
      container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${hit.module}** — \`${hit.rule}\`\n> ${hit.reason}`,
        ),
      );
      if (hit.actions.length > 0) {
        const lines = hit.actions.map((a) => `• ${formatAction(a)}`);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      }
    }
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚠️ This is a simulation only — nothing was actually deleted or actioned.'),
    );
  }

  await interaction.editReply({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const content = args.join(' ').trim();
  if (!content) {
    await v2MessageReply(message, { content: 'Usage: `!automodtest <word or sentence>`' });
    return;
  }
  const hits = await testAutomodContent(app, content, { includeInvites: true, currentGuildId: message.guild?.id });
  if (hits.length === 0) {
    await v2MessageReply(message, { content: `**Automod Test — CLEAR**\n> ${content}\n\nNo configured rule would catch this.` });
    return;
  }
  const lines: string[] = [`**Automod Test — CAUGHT** for:`];
  lines.push(`> ${content}`);
  for (const hit of hits) {
    lines.push('');
    lines.push(`**${hit.module}** — \`${hit.rule}\``);
    lines.push(`> ${hit.reason}`);
    if (hit.actions.length > 0) lines.push(hit.actions.map((a) => `• ${formatAction(a)}`).join('\n'));
  }
  lines.push('');
  lines.push('⚠️ Simulation only — nothing was acted on.');
  await v2MessageReply(message, { content: lines.join('\n').slice(0, 2000) });
}

const command: BotCommand = {
  name: 'automodtest',
  category: 'moderation',
  description: 'Test whether a word or sentence would be caught by any automod rule',
  usage: '!automodtest <word or sentence>',
  details: 'Simulation only — shows which rules would match and which actions they would take, without acting on anything.',
  data,
  permissions: ['ManageMessages'],
  aliases: ['amtest', 'modtest'],
  execute,
  prefixExecute,
};

export default command;
