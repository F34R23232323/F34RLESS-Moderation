# f34rless-moderation

A production-grade Discord moderation bot with a React web dashboard, backed by MySQL in Docker.

- **Bot**: Node.js 22+, discord.js v14 (Components V2), TypeScript
- **Dashboard**: Express REST + WebSocket live-log stream, Vite + React (JSX, lucide-react icons, zero emoji)
- **Database**: MySQL 8 via `mysql2` with a self-contained migration runner
- **Containerization**: Docker Compose (mysql + bot + dashboard) with auto-wired DB credentials

---

## Quick start

1. Install dependencies (single package, no workspaces):

   ```
   npm install
   ```

2. Create your config and secrets:

   ```
   npm run gen-config          # writes a fully-commented config.yml
   copy .env.example .env      # then fill in DISCORD_TOKEN, CLIENT_ID, CLIENT_SECRET, OWNER_USER_ID, DASHBOARD_SESSION_SECRET
   ```

3. Run with Docker (recommended):

   ```
   docker compose -f docker/docker-compose.yml up --build
   ```

   The bot and dashboard automatically build their MySQL connection string from the
   `MYSQL_*` environment variables in Compose — **no manual database setup**. The
   database schema is created by migrations that run automatically on first boot.

4. Or run locally:

   ```
   npm run dev:bot            # terminal 1
   npm run dev:dashboard      # terminal 2 (API + WS on :4693)
   npm run dev:web            # terminal 3 (Vite on :5173, proxies /api and /ws)
   ```

   Point MySQL at your own server via the `MYSQL_*` env vars or a full `DATABASE_URL`.

5. Visit the dashboard: `http://localhost:4693` (or the Vite dev URL on :5173). Sign in
   with Discord — access is gated to the `OWNER_USER_ID` / `config.yml -> dashboard.owner_user_id`.

> Slash commands register on boot. For instant per-guild registration set
> `REGISTER_GUILD_ID` in `.env`; otherwise they register globally.

---

## How the auto DB wiring works

Both the bot and the dashboard call `buildDatabaseUrl()` from `shared/src/config/load.ts`:

