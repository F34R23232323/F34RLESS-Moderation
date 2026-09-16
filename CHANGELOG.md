# Changelog — f34rless-moderation

All notable changes made in this session.

---

### Security: Role-Based Moderation Permissions (Replaces Discord Native Permissions)
- **All moderation commands now use role-based permissions instead of Discord native permissions.** Commands like `ban`, `kick`, `warn`, `mute`, `timeout`, `purge`, and others no longer rely on Discord permission flags (e.g. `BanMembers`, `KickMembers`, `ModerateMembers`). Access is now controlled entirely through role IDs defined in `config.yml`, giving full control over who can run what without depending on Discord's permission system.
- Added `staff_permission_groups` in `config.yml` with 5 tiers matching the server's role hierarchy:
  - `trial_mod` — Trial Moderator and above (warn, mute, timeout, caseclose, lock/unlock, etc.)
  - `moderator` — Moderator and above (kick, purge, softban, nick, temprole, etc.)
  - `senior_mod` — Senior Moderator and above (ban, unban, mass actions, nameban, prune, etc.)
  - `head_mod` — Head Moderator and above (lockall, unlockall, quarantine, archive, etc.)
  - `admin` — Administrator and above (emergency, role management, appeal blocking, etc.)
- Each moderation command in `config.yml` now has a `permission_group` field linking it to the appropriate tier, and `permissions: []` to clear Discord native permission checks.
- Updated `ModerationCommandGuard.hasRequiredPermissions()` to respect `permissions` from `config.yml` as an override. When a command's config sets `permissions: []`, Discord native permission checks are skipped and only role-based checks apply.

---

### Message Bulk Delete Archive Link
- `messageBulkDelete` log now includes a clickable archive link (via `app.archives.archiveBatch`) alongside the existing transcript file attachment, so staff can review deleted messages in the dashboard without downloading a file.

### "Purge Until Here" Context Menu Command (New)
- New `/purge-until` slash command and message context menu entry (Apps → Bot → Purge until here).
- Right-click a message → select the command → confirmation embed appears with the count of messages to delete and a Confirm/Cancel button.
- On Confirm: fetches and bulk-deletes all messages newer than the selected target, plus the target itself.
- On prefix use: `!purgeuntil <message_id>` with reaction-based confirmation.

### Moderation Action Confirmation (New)
- All slash commands (ban, kick, warn, mute, timeout, softban, purge) now show a CV2 confirmation embed with Confirm/Cancel buttons before executing.
- Confirmation shows target, action, reason, and duration (if applicable).
- Ephemeral for slash commands; reaction-based (✅/❌) for prefix commands with 30s timeout.
- Shared `modconfirm:` component handler executes the action on Confirm and dismisses on Cancel.
- Pending actions expire after 60 seconds with automatic cleanup.

---

## Features

### Self-hosted NSFW Image Moderation (New)
- Added NSFWJS MobileNetV2-based image scanning powered by TensorFlow.js and sharp.
- Loads the model once at startup, reused across all messages.
- Scans image attachments (PNG, JPEG, GIF, WebP) in new Discord messages, ignoring bots, webhooks, DMs, and unsupported types.
- Only downloads from trusted Discord CDN domains (`cdn.discordapp.com`, `media.discordapp.net`).
- Downloads capped at 10 MB, 15-second timeout, extreme dimensions and decompression-bomb images rejected.
- Normalizes images with sharp to 224×224 before inference, corrects EXIF orientation, safely removes alpha.
- Bounded in-memory FIFO queue (25 jobs, concurrency 1), deduplicates jobs per message/attachment.
- Explicit score = Porn + Hentai; all NSFWJS categories retained in reports.
- Three outcomes: below review threshold → no action; review threshold → report; delete threshold → delete + report.
- Log-only mode: never deletes, reports marked `[TEST MODE — LOG ONLY]`.
- Reports use the existing `app.reporting.createReport()` — same destination, permissions, embeds, storage, and config.
- `ignored_categories` config field: NSFWJS class names to exclude from explicit score calculation.
- Automod ignore inheritance: `channel_ignore_list`, `immune_roles`, and `global_immune_roles` from automod modules are also respected by NSFW scanning.
- Graceful shutdown: queued work stops, model disposed.
- Model load failure disables the feature and logs the error instead of crashing.
- New dependencies: `nsfwjs`, `@tensorflow/tfjs-node@4.20.0`, `sharp`.
- 28 unit tests covering all outcomes, edge cases, and resource disposal.

