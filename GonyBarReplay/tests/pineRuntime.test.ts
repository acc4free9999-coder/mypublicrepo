import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compilePineScript, getPineInputs, runPineScript } from '@/pine/runtime';
import type { Candle } from '@/types';

const candles = (closes: number[]): Candle[] => closes.map((close, i) => ({
  time: i,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: i * 10,
}));

describe('Pine indicator runtime', () => {
  it('plots a named EMA with the requested color', () => {
    const plots = runPineScript(
      '//@version=5\nindicator("EMA")\nplot(ta.ema(close, 3), title="Trend", color=color.orange)',
      candles([1, 2, 3, 4]),
    );
    expect(plots).toHaveLength(1);
    expect(plots[0].title).toBe('Trend');
    expect(plots[0].color).toBe('#ff9800');
    expect(plots[0].points.map((point) => point.value)).toEqual([2, 3]);
  });

  it('parses multiline declarations and plot options without treating string comments as code comments', () => {
    const plots = runPineScript(
      'indicator(\n  "Test",\n  overlay=true\n)\nplot(\n  close,\n  title="close // price",\n  color=color.blue,\n  linewidth=3\n)',
      candles([2]),
    );
    expect(plots[0]).toMatchObject({ title: 'close // price', color: '#2196f3', lineWidth: 3 });
  });

  it('supports RGB colors with optional transparency and named components', () => {
    const plots = runPineScript(
      `plot(close, color=color.rgb(20, 25, 33))
plot(close, color=color.rgb(red=24, green=110, blue=67, transp=50))`,
      candles([2]),
    );
    expect(plots.map((plot) => plot.color)).toEqual(['#141921ff', '#186e4380']);
    expect(() => runPineScript('plot(close, color=color.rgb(256, 0, 0))', candles([1]))).toThrow('color.rgb red');
  });

  it('casts na and integer values to Pine colors', () => {
    const plots = runPineScript(
      `plot(close, color=color(na))
plot(close, color=color(1193046))`,
      candles([2]),
    );
    expect(plots.map((plot) => plot.color)).toEqual(['transparent', '#123456ff']);
  });

  it('creates and deletes labels from their method or namespace API', () => {
    const result = runPineScript(
      `var label marker = na
if barstate.isfirst
    marker := label.new(bar_index, high, "HH", color=color(na), style=label.style_label_down, textcolor=color.red, size=size.tiny, force_overlay=true)
if barstate.islast
    marker.delete()
plot(close)`,
      candles([2, 3]),
    );
    expect(result[0].points.map((point) => point.value)).toEqual([2, 3]);
    expect(() => runPineScript('label.delete(label.new(bar_index, high, "test"))\nplot(close)', candles([1]))).not.toThrow();
  });

  it('accepts single-quoted Pine strings and ignores comment markers inside them', () => {
    const plots = runPineScript(
      `indicator('Test indicator')
plot(close, title='Close // price', color=color.blue)`,
      candles([2]),
    );
    expect(plots[0]).toMatchObject({ title: 'Close // price', color: '#2196f3' });
  });

  it('supports variables, arithmetic, history offsets, and RSI', () => {
    const plots = runPineScript(
      '//@version=6\nlength = input.int(2, title="Length")\nprev = close[1]\nplot(ta.rsi(close, length) + (close - prev), title="Combined")',
      candles([1, 2, 3, 2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([101, 49]);
  });

  it('accepts max_bars_back declarations within its execution window', () => {
    const result = runPineScript(
      `max_bars_back(time, 5000)
max_bars_back(close, 5000)
plot(close)`,
      candles([2, 4]),
    );
    expect(result[0].points.map((point) => point.value)).toEqual([2, 4]);
    expect(() => runPineScript('max_bars_back(close, 5001)\nplot(close)', candles([1]))).toThrow('max_bars_back length');
  });

  it('treats the first bar in the bounded execution window as barstate.isfirst', () => {
    const source = `var array<int> initialized = array.new<int>()
if barstate.isfirst
    initialized.push(1)
plot(initialized.size())`;
    const result = runPineScript(source, Array.from({ length: 5001 }, (_, i) => ({
      time: i * 900, open: 10, high: 11, low: 9, close: 10, volume: 1,
    })));
    expect(result[0].points.at(-1)?.value).toBe(1);
  });

  it('runs the checked-in test.pine script on a chart candle series', () => {
    const source = readFileSync(new URL('../test.pine', import.meta.url), 'utf8');
    const data = Array.from({ length: 5000 }, (_, i) => {
      const close = 100 + Math.sin(i / 3) * 5 + i * 0.1;
      return { time: 1_700_000_000 + i * 900, open: close - 0.2, high: close + 1, low: close - 1, close, volume: 100 + i };
    });
    const result = runPineScript(source, data);
    expect(result.length).toBeGreaterThan(0);
    expect(result.drawings.length).toBeLessThanOrEqual(1000);
  }, 30_000);

  it('parses Pine input option arrays, hex colors, comparisons, and ternary plots', () => {
    const plots = runPineScript(
      `len = input.int(2, 'Swings', minval=1, group='Settings')
opt = input.string('Only Wicks', 'Options', options=['Only Wicks', 'Only Breaks'], group='Settings')
col = input.color(#089981, 'Bull')
isWick = opt == 'Only Wicks'
plot(isWick ? ta.sma(close, len) : na, title='Swing', color=col)`,
      candles([2, 4, 6]),
    );
    expect(plots[0]).toMatchObject({ title: 'Swing', color: '#089981' });
    expect(plots[0].points.map((point) => point.value)).toEqual([3, 5]);
  });

  it('exposes Pine inputs and applies configured values to script execution', () => {
    const source = `length = input.int(2, 'Length', minval=1, maxval=10, group='Trend')
enabled = input.bool(true, 'Enabled')
mode = input.string('Close', 'Source', options=['Close', 'High'])
plot(enabled ? ta.sma(mode == 'High' ? high : close, length) : na)`;
    expect(getPineInputs(source)).toEqual([
      { id: 'length', title: 'Length', type: 'int', defaultValue: 2, min: 1, max: 10, group: 'Trend' },
      { id: 'enabled', title: 'Enabled', type: 'bool', defaultValue: true },
      { id: 'mode', title: 'Source', type: 'string', defaultValue: 'Close', options: ['Close', 'High'] },
    ]);

    const result = runPineScript(source, candles([1, 2, 3]), undefined, { length: 1, enabled: true, mode: 'High' });
    expect(result[0].points.map((point) => point.value)).toEqual([2, 3, 4]);
    expect(() => runPineScript(source, candles([1]), undefined, { length: 11 })).toThrow('above maxval');
    expect(() => runPineScript(source, candles([1]), undefined, { mode: 'Open' })).toThrow('one of its options');
  });

  it('supports Liquidity Sweeps settings and a typed receiver method', () => {
    const plots = runPineScript(
      `len = input.int(5, 'Swings', minval=1, group='Liquidity Sweeps')
opt = input.string('Only Wicks', 'options', options=['Only Wicks', 'Only Outbreaks & Retest', 'Wicks + Outbreaks & Retest'])
colBl = input.color(#089981, 'Bull')
extend = input.bool(true, 'Extend')
oW = opt == 'Only Wicks'
method n(float piv) => bool out = not na(piv)
plot(close.n() ? close : na)`,
      candles([2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([2]);
  });

  it('accepts Pine parameter qualifiers', () => {
    const result = runPineScript(
      `method identity(simple int value) => value
plot(close.identity())`,
      candles([2]),
    );
    expect(result[0].points.map((point) => point.value)).toEqual([2]);
  });

  it('supports tuple assignment with ta.dmi and ta.atr', () => {
    const result = runPineScript(
      `[plus, minus, adx] = ta.dmi(2, 2)
plot(plus)
plot(minus)
plot(adx)
plot(ta.atr(2))`,
      candles([1, 2, 3, 4, 5, 6]),
    );
    expect(result.map((plot) => plot.points.map(({ value }) => value))).toEqual([
      [100 / 6, 25, 175 / 6, 31.25, 775 / 24],
      [0, 0, 0, 0, 0],
      [100, 100, 100, 100],
      [3, 3, 3, 3, 3],
    ]);
  });

  it('supports typed chart.point values and mutable fields', () => {
    const result = runPineScript(
      `type Anchor
    chart.point point
var chart.point p = chart.point.from_index(2, 10)
a = Anchor.new(chart.point.from_index(1, 5))
a.point.price := p.price
plot(a.point.index + a.point.price)`,
      candles([1]),
    );
    expect(result[0].points[0].value).toBe(11);
  });

  it('joins indented ternary continuations', () => {
    const result = runPineScript(
      `value = close > 1 ? 10
    : close < 1 ? 20
    : 30
plot(value)`,
      candles([2]),
    );
    expect(result[0].points[0].value).toBe(10);
  });

  it('parses custom type fields, constructs records, and plots a field', () => {
    const plots = runPineScript(
      `type piv
  float prc
  int bix
  bool brk
p = piv.new(12.5, 3, false)
plot(p.prc)`,
      candles([2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([12.5]);
  });

  it('supports mutable arrays, type constructors, and array member operations', () => {
    const plots = runPineScript(
      `type pivot
  float price
  bool broken
var array<pivot> pivots = array.new<pivot>(1, pivot.new())
pivots.unshift(pivot.new(12.5, true))
p = pivots.get(0)
p.broken := false
price = p.price
count = pivots.size()
plot(price + count + (p.broken ? 100 : 0))`,
      candles([2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([14.5]);
  });

  it('accepts typed array declarations without whitespace before the variable name', () => {
    const plots = runPineScript(
      `type pivot
    float price
var array< pivot >pivots = array.new< pivot >(1, pivot.new())
var array<pivot>other = array.new<pivot>()
plot(pivots.size() + other.size())`,
      candles([2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([1]);
  });

  it('omits undefined warmup values and updates only with the provided bars', () => {
    const source = 'plot(ta.sma(close, 3))';
    const all = runPineScript(source, candles([2, 4, 6, 8]));
    const prefix = runPineScript(source, candles([2, 4, 6]));
    expect(all[0].points.map((point) => point.value)).toEqual([4, 6]);
    expect(prefix[0].points).toEqual(all[0].points.slice(0, 1));
  });

  it('rejects scripts outside the supported subset with actionable errors', () => {
    expect(() => runPineScript('plot(close > open)', candles([1]))).toThrow('plot() requires a numeric series');
    expect(() => runPineScript('plot(ta.macd(close, 12, 26, 9))', candles([1]))).toThrow('unsupported function');
    expect(() => runPineScript('//@version=4\nplot(close)', candles([1]))).toThrow('versions 5 and 6');
    expect(() => runPineScript('strategy("Test")\nplot(close)', candles([1]))).toThrow('strategy scripts are not supported');
    expect(runPineScript('type pivot\n  float price\np = pivot.new(3)\nplot(p.price)', candles([1]))[0].points[0].value).toBe(3);
  });

  it('executes nested if/else, else-if, ascending and descending loops, and persistent variables per bar', () => {
    const plots = runPineScript(
      `var int total = 0
if close > 2
    for i = 3 to 1
        if i == 2
            continue
        total := total + i
else if close == 2
    for i = 1 to 3
        if i == 3
            break
        total := total + i
else
    total := total - 1
plot(total)
plot(total[1])`,
      candles([1, 2, 3, 4]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([-1, 2, 6, 10]);
    expect(plots[1].points.map((point) => point.value)).toEqual([-1, 2, 6]);
  });

  it('executes while loops and enforces a loop iteration limit', () => {
    const result = runPineScript(
      `i = 0
while i < 3
    i += 1
plot(i)`,
      candles([1]),
    );
    expect(result[0].points[0].value).toBe(3);
    expect(() => runPineScript('while true\n    x = 1\nplot(close)', candles([1]))).toThrow('loop iteration limit');
  });

  it('supports compound arithmetic reassignment', () => {
    const plots = runPineScript(
      `var int total = 1
total += close
total *= 2
total -= 1
total /= 2
total %= 5
plot(total)`,
      candles([2, 3]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([2.5, 0]);
  });

  it('returns the last method value and resolves switch branches and defaults without eager side effects', () => {
    const plots = runPineScript(
      `method adjust(float value, string choice = 'double') =>
    result = switch choice
        'double' => value * 2
        'triple' =>
            temp = value * 3
            temp + 1
        => value
    result + 10
method positive(float value) =>
    switch
        value > 2 => true
        => false
plot(close.adjust())
plot(close.adjust('triple'))
plot(close.adjust('other'))
plot(close.positive() ? close : na)`,
      candles([2, 3]),
    );
    expect(plots.map((plot) => plot.points.map((point) => point.value))).toEqual([[14, 16], [17, 20], [12, 13], [3]]);
  });

  it('keeps locals separate from globals and different call sites', () => {
    const plots = runPineScript(
      `value = 99
method count(float receiver) =>
    var int total = 0
    value = receiver * 2
    total := total + value
    total
plot(close.count())
plot((close + 1).count())
plot(value)`,
      candles([1, 2]),
    );
    expect(plots.map((plot) => plot.points.map((point) => point.value))).toEqual([[2, 6], [4, 10], [99, 99]]);
  });

  it('keeps branch-local persistent state and local history separate', () => {
    const result = runPineScript(
      `method count(float value) =>
    var int unchanged = 7
    previous = unchanged[1]
    if value > 2
        var int total = 10
        total := total + 1
        total
    else
        var int total = 100
        total := total + 2
        total
plot(close.count())`,
      candles([1, 3, 1, 3]),
    );
    expect(result[0].points.map((point) => point.value)).toEqual([102, 11, 104, 12]);
    const history = runPineScript(
      `method previous(float value) =>
    var int unchanged = 7
    unchanged[1]
plot(close.previous())`,
      candles([1, 2, 3]),
    );
    expect(history[0].points.map((point) => point.value)).toEqual([7, 7]);
  });

  it('confirms pivots only after right bars, including explicit sources and tied extremes', () => {
    const plots = runPineScript(
      `plot(ta.pivothigh(1, 1))
plot(ta.pivotlow(1, 1))
plot(ta.pivothigh(close, 1, 1))
plot(ta.pivotlow(source=close, leftbars=1, rightbars=1))`,
      candles([2, 5, 5, 1, 4, 2]),
    );
    expect(plots[0].points).toEqual([{ time: 3, value: 6 }, { time: 5, value: 5 }]);
    expect(plots[1].points).toEqual([{ time: 4, value: -1 }]);
    expect(plots[2].points).toEqual([{ time: 3, value: 5 }, { time: 5, value: 4 }]);
    expect(plots[3].points).toEqual([{ time: 4, value: 1 }]);
  });

  it('creates, mutates, reads, and deletes line and box handles stored on records', () => {
    const result = runPineScript(
      `type Drawing
    line ln
    box bx
var d = Drawing.new()
if bar_index == 0
    d.ln := line.new(0, high, 1, low, color=color.red, style=line.style_dotted, width=2)
    d.bx := box.new(time, high, time + 10, low, xloc=xloc.bar_time, border_color=na, border_width=0, bgcolor=color.new(color.teal, 80))
else
    d.ln.set_right(bar_index + 2)
    box.set_right(d.bx, time + 10)
plot(line.get_left(d.ln))
plot(d.bx.get_top())
plot(box.get_bottom(d.bx))
if bar_index == 2
    d.ln.delete()
    box.delete(d.bx)
    line.delete(na)`,
      candles([3, 4]),
    );
    expect(result.map((plot) => plot.points.map((point) => point.value))).toEqual([[0, 0], [4, 4], [1, 1]]);
    expect(result.drawings).toEqual([
      { id: 1, kind: 'line', x1: 0, y1: 4, x2: 3, y2: 1, color: '#f23645', style: 'dotted', width: 2, xloc: 'bar_index', extend: 'none' },
      { id: 2, kind: 'box', left: 0, top: 4, right: 11, bottom: 1, borderColor: 'transparent', borderWidth: 0, borderStyle: 'solid', bgcolor: '#08998133', xloc: 'bar_time', extend: 'none' },
    ]);
    const deleted = runPineScript(
      `var ln = line.new(0, 1, 1, 2)
var bx = box.new(0, 2, 1, 1)
line.delete(ln)
bx.delete()`,
      candles([1]),
    );
    expect(deleted).toHaveLength(0);
    expect(deleted.drawings).toEqual([]);
  });

  it('runs a sweep-style record/array/method workflow and resets all state for every visible prefix', () => {
    const source = `type pivot
    float price
    int index
    bool swept = false
    line ln
    box bx
method l(pivot p, color css, string style = 'sol') =>
    st = switch style
        'dot' => line.style_dotted
        'das' => line.style_dashed
        => line.style_solid
    p.ln := line.new(p.index, p.price, bar_index, p.price, color=css, style=st)
    p.ln
var array<pivot> pivots = array.new<pivot>()
ph = ta.pivothigh(1, 1)
if not na(ph)
    pivots.unshift(pivot.new(ph, bar_index - 1))
if pivots.size() > 0
    for i = pivots.size() - 1 to 0
        p = pivots.get(i)
        if high > p.price and close < p.price and not p.swept
            p.l(color.red, 'dot')
            p.bx := box.new(bar_index - 1, high, bar_index, p.price, bgcolor=color.new(color.red, 70))
            p.swept := true
        if p.swept
            p.ln.set_x2(bar_index)
            p.bx.set_right(bar_index)
        if bar_index - p.index > 4
            old = pivots.remove(i)
            old.ln.delete()
            old.bx.delete()
plot(pivots.size())`;
    const allCandles = candles([2, 5, 3, 5.5, 3, 2, 1, 2]);
    allCandles[3].close = 5;
    const compiled = compilePineScript(source);
    const early = compiled(allCandles.slice(0, 3));
    expect(early.drawings).toEqual([]);
    const swept = compiled(allCandles.slice(0, 4));
    expect(swept.drawings).toHaveLength(2);
    expect(swept.drawings[0]).toMatchObject({ kind: 'line', x1: 1, y1: 6, x2: 3, style: 'dotted' });
    expect(swept.drawings[1]).toMatchObject({ kind: 'box', left: 2, right: 3, top: 6.5, bottom: 6, bgcolor: '#f236454d' });
    const extended = compiled(allCandles.slice(0, 5));
    expect(extended.drawings[0]).toMatchObject({ x2: 4 });
    expect(swept.drawings[0]).toMatchObject({ x2: 3 });
    expect(compiled(allCandles.slice(0, 3))).toEqual(early);
    expect(compiled(allCandles).drawings).toEqual([]);
    expect(compiled(allCandles.slice(0, 4))).toEqual(swept);
  });

  it('supports namespace array operations, record aliases, and chained remove results', () => {
    const result = runPineScript(
      `type item
    float price = 4
    line ln
var array<item> items = array.new<item>()
if bar_index == 0
    array.unshift(items, item.new(4, line.new(0, 4, 1, 4)))
    p = array.get(items, 0)
    p.price := 9
plot(array.size(items) > 0 ? items.get(0).price : 0)
if bar_index == 1
    items.remove(0).ln.delete()`,
      candles([1, 2]),
    );
    expect(result[0].points.map((point) => point.value)).toEqual([9, 9]);
    expect(result.drawings).toEqual([]);
  });

  it('short-circuits logical operators and ternaries around unsafe array access', () => {
    const result = runPineScript(
      `a = array.new<float>()
test = a.size() > 0 and a.get(0) > 0
test2 = a.size() == 0 or a.get(0) > 0
plot(test ? a.get(0) : test2 ? 1 : 2)`,
      candles([1]),
    );
    expect(result[0].points[0].value).toBe(1);
  });

  it('enforces loop, call-depth, array-growth, and drawing-object limits', () => {
    expect(() => runPineScript('for i = 0 to 10000\n    line.new(0, 1, 1, 1)', candles([1]))).toThrow('loop iteration limit');
    const boundedDrawings = runPineScript('for i = 0 to 501\n    line.new(i, 1, i + 1, 1)', candles([1]));
    expect(boundedDrawings.drawings).toHaveLength(500);
    expect(boundedDrawings.drawings[0]).toMatchObject({ id: 3, x1: 2 });
    expect(() => runPineScript('a = array.new<float>(100000)\na.unshift(1)\nplot(close)', candles([1]))).toThrow('array size limit');
    expect(() => runPineScript('method recur(float x) => x.recur()\nplot(close.recur())', candles([1]))).toThrow('call depth limit');
    expect(() => runPineScript('break\nplot(close)', candles([1]))).toThrow('only valid inside a loop');
    expect(() => runPineScript('for i = 0 to 1000\n    for j = 0 to 1000\n        x = 1\nplot(close)', candles([1]))).toThrow('execution limit');
  });

  it('retains empty plot metadata and returns no drawings when the visible prefix is empty', () => {
    const result = runPineScript(
      `col = input.color(color.orange)
plot(close, title='Close', color=col)
line.new(0, 1, 1, 1)`,
      [],
    );
    expect(result[0]).toEqual({ title: 'Close', color: '#ff9800', lineWidth: 1, points: [] });
    expect(result.drawings).toEqual([]);
  });

  it('keeps unsupported constructs and invalid object operations explicit', () => {
    expect(() => compilePineScript('return 1\nplot(close)')).toThrow('unsupported syntax "return"');
    expect(() => runPineScript('a = array.new<float>()\nplot(a.get(0))', candles([1]))).toThrow('array index');
    expect(() => runPineScript('line.new(0, 1, 1, 1, nonsense=1)', candles([1]))).toThrow('unsupported line.new argument');
    expect(() => runPineScript('line.new(0, 1, 1, 1)\nbox.delete(1)', candles([1]))).toThrow('requires a box handle');
    expect(() => runPineScript('line.new(0, 1, 1, 1)\nline.set_color(1, color.red)', candles([1]))).toThrow('requires a line handle');
    expect(() => runPineScript('x := 1\nplot(close)', candles([1]))).toThrow('cannot reassign unknown');
  });
});
