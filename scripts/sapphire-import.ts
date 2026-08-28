import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { configSchema, LOG_EVENT_NAMES } from '../shared/src/config/schema';
import { runCrossFieldChecks } from '../shared/src/config/crossField';

const GUILD = '1466990155020898413';

interface SapCondition {
  type: number;
  value: string;
}

interface SapAction {
  type: string;
  value: unknown;
  delay?: number;
}

interface SapTrigger {
  condition?: number[];
  channelIds?: string[];
  channelMode?: string;
  actions: SapAction[];
}

const FILES = {
  automod: 'auto-moderationData-1466990155020898413.json',
  welcome: 'welcome-messagesData-1466990155020898413.json',
  roles: 'role-connectionsData-1466990155020898413.json',
  logging: 'loggingData-1466990155020898413.json',
  commands: 'commandsData-1466990155020898413.json',
  moderation: 'moderationData-1466990155020898413.json',
};

function readJson<T>(name: string): T {
  const p = path.resolve(process.cwd(), name);
  if (!fs.existsSync(p)) throw new Error(`Missing import file: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const PERM_MAP: Record<string, string> = {
  ADD_REACTIONS: 'AddReactions',
  ADMINISTRATOR: 'Administrator',
  ATTACH_FILES: 'AttachFiles',
  BAN_MEMBERS: 'BanMembers',
  CHANGE_NICKNAME: 'ChangeNickname',
  CONNECT: 'Connect',
  CREATE_INSTANT_INVITE: 'CreateInstantInvite',
  CREATE_PRIVATE_THREADS: 'CreatePrivateThreads',
  CREATE_PUBLIC_THREADS: 'CreatePublicThreads',
  DEAFEN_MEMBERS: 'DeafenMembers',
  EMBED_LINKS: 'EmbedLinks',
  KICK_MEMBERS: 'KickMembers',
  MANAGE_CHANNELS: 'ManageChannels',
  MANAGE_GUILD: 'ManageGuild',
  MANAGE_MESSAGES: 'ManageMessages',
  MANAGE_NICKNAMES: 'ManageNicknames',
  MANAGE_ROLES: 'ManageRoles',
  MANAGE_THREADS: 'ManageThreads',
  MANAGE_WEBHOOKS: 'ManageWebhooks',
  MENTION_EVERYONE: 'MentionEveryone',
  MODERATE_MEMBERS: 'ModerateMembers',
  MOVE_MEMBERS: 'MoveMembers',
  MUTE_MEMBERS: 'MuteMembers',
  PRIORITY_SPEAKER: 'PrioritySpeaker',
  READ_MESSAGE_HISTORY: 'ReadMessageHistory',
  REQUEST_TO_SPEAK: 'RequestToSpeak',
  SEND_MESSAGES: 'SendMessages',
  SEND_MESSAGES_IN_THREADS: 'SendMessagesInThreads',
  SEND_TTS_MESSAGES: 'SendTTSMessages',
  SPEAK: 'Speak',
  STREAM: 'Stream',
  USE_APPLICATION_COMMANDS: 'UseApplicationCommands',
  USE_EXTERNAL_EMOJIS: 'UseExternalEmojis',
  USE_EXTERNAL_STICKERS: 'UseExternalStickers',
  USE_VAD: 'UseVAD',
  VIEW_AUDIT_LOG: 'ViewAuditLog',
  VIEW_CHANNEL: 'ViewChannel',
  VIEW_GUILD_INSIGHTS: 'ViewGuildInsights',
};

function mapPerms(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((p) => PERM_MAP[p]).filter((p): p is string => Boolean(p));
}

function fixDuration(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.replace(/^(\d+)hr$/, '$1h').replace(/^(\d+)min$/, '$1m').replace(/^(\d+)sec$/, '$1s');
}

function stripEmoji(s: string): string {
  return s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function replacePlaceholders(s: string): string {
  return stripEmoji(
    s
      .replace(/\$\{userid\}/g, '{mention}')
      .replace(/\$\{user\}/g, '{user}')
      .replace(/\$\{guildname\}/g, '{guild}')
      .replace(/\$\{membercount\}/g, '{member_count}')
      .replace(/\$\{(?:useravatarurl|memberavatarurl)\}/g, ''),
  );
}

interface ImportedActions {
  chain: unknown[];
  notes: string[];
}

function buildChain(actions: SapAction[], ruleName: string, escalate = true): ImportedActions {
  const chain: unknown[] = [];
  const notes: string[] = [];
  for (const a of actions) {
    if (a.type === 'delete') {
      chain.push({ type: 'delete_message' });
    } else if (a.type === 'message') {
      // Long member-facing message needs time to read — always 60s auto-delete.
      const deleteAfter = 60;
      chain.push({
        type: 'send_channel_message',
        format: 'components_v2',
        content: 'Your message was removed in {channel}.',
        title: 'Message Removed',
        description:
          "Hey {user} - one of your messages was just removed because it didn't follow this server's rules.\n\n" +
          "That's all that happened - your account is fine and no punishment was applied. Please take a moment to review the rules before your next message.\n\n" +
          "If you think this was a mistake, just message any staff member and we'll happily take another look.",
        footer: 'Thanks for helping keep {guild} friendly and safe.',
        accent_color: '#ED4245',
        delete_after_seconds: deleteAfter,
      });
    } else if (a.type === 'moderation') {
      const list = (a.value as Array<{ type: string; duration: string | null; reason: string }>) ?? [];
      for (const m of list) {
        const reason = m.reason || `Automod: ${ruleName}`;
        const duration = fixDuration(m.duration);
        if (m.type === 'warn') {
          chain.push({ type: 'warn', reason });
        } else if (m.type === 'mute') {
          chain.push({ type: 'timeout', duration: duration ?? '1h', reason });
        } else if (m.type === 'ban') {
          chain.push({ type: 'ban', duration: duration ?? 'perm', reason });
        } else if (m.type === 'kick') {
          chain.push({ type: 'kick', reason });
        } else {
          notes.push(`skipped moderation action type "${m.type}"`);
        }
      }
    } else if (a.type === 'report') {
      notes.push('report action not representable in a chain (staff report card is separate)');
    } else {
      notes.push(`skipped unknown action type "${a.type}"`);
    }
  }
  if (chain.length === 0) chain.push({ type: 'warn', reason: `Automod: ${ruleName}` });
  if (escalate) chain.push({ type: 'run_escalation_check' });
  return { chain, notes };
}

function thresholdFromCondition(cond: number[] | undefined): { threshold: number; windowSeconds: number } {
  if (!cond || cond.length < 3) return { threshold: 5, windowSeconds: 3 };
  return { threshold: cond[0], windowSeconds: cond[1] };
}

function compileRule(pattern: string, flags: string): { ok: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function normalizePattern(raw: string): { pattern: string; needsS: boolean; needsM: boolean; needsI: boolean } {
  const needsI = /\(\?i\)/.test(raw);
  const needsS = /\(\?s\)/.test(raw);
  const needsM = /\(\?m\)/.test(raw);
  const pattern = raw.replace(/\(\?[a-zA-Z-]+\)/g, '');
  return { pattern, needsS, needsM, needsI };
}

const LOG_MAP: Record<string, string> = {
  // channels
  channelcreate: 'channel_create',
  channeldelete: 'channel_delete',
  channelpinsupdate: 'channel_pins_update',
  channeltopicupdate: 'channel_update',
  channelnameupdate: 'channel_update',
  channelnsfwupdate: 'channel_update',
  channelparentupdate: 'channel_update',
  channelpermissionsupdate: 'channel_update',
  channeltypeupdate: 'channel_update',
  channelbitrateupdate: 'channel_update',
  channeluserlimitupdate: 'channel_update',
  channelslowmodeupdate: 'channel_update',
  channelrtcregionupdate: 'channel_update',
  channelvideoqualityupdate: 'channel_update',
  channeldefaultarchivedurationupdate: 'channel_update',
  channeldefaultthreadslowmodeupdate: 'channel_update',
  channeldefaultreactionemojiupdate: 'channel_update',
  channeldefaultsortorderupdate: 'channel_update',
  channelforumtagsupdate: 'channel_update',
  channelforumlayoutupdate: 'channel_update',
  channelvoicestatusupdate: 'channel_update',
  // messages
  messagedelete: 'message_delete',
  messagebulkdelete: 'message_bulk_delete',
  messageedit: 'message_edit',
  messagepublish: 'message_publish',
  messagesentusingcommand: 'command_usage',
  // members
  memberjoin: 'member_join',
  memberleave: 'member_leave',
  banadd: 'member_ban',
  banremove: 'member_unban',
  kickadd: 'member_kick',
  kickremove: 'member_unban',
  muteadd: 'member_timeout',
  muteremove: 'member_unmute',
  warnadd: 'member_warn',
  warnremove: 'member_unwarn',
  userrolesadd: 'role_add',
  userrolesremove: 'role_remove',
  userrolesupdate: 'role_update',
  useravatarupdate: 'member_avatar_update',
  usernameupdate: 'member_username_update',
  // roles
  rolecreate: 'role_create',
  roledelete: 'role_delete',
  rolecolorupdate: 'role_update',
  rolehoistupdate: 'role_update',
  rolementionableupdate: 'role_update',
  rolenameupdate: 'role_update',
  rolepermissionsupdate: 'role_update',
  roleiconupdate: 'role_update',
  // emojis / stickers / soundboard
  emojicreate: 'emoji_create',
  emojidelete: 'emoji_delete',
  emojinameupdate: 'emoji_update',
  emojirolesupdate: 'emoji_update',
  stickercreate: 'sticker_create',
  stickerdelete: 'sticker_delete',
  stickername: 'sticker_update',
  stickerdescriptionupdate: 'sticker_update',
  stickerrelatedemojiupdate: 'sticker_update',
  soundboardsoundupload: 'soundboard_update',
  soundboardsoundnameupdate: 'soundboard_update',
  soundboardsoundvolumeupdate: 'soundboard_update',
  soundboardsoundemojiupdate: 'soundboard_update',
  soundboardsounddelete: 'soundboard_update',
  // threads
  threadcreate: 'thread_create',
  threaddelete: 'thread_delete',
  threadnameupdate: 'thread_update',
  threadslowmodeupdate: 'thread_update',
  threadarchivedurationupdate: 'thread_update',
  threadarchive: 'thread_update',
  threadunarchive: 'thread_update',
  threadlock: 'thread_update',
  threadunlock: 'thread_update',
  // invites
  invitecreate: 'invite_create',
  invitedelete: 'invite_delete',
  invitepost: 'invite_create',
  // polls
  pollcreate: 'poll_create',
  polldelete: 'poll_delete',
  pollfinalize: 'poll_finalize',
  pollvotesadd: 'poll_votes',
  pollvotesremove: 'poll_votes',
  // scheduled events / stages
  eventcreate: 'scheduled_event',
  eventdelete: 'scheduled_event',
  eventlocationupdate: 'scheduled_event',
  eventdescriptionupdate: 'scheduled_event',
  eventnameupdate: 'scheduled_event',
  eventprivacylevelupdate: 'scheduled_event',
  eventstarttimeupdate: 'scheduled_event',
  eventendtimeupdate: 'scheduled_event',
  eventstatusupdate: 'scheduled_event',
  eventimageupdate: 'scheduled_event',
  eventusersubscribe: 'scheduled_event',
  eventuserunsubscribe: 'scheduled_event',
  stagestart: 'stage_event',
  stageend: 'stage_event',
  stagetopicupdate: 'stage_event',
  stageprivacyupdate: 'stage_event',
  // voice
  voicechannelfull: 'voice_state_update',
  voiceuserjoin: 'voice_state_update',
  voiceuserswitch: 'voice_state_update',
  voiceuserleave: 'voice_state_update',
  voiceusermove: 'voice_state_update',
  voiceuserkick: 'voice_state_update',
  // webhooks / apps
  webhookcreate: 'webhook_update',
  webhookavatarupdate: 'webhook_update',
  webhooknameupdate: 'webhook_update',
  webhookchannelupdate: 'webhook_update',
  webhookdelete: 'webhook_update',
  // guild
  guildafkchannelupdate: 'guild_update',
  guildafktimeoutupdate: 'guild_update',
  guilddiscoverysplashupdate: 'guild_update',
  guildmessagenotificationsupdate: 'guild_update',
  guildbannerupdate: 'guild_update',
  guildmfalevelupdate: 'guild_update',
  guildiconupdate: 'guild_update',
  guildfeaturesupdate: 'guild_update',
  guildcontentfilterlevelupdate: 'guild_update',
  guildpublicupdateschannelupdate: 'guild_update',
  guildboostprogressbartoggle: 'guild_update',
  guildboostlevelupdate: 'member_boost',
  guildpartneredupdate: 'guild_update',
  // moderation / automod
  automoderation: 'automod_trigger',
  casedelete: 'case_edit',
  casemassdelete: 'case_edit',
  caseupdate: 'case_edit',
  usernoteadd: 'note_add',
  usernoteremove: 'note_remove',
  reportcreate: 'report_created',
  reportsignore: 'report_resolved',
  reportsaccept: 'report_resolved',
  discordautomodrulecreate: 'automod_rule_update',
  discordautomodruledelete: 'automod_rule_update',
  discordautomodruletoggle: 'automod_rule_update',
  discordautomodrulenameupdate: 'automod_rule_update',
  discordautomodruleactionsupdate: 'automod_rule_update',
  discordautomodrulecontentupdate: 'automod_rule_update',
  discordautomodrulerolesupdate: 'automod_rule_update',
  discordautomodrulechannelsupdate: 'automod_rule_update',
  discordautomodrulewhitelistupdate: 'automod_rule_update',
};

function mapLogEvent(sapEvent: string): string | null {
  const lower = sapEvent.toLowerCase();
  const mapped = LOG_MAP[lower];
  if (mapped) return mapped;
  if ((LOG_EVENT_NAMES as readonly string[]).includes(sapEvent)) return sapEvent;
  return null;
}

async function main(): Promise<void> {
  const automod = readJson<any>(FILES.automod);
  const welcome = readJson<any>(FILES.welcome);
  const roles = readJson<any>(FILES.roles);
  const logging = readJson<any>(FILES.logging);
  const commands = readJson<any>(FILES.commands);
  const moderation = readJson<any>(FILES.moderation);

  const configPath = path.resolve(process.cwd(), 'config.yml');
  const existing = YAML.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, any>;

  const cfg = existing;

  // ---- bot prefixes ----
  if (Array.isArray(commands.prefixes) && commands.prefixes.length > 0) {
    cfg.bot.prefixes = commands.prefixes;
  }

  // ---- commands: toggles, restrictions, aliases ----
  const cmdMap = cfg.commands ?? {};
  const sapCommands = (commands.defaultCommands ?? []) as any[];
  for (const sc of sapCommands) {
    if (sc.enabled === false) {
      cmdMap[sc.name] = { ...(cmdMap[sc.name] ?? {}), enabled: false };
      continue;
    }
    const entry: Record<string, unknown> = { ...(cmdMap[sc.name] ?? {}) };
    entry.enabled = true;
    if (sc.restrictions) {
      const perms = mapPerms(sc.restrictions.permissions);
      if (perms.length > 0) entry.permissions = perms;
      if (sc.restrictions.roleIds && sc.restrictions.roleIds.length > 0) {
        entry.immune_roles = sc.restrictions.roleIds;
      }
    }
    if (Array.isArray(sc.aliases) && sc.aliases.length > 0) {
      const existingAliases = Array.isArray(entry.aliases) ? (entry.aliases as string[]) : [];
      entry.aliases = [...new Set([...existingAliases, ...sc.aliases.filter((a: string) => a !== sc.name)])];
    }
    cmdMap[sc.name] = entry;
  }
  cfg.commands = cmdMap;

  // drop aliases that collide with any real command name (e.g. sapphire has both
  // `purge` and `prune` commands, so `prune` must not also be a purge alias)
  const commandNames = new Set(Object.keys(cmdMap));
  for (const [name, entry] of Object.entries(cmdMap) as Array<[string, Record<string, unknown>]>) {
    if (Array.isArray(entry.aliases)) {
      entry.aliases = (entry.aliases as string[]).filter((a) => !(commandNames.has(a) && a !== name));
      if ((entry.aliases as string[]).length === 0) delete entry.aliases;
    }
  }
  cfg.commands = cmdMap;

  // ---- automod ----
  const immuneRoles = [...new Set<string>([
    ...(automod.spam?.roleIds ?? []),
    ...(automod.channelSpam?.roleIds ?? []),
  ])];
  const globalImmune = [...new Set<string>([
    ...immuneRoles,
    ...(moderation.immuneToPunishRoleIds?.global ?? []),
  ])];

  const am = cfg.automod;
  am.enabled = automod.enabled ?? true;
  if (globalImmune.length > 0) am.global_immune_roles = globalImmune;

  const spamCond = thresholdFromCondition(automod.spam?.actions?.[0]?.condition);
  const spamChain = buildChain(automod.spam?.actions?.[0]?.actions ?? [], 'spam');
  am.modules.spam.enabled = automod.enabled ?? true;
  am.modules.spam.threshold = spamCond.threshold;
  am.modules.spam.window_seconds = spamCond.windowSeconds;
  am.modules.spam.immune_roles = automod.spam?.roleIds ?? [];
  am.modules.spam.action_chain = spamChain.chain;

  const ccCond = thresholdFromCondition(automod.channelSpam?.actions?.[0]?.condition);
  const ccChain = buildChain(automod.channelSpam?.actions?.[0]?.actions ?? [], 'cross_channel');
  am.modules.cross_channel.enabled = automod.enabled ?? true;
  am.modules.cross_channel.threshold = ccCond.threshold;
  am.modules.cross_channel.window_seconds = ccCond.windowSeconds;
  am.modules.cross_channel.immune_roles = automod.channelSpam?.roleIds ?? [];
  am.modules.cross_channel.action_chain = ccChain.chain;

  // ---- links: allowlist of domains + roles/channels exempt from link moderation ----
  const linksGroup = (automod.links?.groups ?? [])[0];
  if (linksGroup) {
    const linkRoles = [...new Set<string>([
      ...(automod.links?.roleIds ?? []),
      ...(linksGroup.roleIds ?? []),
    ])];
    const linkChannels = [...new Set<string>([
      ...(automod.links?.channels ?? []).map((c: { id?: string }) => c?.id).filter(Boolean),
      ...(linksGroup.actions?.[0]?.channelIds ?? []),
    ])];
    const allowlist = [...new Set(
      (linksGroup.list ?? [])
        .map((d: string) => String(d).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/\*$/, '').toLowerCase())
        .filter((h: string) => /^[a-z0-9.-]+$/.test(h) && h.includes('.')),
    )];
    const linkChain = buildChain(linksGroup.actions?.[0]?.actions ?? [], 'links', false);
    am.modules.link_filter.enabled = true;
    am.modules.link_filter.mode = 'allowlist';
    am.modules.link_filter.allowlist = allowlist;
    am.modules.link_filter.immune_roles = linkRoles;
    am.modules.link_filter.channel_ignore_list = linkChannels;
    am.modules.link_filter.suppress_repeat_response_seconds = 30;
    am.modules.link_filter.suppressed_response_mode = 'silent';
    am.modules.link_filter.action_chain = linkChain.chain;
  }

  // ---- discord invites: allow own guild + exempt roles/channels ----
  const inviteGroup = (automod.discordInvites?.groups ?? [])[0];
  if (inviteGroup) {
    const inviteRoles = [...new Set<string>([
      ...(automod.discordInvites?.roleIds ?? []),
      ...(inviteGroup.roleIds ?? []),
    ])];
    const inviteChannels = [...new Set<string>([
      ...(automod.discordInvites?.channels ?? []).map((c: { id?: string }) => c?.id).filter(Boolean),
      ...(inviteGroup.actions?.[0]?.channelIds ?? []),
    ])];
    const guildAllowlist = (inviteGroup.list ?? [])
      .filter((v: string) => /^\d{15,20}$/.test(String(v)))
      .map((v: string) => String(v));
    const inviteChain = buildChain(inviteGroup.actions?.[0]?.actions ?? [], 'invites');
    am.modules.invites.enabled = true;
    am.modules.invites.guild_allowlist = guildAllowlist;
    am.modules.invites.immune_roles = inviteRoles;
    am.modules.invites.channel_ignore_list = inviteChannels;
    am.modules.invites.suppress_repeat_response_seconds = 30;
    am.modules.invites.suppressed_response_mode = 'silent';
    am.modules.invites.action_chain = inviteChain.chain;
  }

  for (const moduleName of ['image_spam', 'executable_files', 'mass_images', 'emoji_spam', 'line_spam', 'poll_spam'] as const) {
    am.modules[moduleName].enabled = false;
  }

  // ---- regex engine: word groups -> rules ----
  const regexRules: any[] = [];
  const importNotes: string[] = [];
  const groups = (automod.words?.groups ?? []) as any[];
  for (const group of groups) {
    const list = (group.list ?? []) as Array<{ value: string; flags?: string }>;
    const rawPatterns = list.map((p) => p.value).filter(Boolean);
    if (rawPatterns.length === 0) continue;

    const normalized = rawPatterns.map(normalizePattern);
    const patterns = normalized.map((n) => n.pattern);
    const needU = patterns.some((p) => /\\u\{/.test(p));
    const needS = normalized.some((n) => n.needsS);
    const needM = normalized.some((n) => n.needsM);
    const needI = normalized.some((n) => n.needsI) || group.ignoreCaps !== false;
    const flags = 'g' + (needI ? 'i' : '') + (needS ? 's' : '') + (needM ? 'm' : '') + (needU ? 'u' : '');

    const groupChain = buildChain(group.actions?.[0]?.actions ?? [], group.name);
    for (const note of groupChain.notes) importNotes.push(`[${group.name}] ${note}`);

    // One rule per word group, holding the full list of patterns.
    const validPatterns: string[] = [];
    for (const p of patterns) {
      const compiled = compileRule(p, flags);
      if (!compiled.ok) {
        importNotes.push(`[${group.name}] skipped pattern that does not compile: ${p} (${compiled.error})`);
        continue;
      }
      validPatterns.push(p);
    }
    if (validPatterns.length === 0) continue;
    regexRules.push({
      name: group.name,
      patterns: validPatterns,
      flags,
      scope: 'message',
      enabled: true,
      immune_roles: group.roleIds ?? [],
      action_chain: groupChain.chain,
    });
  }
  cfg.regex_engine.enabled = true;
  cfg.regex_engine.rules = regexRules;

  // ---- reports ----
  cfg.reports.enabled = true;
  const reportChannel =
    automod.channelSpam?.actions?.[0]?.actions?.find((a: SapAction) => a.type === 'report')?.value as
      | { channelId?: string; pingRoleIds?: string[] }
      | undefined;
  if (reportChannel?.channelId) cfg.reports.channel_id = reportChannel.channelId;
  if (reportChannel?.pingRoleIds?.length) cfg.reports.action_roles = reportChannel.pingRoleIds;

  // ---- punishment DMs ----
  cfg.punishment_dms.enabled = moderation.notify?.userOnPunish ?? true;

  // ---- welcome / goodbye / booster ----
  const messages = (welcome.messages ?? []) as any[];
  const byEvent: Record<string, any> = {};
  for (const m of messages) {
    if (m.eventName) byEvent[m.eventName] = m;
  }
  const buildGreeting = (m: any): string | undefined => {
    if (!m) return undefined;
    const json = m.json ?? {};
    const parts: string[] = [];
    if (json.content) parts.push(replacePlaceholders(String(json.content)));
    const embeds = (json.embeds ?? []) as any[];
    for (const e of embeds) {
      if (e.title) parts.push(`**${replacePlaceholders(String(e.title))}**`);
      if (e.description) parts.push(replacePlaceholders(String(e.description)));
    }
    return parts.join('\n');
  };
  const joinMsg = byEvent['userJoin'];
  const leaveMsg = byEvent['userLeave'];
  const boostMsg = byEvent['userBoost'];
  cfg.welcome = {
    enabled: Boolean(joinMsg),
    channel_id: joinMsg?.channelId ?? undefined,
    message: buildGreeting(joinMsg) ?? 'Welcome {user} to {guild}!',
  };
  cfg.goodbye = {
    enabled: Boolean(leaveMsg),
    channel_id: leaveMsg?.channelId ?? undefined,
    message: buildGreeting(leaveMsg) ?? '{user} has left {guild}.',
  };
  cfg.booster = {
    enabled: Boolean(boostMsg),
    channel_id: boostMsg?.channelId ?? undefined,
    message: buildGreeting(boostMsg) ?? 'Thank you for boosting {guild}, {user}!',
  };

  // ---- role connections ----
  // Sapphire export shape: { connections: [{ id: mainRole, condType: 1|2,
  // conditions: [{ type: 1=has | 0=doesn't-have, value: roleId }] }] }.
  // condType is the per-connection logic: 2 = any (OR), 1 = all (AND).
  const connections = (roles.connections ?? []) as Array<{
    id: string;
    condType?: number;
    conditions: SapCondition[];
  }>;
  const rc: any[] = [];
  for (const conn of connections) {
    const conditions = (conn.conditions ?? [])
      .filter((c) => c.value)
      .map((c) => ({ has_role: c.type !== 0, role_id: c.value }));
    if (conditions.length === 0) continue;
    rc.push({
      enabled: true,
      main_role: conn.id,
      logic: conn.condType === 2 ? 'any' : 'all',
      held_for_seconds: 0,
      conditions,
    });
  }
  cfg.role_connections = { enabled: roles.enabled ?? true, sync_interval_minutes: 5, connections: rc };

  // ---- channel locking preset ----
  const lockCfg = moderation.channelLock;
  if (lockCfg) {
    cfg.channel_locking.presets = [
      {
        name: 'lockdown-all',
        channels: lockCfg.lockAllChannelIds ?? [],
        categories: [],
        all_channels: false,
        exclude_roles: lockCfg.whitelistedRoleIds ?? [],
        deny_permissions: ['SendMessages', 'AddReactions'],
        schedule: [],
      },
    ];
  }

  // ---- logging ----
  const enabledLogTypes = (logging.enabledLogTypes ?? {}) as Record<string, string>;
  const logMap: Record<string, unknown> = {};
  let unmapped = 0;
  for (const [sapEvent, channelId] of Object.entries(enabledLogTypes)) {
    const mapped = mapLogEvent(sapEvent);
    if (mapped && typeof channelId === 'string' && channelId) {
      if (logMap[mapped] && logMap[mapped] !== channelId) {
        // keep first routing, note collision
      }
      logMap[mapped] = { enabled: true, channel_id: channelId };
    } else {
      unmapped++;
    }
  }
  cfg.logging = logMap;

  // Generic moderation actions (temp-role, etc.) need a route too; default to the
  // kick/mod-actions channel if Sapphire didn't configure a dedicated one.
  if (!logMap['moderation_action']) {
    const kick = logMap['member_kick'] as { channel_id?: string } | undefined;
    const warn = logMap['member_warn'] as { channel_id?: string } | undefined;
    const modChannel = kick?.channel_id ?? warn?.channel_id ?? undefined;
    if (modChannel) logMap['moderation_action'] = { enabled: true, channel_id: modChannel };
  }
  cfg.logging = logMap;

  fs.writeFileSync(configPath, YAML.stringify(cfg, { indent: 2, lineWidth: 0 }), 'utf8');

  const result = configSchema.safeParse(cfg);
  const issues: string[] = [];
  if (!result.success) {
    for (const i of result.error.issues) {
      issues.push(`  ${i.path.join('.')}: ${i.message}`);
    }
  } else {
    for (const i of runCrossFieldChecks(result.data)) {
      issues.push(`  ${i.path}: ${i.expected} (found ${i.found})`);
    }
  }

  console.log(`Wrote ${configPath}`);
  console.log(`Imported: ${groups.length} word groups -> ${regexRules.length} regex rules, ${rc.length} role connections, ${Object.keys(logMap).length} log routes, ${Object.keys(cmdMap).length} command entries`);
  console.log(`Unmapped Sapphire log events: ${unmapped}`);
  if (importNotes.length > 0) {
    console.log('Import notes:');
    for (const n of importNotes) console.log(`  - ${n}`);
  }
  if (issues.length > 0) {
    console.log('VALIDATION ISSUES:');
    for (const i of issues) console.log(i);
    process.exit(1);
  }
  console.log('Config validated OK.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});