/**
 * AXIOM Dashboard — Mastra Agent Fleet
 *
 * This is the "agentic" layer of the submission.
 * Each AXIOM agent is defined here using Mastra's Agent framework.
 *
 * HOW IT WORKS WITH POWERSYNC:
 * 1. A Mastra agent runs (triggered by API route or cron)
 * 2. The agent does work (checks tasks, scans markets, etc.)
 * 3. The agent writes results to Supabase (via service role key)
 * 4. PowerSync detects the change in Postgres replication stream
 * 5. PowerSync streams the change to all connected clients
 * 6. All open browser tabs update instantly — no polling
 *
 * This is the killer demo: open 3 browser tabs, trigger an agent from one,
 * watch all three update simultaneously from local SQLite.
 *
 * Mastra docs: https://mastra.ai/docs
 */

import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';
import { createServerSupabaseClient, logAgentActivity, updateAgentStatus } from '../supabase/client';

// =============================================================================
// AGENT IDs — match the seed data in schema.sql
// =============================================================================
export const AGENT_IDS = {
  CORE:   'a1000000-0000-0000-0000-000000000001',
  EARN:   'a1000000-0000-0000-0000-000000000002',
  MARKET: 'a1000000-0000-0000-0000-000000000003',
  CREATE: 'a1000000-0000-0000-0000-000000000004',
  OPS:    'a1000000-0000-0000-0000-000000000005',
  ARCH:   'a1000000-0000-0000-0000-000000000006',
} as const;

// =============================================================================
// SHARED TOOLS
// Tools are functions agents can call. Results get written to Supabase,
// which PowerSync then syncs to all clients.
// =============================================================================

/**
 * checkTasks — fetch pending tasks from Supabase and log the count.
 * Any agent can use this tool to see what work is queued.
 */
const checkTasksTool = createTool({
  id: 'checkTasks',
  description: 'Check the current task queue and return pending task count and top priority tasks.',
  inputSchema: z.object({
    agentId: z.string().describe('The agent ID checking the tasks'),
    limit:   z.number().default(5).describe('Max tasks to return'),
  }),
  outputSchema: z.object({
    pendingCount: z.number(),
    tasks: z.array(z.object({
      id:              z.string(),
      title:           z.string(),
      priority:        z.number(),
      estimated_value: z.number().nullable(),
    })),
  }),
  execute: async ({ context }) => {
    const client = createServerSupabaseClient();

    // Fetch pending tasks sorted by priority
    const { data: tasks, error } = await client
      .from('tasks')
      .select('id, title, priority, estimated_value')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(context.limit);

    if (error) throw error;

    const result = {
      pendingCount: tasks?.length ?? 0,
      tasks: tasks ?? [],
    };

    // Log the check to agent_logs — PowerSync will sync this to all clients
    await logAgentActivity({
      agentId:   context.agentId,
      eventType: 'task_check',
      message:   `Found ${result.pendingCount} pending task(s). Top: "${tasks?.[0]?.title ?? 'none'}"`,
      metadata:  { taskIds: tasks?.map(t => t.id) },
    });

    return result;
  },
});

/**
 * reportPnL — calculate net P&L from the ledger and log a summary.
 * Reads from ledger_entries, writes a log entry that PowerSync syncs.
 */
const reportPnLTool = createTool({
  id: 'reportPnL',
  description: 'Calculate net P&L from the ledger and report the financial summary.',
  inputSchema: z.object({
    agentId: z.string().describe('The agent ID reporting P&L'),
  }),
  outputSchema: z.object({
    totalIncome:  z.number(),
    totalSpend:   z.number(),
    netPnL:       z.number(),
    positionsPnL: z.number().nullable(),
  }),
  execute: async ({ context }) => {
    const client = createServerSupabaseClient();

    // Sum income entries
    const { data: income } = await client
      .from('ledger_entries')
      .select('amount')
      .eq('type', 'income');

    // Sum spend entries
    const { data: spend } = await client
      .from('ledger_entries')
      .select('amount')
      .eq('type', 'spend');

    // Sum open position P&L
    const { data: positions } = await client
      .from('positions')
      .select('pnl')
      .eq('status', 'open');

    const totalIncome  = income?.reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0;
    const totalSpend   = spend?.reduce((s, r)  => s + (r.amount ?? 0), 0) ?? 0;
    const positionsPnL = positions?.reduce((s, r) => s + (r.pnl ?? 0), 0) ?? 0;
    const netPnL       = totalIncome - totalSpend + positionsPnL;

    const summary = `Net P&L: $${netPnL.toFixed(2)} | Income: $${totalIncome.toFixed(2)} | Spend: $${totalSpend.toFixed(2)} | Positions: $${positionsPnL.toFixed(2)}`;

    // Write to agent_logs — all clients see this update via PowerSync
    await logAgentActivity({
      agentId:   context.agentId,
      eventType: 'pnl_report',
      message:   summary,
      metadata:  { totalIncome, totalSpend, positionsPnL, netPnL },
    });

    return { totalIncome, totalSpend, netPnL, positionsPnL };
  },
});

/**
 * updateTaskStatus — claim a task and update its status in Supabase.
 * PowerSync propagates the status change to all clients instantly.
 */
