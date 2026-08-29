import * as crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from './context';

const SESSION_COOKIE = 'f34rless_session';
const CSRF_COOKIE = 'f34rless_csrf';
const SESSION_TTL_MS = 7 * 86400000;

export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
}

export function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex').slice(0, 32);
}

/** Deterministic double-submit CSRF token for a session (no DB storage needed). */
export function csrfFor(sessionToken: string, secret: string): string {
  return sign(`csrf:${sessionToken}`, secret);
}

export function setCsrfCookie(res: Response, sessionToken: string, secret: string): void {
  res.cookie(CSRF_COOKIE, csrfFor(sessionToken, secret), {
    httpOnly: false, // read by the frontend JS, sent back in the X-CSRF-Token header
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export async function createSession(ctx: DashboardContext, user: SessionUser, req: Request): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await ctx.db.execute(
    'INSERT INTO sessions (token, user_id, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
    [token, user.id, req.ip ?? null, (req.headers['user-agent'] as string) ?? null, new Date(Date.now() + SESSION_TTL_MS)],
  );
  const cookie = `${token}.${sign(token, ctx.sessionSecret)}`;
  return cookie;
}

export async function destroySession(ctx: DashboardContext, cookie: string): Promise<void> {
  const token = cookie.split('.')[0];
  if (token) {
    await ctx.db.execute('UPDATE sessions SET revoked = 1 WHERE token = ?', [token]);
  }
}

export interface SessionInfo {
  userId: string;
  sessionToken: string;
  revoked: boolean;
}

/**
 * Shared session validation. Returns the session info if the cookie is valid
 * and not revoked/expired, otherwise null.
 */
export async function readSession(ctx: DashboardContext, cookie: string | undefined): Promise<SessionInfo | null> {
  if (!cookie) return null;
  const [token, mac] = cookie.split('.');
  if (!token || !mac || sign(token, ctx.sessionSecret) !== mac) return null;
  const query = async (): Promise<RowDataPacket[]> => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT user_id, revoked, expires_at FROM sessions WHERE token = ?',
      [token],
    );
    return rows;
  };
  // Never let a slow/queued DB query hang the entire dashboard.
  const timer = new Promise<null>((resolve) => {
    const t = setTimeout(() => resolve(null), 5_000);
    t.unref?.();
  });
  const result = await Promise.race<RowDataPacket[] | null>([query(), timer]);
  if (!result || result.length === 0) return null;
  const session = result[0] as unknown as { user_id: string; revoked: number; expires_at: Date };
  if (session.revoked === 1 || new Date(session.expires_at).getTime() < Date.now()) return null;
  return { userId: session.user_id, sessionToken: token, revoked: false };
}

/** Owner-gated auth (existing dashboard behaviour). */
export function requireAuth(ctx: DashboardContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE] as string | undefined);
    if (!session) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (session.userId !== ctx.ownerUserId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    (req as unknown as { userId: string }).userId = session.userId;
    (req as unknown as { sessionToken: string }).sessionToken = session.sessionToken;
    next();
  };
}

/**
 * Auth for regular (non-owner) users — any valid session. Used by the public
 * appeals portal. Verifies guild membership separately via GuildAccessService.
 */
export function requireUserAuth(ctx: DashboardContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE] as string | undefined);
    if (!session) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as unknown as { userId: string }).userId = session.userId;
    (req as unknown as { sessionToken: string }).sessionToken = session.sessionToken;
    next();
  };
}

/**
 * CSRF protection for mutating appeals routes (double-submit cookie pattern).
 * The X-CSRF-Token header must match the token derived from the session.
 */
export function requireCsrf(ctx: DashboardContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessionToken = (req as unknown as { sessionToken?: string }).sessionToken;
    if (!sessionToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const expected = csrfFor(sessionToken, ctx.sessionSecret);
    const header = (req.headers['x-csrf-token'] as string | undefined) ?? '';
    const cookie = (req.cookies?.[CSRF_COOKIE] as string | undefined) ?? '';
    if (header !== expected || cookie !== expected) {
      res.status(403).json({ error: 'csrf mismatch' });
      return;
    }
    next();
  };
}

export function setSessionCookie(res: Response, cookie: string): void {
  res.cookie(SESSION_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;