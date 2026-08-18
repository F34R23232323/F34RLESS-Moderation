type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

export class Logger {
  private readonly scope: string;

  constructor(scope = 'bot') {
    this.scope = scope;
  }

  public child(name: string): Logger {
    return new Logger(`${this.scope}:${name}`);
  }

  private out(level: Level, msg: string, meta?: unknown): void {
    const ts = new Date().toISOString();
    const color = COLORS[level];
    const line = `${color}[${ts}] [${level.toUpperCase()}] [${this.scope}]${RESET} ${msg}`;
    if (level === 'error') {
      console.error(line);
      if (meta !== undefined) console.error(meta);
    } else if (level === 'warn') {
      console.warn(line);
      if (meta !== undefined) console.warn(meta);
    } else {
      console.log(line);
      if (meta !== undefined) console.log(meta);
    }
  }

  public debug(msg: string, meta?: unknown): void {
    if (process.env.LOG_LEVEL === 'debug') this.out('debug', msg, meta);
  }

  public info(msg: string, meta?: unknown): void {
    this.out('info', msg, meta);
  }

  public warn(msg: string, meta?: unknown): void {
    this.out('warn', msg, meta);
  }

  public error(msg: string, meta?: unknown): void {
    this.out('error', msg, meta);
  }
}