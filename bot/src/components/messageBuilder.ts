import type { ButtonInteraction, StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { MessageFlags } from 'discord.js';
import type { App } from '../core/context';
import { findComponent, buildMessagePayload, clientEmojiIds, renderMessageSpecPlaceholders, componentActions, optionActions, type MessageAction } from '../utils/messageBuilder';
import type { PlaceholderContext } from '../../../shared/src/index';

type RoleChanges = { added: Set<string>; removed: Set<string> };

async function run(app: App, interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
  const raw = interaction.customId.replace(/^mb:/, '');
  const sep = raw.indexOf(':');
  if (sep === -1) return;
  const savedId = raw.slice(0, sep);
  const compId = raw.slice(sep + 1);

    const saved = await app.messages.get(Number(savedId)).catch(() => null);
    if (!saved) {
      await interaction.reply({ content: 'This message no longer exists.', ephemeral: true }).catch(() => undefined);
      return;
    }
    const spec = app.messages.parsePayload(saved);
    const component = findComponent(spec, compId);
    let actions = component ? componentActions(component) : [];
    if (component?.type === 'select' && interaction.isStringSelectMenu()) {
      const selected = interaction.values;
      actions = [];
      for (const value of selected) {
        const option = component.options.find((o) => o.value === value);
        if (option) actions.push(...optionActions(option));
      }
      if (actions.length === 0) actions = componentActions(component);
    }
    const member = (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null)) ?? null;
    const roleChanges: RoleChanges = { added: new Set(), removed: new Set() };

    let replied = false;
    let deferred = false;
    for (const action of actions) {
      try {
        const outcome = await runAction(app, interaction, action, spec, savedId, member, roleChanges);
        if (outcome.reply) {
          await ack(interaction, outcome.reply);
          replied = true;
        }
        if (outcome.defer && !deferred) {
          await interaction.deferUpdate().catch(() => undefined);
          deferred = true;
        }
      } catch (err) {
        app.logger.error(`message-builder action ${action.type} failed:`, err);
      }
    }
    if (actions.length === 0 || (!replied && !deferred)) {
      await interaction.deferUpdate().catch(() => undefined);
    }
  }