### Anti Mass-Ping Automod Module (New)
- Detects two patterns: too many mentions in a single message (configurable threshold), and spam-pinging the same user across multiple messages within a window.
- Reports to the existing automod report system, purges offending messages.
- Deduplicates repeat triggers via `suppress_actions` and the new `recentActions` deduplication.
- Config section: `max_mentions`, `spam_threshold`, `spam_window_seconds`, plus standard automod fields.
- Mass-pinged users receive a CV2 Components v2 DM explaining what happened and who pinged them, with a 2-minute cooldown per target user to prevent DM spam.

### Automod DM-First Messages
- Added `dm_first` flag to the `send_channel_message` action chain step.
- When `dm_first: true`, the triggered user is DM'd first; if DMs are closed, the message is posted publicly with a "DMs closed" note.
- Updated spam, duplicate_spam, and mass_ping module configs to use `dm_first: true` with DM-appropriate wording.

### Automod Action Deduplication
- Added `recentActions` map tracking per-user-per-rule last action timestamp.
- Before executing the action chain (warn/DM/etc.), checks if the same user+rule was already actioned within `suppress_repeat_response_seconds`. If so, the chain is skipped.
- Prevents duplicate warns/DMs when the same rule fires on multiple messages in quick succession.

### Automod Bulk-Delete Batching
- Moved `purgeMessages` out of per-module `handleHit` — all purge IDs collected across modules and deleted in one `bulkDelete` call per channel after all modules finish.
- Removed the individual-delete fallback that caused cascading rate limits; on failure, logs and moves on.

### Log Batching
- Added per-channel queue in `LogManager` with 500ms flush timer.
- Single log events sent immediately; multiple events in a window combined into one CV2 container message.
- Automod logs also route through the same batching queue.
- Eliminates the rapid-fire `channel.send()` calls that hit Discord's per-channel rate limits.

### Role Permission Update Logging
- `roleUpdate` handler now detects permission changes (not just name/color/hoist/mentionable).
- Shows `Permissions added: ...` and `Permissions removed: ...` in the log.
- Added `role_update`, `role_create`, `role_delete` to `LOG_EVENT_NAMES` — these were configured in `config.yml` but silently dropped because the log manager didn't recognize them.
- Added display names and accent colours for the new events.

### Report Card Editing for Merged Reports
- When a duplicate report is merged (same target user/message within the merge window), the existing report card message is edited in place instead of posting a new embed.
- Reason text is merged (deduplicated).
- If the original card was deleted, falls back to posting a new one.

### Mass-Pinged Victim DM
- Mass-pinged users receive a CV2 Components v2 DM (red-accented container) explaining the situation and who pinged them.
- Only sent when the full action chain executes (suppressed when `suppress_actions` or `recentActions` dedup triggers).
- `recentPingedDms` cooldown map prevents the same user from being DM'd about pings more than once every 2 minutes.

### Reply-to-Message Moderation
- `!ban`, `!warn`, `!kick`, `!mute`, `!timeout`, `!softban` prefix commands now work while replying to a message: the replied message's author becomes the target, and the message content + link is stored as case evidence.
- Shared `resolveReplyContext()` helper in `bot/src/utils/evidence.ts`.

### Moderation Evidence in Log Embeds
- Punishment logs (warn, mute, kick, ban, softban) now include evidence lines (message content, jump link, attachments) — same style as automod trigger logs.

