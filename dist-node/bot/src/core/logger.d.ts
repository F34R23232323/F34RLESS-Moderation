export declare class Logger {
    private readonly scope;
    constructor(scope?: string);
    child(name: string): Logger;
    private out;
    debug(msg: string, meta?: unknown): void;
    info(msg: string, meta?: unknown): void;
    warn(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
}
