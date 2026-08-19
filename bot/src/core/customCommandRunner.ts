import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  WebhookClient,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type TextBasedChannel,
  type TextChannel,
  type User,
} from 'discord.js';
import { parseDuration, renderPlaceholders } from '../../../shared/src/index';
import type {
  ButtonSpec,
  CustomCommandActionUnion,
  CustomCommandConfig,
  EmbedSpec,
  MessagePayload,
  SelectSpec,
} from '../../../shared/src/index';
import { hexToInt } from '../utils/v2';
import type { App } from './context';

export interface CustomCommandContext {
  app: App;
  command: CustomCommandConfig;
  commandName: string;
  guild: Guild;
  channel: TextChannel;
  member: GuildMember;
  user: User;
  args: string[];
  message?: Message;
  interaction?: ChatInputCommandInteraction;
  lastSent: Message | null;
  responded: boolean;
  counters: Map<string, number>;
  placeholders: Record<string, string | number>;
}

type Payload = { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[]; files?: string[] };

interface SendOpts {
  reply?: boolean;
  ephemeral?: boolean;
  channelId?: string;
  deleteAfter?: number;
  mention?: boolean;
}

export class CustomCommandRunner {
  public async runPrefix(app: App, message: Message, commandName: string, args: string[]): Promise<void> {
    const command = app.config.custom_commands[commandName];
    if (!command || !command.enabled || !command.prefix) return;
    const guild = message.guild;
    const member = message.member;
    if (!guild || !member) return;

    const ctx = await this.makeContext(app, command, commandName, guild, message.channel as TextChannel, member, message.author, args, { message });
    const access = await this.checkAccess(app, ctx);
    if (!access.ok) return;

    if (app.config.custom_commands[commandName].cooldown_seconds > 0) {
      if (!app.cooldowns.tryConsume('cmd', ctx.user.id, `custom:${commandName}`, command.cooldown_seconds)) return;
    }

    if (command.delete_input) {
      const delay = command.delete_input === true ? 0 : command.delete_input * 1000;
      setTimeout(() => message.delete().catch(() => undefined), delay);
    }

    const start = Date.now();
    let success = true;
    try {
      await this.executeActions(ctx, command.actions, commandName);
    } catch (err) {
      success = false;
      app.logger.error(`Custom command ${commandName} failed:`, err);
      await app.logManager.reportError(`Custom command ${commandName}`, err);
    }

    if (command.delete_output && ctx.lastSent) {
      const delay = command.delete_output === true ? 0 : command.delete_output * 1000;
      setTimeout(() => ctx.lastSent?.delete().catch(() => undefined), delay);
    }

    await app.logManager.logCommandUsage({
      guildId: guild.id,
      command: commandName,
      userId: ctx.user.id,
      surface: 'prefix',
      success,
      durationMs: Date.now() - start,
    });
  }

  public async runSlash(app: App, interaction: ChatInputCommandInteraction, commandName: string): Promise<void> {
    const command = app.config.custom_commands[commandName];
    if (!command || !command.enabled || !command.slash) return;
    const guild = interaction.guild;
    const member = interaction.member as GuildMember | null;
    if (!guild || !member) return;

    const args = (interaction.options.getString('args') ?? '').split(/\s+/).filter(Boolean);
    const ctx = await this.makeContext(app, command, commandName, guild, interaction.channel as TextChannel, member, interaction.user, args, {
      interaction,
    });
    const access = await this.checkAccess(app, ctx);
    if (!access.ok) {
      await interaction.reply({ content: access.reason ?? 'You cannot use this command.', ephemeral: true }).catch(() => undefined);
      return;
    }

    if (!app.cooldowns.tryConsume('cmd', ctx.user.id, `custom:${commandName}`, command.cooldown_seconds)) {
      const remaining = app.cooldowns.remainingSeconds('cmd', ctx.user.id, `custom:${commandName}`);
      await interaction.reply({ content: `Slow down! Try again in ${remaining}s.`, ephemeral: true }).catch(() => undefined);
      return;
    }

    await interaction.deferReply({ ephemeral: command.ephemeral }).catch(() => undefined);

    const start = Date.now();
    let success = true;
    try {
      await this.executeActions(ctx, command.actions, commandName);
      if (!ctx.responded) await interaction.editReply({ content: '✅' }).catch(() => undefined);
    } catch (err) {
      success = false;
      app.logger.error(`Custom command ${commandName} failed:`, err);
      await app.logManager.reportError(`Custom command ${commandName}`, err);
      await interaction.editReply({ content: 'An error occurred while running this command.' }).catch(() => undefined);
    }

    await app.logManager.logCommandUsage({
      guildId: guild.id,
      command: commandName,
      userId: ctx.user.id,
      surface: 'slash',
      success,
      durationMs: Date.now() - start,
    });
  }

