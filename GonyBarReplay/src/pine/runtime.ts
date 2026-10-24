import type { Candle, LinePoint } from '@/types';

type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'array'; values: Expr[] }
  | { kind: 'unary'; op: '+' | '-' | 'not'; value: Expr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '>=' | '<' | '<=' | 'and' | 'or'; left: Expr; right: Expr }
  | { kind: 'conditional'; condition: Expr; yes: Expr; no: Expr }
  | { kind: 'call'; name: string; args: { name?: string; value: Expr }[] }
  | { kind: 'index'; value: Expr; index: Expr };

interface Token {
  value: string;
  position: number;
}

interface Assignment {
  kind: 'assignment';
  name: string;
  expression: Expr;
  line: number;
}

interface Plot {
  kind: 'plot';
  expression: Expr;
  title: string;
  color: Expr;
  lineWidth: 1 | 2 | 3 | 4;
  line: number;
}

type Statement = Assignment | Plot;
type PineAtom = number | boolean | string;
type PineArray = { kind: 'array'; values: PineAtom[] };
type PineSeries = number[] | boolean[];
type SeriesValue = PineAtom | PineSeries | PineArray;
export type PinePlot = { title: string; color: string; lineWidth: 1 | 2 | 3 | 4; points: LinePoint[] };

const COLORS: Record<string, string> = {
  'color.aqua': '#00ffff',
  'color.black': '#000000',
  'color.blue': '#2196f3',
  'color.fuchsia': '#e040fb',
  'color.gray': '#787b86',
  'color.green': '#4caf50',
  'color.lime': '#00e676',
  'color.maroon': '#880e4f',
  'color.navy': '#311b92',
  'color.olive': '#808000',
  'color.orange': '#ff9800',
  'color.purple': '#9c27b0',
  'color.red': '#f23645',
  'color.silver': '#b2b5be',
  'color.teal': '#089981',
  'color.white': '#ffffff',
  'color.yellow': '#ffeb3b',
};

const DEFAULT_COLORS = ['#7c9cff', '#ff9800', '#b388ff', '#26a69a', '#ef5350', '#fdd835'];
const isLineWidth = (value: number): value is 1 | 2 | 3 | 4 => Number.isInteger(value) && value >= 1 && value <= 4;

function tokenize(source: string, line: number): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    if (/\s/.test(source[position])) {
      position++;
      continue;
    }
    const rest = source.slice(position);
    const color = /^#[\da-fA-F]{6}(?:[\da-fA-F]{2})?/.exec(rest);
    if (color) {
      tokens.push({ value: JSON.stringify(color[0]), position });
      position += color[0].length;
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (number) {
      tokens.push({ value: number[0], position });
      position += number[0].length;
      continue;
    }
    if (source[position] === '"' || source[position] === "'") {
      const quote = source[position];
      let value = '';
      const start = position++;
      let closed = false;
      while (position < source.length) {
        const char = source[position++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\' && position < source.length && (source[position] === quote || source[position] === '\\')) {
          value += source[position++];
        } else {
          value += char;
        }
      }
      if (!closed) throw new Error(`Line ${line}: unterminated string.`);
      tokens.push({ value: JSON.stringify(value), position: start });
      continue;
    }
    const identifier = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/.exec(rest);
    if (identifier) {
      tokens.push({ value: identifier[0], position });
      position += identifier[0].length;
      continue;
    }
    const operator = /^(?:==|!=|>=|<=|[()+\-*/%,=[\]?:<>])/.exec(rest);
    if (operator) {
      tokens.push({ value: operator[0], position });
      position += operator[0].length;
      continue;
    }
    if ('()+-*/%,=[]'.includes(source[position])) {
      tokens.push({ value: source[position], position });
      position++;
      continue;
    }
    throw new Error(`Line ${line}: unsupported character "${source[position]}".`);
  }
  return tokens;
}

