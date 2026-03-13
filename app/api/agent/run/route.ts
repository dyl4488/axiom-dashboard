/**
 * AXIOM Dashboard — Agent Run API Route
 * POST /api/agent/run
 *
 * Triggers a Mastra agent to run a task.
 * The agent writes its results to Supabase.
 * PowerSync then syncs those writes to all connected clients.
 *
 * This is the write path:
 *   Browser → POST /api/agent/run → Mastra Agent → Supabase → PowerSync → All Clients
 *
 * The read path is:
 *   Local SQLite (via PowerSync) → usePowerSyncQuery hook → React component
 */

import { NextRequest, NextResponse } from 'next/server';
import { AXIOM_FLEET, runAgent } from '@/lib/mastra/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent: agentKey, prompt } = body as {
      agent: 'core' | 'earn' | 'market' | 'ops';
      prompt: string;
    };

    if (!agentKey || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: agent, prompt' },
        { status: 400 },
      );
    }

    const fleet = AXIOM_FLEET[agentKey];
    if (!fleet) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentKey}. Valid: core, earn, market, ops` },
        { status: 400 },
      );
    }

    // Run the Mastra agent
    // This: sets agent status → active, runs LLM, writes logs to Supabase,
    // sets status → idle. PowerSync syncs everything to all clients.
    const result = await runAgent(fleet.agent, fleet.id, prompt);

    return NextResponse.json({ result, agent: agentKey });

  } catch (error) {
    console.error('[API] /api/agent/run error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
