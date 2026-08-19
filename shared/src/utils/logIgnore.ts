export interface LogIgnoreSpec {
  channels: string[];
  categories: string[];
  users: string[];
  roles: string[];
}

export interface LogIgnoreContext {
  channelId?: string | null;
  categoryId?: string | null;
  actorId?: string | null;
  targetId?: string | null;
  actorRoleIds?: ReadonlySet<string> | null;
  targetRoleIds?: ReadonlySet<string> | null;
}

/**
 * Decide whether a log entry should be suppressed. A single match on any of the
 * lists suppresses it:
 *   - channels: the event happened in this channel,
 *   - categories: the event happened in a channel inside this category,
 *   - users: the actor or the target is this user,
 *   - roles: the actor or the target holds this role.
 */
export function isLogIgnored(
  spec: LogIgnoreSpec | undefined | null,
  ctx: LogIgnoreContext,
): boolean {
  if (!spec) return false;

  if (ctx.channelId && spec.channels.includes(ctx.channelId)) return true;
  if (ctx.categoryId && spec.categories.includes(ctx.categoryId)) return true;

  for (const id of [ctx.actorId, ctx.targetId]) {
    if (id && spec.users.includes(id)) return true;
  }

  if (spec.roles.length > 0) {
    for (const roleIds of [ctx.actorRoleIds, ctx.targetRoleIds]) {
      if (!roleIds || roleIds.size === 0) continue;
      for (const roleId of spec.roles) {
        if (roleIds.has(roleId)) return true;
      }
    }
  }

  return false;
}

export const EMPTY_LOG_IGNORE: LogIgnoreSpec = {
  channels: [],
  categories: [],
  users: [],
  roles: [],
};
