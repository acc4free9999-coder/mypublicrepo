import type { ClosedTrade } from '@/types';

export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** Wins ÷ (wins + losses), in %. Breakeven trades are excluded. Null when there are no decided trades. */
  winRate: number | null;
  grossProfit: number;
  /** Sum of losing trades, as a negative number. */
  grossLoss: number;
  netPnl: number;
  maxWin: number | null;
  /** Largest losing trade, as a negative number. */
  maxLoss: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  /** Avg win ÷ |avg loss|. Infinity when there are wins but no losses. */
  rewardRisk: number | null;
  /** Gross profit ÷ |gross loss|. Infinity when there are profits but no losses. */
  profitFactor: number | null;
  /** Average PnL per trade. */
  expectancy: number | null;
  /** Mean R-multiple (PnL ÷ initial risk) over trades that had a stop loss. */
  avgR: number | null;
  tradesWithRisk: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : num > 0 ? Infinity : null);

/** Computes performance statistics over closed trades. Order matters only for streaks (any chronological direction works). */
export function tradeStats(trades: readonly ClosedTrade[]): TradeStats {
  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0;
  let maxWin: number | null = null, maxLoss: number | null = null;
  let rSum = 0, tradesWithRisk = 0;
  let winStreak = 0, lossStreak = 0, maxConsecutiveWins = 0, maxConsecutiveLosses = 0;

  for (const t of trades) {
    const pnl = t.realizedPnl;
    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      maxWin = Math.max(maxWin ?? pnl, pnl);
      winStreak++;
      lossStreak = 0;
    } else if (pnl < 0) {
      losses++;
      grossLoss += pnl;
      maxLoss = Math.min(maxLoss ?? pnl, pnl);
      lossStreak++;
      winStreak = 0;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
    maxConsecutiveWins = Math.max(maxConsecutiveWins, winStreak);
    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, lossStreak);
    if (t.riskUsd != null && t.riskUsd > 0) {
      rSum += pnl / t.riskUsd;
      tradesWithRisk++;
    }
  }

  const total = trades.length;
  const decided = wins + losses;
  const avgWin = wins ? grossProfit / wins : null;
  const avgLoss = losses ? grossLoss / losses : null;
  return {
    totalTrades: total,
    wins,
    losses,
    breakeven: total - decided,
    winRate: decided ? (wins / decided) * 100 : null,
    grossProfit,
    grossLoss,
    netPnl: grossProfit + grossLoss,
    maxWin,
    maxLoss,
    avgWin,
    avgLoss,
    rewardRisk: avgWin == null ? (avgLoss == null ? null : 0) : ratio(avgWin, -(avgLoss ?? 0)),
    profitFactor: decided ? ratio(grossProfit, -grossLoss) : null,
    expectancy: total ? (grossProfit + grossLoss) / total : null,
    avgR: tradesWithRisk ? rSum / tradesWithRisk : null,
    tradesWithRisk,
    maxConsecutiveWins,
    maxConsecutiveLosses,
  };
}

export interface BalancePoint {
  /** 0 = starting balance, n = after the n-th closed trade. */
  index: number;
  time: number | null;
  balance: number;
  pnl: number;
  /** Distance below the running peak balance (≤ 0). */
  drawdown: number;
}

export interface BalanceCurve {
  points: BalancePoint[];
  peak: number;
  /** Largest peak-to-trough drop in USD (≤ 0) and as % of that peak (≤ 0). */
  maxDrawdown: number;
  maxDrawdownPct: number;
}

/** Realized balance after each closed trade. `trades` must be chronological (oldest first). */
export function balanceCurve(trades: readonly ClosedTrade[], initialBalance: number): BalanceCurve {
  const points: BalancePoint[] = [{ index: 0, time: null, balance: initialBalance, pnl: 0, drawdown: 0 }];
  let balance = initialBalance, peak = initialBalance, maxDrawdown = 0, maxDrawdownPct = 0;
  trades.forEach((t, i) => {
    balance += t.realizedPnl;
    peak = Math.max(peak, balance);
    const drawdown = balance - peak;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    if (peak > 0) maxDrawdownPct = Math.min(maxDrawdownPct, (drawdown / peak) * 100);
    points.push({ index: i + 1, time: t.closedAt, balance, pnl: t.realizedPnl, drawdown });
  });
  return { points, peak, maxDrawdown, maxDrawdownPct };
}
