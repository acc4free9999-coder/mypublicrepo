import { DrawingToolbar } from '@/components/chart/DrawingToolbar';
import { PriceChart } from '@/components/chart/PriceChart';
import { ReplayToolbar } from '@/components/replay/ReplayToolbar';
import { AccountSummary } from '@/components/trading/AccountSummary';
import { BottomPanel } from '@/components/trading/BottomPanel';
import { OrderPanel } from '@/components/trading/OrderPanel';
import { useEffect } from 'react';
import { useTradingStore } from '@/store/useTradingStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReplayLoop } from '@/hooks/useReplayLoop';
import { TopBar } from './TopBar';

export function Dashboard() {
  useReplayLoop();
  useKeyboardShortcuts();
  useEffect(() => void useTradingStore.getState().hydrateRealData(), []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <DrawingToolbar />
            <div className="min-w-0 flex-1"><PriceChart /></div>
          </div>
          <ReplayToolbar />
          <div className="h-56 shrink-0 border-t border-slate-800"><BottomPanel /></div>
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0f131b]">
          <AccountSummary />
          <OrderPanel />
        </aside>
      </div>
    </div>
  );
}
