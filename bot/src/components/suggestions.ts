import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { App } from '../core/context';
import { hexToInt } from '../utils/v2';
import type { SuggestionRow } from '../suggestions/service';

function v2Ephemeral(text: string): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

function buildSuggestionEmbed(suggestion: SuggestionRow, cfg: { thread_name_prefix: string; statuses: Array<{ name: string; color?: string }> }, statusOverride?: string) {
  const status = statusOverride ?? suggestion.status;
  const statusDef = cfg.statuses.find((s) => s.name === status);
  const color = statusDef?.color ? hexToInt(statusDef.color) : 0x5865f2;

  const container = new ContainerBuilder()
    .setAccentColor((color ?? 0x5865f2) as never)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${cfg.thread_name_prefix} #${suggestion.id}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Suggestion**\n> ${suggestion.content.replace(/\n/g, '\n> ')}`),
    )
    .addSeparatorComponents(new SeparatorBuilder());

  let footerText = `**Status:** ${status}\n**By:** <@${suggestion.user_id}>`;
  if (suggestion.handled_by) {
    footerText += `\n**Handled by:** <@${suggestion.handled_by}>`;
  }
  if (suggestion.note) {
    footerText += `\n**Note:** ${suggestion.note}`;
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`suggest:status:${suggestion.id}`)
        .setLabel('Change Status')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`suggest:deny:${suggestion.id}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`suggest:accept:${suggestion.id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
    ) as never,
  );

  return {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] as [] },
  };
}

async function checkStaff(app: App, interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const member = interaction.member as any;
  if (!member?.roles?.cache) return false;
  if (!app.suggestions.isStaff(member)) {
    await interaction.reply(v2Ephemeral('You do not have permission to manage suggestions.') as never);
    return false;
  }
  return true;
}

// Accept button
const accept = {
  type: 'button' as const,
  id: 'suggest:accept:',
  async run(app: App, interaction: ButtonInteraction) {
    if (!(await checkStaff(app, interaction))) return;
    const id = Number(interaction.customId.replace('suggest:accept:', ''));
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await interaction.reply(v2Ephemeral('Suggestion not found.') as never);
      return;
    }

    const cfg = app.config.community.suggestions;
    await app.suggestions.setStatus(id, 'Accepted', interaction.user.id);

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, 'Accepted', interaction.user.tag, undefined, interaction.guild?.name,
    );

    // Update the original suggestion message
    if (suggestion.message_id) {
      const channel = interaction.channel;
      if (channel && 'messages' in channel) {
        const msg = await (channel as any).messages.fetch(suggestion.message_id).catch(() => null);
        if (msg) {
          const updated = { ...suggestion, status: 'Accepted', handled_by: interaction.user.id };
          await msg.edit(buildSuggestionEmbed(updated, cfg, 'Accepted') as never).catch(() => undefined);
        }
      }
    }

    await interaction.reply(v2Ephemeral(`Suggestion #${id} accepted.`) as never);
  },
};

// Deny button
const deny = {
  type: 'button' as const,
  id: 'suggest:deny:',
  async run(app: App, interaction: ButtonInteraction) {
    if (!(await checkStaff(app, interaction))) return;
    const id = Number(interaction.customId.replace('suggest:deny:', ''));
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await interaction.reply(v2Ephemeral('Suggestion not found.') as never);
      return;
    }

    const cfg = app.config.community.suggestions;
    await app.suggestions.setStatus(id, 'Denied', interaction.user.id);

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, 'Denied', interaction.user.tag, undefined, interaction.guild?.name,
    );

    if (suggestion.message_id) {
      const channel = interaction.channel;
      if (channel && 'messages' in channel) {
        const msg = await (channel as any).messages.fetch(suggestion.message_id).catch(() => null);
        if (msg) {
          const updated = { ...suggestion, status: 'Denied', handled_by: interaction.user.id };
          await msg.edit(buildSuggestionEmbed(updated, cfg, 'Denied') as never).catch(() => undefined);
        }
      }
    }

    await interaction.reply(v2Ephemeral(`Suggestion #${id} denied.`) as never);
  },
};

// Status change button — shows a select menu
const statusButton = {
  type: 'button' as const,
  id: 'suggest:status:',
  async run(app: App, interaction: ButtonInteraction) {
    if (!(await checkStaff(app, interaction))) return;
    const id = Number(interaction.customId.replace('suggest:status:', ''));
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await interaction.reply(v2Ephemeral('Suggestion not found.') as never);
      return;
    }

    const cfg = app.config.community.suggestions;
    const options = cfg.statuses.map((s) => ({
      label: s.name,
      value: s.name,
      description: s.name === suggestion.status ? 'Current status' : undefined,
      default: s.name === suggestion.status,
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`suggest:pick:${id}`)
      .setPlaceholder('Select a status')
      .addOptions(options);

    await interaction.reply({
      components: [
        new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Change status for suggestion #${id}**`))
          .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu) as never),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as never);
  },
};

// Status select menu handler
const statusPick = {
  type: 'select' as const,
  id: 'suggest:pick:',
  async run(app: App, interaction: StringSelectMenuInteraction) {
    if (!(await checkStaff(app, interaction))) return;
    const id = Number(interaction.customId.replace('suggest:pick:', ''));
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await interaction.reply(v2Ephemeral('Suggestion not found.') as never);
      return;
    }

    const newStatus = interaction.values[0];
    const cfg = app.config.community.suggestions;
    await app.suggestions.setStatus(id, newStatus, interaction.user.id);

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, newStatus, interaction.user.tag, undefined, interaction.guild?.name,
    );

    // Update the original suggestion message
    if (suggestion.message_id) {
      const channel = interaction.channel;
      if (channel && 'messages' in channel) {
        const msg = await (channel as any).messages.fetch(suggestion.message_id).catch(() => null);
        if (msg) {
          const updated = { ...suggestion, status: newStatus, handled_by: interaction.user.id };
          await msg.edit(buildSuggestionEmbed(updated, cfg, newStatus) as never).catch(() => undefined);
        }
      }
    }

    await interaction.update({ content: `Suggestion #${id} status updated to **${newStatus}**.`, components: [] });
  },
};

export default [accept, deny, statusButton, statusPick];
