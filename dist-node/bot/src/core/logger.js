"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const COLORS = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
};
const RESET = '\x1b[0m';
class Logger {
    scope;
    constructor(scope = 'bot') {
        this.scope = scope;
    }
    child(name) {
        return new Logger(`${this.scope}:${name}`);
    }
    out(level, msg, meta) {
        const ts = new Date().toISOString();
        const color = COLORS[level];
        const line = `${color}[${ts}] [${level.toUpperCase()}] [${this.scope}]${RESET} ${msg}`;
        if (level === 'error') {
            console.error(line);
            if (meta !== undefined)
                console.error(meta);
        }
        else if (level === 'warn') {
            console.warn(line);
            if (meta !== undefined)
                console.warn(meta);
        }
        else {
            console.log(line);
            if (meta !== undefined)
                console.log(meta);
        }
    }
    debug(msg, meta) {
        if (process.env.LOG_LEVEL === 'debug')
            this.out('debug', msg, meta);
    }
    info(msg, meta) {
        this.out('info', msg, meta);
    }
    warn(msg, meta) {
        this.out('warn', msg, meta);
    }
    error(msg, meta) {
        this.out('error', msg, meta);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map