  private async makeContext(
    app: App,
    command: CustomCommandConfig,
    commandName: string,
    guild: Guild,
    channel: TextChannel,
    member: GuildMember,
    user: User,
    args: string[],
    extra: Partial<Pick<CustomCommandContext, 'message' | 'interaction'>> = {},
  ): Promise<CustomCommandContext> {
    const tag = user.username;
    const displayName = member.displayName || user.displayName || user.username;
    const nickname = member.nickname ?? undefined;
    const avatarURL = user.displayAvatarURL({ size: 256 });
    const placeholders: Record<string, string | number> = {
      user: displayName,
      username: tag,
      userid: user.id,
      mention: `<@${user.id}>`,
      useravatarurl: avatarURL,
      usernickname: nickname ?? displayName,
      userdisplayname: displayName,
      authortag: tag,
      authorname: user.username,
      authormention: `<@${user.id}>`,
      authoravatarurl: avatarURL,
      authorid: user.id,
      guild: guild.name,
      guildname: guild.name,
      guildid: guild.id,
      guildiconurl: guild.iconURL({ size: 256 }) ?? '',
      membercount: guild.memberCount,
      channel: channel.name,
      channelid: channel.id,
      channelname: channel.name,
      args: args.join(' '),
    };
    args.forEach((a, i) => {
      placeholders[`arg${i}`] = a;
      placeholders[`arg${i + 1}`] = a;
    });
    return {
      app,
      command,
      commandName,
      guild,
      channel,
      member,
      user,
      args,
      message: extra.message,
      interaction: extra.interaction,
      lastSent: null,
      responded: false,
      counters: new Map(),
      placeholders,
    };
  }

  private async checkAccess(app: App, ctx: CustomCommandContext): Promise<{ ok: boolean; reason?: string }> {
    const c = ctx.command;
    if (app.modGuard.isOwner(ctx.user.id)) return { ok: true };

    if (c.allowed_users.length > 0 && !c.allowed_users.includes(ctx.user.id)) {
      return { ok: false, reason: 'You are not allowed to use this command.' };
    }
    if (c.allowed_roles.length > 0 && !ctx.member.roles.cache.some((r) => c.allowed_roles.includes(r.id))) {
      return { ok: false, reason: 'You need a required role to use this command.' };
    }
    if (c.denied_roles.length > 0 && ctx.member.roles.cache.some((r) => c.denied_roles.includes(r.id))) {
      return { ok: false, reason: 'You are blocked from using this command.' };
    }
    if (c.permissions.length > 0) {
      const missing = c.permissions.filter((p) => !ctx.member.permissions.has(p as never));
      if (missing.length > 0) return { ok: false, reason: `Missing permission(s): ${missing.join(', ')}` };
    }
    if (c.channel_ids.length > 0) {
      const inList = c.channel_ids.includes(ctx.channel.id);
      if (c.channel_mode === 'allow' && !inList) return { ok: false, reason: 'This command cannot be used in this channel.' };
      if (c.channel_mode === 'deny' && inList) return { ok: false, reason: 'This command cannot be used in this channel.' };
    }
    return { ok: true };
  }

