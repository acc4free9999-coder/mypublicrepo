export interface SimulationConfig {
  tradeCount: number;
  winRate: number;
  minWinRR: number;
  maxWinRR: number;
  minLossRR: number;
  maxLossRR: number;
}
export interface TradeRange { minRR: number; maxRR: number }
export interface SimulatedTrade {
  trade: number;
  result: number;
  cumulative: number;
  drawdown: number;
}
export interface SimulationResult {
  trades: SimulatedTrade[];
  net: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  maxDrawdown: number;
  averageRR: number;
}
export const defaultSimulation: SimulationConfig = {
  tradeCount: 100, winRate: 45, minWinRR: 1, maxWinRR: 3, minLossRR: 1, maxLossRR: 1,
};
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function simulateTrades(config: SimulationConfig, overrides: Record<number, TradeRange> = {}, random: () => number = Math.random): SimulationResult {
  if (!Object.values(config).every(Number.isFinite)) throw new Error('Enter a number in every simulation field.');
  if (!Number.isInteger(config.tradeCount) || config.tradeCount < 1 || config.tradeCount > 1000) throw new Error('Trade count must be a whole number from 1 to 1,000.');
  if (config.winRate < 0 || config.winRate > 100) throw new Error('Win probability must be between 0% and 100%.');
  for (const [label, min, max] of [['Winning', config.minWinRR, config.maxWinRR], ['Losing', config.minLossRR, config.maxLossRR]] as const) {
    if (min < 0.01 || max > 1000 || min > max) throw new Error(`${label} RR ranges must be between 0.01 and 1,000, with minimum no greater than maximum.`);
  }
  for (const [index, range] of Object.entries(overrides)) {
    if (!Number.isInteger(Number(index)) || Number(index) < 0 || Number(index) >= config.tradeCount) throw new Error('A custom trade range is outside the selected trade count.');
    if (!Number.isFinite(range.minRR) || !Number.isFinite(range.maxRR) || range.minRR < -1000 || range.maxRR > 1000 || range.minRR > range.maxRR) throw new Error(`Trade ${Number(index) + 1}: minimum must be no greater than maximum, and both must be between -1,000R and +1,000R.`);
  }
  const sample = (min: number, max: number) => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random values must be between 0 and 1, excluding 1.');
    const sampled = round(min + value * (max - min));
    return Math.min(max, Math.max(min, sampled));
  };
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const trades = Array.from({ length: config.tradeCount }, (_, index) => {
    const range = overrides[index];
    let result: number;
    if (range) result = sample(range.minRR, range.maxRR);
    else {
      const outcome = random();
      if (!Number.isFinite(outcome) || outcome < 0 || outcome >= 1) throw new Error('Random values must be between 0 and 1, excluding 1.');
      result = outcome < config.winRate / 100 ? sample(config.minWinRR, config.maxWinRR) : -sample(config.minLossRR, config.maxLossRR);
    }
    cumulative = round(cumulative + result);
    peak = Math.max(peak, cumulative);
    const drawdown = round(peak - cumulative);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    return { trade: index + 1, result, cumulative, drawdown };
  });
  const wins = trades.filter(trade => trade.result > 0).length;
  const losses = trades.filter(trade => trade.result < 0).length;
  return {
    trades, net: cumulative, wins, losses, breakevens: trades.length - wins - losses,
    winRate: wins + losses ? wins / (wins + losses) * 100 : 0,
    maxDrawdown, averageRR: cumulative / trades.length,
  };
}