1. If `DATABASE_URL` is set, it is used verbatim.
2. Otherwise the DSN is composed from `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
   `MYSQL_PASSWORD`, and `MYSQL_DATABASE` (all injected by `docker-compose.yml`).
3. Both services wait for MySQL to become healthy (`waitForDb`), then run the
   migrations in `shared/src/db/migrations` inside transactions, tracked in the
   `_migrations` table.

There is no separate "run migrations" step — first boot does everything.

---

## Configuration reference

Everything behavior-related lives in `config.yml` (regenerate with `npm run gen-config`).
Every key is documented inline. The schema is enforced at boot by `zod`; invalid or
missing fields are printed as a list of `path / expected / found` and the process exits
non-zero rather than booting half-configured.

Sections (see the file for full detail):

| Section | Purpose |
|---|---|
| `bot` | prefixes, prefix/slash master toggles, per-guild prefixes, activity, owner IDs |
| `commands` | per-command enabled/slash/prefix/cooldown/permissions/immune-roles/aliases |
| `command_defaults` | default cooldown for commands not listed |
| `logging` | event -> channel/thread routing (message edits, bans, role changes, voice, invites, moderation, automod, command usage, errors, rate limits, reports, appeals) |
| `logging_ignore` | global log exclusions by channel / category / user / role (+ per-event `ignore` blocks inside `logging`) |
| `warnings` | escalation ladder (e.g. 2 -> mute 14d, 4 -> ban) + warning decay |
| `reports` | reporting cooldown, channel, action roles, archive, duplicate merging, false-report deterrent |
| `automod` | 10 content modules (spam, cross-channel, links, images, executables, mass images, invites via API resolution, emoji, lines, polls) with per-module thresholds, action chains, throttling, shadow mode |
| `automod.risk_scoring` | composite rolling risk score |
| `automod.heuristics` | typing-speed anomaly, mass identical joins, new-account velocity |
| `regex_engine` | named custom rules with per-rule chain/scope/immunity |
| `punishment_dms` | per-type DM templates (plain/embed/Components V2), before/after ordering, anonymity |
| `escalation` | trigger-count -> punishment mapping (per rule or global) |
| `join_roles` / `welcome` / `goodbye` / `booster` | join roles and greeting messages |
| `role_connections` | Sapphire-style auto role management: a main role assigned/removed from role conditions (`has`/`doesn't have` + AND/OR logic), re-synced on role changes and every N minutes |
| `channel_locking` | named lock presets with byte-for-byte unlock (snapshot restore) + cron schedules |
| `anti_raid`, `sticky_*`, `slowmode_scheduler`, `invite_tracking` | server hardening |
| `tickets`, `modmail`, `verification_gate`, `quarantine`, `blacklist`, `alt_detection` | security modules |
| `trust_levels` | time + clean-history progression ladder |
| `staff_permission_groups` | role-based command tiers (e.g. junior mod can't ban) |
| `community` | starboard, suggestions, giveaways, levels, status rotation, birthdays (all off by default) |
| `dashboard` | port, owner ID, log retention |
| `error_reporting` / `rate_limit_reporting` | Discord channel + optional external webhook |
| `ops` | backups, usage analytics, snipe retention |

Cross-field checks run at boot too: alias collisions across commands (including alias vs
command-name clashes), ascending warning/escalation counts, valid regex compilation,
resolvable log targets, unique presets/rules/groups.

---

## Core engineering guarantees

- **Config validation on boot** — fail-fast with a full human-readable error list; never boots half-invalid.
- **No unhandled crashes** — global `uncaughtException` / `unhandledRejection` handlers plus per-command, per-event and per-automod-module try/catch; failures are logged and reported to the configured error channel.
- **Rate-limit reporting** — discord.js `rateLimit` + REST debug events post route/method/timeout/global to a channel.
- **Cooldowns everywhere** — one `CooldownManager` drives slash, prefix, and every button/select/modal interaction, with per-command configurable values.
- **Components V2 only** — user-facing messages use `ContainerBuilder`/`TextDisplay`/`MediaGallery` (with `MessageFlags.IsComponentsV2`), never legacy embeds.

---

## Project layout

```
shared/src/        config schema+validation, db pool + migrations, shared utils & wire types
bot/src/           client, loaders, events, components, moderation, automod, management,
                   security, community, scheduler, metrics
dashboard/server/  Express REST API, OAuth2 owner gate, WebSocket live-log stream
dashboard/web/     Vite + React (JSX) dashboard
docker/            compose file + Dockerfiles
scripts/           config.yml generator
```

Commands auto-load from `bot/src/commands/**` (one file per command, subfolders per
category). Events load from `bot/src/events/**`. Buttons/selects/modals register by
`customId` prefix from `bot/src/components/**`. No manual registration lists.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run gen-config` | write a default, fully-commented `config.yml` |
| `npm run typecheck` | typecheck bot + dashboard server + shared (and the web app) |
| `npm run build` | compile the Node code and build the frontend |
| `npm run dev:bot` | run the bot with tsx watch |
| `npm run dev:dashboard` | run the dashboard API + WS with tsx watch |
| `npm run dev:web` | run the Vite dev server |
| `npm run start:bot` | run the compiled bot |
| `npm run start:dashboard` | run the compiled dashboard server |

## Dashboard features

- Live log stream (WebSocket) + historical log browser with combinable filters
- Dedicated automod log browser (rule / user / channel / date filters)
- Case browser with search + void action
- Active punishment list with countdown and revoke
- Regex tester against the production engine, with match highlighting
- Role Connections simulator (build conditions, test against a member's roles, copy the config.yml block)
- Timestamp generator (matches the bot's `/timestamp` command)
- Config editor with validation-before-save, download/upload, and audit trail
- Command analytics page
- Session management (IP/user-agent audit, revocation, logout)
- Export/backup of cases + warnings + notes + reports + custom commands
- Dark/light theme, icon-only UI (no emoji anywhere)
