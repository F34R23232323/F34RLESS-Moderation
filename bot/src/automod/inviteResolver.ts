import type { Client } from 'discord.js';
import { stripZeroWidth } from '../../../shared/src/index';

const CONFUSABLE: Record<string, string> = {
  'Ｇ': 'g', 'ｇ': 'g', 'Ⅴ': 'v', 'Ⅰ': 'i', 'ｖ': 'v', 'ｉ': 'i',
  'ⓓ': 'd', 'ⓒ': 'c', 'ⓝ': 'n', 'ⅹ': 'x', 'ｘ': 'x', '０': '0',
  'Ｏ': 'o', 'ｏ': 'o', 'Ｌ': 'l', 'ｌ': 'l', 'Ｉ': 'i', 'Ⅱ': 'ii',
};

export interface ResolvedInvite {
  code: string;
  guildId: string;
  guildName: string;
  inviterId?: string | null;
  channelName?: string;
  uses?: number;
}

export class InviteResolver {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public extractCodes(content: string): string[] {
    const normalized = stripZeroWidth(content)
      .split('')
      .map((ch) => CONFUSABLE[ch] ?? ch)
      .join('');

    const codes = new Set<string>();
    const patterns = [
      /(?:discord\.(?:gg|com\/invite)\/)([A-Za-z0-9_-]+)/g,
      /(?:dsc\.gg\/)([A-Za-z0-9_-]+)/g,
      /(?:discord\.me\/)([A-Za-z0-9_-]+)/g,
    ];
    for (const re of patterns) {
      let match: RegExpExecArray | null;
      while ((match = re.exec(normalized)) !== null) {
        codes.add(match[1]);
      }
    }
    return [...codes];
  }

  public async resolve(code: string): Promise<ResolvedInvite | null> {
    try {
      const invite = await this.client.fetchInvite(code);
      return {
        code: invite.code,
        guildId: invite.guild?.id ?? 'unknown',
        guildName: invite.guild?.name ?? 'unknown',
        inviterId: invite.inviter?.id ?? null,
        channelName: invite.channel?.name ?? undefined,
        uses: invite.uses ?? undefined,
      };
    } catch {
      return null;
    }
  }
}