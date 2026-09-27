import { guessSymbol, mergeCandles, parseBarsFile } from './fileImport';
import type { RealSymbolData } from './realDataCache';
import type { Timeframe } from '@/types';

/** Built-in bars shipped with the app (public/data, generated from mt5/Mt5Data). Kept in memory, never persisted. */
export const BUNDLED_SOURCE = 'Built-in MT5';

export interface BundledFile {
  name: string;
  text: string;
}

/** Parse built-in files into per-symbol series. Files whose symbol can't be guessed or that fail to parse are skipped. */
export function parseBundled(files: BundledFile[], now = Date.now()): Record<string, RealSymbolData> {
  const out: Record<string, RealSymbolData> = {};
  for (const f of files) {
    const symbol = guessSymbol(f.name);
    if (!symbol) continue;
    try {
      // Broker server time is assumed to be UTC (e.g. Exness "XAUUSDm").
      const { candles, timeframe } = parseBarsFile(f.text);
      const d = (out[symbol] ??= { symbol, fetchedAt: now, series: {}, sources: {} });
      const prev = d.series[timeframe];
      d.series[timeframe] = prev ? mergeCandles(prev, candles) : candles;
      d.sources![timeframe] = `${BUNDLED_SOURCE} · ${f.name.split('/').pop()}`;
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

/** Fetch and parse the built-in files listed in `data/manifest.json`. Resolves to {} when there are none. */
export async function loadBundledData(base = import.meta.env?.BASE_URL ?? '/'): Promise<Record<string, RealSymbolData>> {
  try {
    const res = await fetch(`${base}data/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const { files } = (await res.json()) as { files: string[] };
    const loaded = await Promise.all(
      files.map(async (name) => {
        const r = await fetch(`${base}data/${name}`);
        return r.ok ? { name, text: await r.text() } : null;
      }),
    );
    return parseBundled(loaded.filter((f): f is BundledFile => f != null));
  } catch {
    return {};
  }
}

/**
 * Layer saved data (fetched / imported by the user) over the built-in bars. Per timeframe the two series are
 * merged and saved bars win on equal timestamps, so built-in history fills in whatever the saved series lacks.
 */
export function withBundled(saved: RealSymbolData | undefined, bundled: RealSymbolData | undefined): RealSymbolData | undefined {
  if (!bundled) return saved;
  if (!saved) return bundled;
  const series = { ...bundled.series };
  const sources = { ...bundled.sources };
  for (const tf of Object.keys(saved.series) as Timeframe[]) {
    const s = saved.series[tf];
    if (!s?.length) continue;
    const b = bundled.series[tf];
    series[tf] = b?.length ? mergeCandles(b, s) : s;
    const src = saved.sources?.[tf] ?? 'Saved';
    sources[tf] = b?.length && !src.includes(BUNDLED_SOURCE) ? `${src} + ${BUNDLED_SOURCE}` : src;
  }
  return { ...saved, series, sources };
}
