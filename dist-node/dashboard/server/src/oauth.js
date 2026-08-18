"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const auth_1 = require("./auth");
function createAuthRouter(ctx) {
    const router = (0, express_1.Router)();
    const redirectUri = `${ctx.baseUrl}/oauth/callback`;
    router.get('/login', (_req, res) => {
        const url = new URL('https://discord.com/oauth2/authorize');
        url.searchParams.set('client_id', ctx.clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'identify');
        res.redirect(url.toString());
    });
    router.get('/callback', async (req, res) => {
        const code = req.query.code;
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
                    redirect_uri: redirectUri,
                }),
            });
            if (!tokenRes.ok) {
                res.status(400).send('OAuth token exchange failed');
                return;
            }
            const tokenJson = (await tokenRes.json());
            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenJson.access_token}` },
            });
            const user = (await userRes.json());
            if (user.id !== ctx.ownerUserId) {
                res.status(403).send('This account is not authorized to access the dashboard.');
                return;
            }
            const cookie = await (0, auth_1.createSession)(ctx, { id: user.id, username: user.username, avatar: user.avatar }, req);
            (0, auth_1.setSessionCookie)(res, cookie);
            res.redirect('/');
        }
        catch (err) {
            console.error('OAuth callback failed:', err);
            res.status(500).send('OAuth callback failed');
        }
    });
    router.post('/logout', async (req, res) => {
        const cookie = req.cookies?.[auth_1.SESSION_COOKIE_NAME];
        if (cookie)
            await (0, auth_1.destroySession)(ctx, cookie);
        (0, auth_1.clearSessionCookie)(res);
        res.json({ ok: true });
    });
    router.get('/me', async (req, res) => {
        const cookie = req.cookies?.[auth_1.SESSION_COOKIE_NAME];
        if (!cookie) {
            res.json({ authenticated: false });
            return;
        }
        const [token] = cookie.split('.');
        if (!token) {
            res.json({ authenticated: false });
            return;
        }
        const [rows] = await ctx.db.query('SELECT user_id, revoked FROM sessions WHERE token = ?', [token]);
        const session = rows[0];
        const authenticated = Boolean(session && session.revoked === 0 && session.user_id === ctx.ownerUserId);
        res.json({ authenticated, userId: session?.user_id ?? null });
    });
    return router;
}
//# sourceMappingURL=oauth.js.map