  private async executeActions(ctx: CustomCommandContext, actions: CustomCommandActionUnion[], commandName: string, depth = 0): Promise<void> {
    if (depth > 5) return;
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (typeof action !== 'object' || action === null) continue;
      const cont = await this.executeAction(ctx, action, commandName, i);
      if (!cont) return;
    }
  }

  private async executeAction(ctx: CustomCommandContext, action: CustomCommandActionUnion, commandName: string, index: number): Promise<boolean> {
    const { app } = ctx;
    switch (action.type) {
      case 'send_message': {
        const payload = await this.buildPayload(ctx, { content: action.content, embeds: action.embeds, components: action.components, files: action.files });
        const reply = action.reply ?? !ctx.command.suppress_reply;
        await this.send(ctx, payload, {
          reply: reply && !ctx.command.suppress_reply,
          ephemeral: action.ephemeral ?? ctx.command.ephemeral,
          deleteAfter: action.delete_after_seconds,
          mention: action.mention ?? false,
        });
        return true;
      }
      case 'edit_message': {
        const payload = await this.buildPayload(ctx, { content: action.content, embeds: action.embeds, components: action.components, files: action.files });
        if (ctx.lastSent) {
          await ctx.lastSent.edit({ ...payload, allowedMentions: { parse: [] } } as never).catch(() => undefined);
        } else if (ctx.interaction) {
          await ctx.interaction.editReply(payload as never).catch(() => undefined);
        }
        return true;
      }
      case 'send_channel': {
        const payload = await this.buildPayload(ctx, { content: action.content, embeds: action.embeds, components: action.components, files: action.files });
        await this.send(ctx, payload, { channelId: action.channel_id, deleteAfter: action.delete_after_seconds });
        return true;
      }
      case 'dm': {
        const payload = await this.buildPayload(ctx, { content: action.content, embeds: action.embeds, components: action.components, files: action.files });
        const dm = await ctx.user.createDM().catch(() => null);
        if (dm) await dm.send(payload as never).catch(() => undefined);
        return true;
      }
      case 'delete_message': {
        if (ctx.message) {
          const delay = action.delete_after_seconds * 1000;
          setTimeout(() => ctx.message?.delete().catch(() => undefined), delay);
        }
        return true;
      }
      case 'react': {
        if (ctx.message) {
          for (const e of action.emojis) {
            await ctx.message.react(e).catch(() => undefined);
          }
        }
        return true;
      }
      case 'add_role': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.roles.add(action.role_id).catch(() => undefined);
        return true;
      }
      case 'remove_role': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.roles.remove(action.role_id).catch(() => undefined);
        return true;
      }
      case 'add_roles': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.roles.add(action.role_ids).catch(() => undefined);
        return true;
      }
      case 'remove_roles': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.roles.remove(action.role_ids).catch(() => undefined);
        return true;
      }
      case 'kick': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.kick(action.reason).catch(() => undefined);
        return true;
      }
      case 'ban': {
        const target = await this.resolveTarget(ctx, action);
        if (!target) return true;
        const reason = renderPlaceholders(action.reason ?? 'Custom command ban', ctx.placeholders);
        await ctx.guild.members.ban(target.id, { reason, deleteMessageSeconds: action.delete_message_days * 86400 }).catch(() => undefined);
        if (action.duration && action.duration !== 'perm') {
          const parsed = parseDuration(action.duration);
          if (parsed && !parsed.isPermanent) {
            setTimeout(() => ctx.guild.bans.remove(target.id, `Ban duration expired (${action.duration})`).catch(() => undefined), parsed.milliseconds);
          }
        }
        return true;
      }
      case 'unban': {
        await ctx.guild.bans.remove(action.user_id, action.reason).catch(() => undefined);
        return true;
      }
      case 'timeout': {
        const target = await this.resolveTarget(ctx, action);
        if (target) {
          const parsed = parseDuration(action.duration) ?? { milliseconds: 60_000, isPermanent: false };
          await target.timeout(parsed.isPermanent ? null : parsed.milliseconds, action.reason).catch(() => undefined);
        }
        return true;
      }
      case 'untimeout': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.timeout(null, action.reason).catch(() => undefined);
        return true;
      }
      case 'create_thread': {
        const channel = ctx.channel as TextChannel & { threads?: { create: (o: Record<string, unknown>) => Promise<unknown> } };
        await channel.threads?.create({
          name: renderPlaceholders(action.name, ctx.placeholders),
          autoArchiveDuration: action.auto_archive_duration,
          reason: action.reason,
        }).catch(() => undefined);
        return true;
      }
      case 'set_nickname': {
        const target = await this.resolveTarget(ctx, action);
        if (target) await target.setNickname(renderPlaceholders(action.nickname, ctx.placeholders), action.reason).catch(() => undefined);
        return true;
      }
      case 'move_channel': {
        const target = await this.resolveTarget(ctx, action);
        if (target && target.voice.channelId) await target.voice.setChannel(action.channel_id, action.reason).catch(() => undefined);
        return true;
      }
      case 'disconnect': {
        const target = await this.resolveTarget(ctx, action);
        if (target && target.voice.channelId) await target.voice.disconnect(action.reason).catch(() => undefined);
        return true;
      }
      case 'create_role': {
        await ctx.guild.roles.create({
          name: renderPlaceholders(action.name, ctx.placeholders),
          color: action.color ? (hexToInt(action.color) ?? 0) : 0,
          hoist: action.hoist,
          mentionable: action.mentionable,
          permissions: action.permissions as never,
          reason: action.reason,
        }).catch(() => undefined);
        return true;
      }
      case 'delete_role': {
        await ctx.guild.roles.delete(action.role_id, action.reason).catch(() => undefined);
        return true;
      }
      case 'rename_channel': {
        const ch = action.channel_id ? (ctx.guild.channels.cache.get(action.channel_id) as TextChannel | undefined) : ctx.channel;
        if (ch && 'setName' in ch) await (ch as TextChannel).setName(renderPlaceholders(action.name, ctx.placeholders), action.reason).catch(() => undefined);
        return true;
      }
      case 'wait': {
        await new Promise((r) => setTimeout(r, action.ms));
        return true;
      }
      case 'random_pick': {
        const pick = action.choices[Math.floor(Math.random() * action.choices.length)];
        const payload = await this.buildPayload(ctx, pick);
        await this.send(ctx, payload, { reply: !ctx.command.suppress_reply, ephemeral: ctx.command.ephemeral });
        return true;
      }
      case 'run_command': {
        const target = action.command.toLowerCase();
        const runArgs = (action.args || ctx.args.join(' ')).split(/\s+/).filter(Boolean);
        const custom = app.config.custom_commands[target];
        if (custom && custom.enabled) {
          const subCtx = await this.makeContext(app, custom, target, ctx.guild, ctx.channel, ctx.member, ctx.user, runArgs, {
            message: ctx.message,
            interaction: ctx.interaction,
          });
          subCtx.responded = ctx.responded;
          subCtx.lastSent = ctx.lastSent;
          await this.executeActions(subCtx, custom.actions, target, 1);
          ctx.responded = subCtx.responded;
          ctx.lastSent = subCtx.lastSent;
          return true;
        }
        const builtin = app.commands.get(target);
        if (builtin?.prefixExecute && ctx.message) {
          await builtin.prefixExecute(ctx.message, runArgs, app);
        }
        return true;
      }
      case 'stop':
        return false;
      case 'log': {
        const target = action.channel_id ? (ctx.guild.channels.cache.get(action.channel_id) as TextChannel | undefined) : ctx.channel;
        if (target && 'send' in target) {
          await (target as TextChannel).send({ content: renderPlaceholders(action.content, ctx.placeholders) }).catch(() => undefined);
        }
        return true;
      }
      case 'webhook': {
        const payload = await this.buildPayload(ctx, { content: action.content, embeds: action.embeds, components: action.components, files: action.files });
        const hook = new WebhookClient({ url: action.url });
        await hook.send(payload as never).catch(() => undefined);
        return true;
      }
      case 'counter': {
        let value = ctx.counters.get(action.name) ?? 0;
        if (action.persist) {
          await app.db.execute(
            'INSERT INTO custom_command_counters (guild_id, name, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = value + ?',
            [ctx.guild.id, action.name, action.increment_by, action.increment_by],
          );
          const [rows] = await app.db.query('SELECT value FROM custom_command_counters WHERE guild_id = ? AND name = ?', [ctx.guild.id, action.name]);
          const row = (rows as Array<{ value: number }>)[0];
          if (row) value = row.value;
        } else {
          value += action.increment_by;
          ctx.counters.set(action.name, value);
        }
        ctx.placeholders.count = value;
        ctx.placeholders[`counter_${action.name}`] = value;
        if (action.send_result) {
          const payload = await this.buildPayload(ctx, { content: `{counter_${action.name}}` });
          await this.send(ctx, payload, { reply: !ctx.command.suppress_reply, ephemeral: ctx.command.ephemeral });
        }
        return true;
      }
      case 'if': {
        let pass = false;
        if (action.condition === 'has_role' && action.role_id) {
          pass = ctx.member.roles.cache.has(action.role_id);
        } else if (action.condition === 'not_has_role' && action.role_id) {
          pass = !ctx.member.roles.cache.has(action.role_id);
        } else if (action.condition === 'is_bot') {
          pass = ctx.user.bot;
        } else if (action.condition === 'has_permission' && action.permission) {
          pass = ctx.member.permissions.has(action.permission as never);
        } else if (action.condition === 'equals_arg') {
          pass = (ctx.args[action.arg_index ?? 0] ?? '') === action.equals;
        }
        const branch = pass ? action.then : action.else;
        if (branch) await this.executeActions(ctx, branch as CustomCommandActionUnion[], commandName, 2);
        return true;
      }
      default:
        return true;
    }
  }

  private async buildPayload(ctx: CustomCommandContext, payload: MessagePayload): Promise<Payload> {
    const out: Payload = {};
    if (payload.content) out.content = renderPlaceholders(payload.content, ctx.placeholders);
    if (payload.embeds && payload.embeds.length > 0) {
      out.embeds = payload.embeds.map((e) => this.buildEmbed(e, ctx.placeholders));
    }
    if (payload.components && payload.components.length > 0) {
      out.components = this.buildComponents(ctx, payload.components);
    }
    if (payload.files && payload.files.length > 0) out.files = payload.files;
    return out;
  }

  private buildEmbed(spec: EmbedSpec, placeholders: Record<string, string | number>): EmbedBuilder {
    const b = new EmbedBuilder();
    if (spec.title) b.setTitle(renderPlaceholders(spec.title, placeholders));
    if (spec.description) b.setDescription(renderPlaceholders(spec.description, placeholders));
    if (spec.color) b.setColor(hexToInt(spec.color) ?? 0x5865f2);
    if (spec.url) b.setURL(renderPlaceholders(spec.url, placeholders));
    if (spec.timestamp) b.setTimestamp();
    if (spec.image) b.setImage(renderPlaceholders(spec.image, placeholders));
    if (spec.thumbnail) b.setThumbnail(renderPlaceholders(spec.thumbnail, placeholders));
    if (spec.author) {
      b.setAuthor({
        name: renderPlaceholders(spec.author.name, placeholders),
        url: spec.author.url ? renderPlaceholders(spec.author.url, placeholders) : undefined,
        iconURL: spec.author.icon_url ? renderPlaceholders(spec.author.icon_url, placeholders) : undefined,
      });
    }
    for (const f of spec.fields ?? []) {
      b.addFields({ name: renderPlaceholders(f.name, placeholders), value: renderPlaceholders(f.value, placeholders), inline: f.inline ?? false });
    }
    if (spec.footer) {
      b.setFooter({
        text: renderPlaceholders(spec.footer.text, placeholders),
        iconURL: spec.footer.icon_url ? renderPlaceholders(spec.footer.icon_url, placeholders) : undefined,
      });
    }
    return b;
  }

  private buildComponents(ctx: CustomCommandContext, rows: Array<{ components: Array<ButtonSpec | SelectSpec> }>): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
    const out: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    const prefix = `cc:${ctx.commandName}:`;
    for (const row of rows) {
      const actionRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>();
      for (const comp of row.components) {
        if (comp.type === 'button') {
          const b = new ButtonBuilder().setLabel(comp.label.slice(0, 80)).setDisabled(comp.disabled);
          if (comp.emoji) b.setEmoji(comp.emoji);
          if (comp.url) {
            b.setStyle(ButtonStyle.Link).setURL(renderPlaceholders(comp.url, ctx.placeholders));
          } else {
            b.setStyle(({ primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, link: ButtonStyle.Link } as const)[comp.style ?? 'secondary'])
              .setCustomId(comp.custom_id ?? `${prefix}${comp.id}`);
          }
          actionRow.addComponents(b);
        } else {
          const s = new StringSelectMenuBuilder()
            .setCustomId(comp.custom_id ?? `${prefix}${comp.id}`)
            .setPlaceholder(comp.placeholder?.slice(0, 150) || 'Select an option')
            .setMinValues(comp.min_values ?? 1)
            .setMaxValues(comp.max_values ?? 1);
          for (const opt of comp.options) {
            const ob = new StringSelectMenuOptionBuilder()
              .setLabel(opt.label.slice(0, 100))
              .setValue(opt.value.slice(0, 100));
            if (opt.description) ob.setDescription(opt.description.slice(0, 100));
            if (opt.emoji) ob.setEmoji(opt.emoji);
            s.addOptions(ob);
          }
          actionRow.addComponents(s);
        }
      }
      out.push(actionRow);
    }
    return out;
  }

  private async send(ctx: CustomCommandContext, payload: Payload, opts: SendOpts = {}): Promise<void> {
    const { app } = ctx;
    const allowedMentions = opts.mention ? undefined : { parse: [] };
    const body = { ...payload, allowedMentions } as never;
    let sent: Message | null = null;

    if (ctx.interaction) {
      if (!ctx.responded) {
        try {
          await ctx.interaction.editReply(body);
          ctx.responded = true;
        } catch {
          await ctx.interaction.reply(body).catch(() => undefined);
        }
      } else {
        if (opts.channelId) {
          const ch = ctx.guild.channels.cache.get(opts.channelId) as TextChannel | undefined;
          if (ch && 'send' in ch) sent = await (ch as TextChannel).send(body).catch(() => null) ?? null;
        } else if (opts.ephemeral || ctx.command.ephemeral) {
          await ctx.interaction.followUp({ ...payload, ephemeral: true, allowedMentions } as never).catch(() => undefined);
        } else {
          sent = await ctx.channel.send(body).catch(() => null) ?? null;
        }
      }
    } else if (ctx.message) {
      if (opts.reply && !ctx.command.suppress_reply) {
        const replyMentions = opts.mention ? { repliedUser: false } : { parse: [], repliedUser: false };
        sent = await ctx.message.reply({ ...payload, allowedMentions: replyMentions }).catch(() => null) ?? null;
      } else if (opts.channelId) {
        const ch = ctx.guild.channels.cache.get(opts.channelId) as TextChannel | undefined;
        if (ch && 'send' in ch) sent = await (ch as TextChannel).send(body).catch(() => null) ?? null;
      } else {
        sent = await ctx.channel.send(body).catch(() => null) ?? null;
      }
    } else {
      const ch = ctx.guild.channels.cache.get(opts.channelId ?? ctx.channel.id) as TextChannel | undefined;
      if (ch && 'send' in ch) sent = await (ch as TextChannel).send(body).catch(() => null) ?? null;
    }

    if (sent) {
      ctx.lastSent = sent;
      if (opts.deleteAfter && opts.deleteAfter > 0) {
        setTimeout(() => sent?.delete().catch(() => undefined), opts.deleteAfter * 1000);
      }
    }
  }

  private async resolveTarget(ctx: CustomCommandContext, action: { target?: string; user_id?: string }): Promise<GuildMember | null> {
    const { app, guild } = ctx;
    if (action.user_id) {
      return (await guild.members.fetch(action.user_id).catch(() => null)) ?? null;
    }
    const target = action.target ?? 'author';
    if (target === 'author') return ctx.member;
    let id: string | undefined;
    if (target === 'mentioned') {
      if (ctx.interaction) {
        id = ctx.interaction.options.getUser('user')?.id;
      }
      if (!id && ctx.message) {
        const mentioned = ctx.message.mentions.users.first();
        if (mentioned) id = mentioned.id;
      }
    }
    if (!id && target === 'mentioned') id = ctx.args.find((a) => /^(?:<@!?)?\d{15,20}>?$/.test(a));
    if (!id && target === 'first_arg') id = ctx.args[0];
    if (!id && target === 'args') id = ctx.args.join(' ').match(/\d{15,20}/)?.[0];
    if (!id) return null;
    return (await guild.members.fetch(id.replace(/[<@!>]/g, '')).catch(() => null)) ?? null;
  }
}