### `NsfwModerationService` Config and Integration
- New config section `nsfw_moderation` in `configSchema` and `defaultYaml` with: `enabled`, `guilds`, `ignored_channels`, `exempt_roles`, `max_attachment_bytes`, `download_timeout_ms`, `queue_capacity`, `worker_concurrency`, `review_threshold`, `delete_threshold`, `ignored_categories`, `log_only`.
- Service constructed in `index.ts`, initialized before login, SIGINT/SIGTERM shutdown handlers added.
- `messageCreate.ts` hooks in non-blocking call to `app.nsfw.handleMessage()`.
- `App` interface extended with `nsfw: NsfwModerationService`.

---

## Bug Fixes

### Dashboard Login Timeout
- `readSession()` in `auth.ts` — session DB query now has a 5-second timeout. Slow/queued MySQL no longer hangs the entire dashboard.
- OAuth callback handlers (`/callback`, `/appeals-callback`) now have a hard 30s deadline (20s `withTimeout` + 10s safety net) that force-closes the response if nothing else has responded.
- Fixed TypeScript cast error (`as unknown as`) on the race result in `readSession`.

### NsfwModelProcessor Constructor Crash
- Moved `NsfwImageProcessor` creation from the `NsfwModerationService` constructor to `init()`, so the bot boots cleanly even when `@tensorflow/tfjs-node` or `sharp` native modules are missing.
- Processor creation is now inside the `try` block in `init()` — model/module load failures disable the feature instead of crashing.

### Role Permission Updates Not Logged
- `roleUpdate` handler previously only detected name/color/hoist/mentionable changes and returned early on permission-only changes — those were silently dropped. Now permission diffs are included.

### Role Update/Create/Delete Events Not Routed to Discord
- Added `role_update`, `role_create`, `role_delete` to `LOG_EVENT_NAMES` — the log manager now recognizes these events (they were configured in `config.yml` but silently dropped).

### Channel Update Actor Not Resolved
- `resolveAuditActor` now retries (2 attempts) so the audit entry (which arrives after the gateway event) has time to appear in the buffer.

### Automod Repeated Actions
- Same user + same rule could trigger warn/DM actions on every message. Added `recentActions` per-user-per-rule deduplication before the action chain executes.

### Automod Bulk-Delete Rate Limits
- Multiple modules calling `bulkDelete` in quick succession hit Discord's 1-per-10s limit. Now all purge IDs are collected across modules and deleted in one call per channel.
- Removed the individual-delete fallback that caused cascading rate-limit hits; on failure, logs and moves on.

### Log Manager Rate Limits
- Individual `channel.send()` calls for rapid-fire log events hit rate limits. Now logs are batched per channel (500ms window) and combined into a single message when multiple events arrive together.

### Mass Ping Module Config Validation Error
- `mass_ping` module schema lacked `.default()`, so configs without it failed validation. Added `.default({ enabled: false, ... })` matching the pattern used by `typing_speed`, `mass_identical_joins`, and `new_account_velocity`.

### Dashboard Dockerfile Issues
- Switched from `node:22-alpine` to `node:22-bookworm-slim` (glibc required by `@tensorflow/tfjs-node`).
- Replaced `pip3 install yt-dlp` with `curl` to download the standalone binary (pip3 not available on bookworm-slim).
- Added `ca-certificates` to apt install (required for HTTPS via curl).
- Changed tfjs-node build to `npm rebuild` (graceful fallback if binary unavailable; bot still boots with NSFW disabled).

---

## Removed / Changed

### TF.js-node Version Pinned
- Pinned `@tensorflow/tfjs-node` to exact version `4.20.0` — last version with working prebuilt binaries (4.21.0+ have broken/missing prebuilts).

### Dockerfile Base Image
- Changed from `node:22-alpine` to `node:22-bookworm-slim` for glibc compatibility with `@tensorflow/tfjs-node`.

### yt-dlp Installation Method
- Switched from `pip3 install yt-dlp` to `curl`-based standalone binary download in the Dockerfile (no Python pip dependency required).

### Automod `send_channel_message` Behavior
- Spam, duplicate_spam, and mass_ping module configs now use `dm_first: true` — messages are DM'd to the user first, falling back to public posting only when DMs are disabled. This changes the user-facing behaviour of automod responses for these modules.
