# Changelog — Role-Based Moderation Permissions

## What Changed

All moderation commands now use **role-based permissions** instead of Discord native permissions (e.g. `BanMembers`, `KickMembers`, `ModerateMembers`, `ManageMessages`). Access is controlled entirely through role IDs in `config.yml`.

## Why

Discord native permissions are too broad — anyone with the right server-level permission could run any command regardless of their staff role. Locking commands to specific roles gives precise, granular control over who can do what.

## Files Changed

- `bot/src/moderation/hierarchyGuard.ts` — Config `permissions` now overrides command-file permissions. When `permissions: []` is set in config, Discord native checks are skipped.
- `bot/src/commands/moderation/lock.ts` — Added `reason` option, sends a lock notice in the channel, defaults to current channel.
- `bot/src/commands/moderation/unlock.ts` — Added `reason` option, sends an unlock notice in the channel, defaults to current channel.
- `config.yml` — Added `staff_permission_groups` with 5 tiers, added `permission_group` to every moderation command, cleared `permissions: []`.

## Permission Tiers

| Tier | Roles | Commands |
|------|-------|----------|
| `trial_mod` | Trial Moderator and above | warn, mute, timeout, caseclose, unwarn, unmute, timewarn, timemute, userinfo, lock, unlock, setslowmode, snipe, note, report, clearwarnings, lockall |
| `moderator` | Moderator and above | kick, purge, purge-until, softban, nick, temprole, case, cases, warns, casedelete, automodtest, slowmode |
| `senior_mod` | Senior Moderator and above | ban, unban, timeban, timekick, massban, massmute, masswarn, masskick, nameban, namemute, namewarn, namekick, prune, restore, snapshot, lookup, modstats |
| `head_mod` | Head Moderator and above | lockall, unlockall, quarantine, unquarantine, archive, archives |
| `admin` | Administrator and above | roleadd, roleremove, roleimagedit, emergency, emergencyaccess, block-appeal-user, unblock-appeal-user, appeal-reply, report-ignoreall, say, announce |

## Role IDs

| Role | ID |
|------|----|
| Rooted Together — Owners | `1479852874635939880` |
| Security Team | `1546938772208492634` |
| Co-Owner | `1534544391811891321` |
| Lead Administrator | `1546938257990746183` |
| Administrator | `1534545792705237133` |
| Head Moderator | `1538896865481850992` |
| Senior Moderator | `1534546302350659675` |
| Moderator | `1534546666726756373` |
| Trial Moderator | `1534547067501023405` |
| All Staff | `1467103806561980528` |

## How to Adjust

Edit `staff_permission_groups` in `config.yml`. To add a command to a tier, add its name to the tier's `permissions` list. To move a command to a different tier, change its `permission_group` value. No code changes needed.

---

## Lock / Unlock Channel Changes

### What Changed

- **Lock** now denies `SendMessages` and `AddReactions` on the channel's `@everyone` overwrite. It snapshots the exact permission state before locking so unlock can restore it precisely.
- **Unlock** restores the **exact** pre-lock permission overwrites from the snapshot — no permissions are added or removed beyond what was there before.
- Both commands now send a message in the locked/unlocked channel with the reason and who did it.
- Both commands default to the **current channel** if no channel is specified.
- Both commands accept an optional `reason` parameter.

### Usage

**Slash:** `/lock channel:#general reason:Raider spam`
**Prefix:** `!lock #general Raider spam`
**Prefix (current channel):** `!lock Raider spam`

**Slash:** `/unlock channel:#general reason:Situation resolved`
**Prefix:** `!unlock #general Situation resolved`
**Prefix (current channel):** `!unlock Situation resolved`

### How the Snapshot Works

1. On lock, the current state of **all** permission overwrites on the channel is saved to the `lockdown_snapshots` database table.
2. The `@everyone` overwrite gets `SendMessages` and `AddReactions` added to its deny bitfield.
3. Any roles in `channel_locking.exclude_roles` get those permissions explicitly allowed (so staff can still talk).
4. On unlock, the saved snapshot is loaded and applied verbatim — every overwrite is restored to its exact pre-lock state.
