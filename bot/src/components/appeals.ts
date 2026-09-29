import type { ButtonInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { isAppealsStaff } from '../services/appealService';
import { v2Ephemeral } from '../utils/v2';

type Decision = 'accept' | 'deny' | 'ignore';

const DECISION_STATUS: Record<Decision, 'accepted' | 'denied' | 'ignored'> = {
  accept: 'accepted',
  deny: 'denied',
  ignore: 'ignored',
};

/** Deep-clone the card's components with every button disabled (keeps layout). */
function disableButtons(components: unknown[]): unknown[] {
  const cloned = JSON.parse(JSON.stringify(components)) as unknown[];
  const walk = (nodes: unknown[]): void => {
    for (const n of nodes) {
      const node = n as { type?: number; disabled?: boolean; components?: unknown[] };
      if (node?.type === 2) node.disabled = true;
      if (Array.isArray(node?.components)) walk(node.components);
    }
  };
  walk(cloned);
  return cloned;
}

async function decide(app: App, interaction: ButtonInteraction, decision: Decision): Promise<void> {
  const appealId = Number(interaction.customId.split(':').pop());
  if (!Number.isInteger(appealId) || appealId <= 0) {
    await interaction.reply(v2Ephemeral('Invalid appeal id.') as never);
    return;
  }
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(v2Ephemeral('This button only works inside a server.') as never);
    return;
  }
  if (!isAppealsStaff(app, { guild, member: interaction.member as never })) {
    await interaction.reply(v2Ephemeral('You do not have permission to decide appeals.') as never);
    return;
  }

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT id, guild_id, status FROM appeals WHERE id = ? AND guild_id = ?',
    [appealId, guild.id],
  );
  const appeal = rows[0] as { id: number; guild_id: string; status: string } | undefined;
  if (!appeal) {
    await interaction.reply(v2Ephemeral('Appeal not found.') as never);
    return;
  }
  if (appeal.status !== 'pending') {
    await interaction.reply(v2Ephemeral(`This appeal was already decided (${appeal.status}).`) as never);
    return;
  }

  const status = DECISION_STATUS[decision];
  const reason = decision === 'accept' ? 'Punishment reversed.' : decision === 'deny' ? 'Punishment stands.' : 'Closed without a ruling.';

  // Conditional update: only the first staff member to land here wins.
  const [result] = await app.db.execute(
    "UPDATE appeals SET status = ?, decided_at = NOW(), decided_by = ?, decision_reason = ? WHERE id = ? AND guild_id = ? AND status = 'pending'",
    [status, interaction.user.id, reason, appeal.id, guild.id],
  );
  const affected = (result as { affectedRows: number }).affectedRows;
  if (affected === 0) {
    await interaction.reply(v2Ephemeral('This appeal was already decided by someone else.') as never);
    return;
  }

  // Disable the buttons immediately (edit the card) — the heavy lifting
  // (punishment reversal, DM, thread system message) happens in the service.
  const message = interaction.message;
  if (message && message.editable) {
    await message.edit({ components: disableButtons(message.components as unknown[]) } as never).catch(() => undefined);
  }
  await interaction.deferUpdate().catch(() => undefined);
  await interaction.followUp(v2Ephemeral(`Appeal #${appeal.id} marked as ${status}.`) as never).catch(() => undefined);
  await app.appeals.executeDecision(appeal.id).catch(async (err) => {
    app.logger.error(`executeDecision (button) for appeal #${appeal.id} failed:`, err);
    await app.logManager.reportError(`Appeal #${appeal.id} decision`, err);
  });
}

const accept = {
  type: 'button' as const,
  id: 'appeal:decide:accept:',
  run: async (app: App, interaction: ButtonInteraction): Promise<void> => decide(app, interaction, 'accept'),
};

const deny = {
  type: 'button' as const,
  id: 'appeal:decide:deny:',
  run: async (app: App, interaction: ButtonInteraction): Promise<void> => decide(app, interaction, 'deny'),
};

const ignore = {
  type: 'button' as const,
  id: 'appeal:decide:ignore:',
  run: async (app: App, interaction: ButtonInteraction): Promise<void> => decide(app, interaction, 'ignore'),
};

export default [accept, deny, ignore];
