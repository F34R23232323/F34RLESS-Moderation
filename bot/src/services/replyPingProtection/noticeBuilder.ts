import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import type { ReplyPingProtectionConfig } from '../../../../shared/src/index';
import { sanitizeContent } from './sanitizer';

export interface NoticeResult {
  components: unknown[];
  flags: number;
}

export function buildNotice(
  config: ReplyPingProtectionConfig,
  originalContent: string,
  violatorTag: string,
  violatorId: string,
  channelMention: string,
): NoticeResult {
  const sanitized = sanitizeContent(originalContent);

  const container = new ContainerBuilder()
    .setAccentColor(hexToInt(config.notice_accent_color) as never)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${config.notice_title}`),
    )
    .addSeparatorComponents(new SeparatorBuilder());

  const description = config.notice_description
    ?? 'This message mentions a protected user or role and has been blocked. Pinging protected entities is not allowed.';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(description),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  const metaLines: string[] = [];
  metaLines.push(`**Sent by:** <@${violatorId}> (${violatorTag})`);
  metaLines.push(`**In channel:** ${channelMention}`);

  if (sanitized) {
    metaLines.push(`\n**Blocked message:**\n> ${sanitized.replace(/\n/g, '\n> ')}`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(metaLines.join('\n')),
  );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
  };
}


function hexToInt(hex: string | undefined): number | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : undefined;
}