const updateTaskStatusTool = createTool({
  id: 'updateTaskStatus',
  description: 'Claim and update the status of a task in the shared task queue.',
  inputSchema: z.object({
    agentId: z.string(),
    taskId:  z.string(),
    status:  z.enum(['in_progress', 'completed', 'failed']),
    notes:   z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    const client = createServerSupabaseClient();

    const update: Record<string, unknown> = {
      status:   context.status,
      agent_id: context.agentId,
    };

    if (context.status === 'completed') {
      update.completed_at = new Date().toISOString();
    }

    const { error } = await client
      .from('tasks')
      .update(update)
      .eq('id', context.taskId);

    if (error) throw error;

    await logAgentActivity({
      agentId:   context.agentId,
      eventType: 'task_update',
      message:   `Task ${context.taskId} → ${context.status}. ${context.notes ?? ''}`,
      metadata:  { taskId: context.taskId, status: context.status },
    });

    return { success: true };
  },
});

// =============================================================================
// AGENT DEFINITIONS
// Each agent has:
// - name & instructions (personality/role)
// - model (haiku for cheap tasks, sonnet for reasoning)
// - tools it can use
// =============================================================================

/**
 * AXIOM-CORE — Orchestrator
 * Monitors the fleet, keeps the ledger, reports to the human.
 */
export const axiomCore = new Agent({
  name: 'AXIOM-CORE',
  instructions: `You are AXIOM-CORE, the orchestrator of the AXIOM autonomous agent fleet.
Your job is to:
1. Monitor all other agents' status and activity
2. Maintain the financial ledger and report P&L
3. Prioritize the task queue
4. Alert the human to important events

Always be direct and precise. Lead with numbers. Report status concisely.
When you complete any action, it immediately appears in the dashboard for all viewers.`,
  model: {
    provider: 'openrouter',
    name: 'anthropic/claude-sonnet-4-5',
    toolChoice: 'auto',
  },
  tools: { checkTasksTool, reportPnLTool, updateTaskStatusTool },
});

/**
 * AXIOM-EARN — Freelance Income Agent
 * Manages the task queue for income-generating work.
 */
export const axiomEarn = new Agent({
  name: 'AXIOM-EARN',
  instructions: `You are AXIOM-EARN, the income agent of the AXIOM fleet.
Your job is to:
1. Scan the task queue for income-generating tasks
2. Claim and complete tasks that match your capabilities
3. Log all activity so the team can track progress
4. Maximize revenue per hour of work

Focus on tasks with the highest estimated_value. Work efficiently.
Every task you complete updates the shared dashboard for the whole team.`,
  model: {
    provider: 'openrouter',
    name: 'anthropic/claude-haiku-4-5',  // Haiku for cost efficiency
    toolChoice: 'auto',
  },
  tools: { checkTasksTool, updateTaskStatusTool },
});

/**
 * AXIOM-MARKET — Market Intelligence Agent
 * Manages paper trading positions and market signals.
 */
export const axiomMarket = new Agent({
  name: 'AXIOM-MARKET',
  instructions: `You are AXIOM-MARKET, the market intelligence agent of the AXIOM fleet.
Your job is to:
1. Monitor paper trading positions and calculate P&L
2. Emit market signals with confidence scores
3. Report financial performance to AXIOM-CORE
4. Track position performance across all open trades

Be analytical. Use confidence percentages. Flag positions at risk.
Your P&L reports update the dashboard in real-time for all viewers.`,
  model: {
    provider: 'openrouter',
    name: 'anthropic/claude-sonnet-4-5',
    toolChoice: 'auto',
  },
  tools: { reportPnLTool, checkTasksTool },
});

/**
 * AXIOM-OPS — Background Operations Agent
 * Handles monitoring, automation, and opportunity detection.
 */
export const axiomOps = new Agent({
  name: 'AXIOM-OPS',
  instructions: `You are AXIOM-OPS, the background operations agent of the AXIOM fleet.
Your job is to:
1. Run periodic health checks on the fleet
2. Scan for new opportunities and add them to the task queue
3. Monitor external signals and log anomalies
4. Keep the team informed of system status

You are efficient and methodical. Every heartbeat you log appears live in the dashboard.`,
  model: {
    provider: 'openrouter',
    name: 'anthropic/claude-haiku-4-5',  // Haiku for repetitive monitoring
    toolChoice: 'auto',
  },
  tools: { checkTasksTool, updateTaskStatusTool },
});

// =============================================================================
// RUNNER HELPERS
// Convenience functions to run agents. Called from API routes.
// Each run: (1) marks agent active, (2) runs agent, (3) marks agent idle.
// PowerSync syncs all state changes to every connected client.
// =============================================================================

export async function runAgent(
  agent: Agent,
  agentId: string,
  prompt: string,
): Promise<string> {
  await updateAgentStatus(agentId, 'active');

  try {
    const result = await agent.generate(prompt);
    const output = result.text ?? 'Agent completed with no text output.';

    await logAgentActivity({
      agentId,
      eventType: 'run_complete',
      message:   output.slice(0, 500),  // truncate for log table
      metadata:  { promptLength: prompt.length },
    });

    await updateAgentStatus(agentId, 'idle');
    return output;
  } catch (error) {
    await logAgentActivity({
      agentId,
      eventType: 'error',
      message:   String(error),
      metadata:  { error: true },
    });
    await updateAgentStatus(agentId, 'error');
    throw error;
  }
}

// Export all agents as a fleet map
export const AXIOM_FLEET = {
  core:   { agent: axiomCore,   id: AGENT_IDS.CORE },
  earn:   { agent: axiomEarn,   id: AGENT_IDS.EARN },
  market: { agent: axiomMarket, id: AGENT_IDS.MARKET },
  ops:    { agent: axiomOps,    id: AGENT_IDS.OPS },
} as const;
