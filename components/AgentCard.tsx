"use client";
import { usePowerSyncQuery } from "@powersync/react";

interface Agent { id: string; name: string; role: string; model: string; status: string; last_active: string | null; }
interface Props { agent: Agent; onTrigger: () => void; isTriggering: boolean; }

const statusColor: Record<string, string> = {
  active: "text-green-400 bg-green-400/10 border-green-800",
  idle: "text-gray-400 bg-gray-800 border-gray-700",
  error: "text-red-400 bg-red-400/10 border-red-800",
  offline: "text-gray-600 bg-gray-900 border-gray-800",
};

export function AgentCard({ agent, onTrigger, isTriggering }: Props) {
  const logs = usePowerSyncQuery<{ message: string; event_type: string; created_at: string }>(
    "SELECT message, event_type, created_at FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1",
    [agent.id]
  );
  const lastLog = logs[0];
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${statusColor[agent.status] ?? statusColor.offline}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-sm">{agent.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[agent.status]}`}>{agent.status}</span>
      </div>
      <p className="text-xs text-gray-500">{agent.role}</p>
      <p className="text-xs text-gray-600 font-mono">{agent.model}</p>
      {lastLog && <p className="text-xs text-gray-500 truncate" title={lastLog.message}>{lastLog.message}</p>}
      <button
        onClick={onTrigger}
        disabled={isTriggering}
        className="w-full mt-2 py-1 px-3 text-xs font-mono rounded border border-green-800 text-green-400 hover:bg-green-400/10 disabled:opacity-40 transition"
      >
        {isTriggering ? "running..." : "trigger"}
      </button>
    </div>
  );
}