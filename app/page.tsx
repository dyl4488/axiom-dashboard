"use client";

import { usePowerSyncQuery } from "@powersync/react";
import { AgentCard } from "@/components/AgentCard";
import { TaskFeed } from "@/components/TaskFeed";
import { PnLWidget } from "@/components/PnLWidget";
import { PositionTable } from "@/components/PositionTable";
import { useState } from "react";

export default function Dashboard() {
  const [triggering, setTriggering] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const agents = usePowerSyncQuery<{
    id: string; name: string; role: string; model: string;
    status: string; last_active: string | null;
  }>("SELECT * FROM agents ORDER BY name ASC");

  async function triggerAgent(agentKey: string) {
    setTriggering(agentKey);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, prompt: "Run your primary task and report status." }),
      });
      const data = await res.json();
      setLastResult(data.result ?? data.error ?? "Done");
    } catch (e) {
      setLastResult(String(e));
    } finally {
      setTriggering(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-green-400 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-400 font-mono">AXIOM Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Local-first AI agent monitoring - Powered by PowerSync</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400 font-mono">LIVE - SQLite synced</span>
          </div>
        </div>
        <PnLWidget />
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-3 font-mono">Agent Fleet</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onTrigger={() => triggerAgent(agent.name.toLowerCase().replace("axiom-", ""))}
                isTriggering={triggering === agent.name.toLowerCase().replace("axiom-", "")}
              />
            ))}
          </div>
        </div>
        {lastResult && (
          <div className="bg-gray-900 border border-green-800 rounded p-4 font-mono text-sm text-green-300">
            <span className="text-gray-500">last_output: </span>{lastResult}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TaskFeed />
          <PositionTable />
        </div>
      </div>
    </main>
  );
}
