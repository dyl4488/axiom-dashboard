'use client';

/**
 * PositionTable — paper trading positions with live P&L
 *
 * Reads from local SQLite via PowerSync.
 * When AXIOM-MARKET updates current_price in Supabase,
 * PowerSync syncs the new pnl (computed in Postgres) to every client.
 * This table re-renders with the new P&L — no polling needed.
 */

import { usePowerSyncQuery } from '@powersync/react';

interface Position {
  id: string;
  symbol: string;
  direction: string;
  shares: number;
  entry_price: number;
  current_price: number | null;
  pnl: number | null;
  status: string;
  created_at: string;
}

function PnLBadge({ pnl }: { pnl: number | null }) {
  if (pnl == null) return <span className="text-axiom-muted font-mono text-xs">—</span>;
  const isPos = pnl >= 0;
  return (
    <span className={`font-mono text-xs font-bold ${isPos ? 'text-axiom-green' : 'text-axiom-red'}`}>
      {isPos ? '+' : ''}${pnl.toFixed(2)}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
      direction === 'long'
        ? 'text-axiom-green border-axiom-green/30 bg-axiom-green/10'
        : 'text-axiom-red   border-axiom-red/30   bg-axiom-red/10'
    }`}>
      {direction.toUpperCase()}
    </span>
  );
}

export function PositionTable() {
  const { data: positions } = usePowerSyncQuery<Position>(`
    SELECT
      id,
      symbol,
      direction,
      shares,
      entry_price,
      current_price,
      pnl,
      status,
      created_at
    FROM positions
    ORDER BY
      CASE status WHEN 'open' THEN 0 ELSE 1 END,
      pnl DESC
    LIMIT 20
  `);

  const openPositions   = positions?.filter(p => p.status === 'open') ?? [];
  const closedPositions = positions?.filter(p => p.status === 'closed') ?? [];

  const totalOpenPnL = openPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  return (
    <div className="bg-axiom-surface border border-axiom-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-axiom-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">Positions</span>
          <span className="text-xs font-mono bg-axiom-bg border border-axiom-border text-axiom-muted px-1.5 py-0.5 rounded">
            {openPositions.length} open
          </span>
        </div>
        {openPositions.length > 0 && (
          <span className={`text-xs font-mono font-bold ${totalOpenPnL >= 0 ? 'text-axiom-green' : 'text-axiom-red'}`}>
            Total: {totalOpenPnL >= 0 ? '+' : ''}${totalOpenPnL.toFixed(2)}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-80">
        {(!positions || positions.length === 0) ? (
          <div className="text-center text-axiom-muted text-sm font-mono py-12">
            No positions. AXIOM-MARKET will create paper trades.
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-axiom-border border-b border-axiom-border">
                <th className="text-left px-4 py-2 font-normal">Symbol</th>
                <th className="text-left px-4 py-2 font-normal">Dir</th>
                <th className="text-right px-4 py-2 font-normal">Shares</th>
                <th className="text-right px-4 py-2 font-normal">Entry</th>
                <th className="text-right px-4 py-2 font-normal">Current</th>
                <th className="text-right px-4 py-2 font-normal">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => (
                <tr
                  key={pos.id}
                  className={`border-b border-axiom-border/50 hover:bg-axiom-bg/50 transition-colors ${
                    pos.status === 'closed' ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-axiom-text font-bold">{pos.symbol}</td>
                  <td className="px-4 py-2.5">
                    <DirectionBadge direction={pos.direction} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-axiom-muted">
                    {pos.shares.toFixed(pos.shares < 1 ? 4 : 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-axiom-muted">
                    ${pos.entry_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-axiom-text">
                    {pos.current_price != null ? `$${pos.current_price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <PnLBadge pnl={pos.pnl} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
