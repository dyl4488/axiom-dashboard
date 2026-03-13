"use client";
import { usePowerSyncQuery } from "@powersync/react";
interface Task { id: string; title: string; status: string; priority: number; estimated_value: number | null; agent_name: string | null; }
const statusDot: Record<string, string> = { pending: "bg-yellow-400", in_progress: "bg-blue-400", completed: "bg-green-400", failed: "bg-red-400", cancelled: "bg-gray-600" };
export function TaskFeed() {
  const tasks = usePowerSyncQuery<Task>("SELECT t.id, t.title, t.status, t.priority, t.estimated_value, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id ORDER BY t.priority ASC, t.created_at DESC LIMIT 20");
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="font-mono font-semibold text-gray-300 mb-3">Task Queue <span className="text-gray-600 text-xs">({tasks.length})</span></h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tasks.length === 0 && <p className="text-gray-600 text-sm font-mono">no tasks queued</p>}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${statusDot[t.status] ?? "bg-gray-600"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-gray-300 truncate font-mono text-xs">{t.title}</p>
              <p className="text-gray-600 text-xs">{t.agent_name ?? "unassigned"} · p{t.priority}{t.estimated_value ? ` · $${t.estimated_value}` : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
