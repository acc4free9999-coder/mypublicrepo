import type { Candle, LinePoint } from '@/types';

type Argument = { name?: string; value: Expr };
type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'identifier'; name: string }
  | { kind: 'array'; values: Expr[] }
  | { kind: 'member'; object: Expr; property: string }
  | { kind: 'unary'; op: string; value: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'conditional'; condition: Expr; yes: Expr; no: Expr }
  | { kind: 'call'; callee: Expr; args: Argument[] }
  | { kind: 'index'; value: Expr; index: Expr }
  | { kind: 'switch'; selector?: Expr; branches: { test?: Expr; body: Statement[] }[] };
type Statement =
  | { kind: 'assignment'; name: string; expression: Expr; reassign: boolean; persistent: boolean; line: number }
  | { kind: 'tupleAssignment'; names: string[]; expression: Expr; line: number }
  | { kind: 'expression'; expression: Expr; line: number }
  | { kind: 'plot'; expression: Expr; title: string; color: Expr; lineWidth: 1 | 2 | 3 | 4; line: number }
  | { kind: 'if'; condition: Expr; yes: Statement[]; no: Statement[]; line: number }
  | { kind: 'for'; name: string; start: Expr; end: Expr; body: Statement[]; line: number }
  | { kind: 'forEach'; name: string; collection: Expr; body: Statement[]; line: number }
  | { kind: 'while'; condition: Expr; body: Statement[]; line: number }
  | { kind: 'break' | 'continue'; line: number };
type PineValue = number | boolean | string | PineArray | PineRecord | PineHandle;
type PineArray = { kind: 'array'; values: PineValue[] };
type PineRecord = { kind: 'record'; type: string; fields: Map<string, PineValue> };
type PineHandle = { kind: 'handle'; drawing: PineDrawing; deleted: boolean };
type Parameter = { name: string; type: string; defaultValue?: Expr };
type PineMethod = { parameters: Parameter[]; body: Statement[]; method: boolean };
type Program = {
  statements: Statement[];
  types: Map<string, Parameter[]>;
  methods: Map<string, PineMethod>;
  plotCount: number;
  inputBindings: WeakMap<Expr, string>;
  inputs: PineInputDefinition[];
};
type Token = { value: string };
export type PinePlot = { title: string; color: string; lineWidth: 1 | 2 | 3 | 4; points: LinePoint[] };
export type PineProgress = { completedBars: number; totalBars: number };
export type PineInputValue = number | boolean | string;
export type PineInputDefinition = {
  id: string;
  title: string;
  type: 'int' | 'float' | 'string' | 'bool' | 'color' | 'timeframe' | 'symbol' | 'session';
  defaultValue: PineInputValue;
  min?: number;
  max?: number;
  options?: string[];
  group?: string;
};
export type PineDrawing =
  | { id: number; kind: 'line'; x1: number; y1: number; x2: number; y2: number; xloc: string; extend: string; color: string; style: string; width: number }
  | { id: number; kind: 'box'; left: number; top: number; right: number; bottom: number; xloc: string; extend: string; borderColor: string; borderStyle: string; borderWidth: number; bgcolor: string; text?: string; textColor?: string };
// Keep the existing plot-array API; drawings are the final live objects for this prefix.
export type PineResult = PinePlot[] & { drawings: PineDrawing[] };

const COLORS: Record<string, string> = {
  'color.aqua': '#00ffff', 'color.black': '#000000', 'color.blue': '#2196f3',
  'color.fuchsia': '#e040fb', 'color.gray': '#787b86', 'color.green': '#4caf50',
  'color.lime': '#00e676', 'color.maroon': '#880e4f', 'color.navy': '#311b92',
  'color.olive': '#808000', 'color.orange': '#ff9800', 'color.purple': '#9c27b0',
  'color.red': '#f23645', 'color.silver': '#b2b5be', 'color.teal': '#089981',
  'color.white': '#ffffff', 'color.yellow': '#ffeb3b',
};
const CONSTANTS: Record<string, string> = {
  ...COLORS,
  'plot.style_line': 'line', 'plot.style_stepline': 'stepline', 'plot.style_stepline_diamond': 'stepline_diamond',
  'line.style_solid': 'solid', 'line.style_dashed': 'dashed', 'line.style_dotted': 'dotted',
  'line.style_arrow_left': 'arrow_left', 'line.style_arrow_right': 'arrow_right', 'line.style_arrow_both': 'arrow_both',
  'xloc.bar_index': 'bar_index', 'xloc.bar_time': 'bar_time',
  'extend.none': 'none', 'extend.left': 'left', 'extend.right': 'right', 'extend.both': 'both',
  'syminfo.ticker': 'CHART', 'syminfo.tickerid': 'CHART',
  'barmerge.gaps_off': 'gaps_off', 'barmerge.gaps_on': 'gaps_on',
  'barmerge.lookahead_off': 'lookahead_off', 'barmerge.lookahead_on': 'lookahead_on',
  'hline.style_solid': 'solid', 'hline.style_dashed': 'dashed', 'hline.style_dotted': 'dotted',
  'shape.labelup': 'labelup', 'shape.labeldown': 'labeldown', 'location.absolute': 'absolute',
  'display.none': 'none', 'display.all': 'all', 'display.pane': 'pane', 'display.data_window': 'data_window', 'display.status_line': 'status_line',
  'position.top_left': 'top_left', 'position.top_center': 'top_center', 'position.top_right': 'top_right',
  'position.middle_left': 'middle_left', 'position.middle_center': 'middle_center', 'position.middle_right': 'middle_right',
  'position.bottom_left': 'bottom_left', 'position.bottom_center': 'bottom_center', 'position.bottom_right': 'bottom_right',
  'size.auto': 'auto', 'size.tiny': 'tiny', 'size.small': 'small', 'size.normal': 'normal', 'size.large': 'large', 'size.huge': 'huge',
  'text.align_left': 'left', 'text.align_center': 'center', 'text.align_right': 'right',
  'text.align_top': 'top', 'text.align_bottom': 'bottom',
  'label.style_none': 'none', 'label.style_xcross': 'xcross', 'label.style_cross': 'cross', 'label.style_triangleup': 'triangleup',
  'label.style_triangledown': 'triangledown', 'label.style_flag': 'flag', 'label.style_circle': 'circle',
  'label.style_arrowup': 'arrowup', 'label.style_arrowdown': 'arrowdown', 'label.style_label_up': 'label_up',
  'label.style_label_down': 'label_down', 'label.style_label_left': 'label_left', 'label.style_label_right': 'label_right',
  'label.style_label_lower_left': 'label_lower_left', 'label.style_label_lower_right': 'label_lower_right',
  'label.style_label_upper_left': 'label_upper_left', 'label.style_label_upper_right': 'label_upper_right',
  'label.style_label_center': 'label_center', 'yloc.price': 'price', 'yloc.abovebar': 'abovebar', 'yloc.belowbar': 'belowbar',
  'alert.freq_once_per_bar': 'once_per_bar', 'alert.freq_once_per_bar_close': 'once_per_bar_close', 'alert.freq_all': 'all',
};
const DEFAULT_COLORS = ['#7c9cff', '#ff9800', '#b388ff', '#26a69a', '#ef5350', '#fdd835'];
const MAX_TOTAL_STEPS = 50_000_000;
const MAX_STEPS_PER_BAR = 100_000;
const MAX_EXECUTION_BARS = 5_000;
const MAX_LOOP = 10_000;
const MAX_DRAWINGS_PER_KIND = 500;
const MAX_ARRAY = 100_000;
const PINE_TYPE_NAME = '(?:[A-Za-z_]\\w*\\.)*[A-Za-z_]\\w*';
const PINE_DECLARATION_TYPE = `(?:array\\s*<\\s*${PINE_TYPE_NAME}\\s*>|${PINE_TYPE_NAME})`;
const isLineWidth = (value: number): value is 1 | 2 | 3 | 4 => Number.isInteger(value) && value >= 1 && value <= 4;
const fail = (line: number, message: string): never => { throw new Error(`Line ${line}: ${message}`); };

function tokenize(source: string, line: number): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    if (/\s/.test(source[position])) { position++; continue; }
    const rest = source.slice(position);
    const color = /^#[\da-fA-F]{6}(?:[\da-fA-F]{2})?/.exec(rest);
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (color || number) {
      const match = (color ?? number)![0];
      tokens.push({ value: color ? JSON.stringify(match) : match });
      position += match.length;
      continue;
    }
    if (source[position] === '"' || source[position] === "'") {
      const quote = source[position++];
      let value = '';
      let closed = false;
      while (position < source.length) {
        const char = source[position++];
        if (char === quote) { closed = true; break; }
        if (char === '\\' && position < source.length && (source[position] === quote || source[position] === '\\')) value += source[position++];
        else value += char;
      }
      if (!closed) fail(line, 'unterminated string.');
      tokens.push({ value: JSON.stringify(value) });
      continue;
    }
    const match = /^(?:[A-Za-z_]\w*|==|!=|>=|<=|[()+\-*/%,=[\]?:<>.])/.exec(rest);
    if (!match) fail(line, `unsupported character "${source[position]}".`);
    tokens.push({ value: match![0] });
    position += match![0].length;
  }
  return tokens;
}

function expressionPath(expr: Expr): string | undefined {
  if (expr.kind === 'identifier') return expr.name;
  if (expr.kind === 'member') {
    const parent = expressionPath(expr.object);
    return parent ? `${parent}.${expr.property}` : undefined;
  }
}

function parseExpression(tokens: Token[], line: number): Expr {
  let cursor = 0;
  const peek = () => tokens[cursor]?.value;
  const take = () => tokens[cursor++]?.value;
  const expect = (value: string) => { if (take() !== value) fail(line, `expected "${value}".`); };
  const primary = (): Expr => {
    const token = take();
    if (!token) return fail(line, 'expected an expression.');
    let value: Expr;
    if (/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) value = { kind: 'number', value: Number(token) };
    else if (token.startsWith('"')) value = { kind: 'string', value: JSON.parse(token) as string };
    else if (token === '[') {
      const values: Expr[] = [];
      while (peek() !== ']') {
        values.push(conditional());
        if (peek() !== ',') break;
        take();
      }
      expect(']');
      value = { kind: 'array', values };
    } else if (token === '(') {
      value = conditional();
      expect(')');
    } else if (/^[A-Za-z_]\w*$/.test(token)) value = { kind: 'identifier', name: token };
    else return fail(line, `expected a value, got "${token}".`);
    while (['[', '.', '('].includes(peek() ?? '')) {
      const suffix = take();
      if (suffix === '[') {
        const index = conditional();
        expect(']');
        value = { kind: 'index', value, index };
      } else if (suffix === '.') {
        const property = take();
        if (!property || !/^[A-Za-z_]\w*$/.test(property)) return fail(line, 'expected a property name after ".".');
        value = { kind: 'member', object: value, property };
      } else {
        const args: Argument[] = [];
        while (peek() !== ')') {
          let name: string | undefined;
          if (/^[A-Za-z_]\w*$/.test(peek() ?? '') && tokens[cursor + 1]?.value === '=') { name = take(); take(); }
          args.push({ name, value: conditional() });
          if (peek() !== ',') break;
          take();
        }
        expect(')');
        value = { kind: 'call', callee: value, args };
      }
    }
    return value;
  };
  const unary = (): Expr => {
    if (['+', '-', 'not'].includes(peek() ?? '')) return { kind: 'unary', op: take()!, value: unary() };
    return primary();
  };
  const binary = (next: () => Expr, operators: string[]): Expr => {
    let value = next();
    while (operators.includes(peek() ?? '')) value = { kind: 'binary', op: take()!, left: value, right: next() };
    return value;
  };
  const multiply = () => binary(unary, ['*', '/', '%']);
  const add = () => binary(multiply, ['+', '-']);
  const compare = () => binary(add, ['==', '!=', '>', '>=', '<', '<=']);
  const and = () => binary(compare, ['and']);
  const or = () => binary(and, ['or']);
  function conditional(): Expr {
    const condition = or();
    if (peek() !== '?') return condition;
    take();
    const yes = conditional();
    expect(':');
    return { kind: 'conditional', condition, yes, no: conditional() };
  }
  const expression = conditional();
  if (cursor !== tokens.length) fail(line, `unexpected "${peek()}".`);
  return expression;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== '\\') quote = quote === line[i] ? null : quote ?? line[i];
    if (quote == null && line[i] === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function delimiterDepth(line: string): number {
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== '\\') quote = quote === line[i] ? null : quote ?? line[i];
    if (quote != null) continue;
    if (line[i] === '(' || line[i] === '[') depth++;
    if (line[i] === ')' || line[i] === ']') depth--;
  }
  return depth;
}

