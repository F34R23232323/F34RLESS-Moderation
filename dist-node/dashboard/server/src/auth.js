"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.sign = sign;
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.requireAuth = requireAuth;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
const crypto = __importStar(require("crypto"));
const SESSION_COOKIE = 'f34rless_session';
const SESSION_TTL_MS = 7 * 86400000;
function sign(value, secret) {
    return crypto.createHmac('sha256', secret).update(value).digest('hex').slice(0, 32);
}
async function createSession(ctx, user, req) {
    const token = crypto.randomBytes(32).toString('hex');
    await ctx.db.execute('INSERT INTO sessions (token, user_id, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)', [token, user.id, req.ip ?? null, req.headers['user-agent'] ?? null, new Date(Date.now() + SESSION_TTL_MS)]);
    const cookie = `${token}.${sign(token, ctx.sessionSecret)}`;
    return cookie;
}
async function destroySession(ctx, cookie) {
    const token = cookie.split('.')[0];
    if (token) {
        await ctx.db.execute('UPDATE sessions SET revoked = 1 WHERE token = ?', [token]);
    }
}
function requireAuth(ctx) {
    return async (req, res, next) => {
        const cookie = req.cookies?.[SESSION_COOKIE];
        if (!cookie) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        const [token, mac] = cookie.split('.');
        if (!token || !mac || sign(token, ctx.sessionSecret) !== mac) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        const [rows] = await ctx.db.query('SELECT user_id, revoked, expires_at FROM sessions WHERE token = ?', [token]);
        const session = rows[0];
        if (!session || session.revoked === 1 || new Date(session.expires_at).getTime() < Date.now()) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        if (session.user_id !== ctx.ownerUserId) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        req.userId = session.user_id;
        req.sessionToken = token;
        next();
    };
}
function setSessionCookie(res, cookie) {
    res.cookie(SESSION_COOKIE, cookie, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: SESSION_TTL_MS,
        path: '/',
    });
}
function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
}
exports.SESSION_COOKIE_NAME = SESSION_COOKIE;
//# sourceMappingURL=auth.js.map