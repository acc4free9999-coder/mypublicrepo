# Structure & Chart Tools

Paste the complete [indicator](./MultitimeframeBiasTrend.pine) into TradingView's Pine Editor, save, and select **Add to chart**. Pine Script v6 is required. The indicator contains chart-timeframe annotations and a manual reference checklist; these are context, not trading instructions or guarantees.

## Modules

- **Elliott waves:** Three configurable zigzag lengths identify candidate motive and corrective patterns, with Fibonacci levels and invalidation marks. Pivots confirm one bar after the swing; patterns are not forecasts.
- **Supply and demand:** Builds zones from one to three small-bodied base candles followed by displacement. Zones are tested, bounded, and removed after a close through the far edge.
- **Liquidity sweeps:** Identifies wick sweeps or breakout-and-retest events at confirmed swing levels. Adapted from Liquidity Sweeps by LuxAlgo under CC BY-NC-SA 4.0; sweeps are context, not entries.
- **Swing highs/lows:** Labels confirmed HH/LH and HL/LL swings and optional candle patterns. Labels appear after the swing confirmation delay.
- **Sessions:** Shades London, New York, Tokyo, and optionally Sydney, or shows each session's running high/low band.
- **ICT price action:** Draws market structure and buyside/sellside liquidity from promoted short-, intermediate-, and long-term swings.
- **Full ICT dealing range:** Adds the rolling range, FVG/IFVG, order blocks, and breaker blocks with independent filters and retention. BPR detection is separate and retains only the latest zone per side.

## Pullback Checklist

The top-right checklist is a manual reference to the [quality trendline pullback rubric](./quality_trendline_pullback_scoring_system.md). It does not evaluate chart conditions, calculate a live score, recommend entries, or size risk. Use the **Panels** inputs to hide it or display it near the latest price.

## Alerts

Elliott and BPR events use Pine's `alert()` function. To receive them, create an alert on **Any alert() function call**. The multi-timeframe bias engine, its scoring and timeframe-weight inputs, optional bias overlays, volume profile, and chart-close transition alert group are not included.

## Validation

Run local source and oracle tests with `node --test tests/*.test.mjs`. These tests do not execute Pine. Verify compilation and chart behavior in TradingView's Pine Editor. Drawing objects from enabled modules share TradingView's 500-object limits.