function parseExpression(tokens: Token[], line: number): Expr {
  let cursor = 0;
  const peek = () => tokens[cursor]?.value;
  const take = () => tokens[cursor++];

  const primary = (): Expr => {
    const token = take();
    if (!token) throw new Error(`Line ${line}: expected an expression.`);
    if (/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token.value)) {
      return { kind: 'number', value: Number(token.value) };
    }
    if (token.value.startsWith('"')) return { kind: 'string', value: JSON.parse(token.value) as string };
    if (token.value === '[') {
      const values: Expr[] = [];
      while (peek() !== ']') {
        if (cursor >= tokens.length) throw new Error(`Line ${line}: expected "]".`);
        values.push(conditional());
        if (peek() !== ',') break;
        take();
      }
      if (take()?.value !== ']') throw new Error(`Line ${line}: expected "," or "]".`);
      return { kind: 'array', values };
    }
    if (token.value === '(') {
      const value = conditional();
      if (take()?.value !== ')') throw new Error(`Line ${line}: expected ")".`);
      return value;
    }
    if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(token.value)) {
      throw new Error(`Line ${line}: expected a value, got "${token.value}".`);
    }
    let value: Expr = { kind: 'identifier', name: token.value };
    if (peek() === '(') {
      take();
      const args: { name?: string; value: Expr }[] = [];
      while (peek() !== ')') {
        if (cursor >= tokens.length) throw new Error(`Line ${line}: expected ")".`);
        let name: string | undefined;
        if (/^[A-Za-z_]\w*$/.test(peek() ?? '') && tokens[cursor + 1]?.value === '=') {
          name = take().value;
          take();
        }
        args.push({ name, value: conditional() });
        if (peek() !== ',') break;
        take();
      }
      if (take()?.value !== ')') throw new Error(`Line ${line}: expected "," or ")".`);
      value = { kind: 'call', name: token.value, args };
    }
    while (peek() === '[') {
      take();
      const index = addSub();
      if (take()?.value !== ']') throw new Error(`Line ${line}: expected "]".`);
      value = { kind: 'index', value, index };
    }
    return value;
  };

  const unary = (): Expr => {
    if (peek() === '+' || peek() === '-' || peek() === 'not') {
      const op = take().value as '+' | '-' | 'not';
      return { kind: 'unary', op, value: unary() };
    }
    return primary();
  };
  const multiply = (): Expr => {
    let value = unary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = take().value as '*' | '/' | '%';
      value = { kind: 'binary', op, left: value, right: unary() };
    }
    return value;
  };
  const addSub = (): Expr => {
    let value = multiply();
    while (peek() === '+' || peek() === '-') {
      const op = take().value as '+' | '-';
      value = { kind: 'binary', op, left: value, right: multiply() };
    }
    return value;
  };
  const comparison = (): Expr => {
    let value = addSub();
    while (['==', '!=', '>', '>=', '<', '<='].includes(peek() ?? '')) {
      const op = take().value as '==' | '!=' | '>' | '>=' | '<' | '<=';
      value = { kind: 'binary', op, left: value, right: addSub() };
    }
    return value;
  };
  const logicalAnd = (): Expr => {
    let value = comparison();
    while (peek() === 'and') {
      take();
      value = { kind: 'binary', op: 'and', left: value, right: comparison() };
    }
    return value;
  };
  const logicalOr = (): Expr => {
    let value = logicalAnd();
    while (peek() === 'or') {
      take();
      value = { kind: 'binary', op: 'or', left: value, right: logicalAnd() };
    }
    return value;
  };
  function conditional(): Expr {
    const condition = logicalOr();
    if (peek() !== '?') return condition;
    take();
    const yes = conditional();
    if (take()?.value !== ':') throw new Error(`Line ${line}: expected ":" in conditional expression.`);
    return { kind: 'conditional', condition, yes, no: conditional() };
  }

  const expression = conditional();
  if (cursor !== tokens.length) throw new Error(`Line ${line}: unexpected "${tokens[cursor].value}".`);
  return expression;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== '\\') {
      quote = quote === line[i] ? null : quote ?? line[i];
    }
    if (quote == null && line[i] === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function delimiterDepth(line: string): number {
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== '\\') {
      quote = quote === line[i] ? null : quote ?? line[i];
    }
    if (quote != null) continue;
    if (line[i] === '(' || line[i] === '[') depth++;
    if (line[i] === ')' || line[i] === ']') depth--;
  }
  return depth;
}

