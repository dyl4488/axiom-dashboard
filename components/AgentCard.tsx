'use client';

/**
 * AgentCard — displays a single AXIOM agent's status
 *
 * Data comes from local SQLite via PowerSync. When an agent's status changes
 * in Supabase (e.g., idle → active), PowerSync syncs it to SQLite and this
 * component re-renders with zero network round-trips from the component's POV.
 */

import { usePowerSyncQuery } from '@powersync/react';

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: string;
  last_active: string | null;
}

interface AgentCardProps {
  agent: Agent;
}

// Status color and label mapping
const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  active:  { color: 'text-axiom-green', dot: 'bg-axiom-green animate-pulse', label: 'Active'  },
  idle:    { color: 'text-axiom-muted', dot: 'bg-axiom-muted',              label: 'Idle'    },
  error:   { color: 'text-axiom-red',   dot: 'bg-axiom-red',                label: 'Error'   },
  offline: { color: 'text-axiom-muted', dot: 'bg-axiom-border',             label: 'Offline' },
};

// Model display name shortening
function shortModel(model: string): string {
  if (model.includes('haiku'))  return 'Haiku';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('opus'))   return 'Opus';
  return model.split('/').pop() ?? model;
}

// Format relative time
function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const statusConfig = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;

  // Fetch the most recent log entry for this agent from local SQLite
  // This is a live query — re-runs when PowerSync updates agent_logs
  const { data: recentLogs } = usePowerSyncQuery<{
    message: string;
    event_type: string;
    created_at: string;
  }>(`
    SELECT message, event_type, created_at
    FROM agent_logs
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [agent.id]);

  const lastLog = recentLogs?.[0];

  return (
    <div className="bg-axiom-surface border border-axiom-border rounded-lg p-4 hover:border-axiom-green/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {/* Live status dot */}
            <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            <span className="font-mono font-bold text-axiom-text text-sm">
              {agent.name}
            </span>
          </div>
          <p className="text-axiom-muted text-xs mt-0.5 pl-4">{agent.role}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-mono ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <span className="text-xs font-mono text-axiom-border bg-axiom-bg px-1.5 py-0.5 rounded">
            {shortModel(agent.model)}
          </span>
        </div>
      </div>

      {/* Last activity */}
      <div className="border-t border-axiom-border pt-3">
        {lastLog ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-axiom-muted uppercase tracking-wider">
                {lastLog.event_type}
              </span>
              <span className="text-xs font-mono text-axiom-border">
                {timeAgo(lastLog.created_at)}
              </span>
            </div>
            <p className="text-xs text-axiom-muted font-mono leading-relaxed line-clamp-2">
              {lastLog.message}
            </p>
          </div>
        ) : (
          <p className="text-xs text-axiom-border font-mono">
            No recent activity · Last seen {timeAgo(agent.last_active)}
          </p>
        )}
      </div>
    </div>
  );
}
