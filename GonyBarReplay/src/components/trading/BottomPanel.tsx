import { useState, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn, fmtPrice, fmtQty, fmtTime, fmtUsd, pnlClass } from '@/lib/format';
import { usePricePrecision, useTradingStore } from '@/store/useTradingStore';
import type { Position } from '@/types';

type Tab = 'positions' | 'orders' | 'history' | 'journal';

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>('positions');
  const pp = usePricePrecision();
  const book = useTradingStore((s) => s.book);
  const events = useTradingStore((s) => s.events);
  const { cancelOrder, closePosition, closeAllPositions } = useTradingStore.getState();

  const tabs: [Tab, string, number][] = [
    ['positions', 'Positions', book.positions.length],
    ['orders', 'Orders', book.pendingOrders.length],
    ['history', 'History', book.closedTrades.length],
    ['journal', 'Journal', events.length],
  ];

  return (
    <div className="flex h-full flex-col bg-[#0f131b]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-slate-800 px-2">
        {tabs.map(([id, label, n]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('rounded px-3 py-1 text-xs', tab === id ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200')}>
            {label} {n > 0 && <span className="ml-1 rounded bg-slate-700 px-1 text-[10px]">{n}</span>}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'positions' && book.positions.length > 0 && (
          <button onClick={closeAllPositions} className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">Close all</button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'positions' && (
          <Table head={['Side', 'Lots', 'Entry', 'Price', 'Stop loss', 'Take profit', 'Unrealized PnL', 'Opened', '']} empty="No open positions">
            {book.positions.map((p) => <PositionRow key={p.id} p={p} onClose={() => closePosition(p.id)} />)}
          </Table>
        )}
        {tab === 'orders' && (
          <Table head={['Side', 'Type', 'Lots', 'Price', 'SL', 'TP', 'Placed', '']} empty="No working orders">
            {book.pendingOrders.map((o) => (
              <tr key={o.id}>
                <SideCell side={o.side} />
                <td className="uppercase">{o.type}</td>
                <td>{fmtQty(o.qty)}</td>
                <td>{fmtPrice(o.price, pp)}</td>
                <td>{fmtPrice(o.stopLoss, pp)}</td>
                <td>{fmtPrice(o.takeProfit, pp)}</td>
                <td className="text-slate-500">{fmtTime(o.createdAt)}</td>
                <td className="text-right"><IconBtn title="Cancel order" onClick={() => cancelOrder(o.id)}><X size={13} /></IconBtn></td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'history' && (
          <Table head={['Side', 'Lots', 'Entry', 'Exit', 'Realized PnL', 'Reason', 'Opened', 'Closed']} empty="No closed trades yet">
            {book.closedTrades.map((t) => (
              <tr key={t.id}>
                <SideCell side={t.side} />
                <td>{fmtQty(t.qty)}</td>
                <td>{fmtPrice(t.entryPrice, pp)}</td>
                <td>{fmtPrice(t.exitPrice, pp)}</td>
                <td className={pnlClass(t.realizedPnl)}>{fmtUsd(t.realizedPnl, true)}</td>
                <td className="text-slate-400">{t.reason === 'stop_loss' ? 'Stop loss' : t.reason === 'take_profit' ? 'Take profit' : 'Manual'}</td>
                <td className="text-slate-500">{fmtTime(t.openedAt)}</td>
                <td className="text-slate-500">{fmtTime(t.closedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'journal' && (
          <ul className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {events.length === 0 && <li className="p-4 text-center text-slate-600">No activity</li>}
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 px-3 py-1">
                <span className="text-slate-500">{fmtTime(e.time)}</span>
                <span className={cn(e.kind === 'order_rejected' ? 'text-amber-400' : e.kind === 'position_closed' ? 'text-sky-300' : 'text-slate-300')}>{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PositionRow({ p, onClose }: { p: Position; onClose: () => void }) {
  const updateBrackets = useTradingStore((s) => s.updateBrackets);
  const pp = usePricePrecision();
  const [editing, setEditing] = useState(false);
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const start = () => {
    setSl(p.stopLoss?.toString() ?? '');
    setTp(p.takeProfit?.toString() ?? '');
    setEditing(true);
  };
  const save = () => {
    const n = (s: string) => (s.trim() === '' ? undefined : Number(s));
    updateBrackets(p.id, n(sl), n(tp));
    setEditing(false);
  };
  const input = (v: string, set: (v: string) => void) => (
    <input value={v} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="none" className="w-24 rounded bg-slate-900 px-1 outline-none ring-1 ring-slate-700 focus:ring-blue-500" />
  );
  return (
    <tr>
      <SideCell side={p.side} />
      <td>{fmtQty(p.qty)}</td>
      <td>{fmtPrice(p.entryPrice, pp)}</td>
      <td>{fmtPrice(p.currentPrice, pp)}</td>
      <td>{editing ? input(sl, setSl) : fmtPrice(p.stopLoss, pp)}</td>
      <td>{editing ? input(tp, setTp) : fmtPrice(p.takeProfit, pp)}</td>
      <td className={pnlClass(p.unrealizedPnl)}>{fmtUsd(p.unrealizedPnl, true)}</td>
      <td className="text-slate-500">{fmtTime(p.openedAt)}</td>
      <td className="whitespace-nowrap text-right">
        {editing ? <IconBtn title="Save brackets" onClick={save}><Check size={13} /></IconBtn> : <IconBtn title="Edit SL / TP" onClick={start}><Pencil size={13} /></IconBtn>}
        <IconBtn title="Close position at market" onClick={onClose}><X size={13} /></IconBtn>
      </td>
    </tr>
  );
}

function Table({ head, empty, children }: { head: string[]; empty: string; children: ReactNode[] }) {
  return (
    <table className="w-full text-left font-mono text-[11px] [&_td]:px-3 [&_td]:py-1 [&_th]:px-3 [&_th]:py-1.5">
      <thead className="sticky top-0 bg-[#0f131b] text-slate-500"><tr>{head.map((h, i) => <th key={i} className="font-normal">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-800/60 text-slate-200">
        {children.length ? children : <tr><td colSpan={head.length} className="py-4 text-center text-slate-600">{empty}</td></tr>}
      </tbody>
    </table>
  );
}

const SideCell = ({ side }: { side: 'buy' | 'sell' }) => (
  <td className={side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>{side === 'buy' ? 'LONG' : 'SHORT'}</td>
);

const IconBtn = ({ children, title, onClick }: { children: ReactNode; title: string; onClick: () => void }) => (
  <button title={title} onClick={onClick} className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100">{children}</button>
);
