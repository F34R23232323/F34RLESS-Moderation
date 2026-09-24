import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('calculator')
  .setDescription('Evaluate a math expression with working out (+, -, *, /, %, ^, √, functions…)')
  .addStringOption((o) => o.setName('expression').setDescription('Expression, e.g. 2+2*10 or sqrt(16)^2').setRequired(true));

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType = 'num' | 'op' | 'ident' | 'lparen' | 'rparen' | 'comma' | 'fact' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const NUMBER_RE = /^\d*\.?\d+(?:[eE][+-]?\d+)?/;
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*/;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch });
      i++;
      continue;
    }
    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'fact', value: ch });
      i++;
      continue;
    }
    const num = input.slice(i).match(NUMBER_RE);
    if (num && num[0].length > 0) {
      tokens.push({ type: 'num', value: num[0] });
      i += num[0].length;
      continue;
    }
    const ident = input.slice(i).match(IDENT_RE);
    if (ident && ident[0].length > 0) {
      tokens.push({ type: 'ident', value: ident[0] });
      i += ident[0].length;
      continue;
    }
    throw new Error(`invalid character "${ch}"`);
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

type Node =
  | { type: 'num'; value: number }
  | { type: 'bin'; op: string; left: Node; right: Node }
  | { type: 'unary'; operand: Node }
  | { type: 'fact'; operand: Node }
  | { type: 'fn'; name: string; args: Node[] };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

class Parser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenize(input);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new Error(`expected ${type}, got "${t.value}"`);
    return t;
  }

  parse(): Node {
    const node = this.addSub();
    if (this.peek().type !== 'eof') throw new Error(`unexpected "${this.peek().value}"`);
    return node;
  }

  private addSub(): Node {
    let left = this.mulDiv();
    while (this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.mulDiv();
      left = { type: 'bin', op, left, right };
    }
    return left;
  }

  private mulDiv(): Node {
    let left = this.power();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        const op = this.next().value;
        const right = this.power();
        left = { type: 'bin', op, left, right };
      } else if (t.type === 'lparen' || t.type === 'ident' || t.type === 'num') {
        // implicit multiplication: 2(3), 2π, 3sqrt(4), (2)(3)
        const right = this.power();
        left = { type: 'bin', op: '*', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private power(): Node {
    const base = this.unary();
    if (this.peek().type === 'op' && this.peek().value === '^') {
      this.next();
      const exponent = this.power();
      return { type: 'bin', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private unary(): Node {
    if (this.peek().type === 'op' && this.peek().value === '-') {
      this.next();
      return { type: 'unary', operand: this.unary() };
    }
    const node = this.postfix();
    return node;
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.peek().type === 'fact') {
      this.next();
      node = { type: 'fact', operand: node };
    }
    return node;
  }

  private primary(): Node {
    const t = this.peek();
    if (t.type === 'num') {
      this.next();
      return { type: 'num', value: parseFloat(t.value) };
    }
    if (t.type === 'ident') {
      this.next();
      const name = t.value.toLowerCase();
      if (CONSTANTS[name] !== undefined) {
        return { type: 'num', value: CONSTANTS[name] };
      }
      if (this.peek().type === 'lparen') {
        this.next();
        const args: Node[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.addSub());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.addSub());
          }
        }
        this.expect('rparen');
        return { type: 'fn', name, args };
      }
      throw new Error(`unknown identifier "${name}"`);
    }
    if (t.type === 'lparen') {
      this.next();
      const node = this.addSub();
      this.expect('rparen');
      return node;
    }
    throw new Error(`unexpected "${t.value || t.type}"`);
  }
}

// ---------------------------------------------------------------------------
// Functions & evaluation (with step recording)
// ---------------------------------------------------------------------------

const FUNCTIONS: Record<string, { fn: (...args: number[]) => number; min: number; max: number }> = {
  sqrt: { fn: Math.sqrt, min: 1, max: 1 },
  cbrt: { fn: Math.cbrt, min: 1, max: 1 },
  abs: { fn: Math.abs, min: 1, max: 1 },
  floor: { fn: Math.floor, min: 1, max: 1 },
  ceil: { fn: Math.ceil, min: 1, max: 1 },
  round: { fn: Math.round, min: 1, max: 1 },
  trunc: { fn: Math.trunc, min: 1, max: 1 },
  sign: { fn: Math.sign, min: 1, max: 1 },
  sin: { fn: Math.sin, min: 1, max: 1 },
  cos: { fn: Math.cos, min: 1, max: 1 },
  tan: { fn: Math.tan, min: 1, max: 1 },
  asin: { fn: Math.asin, min: 1, max: 1 },
  acos: { fn: Math.acos, min: 1, max: 1 },
  atan: { fn: Math.atan, min: 1, max: 1 },
  sinh: { fn: Math.sinh, min: 1, max: 1 },
  cosh: { fn: Math.cosh, min: 1, max: 1 },
  tanh: { fn: Math.tanh, min: 1, max: 1 },
  ln: { fn: Math.log, min: 1, max: 1 },
  log: { fn: Math.log10, min: 1, max: 1 },
  log2: { fn: Math.log2, min: 1, max: 1 },
  exp: { fn: Math.exp, min: 1, max: 1 },
  fact: { fn: factorial, min: 1, max: 1 },
  mod: { fn: (a, b) => a % b, min: 2, max: 2 },
  pow: { fn: Math.pow, min: 2, max: 2 },
  ncr: { fn: ncr, min: 2, max: 2 },
  npr: { fn: npr, min: 2, max: 2 },
  gcd: { fn: gcd, min: 2, max: 2 },
  lcm: { fn: lcm, min: 2, max: 2 },
  min: { fn: Math.min, min: 2, max: Infinity },
  max: { fn: Math.max, min: 2, max: Infinity },
};

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error('factorial requires a non-negative integer');
  if (n > 170) throw new Error('factorial too large');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function ncr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new Error('invalid nCr');
  r = Math.min(r, n - r);
  let res = 1;
  for (let i = 0; i < r; i++) res = (res * (n - i)) / (i + 1);
  return res;
}

