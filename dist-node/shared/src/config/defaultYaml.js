"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG_YAML = void 0;
exports.DEFAULT_CONFIG_YAML = `# =============================================================================
# f34rless-moderation — central bot configuration
# -----------------------------------------------------------------------------
# Everything behavior-related lives here. Secrets (token, DB password, session
# secret) belong in .env, NOT in this file.
#
# Fields marked (snowflake) are Discord IDs — 15-20 digit strings.
# Durations use flexible syntax: "10m", "2h30m", "14d", "1w", "perm".
# When a value is omitted, the schema default is used.
# =============================================================================

bot:
  # Multi-prefix array. Any of these can be used to invoke prefix commands.
  prefixes: ["!"]
  # Master toggles for command surfaces.
  prefix_enabled: true
  slash_enabled: true
  # Optional per-guild prefix overrides: guild ID -> list of prefixes.
  per_guild_prefixes: {}
  status: "online"          # online | idle | dnd | invisible
  activity:
    type: "Watching"        # Playing | Streaming | Listening | Watching | Competing
    text: "the server"
    # url: "https://twitch.tv/example"   # required when type is Streaming
  # Bot owners. These bypass every permission/cooldown check.
  owner_ids: ["000000000000000000"]

# -----------------------------------------------------------------------------
# Per-command configuration.
# Keyed by command name. Every command in the bot can be toggled here
# independently for slash vs prefix, with prefix-only aliases.
# Aliases are validated at boot for collisions across all commands.
# -----------------------------------------------------------------------------
commands:
  ban:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: ["BanMembers"]
    immune_roles: []
    aliases: ["b", "bann"]            # prefix-only aliases (slash has none)
  kick:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: ["KickMembers"]
    immune_roles: []
    aliases: ["k", "kik"]
  warn:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: ["ModerateMembers"]
    immune_roles: []
    aliases: ["w", "warning"]
  mute:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: ["ModerateMembers"]
    immune_roles: []
    aliases: ["m", "tempmute", "tmute"]
  timeout:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: ["ModerateMembers"]
    immune_roles: []
    aliases: ["to"]
  purge:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 5
    permissions: ["ManageMessages"]
    immune_roles: []
    aliases: ["clear", "prune"]
  help:
    enabled: true
    slash: true
    prefix: true
    cooldown_seconds: 2
    permissions: []
    immune_roles: []
    aliases: ["h", "commands"]
  # All other commands inherit command_defaults below unless listed here.

command_defaults:
  cooldown_seconds: 3

# -----------------------------------------------------------------------------
# Event logging. Each event can be routed to a channel or a thread and toggled
# independently. Event name -> config.
# Events: message_edit, message_delete, message_bulk_delete, member_join,
# member_leave, member_ban, member_unban, member_kick, member_timeout,
# role_add, role_remove, nickname_change, channel_create, channel_update,
# channel_delete, voice_state_update, invite_create, invite_delete,
# moderation_action, automod_trigger, command_usage, error_event,
# rate_limit_event, report_created, report_resolved, case_edit,
# appeal_created, appeal_resolved
# -----------------------------------------------------------------------------
logging:
  member_join: { enabled: true, channel_id: "000000000000000000" }
  member_leave: { enabled: true, channel_id: "000000000000000000" }
  member_ban: { enabled: true, channel_id: "000000000000000000" }
  message_delete: { enabled: true, channel_id: "000000000000000000" }
  message_edit: { enabled: true, channel_id: "000000000000000000" }
  moderation_action: { enabled: true, channel_id: "000000000000000000" }
  command_usage: { enabled: false, channel_id: "000000000000000000" }
  # ... add any of the other event names the same way.

# -----------------------------------------------------------------------------
# Warning escalation ladder.
# Warnings accrue per user; when a user's active warning count hits a rung,
# the configured action fires automatically. Counts must be ascending.
# -----------------------------------------------------------------------------
warnings:
  escalation_ladder:
    - count: 2
      action: "mute"
      duration: "14d"
    - count: 4
      action: "ban"
  decay:
    enabled: false
    after_days: 30

# -----------------------------------------------------------------------------
# User reports.
# -----------------------------------------------------------------------------
reports:
  enabled: true
  cooldown_seconds: 30
  channel_id: "000000000000000000"     # where report cards are posted
  action_roles: []                      # roles allowed to action/ignore reports
  archive:
    enabled: false
    channel_id: "000000000000000000"    # component-stripped archive
  merge_window_seconds: 300             # duplicate reports merged within this window
  false_report_warning_enabled: false   # staff-marked bad-faith reports feed warnings

# -----------------------------------------------------------------------------
# Automod.
# Each module has: enabled, threshold, immune_roles, channel_ignore_list,
# an ordered action_chain, an optional per-module log target, and response
# throttling. Modules fall back to automod.global_immune_roles and the global
# automod log channel/thread.
# -----------------------------------------------------------------------------
automod:
  enabled: true
  global_immune_roles: []
  log_channel_id: "000000000000000000"
  # log_thread_id: "000000000000000000"
  modules:
    spam:
      enabled: true
      threshold: 5                       # messages in window
      window_seconds: 5
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "batched_summary"   # silent | batched_summary
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: send_channel_message
          format: components_v2
          content: "{user}, stop spamming in {channel}."
          delete_after_seconds: 15
        - type: warn
          reason: "Automod: {rule}"
        - type: run_escalation_check
    cross_channel:
      enabled: true
      threshold: 5                       # channels messaged in window
      window_seconds: 10
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: cross-channel spam ({rule})"
        - type: run_escalation_check
    link_filter:
      enabled: true
      mode: "deny_all"                   # deny_all | allowlist | denylist
      allowlist: []                      # e.g. ["github.com", "youtube.com"]
      denylist: []                       # e.g. ["bit.ly", "tinyurl.com"]
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "batched_summary"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: send_channel_message
          format: components_v2
          content: "{user}, links are not allowed here."
          delete_after_seconds: 15
        - type: warn
          reason: "Automod: link filter ({rule})"
        - type: run_escalation_check
    image_spam:
      enabled: true
      threshold: 5
      window_seconds: 10
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: image spam ({rule})"
        - type: run_escalation_check
    executable_files:
      enabled: true
      blocked_extensions: [".exe", ".bat", ".cmd", ".sh", ".jar", ".msi", ".scr", ".ps1", ".vbs", ".com", ".dll"]
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: executable file ({rule})"
        - type: run_escalation_check
    mass_images:
      enabled: true
      threshold: 5
      window_seconds: 10
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 60
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: mass image dump ({rule})"
        - type: run_escalation_check
    invites:
      enabled: true
      guild_allowlist: []                # invite links to OTHER guilds that are OK
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "batched_summary"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: discord invite ({rule})"
        - type: run_escalation_check
    emoji_spam:
      enabled: true
      threshold: 10                      # emojis per message
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: emoji spam ({rule})"
        - type: run_escalation_check
    line_spam:
      enabled: true
      per_message_lines: 20
      multi_message_lines: 40
      multi_message_window_seconds: 10
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: line spam ({rule})"
        - type: run_escalation_check
    poll_spam:
      enabled: true
      threshold: 3                       # polls created in window
      window_seconds: 60
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 60
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: poll spam ({rule})"
        - type: run_escalation_check
  # Composite risk scoring: several signals feed a rolling per-user score.
  risk_scoring:
    enabled: false
    threshold: 50
    join_age_weight: 1
    automod_hit_weight: 2
    cross_channel_weight: 1
    decay_seconds: 3600
  # Behavioral heuristics (typing speed, bot-farm joins, account velocity).
  heuristics:
    typing_speed:
      enabled: false
      min_characters_per_second: 15
      window_seconds: 10
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: typing-speed anomaly ({rule})"
        - type: run_escalation_check
    mass_identical_joins:
      enabled: false
      threshold: 5
      window_seconds: 120
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: warn
          reason: "Automod: mass identical joins ({rule})"
        - type: run_escalation_check
    new_account_velocity:
      enabled: false
      max_account_age_days: 7
      threshold: 3
      window_seconds: 600
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 30
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: warn
          reason: "Automod: new account velocity ({rule})"
        - type: run_escalation_check

# -----------------------------------------------------------------------------
# Custom regex rules. Named, per-rule action chain, scope and immunity.
# Scopes: message | username | nickname
# -----------------------------------------------------------------------------
regex_engine:
  enabled: true
  rules:
    - name: "slurs"
      pattern: "\\b(slur1|slur2)\\b"
      flags: "gi"
      scope: "message"
      enabled: true
      immune_roles: []
      action_chain:
        - type: delete_message
        - type: warn
          reason: "Automod: {rule}"
        - type: run_escalation_check
    # - name: "ip-grabbers"
    #   pattern: "discord\\.gg\\/grabify"
    #   flags: "gi"
    #   scope: "message"
    #   enabled: true
    #   immune_roles: []
    #   action_chain:
    #     - type: delete_message
    #     - type: ban

# -----------------------------------------------------------------------------
# Punishment DMs. Global toggle + per-type toggle/template.
# Placeholders: {guild} {reason} {moderator} {duration} {case_id}
#               {appeal_instructions}
# order: "before" DM before the Discord action (required for bans to be safe),
#        "after" DM after the action.
# Formats: plain | embed | components_v2
# -----------------------------------------------------------------------------
punishment_dms:
  enabled: true
  hide_moderator: false
  order: "after"
  types:
    warn:
      enabled: true
      format: components_v2
      content: "You received a warning in {guild}.\\nReason: {reason}\\nCase ID: {case_id}"
    mute:
      enabled: true
      format: components_v2
      content: "You were muted in {guild} for {duration}.\\nReason: {reason}\\nCase ID: {case_id}"
    timeout:
      enabled: true
      format: components_v2
      content: "You were timed out in {guild} for {duration}.\\nReason: {reason}\\nCase ID: {case_id}"
    kick:
      enabled: true
      format: components_v2
      content: "You were kicked from {guild}.\\nReason: {reason}\\nCase ID: {case_id}"
    ban:
      enabled: true
      format: components_v2
      content: "You were banned from {guild}.\\nReason: {reason}\\nCase ID: {case_id}\\n{appeal_instructions}"
    unban:
      enabled: false
      format: components_v2
      content: "Your ban in {guild} was lifted."
    unmute:
      enabled: false
      format: components_v2
      content: "Your mute in {guild} was lifted."

# -----------------------------------------------------------------------------
# Punishment escalation. Triggers are automod rule hits.
#   rules: per-rule mappings (rule name = "*" for any rule)
#   global: applies regardless of which rule fired
# A user accumulating N triggers within a window gets the configured action.
# -----------------------------------------------------------------------------
escalation:
  enabled: true
  window_seconds: 3600
  rules:
    - rule: "*"
      count: 3
      within_seconds: 3600
      action: { type: "timeout", duration: "1h" }
  global:
    - count: 5
      within_seconds: 3600
      action: { type: "kick" }

# -----------------------------------------------------------------------------
# Join roles.
# -----------------------------------------------------------------------------
join_roles:
  roles: []                    # applied to humans
  bot_roles: []                # applied to bots

# Welcome / goodbye / booster messages (Components V2).
# Placeholders: {user} {guild} {member_count} {mention}
welcome:
  enabled: false
  channel_id: "000000000000000000"
  message: "Welcome {user} to {guild}! You are member #{member_count}."
goodbye:
  enabled: false
  channel_id: "000000000000000000"
  message: "{user} has left {guild}."
booster:
  enabled: false
  channel_id: "000000000000000000"
  message: "Thank you for boosting {guild}, {user}!"

# -----------------------------------------------------------------------------
# Role connections: if a member holds if_has_role (optionally held continuously
# for held_for_seconds), apply then_add / then_remove.
# -----------------------------------------------------------------------------
role_connections:
  - enabled: true
    if_has_role: "000000000000000000"
    held_for_seconds: 0
    then_add: ["000000000000000000"]
    then_remove: []
  # - enabled: true
  #   if_has_role: "000000000000000000"
  #   held_for_seconds: 604800            # auto-promote after 7 days in role
  #   then_add: ["000000000000000000"]

# -----------------------------------------------------------------------------
# Named channel-lock presets. Unlock restores a byte-for-byte permission
# snapshot taken at lock time (never recomputed).
# deny_permissions: Discord permission names, e.g. SendMessages, AddReactions.
# schedule: optional cron entries per preset.
# -----------------------------------------------------------------------------
channel_locking:
  presets:
    - name: "lockdown-all"
      channels: ["000000000000000000"]
      categories: []
      all_channels: false
      exclude_roles: []
      deny_permissions: ["SendMessages", "AddReactions"]
      schedule:
        - { cron: "0 22 * * *", action: "lock" }
        - { cron: "0 7 * * *", action: "unlock" }

# -----------------------------------------------------------------------------
# Anti-raid mode. join_rate_threshold joins within window_seconds triggers.
# action: lock_joins | timeout_joiners | verify_gate
# -----------------------------------------------------------------------------
anti_raid:
  enabled: false
  join_rate_threshold: 10
  window_seconds: 60
  action: "lock_joins"

sticky_messages:
  enabled: false
  re_post_after_messages: 5

slowmode_scheduler:
  enabled: false
  threshold_messages_per_minute: 30
  slowmode_seconds: 10
  revert_after_minutes: 15

sticky_roles:
  enabled: false

invite_tracking:
  enabled: false

tickets:
  enabled: false
  category_id: "000000000000000000"
  support_roles: []
  transcript_channel_id: "000000000000000000"

modmail:
  enabled: false
  category_id: "000000000000000000"
  support_roles: []
  transcript_channel_id: "000000000000000000"

verification_gate:
  enabled: false
  button_channel_id: "000000000000000000"
  verified_role_id: "000000000000000000"
  timeout_kick_seconds: 0                # 0 = disabled

quarantine:
  enabled: true
  restricted_role_id: "000000000000000000"

blacklist:
  enabled: true
  action: "flag"                         # ban | kick | flag
  silently_flag: false

alt_detection:
  enabled: false
  max_account_age_days: 7

# Trust-level progression: auto-grant roles after time + clean history.
trust_levels:
  enabled: false
  levels:
    - level: 1
      after_days: 7
      require_clean_history: true
      roles: ["000000000000000000"]

# Fuzzy "did you mean?" fallback for unknown prefix commands.
fuzzy:
  enabled: true
  max_distance: 2
  cooldown_seconds: 15

# Staff permission groups: role-based tiers for bot commands.
staff_permission_groups:
  groups:
    - name: "junior_mod"
      roles: []
      permissions: ["warn", "mute", "purge"]
    - name: "senior_mod"
      roles: []
      permissions: ["warn", "mute", "kick", "ban", "timeout", "purge", "case", "appeal", "massban", "lock", "unlock"]

# -----------------------------------------------------------------------------
# Community modules (all off by default — moderation-focused default).
# -----------------------------------------------------------------------------
community:
  starboard:
    enabled: false
    channel_id: "000000000000000000"
    threshold: 3
  suggestions:
    enabled: false
    channel_id: "000000000000000000"
  giveaways:
    enabled: false
  levels:
    enabled: false
    message_xp: 15
    xp_cooldown_seconds: 60
    level_up_roles: []
  status_rotation:
    enabled: false
    interval_seconds: 300
    statuses: []
  birthdays:
    enabled: false
    channel_id: "000000000000000000"
    timezone: "UTC"

# -----------------------------------------------------------------------------
# Web dashboard. owner_user_id may also come from .env (OWNER_USER_ID).
# -----------------------------------------------------------------------------
dashboard:
  enabled: true
  port: 4693
  owner_user_id: "000000000000000000"
  live_log_retention_hours: 24
  timestamp_defaults:
    timezone: "UTC"

# -----------------------------------------------------------------------------
# Error / rate-limit reporting. webhook_url is an optional external alert.
# verbosity: minimal | standard | verbose
# -----------------------------------------------------------------------------
error_reporting:
  enabled: true
  channel_id: "000000000000000000"
  verbosity: "standard"
  webhook_url: ""
rate_limit_reporting:
  enabled: true
  channel_id: "000000000000000000"
  webhook_url: ""

# -----------------------------------------------------------------------------
# Ops: backups, usage analytics, snipe retention.
# -----------------------------------------------------------------------------
ops:
  backups_enabled: true
  backup_retention_count: 7
  usage_analytics: true
  snipe_retention_seconds: 600
`;
//# sourceMappingURL=defaultYaml.js.map