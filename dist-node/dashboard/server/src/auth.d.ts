import type { Request, Response, NextFunction } from 'express';
import type { DashboardContext } from './context';
export interface SessionUser {
    id: string;
    username: string;
    avatar: string | null;
}
export declare function sign(value: string, secret: string): string;
export declare function createSession(ctx: DashboardContext, user: SessionUser, req: Request): Promise<string>;
export declare function destroySession(ctx: DashboardContext, cookie: string): Promise<void>;
export declare function requireAuth(ctx: DashboardContext): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function setSessionCookie(res: Response, cookie: string): void;
export declare function clearSessionCookie(res: Response): void;
export declare const SESSION_COOKIE_NAME = "f34rless_session";