function parseScript(source: string): Statement[] {
  const statements: Statement[] = [];
  let buffered = '';
  let balance = 0;
  let startLine = 1;
  const parseStatement = () => {
    const text = buffered.trim();
    const line = startLine;
    buffered = '';
    balance = 0;
    if (!text) return;
    if (/^(?:indicator|study)\s*\(/.test(text)) return;
    if (/^strategy\s*\(/.test(text)) throw new Error(`Line ${line}: strategy scripts are not supported; use indicator().`);
    if (/^(?:type|method|for|while|if|else|switch)\b/.test(text)) {
      throw new Error(`Line ${line}: ${text.split(/\s|=/, 1)[0]} declarations and control flow are not supported by this Pine runtime.`);
    }

    const tokens = tokenize(text, line);
    if (!tokens.length) return;
    if (/^[A-Za-z_]\w*$/.test(tokens[0].value) && tokens[1]?.value === '=') {
      const name = tokens[0].value;
      if (['open', 'high', 'low', 'close', 'volume', 'time'].includes(name)) {
        throw new Error(`Line ${line}: "${name}" is a built-in series and cannot be reassigned.`);
      }
      statements.push({ kind: 'assignment', name, expression: parseExpression(tokens.slice(2), line), line });
      return;
    }
    const expression = parseExpression(tokens, line);
    if (expression.kind !== 'call' || expression.name !== 'plot') {
      throw new Error(`Line ${line}: expected a variable assignment or plot(...).`);
    }
    const valueArg = expression.args.find((arg) => arg.name == null) ?? expression.args.find((arg) => arg.name === 'series');
    if (!valueArg) throw new Error(`Line ${line}: plot() requires a series value.`);
    const titleArg = expression.args.find((arg) => arg.name === 'title');
    if (titleArg && titleArg.value.kind !== 'string') throw new Error(`Line ${line}: plot title must be a string literal.`);
    const colorArg = expression.args.find((arg) => arg.name === 'color');
    const widthArg = expression.args.find((arg) => arg.name === 'linewidth');
    const unsupportedArg = expression.args.find((arg) => ![undefined, 'series', 'title', 'color', 'linewidth'].includes(arg.name));
    if (unsupportedArg) throw new Error(`Line ${line}: unsupported plot argument "${unsupportedArg.name}".`);
    const plotCount = statements.filter((statement) => statement.kind === 'plot').length;
    const title = titleArg?.value.kind === 'string' ? titleArg.value.value : `Plot ${plotCount + 1}`;
    const color: Expr = colorArg?.value ?? { kind: 'string', value: DEFAULT_COLORS[plotCount % DEFAULT_COLORS.length] };
    if (color.kind !== 'string' && color.kind !== 'identifier') throw new Error(`Line ${line}: plot color must be a string, color.* constant, or color input variable.`);
    if (color.kind === 'identifier' && color.name.startsWith('color.') && !COLORS[color.name]) {
      throw new Error(`Line ${line}: unsupported color constant "${color.name}".`);
    }
    if (widthArg && widthArg.value.kind !== 'number') throw new Error(`Line ${line}: plot linewidth must be a number literal.`);
    const lineWidth = widthArg?.value.kind === 'number' ? widthArg.value.value : 1;
    if (!isLineWidth(lineWidth)) throw new Error(`Line ${line}: plot linewidth must be from 1 to 4.`);
    statements.push({ kind: 'plot', expression: valueArg.value, title, color, lineWidth, line });
  };

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = index + 1;
    if (/^\s*\/\/@\s*version\s*=\s*[56]\s*$/.test(rawLine)) continue;
    if (/^\s*\/\/@\s*version\b/.test(rawLine)) throw new Error(`Line ${line}: only Pine versions 5 and 6 are supported.`);
    const text = stripComment(rawLine).trim();
    if (!text) continue;
    if (!buffered) startLine = line;
    buffered += `${buffered ? ' ' : ''}${text}`;
    balance += delimiterDepth(text);
    if (balance <= 0) parseStatement();
  }
  if (buffered) throw new Error(`Line ${startLine}: expected a closing ")" or "]".`);
  if (!statements.some((statement) => statement.kind === 'plot')) {
    throw new Error('Add at least one plot(...) call to run this indicator.');
  }
  return statements;
}

const isSeries = (value: SeriesValue): value is PineSeries => Array.isArray(value);
const isNumericSeries = (value: SeriesValue): value is number[] => Array.isArray(value) && value.every((v) => typeof v === 'number');
const isBooleanSeries = (value: SeriesValue): value is boolean[] => Array.isArray(value) && value.every((v) => typeof v === 'boolean');

function asNumber(value: SeriesValue, line: number): number {
  if (typeof value !== 'number') throw new Error(`Line ${line}: expected a numeric value.`);
  return value;
}

function asBoolean(value: SeriesValue, line: number): boolean {
  if (typeof value !== 'boolean') throw new Error(`Line ${line}: expected a boolean value.`);
  return value;
}

function evaluate(statements: Statement[], candles: Candle[]): PinePlot[] {
  const size = candles.length;
  const env = new Map<string, SeriesValue>([
    ['open', candles.map((c) => c.open)],
    ['high', candles.map((c) => c.high)],
    ['low', candles.map((c) => c.low)],
    ['close', candles.map((c) => c.close)],
    ['volume', candles.map((c) => c.volume)],
    ['time', candles.map((c) => c.time)],
  ]);
  const plots: PinePlot[] = [];

  const evaluateExpr = (expr: Expr, line: number): SeriesValue => {
    switch (expr.kind) {
      case 'number': return expr.value;
      case 'string': return expr.value;
      case 'boolean': return expr.value;
      case 'array': {
        const values = expr.values.map((value) => evaluateExpr(value, line));
        if (values.some((value) => typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')) {
          throw new Error(`Line ${line}: array literals may only contain constant strings, numbers, or booleans.`);
        }
        return { kind: 'array', values: values as PineAtom[] };
      }
      case 'identifier': {
        if (expr.name === 'na') return Number.NaN;
        if (expr.name === 'true') return true;
        if (expr.name === 'false') return false;
        const value = env.get(expr.name) ?? COLORS[expr.name];
        if (value === undefined) throw new Error(`Line ${line}: unknown identifier "${expr.name}".`);
        return value;
      }
      case 'unary': {
        const value = evaluateExpr(expr.value, line);
        if (expr.op === 'not') {
          const apply = (v: boolean) => !v;
          return isBooleanSeries(value) ? value.map(apply) : apply(asBoolean(value, line));
        }
        const apply = (n: number) => expr.op === '-' ? -n : n;
        return isNumericSeries(value) ? value.map(apply) : apply(asNumber(value, line));
      }
      case 'binary': {
        const left = evaluateExpr(expr.left, line);
        const right = evaluateExpr(expr.right, line);
        const comparison = (a: PineAtom, b: PineAtom): boolean => {
          switch (expr.op) {
            case '==': return a === b;
            case '!=': return a !== b;
            case '>': return asNumber(a, line) > asNumber(b, line);
            case '>=': return asNumber(a, line) >= asNumber(b, line);
            case '<': return asNumber(a, line) < asNumber(b, line);
            case '<=': return asNumber(a, line) <= asNumber(b, line);
            default: throw new Error(`Line ${line}: invalid comparison.`);
          }
        };
        if (['==', '!=', '>', '>=', '<', '<='].includes(expr.op)) {
          if (isSeries(left) || isSeries(right)) {
            if ((isSeries(left) && isBooleanSeries(left)) || (isSeries(right) && isBooleanSeries(right))) {
              throw new Error(`Line ${line}: boolean series comparisons are not supported yet.`);
            }
            const a = isNumericSeries(left) ? left : Array(size).fill(asNumber(left, line));
            const b = isNumericSeries(right) ? right : Array(size).fill(asNumber(right, line));
            return a.map((value, index) => comparison(value, b[index]));
          }
          if (typeof left === 'object' || typeof right === 'object') throw new Error(`Line ${line}: arrays cannot be compared.`);
          return comparison(left, right);
        }
        if (expr.op === 'and' || expr.op === 'or') {
          const combine = (a: boolean, b: boolean) => expr.op === 'and' ? a && b : a || b;
          if (isSeries(left) || isSeries(right)) {
            if ((isSeries(left) && !isBooleanSeries(left)) || (isSeries(right) && !isBooleanSeries(right))) {
              throw new Error(`Line ${line}: logical operators require boolean values.`);
            }
            const a = isBooleanSeries(left) ? left : Array(size).fill(asBoolean(left, line));
            const b = isBooleanSeries(right) ? right : Array(size).fill(asBoolean(right, line));
            return a.map((value, index) => combine(value, b[index]));
          }
          return combine(asBoolean(left, line), asBoolean(right, line));
        }
        if ((isSeries(left) && !isNumericSeries(left)) || (isSeries(right) && !isNumericSeries(right))) {
          throw new Error(`Line ${line}: arithmetic requires numeric values.`);
        }
        const a = isNumericSeries(left) ? left : Array(size).fill(asNumber(left, line));
        const b = isNumericSeries(right) ? right : Array(size).fill(asNumber(right, line));
        return a.map((x, i) => {
          switch (expr.op) {
            case '+': return x + b[i];
            case '-': return x - b[i];
            case '*': return x * b[i];
            case '/': return x / b[i];
            case '%': return x % b[i];
            default: return Number.NaN;
          }
        });
      }
      case 'conditional': {
        const condition = evaluateExpr(expr.condition, line);
        if (isBooleanSeries(condition)) {
          const yes = evaluateExpr(expr.yes, line);
          const no = evaluateExpr(expr.no, line);
          const values = (value: SeriesValue) => {
            if (typeof value === 'object' && !Array.isArray(value)) {
              throw new Error(`Line ${line}: ternary expressions cannot return array literals.`);
            }
            return isSeries(value) ? value : Array(size).fill(value);
          };
          const valueType = (value: SeriesValue) => isNumericSeries(value) ? 'number' : isBooleanSeries(value) ? 'boolean' : typeof value;
          if (valueType(yes) !== valueType(no)) throw new Error(`Line ${line}: ternary branches must return matching value types.`);
          const y = values(yes);
          const n = values(no);
          const result = condition.map((test, index) => test ? y[index] : n[index]);
          if (result.every((value) => typeof value === 'number')) return result as number[];
          if (result.every((value) => typeof value === 'boolean')) return result as boolean[];
          throw new Error(`Line ${line}: series ternary branches must return numeric or boolean values.`);
        }
        return asBoolean(condition, line) ? evaluateExpr(expr.yes, line) : evaluateExpr(expr.no, line);
      }
      case 'index': {
        const value = evaluateExpr(expr.value, line);
        const offset = asNumber(evaluateExpr(expr.index, line), line);
        if (!Number.isInteger(offset) || offset < 0) throw new Error(`Line ${line}: history offsets must be non-negative integers.`);
        if (typeof value === 'object' && !Array.isArray(value)) {
          if (offset >= value.values.length) return Number.NaN;
          return value.values[value.values.length - offset - 1];
        }
        if (isNumericSeries(value)) return value.map((_, i) => i >= offset ? value[i - offset] : Number.NaN);
        if (isBooleanSeries(value)) return value.map((_, i) => i >= offset ? value[i - offset] : false);
        throw new Error(`Line ${line}: history indexing requires a series.`);
      }
      case 'call': {
        const positional = expr.args.filter((arg) => arg.name == null).map((arg) => evaluateExpr(arg.value, line));
        const named = new Map(expr.args.filter((arg) => arg.name != null).map((arg) => [arg.name!, evaluateExpr(arg.value, line)]));
        const arg = (position: number, name: string) => positional[position] ?? named.get(name);
        if (['input.int', 'input.float', 'input.string', 'input.bool', 'input.color'].includes(expr.name)) {
          const value = arg(0, 'defval');
          if (value === undefined || isSeries(value) || (typeof value === 'object' && value.kind === 'array')) {
            throw new Error(`Line ${line}: ${expr.name} requires a constant default value.`);
          }
          if ((expr.name === 'input.int' || expr.name === 'input.float') && typeof value !== 'number') {
            throw new Error(`Line ${line}: ${expr.name} requires a numeric default value.`);
          }
          if (expr.name === 'input.string') {
            if (typeof value !== 'string') throw new Error(`Line ${line}: input.string requires a string default value.`);
            const options = named.get('options');
            if (options != null && (typeof options !== 'object' || !('kind' in options) || options.kind !== 'array' || options.values.some((option) => typeof option !== 'string'))) {
              throw new Error(`Line ${line}: input.string options must be an array of string literals.`);
            }
          }
          if (expr.name === 'input.bool' && typeof value !== 'boolean') throw new Error(`Line ${line}: input.bool requires a boolean default value.`);
          if (expr.name === 'input.color' && typeof value !== 'string') throw new Error(`Line ${line}: input.color requires a color default value.`);
          return value;
        }
        if (expr.name.startsWith('ta.')) {
          if (!['ta.sma', 'ta.ema', 'ta.rsi'].includes(expr.name)) {
            throw new Error(`Line ${line}: unsupported function "${expr.name}".`);
          }
          const input = arg(0, 'source');
          const periodValue = arg(1, 'length');
          if (!input || !isNumericSeries(input)) throw new Error(`Line ${line}: ${expr.name} requires a numeric series as its first argument.`);
          const period = periodValue == null ? Number.NaN : asNumber(periodValue, line);
          if (!Number.isInteger(period) || period < 1 || period > 5000) {
            throw new Error(`Line ${line}: ${expr.name} length must be an integer from 1 to 5000.`);
          }
          if (expr.name === 'ta.sma') {
            const out = Array(size).fill(Number.NaN);
            let sum = 0;
            for (let i = 0; i < size; i++) {
              sum += input[i];
              if (i >= period) sum -= input[i - period];
              if (i >= period - 1) out[i] = sum / period;
            }
            return out;
          }
          if (expr.name === 'ta.ema') {
            const out = Array(size).fill(Number.NaN);
            if (size < period) return out;
            const alpha = 2 / (period + 1);
            let previous = input.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
            out[period - 1] = previous;
            for (let i = period; i < size; i++) {
              previous = input[i] * alpha + previous * (1 - alpha);
              out[i] = previous;
            }
            return out;
          }
          if (expr.name === 'ta.rsi') {
            const out = Array(size).fill(Number.NaN);
            if (size <= period) return out;
            let gain = 0;
            let loss = 0;
            for (let i = 1; i <= period; i++) {
              const change = input[i] - input[i - 1];
              gain += Math.max(change, 0);
              loss += Math.max(-change, 0);
            }
            gain /= period;
            loss /= period;
            const value = () => loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
            out[period] = value();
            for (let i = period + 1; i < size; i++) {
              const change = input[i] - input[i - 1];
              gain = (gain * (period - 1) + Math.max(change, 0)) / period;
              loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
              out[i] = value();
            }
            return out;
          }
        }
        if (expr.name.startsWith('math.')) {
          const fn = expr.name === 'math.abs' ? Math.abs
            : expr.name === 'math.max' ? Math.max
              : expr.name === 'math.min' ? Math.min
                : expr.name === 'math.round' ? Math.round : null;
          if (!fn) throw new Error(`Line ${line}: unsupported function "${expr.name}".`);
          const values = expr.args.map((entry) => evaluateExpr(entry.value, line));
          const validArity = expr.name === 'math.abs' || expr.name === 'math.round'
            ? values.length === 1
            : values.length >= 2;
          if (!validArity) throw new Error(`Line ${line}: invalid number of arguments for ${expr.name}.`);
          if (values.some((value) => typeof value !== 'number' && !isNumericSeries(value))) throw new Error(`Line ${line}: ${expr.name} requires numeric values.`);
          if (values.length === 0) throw new Error(`Line ${line}: ${expr.name} requires at least one argument.`);
          const series = values.filter(isNumericSeries);
          const length = series[0]?.length ?? size;
          return Array.from({ length }, (_, i) => {
            const numbers = values.map((value) => isNumericSeries(value) ? value[i] : value as number);
            return fn(...numbers);
          });
        }
        throw new Error(`Line ${line}: unsupported function "${expr.name}".`);
      }
    }
  };

  for (const statement of statements) {
    const value = evaluateExpr(statement.kind === 'assignment' ? statement.expression : statement.expression, statement.line);
    if (statement.kind === 'assignment') {
      env.set(statement.name, value);
      continue;
    }
    if (typeof value !== 'number' && !isNumericSeries(value)) throw new Error(`Line ${statement.line}: plot() requires a numeric series.`);
    const values = isSeries(value) ? value : Array(size).fill(value);
    const plotColor = evaluateExpr(statement.color, statement.line);
    if (typeof plotColor !== 'string') throw new Error(`Line ${statement.line}: plot color must resolve to a color string.`);
    plots.push({
      title: statement.title,
      color: plotColor,
      lineWidth: statement.lineWidth,
      points: values.flatMap((v, i) => Number.isFinite(v) ? [{ time: candles[i].time, value: v }] : []),
    });
  }
  return plots;
}

export function compilePineScript(source: string): (candles: Candle[]) => PinePlot[] {
  const statements = parseScript(source);
  return (candles) => evaluate(statements, candles);
}

export function runPineScript(source: string, candles: Candle[]): PinePlot[] {
  return compilePineScript(source)(candles);
}