function npr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new Error('invalid nPr');
  let res = 1;
  for (let i = 0; i < r; i++) res *= n - i;
  return res;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

const MAX_STEPS = 20;

function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'undefined';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const r = parseFloat(n.toPrecision(12));
  if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) return r.toExponential(4);
  return String(r);
}

function applyBin(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
    case '^': return Math.pow(a, b);
    default: throw new Error(`unknown operator ${op}`);
  }
}

interface EvalResult {
  value: number;
  steps: string[];
  error?: string;
}

function evaluate(node: Node, steps: string[]): number {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'unary': {
      const v = evaluate(node.operand, steps);
      const r = -v;
      steps.push(`-(${fmt(v)}) = ${fmt(r)}`);
      return r;
    }
    case 'fact': {
      const v = evaluate(node.operand, steps);
      const r = factorial(v);
      steps.push(`${fmt(v)}! = ${fmt(r)}`);
      return r;
    }
    case 'bin': {
      const l = evaluate(node.left, steps);
      const r = evaluate(node.right, steps);
      const res = applyBin(node.op, l, r);
      steps.push(`${fmt(l)} ${node.op} ${fmt(r)} = ${fmt(res)}`);
      return res;
    }
    case 'fn': {
      const spec = FUNCTIONS[node.name];
      if (!spec) throw new Error(`unknown function "${node.name}"`);
      if (node.args.length < spec.min || node.args.length > spec.max) {
        throw new Error(`${node.name} expects ${spec.min === spec.max ? spec.min : `${spec.min}-${spec.max}`} argument(s)`);
      }
      const args = node.args.map((a) => evaluate(a, steps));
      const res = spec.fn(...args);
      steps.push(`${node.name}(${args.map(fmt).join(', ')}) = ${fmt(res)}`);
      return res;
    }
  }
}

export function safeEval(expr: string): EvalResult {
  const normalized = expr
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '^')
    .replace(/[xX×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/τ/g, 'tau');

  if (!normalized.trim()) return { value: NaN, steps: [], error: 'empty expression' };

  const steps: string[] = [];
  try {
    const parser = new Parser(normalized);
    const node = parser.parse();
    const value = evaluate(node, steps);
    if (typeof value !== 'number' || Number.isNaN(value)) return { value, steps, error: 'invalid result' };
    const trimmed = steps.length > MAX_STEPS ? steps.slice(steps.length - MAX_STEPS) : steps;
    return { value, steps: trimmed, error: undefined };
  } catch (err) {
    return { value: NaN, steps, error: err instanceof Error ? err.message : 'invalid expression' };
  }
}

export function buildResult(expr: string): string {
  const { value, steps, error } = safeEval(expr);
  if (error || Number.isNaN(value)) {
    return `\`${expr}\` — **${error ?? 'invalid expression'}**`;
  }
  const lines = [`\`${expr}\``];
  if (steps.length > 0) {
    lines.push('Working:');
    for (const s of steps) lines.push(`• ${s}`);
    if (steps.length >= MAX_STEPS) lines.push(`• … (more steps omitted)`);
  }
  lines.push(`Result: **${fmt(value)}**`);
  return lines.join('\n');
}

async function execute(interaction: ChatInputCommandInteraction, _app: App): Promise<void> {
  const expr = interaction.options.getString('expression', true);
  await v2Reply(interaction, buildResult(expr), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], _app: App): Promise<void> {
  const expr = args.join(' ');
  if (!expr) {
    await v2MessageReply(message, { content: 'Usage: `!calc <expression>`' });
    return;
  }
  await v2MessageReply(message, { content: buildResult(expr) });
}

const command: BotCommand = {
  name: 'calculator',
  category: 'utility',
  description: 'Evaluate a math expression with working out',
  usage: '!calculator <expression>',
  details: 'Shows step-by-step working. Supports +, -, *, /, %, ^, roots, trig, logs, factorials, and constants like pi.',
  data,
  permissions: [],
  aliases: ['calc'],
  execute,
  prefixExecute,
};

export default command;
