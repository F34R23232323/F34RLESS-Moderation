import { Router, type Request, type Response } from 'express';
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

/** Hard cap on the whole OAuth callback (Discord fetches + DB work) so the
 *  request always returns well before any reverse-proxy timeout kicks in. */
const CALLBACK_DEADLINE_MS = 20_000;
/** Per-outbound-request timeout for Discord API calls. */
const DISCORD_FETCH_TIMEOUT_MS = 10_000;
/** Timeout for the session insert — a slow/queued DB must never hang login. */
const DB_OP_TIMEOUT_MS = 8_000;

/** Race a promise against a deadline so a stuck operation fails fast instead
 *  of letting the request hang until the proxy/HTTP timeout gives up. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Small self-contained error page so OAuth failures are explainable instead
 *  of a bare text/500 (which often reads as a proxy "timed out"). */
function errorPage(title: string, detail: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — f34rless dashboard</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1e1f22;color:#dbdee1;font-family:'Segoe UI',system-ui,sans-serif}
  .card{max-width:420px;padding:32px;background:#2b2d31;border-radius:12px;text-align:center}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#b5bac1;font-size:14px;margin:0 0 20px;line-height:1.5}
  .btn{display:inline-block;background:#5865f2;color:#fff;border-radius:6px;padding:10px 18px;text-decoration:none;font-weight:600;font-size:14px}
</style></head><body><div class="card"><h1>${title}</h1><p>${detail}</p><a class="btn" href="/login">Try signing in again</a></div></body></html>`;
}

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
      res.status(400).send(errorPage('Login failed', 'Discord did not include an authorization code. Please try signing in again.'));
      return;
    }
    const authCode = code;
    let responded = false;
    const send = (status: number, body: string): void => {
      if (responded) return;
      responded = true;
      res.status(status).send(body);
    };
    // Hard deadline: if nothing else has responded by this point, force-close
    // the connection so the browser never hangs past a proxy timeout.
    const hardDeadline = setTimeout(() => {
      if (!responded) {
        responded = true;
        res.status(504).send(
          errorPage('Login timed out', 'The login process took too long. Please try again.'),
        );
      }
    }, CALLBACK_DEADLINE_MS + 10_000);
    hardDeadline.unref?.();
    try {
      await withTimeout(handleCallback(), CALLBACK_DEADLINE_MS, 'OAuth login');
    } catch (err) {
      console.error(`[oauth] callback failed after ${Date.now() - started}ms:`, err);
      send(
        500,
        errorPage('Login failed', 'Sign-in timed out or the server could not reach Discord / the database. Please try again in a moment.'),
      );
    } finally {
      clearTimeout(hardDeadline);
    }

    async function handleCallback(): Promise<void> {
      console.log('[oauth] exchanging code for token...');
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ctx.clientId,
          client_secret: ctx.clientSecret,
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
      });
      console.log(`[oauth] token exchange responded HTTP ${tokenRes.status} in ${Date.now() - started}ms`);
      if (!tokenRes.ok) {
        send(400, errorPage('Login failed', `Discord rejected the OAuth code (HTTP ${tokenRes.status}). Please try signing in again.`));
        return;
      }
      const tokenJson = (await tokenRes.json()) as { access_token: string };
      console.log('[oauth] fetching user profile...');
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
      });
      if (!userRes.ok) {
        console.warn(`[oauth] user profile fetch returned HTTP ${userRes.status}`);
        send(502, errorPage('Login failed', `Could not fetch your Discord profile (HTTP ${userRes.status}). Please try again.`));
        return;
      }
      const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };
      console.log(`[oauth] user fetched: ${user.username} (${user.id}) in ${Date.now() - started}ms`);

      if (user.id !== ctx.ownerUserId) {
        console.warn(`[oauth] DENIED: ${user.id} is not the owner (${ctx.ownerUserId})`);
        send(403, errorPage('Access denied', 'This Discord account is not authorized to access the dashboard.'));
        return;
      }

      const cookie = await withTimeout(
        createSession(ctx, { id: user.id, username: user.username, avatar: user.avatar }, req),
        DB_OP_TIMEOUT_MS,
        'session creation',
      );
      setSessionCookie(res, cookie);
      setCsrfCookie(res, cookie.split('.')[0], ctx.sessionSecret);
      console.log(`[oauth] session created, redirecting to / in ${Date.now() - started}ms`);
      if (!responded) {
        responded = true;
        res.redirect('/');
      }
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
      res.status(400).send(errorPage('Login failed', 'Discord did not include an authorization code. Please try signing in again.'));
      return;
    }
    const appealsCode = code;
    let responded = false;
    const send = (status: number, body: string): void => {
      if (responded) return;
      responded = true;
      res.status(status).send(body);
    };
    const hardDeadline = setTimeout(() => {
      if (!responded) {
        responded = true;
        res.status(504).send(
          errorPage('Login timed out', 'The login process took too long. Please try again.'),
        );
      }
    }, CALLBACK_DEADLINE_MS + 10_000);
    hardDeadline.unref?.();
    try {
      await withTimeout(handleCallback(), CALLBACK_DEADLINE_MS, 'Appeals login');
    } catch (err) {
      console.error('[oauth] appeals callback failed:', err);
      send(
        500,
        errorPage('Login failed', 'Sign-in timed out or the server could not reach Discord / the database. Please try again in a moment.'),
      );
    } finally {
      clearTimeout(hardDeadline);
    }

    async function handleCallback(): Promise<void> {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ctx.clientId,
          client_secret: ctx.clientSecret,
          grant_type: 'authorization_code',
          code: appealsCode,
          redirect_uri: appealsRedirectUri,
        }),
        signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
      });
      if (!tokenRes.ok) {
        send(400, errorPage('Login failed', `Discord rejected the OAuth code (HTTP ${tokenRes.status}). Please try signing in again.`));
        return;
      }
      const tokenJson = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
      });
      if (!userRes.ok) {
        send(502, errorPage('Login failed', `Could not fetch your Discord profile (HTTP ${userRes.status}). Please try again.`));
        return;
      }
      const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };
      const cookie = await withTimeout(
        createSession(ctx, { id: user.id, username: user.username, avatar: user.avatar }, req),
        DB_OP_TIMEOUT_MS,
        'session creation',
      );
      setSessionCookie(res, cookie);
      setCsrfCookie(res, cookie.split('.')[0], ctx.sessionSecret);
      const target = state.startsWith('/appeals/') ? state : '/appeals';
      if (!responded) {
        responded = true;
        res.redirect(target);
      }
    }
  });

  router.get('/appeals-me', async (req: Request, res: Response) => {
    try {
      const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
      if (!session) {
        res.json({ authenticated: false });
        return;
      }
      res.json({ authenticated: true, userId: session.userId });
    } catch {
      // readSession timed out or the DB was unreachable — treat as unauthenticated
      // rather than hanging the response, so the frontend can render the login prompt.
      res.json({ authenticated: false });
    }
  });

  router.post('/logout', async (req: Request, res: Response) => {
    const cookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (cookie) await destroySession(ctx, cookie);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', async (req: Request, res: Response) => {
    try {
      const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
      const authenticated = Boolean(session && session.userId === ctx.ownerUserId);
      res.json({ authenticated, userId: session?.userId ?? null });
    } catch {
      // readSession timed out (DB unreachable) — return unauthenticated so the
      // frontend renders the login page rather than spinning forever.
      res.json({ authenticated: false, userId: null });
    }
  });

  return router;
}