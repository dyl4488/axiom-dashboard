'use client';

/**
 * TaskFeed — live scrolling task queue
 *
 * Reads from local SQLite via usePowerSyncQuery.
 * When an agent claims a task (status: pending → in_progress),
 * this feed updates instantly across all open browser tabs.
 *
 * This is the core PowerSync demo: shared state, zero latency.
 */

import { usePowerSyncQuery } from '@powersync/react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  estimated_value: number | null;
  agent_name: string | null;
  created_at: string;
  completed_at: string | null;
}

// Status badge styling
const STATUS_STYLES: Record<string, string> = {
  pending:     'text-axiom-amber  border-axiom-amber/30  bg-axiom-amber/10',
  in_progress: 'text-axiom-blue   border-axiom-blue/30   bg-axiom-blue/10',
  completed:   'text-axiom-green  border-axiom-green/30  bg-axiom-green/10',
  failed:      'text-axiom-red    border-axiom-red/30    bg-axiom-red/10',
  cancelled:   'text-axiom-muted  border-axiom-border    bg-axiom-bg',
};

// Priority dot colors (1=urgent → 5=low)
const PRIORITY_COLORS = ['', 'bg-axiom-red', 'bg-axiom-amber', 'bg-axiom-blue', 'bg-axiom-muted', 'bg-axiom-border'];

function formatCurrency(val: number | null): string | null {
  if (val == null || val === 0) return null;
  return `$${val.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function TaskFeed() {
  // JOIN tasks → agents to show which agent owns each task.
  // Querying LOCAL SQLite — no network request, sub-millisecond response.
  const { data: tasks } = usePowerSyncQuery<Task>(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.estimated_value,
      t.created_at,
      t.completed_at,
      a.name AS agent_name
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    ORDER BY
      CASE t.status
        WHEN 'in_progress' THEN 0
        WHEN 'pending'     THEN 1
        WHEN 'completed'   THEN 2
        WHEN 'failed'      THEN 3
        ELSE 4
      END,
      t.priority ASC,
      t.created_at DESC
    LIMIT 50
  `);

  const pending     = tasks?.filter(t => t.status === 'pending').length ?? 0;
  const in_progress = tasks?.filter(t => t.status === 'in_progress').length ?? 0;

  return (
    <div className="bg-axiom-surface border border-axiom-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-axiom-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-axiom-muted text-xs font-mono uppercase tracking-wider">Task Queue</span>
          <span className="text-xs font-mono bg-axiom-bg border border-axiom-border text-axiom-muted px-1.5 py-0.5 rounded">
            {tasks?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          {in_progress > 0 && (
            <span className="text-axiom-blue">{in_progress} running</span>
          )}
          {pending > 0 && (
            <span className="text-axiom-amber">{pending} pending</span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="overflow-y-auto max-h-80">
        {(!tasks || tasks.length === 0) && (
          <div className="text-center text-axiom-muted text-sm font-mono py-12">
            No tasks yet. Trigger an agent to create some.
          </div>
        )}

        {tasks?.map(task => (
          <div
            key={task.id}
            className="px-4 py-3 border-b border-axiom-border last:border-b-0 hover:bg-axiom-bg/50 transition-colors animate-slide-in"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {/* Priority dot */}
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLORS[task.priority] ?? 'bg-axiom-border'}`} />
                <div className="min-w-0">
                  <p className="text-sm text-axiom-text font-mono truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-axiom-muted mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {task.agent_name && (
                      <span className="text-xs font-mono text-axiom-muted">{task.agent_name}</span>
                    )}
                    <span className="text-xs font-mono text-axiom-border">{timeAgo(task.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${STATUS_STYLES[task.status] ?? STATUS_STYLES.cancelled}`}>
                  {task.status}
                </span>
                {formatCurrency(task.estimated_value) && (
                  <span className="text-xs font-mono text-axiom-green">
                    {formatCurrency(task.estimated_value)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
