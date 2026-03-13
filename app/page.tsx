'use client';

/**
 * AXIOM Dashboard — Home Page
 *
 * The main dashboard. Every component on this page reads from LOCAL SQLite
 * via PowerSync's usePowerSyncQuery hook. This means:
 *
 * - Zero network latency on reads (SQLite is in-browser)
 * - Offline capable (data persists in SQLite when disconnected)
 * - Real-time: PowerSync pushes changes to SQLite, React re-renders
 *
 * Open this in 3 browser tabs. Trigger an agent from one tab.
 * Watch all three update simultaneously. That's the PowerSync demo.
 */

import { AgentCard } from '@/components/AgentCard';
import { TaskFeed } from '@/components/TaskFeed';
import { PnLWidget } from '@/components/PnLWidget';
import { PositionTable } from '@/components/PositionTable';
import { usePowerSyncQuery } from '@powersync/react';
import { useState } from 'react';

// =============================================================================
// Trigger Agent Panel — kick off an agent run from the UI
// =============================================================================
function AgentTrigger() {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<'core' | 'earn' | 'market' | 'ops'>('core');

  const prompts: Record<string, string> = {
    core:   'Check the task queue and report current P&L status.',
    earn:   'Scan the task queue for income opportunities and claim the highest-value pending task.',
    market: 'Calculate P&L across all open positions and emit a status report.',
    ops:    'Run a fleet health check and log the status of all agents.',
  };

  async function triggerAgent() {
    setRunning(true);
    setLastResult(null);
    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent, prompt: prompts[selectedAgent] }),
      });
      const data = await response.json();
      setLastResult(data.result ?? data.error ?? 'Done.');
    } catch (err) {
      setLastResult('Error: ' + String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-axiom-surface border border-axiom-border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">Trigger Agent</span>
        <div className="flex-1 h-px bg-axiom-border" />
      </div>
      <div className="flex gap-2">
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value as typeof selectedAgent)}
          className="bg-axiom-bg border border-axiom-border text-axiom-text text-sm font-mono rounded px-3 py-2 flex-1"
        >
          <option value="core">AXIOM-CORE</option>
          <option value="earn">AXIOM-EARN</option>
          <option value="market">AXIOM-MARKET</option>
          <option value="ops">AXIOM-OPS</option>
        </select>
        <button
          onClick={triggerAgent}
          disabled={running}
          className="px-4 py-2 bg-axiom-green text-black font-mono text-sm font-bold rounded
                     hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {running ? '⟳ Running...' : '▶ Run'}
        </button>
      </div>
      {lastResult && (
        <div className="mt-3 p-3 bg-axiom-bg border border-axiom-border rounded text-xs font-mono text-axiom-muted
                        max-h-24 overflow-y-auto animate-slide-in">
          {lastResult}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Agent Grid — reads agents from local SQLite via usePowerSyncQuery
// =============================================================================
function AgentGrid() {
  // usePowerSyncQuery is the core PowerSync hook.
  // It queries LOCAL SQLite — no network request.
  // Re-renders automatically when PowerSync updates the local DB.
  const { data: agents } = usePowerSyncQuery<{
    id: string;
    name: string;
    role: string;
    model: string;
    status: string;
    last_active: string | null;
  }>(`
    SELECT id, name, role, model, status, last_active
    FROM agents
    ORDER BY name ASC
  `);

  return (
    <div>
      <SectionHeader title="Agent Fleet" count={agents?.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents?.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        {(!agents || agents.length === 0) && (
          <div className="col-span-3 text-axiom-muted text-sm font-mono text-center py-8">
            No agents found. Run schema.sql in Supabase to seed the fleet.
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Section Header component
// =============================================================================
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">{title}</span>
      {count !== undefined && (
        <span className="text-xs font-mono bg-axiom-surface border border-axiom-border text-axiom-muted px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-axiom-border" />
    </div>
  );
}

// =============================================================================
// Main Dashboard Page
// =============================================================================
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-axiom-bg">
      {/* Header */}
      <header className="border-b border-axiom-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono font-bold text-axiom-text tracking-tight">
              AXIOM <span className="text-axiom-green">DASHBOARD</span>
            </h1>
            <p className="text-axiom-muted text-xs font-mono mt-0.5">
              Local-first AI agent monitoring · Powered by PowerSync + Supabase + Mastra
            </p>
          </div>
          <div className="text-xs font-mono text-axiom-muted">
            All reads from local SQLite · Zero network latency
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Row 1: P&L Summary + Agent Trigger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PnLWidget />
          </div>
          <div>
            <AgentTrigger />
          </div>
        </div>

        {/* Row 2: Agent Fleet */}
        <AgentGrid />

        {/* Row 3: Task Feed + Position Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TaskFeed />
          <PositionTable />
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-axiom-border px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center text-axiom-muted text-xs font-mono">
          AXIOM Dashboard · PowerSync AI Hackathon 2026 · Built with PowerSync + Supabase + Mastra + Next.js
        </div>
      </footer>
    </div>
  );
}
