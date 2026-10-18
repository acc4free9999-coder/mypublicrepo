import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export function parseMt5(text, source) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const header = lines.shift().split("\t");
  const required = ["<DATE>", "<OPEN>", "<HIGH>", "<LOW>", "<CLOSE>"];
  for (const column of required) {
    if (!header.includes(column)) throw new Error(`${source}: missing ${column}`);
  }
  const bars = lines.map((line, i) => {
    const fields = line.split("\t");
    if (fields.length !== header.length) throw new Error(`${source}:${i + 2}: malformed column count`);
    const row = Object.fromEntries(header.map((column, index) => [column, fields[index]]));
    const date = row["<DATE>"].replaceAll(".", "-");
    const time = row["<TIME>"] || "00:00:00";
    const stamp = `${date} ${time}`;
    const parsed = Date.parse(stamp.replace(" ", "T") + "Z");
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stamp) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19).replace("T", " ") !== stamp) {
      throw new Error(`${source}:${i + 2}: invalid timestamp`);
    }
    const bar = { date: stamp };
    for (const field of ["open", "high", "low", "close"]) {
      const raw = row[`<${field.toUpperCase()}>`];
      if (!raw.trim()) throw new Error(`${source}:${i + 2}: empty ${field}`);
      bar[field] = Number(raw);
      if (!Number.isFinite(bar[field]) || bar[field] <= 0) throw new Error(`${source}:${i + 2}: invalid ${field}`);
    }
    if (bar.low > Math.min(bar.open, bar.close) || bar.high < Math.max(bar.open, bar.close) || bar.low > bar.high) {
      throw new Error(`${source}:${i + 2}: inconsistent OHLC`);
    }
    return bar;
  });
  bars.forEach((bar, i) => {
    if (i && bar.date <= bars[i - 1].date) throw new Error(`${source}: duplicate or unordered timestamp ${bar.date}`);
  });
  if (!bars.length) throw new Error(`${source}: no candles`);
  return bars;
}

export function loadWindows(root, lessons) {
  const folder = resolve(root, "data/Mt5Data");
  const filenames = readdirSync(folder);
  const series = {};
  for (const timeframe of ["Daily", "H4", "H1"]) {
    const matches = filenames.filter((name) => name.startsWith(`XAUUSDm_${timeframe}_`) && name.endsWith(".csv"));
    if (matches.length !== 1) throw new Error(`Expected one XAUUSDm ${timeframe} export, found ${matches.length}`);
    const source = `data/Mt5Data/${matches[0]}`;
    const text = readFileSync(resolve(root, source), "utf8");
    series[timeframe] = { source, sha256: createHash("sha256").update(text).digest("hex"), bars: parseMt5(text, source) };
  }
  const windowsByDay = {};
  for (const lesson of lessons) {
    const timeframe = lesson.labTimeframe || "H4";
    const source = series[timeframe];
    const eligible = source.bars.filter((bar) => bar.date.slice(0, 10) >= lesson.window[0] && bar.date.slice(0, 10) <= lesson.window[1]);
    if (eligible.length < 40) throw new Error(`Day ${lesson.day}: fewer than 40 candles in assigned context`);
    const bars = eligible.slice(0, 96);
    windowsByDay[lesson.day] = {
      id: `${source.sha256}:${timeframe}:${bars[0].date}:${bars.at(-1).date}`,
      symbol: "XAUUSDm", timeframe, source: source.source,
      timezone: "MT5 export server time; UTC offset not supplied",
      suggestedMode: lesson.checkMode || "swings",
      measurement: lesson.measurement || "none",
      exampleKind: lesson.exampleKind || "pivots",
      context: Object.fromEntries(Object.entries(series).map(([tf, other]) => {
        const maxTime = Date.parse(bars.at(-1).date.replace(" ", "T") + "Z") + ({ Daily: 24, H4: 4, H1: 1 }[timeframe]) * 3600000;
        const available = other.bars.filter((bar) => Date.parse(bar.date.replace(" ", "T") + "Z") <= maxTime);
        const start = available.findIndex((bar) => bar.date >= bars[0].date);
        const contextBars = available.slice(Math.max(0, (start < 0 ? available.length : start) - 96));
        return [tf, { source: other.source, bars: contextBars }];
      })),
      bars,
      exampleCutoff: Math.min(48, bars.length)
    };
  }
  return { dataset: "xauusd-roadmap-v3", windowsByDay };
}
