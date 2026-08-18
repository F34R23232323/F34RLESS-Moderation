import * as crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from './context';

const SESSION_COOKIE = 'f34rless_session';
const SESSION_TTL_MS = 7 * 86400000;

export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
}

export function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex').slice(0, 32);
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

export function requireAuth(ctx: DashboardContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const cookie = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!cookie) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const [token, mac] = cookie.split('.');
    if (!token || !mac || sign(token, ctx.sessionSecret) !== mac) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT user_id, revoked, expires_at FROM sessions WHERE token = ?',
      [token],
    );
    const session = rows[0] as { user_id: string; revoked: number; expires_at: Date } | undefined;
    if (!session || session.revoked === 1 || new Date(session.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (session.user_id !== ctx.ownerUserId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    (req as unknown as { userId: string }).userId = session.user_id;
    (req as unknown as { sessionToken: string }).sessionToken = token;
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