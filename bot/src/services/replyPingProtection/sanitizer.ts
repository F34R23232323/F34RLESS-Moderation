const MENTION_PATTERN = /<@!?\d+>|<@&\d+>|<#\d+>/g;
const EMOJI_PATTERN = /<a?:\w+:\d+>/g;
const ZWS_PATTERN = /[\u200B\u200C\u200D\uFEFF]/g;

export function sanitizeContent(content: string): string {
  let result = content;

  result = result.replace(MENTION_PATTERN, '@mention');
  result = result.replace(EMOJI_PATTERN, ':emoji:');
  result = result.replace(ZWS_PATTERN, '');

  result = result.replace(/`{3}[\s\S]*?`{3}/g, '[code block]');
  result = result.replace(/`[^`\n]+`/g, '[inline code]');
  result = result.replace(/\|\|[\s\S]*?\|\|/g, '[spoiler]');

  if (result.length > 500) {
    result = result.slice(0, 497) + '...';
  }

  return result.trim();
}

export function extractMentionedUserIds(content: string): string[] {
  const ids: string[] = [];
  const pattern = /<@!?(\d+)>/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

export function hasProtectedMention(
  content: string,
  protectedUserIds: string[],
  protectedRoleIds: string[],
): { blocked: boolean; blockedUserId?: string; blockedRoleId?: string } {
  const mentionPattern = /<@!?(\d+)>|<@&(\d+)>/g;
  let match;
  while ((match = mentionPattern.exec(content)) !== null) {
    if (match[1] && protectedUserIds.includes(match[1])) {
      return { blocked: true, blockedUserId: match[1] };
    }
    if (match[2] && protectedRoleIds.includes(match[2])) {
      return { blocked: true, blockedRoleId: match[2] };
    }
  }
  return { blocked: false };
}
