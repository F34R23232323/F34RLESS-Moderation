import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from './context';
import {
  createSession,
  destroySession,
  setSessionCookie,
  setCsrfCookie,
  clearSessionCookie,
  readSession,
  SESSION_COOKIE_NAME,
} from './auth';

export function createAuthRouter(ctx: DashboardContext): Router {
  const router = Router();
  const redirectUri = `${ctx.baseUrl}/oauth/callback`;

  router.get('/login', (_req: Request, res: Response) => {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', ctx.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    res.redirect(url.toString());
  });

  router.get('/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const started = Date.now();
    console.log(`[oauth] /callback hit at ${new Date().toISOString()} (code: ${code ? 'present' : 'MISSING'}, baseUrl: ${ctx.baseUrl})`);
    if (!code) {
      res.status(400).send('Missing code');
      return;
    }
    try {
      console.log('[oauth] exchanging code for token...');
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ctx.clientId,
          client_secret: ctx.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(15000),
      });
      console.log(`[oauth] token exchange responded HTTP ${tokenRes.status} in ${Date.now() - started}ms`);
      if (!tokenRes.ok) {
        res.status(400).send('OAuth token exchange failed');
        return;
      }
      const tokenJson = (await tokenRes.json()) as { access_token: string };
      console.log('[oauth] fetching user profile...');
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };
      console.log(`[oauth] user fetched: ${user.username} (${user.id}) in ${Date.now() - started}ms`);

      if (user.id !== ctx.ownerUserId) {
        console.warn(`[oauth] DENIED: ${user.id} is not the owner (${ctx.ownerUserId})`);
        res.status(403).send('This account is not authorized to access the dashboard.');
        return;
      }

      const cookie = await createSession(ctx, { id: user.id, username: user.username, avatar: user.avatar }, req);
      setSessionCookie(res, cookie);
      setCsrfCookie(res, cookie.split('.')[0], ctx.sessionSecret);
      console.log(`[oauth] session created, redirecting to / in ${Date.now() - started}ms`);
      res.redirect('/');
    } catch (err) {
      console.error(`[oauth] callback failed after ${Date.now() - started}ms:`, err);
      res.status(500).send('OAuth callback failed');
    }
  });

  // ── Public appeals portal login (any Discord user, not owner-gated) ────────
  const appealsRedirectUri = `${ctx.baseUrl}/oauth/appeals-callback`;

  router.get('/appeals-login', (req: Request, res: Response) => {
    const returnPath = req.query.return as string | undefined;
    // Only allow redirecting back into the appeals portal (prevents open redirect).
    const state = returnPath && returnPath.startsWith('/appeals/') ? returnPath : '/appeals';
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', ctx.clientId);
    url.searchParams.set('redirect_uri', appealsRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  });

  router.get('/appeals-callback', async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = (req.query.state as string | undefined) ?? '/appeals';
    if (!code) {
      res.status(400).send('Missing code');
      return;
    }
    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ctx.clientId,
          client_secret: ctx.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: appealsRedirectUri,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!tokenRes.ok) {
        res.status(400).send('OAuth token exchange failed');
        return;
      }
      const tokenJson = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };
      const cookie = await createSession(ctx, { id: user.id, username: user.username, avatar: user.avatar }, req);
      setSessionCookie(res, cookie);
      setCsrfCookie(res, cookie.split('.')[0], ctx.sessionSecret);
      const target = state.startsWith('/appeals/') ? state : '/appeals';
      res.redirect(target);
    } catch (err) {
      console.error('[oauth] appeals callback failed:', err);
      res.status(500).send('OAuth callback failed');
    }
  });

  router.get('/appeals-me', async (req: Request, res: Response) => {
    const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      userId: session.userId,
    });
  });

  router.post('/logout', async (req: Request, res: Response) => {
    const cookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (cookie) await destroySession(ctx, cookie);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', async (req: Request, res: Response) => {
    const cookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!cookie) {
      res.json({ authenticated: false });
      return;
    }
    const [token] = cookie.split('.');
    if (!token) {
      res.json({ authenticated: false });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT user_id, revoked FROM sessions WHERE token = ?',
      [token],
    );
    const session = rows[0] as { user_id: string; revoked: number } | undefined;
    const authenticated = Boolean(session && session.revoked === 0 && session.user_id === ctx.ownerUserId);
    res.json({ authenticated, userId: session?.user_id ?? null });
  });

  return router;
}