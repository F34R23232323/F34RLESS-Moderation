import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { AppealStatus } from '../../../shared/src/index';
import { safeDiscordText } from '../../../shared/src/index';

// ---------------------------------------------------------------------------
// Appeal embed builders — Components V2 only (no legacy embeds). The card is
// posted to the guild's appeals log channel on every new submission and edited
// in place as staff Accept / Deny / Ignore via the buttons.
// ---------------------------------------------------------------------------

const STATUS_ACCENT: Record<AppealStatus, number> = {
  pending: 0xf0b232, // amber
  accepted: 0x57f287, // green
  denied: 0xed4245, // red
  ignored: 0x99aab5, // muted grey
};

const STATUS_LABEL: Record<AppealStatus, string> = {
  pending: 'New appeal',
  accepted: 'Appeal accepted',
  denied: 'Appeal denied',
  ignored: 'Appeal ignored',
};

export interface AppealEmbedData {
  appealId: number;
  status: AppealStatus;
  caseNumber: number;
  caseCode: string;
  caseType: string;
  caseReason: string;
  caseModeratorId: string | null;
  userId: string;
  userTag: string | null;
  answers: Array<{ question: string; answer: string }>;
  decisionReason?: string | null;
  decidedById?: string | null;
  decidedByTag?: string | null;
  decidedAt?: Date | null;
}

interface BuiltPayload {
  components: unknown[];
  flags: number;
}

function footerText(decidedAt?: Date | null): string {
  if (!decidedAt) return '';
  return `Decided <t:${Math.floor(decidedAt.getTime() / 1000)}:R>`;
}

/** Open state: full case detail + form answers + Accept/Deny/Ignore row. */
export function buildOpenAppealCard(data: AppealEmbedData): BuiltPayload {
  const container = new ContainerBuilder().setAccentColor(STATUS_ACCENT.pending as never);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${STATUS_LABEL.pending} — Appeal #${data.appealId}**`),
  );

  const caseLines = [
    `Case: **#${data.caseNumber}** (\`${data.caseCode}\`)`,
    `Type: **${String(data.caseType).toUpperCase()}**`,
    `User: ${data.userTag ? `${data.userTag} ` : ''}(<@${data.userId}>)`,
    `ID: \`${data.userId}\``,
  ];
  if (data.caseModeratorId) caseLines.push(`Moderator: <@${data.caseModeratorId}>`);
  if (data.caseReason) caseLines.push(`Original reason:\n> ${String(data.caseReason).slice(0, 800).replace(/\n/g, '\n> ')}`);

  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(caseLines.join('\n')));
  container.addSectionComponents(section as never);

  container.addSeparatorComponents(new SeparatorBuilder());

  if (data.answers.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('*No form answers were provided.*'));
  } else {
    for (const a of data.answers) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${a.question}**\n${safeDiscordText(a.answer, 800)}`),
      );
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`appeal:decide:accept:${data.appealId}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`appeal:decide:deny:${data.appealId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`appeal:decide:ignore:${data.appealId}`)
      .setLabel('Ignore')
      .setStyle(ButtonStyle.Secondary),
  );
  container.addActionRowComponents(row as never);

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

/** Decided state: buttons removed, header reflects the outcome, decision shown. */
export function buildDecidedAppealCard(data: AppealEmbedData): BuiltPayload {
  const container = new ContainerBuilder().setAccentColor((STATUS_ACCENT[data.status] ?? STATUS_ACCENT.pending) as never);

  const label = STATUS_LABEL[data.status] ?? data.status;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${label} — Appeal #${data.appealId}**`),
  );

  const caseLines = [
    `Case: **#${data.caseNumber}** (\`${data.caseCode}\`)`,
    `Type: **${String(data.caseType).toUpperCase()}**`,
    `User: ${data.userTag ? `${data.userTag} ` : ''}(<@${data.userId}>)`,
    `ID: \`${data.userId}\``,
  ];
  if (data.caseModeratorId) caseLines.push(`Moderator: <@${data.caseModeratorId}>`);

  const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(caseLines.join('\n')));
  container.addSectionComponents(section as never);

  container.addSeparatorComponents(new SeparatorBuilder());

  const decisionLines: string[] = [];
  if (data.decidedById) decisionLines.push(`By: ${data.decidedByTag ? `${data.decidedByTag} ` : ''}(<@${data.decidedById}>)`);
  if (data.decisionReason) decisionLines.push(`Reason:\n> ${String(data.decisionReason).slice(0, 800).replace(/\n/g, '\n> ')}`);
  const footer = footerText(data.decidedAt);
  if (footer) decisionLines.push(footer);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(decisionLines.length > 0 ? decisionLines.join('\n') : '*No decision details.*'),
  );

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

/** Small container used for system messages inside the appeal thread. */
export function buildAppealSystemMessage(text: string): BuiltPayload {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2 as never)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}
