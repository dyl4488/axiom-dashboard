"use client";
import { usePowerSyncQuery } from "@powersync/react";

interface Position { id: string; symbol: string; direction: string; shares: number; entry_price: number; current_price: number | null; pnl: number | null; status: string; }

export function PositionTable() {
  const positions = usePowerSyncQuery<Position>(
    "SELECT * FROM positions WHERE status = 'open' ORDER BY created_at DESC"
  );
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="font-mono font-semibold text-gray-300 mb-3">Positions <span className="text-gray-600 text-xs">({positions.length} open)</span></h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead><tr className="text-gray-500 text-left border-b border-gray-800">
            <th className="pb-2">symbol</th><th className="pb-2">dir</th><th className="pb-2">shares</th><th className="pb-2">entry</th><th className="pb-2">P&L</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {positions.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-600">no open positions</td></tr>}
            {positions.map((p) => (
              <tr key={p.id} className="text-gray-300">
                <td className="py-1">{p.symbol}</td>
                <td className={p.direction === "long" ? "text-green-400" : "text-red-400"}>{p.direction}</td>
                <td>{Number(p.shares).toFixed(2)}</td>
                <td>${Number(p.entry_price).toFixed(2)}</td>
                <td className={(p.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>${Number(p.pnl ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}