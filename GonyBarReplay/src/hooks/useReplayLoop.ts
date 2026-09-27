import { useEffect } from 'react';
import { useTradingStore } from '@/store/useTradingStore';

/**
 * Replay clock. While `playing`, emits one tick every 1000/speed ms.
 * Reads the store imperatively so the interval is only rebuilt when
 * status or speed change — never on each tick.
 */
export function useReplayLoop() {
  const status = useTradingStore((s) => s.replay.status);
  const speed = useTradingStore((s) => s.replay.speed);

  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => useTradingStore.getState().stepForward(), 1000 / speed);
    return () => window.clearInterval(id);
  }, [status, speed]);
}
