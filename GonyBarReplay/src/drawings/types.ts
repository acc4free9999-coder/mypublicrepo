import type { UnixTime } from '@/types';

export type DrawingType =
  | 'trendline'
  | 'ray'
  | 'extended'
  | 'hline'
  | 'hray'
  | 'vline'
  | 'rect'
  | 'fib'
  | 'measure'
  | 'text'
  | 'callout';

export type DrawingTool = 'cursor' | DrawingType;

export type LineDash = 'solid' | 'dashed' | 'dotted';

/** A point in data space. `time` may fall between bars or beyond the last bar. */
export interface AnchorPoint {
  time: UnixTime;
  price: number;
}

export interface DrawingStyle {
  color: string;
  width: number;
  dash: LineDash;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  symbol: string;
  points: AnchorPoint[];
  style: DrawingStyle;
  text?: string;
  fontSize?: number;
  locked?: boolean;
  /** Trend-line stats label (price change, bars, angle) at the end point. Undefined = default for the type. */
  showStats?: boolean;
  createdAt: number;
}

export const POINT_COUNT: Record<DrawingType, 1 | 2> = {
  trendline: 2,
  ray: 2,
  extended: 2,
  hline: 1,
  hray: 1,
  vline: 1,
  rect: 2,
  fib: 2,
  measure: 2,
  text: 1,
  callout: 2,
};

export const DRAWING_LABELS: Record<DrawingType, string> = {
  trendline: 'Trend line',
  ray: 'Ray',
  extended: 'Extended line',
  hline: 'Horizontal line',
  hray: 'Horizontal ray',
  vline: 'Vertical line',
  rect: 'Rectangle',
  fib: 'Fib retracement',
  measure: 'Price range',
  text: 'Text',
  callout: 'Callout',
};

export const FIB_LEVELS: { level: number; color: string }[] = [
  { level: 0, color: '#787b86' },
  { level: 0.236, color: '#f23645' },
  { level: 0.382, color: '#ff9800' },
  { level: 0.5, color: '#4caf50' },
  { level: 0.618, color: '#089981' },
  { level: 0.786, color: '#00bcd4' },
  { level: 1, color: '#787b86' },
  { level: 1.618, color: '#2962ff' },
];

/** Two-point straight lines that can show a stats label. */
export const isLine = (t: DrawingType) => t === 'trendline' || t === 'ray' || t === 'extended';

/** Stats are on by default for trend lines, opt-in for rays / extended lines. */
export const statsVisible = (d: Pick<Drawing, 'type' | 'showStats'>) => isLine(d.type) && (d.showStats ?? d.type === 'trendline');

/** Drawings that carry editable text. */
export const isTextual = (t: DrawingType) => t === 'text' || t === 'callout';

export const DRAWING_COLORS = ['#2962ff', '#f23645', '#089981', '#ff9800', '#9c27b0', '#00bcd4', '#f5c542', '#e2e8f0'];
