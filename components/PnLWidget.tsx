'use client';

/**
 * PnLWidget — live P&L summary from local SQLite
 *
 * Shows total income, total spend, and net P&L.
 * Also includes unrealized P&L from open positions.
 *
 * All reads are from local SQLite — PowerSync keeps it current.
 * This widget re-renders whenever a new ledger entry or position
 * is synced from Supabase — zero polling, instant updates.
 */

import { usePowerSyncQuery } from '@powersync/react';

interface LedgerSummary {
  total_income: number;
  total_spend: number;
}

interface PositionSummary {
  total_pnl: number;
  open_count: number;
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  return `${val >= 0 ? '' : '-'}$${abs.toFixed(2)}`;
}

function StatCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
}) {
  return (
    <div className="bg-axiom-bg border border-axiom-border rounded-lg p-4 flex flex-col gap-1">
      <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-mono font-bold ${valueColor}`}>{value}</span>
      {sub && <span className="text-axiom-border text-xs font-mono">{sub}</span>}
    </div>
  );
}

export function PnLWidget() {
  // Aggregate ledger in SQLite — SUM grouped by type
  const { data: ledger } = usePowerSyncQuery<LedgerSummary>(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'spend'  THEN amount ELSE 0 END) AS total_spend
    FROM ledger_entries
  `);

  // Sum unrealized P&L from open positions
  const { data: positionData } = usePowerSyncQuery<PositionSummary>(`
    SELECT
      COALESCE(SUM(pnl), 0) AS total_pnl,
      COUNT(*)              AS open_count
    FROM positions
    WHERE status = 'open'
  `);

  const totalIncome  = ledger?.[0]?.total_income  ?? 0;
  const totalSpend   = ledger?.[0]?.total_spend   ?? 0;
  const positionPnL  = positionData?.[0]?.total_pnl  ?? 0;
  const openCount    = positionData?.[0]?.open_count  ?? 0;
  const netPnL       = totalIncome - totalSpend + positionPnL;

  return (
    <div className="bg-axiom-surface border border-axiom-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-axiom-border flex items-center justify-between">
        <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">
          P&amp;L Summary
        </span>
        <span className="text-xs font-mono text-axiom-border">
          Live from local SQLite
        </span>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Net P&L"
          value={`${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)}`}
          valueColor={netPnL >= 0 ? 'text-axiom-green' : 'text-axiom-red'}
          sub="income + positions - spend"
        />
        <StatCard
          label="Income"
          value={`$${totalIncome.toFixed(2)}`}
          valueColor="text-axiom-green"
          sub="total earned"
        />
        <StatCard
          label="Spend"
          value={`$${totalSpend.toFixed(2)}`}
          valueColor="text-axiom-amber"
          sub="total spent"
        />
        <StatCard
          label="Positions"
          value={`${positionPnL >= 0 ? '+' : ''}$${positionPnL.toFixed(2)}`}
          valueColor={positionPnL >= 0 ? 'text-axiom-green' : 'text-axiom-red'}
          sub={`${openCount} open trade${openCount !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Recent ledger entries */}
      <RecentLedger />
    </div>
  );
}

function RecentLedger() {
  const { data: entries } = usePowerSyncQuery<{
    id: string;
    type: string;
    amount: number;
    description: string;
    agent_name: string | null;
    created_at: string;
  }>(`
    SELECT
      le.id,
      le.type,
      le.amount,
      le.description,
      a.name AS agent_name,
      le.created_at
    FROM ledger_entries le
    LEFT JOIN agents a ON le.agent_id = a.id
    ORDER BY le.created_at DESC
    LIMIT 5
  `);

  if (!entries || entries.length === 0) return null;

  return (
    <div className="border-t border-axiom-border">
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-axiom-border text-xs font-mono uppercase tracking-wider">Recent</span>
      </div>
      {entries.map(entry => (
        <div key={entry.id} className="px-4 py-2 border-t border-axiom-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-mono ${entry.type === 'income' ? 'text-axiom-green' : 'text-axiom-amber'}`}>
              {entry.type === 'income' ? '+' : '-'}
            </span>
            <span className="text-xs text-axiom-muted font-mono truncate">{entry.description}</span>
            {entry.agent_name && (
              <span className="text-xs font-mono text-axiom-border hidden sm:inline">{entry.agent_name}</span>
            )}
          </div>
          <span className={`text-xs font-mono font-bold flex-shrink-0 ${entry.type === 'income' ? 'text-axiom-green' : 'text-axiom-amber'}`}>
            {entry.type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
