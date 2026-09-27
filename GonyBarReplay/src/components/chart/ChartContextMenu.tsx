import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  History,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  MoveHorizontal,
  Ruler,
  Trash,
  Trash2,
} from 'lucide-react';
import { DRAWING_LABELS, isLine, statsVisible } from '@/drawings/types';
import { cn, fmtPrice } from '@/lib/format';
import { drawingsFor, useDrawingStore } from '@/store/useDrawingStore';
import { hasData, isReplayActive, marketPrice, useTradingStore } from '@/store/useTradingStore';
import type { UnixTime } from '@/types';

/** Where the chart was right-clicked. `price` / `barTime` are null outside the main pane / data. */
export interface ContextTarget {
  x: number;
  y: number;
  price: number | null;
  barTime: UnixTime | null;
  drawingId: string | null;
}

interface Props {
  target: ContextTarget;
  precision: number;
  onClose: () => void;
  onFit: () => void;
  onScrollToLatest: () => void;
}

/** TradingView-style chart context menu. */
export function ChartContextMenu({ target, precision, onClose, onFit, onScrollToLatest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: target.x, top: target.y });
  const symbol = useTradingStore((s) => s.symbol);
  const status = useTradingStore((s) => s.replay.status);
  const market = useTradingStore(marketPrice);
  const canReplay = useTradingStore(hasData);
  const hidden = useDrawingStore((s) => s.hidden);
  const count = useDrawingStore((s) => drawingsFor(s, symbol).length);
  const drawing = useDrawingStore((s) => (target.drawingId ? s.find(target.drawingId) : undefined));
  const ds = useDrawingStore.getState();

  // Keep the menu inside the chart.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const left = Math.max(4, Math.min(target.x, parent.clientWidth - el.offsetWidth - 4));
    const top = Math.max(4, Math.min(target.y, parent.clientHeight - el.offsetHeight - 4));
    setPos({ left, top });
  }, [target.x, target.y]);

  useEffect(() => {
    const outside = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('wheel', outside, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('wheel', outside, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const { price, barTime } = target;
  const px = price != null ? fmtPrice(price, precision) : '';
  const trading = isReplayActive(status) && status !== 'ended' && price != null && Number.isFinite(market);
  const order = (side: 'buy' | 'sell') => {
    const above = price! > market;
    // Buy below market = limit, above = stop; sell the other way round.
    const type = side === 'buy' ? (above ? 'stop' : 'limit') : above ? 'limit' : 'stop';
    return { side, type, label: `${side === 'buy' ? 'Buy' : 'Sell'} ${type} @ ${px}` } as const;
  };
  const placeTicket = (side: 'buy' | 'sell') => {
    const o = order(side);
    const t = useTradingStore.getState().ticket;
    const same = t.side === side && t.type === o.type && t.price.trim() !== '';
    // Same side/type: move SL/TP with the entry; otherwise the store re-derives them for the new context.
    useTradingStore.getState().updateTicket({ side, type: o.type, price: price!.toFixed(precision), preview: true }, { shiftBrackets: same });
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Chart menu"
      style={pos}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute z-40 min-w-56 rounded-md border border-slate-700 bg-[#131823] py-1 text-xs text-slate-200 shadow-2xl"
    >
      {drawing && (
        <>
          <Header>{DRAWING_LABELS[drawing.type]}</Header>
          <Item icon={drawing.locked ? <LockOpen size={14} /> : <Lock size={14} />} onClick={run(() => ds.update(drawing.id, { locked: !drawing.locked }, true))}>
            {drawing.locked ? 'Unlock' : 'Lock'}
          </Item>
          {isLine(drawing.type) && (
            <Item icon={<Ruler size={14} />} onClick={run(() => ds.update(drawing.id, { showStats: !statsVisible(drawing) }, true))}>
              {statsVisible(drawing) ? 'Hide stats' : 'Show stats (price, bars, angle)'}
            </Item>
          )}
          <Item icon={<CopyPlus size={14} />} onClick={run(() => ds.duplicate(drawing.id))}>Clone</Item>
          <Item icon={<Trash size={14} />} danger onClick={run(() => ds.remove(drawing.id))} hint="Del">Remove</Item>
          <Sep />
        </>
      )}

      {price != null && (
        <>
          <Item icon={<Copy size={14} />} onClick={run(() => void navigator.clipboard?.writeText(price.toFixed(precision)))}>Copy price {px}</Item>
          <Item
            icon={<Minus size={14} />}
            disabled={barTime == null}
            onClick={run(() => {
              const d = ds.create(symbol, 'hline', [{ time: barTime!, price }]);
              ds.add(d);
            })}
          >
            Horizontal line at {px}
          </Item>
          {trading && (
            <>
              <Item icon={<ArrowUpRight size={14} className="text-emerald-400" />} onClick={run(() => placeTicket('buy'))}>{order('buy').label}</Item>
              <Item icon={<ArrowDownRight size={14} className="text-rose-400" />} onClick={run(() => placeTicket('sell'))}>{order('sell').label}</Item>
            </>
          )}
          <Sep />
        </>
      )}

      {status === 'off' && canReplay && barTime != null && (
        <>
          <Item
            icon={<History size={14} />}
            onClick={run(() => {
              const s = useTradingStore.getState();
              s.enterReplay();
              s.selectCutoff(barTime);
            })}
          >
            Start replay from this bar
          </Item>
          <Sep />
        </>
      )}

      <Item icon={<Maximize2 size={14} />} onClick={run(onFit)}>Reset chart view</Item>
      <Item icon={<MoveHorizontal size={14} />} onClick={run(onScrollToLatest)}>Scroll to latest bar</Item>
      <Sep />
      <Item icon={hidden ? <Eye size={14} /> : <EyeOff size={14} />} onClick={run(() => ds.toggleHidden())}>{hidden ? 'Show drawings' : 'Hide drawings'}</Item>
      <Item icon={<Trash2 size={14} />} danger disabled={!count} onClick={run(() => ds.removeAll(symbol))} hint="Undo: ⌘Z">
        Remove all drawings{count ? ` (${count})` : ''}
      </Item>
    </div>
  );
}

const Sep = () => <div className="my-1 h-px bg-slate-700/70" />;
const Header = ({ children }: { children: ReactNode }) => <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{children}</div>;

function Item({ children, icon, onClick, disabled, danger, hint }: { children: ReactNode; icon: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; hint?: string }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        danger && 'hover:text-red-400',
      )}
    >
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </button>
  );
}
