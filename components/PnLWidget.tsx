"use client";
import { usePowerSyncQuery } from "@powersync/react";

export function PnLWidget() {
  const income = usePowerSyncQuery<{ total: number }>("SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE type = 'income'");
  const spend = usePowerSyncQuery<{ total: number }>("SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE type = 'spend'");
  const positions = usePowerSyncQuery<{ total: number }>("SELECT COALESCE(SUM(pnl), 0) as total FROM positions WHERE status = 'open'");
  const recent = usePowerSyncQuery<{ type: string; amount: number; description: string }>(
    "SELECT type, amount, description FROM ledger_entries ORDER BY created_at DESC LIMIT 5"
  );

  const totalIncome = income[0]?.total ?? 0;
  const totalSpend = spend[0]?.total ?? 0;
  const posPnL = positions[0]?.total ?? 0;
  const net = totalIncome - totalSpend + posPnL;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "income", value: totalIncome, color: "text-green-400" },
        { label: "spend", value: totalSpend, color: "text-red-400" },
        { label: "positions", value: posPnL, color: posPnL >= 0 ? "text-green-400" : "text-red-400" },
        { label: "net", value: net, color: net >= 0 ? "text-green-400" : "text-red-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-mono uppercase">{label}</p>
          <p className={`text-2xl font-bold font-mono ${color}`}>${Number(value).toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}