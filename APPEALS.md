# Appeals System — Setup & Config Reference

The appeals system is a public, **per-guild** portal where members can appeal
punishments (ban / mute / warn / timeout / kick / softban / tempban). Appeals
attach to the **existing case system by case number** — no parallel case
system is created.

## Quick start (per guild)

1. Add an `appeals:` block to `config.yml` (global default) and/or a
   `guild_overrides` entry per guild.
2. Set `enabled: true`.
3. Wire `log_channel_id` — the text channel where appeal cards are posted.
4. Wire `ping_role_id` — a role that is pinged when a new appeal is filed.
5. Optionally set `thread_auto_create: true` to auto-open a thread per appeal.
6. Give staff a role from `staff_permission_groups` whose `permissions` list
   contains `appeal` (the existing `senior_mod` group already includes it).
7. Visit `https://<your-dashboard>/appeals/<guildId>` for the public page and
   `/appeals-admin` (inside the owner dashboard) for the admin console.

Migrations (`015_appeals`) run automatically on boot. No extra setup.

## Config keys (`appeals:`)

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | bool | `false` | Master toggle for the portal. |
| `ping_role_id` | snowflake | – | Role pinged in the Discord card on each new appeal. |
| `log_channel_id` | snowflake | – | Channel where appeal cards are posted. **Required when enabled.** |
| `logging_channel_id` | snowflake | – | Optional audit channel — appeal lifecycle events (submitted / accepted / denied / ignored) are posted here as Components V2 entries. |
| `thread_auto_create` | bool | `true` | Auto-open a thread on the card for staff/appellant chat. |
| `eligible_punishment_types` | string[] | `["ban","mute","warn","timeout"]` | Case types that may be appealed (validated against the punishment enum). |
| `cooldown_seconds` | int | `300` | Minimum time between appeal submissions per user. |
| `max_open_appeals_per_user` | int | `3` | Max concurrent pending appeals per user. |
| `blocking.enabled` | bool | `true` | Allow staff to block users from appealing. |
| `blocking.default_reason` | string | `"Appeals are disabled for this user."` | Reason used when staff block without a custom reason. |
| `form` | array | `[]` | Dynamic questions rendered on the site (see below). |
| `guild_overrides` | map | `{}` | Per-guild overrides keyed by guild snowflake. |

### Form question definitions (`form[]`)

Each question:

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | Slug, `[a-z0-9_-]`, unique. |
| `label` | string | Shown to the user. |
| `type` | enum | `short_text` \| `long_text` \| `checkbox`. |
| `required` | bool | Default `false`. |
| `min_length` / `max_length` | int | Text types only. |
| `help_text` | string | Optional hint under the label. |

### Per-guild overrides (`guild_overrides`)

Anything a guild's override omits falls back to the global `appeals:` block.
The override accepts any of the keys above (all optional):

```yaml
appeals:
  enabled: true
  log_channel_id: "1111111111111111111"
  ping_role_id: "2222222222222222222"
  form: [ ... ]                 # replaces the global form entirely for this guild
  guild_overrides:
    "3333333333333333333":
      log_channel_id: "4444444444444444444"   # this guild posts elsewhere
      eligible_punishment_types: [ban]        # this guild only appeals bans
```

## How it works

- **Public page** `/appeals/:guildId` — Discord OAuth login, member-only,
  step flow: Select Case → Fill Form → Submitted → Under Review → Decided,
  with a live chat synced to the Discord thread over WebSocket.
- **API** `/api/appeals/:guildId/...` — guild-scoped, CSRF + rate limited,
  every route re-verifies membership/staff server-side.
- **Discord** — a Components V2 card is posted to `log_channel_id` with
  Accept / Deny / Ignore buttons; staff can reply via the thread, the
  `/appeal-reply` command, or `/block-appeal-user` / `/unblock-appeal-user`.
- **Admin console** `/appeals-admin` — list/filter/decide appeals, chat,
  block/unblock users.
