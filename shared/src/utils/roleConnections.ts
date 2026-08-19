import type { RoleConnection, RoleConnectionCondition } from '../config/schema';

export type ConnectionOutcome = 'add' | 'remove' | 'unchanged';

export interface ConnectionResult {
  met: boolean;
  outcome: ConnectionOutcome;
  conditions: Array<{ has_role: boolean; role_id: string; satisfied: boolean }>;
}

export function evaluateCondition(
  cond: RoleConnectionCondition,
  memberRoleIds: ReadonlySet<string>,
): boolean {
  return cond.has_role ? memberRoleIds.has(cond.role_id) : !memberRoleIds.has(cond.role_id);
}

export function evaluateRoleConnection(
  conn: RoleConnection,
  memberRoleIds: ReadonlySet<string>,
): boolean {
  const results = conn.conditions.map((c) => evaluateCondition(c, memberRoleIds));
  return conn.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Detailed evaluation used by the dashboard simulator and by logging: for every
 * condition it reports whether it was satisfied, plus the final verdict and what
 * would happen to the main role for a member holding exactly `memberRoleIds`.
 */
export function evaluateConnectionResult(
  conn: RoleConnection,
  memberRoleIds: ReadonlySet<string>,
): ConnectionResult {
  const conditions = conn.conditions.map((c) => ({
    has_role: c.has_role,
    role_id: c.role_id,
    satisfied: evaluateCondition(c, memberRoleIds),
  }));
  const met = conn.logic === 'all' ? conditions.every((c) => c.satisfied) : conditions.some((c) => c.satisfied);
  const has = memberRoleIds.has(conn.main_role);
  const outcome: ConnectionOutcome = met ? (has ? 'unchanged' : 'add') : has ? 'remove' : 'unchanged';
  return { met, outcome, conditions };
}

export function connectionDisplayName(conn: RoleConnection): string {
  return conn.name && conn.name.trim().length > 0 ? conn.name : conn.main_role;
}
