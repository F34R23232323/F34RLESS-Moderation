export const DEFAULT_CONFIG_YAML = `# =============================================================================
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

# -----------------------------------------------------------------------------
# Custom commands. Config-based commands (also registered as slash commands).
# Each key is the command name. Supports multi-step actions, embeds, buttons,
# select menus, role/ban/kick actions, conditionals and more. See
# shared/src/types/customCommands.ts for the full action reference.
# -----------------------------------------------------------------------------
custom_commands:
  # example:
  #   enabled: true
  #   slash: true
  #   prefix: true
  #   cooldown_seconds: 3
  #   ephemeral: false
  #   aliases: ["ex"]
  #   actions:
  #     - type: send_message
  #       content: "Hello {user}!"
  #       embeds:
  #         - title: "Example"
  #           description: "This is an example custom command."
  #           color: "#5865f2"
  #       components:
  #         - components:
  #             - type: button
  #               id: "b1"
  #               label: "Click me"
  #               style: primary

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
# appeal_created, appeal_resolved, integration_create, integration_update,
# integration_delete, webhook_create, webhook_update, webhook_delete
# -----------------------------------------------------------------------------
# Global logging exclusions. Entries here suppress events across EVERY log type:
#   channels:   events that happen in this channel are not logged
#   categories: events in any channel under this category are not logged
#   users:      events where this user is the actor or the target are not logged
#   roles:      events where the actor or the target holds this role are not logged
# Per-event exclusions go inside each logging.<event>.ignore block (same four
# lists) and apply to that event only. Global + per-event are both applied.
# -----------------------------------------------------------------------------
logging_ignore:
  channels: []
  categories: []
  users: []
  roles: []

logging:
  member_join: { enabled: true, channel_id: "000000000000000000" }
  member_leave: { enabled: true, channel_id: "000000000000000000" }
  member_ban: { enabled: true, channel_id: "000000000000000000" }
  message_delete: { enabled: true, channel_id: "000000000000000000" }
  message_edit: { enabled: true, channel_id: "000000000000000000" }
  moderation_action: { enabled: true, channel_id: "000000000000000000" }
  command_usage: { enabled: false, channel_id: "000000000000000000" }
  # Applications (OAuth2 apps / bots) added to or removed from the server.
  # Requires the bot to have the VIEW_AUDIT_LOG permission.
  integration_create: { enabled: true, channel_id: "000000000000000000" }
  integration_update: { enabled: true, channel_id: "000000000000000000" }
  integration_delete: { enabled: true, channel_id: "000000000000000000" }
  webhook_create: { enabled: true, channel_id: "000000000000000000" }
  webhook_update: { enabled: true, channel_id: "000000000000000000" }
  webhook_delete: { enabled: true, channel_id: "000000000000000000" }
  # Per-event example — don't log kicks in the staff lounge category:
  # member_kick:
  #   enabled: true
  #   channel_id: "000000000000000000"
  #   ignore:
  #     channels: []
  #     categories: ["000000000000000000"]
  #     users: []
  #     roles: []
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
  ping_role_id: "000000000000000000"  # optional role pinged when a report is filed
  archive:
    enabled: false
    channel_id: "000000000000000000"    # component-stripped archive
  merge_window_seconds: 300             # duplicate reports merged within this window
  false_report_warning_enabled: false   # staff-marked bad-faith reports feed warnings

# -----------------------------------------------------------------------------
# Appeals portal.
# A public, per-guild page where members can appeal punishments (ban/mute/warn/
# timeout/etc.). Cases are appealed by case number and attach to the existing
# case system. The global block below applies to every guild; per-guild
# overrides live under guild_overrides (keyed by guild snowflake) and fall
# back to these values for any key they omit.
#
#   appeals:
#     enabled: true
#     ping_role_id: "000000000000000000"  # role pinged when an appeal is filed
#     log_channel_id: "000000000000000000" # where the appeal card is posted
#     thread_auto_create: true             # auto-open a thread on the card
#     logging_channel_id: "000000000000000000" # audit log for submitted/accepted/denied/ignored
#     eligible_punishment_types: [ban, mute, warn, timeout, kick]
#     cooldown_seconds: 300                # min time between appeals per user
#     max_open_appeals_per_user: 3
#     blocking:
#       enabled: true
#       default_reason: "Appeals are disabled for this user."
#     form:                                # dynamic questions rendered on the site
#       - id: why_unfair                   # slug (a-z0-9_-)
#         label: "Why is this unfair?"
#         type: long_text                  # short_text | long_text | checkbox
#         required: true
#         min_length: 30
#         max_length: 2000
#         help_text: "Optional hint text shown under the question"
#     guild_overrides: {}                  # optional per-guild overrides
# -----------------------------------------------------------------------------
appeals:
  enabled: false
  # ping_role_id: "000000000000000000"
  # log_channel_id: "000000000000000000"
  thread_auto_create: true
  # logging_channel_id: "000000000000000000"   # audit log for appeal events
  eligible_punishment_types:
    - ban
    - mute
    - warn
    - timeout
    - kick
  cooldown_seconds: 300
  max_open_appeals_per_user: 3
  blocking:
    enabled: true
    default_reason: "Appeals are disabled for this user."
  form:
    - id: why_unfair
      label: "Why do you believe this punishment is unfair?"
      type: long_text
      required: true
      min_length: 30
      max_length: 2000
      help_text: "Give as much detail as you can."
  guild_overrides: {}

# -----------------------------------------------------------------------------
# Automod.
# Each module has: enabled, threshold, immune_roles, channel_ignore_list,
# an ordered action_chain, an optional per-module log target, and response
# throttling. Modules fall back to automod.global_immune_roles and the global
# automod log channel/thread.
#
# Every action_chain can post a DIFFERENT channel response message per rule.
# Use inline content (below) or reference a saved Message Builder template
# from the dashboard instead:
#   - type: send_channel_message
#     template_id: 12                 # saved message by ID
#     # template_name: "Spam notice"  # ...or by name
#     delete_after_seconds: 60
# Templates are loaded at trigger time; {user}, {rule}, {channel}, {reason},
# {message_content} etc. placeholders are rendered inside them automatically.
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
        - type: create_report
          reason: "Automod: {rule}"
        - type: delete_message
        - type: send_channel_message
          format: components_v2
          content: "Your message was removed in {channel}."
          title: "Message Removed"
          description: "Hey {user} - one of your messages was just removed because it didn't follow this server's rules.\\n\\nThat's all that happened - your account is fine and no punishment was applied. Please take a moment to review the rules before your next message.\\n\\nIf you think this was a mistake, just message any staff member and we'll happily take another look."
          footer: "Thanks for helping keep {guild} friendly and safe."
          accent_color: "#ED4245"
          delete_after_seconds: 60
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
        - type: delete_message
        - type: warn
          reason: "Automod: poll spam ({rule})"
        - type: run_escalation_check
    duplicate_spam:
      enabled: true
      threshold: 3                       # near-identical messages in window
      window_seconds: 60
      similarity_threshold: 0.75         # 0..1 similarity required to match
      immune_roles: []
      channel_ignore_list: []
      suppress_repeat_response_seconds: 60
      suppressed_response_mode: "silent"
      shadow_mode: false
      action_chain:
        - type: create_report
          reason: "Automod: {rule}"
        - type: delete_message
        - type: send_channel_message
          format: components_v2
          content: "Your message was removed in {channel}."
          title: "Repeated Message Detected"
          description: "Hey {user}, your messages were removed.\\n\\nYour messages were removed because you sent the same or a very similar message multiple times."
          delete_after_seconds: 60
        - type: warn
          reason: "Automod: repeated message spam ({rule})"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
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
        - type: create_report
          reason: "Automod: {rule}"
        - type: warn
          reason: "Automod: new account velocity ({rule})"
        - type: run_escalation_check

# -----------------------------------------------------------------------------
# Custom regex rules. Named, per-rule action chain, scope and immunity.
# Scopes: message | username | nickname
# Each rule posts its OWN response message - either inline content or a saved
# Message Builder template (template_id / template_name) per rule.
# -----------------------------------------------------------------------------
regex_engine:
  enabled: true
  rules:
    - name: "slurs"
      patterns:
        - "\\b(slur1|slur2)\\b"
        - "\\b(slur3|slur4)\\b"
      flags: "gi"
      scope: "message"
      enabled: true
      immune_roles: []
      action_chain:
        - type: create_report
          reason: "Automod: {rule}"
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
# Discord NATIVE AutoMod responses.
# When Discord's own AutoMod (keyword filter, spam protection, etc.) executes an
# action, the bot can post a configured response. Responses are keyed by the
# AutoMod rule ID (snowflake) and the action it fired on.
#
#   on: block_message            # block_message | send_alert_message | timeout
#                                # block_member_interaction | any (or a list)
#
# Formats (choose the embed builder):
#   plain          — raw text message
#   embed          — classic embed builder (CV1: title/description/color/author/
#                    fields/footer/image/thumbnail)
#   components_v2  — Components v2 container builder (CV2: header/text/footer/
#                    accent color/media)
#
# Placeholders usable in content/title/description/fields/footer:
#   \${originmessagecontent}  the blocked message content
#   \${matchedcontent}        the matched keyword / content that triggered
#   \${matchedkeyword}        the matched keyword (when available)
#   {user} {user_mention} {userping} {user_tag} {user_id}
#   {channel} {channel_name} {channel_id}
#   {guild} {rule_name} {rule_id} {rule_trigger} {action} {nowtimestamp}
#
# IMPORTANT: mentions are disabled on ALL of these responses (hardcoded) — the
# bot will never ping the user, roles, channels, or @everyone here.
# -----------------------------------------------------------------------------
native_automod:
  enabled: true
  responses:
    # - rule_id: "000000000000000000"        # the Discord AutoMod rule ID
    #   on: block_message
    #   format: components_v2                # plain | embed | components_v2
    #   content: "Your message was removed in {channel}."
    #   title: "Message Blocked"
    #   description: "Hey {user}, your message was blocked by AutoMod.\\n\\nBlocked content:\\n> \${originmessagecontent}"
    #   footer: "If you think this was a mistake, contact a staff member."
    #   accent_color: "#ED4245"
    #   delete_after_seconds: 60
    # - rule_id: "000000000000000000"        # classic embed (CV1) example
    #   on: [block_message, send_alert_message]
    #   format: embed
    #   title: "Message Flagged"
    #   description: "Hey {user_mention}, your message was flagged."
    #   accent_color: "#F0B232"
    #   fields:
    #     - name: "Blocked content"
    #       value: "> \${originmessagecontent}"
    #       inline: false
    #     - name: "Rule"
    #       value: "\${rule_name}"
    #       inline: true
    #   footer: "Rule ID: \${rule_id}"

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
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nYou've received a warning on your account.\\n\\nReason: {reason}\\nIssued by: {moderator}\\nCase ID: {case_id}\\n\\nA warning is a heads-up - no mute or ban was applied. Repeated warnings can lead to stronger action, so please take a moment to read the server rules.\\n\\nIf you believe this warning was a mistake, {appeal_instructions}."
    mute:
      enabled: true
      format: components_v2
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nYou've been muted and can no longer send messages.\\n\\nDuration: {duration}\\nReason: {reason}\\nIssued by: {moderator}\\nCase ID: {case_id}\\n\\nOnce the time is up you'll be able to chat again. Please use the time to review the server rules.\\n\\nIf you believe this mute was a mistake, {appeal_instructions}."
    timeout:
      enabled: true
      format: components_v2
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nYou've been timed out and can no longer send messages for a while.\\n\\nDuration: {duration}\\nReason: {reason}\\nIssued by: {moderator}\\nCase ID: {case_id}\\n\\nOnce the time is up you'll be able to chat again. Please use the time to review the server rules.\\n\\nIf you believe this was a mistake, {appeal_instructions}."
    kick:
      enabled: true
      format: components_v2
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nYou've been kicked from the server.\\n\\nReason: {reason}\\nIssued by: {moderator}\\nCase ID: {case_id}\\n\\nA kick isn't a permanent ban - you're welcome to rejoin later. Please make sure to follow the rules when you return.\\n\\nIf you believe this kick was a mistake, {appeal_instructions}."
    ban:
      enabled: true
      format: components_v2
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nYou've been banned from the server.\\n\\nReason: {reason}\\nIssued by: {moderator}\\nCase ID: {case_id}\\nDuration: {duration}\\n\\nA ban removes your access to the server. If you believe this was a mistake, {appeal_instructions}."
    unban:
      enabled: false
      format: components_v2
      content: "Hi {user}, good news from the {guild} moderation team.\\n\\nYour ban has been lifted and you're welcome to rejoin the server.\\n\\nPlease make sure to follow the server rules this time. If you have any questions, reach out to a staff member."
    unmute:
      enabled: false
      format: components_v2
      content: "Hi {user}, good news from the {guild} moderation team.\\n\\nYour mute has been lifted and you can send messages again.\\n\\nPlease remember to follow the server rules going forward."
    case_closed:
      enabled: true
      format: components_v2
      content: "Hi {user}, this is a message from the {guild} moderation team.\\n\\nA punishment on your account was removed (case {case_id}) by {moderator}.\\n\\nReason: {reason}\\n\\nIf you have any questions, {appeal_instructions}."

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
# Role connections: auto-manage roles from conditions, like Sapphire.
# Each connection has a main_role that is ASSIGNED when the conditions are met
# and REMOVED when they stop being met.
#   logic: "all" = every condition must hold (AND), "any" = one is enough (OR).
#   conditions[].has_role: true = member must have the role, false = must NOT
#                          have the role.
#   held_for_seconds: optional — conditions must be met continuously for this
#                     long before the main role is applied.
# The bot re-syncs on role add/remove/update events and every
# sync_interval_minutes minutes.
# -----------------------------------------------------------------------------
role_connections:
  enabled: true
  sync_interval_minutes: 5
  connections:
    - name: "Example connection"
      enabled: true
      main_role: "000000000000000001"
      logic: all
      held_for_seconds: 0
      conditions:
        - { has_role: true, role_id: "000000000000000002" }
        - { has_role: false, role_id: "000000000000000003" }
    # - name: "Either role grants a perk"
    #   enabled: true
    #   main_role: "000000000000000004"
    #   logic: any
    #   conditions:
    #     - { has_role: true, role_id: "000000000000000005" }
    #     - { has_role: true, role_id: "000000000000000006" }

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
# Message archives. !archive <amount> [user] [channel] stores messages (with
# attachments, GIFs, avatars and embeds) in the database and produces a
# shareable dashboard link. Case creation (warn/mute/kick/ban/softban) and
# automod triggers can also auto-archive evidence.
# -----------------------------------------------------------------------------
archives:
  enabled: true
  default_amount: 50            # messages archived when no amount is given
  max_amount: 2000              # hard cap per !archive invocation
  case_evidence_amount: 40      # recent messages archived for each case
  automod_context_amount: 15    # context window archived around an automod hit
  max_attachment_bytes: 10485760   # per attachment download cap (10 MB)
  max_archive_bytes: 209715200     # total media cap per archive (200 MB)
  allowed_roles: []             # roles allowed to use !archives (staff list)
  allowed_users: []             # user IDs allowed to use !archives
  snapshot_messages: true       # save messages (bulk-batched) for deleted/edited evidence
  message_retention_days: 90    # auto-purge saved messages after this many days
  archive_on_delete: true       # accumulate deleted messages into auto-archives
  archive_on_edit: true         # accumulate edited messages (before & after) into auto-archives
  archive_interval_hours: 2     # build one big auto-archive every N hours (deleted + edited)
  archive_threshold_deleted: 100  # also flush early when this many deleted messages accumulate
  archive_threshold_edited: 50    # also flush early when this many edited messages accumulate

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
# Error / rate-limit reporting. If both channel_id and webhook_url are set,
# the channel is used and the webhook is skipped (webhook is only a fallback).
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