async function runAction(
  app: App,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  action: MessageAction,
  currentSpec: { kind: 'v1' | 'v2' },
  savedId: string,
  member: GuildMember | null,
  roleChanges: RoleChanges,
): Promise<{ reply?: string; defer?: boolean }> {
  const roleName = (roleId: string): string => interaction.guild?.roles.cache.get(roleId)?.name ?? roleId;
  switch (action.type) {
    case 'role_add': {
      if (member && action.roleId) {
        await member.roles.add(String(action.roleId)).then(() => roleChanges.added.add(roleName(String(action.roleId)))).catch(() => undefined);
      }
      return { reply: action.content ? `Role added: ${action.content}` : 'Role added.' };
    }
    case 'role_remove': {
      if (member && action.roleId) {
        await member.roles.remove(String(action.roleId)).then(() => roleChanges.removed.add(roleName(String(action.roleId)))).catch(() => undefined);
      }
      return { reply: action.content ? `Role removed: ${action.content}` : 'Role removed.' };
    }
    case 'role_toggle': {
      if (member && action.roleId) {
        if (member.roles.cache.has(String(action.roleId))) {
          await member.roles.remove(String(action.roleId)).then(() => roleChanges.removed.add(roleName(String(action.roleId)))).catch(() => undefined);
          return { reply: action.content ? `Role removed: ${action.content}` : 'Role removed.' };
        }
        await member.roles.add(String(action.roleId)).then(() => roleChanges.added.add(roleName(String(action.roleId)))).catch(() => undefined);
        return { reply: action.content ? `Role added: ${action.content}` : 'Role added.' };
      }
      return { reply: 'Could not find your membership.' };
    }
    case 'send_message': {
      if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ content: String(action.content ?? ''), allowedMentions: { parse: [] } });
      }
      return { reply: 'Sent.' };
    }
    case 'reply': {
      await interaction.reply({ content: String(action.content ?? ''), ephemeral: action.ephemeral !== false, allowedMentions: { parse: [] } });
      return {};
    }
    case 'dm_user': {
      await interaction.user.send({ content: String(action.content ?? ''), allowedMentions: { parse: [] } }).catch(() => undefined);
      return { reply: action.content ? 'Message sent to your DMs.' : 'DM sent.' };
    }
    case 'repost': {
      const channel = interaction.channel;
      if (channel && 'send' in channel) {
        const payload = buildMessagePayload(currentSpec as never, savedId, clientEmojiIds(app.client));
        await channel.send({ ...payload, allowedMentions: { parse: [] } } as never);
      }
      return { reply: 'Message re-posted.' };
    }
    case 'send_message_template': {
      // Send a DIFFERENT saved message by id to this channel (or a specific channel),
      // or as an ephemeral reply to the clicker.
      const targetId = action.messageId ? Number(action.messageId) : null;
      if (!targetId) return { reply: 'No message template selected.' };
      const target = await app.messages.get(targetId).catch(() => null);
      if (!target) return { reply: 'That message template no longer exists.' };
      // When role actions ran earlier in this action list, expose the outcome as
      // template variables: ${roleadded} and ${rolesremoved}.
      const placeholders: PlaceholderContext = {
        roleadded: [...roleChanges.added].join(', '),
        rolesremoved: [...roleChanges.removed].join(', '),
      };
      const rendered = renderMessageSpecPlaceholders(app.messages.parsePayload(target), placeholders);
      const payload = buildMessagePayload(rendered, String(target.id), clientEmojiIds(app.client));
      // Replies are ephemeral by default (private to the clicker) unless the
      // action explicitly opts out with `ephemeral: false`.
      if (action.ephemeral !== false) {
        const flags = ((payload.flags as number | undefined) ?? 0) | MessageFlags.Ephemeral;
        const body = { ...payload, flags, allowedMentions: { parse: [] } } as never;
        try {
          await interaction.reply(body);
        } catch {
          await interaction.followUp(body).catch(() => undefined);
        }
        return {};
      }
      let channel: any = interaction.channel;
      if (action.channelId) {
        channel = interaction.guild?.channels.cache.get(action.channelId) ?? channel;
      }
      if (channel && 'send' in channel) {
        await channel.send({ ...payload, allowedMentions: { parse: [] } } as never);
        return { reply: 'Message sent.' };
      }
      return { reply: 'Could not send to that channel.' };
    }
    case 'edit_message_template': {
      // Replace THIS message's content with another saved message.
      const targetId = action.messageId ? Number(action.messageId) : null;
      if (!targetId) return { reply: 'No message template selected.' };
      const target = await app.messages.get(targetId).catch(() => null);
      if (!target) return { reply: 'That message template no longer exists.' };
      const placeholders: PlaceholderContext = {
        roleadded: [...roleChanges.added].join(', '),
        rolesremoved: [...roleChanges.removed].join(', '),
      };
      const rendered = renderMessageSpecPlaceholders(app.messages.parsePayload(target), placeholders);
      const payload = buildMessagePayload(rendered, String(target.id), clientEmojiIds(app.client));
      const body: Record<string, unknown> = {};
      if (payload.content !== undefined) body.content = payload.content;
      if (payload.embeds !== undefined) body.embeds = payload.embeds;
      if (payload.components !== undefined) body.components = payload.components;
      try {
        if (interaction.message && 'edit' in interaction.message) {
          await interaction.message.edit({ ...body, allowedMentions: { parse: [] } } as never);
        } else {
          await interaction.editReply({ ...body, allowedMentions: { parse: [] } } as never);
        }
      } catch (err) {
        app.logger.error('edit_message_template failed:', err);
        return { reply: 'Could not update the message.' };
      }
      return { defer: true };
    }
    default: {
      return { defer: true };
    }
  }
}

export default [
  { type: 'button', id: 'mb:', run },
  { type: 'select', id: 'mb:', run },
];

async function ack(interaction: ButtonInteraction | StringSelectMenuInteraction, content: string): Promise<void> {
  try {
    await interaction.reply({ content, ephemeral: true, allowedMentions: { parse: [] } });
  } catch {
    try {
      await interaction.followUp({ content, ephemeral: true, allowedMentions: { parse: [] } });
    } catch {
      /* ignore */
    }
  }
}