function splitParameters(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

function parseScript(source: string, requireRenderable = true): Program {
  const program: Program = { statements: [], types: new Map(), methods: new Map(), plotCount: 0, inputBindings: new WeakMap(), inputs: [] };
  const lines: { text: string; indent: number; line: number }[] = [];
  let pending: typeof lines[number] | undefined;
  let depth = 0;
  source.split(/\r?\n/).forEach((raw, index) => {
    if (/^\s*\/\/@\s*version\b/.test(raw) && !/^\s*\/\/@\s*version\s*=\s*[56]\s*$/.test(raw)) fail(index + 1, 'only Pine versions 5 and 6 are supported.');
    const clean = stripComment(raw);
    if (!clean.trim()) return;
    const indent = /^\s*/.exec(clean)![0].replace(/\t/g, '    ').length;
    if (!pending && depth === 0 && lines.length && indent > lines[lines.length - 1].indent && /^(?:[:?]|(?:and|or)\b|[+*/%]|-\s)/.test(clean.trim())) {
      pending = lines.pop()!;
    }
    if (!pending) pending = { text: '', indent, line: index + 1 };
    pending.text += `${pending.text ? ' ' : ''}${clean.trim()}`;
    depth += delimiterDepth(clean);
    if (depth < 0) fail(index + 1, 'unexpected closing delimiter.');
    if (depth === 0 && !/(?:=|\?|:|\+|-|\*|\/|%|\band|\bor)\s*$/.test(pending.text)) { lines.push(pending); pending = undefined; }
  });
  if (pending) fail(pending.line, 'expected a closing ")" or "]".');
  let cursor = 0;
  const expr = (text: string, line: number) => parseExpression(tokenize(text.replace(/\barray\.(new|from)\s*<\s*[A-Za-z_]\w*\s*>/g, 'array.$1'), line), line);
  const parameter = (text: string, line: number): Parameter => {
    const match = new RegExp(`^(?:(?:(?:simple|series|const|input)\\s+)?(${PINE_DECLARATION_TYPE})\\s+)?([A-Za-z_]\\w*)(?:\\s*=\\s*(.+))?$`).exec(text.trim());
    if (!match) return fail(line, 'unsupported parameter or field declaration.');
    return { name: match[2], type: match[1]?.replace(/\s/g, '') ?? '', defaultValue: match[3] ? expr(match[3], line) : undefined };
  };
  const child = (indent: number, line: number): Statement[] => {
    if (!lines[cursor] || lines[cursor].indent <= indent) return fail(line, 'expected an indented block.');
    return block(lines[cursor].indent);
  };
  const switchExpr = (text: string, indent: number, line: number): Expr => {
    const selector = text.slice(6).trim();
    if (!lines[cursor] || lines[cursor].indent <= indent) return fail(line, 'expected switch branches.');
    const branchIndent = lines[cursor].indent;
    const branches: Extract<Expr, { kind: 'switch' }>['branches'] = [];
    let hasDefault = false;
    while (lines[cursor] && lines[cursor].indent === branchIndent) {
      const branch = lines[cursor++];
      const arrow = branch.text.indexOf('=>');
      if (arrow < 0 || hasDefault) return fail(branch.line, 'invalid switch branch.');
      const test = branch.text.slice(0, arrow).trim();
      const value = branch.text.slice(arrow + 2).trim();
      hasDefault = !test;
      branches.push({ test: test ? expr(test, branch.line) : undefined, body: value ? [simple(value, branch.line, branch.indent)] : child(branch.indent, branch.line) });
    }
    return { kind: 'switch', selector: selector ? expr(selector, line) : undefined, branches };
  };
  const simple = (raw: string, line: number, indent: number): Statement => {
    if (raw === 'break' || raw === 'continue') return { kind: raw, line };
    const persistent = /^var\s+/.test(raw);
    const text = raw.replace(/^var\s+/, '').replace(new RegExp(`^(?:array\\s*<\\s*${PINE_TYPE_NAME}\\s*>\\s*|${PINE_TYPE_NAME}\\s+)([A-Za-z_]\\w*)\\s*(?==|:=)`), '$1 ');
    const tupleAssignment = /^\[\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+)\s*\]\s*=\s*(.*)$/.exec(text);
    if (tupleAssignment) {
      const names = tupleAssignment[1].split(',').map((name) => name.trim());
      if (new Set(names).size !== names.length) fail(line, 'tuple assignment contains duplicate names.');
      return { kind: 'tupleAssignment', names, expression: expr(tupleAssignment[2], line), line };
    }
    const assignment = /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*(\+=|-=|\*=|\/=|%=|:=|=)(?!=)\s*(.*)$/.exec(text);
    if (assignment) {
      const name = assignment[1];
      if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index'].includes(name)) fail(line, `"${name}" is a built-in series and cannot be reassigned.`);
      const expression = /^switch\b/.test(assignment[3]) ? switchExpr(assignment[3], indent, line) : expr(assignment[3], line);
      if (/^(?:\+=|-=|\*=|\/=|%=)$/.test(assignment[2])) {
        const operator = assignment[2][0];
        const parts = name.split('.');
        const left: Expr = parts.slice(1).reduce<Expr>((object, property) => ({ kind: 'member', object, property }), { kind: 'identifier', name: parts[0] });
        return { kind: 'assignment', name, reassign: true, persistent, line, expression: { kind: 'binary', op: operator, left, right: expression } };
      }
      return { kind: 'assignment', name, reassign: assignment[2] === ':=', persistent, line, expression };
    }
    const expression = /^switch\b/.test(text) ? switchExpr(text, indent, line) : expr(text, line);
    if (expression.kind !== 'call' || expressionPath(expression.callee) !== 'plot') return { kind: 'expression', expression, line };
    const value = expression.args.find((arg) => arg.name == null || arg.name === 'series');
    if (!value) return fail(line, 'plot() requires a series value.');
    const title = expression.args.find((arg) => arg.name === 'title')?.value;
    const color = expression.args.find((arg) => arg.name === 'color')?.value;
    const width = expression.args.find((arg) => arg.name === 'linewidth')?.value;
    const unsupported = expression.args.find((arg) => ![undefined, 'series', 'title', 'color', 'linewidth', 'style', 'force_overlay'].includes(arg.name));
    if (unsupported) fail(line, `unsupported plot argument "${unsupported.name}".`);
    if (title && title.kind !== 'string') fail(line, 'plot title must be a string literal.');
    if (width && (width.kind !== 'number' || !isLineWidth(width.value))) fail(line, 'plot linewidth must be from 1 to 4.');
    const plotIndex = program.plotCount++;
    return { kind: 'plot', expression: value.value, title: title?.kind === 'string' ? title.value : `Plot ${plotIndex + 1}`, color: color ?? { kind: 'string', value: DEFAULT_COLORS[plotIndex % DEFAULT_COLORS.length] }, lineWidth: width?.kind === 'number' && isLineWidth(width.value) ? width.value : 1, line };
  };
  function block(indent: number): Statement[] {
    const statements: Statement[] = [];
    while (cursor < lines.length && lines[cursor].indent >= indent) {
      const item = lines[cursor++];
      const { text, line } = item;
      if (item.indent !== indent) fail(line, 'unexpected indentation.');
      if (/^(?:indicator|study)\s*\(/.test(text)) {
        expr(text, line);
        continue;
      }
      if (/^strategy\s*\(/.test(text)) fail(line, 'strategy scripts are not supported; use indicator().');
      const type = /^type\s+([A-Za-z_]\w*)$/.exec(text);
      if (type) {
        if (indent !== 0 || program.types.has(type[1])) fail(line, 'invalid or duplicate type declaration.');
        const fields: Parameter[] = [];
        if (!lines[cursor] || lines[cursor].indent <= indent) fail(line, 'type must declare at least one field.');
        const fieldIndent = lines[cursor].indent;
        while (lines[cursor] && lines[cursor].indent > indent) {
          const field = lines[cursor++];
          if (field.indent !== fieldIndent) fail(field.line, 'unexpected field indentation.');
          const definition = parameter(field.text, field.line);
          if (!definition.type || fields.some((entry) => entry.name === definition.name)) fail(field.line, 'invalid or duplicate type field.');
          fields.push(definition);
        }
        program.types.set(type[1], fields);
        continue;
      }
      const method = /^(method\s+)?([A-Za-z_]\w*)\s*\((.*)\)\s*=>\s*(.*)$/.exec(text);
      if (method) {
        if (indent !== 0 || program.methods.has(method[2])) fail(line, 'nested or overloaded functions are not supported.');
        const parameters = method[3].trim() ? splitParameters(method[3]).map((entry) => parameter(entry, line)) : [];
        if (method[1] && !parameters.length) fail(line, 'method requires a receiver parameter.');
        if (new Set(parameters.map((entry) => entry.name)).size !== parameters.length) fail(line, 'duplicate function parameter.');
        const body = method[4] ? [simple(method[4], line, indent)] : child(indent, line);
        program.methods.set(method[2], { parameters, body, method: !!method[1] });
        continue;
      }
      if (/^if\s+/.test(text)) {
        const condition = expr(text.slice(3), line);
        const yes = child(indent, line);
        let no: Statement[] = [];
        if (lines[cursor]?.indent === indent && /^else\b/.test(lines[cursor].text)) {
          const next = lines[cursor];
          if (/^else\s+if\s+/.test(next.text)) {
            next.text = next.text.slice(5);
            no = blockElseIf(indent);
          } else {
            cursor++;
            if (next.text !== 'else') fail(next.line, 'unsupported else syntax.');
            no = child(indent, next.line);
          }
        }
        statements.push({ kind: 'if', condition, yes, no, line });
        continue;
      }
      const loop = /^for\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s+to\s+(.+)$/.exec(text);
      if (loop) {
        statements.push({ kind: 'for', name: loop[1], start: expr(loop[2], line), end: expr(loop[3], line), body: child(indent, line), line });
        continue;
      }
      const forEach = /^for\s+([A-Za-z_]\w*)\s+in\s+(.+)$/.exec(text);
      if (forEach) {
        statements.push({ kind: 'forEach', name: forEach[1], collection: expr(forEach[2], line), body: child(indent, line), line });
        continue;
      }
      const whileLoop = /^while\s+(.+)$/.exec(text);
      if (whileLoop) {
        statements.push({ kind: 'while', condition: expr(whileLoop[1], line), body: child(indent, line), line });
        continue;
      }
      if (/^(?:else|method|type|for|return)\b/.test(text)) fail(line, `unsupported syntax "${text.split(/\s/)[0]}".`);
      for (const entry of splitParameters(text)) {
        if (entry.trim()) statements.push(simple(entry.trim(), line, indent));
      }
    }
    return statements;
  }
  // Parse only the else-if statement, not subsequent statements in its parent's block.
  function blockElseIf(indent: number): Statement[] {
    const item = lines[cursor++];
    const condition = expr(item.text.slice(3), item.line);
    const yes = child(indent, item.line);
    let no: Statement[] = [];
    if (lines[cursor]?.indent === indent && /^else\b/.test(lines[cursor].text)) {
      const next = lines[cursor];
      if (/^else\s+if\s+/.test(next.text)) { next.text = next.text.slice(5); no = blockElseIf(indent); }
      else { cursor++; if (next.text !== 'else') fail(next.line, 'unsupported else syntax.'); no = child(indent, next.line); }
    }
    return [{ kind: 'if', condition, yes, no, line: item.line }];
  }
  program.statements = block(0);
  const inputTypes: Record<string, PineInputDefinition['type']> = {
    'input.int': 'int', 'input.float': 'float', 'input.string': 'string', 'input.bool': 'bool',
    'input.color': 'color', 'input.timeframe': 'timeframe', 'input.symbol': 'symbol', 'input.session': 'session',
  };
  const literal = (expression: Expr | undefined): PineInputValue | undefined => {
    if (!expression) return undefined;
    if (expression.kind === 'number' || expression.kind === 'string') return expression.value;
    if (expression.kind === 'identifier') {
      if (expression.name === 'true') return true;
      if (expression.name === 'false') return false;
      return CONSTANTS[expression.name];
    }
    if (expression.kind === 'unary' && expression.op === '-') {
      const value = literal(expression.value);
      return typeof value === 'number' ? -value : undefined;
    }
    return undefined;
  };
  for (const statement of program.statements) {
    if (statement.kind !== 'assignment' || statement.reassign || statement.expression.kind !== 'call') continue;
    const expression = statement.expression;
    const name = expressionPath(expression.callee);
    const type = name ? inputTypes[name] : undefined;
    if (!type) continue;
    const positional = expression.args.filter((argument) => argument.name === undefined);
    const named = new Map(expression.args.filter((argument) => argument.name).map((argument) => [argument.name!, argument.value]));
    const defaultValue = literal(named.get('defval') ?? positional[0]?.value);
    if (defaultValue === undefined) continue;
    const title = literal(named.get('title') ?? positional[1]?.value);
    const min = literal(named.get('minval'));
    const max = literal(named.get('maxval'));
    const group = literal(named.get('group'));
    const optionsExpr = named.get('options');
    const options = optionsExpr?.kind === 'array'
      ? optionsExpr.values.map((option) => literal(option)).filter((option): option is string => typeof option === 'string')
      : undefined;
    program.inputBindings.set(expression, statement.name);
    program.inputs.push({
      id: statement.name,
      title: typeof title === 'string' ? title : statement.name,
      type,
      defaultValue,
      ...(typeof min === 'number' ? { min } : {}),
      ...(typeof max === 'number' ? { max } : {}),
      ...(options?.length ? { options } : {}),
      ...(typeof group === 'string' ? { group } : {}),
    });
  }
  if (requireRenderable && !program.plotCount && !/\b(?:line|box)\s*\.\s*new\s*\(/.test(source)) throw new Error('Add at least one plot(...) call or line.new()/box.new() drawing to run this indicator.');
  return program;
}

export function getPineInputs(source: string): PineInputDefinition[] {
  return parseScript(source, false).inputs;
}

const numberValue = (value: PineValue, line: number): number => typeof value === 'number' ? value : fail(line, 'expected a numeric value.');
const booleanValue = (value: PineValue, line: number): boolean => typeof value === 'boolean' ? value : fail(line, 'expected a boolean value.');
const stringValue = (value: PineValue, line: number): string => typeof value === 'string' ? value : fail(line, 'expected a string value.');
const missing = (value: PineValue) => typeof value === 'number' && Number.isNaN(value);
class Scope {
  values = new Map<string, PineValue>();
  histories = new Map<string, Map<number, PineValue>>();
  constructor(readonly parent?: Scope) {}
  owner(name: string): Scope | undefined { return this.values.has(name) ? this : this.parent?.owner(name); }
  get(name: string): PineValue | undefined { return this.owner(name)?.values.get(name); }
  set(name: string, value: PineValue, bar: number) {
    this.values.set(name, value);
    if (!this.histories.has(name)) this.histories.set(name, new Map());
    this.histories.get(name)!.set(bar, value);
  }
}

function evaluate(
  program: Program,
  candles: Candle[],
  onProgress?: (progress: PineProgress) => void,
  inputValues: Record<string, PineInputValue> = {},
): PineResult {
  const barOffset = Math.max(0, candles.length - MAX_EXECUTION_BARS);
  const executionCandles = candles.slice(barOffset);
  const chartSeconds = executionCandles.length > 1
    ? Math.max(1, executionCandles[1].time - executionCandles[0].time)
    : 900;
  const chartPeriod = chartSeconds >= 2_592_000 && chartSeconds % 2_592_000 === 0
    ? `${chartSeconds / 2_592_000}M`
    : chartSeconds >= 604_800 && chartSeconds % 604_800 === 0
      ? `${chartSeconds / 604_800}W`
      : chartSeconds >= 86_400 && chartSeconds % 86_400 === 0
        ? `${chartSeconds / 86_400}D`
        : chartSeconds % 60 === 0 ? `${chartSeconds / 60}` : `${chartSeconds}S`;
  const root = new Scope();
  const plots = new Map<object, PinePlot>();
  const handles: PineHandle[] = [];
  let nextDrawingId = 1;
  let activeLines = 0;
  let activeBoxes = 0;
  const historyTargets = new WeakSet<Expr>();
  const markHistory = (expression: Expr): void => {
    if (expression.kind === 'index') historyTargets.add(expression.value);
    if (expression.kind === 'call') {
      const path = expressionPath(expression.callee);
      if (path?.startsWith('ta.') || path === 'math.sum') {
        historyTargets.add(expression);
        const source = expression.args.find((arg) => arg.name === 'source') ?? expression.args.find((arg) => !arg.name);
        if (source) historyTargets.add(source.value);
      }
    }
    switch (expression.kind) {
      case 'member': markHistory(expression.object); break;
      case 'unary': markHistory(expression.value); break;
      case 'binary': markHistory(expression.left); markHistory(expression.right); break;
      case 'conditional': markHistory(expression.condition); markHistory(expression.yes); markHistory(expression.no); break;
      case 'call':
        markHistory(expression.callee);
        expression.args.forEach((arg) => markHistory(arg.value));
        break;
      case 'index': markHistory(expression.value); markHistory(expression.index); break;
      case 'array': expression.values.forEach(markHistory); break;
      case 'switch':
        if (expression.selector) markHistory(expression.selector);
        expression.branches.forEach((branch) => {
          if (branch.test) markHistory(branch.test);
          markStatementHistory(branch.body);
        });
        break;
      case 'number': case 'string': case 'identifier': break;
    }
  };
  const markStatementHistory = (statements: Statement[]): void => {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case 'assignment': case 'tupleAssignment': case 'expression': markHistory(statement.expression); break;
        case 'plot': markHistory(statement.expression); markHistory(statement.color); break;
        case 'if': markHistory(statement.condition); markStatementHistory(statement.yes); markStatementHistory(statement.no); break;
        case 'for': markHistory(statement.start); markHistory(statement.end); markStatementHistory(statement.body); break;
        case 'forEach': markHistory(statement.collection); markStatementHistory(statement.body); break;
        case 'while': markHistory(statement.condition); markStatementHistory(statement.body); break;
        case 'break': case 'continue': break;
      }
    });
  };
  markStatementHistory(program.statements);
  program.methods.forEach((method) => markStatementHistory(method.body));
  const persistent = new WeakMap<Scope, Set<Statement>>();
  const expressionHistory = new WeakMap<Expr, WeakMap<Scope, Map<number, PineValue>>>();
  const localScopes = new WeakMap<object, WeakMap<Scope, Scope>>();
  const callScopes = new WeakMap<Expr, WeakMap<Scope, Scope>>();
  let bar = 0;
  let steps = 0;
  let barSteps = 0;
  let depth = 0;
  let loopDepth = 0;
  const resolvingEmptyColor = new Set<string>();
  const tick = (line: number) => {
    steps++;
    if (steps > MAX_TOTAL_STEPS || ++barSteps > MAX_STEPS_PER_BAR) fail(line, 'execution limit exceeded.');
  };
  const scoped = (key: object, parent: Scope) => {
    if (!localScopes.has(key)) localScopes.set(key, new WeakMap());
    const scopes = localScopes.get(key)!;
    if (!scopes.has(parent)) scopes.set(parent, new Scope(parent));
    return scopes.get(parent)!;
  };
  const history = (expression: Expr, scope: Scope) => {
    if (!expressionHistory.has(expression)) expressionHistory.set(expression, new WeakMap());
    const scopes = expressionHistory.get(expression)!;
    if (!scopes.has(scope)) scopes.set(scope, new Map());
    return scopes.get(scope)!;
  };
  const readField = (value: PineValue, property: string, line: number): PineValue => {
    if (typeof value === 'object' && value.kind === 'record') {
      const field = value.fields.get(property);
      return field === undefined ? fail(line, `type "${value.type}" has no field "${property}".`) : field;
    }
    return fail(line, `cannot read property "${property}" from this value.`);
  };
  const resolve = (name: string, scope: Scope, line: number): PineValue => {
    if (name === 'na') return Number.NaN;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (CONSTANTS[name] !== undefined) return CONSTANTS[name];
    const parts = name.split('.');
    let value = scope.get(parts[0]);
    if (!executionCandles.length && value === undefined && !resolvingEmptyColor.has(parts[0])) {
      const declaration = program.statements.find((statement) => statement.kind === 'assignment' && statement.name === parts[0] && !statement.reassign);
      if (declaration?.kind === 'assignment') {
        resolvingEmptyColor.add(parts[0]);
        value = evaluateExpr(declaration.expression, root, declaration.line);
        root.set(parts[0], value, 0);
        resolvingEmptyColor.delete(parts[0]);
      }
    }
    if (value === undefined) return fail(line, `unknown identifier "${name}".`);
    for (const part of parts.slice(1)) value = readField(value, part, line);
    return value;
  };
  const integer = (value: PineValue, line: number, min: number, max: number, label: string) => {
    const n = numberValue(value, line);
    if (!Number.isInteger(n) || n < min || n > max) fail(line, `${label} must be an integer from ${min} to ${max}.`);
    return n;
  };
  const array = (value: PineValue, line: number): PineArray => typeof value === 'object' && value.kind === 'array' ? value : fail(line, 'receiver is not a mutable Pine array.');
  const evaluateExpr = (expression: Expr, scope: Scope, line: number): PineValue => {
    const value = evaluateRaw(expression, scope, line);
    if (historyTargets.has(expression)) history(expression, scope).set(bar, value);
    return value;
  };
  const evaluateRaw = (expression: Expr, scope: Scope, line: number): PineValue => {
    const ev = (entry: Expr) => evaluateExpr(entry, scope, line);
    switch (expression.kind) {
      case 'number': case 'string': return expression.value;
      case 'identifier': return resolve(expression.name, scope, line);
      case 'array': return { kind: 'array', values: expression.values.map(ev) };
      case 'member': {
        const path = expressionPath(expression);
        if (path === 'timeframe.period') return chartPeriod;
        if (path && CONSTANTS[path] !== undefined) return CONSTANTS[path];
        return readField(ev(expression.object), expression.property, line);
      }
      case 'unary': {
        const value = ev(expression.value);
        if (expression.op === 'not') return !booleanValue(value, line);
        const n = numberValue(value, line);
        return expression.op === '-' ? -n : n;
      }
      case 'binary': {
        const left = ev(expression.left);
        if (expression.op === 'and') return booleanValue(left, line) && booleanValue(ev(expression.right), line);
        if (expression.op === 'or') return booleanValue(left, line) || booleanValue(ev(expression.right), line);
        const right = ev(expression.right);
        if (expression.op === '==' || expression.op === '!=') {
          if (typeof left === 'object' || typeof right === 'object') fail(line, 'objects cannot be compared.');
          return expression.op === '==' ? left === right : left !== right;
        }
        if (expression.op === '+' && typeof left === 'string' && typeof right === 'string') return left + right;
        const a = numberValue(left, line);
        const b = numberValue(right, line);
        switch (expression.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': return a / b; case '%': return a % b;
          case '>': return a > b; case '>=': return a >= b; case '<': return a < b; case '<=': return a <= b;
          default: return fail(line, `unsupported operator "${expression.op}".`);
        }
      }
      case 'conditional': return booleanValue(ev(expression.condition), line) ? ev(expression.yes) : ev(expression.no);
      case 'switch': {
        const selector = expression.selector ? ev(expression.selector) : undefined;
        for (const branch of expression.branches) {
          if (!branch.test || (expression.selector ? ev(branch.test) === selector : booleanValue(ev(branch.test), line))) return execute(branch.body, scoped(branch, scope)).value;
        }
        return Number.NaN;
      }
      case 'index': {
        const offset = integer(ev(expression.index), line, 0, MAX_ARRAY, 'history offset');
        const current = ev(expression.value);
        if (typeof current === 'object' && current.kind === 'array') return current.values[current.values.length - offset - 1] ?? Number.NaN;
        if (typeof current === 'object') return fail(line, 'record and drawing history offsets are not supported.');
        const path = expressionPath(expression.value);
        const owner = path && !path.includes('.') ? scope.owner(path) : undefined;
        return (owner ? owner.histories.get(path!)?.get(bar - offset) : history(expression.value, scope).get(bar - offset)) ?? (typeof current === 'boolean' ? false : Number.NaN);
      }
      case 'call': return call(expression, scope, line);
    }
  };
  const call = (expression: Extract<Expr, { kind: 'call' }>, scope: Scope, line: number): PineValue => {
    const path = expressionPath(expression.callee);
    const member = expression.callee.kind === 'member' ? expression.callee : undefined;
    let name = path ?? member?.property ?? '';
    const positional: PineValue[] = [];
    const named = new Map<string, PineValue>();
    for (const entry of expression.args) {
      const value = evaluateExpr(entry.value, scope, line);
      if (entry.name) {
        if (named.has(entry.name)) fail(line, `duplicate argument "${entry.name}".`);
        named.set(entry.name, value);
      } else positional.push(value);
    }
    const arg = (index: number, key: string, fallback: PineValue = Number.NaN) => positional[index] ?? named.get(key) ?? fallback;
    const checkedArgs = (keys: string[], max = keys.length) => {
      if (positional.length > max) fail(line, `too many arguments for ${name}.`);
      for (const key of named.keys()) if (!keys.includes(key)) fail(line, `unsupported ${name} argument "${key}".`);
    };
    const methodName = member?.property ?? name;
    const method = program.methods.get(methodName);
    if (method) {
      if (++depth > 64) fail(line, 'function call depth limit exceeded.');
      const receiver = member ? evaluateExpr(member.object, scope, line) : undefined;
      if (member && !method.method) fail(line, `"${methodName}" is not a method.`);
      const supplied = receiver === undefined ? positional : [receiver, ...positional];
      checkedArgs(method.parameters.map((entry) => entry.name), method.parameters.length - (receiver === undefined ? 0 : 1));
      if (!callScopes.has(expression)) callScopes.set(expression, new WeakMap());
      const scopes = callScopes.get(expression)!;
      if (!scopes.has(scope)) scopes.set(scope, new Scope(root));
      const local = scopes.get(scope)!;
      method.parameters.forEach((parameter, index) => {
        const value = supplied[index] ?? named.get(parameter.name) ?? (parameter.defaultValue ? evaluateExpr(parameter.defaultValue, local, line) : undefined);
        if (value === undefined) fail(line, `missing argument "${parameter.name}".`);
        if (parameter.type === 'float' || parameter.type === 'int') numberValue(value!, line);
        else if (parameter.type === 'bool') booleanValue(value!, line);
        else if (parameter.type === 'string' || parameter.type === 'color') stringValue(value!, line);
        else if (parameter.type.startsWith('array<')) array(value!, line);
        else if (parameter.type === 'line' || parameter.type === 'box') {
          if (!missing(value!) && !(typeof value === 'object' && value.kind === 'handle' && value.drawing.kind === parameter.type)) fail(line, `expected a ${parameter.type} handle.`);
        }
        else if (program.types.has(parameter.type) && !missing(value!) && !(typeof value === 'object' && value.kind === 'record' && value.type === parameter.type)) fail(line, `expected a "${parameter.type}" record.`);
        local.set(parameter.name, value!, bar);
      });
      const outerLoopDepth = loopDepth;
      loopDepth = 0;
      const result = execute(method.body, local).value;
      loopDepth = outerLoopDepth;
      depth--;
      return result;
    }
    if (name === 'array.new' || name.startsWith('array.new_') || name === 'array.from') {
      if (name === 'array.from') { if (positional.length > MAX_ARRAY) fail(line, 'array size limit exceeded.'); return { kind: 'array', values: positional }; }
      checkedArgs(['size', 'initial_value']);
      const size = integer(arg(0, 'size', 0), line, 0, MAX_ARRAY, 'array.new size');
      return { kind: 'array', values: Array.from({ length: size }, () => arg(1, 'initial_value')) };
    }
    if (name === 'chart.point.from_index' || name === 'chart.point.from_time' || name === 'chart.point.new') {
      checkedArgs(name === 'chart.point.new' ? ['time', 'index', 'price'] : ['index', 'price']);
      if (name === 'chart.point.from_time') {
        return {
          kind: 'record',
          type: 'chart.point',
          fields: new Map([['time', arg(0, 'time')], ['index', Number.NaN], ['price', arg(1, 'price')]]),
        };
      }
      if (name === 'chart.point.new') {
        return {
          kind: 'record',
          type: 'chart.point',
          fields: new Map([['time', arg(0, 'time')], ['index', arg(1, 'index')], ['price', arg(2, 'price')]]),
        };
      }
      return {
        kind: 'record',
        type: 'chart.point',
        fields: new Map([['time', Number.NaN], ['index', arg(0, 'index')], ['price', arg(1, 'price')]]),
      };
    }
    const arrayMethods = ['size', 'get', 'set', 'push', 'pop', 'unshift', 'shift', 'remove', 'clear', 'max', 'min', 'indexof'];
    if (member && arrayMethods.includes(member.property) && !['line', 'box', 'math'].includes(expressionPath(member.object) ?? '')) {
      const namespace = expressionPath(member.object) === 'array';
      const receiver = array(namespace ? positional.shift() ?? named.get('id') ?? Number.NaN : evaluateExpr(member.object, scope, line), line);
      if (namespace) named.delete('id');
      const index = () => integer(arg(0, 'index'), line, 0, receiver.values.length - 1, 'array index');
      const value = () => arg(0, 'value');
      if (['push', 'unshift'].includes(member.property) && receiver.values.length >= MAX_ARRAY) fail(line, 'array size limit exceeded.');
      switch (member.property) {
        case 'size': checkedArgs([]); return receiver.values.length;
        case 'get': checkedArgs(['index']); return receiver.values[index()];
        case 'set': checkedArgs(['index', 'value']); receiver.values[index()] = arg(1, 'value'); return Number.NaN;
        case 'push': checkedArgs(['value']); receiver.values.push(value()); return Number.NaN;
        case 'unshift': checkedArgs(['value']); receiver.values.unshift(value()); return Number.NaN;
        case 'pop': checkedArgs([]); return receiver.values.pop() ?? Number.NaN;
        case 'shift': checkedArgs([]); return receiver.values.shift() ?? Number.NaN;
        case 'remove': checkedArgs(['index']); return receiver.values.splice(index(), 1)[0];
        case 'clear': checkedArgs([]); receiver.values.length = 0; return Number.NaN;
        case 'max': checkedArgs([]); return receiver.values.length ? Math.max(...receiver.values.map((entry) => numberValue(entry, line))) : Number.NaN;
        case 'min': checkedArgs([]); return receiver.values.length ? Math.min(...receiver.values.map((entry) => numberValue(entry, line))) : Number.NaN;
        case 'indexof': checkedArgs(['value']); return receiver.values.indexOf(value());
      }
    }
    if (member?.property === 'new' && program.types.has(expressionPath(member.object) ?? '')) {
      const type = expressionPath(member.object)!;
      const fields = program.types.get(type)!;
      checkedArgs(fields.map((field) => field.name));
      return { kind: 'record', type, fields: new Map(fields.map((field, index) => [field.name, positional[index] ?? named.get(field.name) ?? (field.defaultValue ? evaluateExpr(field.defaultValue, scope, line) : field.type === 'bool' ? false : field.type === 'string' ? '' : Number.NaN)])) };
    }
    if (name === 'label.new') {
      checkedArgs(['x', 'y', 'text', 'xloc', 'yloc', 'color', 'style', 'textcolor', 'size', 'textalign', 'tooltip', 'text_font_family', 'text_formatting', 'force_overlay']);
      if (positional.length > 9) fail(line, 'too many arguments for label.new.');
      const values: [string, PineValue][] = [
        ['x', arg(0, 'x')], ['y', arg(1, 'y')], ['text', arg(2, 'text', '')],
        ['xloc', arg(3, 'xloc', 'bar_index')], ['yloc', arg(4, 'yloc', 'price')],
        ['color', arg(5, 'color', 'transparent')], ['style', arg(6, 'style', 'label_down')],
        ['textcolor', named.get('textcolor') ?? named.get('text_color') ?? COLORS['color.white']],
        ['size', arg(8, 'size', 'normal')], ['textalign', arg(9, 'textalign', 'center')],
        ['tooltip', arg(10, 'tooltip', '')], ['deleted', false],
      ];
      numberValue(values[0][1], line);
      numberValue(values[1][1], line);
      stringValue(values[2][1], line);
      return { kind: 'record', type: 'label', fields: new Map(values) };
    }
    if (name === 'label.delete') {
      checkedArgs(['id']);
      const label = arg(0, 'id');
      if (missing(label)) return Number.NaN;
      const labelRecord = typeof label === 'object' && label.kind === 'record' && label.type === 'label' ? label : fail(line, 'label.delete requires a label id.');
      labelRecord.fields.set('deleted', true);
      return Number.NaN;
    }
    if (member && ['delete', 'set_right', 'set_left', 'set_top', 'set_bottom', 'set_x1', 'set_x2', 'set_y1', 'set_y2', 'set_xy1', 'set_xy2', 'set_color', 'set_width', 'set_style', 'set_bgcolor', 'set_border_color', 'set_border_width', 'set_border_style', 'set_extend', 'set_lefttop', 'set_rightbottom', 'set_text', 'set_text_color', 'set_textcolor', 'get_left', 'get_x1', 'get_x2', 'get_y1', 'get_y2', 'get_price', 'get_bottom', 'get_top'].includes(member.property) && !['line', 'box'].includes(expressionPath(member.object) ?? '')) {
      const receiver = evaluateExpr(member.object, scope, line);
      if (missing(receiver)) return Number.NaN;
      if (member.property === 'delete' && typeof receiver === 'object' && receiver.kind === 'record' && receiver.type === 'label') {
        receiver.fields.set('deleted', true);
        return Number.NaN;
      }
      if (typeof receiver !== 'object' || receiver.kind !== 'handle') return fail(line, `${member.property} requires a drawing handle.`);
      positional.unshift(receiver);
      name = `${receiver.drawing.kind}.${member.property}`;
    }
    if (/^(line|box)\./.test(name)) {
      const [kind, operation] = name.split('.');
      if (operation === 'new') {
        const keys = kind === 'line' ? ['x1', 'y1', 'x2', 'y2', 'xloc', 'extend', 'color', 'style', 'width', 'force_overlay'] : ['left', 'top', 'right', 'bottom', 'border_color', 'border_width', 'border_style', 'extend', 'xloc', 'bgcolor', 'text', 'text_color', 'text_size', 'text_halign', 'text_valign', 'text_font_family', 'force_overlay'];
        checkedArgs(keys);
        const activeCount = kind === 'line' ? activeLines : activeBoxes;
        if (activeCount >= MAX_DRAWINGS_PER_KIND) {
          const oldest = handles.findIndex((entry) => !entry.deleted && entry.drawing.kind === kind);
          if (oldest < 0) fail(line, 'drawing object count limit exceeded.');
          const [expired] = handles.splice(oldest, 1);
          expired.deleted = true;
          if (kind === 'line') activeLines--;
          else activeBoxes--;
        }
        const n = (key: string, fallback: number = Number.NaN) => numberValue(arg(keys.indexOf(key), key, fallback), line);
        const s = (key: string, fallback: string) => {
          const value = arg(keys.indexOf(key), key, fallback);
          return missing(value) ? 'transparent' : stringValue(value, line);
        };
        let drawing: PineDrawing;
        if (kind === 'line') {
          drawing = { id: nextDrawingId, kind: 'line', x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2'), color: s('color', COLORS['color.blue']), style: s('style', 'solid'), width: n('width', 1), xloc: s('xloc', 'bar_index'), extend: s('extend', 'none') };
        } else {
          drawing = { id: nextDrawingId, kind: 'box', left: n('left'), top: n('top'), right: n('right'), bottom: n('bottom'), borderColor: s('border_color', COLORS['color.blue']), borderStyle: s('border_style', 'solid'), borderWidth: n('border_width', 1), bgcolor: s('bgcolor', COLORS['color.blue']), xloc: s('xloc', 'bar_index'), extend: s('extend', 'none') };
          const text = arg(keys.indexOf('text'), 'text');
          const textColor = arg(keys.indexOf('text_color'), 'text_color');
          if (!missing(text)) drawing.text = stringValue(text, line);
          if (!missing(textColor)) drawing.textColor = stringValue(textColor, line);
        }
        nextDrawingId++;
        const handle: PineHandle = { kind: 'handle', drawing, deleted: false };
        handles.push(handle);
        if (kind === 'line') activeLines++;
        else activeBoxes++;
        return handle;
      }
      const valid = kind === 'line'
        ? ['delete', 'set_right', 'set_x1', 'set_x2', 'set_y1', 'set_y2', 'set_xy1', 'set_xy2', 'set_color', 'set_width', 'set_style', 'get_left', 'get_x1', 'get_x2', 'get_y1', 'get_y2', 'get_price']
        : ['delete', 'set_right', 'set_left', 'set_top', 'set_bottom', 'set_bgcolor', 'set_border_color', 'set_border_width', 'set_border_style', 'set_extend', 'set_lefttop', 'set_rightbottom', 'set_text', 'set_text_color', 'set_textcolor', 'get_left', 'get_bottom', 'get_top'];
      if (!valid.includes(operation)) fail(line, `unsupported function "${name}".`);
      const operationArgs: Record<string, string[]> = {
        set_right: ['id', kind === 'line' ? 'x' : 'right'], set_x2: ['id', 'x'],
        set_left: ['id', 'left'], set_top: ['id', 'top'], set_bottom: ['id', 'bottom'],
        set_x1: ['id', 'x'], set_y1: ['id', 'y'], set_y2: ['id', 'y'],
        set_xy1: ['id', 'x', 'y'], set_xy2: ['id', 'x', 'y'], set_color: ['id', 'color'],
        set_width: ['id', 'width'], set_style: ['id', 'style'],
        set_bgcolor: ['id', 'color'], set_border_color: ['id', 'color'], set_extend: ['id', 'extend'],
        set_border_width: ['id', 'width'], set_border_style: ['id', 'style'],
        set_lefttop: ['id', 'left', 'top'], set_rightbottom: ['id', 'right', 'bottom'],
        set_text: ['id', 'text'], set_text_color: ['id', 'color'], set_textcolor: ['id', 'color'],
        get_price: ['id', 'x'],
      };
      checkedArgs(operationArgs[operation] ?? ['id']);
      const handle = arg(0, 'id');
      if (missing(handle)) return Number.NaN;
      if (typeof handle !== 'object' || handle.kind !== 'handle' || handle.drawing.kind !== kind) return fail(line, `${name} requires a ${kind} handle.`);
      if (operation === 'delete') {
        if (!handle.deleted) {
          handle.deleted = true;
          if (kind === 'line') activeLines--;
          else activeBoxes--;
          const index = handles.indexOf(handle);
          if (index >= 0) handles.splice(index, 1);
        }
        return Number.NaN;
      }
      if (handle.deleted) return Number.NaN;
      const drawing = handle.drawing;
      const numericArg = (index: number, key: string) => numberValue(arg(index, key), line);
      if (operation === 'set_right' || operation === 'set_x2') {
        const right = numericArg(1, kind === 'line' ? 'x' : 'right');
        if (drawing.kind === 'line') drawing.x2 = right;
        else drawing.right = right;
        return Number.NaN;
      }
      if (operation === 'set_xy1' && drawing.kind === 'line') { drawing.x1 = numericArg(1, 'x'); drawing.y1 = numericArg(2, 'y'); return Number.NaN; }
      if (operation === 'set_xy2' && drawing.kind === 'line') { drawing.x2 = numericArg(1, 'x'); drawing.y2 = numericArg(2, 'y'); return Number.NaN; }
      if (operation === 'set_x1' && drawing.kind === 'line') { drawing.x1 = numericArg(1, 'x'); return Number.NaN; }
      if (operation === 'set_y1' && drawing.kind === 'line') { drawing.y1 = numericArg(1, 'y'); return Number.NaN; }
      if (operation === 'set_y2' && drawing.kind === 'line') { drawing.y2 = numericArg(1, 'y'); return Number.NaN; }
      if (operation === 'set_color' && drawing.kind === 'line') { drawing.color = stringValue(arg(1, 'color'), line); return Number.NaN; }
      if (operation === 'set_width' && drawing.kind === 'line') { drawing.width = numberValue(arg(1, 'width'), line); return Number.NaN; }
      if (operation === 'set_style' && drawing.kind === 'line') { drawing.style = stringValue(arg(1, 'style'), line); return Number.NaN; }
      if (operation === 'set_bgcolor' && drawing.kind === 'box') { drawing.bgcolor = stringValue(arg(1, 'color'), line); return Number.NaN; }
      if (operation === 'set_border_color' && drawing.kind === 'box') { drawing.borderColor = stringValue(arg(1, 'color'), line); return Number.NaN; }
      if (operation === 'set_border_width' && drawing.kind === 'box') { drawing.borderWidth = numberValue(arg(1, 'width'), line); return Number.NaN; }
      if (operation === 'set_border_style' && drawing.kind === 'box') { drawing.borderStyle = stringValue(arg(1, 'style'), line); return Number.NaN; }
      if (operation === 'set_extend') { drawing.extend = stringValue(arg(1, 'extend'), line); return Number.NaN; }
      if (operation === 'set_lefttop' && drawing.kind === 'box') { drawing.left = numericArg(1, 'left'); drawing.top = numericArg(2, 'top'); return Number.NaN; }
      if (operation === 'set_rightbottom' && drawing.kind === 'box') { drawing.right = numericArg(1, 'right'); drawing.bottom = numericArg(2, 'bottom'); return Number.NaN; }
      if (operation === 'set_left' && drawing.kind === 'box') { drawing.left = numericArg(1, 'left'); return Number.NaN; }
      if (operation === 'set_top' && drawing.kind === 'box') { drawing.top = numericArg(1, 'top'); return Number.NaN; }
      if (operation === 'set_bottom' && drawing.kind === 'box') { drawing.bottom = numericArg(1, 'bottom'); return Number.NaN; }
      if (operation === 'set_text' && drawing.kind === 'box') { drawing.text = stringValue(arg(1, 'text'), line); return Number.NaN; }
      if ((operation === 'set_text_color' || operation === 'set_textcolor') && drawing.kind === 'box') { drawing.textColor = stringValue(arg(1, 'color'), line); return Number.NaN; }
      if (operation === 'get_left' || operation === 'get_x1') return drawing.kind === 'line' ? drawing.x1 : drawing.left;
      if (operation === 'get_y2' && drawing.kind === 'line') return drawing.y2;
      if (operation === 'get_x2' && drawing.kind === 'line') return drawing.x2;
      if (operation === 'get_y1' && drawing.kind === 'line') return drawing.y1;
      if (operation === 'get_price' && drawing.kind === 'line') {
        const x = numericArg(1, 'x');
        return drawing.x2 === drawing.x1 ? drawing.y1 : drawing.y1 + (drawing.y2 - drawing.y1) * ((x - drawing.x1) / (drawing.x2 - drawing.x1));
      }
      if (drawing.kind === 'box') return operation === 'get_top' ? drawing.top : drawing.bottom;
      return Number.NaN;
    }
    if (['input.int', 'input.float', 'input.string', 'input.bool', 'input.color', 'input.timeframe', 'input.symbol', 'input.session'].includes(name)) {
      const value = arg(0, 'defval');
      const inputId = program.inputBindings.get(expression);
      const configuredValue = inputId === undefined ? undefined : inputValues[inputId];
      if (configuredValue !== undefined) {
        if (['input.int', 'input.float'].includes(name) && typeof configuredValue !== 'number') fail(line, `${name} requires a numeric value.`);
        if (name === 'input.int' && !Number.isInteger(configuredValue)) fail(line, 'input.int requires an integer value.');
        if (name === 'input.bool' && typeof configuredValue !== 'boolean') fail(line, 'input.bool requires a boolean value.');
        if (['input.string', 'input.color', 'input.timeframe', 'input.symbol', 'input.session'].includes(name) && typeof configuredValue !== 'string') fail(line, `${name} requires a string value.`);
        const minimum = named.get('minval');
        const maximum = named.get('maxval');
        if (typeof configuredValue === 'number' && typeof minimum === 'number' && configuredValue < minimum) fail(line, `${name} value is below minval.`);
        if (typeof configuredValue === 'number' && typeof maximum === 'number' && configuredValue > maximum) fail(line, `${name} value is above maxval.`);
        const options = named.get('options');
        if (typeof configuredValue === 'string' && options && array(options, line).values.some((option) => typeof option === 'string') && !array(options, line).values.includes(configuredValue)) {
          fail(line, `${name} value must be one of its options.`);
        }
        return configuredValue;
      }
      if ((name === 'input.int' || name === 'input.float') && typeof value !== 'number') fail(line, `${name} requires a numeric default value.`);
      if (['input.string', 'input.color', 'input.timeframe', 'input.symbol', 'input.session'].includes(name) && typeof value !== 'string') fail(line, `${name} requires a string default value.`);
      if (name === 'input.bool') booleanValue(value, line);
      const options = named.get('options');
      if (['input.string', 'input.timeframe'].includes(name) && options !== undefined && array(options, line).values.some((option) => typeof option !== 'string')) fail(line, `${name} options must be an array of string literals.`);
      return value;
    }
    if (name === 'na') { checkedArgs(['x']); return missing(arg(0, 'x')); }
    if (name === 'nz') { checkedArgs(['source', 'replacement']); const value = arg(0, 'source'); return missing(value) ? arg(1, 'replacement', 0) : value; }
    if (name === 'fixnan') {
      checkedArgs(['source']);
      const value = arg(0, 'source');
      if (!missing(value)) return numberValue(value, line);
      const previous = expressionHistory.get(expression)?.get(scope);
      for (let index = bar - 1; index >= 0; index--) {
        const candidate = previous?.get(index);
        if (typeof candidate === 'number' && !Number.isNaN(candidate)) return candidate;
      }
      return Number.NaN;
    }
    if (name === 'int' || name === 'float') {
      checkedArgs(['x']);
      const value = numberValue(arg(0, 'x'), line);
      return name === 'int' ? Math.trunc(value) : value;
    }
    if (name === 'color') {
      checkedArgs(['x']);
      const value = arg(0, 'x');
      if (missing(value)) return 'transparent';
      if (typeof value === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) return value;
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
        return `#${value.toString(16).padStart(6, '0')}ff`;
      }
      return fail(line, 'color() requires na, a color value, or a 24-bit integer.');
    }
    if (name === 'max_bars_back') {
      checkedArgs(['series', 'length']);
      if (positional.length !== 2) fail(line, 'max_bars_back requires a series and a history length.');
      const length = integer(arg(1, 'length'), line, 0, MAX_EXECUTION_BARS, 'max_bars_back length');
      if (length > MAX_EXECUTION_BARS) fail(line, `max_bars_back cannot exceed the ${MAX_EXECUTION_BARS}-bar execution window.`);
      return Number.NaN;
    }
    if (name === 'ticker.standard') {
      checkedArgs(['symbol']);
      return stringValue(arg(0, 'symbol'), line);
    }
    if (name === 'str.tostring') {
      checkedArgs(['value', 'format']);
      const value = arg(0, 'value');
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (missing(value)) return 'NaN';
      const format = arg(1, 'format');
      if (typeof format === 'string') {
        const decimals = /\.([#0]+)/.exec(format)?.[1].length ?? 0;
        return numberValue(value, line).toFixed(decimals);
      }
      return String(numberValue(value, line));
    }
    if (name === 'str.replace') {
      checkedArgs(['source', 'target', 'replacement', 'occurrence']);
      const source = stringValue(arg(0, 'source'), line);
      const target = stringValue(arg(1, 'target'), line);
      const replacement = stringValue(arg(2, 'replacement'), line);
      const occurrence = integer(arg(3, 'occurrence', 0), line, 0, MAX_ARRAY, 'str.replace occurrence');
      if (target === '') return source;
      if (occurrence === 0) return source.split(target).join(replacement);
      let count = 0;
      return source.replaceAll(target, (match) => ++count === occurrence ? replacement : match);
    }
    if (name === 'str.format_time') {
      checkedArgs(['time', 'format', 'timezone']);
      const timestamp = arg(0, 'time');
      if (missing(timestamp)) return 'NaN';
      const format = stringValue(arg(1, 'format'), line);
      const zone = stringValue(arg(2, 'timezone', 'UTC'), line);
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(numberValue(timestamp, line) * 1000);
        const values = new Map(parts.map((part) => [part.type, part.value]));
        return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => values.get(({ yyyy: 'year', MM: 'month', dd: 'day', HH: 'hour', mm: 'minute', ss: 'second' } as const)[token as 'yyyy' | 'MM' | 'dd' | 'HH' | 'mm' | 'ss']) ?? token);
      } catch (error) {
        if (error instanceof RangeError) fail(line, `invalid time zone "${zone}".`);
        throw error;
      }
    }
    if (name === 'str.endswith') {
      checkedArgs(['source', 'suffix']);
      return stringValue(arg(0, 'source'), line).endsWith(stringValue(arg(1, 'suffix'), line));
    }
    if (name === 'timeframe.in_seconds') {
      checkedArgs(['timeframe']);
      if (positional.length === 0 && !named.has('timeframe')) return chartSeconds;
      const timeframe = stringValue(arg(0, 'timeframe'), line).toUpperCase();
      const match = /^(\d+)?([SMHDW])?$/.exec(timeframe) ?? fail(line, `unsupported timeframe "${timeframe}".`);
      const amount = Number(match[1] ?? 1);
      const secondsPerUnit: Record<string, number> = { S: 1, H: 3600, D: 86400, W: 604800, M: 2592000 };
      return amount * (match[2] ? secondsPerUnit[match[2]] : 60);
    }
    if (name === 'time') {
      checkedArgs(['timeframe', 'session', 'timezone']);
      const session = stringValue(arg(1, 'session'), line);
      const zone = stringValue(arg(2, 'timezone', 'UTC'), line);
      const sessionMatch = /^(\d{4})-(\d{4})(?::([1-7]+))?$/.exec(session) ?? fail(line, `unsupported session "${session}".`);
      let local: { hour: number; minute: number; day: number };
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(executionCandles[bar].time * 1000);
        const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
        local = { hour: Number(part('hour')), minute: Number(part('minute')), day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday')) + 1 };
        if (local.day < 1 || local.hour > 23 || local.minute > 59) fail(line, 'invalid timezone result for time().');
      } catch (error) {
        if (error instanceof RangeError) fail(line, `invalid time zone "${zone}".`);
        throw error;
      }
      const start = Number(sessionMatch[1].slice(0, 2)) * 60 + Number(sessionMatch[1].slice(2));
      const end = Number(sessionMatch[2].slice(0, 2)) * 60 + Number(sessionMatch[2].slice(2));
      const minute = local.hour * 60 + local.minute;
      const days = sessionMatch[3] ?? '1234567';
      const previousDay = local.day === 1 ? 7 : local.day - 1;
      const inSession = start <= end
        ? days.includes(String(local.day)) && minute >= start && minute < end
        : (days.includes(String(local.day)) && minute >= start) || (days.includes(String(previousDay)) && minute < end);
      return inSession ? executionCandles[bar].time : Number.NaN;
    }
    if (name === 'plot') {
      checkedArgs(['series', 'title', 'color', 'linewidth', 'style', 'editable', 'show_last', 'offset', 'trackprice', 'histbase', 'display', 'format', 'precision', 'force_overlay']);
      if (positional.length > 4) fail(line, 'too many arguments for plot.');
      const value = numberValue(arg(0, 'series'), line);
      const title = stringValue(arg(1, 'title', 'Plot'), line);
      const color = stringValue(arg(2, 'color', DEFAULT_COLORS[plots.size % DEFAULT_COLORS.length]), line);
      const width = integer(arg(3, 'linewidth', 1), line, 1, 4, 'plot linewidth');
      const plot = plots.get(expression) ?? { title, color, lineWidth: width as 1 | 2 | 3 | 4, points: [] };
      plot.title = title;
      plot.color = color;
      plot.lineWidth = width as 1 | 2 | 3 | 4;
      if (Number.isFinite(value)) plot.points.push({ time: executionCandles[bar].time, value });
      plots.set(expression, plot);
      return Number.NaN;
    }
    if (name === 'hline') {
      checkedArgs(['price', 'title', 'color', 'linestyle', 'linewidth', 'editable', 'display']);
      if (positional.length > 2) fail(line, 'too many arguments for hline.');
      if (!plots.has(expression)) {
        const price = numberValue(arg(0, 'price'), line);
        const title = stringValue(arg(1, 'title', 'Horizontal Line'), line);
        const color = stringValue(arg(2, 'color', COLORS['color.gray']), line);
        const width = integer(arg(4, 'linewidth', 1), line, 1, 4, 'hline linewidth');
        plots.set(expression, { title, color, lineWidth: width as 1 | 2 | 3 | 4, points: executionCandles.map((candle) => ({ time: candle.time, value: price })) });
      }
      return Number.NaN;
    }
    if (name === 'plotshape' || name === 'alertcondition') {
      checkedArgs(name === 'plotshape'
        ? ['series', 'title', 'style', 'location', 'color', 'offset', 'text', 'textcolor', 'editable', 'size', 'show_last', 'display', 'force_overlay']
        : ['condition', 'title', 'message', 'alert_freq']);
      return Number.NaN;
    }
    if (name === 'alert') {
      checkedArgs(['message', 'freq']);
      return Number.NaN;
    }
    if (name === 'runtime.error') {
      checkedArgs(['message']);
      return fail(line, stringValue(arg(0, 'message'), line));
    }
    if (name.startsWith('table.')) {
      const operation = name.slice('table.'.length);
      if (operation === 'new') {
        checkedArgs(['position', 'columns', 'rows', 'bgcolor', 'frame_color', 'frame_width', 'border_color', 'border_width', 'force_overlay']);
        const columns = integer(arg(1, 'columns'), line, 1, 100, 'table columns');
        const rows = integer(arg(2, 'rows'), line, 1, 1000, 'table rows');
        return { kind: 'record', type: 'table', fields: new Map<string, PineValue>([['columns', columns], ['rows', rows], ['deleted', false]]) };
      }
      if (!['cell', 'merge_cells', 'clear', 'delete'].includes(operation)) fail(line, `unsupported function "${name}".`);
      const keys = operation === 'cell'
        ? ['table_id', 'column', 'row', 'text', 'width', 'height', 'text_color', 'text_halign', 'text_valign', 'text_size', 'bgcolor', 'tooltip', 'text_font_family', 'text_formatting']
        : operation === 'merge_cells'
          ? ['table_id', 'start_column', 'start_row', 'end_column', 'end_row']
          : operation === 'clear'
            ? ['table_id', 'start_column', 'start_row', 'end_column', 'end_row']
            : ['table_id'];
      checkedArgs(keys);
      const table = arg(0, 'table_id');
      if (missing(table)) return Number.NaN;
      const tableRecord = typeof table === 'object' && table.kind === 'record' && table.type === 'table' ? table : fail(line, `${name} requires a table id.`);
      if (operation === 'delete') { tableRecord.fields.set('deleted', true); return Number.NaN; }
      if (tableRecord.fields.get('deleted') === true) return Number.NaN;
      if (operation === 'cell' || operation === 'merge_cells') {
        const columns = numberValue(tableRecord.fields.get('columns')!, line);
        const rows = numberValue(tableRecord.fields.get('rows')!, line);
        const startColumn = integer(arg(1, operation === 'cell' ? 'column' : 'start_column'), line, 0, columns - 1, 'table column');
        const startRow = integer(arg(2, operation === 'cell' ? 'row' : 'start_row'), line, 0, rows - 1, 'table row');
        if (operation === 'merge_cells') {
          integer(arg(3, 'end_column'), line, startColumn, columns - 1, 'table end column');
          integer(arg(4, 'end_row'), line, startRow, rows - 1, 'table end row');
        }
      }
      return Number.NaN;
    }
    if (name === 'fill' || name === 'bgcolor') {
      checkedArgs(name === 'fill' ? ['plot1', 'plot2', 'color', 'title', 'editable', 'fillgaps', 'show_last', 'display', 'force_overlay'] : ['color', 'offset', 'editable', 'show_last', 'title', 'display', 'force_overlay']);
      return Number.NaN;
    }
    if (name === 'request.security' || name === 'request.security_lower_tf') {
      checkedArgs(['symbol', 'timeframe', 'expression', 'gaps', 'lookahead', 'ignore_invalid_symbol', 'currency', 'calc_bars_count']);
      const value = arg(2, 'expression');
      if (name === 'request.security') return value;
      const series = typeof value === 'object' && value.kind === 'array' ? value.values : [value];
      return { kind: 'array', values: series.map((entry) => ({ kind: 'array', values: [entry] })) };
    }
    if (name === 'color.new') {
      checkedArgs(['color', 'transp']);
      const colorValue = arg(0, 'color');
      const transparencyValue = arg(1, 'transp');
      if (missing(colorValue) || missing(transparencyValue)) return 'transparent';
      const color = stringValue(colorValue, line);
      const transparency = numberValue(transparencyValue, line);
      if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color) || transparency < 0 || transparency > 100) fail(line, 'color.new requires a hex color and transparency from 0 to 100.');
      return `${color.slice(0, 7)}${Math.round(255 * (1 - transparency / 100)).toString(16).padStart(2, '0')}`;
    }
    if (name === 'color.from_gradient') {
      checkedArgs(['value', 'bottom_value', 'top_value', 'bottom_color', 'top_color']);
      const value = numberValue(arg(0, 'value'), line);
      const low = numberValue(arg(1, 'bottom_value'), line);
      const high = numberValue(arg(2, 'top_value'), line);
      if (missing(value) || missing(low) || missing(high)) return 'transparent';
      if (high === low) fail(line, 'color.from_gradient bounds must be different.');
      const colors = [stringValue(arg(3, 'bottom_color'), line), stringValue(arg(4, 'top_color'), line)];
      if (colors.some((color) => !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color))) fail(line, 'color.from_gradient requires hex colors.');
      const ratio = Math.max(0, Math.min(1, (value - low) / (high - low)));
      const channels = [0, 2, 4, 6].map((offset) => {
        const first = offset === 6 && colors[0].length === 7 ? 255 : Number.parseInt(colors[0].slice(offset + 1, offset + 3), 16);
        const second = offset === 6 && colors[1].length === 7 ? 255 : Number.parseInt(colors[1].slice(offset + 1, offset + 3), 16);
        return Math.round(first + (second - first) * ratio).toString(16).padStart(2, '0');
      });
      return `#${channels.join('')}`;
    }
    if (name === 'color.rgb') {
      checkedArgs(['red', 'green', 'blue', 'transp']);
      const red = integer(arg(0, 'red'), line, 0, 255, 'color.rgb red');
      const green = integer(arg(1, 'green'), line, 0, 255, 'color.rgb green');
      const blue = integer(arg(2, 'blue'), line, 0, 255, 'color.rgb blue');
      const transparency = integer(arg(3, 'transp', 0), line, 0, 100, 'color.rgb transparency');
      const rgb = [red, green, blue].map((component) => component.toString(16).padStart(2, '0')).join('');
      const alpha = Math.round(255 * (1 - transparency / 100)).toString(16).padStart(2, '0');
      return `#${rgb}${alpha}`;
    }
    if (name.startsWith('math.')) {
      if (name === 'math.sum') {
        checkedArgs(['source', 'length']);
        const source = expression.args.find((entry) => entry.name === 'source')?.value ?? expression.args.find((entry) => !entry.name)?.value ?? fail(line, 'math.sum requires a source series.');
        const length = integer(arg(1, 'length'), line, 1, 5000, 'math.sum length');
        let total = 0;
        for (let index = 0; index < length; index++) {
          const value = history(source, scope).get(bar - index);
          if (typeof value !== 'number' || Number.isNaN(value)) return Number.NaN;
          total += value;
        }
        return total;
      }
      const fn = name === 'math.abs' ? Math.abs : name === 'math.max' ? Math.max : name === 'math.min' ? Math.min : name === 'math.round' ? Math.round : name === 'math.floor' ? Math.floor : name === 'math.log10' ? Math.log10 : undefined;
      if (name === 'math.avg') {
        if (positional.length < 1 || named.size) fail(line, 'invalid number of arguments for math.avg.');
        return positional.reduce<number>((sum, value) => sum + numberValue(value, line), 0) / positional.length;
      }
      if (!fn) return fail(line, `unsupported function "${name}".`);
      if ((['math.abs', 'math.round', 'math.floor', 'math.log10'].includes(name) ? positional.length !== 1 : positional.length < 2) || named.size) fail(line, `invalid number of arguments for ${name}.`);
      return fn(...positional.map((value) => numberValue(value, line)));
    }
    if (name.startsWith('ta.')) {
      if (name === 'ta.highest' || name === 'ta.lowest' || name === 'ta.mom' || name === 'ta.stdev') {
        checkedArgs(['source', 'length', 'biased']);
        const source = expression.args.find((entry) => entry.name === 'source')?.value ?? expression.args.find((entry) => !entry.name)?.value ?? fail(line, `${name} requires a source series.`);
        const current = numberValue(arg(0, 'source'), line);
        const length = integer(arg(1, 'length'), line, 1, 5000, `${name} length`);
        const values = Array.from({ length }, (_, index) => history(source, scope).get(bar - index));
        if (values.some((value) => typeof value !== 'number' || Number.isNaN(value))) return Number.NaN;
        const numbers = values as number[];
        if (name === 'ta.highest') return Math.max(...numbers);
        if (name === 'ta.lowest') return Math.min(...numbers);
        if (name === 'ta.mom') {
          const previous = history(source, scope).get(bar - length);
          return typeof previous === 'number' ? current - previous : Number.NaN;
        }
        const mean = numbers.reduce((sum, value) => sum + value, 0) / length;
        const sumSquares = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0);
        return Math.sqrt(sumSquares / Math.max(1, length - (arg(2, 'biased', true) === false ? 1 : 0)));
      }
      if (name === 'ta.barssince') {
        checkedArgs(['condition']);
        const condition = expression.args.find((entry) => entry.name === 'condition')?.value ?? expression.args.find((entry) => !entry.name)?.value ?? fail(line, 'ta.barssince requires a condition series.');
        for (let index = bar; index >= 0; index--) if (history(condition, scope).get(index) === true) return bar - index;
        return Number.NaN;
      }
      if (name === 'ta.crossover' || name === 'ta.crossunder') {
        checkedArgs(['source1', 'source2']);
        const sources = expression.args.filter((entry) => !entry.name || entry.name === 'source1' || entry.name === 'source2').slice(0, 2).map((entry) => entry.value);
        if (sources.length !== 2) fail(line, `${name} requires two source series.`);
        const first = numberValue(arg(0, 'source1'), line);
        const second = numberValue(arg(1, 'source2'), line);
        const priorFirst = history(sources[0], scope).get(bar - 1);
        const priorSecond = history(sources[1], scope).get(bar - 1);
        if (typeof priorFirst !== 'number' || typeof priorSecond !== 'number') return false;
        return name === 'ta.crossover' ? priorFirst <= priorSecond && first > second : priorFirst >= priorSecond && first < second;
      }
      if (name === 'ta.valuewhen') {
        checkedArgs(['condition', 'source', 'occurrence']);
        const [condition, source] = expression.args.filter((entry) => !entry.name).slice(0, 2).map((entry) => entry.value);
        if (!condition || !source) fail(line, 'ta.valuewhen requires a condition and source series.');
        const occurrence = integer(arg(2, 'occurrence'), line, 0, MAX_EXECUTION_BARS, 'ta.valuewhen occurrence');
        let count = 0;
        for (let index = bar; index >= 0; index--) {
          if (history(condition, scope).get(index) === true && count++ === occurrence) return history(source, scope).get(index) ?? Number.NaN;
        }
        return Number.NaN;
      }
      if (name === 'ta.tr') {
        checkedArgs(['handle_na']);
        const current = executionCandles[bar];
        const previous = executionCandles[bar - 1];
        if (!current) return Number.NaN;
        if (!previous) return arg(0, 'handle_na', false) === true ? current.high - current.low : Number.NaN;
        return Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close));
      }
      if (name === 'ta.dmi') {
        checkedArgs(['diLength', 'adxSmoothing']);
        const diLength = integer(arg(0, 'diLength'), line, 1, 5000, 'ta.dmi DI length');
        const adxLength = integer(arg(1, 'adxSmoothing'), line, 1, 5000, 'ta.dmi ADX smoothing');
        if (!dmiStates.has(expression)) dmiStates.set(expression, new WeakMap());
        const perScope = dmiStates.get(expression)!;
        if (!perScope.has(scope)) perScope.set(scope, new Map());
        const states = perScope.get(scope)!;
        const previous = states.get(bar - 1);
        const directional = (index: number) => {
          const current = executionCandles[index];
          const prior = executionCandles[index - 1];
          if (!current) return undefined;
          if (!prior) return { plus: 0, minus: 0, tr: current.high - current.low };
          const up = current.high - prior.high;
          const down = prior.low - current.low;
          return {
            plus: up > down && up > 0 ? up : 0,
            minus: down > up && down > 0 ? down : 0,
            tr: Math.max(current.high - current.low, Math.abs(current.high - prior.close), Math.abs(current.low - prior.close)),
          };
        };
        let plus: number;
        let minus: number;
        let tr: number;
        let adx: number | undefined;
        if (previous) {
          const sample = directional(bar)!;
          plus = (previous.plus * (diLength - 1) + sample.plus) / diLength;
          minus = (previous.minus * (diLength - 1) + sample.minus) / diLength;
          tr = (previous.tr * (diLength - 1) + sample.tr) / diLength;
          adx = previous.adx;
        } else {
          if (bar < diLength - 1) return { kind: 'array', values: [Number.NaN, Number.NaN, Number.NaN] };
          let plusSum = 0;
          let minusSum = 0;
          let trSum = 0;
          for (let index = bar - diLength + 1; index <= bar; index++) {
            const sample = directional(index)!;
            plusSum += sample.plus;
            minusSum += sample.minus;
            trSum += sample.tr;
          }
          plus = plusSum / diLength;
          minus = minusSum / diLength;
          tr = trSum / diLength;
        }
        const plusDi = tr === 0 ? 0 : 100 * plus / tr;
        const minusDi = tr === 0 ? 0 : 100 * minus / tr;
        const total = plusDi + minusDi;
        const dx = total === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / total;
        if (adx === undefined) {
          if (bar >= diLength + adxLength - 2) {
            let dxSum = 0;
            for (let index = bar - adxLength + 1; index <= bar; index++) {
              if (index === bar) {
                dxSum += dx;
              } else {
                const state = states.get(index);
                if (!state) return { kind: 'array', values: [plusDi, minusDi, Number.NaN] };
                const statePlusDi = state.tr === 0 ? 0 : 100 * state.plus / state.tr;
                const stateMinusDi = state.tr === 0 ? 0 : 100 * state.minus / state.tr;
                const stateTotal = statePlusDi + stateMinusDi;
                dxSum += stateTotal === 0 ? 0 : 100 * Math.abs(statePlusDi - stateMinusDi) / stateTotal;
              }
            }
            adx = dxSum / adxLength;
          }
        } else adx = (adx * (adxLength - 1) + dx) / adxLength;
        states.set(bar, { plus, minus, tr, adx });
        return { kind: 'array', values: [plusDi, minusDi, adx ?? Number.NaN] };
      }
      if (name === 'ta.atr') {
        checkedArgs(['length']);
        const period = integer(arg(0, 'length'), line, 1, 5000, 'ta.atr length');
        const previous = history(expression, scope).get(bar - 1);
        const trueRange = (index: number) => {
          const current = executionCandles[index];
          if (!current) return Number.NaN;
          const prior = executionCandles[index - 1];
          return prior
            ? Math.max(current.high - current.low, Math.abs(current.high - prior.close), Math.abs(current.low - prior.close))
            : current.high - current.low;
        };
        if (typeof previous === 'number' && Number.isFinite(previous)) return (previous * (period - 1) + trueRange(bar)) / period;
        if (bar < period - 1) return Number.NaN;
        let sum = 0;
        for (let index = bar - period + 1; index <= bar; index++) sum += trueRange(index);
        return sum / period;
      }
      if (name === 'ta.change') {
        checkedArgs(['source', 'length']);
        const source = expression.args.find((entry) => entry.name === 'source')?.value ?? expression.args.find((entry) => !entry.name)?.value ?? fail(line, 'ta.change requires a source series.');
        const current = numberValue(arg(0, 'source'), line);
        const period = integer(arg(1, 'length', 1), line, 1, 5000, 'ta.change length');
        const previous = history(source, scope).get(bar - period);
        return typeof previous === 'number' ? current - previous : Number.NaN;
      }
      if (name === 'ta.pivothigh' || name === 'ta.pivotlow') {
        checkedArgs(['source', 'leftbars', 'rightbars']);
        const explicitSource = positional.length >= 3 || named.has('source');
        const left = integer(arg(explicitSource ? 1 : 0, 'leftbars'), line, 0, 5000, 'pivot leftbars');
        const right = integer(arg(explicitSource ? 2 : 1, 'rightbars'), line, 0, 5000, 'pivot rightbars');
        const sourceArg = expression.args.find((entry) => entry.name === 'source') ?? (explicitSource ? expression.args.find((entry) => !entry.name) : undefined);
        let values: (number | undefined)[];
        if (sourceArg) {
          const input = sourceArg.value;
          numberValue(arg(0, 'source'), line);
          values = Array.from({ length: left + right + 1 }, (_, i) => history(input, scope).get(bar - left - right + i) as number | undefined);
        } else values = Array.from({ length: left + right + 1 }, (_, i) => executionCandles[bar - left - right + i]?.[name === 'ta.pivothigh' ? 'high' : 'low']);
        const candidate = values[left];
        if (candidate === undefined || values.some((value) => value === undefined || !Number.isFinite(value))) return Number.NaN;
        const high = name === 'ta.pivothigh';
        return values.every((value, i) => i === left || (i < left ? high ? value! <= candidate : value! >= candidate : high ? value! < candidate : value! > candidate)) ? candidate : Number.NaN;
      }
      if (!['ta.sma', 'ta.ema', 'ta.rsi'].includes(name)) return fail(line, `unsupported function "${name}".`);
      checkedArgs(['source', 'length']);
      const inputExpr = expression.args.find((entry) => entry.name === 'source')?.value ?? expression.args.find((entry) => !entry.name)?.value;
      if (!inputExpr) return fail(line, `${name} requires a numeric series as its first argument.`);
      numberValue(arg(0, 'source'), line);
      const period = integer(arg(1, 'length'), line, 1, 5000, `${name} length`);
      const values = history(inputExpr, scope);
      const previous = history(expression, scope).get(bar - 1);
      if (name === 'ta.sma' || (name === 'ta.ema' && (previous === undefined || missing(previous)))) {
        if (bar < period - 1) return Number.NaN;
        let sum = 0;
        for (let i = bar - period + 1; i <= bar; i++) sum += numberValue(values.get(i) ?? Number.NaN, line);
        return sum / period;
      }
      if (name === 'ta.ema') return numberValue(arg(0, 'source'), line) * (2 / (period + 1)) + numberValue(previous ?? Number.NaN, line) * (1 - 2 / (period + 1));
      if (bar < period) return Number.NaN;
      // Wilder averages are maintained per call site and scope, never across runs.
      if (!taStates.has(expression)) taStates.set(expression, new WeakMap());
      if (!taStates.get(expression)!.has(scope)) taStates.get(expression)!.set(scope, new Map());
      const states = taStates.get(expression)!.get(scope)!;
      const previousState = states.get(bar - 1);
      let gain: number;
      let loss: number;
      if (!previousState) {
        gain = 0;
        loss = 0;
        for (let i = 1; i <= period; i++) {
          const change = numberValue(values.get(i) ?? Number.NaN, line) - numberValue(values.get(i - 1) ?? Number.NaN, line);
          gain += Math.max(change, 0); loss += Math.max(-change, 0);
        }
        gain /= period;
        loss /= period;
      } else {
        const change = numberValue(arg(0, 'source'), line) - numberValue(values.get(bar - 1) ?? Number.NaN, line);
        gain = (previousState.gain * (period - 1) + Math.max(change, 0)) / period;
        loss = (previousState.loss * (period - 1) + Math.max(-change, 0)) / period;
      }
      states.set(bar, { gain, loss });
      return loss === 0 ? gain === 0 ? 50 : 100 : 100 - 100 / (1 + gain / loss);
    }
    return fail(line, `unsupported function "${name}".`);
  };
  const taStates = new WeakMap<Expr, WeakMap<Scope, Map<number, { gain: number; loss: number }>>>();
  const dmiStates = new WeakMap<Expr, WeakMap<Scope, Map<number, { plus: number; minus: number; tr: number; adx?: number }>>>();
  type Execution = { value: PineValue; signal?: 'break' | 'continue' };
  const execute = (statements: Statement[], scope: Scope): Execution => {
    let value: PineValue = Number.NaN;
    for (const statement of statements) {
      const line = statement.line;
      tick(line);
      switch (statement.kind) {
        case 'break': case 'continue':
          if (!loopDepth) fail(line, `${statement.kind} is only valid inside a loop.`);
          return { value, signal: statement.kind };
        case 'assignment': {
          if (!persistent.has(scope)) persistent.set(scope, new Set());
          if (statement.persistent && persistent.get(scope)!.has(statement)) {
            value = resolve(statement.name, scope, line);
            scope.set(statement.name, value, bar);
            break;
          }
          value = evaluateExpr(statement.expression, scope, line);
          const parts = statement.name.split('.');
          if (parts.length > 1) {
            const field = parts.pop()!;
            const object = resolve(parts.join('.'), scope, line);
            if (typeof object !== 'object' || object.kind !== 'record') fail(line, 'assignment requires a mutable Pine record.');
            const record = object as PineRecord;
            if (!record.fields.has(field)) fail(line, `type "${record.type}" has no field "${field}".`);
            record.fields.set(field, value);
          } else {
            const owner = statement.reassign ? scope.owner(statement.name) : scope;
            if (!owner) fail(line, `cannot reassign unknown identifier "${statement.name}".`);
            owner!.set(statement.name, value, bar);
          }
          if (statement.persistent) persistent.get(scope)!.add(statement);
          break;
        }
        case 'tupleAssignment': {
          const tuple = evaluateExpr(statement.expression, scope, line);
          if (typeof tuple !== 'object' || tuple.kind !== 'array') return fail(line, 'tuple assignment requires a tuple result.');
          if (tuple.values.length !== statement.names.length) return fail(line, 'tuple assignment result length does not match.');
          const values = tuple.values;
          statement.names.forEach((name, index) => scope.set(name, values[index], bar));
          value = values[values.length - 1] ?? Number.NaN;
          break;
        }
        case 'expression': value = evaluateExpr(statement.expression, scope, line); break;
        case 'plot': {
          value = evaluateExpr(statement.expression, scope, line);
          if (typeof value !== 'number') fail(line, 'plot() requires a numeric series.');
          const color = stringValue(evaluateExpr(statement.color, scope, line), line);
          if (!plots.has(statement)) plots.set(statement, { title: statement.title, color, lineWidth: statement.lineWidth, points: [] });
          const plot = plots.get(statement)!;
          plot.color = color;
          if (typeof value === 'number' && Number.isFinite(value)) plot.points.push({ time: executionCandles[bar].time, value });
          break;
        }
        case 'if': {
          const body = booleanValue(evaluateExpr(statement.condition, scope, line), line) ? statement.yes : statement.no;
          const result = execute(body, scoped(body, scope));
          value = result.value;
          if (result.signal) return result;
          break;
        }
        case 'for': {
          const start = numberValue(evaluateExpr(statement.start, scope, line), line);
          const end = numberValue(evaluateExpr(statement.end, scope, line), line);
          if (Number.isNaN(start) || Number.isNaN(end)) break;
          if (!Number.isInteger(start) || !Number.isInteger(end)) fail(line, 'for bounds must be integers.');
          const count = Math.abs(end - start) + 1;
          if (count > MAX_LOOP) fail(line, 'loop iteration limit exceeded.');
          const local = scoped(statement, scope);
          loopDepth++;
          for (let i = 0; i < count; i++) {
            local.set(statement.name, start + i * (start <= end ? 1 : -1), bar);
            const result = execute(statement.body, local);
            value = result.value;
            if (result.signal === 'break') break;
          }
          loopDepth--;
          break;
        }
        case 'forEach': {
          const collection = array(evaluateExpr(statement.collection, scope, line), line).values.slice();
          if (collection.length > MAX_LOOP) fail(line, 'loop iteration limit exceeded.');
          const local = scoped(statement, scope);
          loopDepth++;
          for (const item of collection) {
            local.set(statement.name, item, bar);
            const result = execute(statement.body, local);
            value = result.value;
            if (result.signal === 'break') break;
          }
          loopDepth--;
          break;
        }
        case 'while': {
          const local = scoped(statement, scope);
          let iterations = 0;
          loopDepth++;
          while (booleanValue(evaluateExpr(statement.condition, local, line), line)) {
            tick(line);
            if (++iterations > MAX_LOOP) fail(line, 'loop iteration limit exceeded.');
            const result = execute(statement.body, local);
            value = result.value;
            if (result.signal === 'break') break;
          }
          loopDepth--;
          break;
        }
      }
    }
    return { value };
  };
  for (bar = 0; bar < executionCandles.length; bar++) {
    barSteps = 0;
    const absoluteBar = bar + barOffset;
    for (const key of ['open', 'high', 'low', 'close', 'volume', 'time'] as const) root.set(key, executionCandles[bar][key], bar);
    root.set('bar_index', absoluteBar, bar);
    root.set('last_bar_index', candles.length - 1, bar);
    root.set('last_bar_time', candles[candles.length - 1].time, bar);
    root.set('time_close', executionCandles[bar].time + chartSeconds, bar);
    root.set('timenow', executionCandles[executionCandles.length - 1].time + chartSeconds, bar);
    root.set('chart', { kind: 'record', type: 'chart', fields: new Map<string, PineValue>([['is_standard', true]]) }, bar);
    root.set('barstate', { kind: 'record', type: 'barstate', fields: new Map<string, PineValue>([['isfirst', bar === 0], ['islast', bar === executionCandles.length - 1], ['isconfirmed', true]]) }, bar);
    execute(program.statements, root);
    for (const [name, value] of root.values) root.set(name, value, bar);
    if (onProgress && (bar % 25 === 0 || bar === executionCandles.length - 1)) {
      onProgress({ completedBars: bar + 1, totalBars: executionCandles.length });
    }
  }
  if (!executionCandles.length) {
    for (const statement of program.statements) {
      if (statement.kind === 'plot') plots.set(statement, { title: statement.title, color: stringValue(evaluateExpr(statement.color, root, statement.line), statement.line), lineWidth: statement.lineWidth, points: [] });
    }
  }
  const result = [...plots.values()] as PineResult;
  result.drawings = handles.filter((handle) => !handle.deleted).map((handle) => handle.drawing);
  return result;
}

export function compilePineScript(source: string): (
  candles: Candle[],
  onProgress?: (progress: PineProgress) => void,
  inputValues?: Record<string, PineInputValue>,
) => PineResult {
  const program = parseScript(source);
  return (candles, onProgress, inputValues) => evaluate(program, candles, onProgress, inputValues);
}

export function runPineScript(
  source: string,
  candles: Candle[],
  onProgress?: (progress: PineProgress) => void,
  inputValues?: Record<string, PineInputValue>,
): PineResult {
  return compilePineScript(source)(candles, onProgress, inputValues);
}
