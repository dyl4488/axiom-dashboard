import { createServerSupabaseClient, logAgentActivity, updateAgentStatus } from '../supabase/client';

export const AGENT_IDS = {
  CORE:   'a1000000-0000-0000-0000-000000000001',
  EARN:   'a1000000-0000-0000-0000-000000000002',
  MARKET: 'a1000000-0000-0000-0000-000000000003',
  CREATE: 'a1000000-0000-0000-0000-000000000004',
  OPS:    'a1000000-0000-0000-0000-000000000005',
  ARCH:   'a1000000-0000-0000-0000-000000000006',
} as const;

export const AXIOM_FLEET = {
  core:   { name: 'AXIOM-CORE',   id: AGENT_IDS.CORE,   model: 'claude-sonnet-4.6' },
  earn:   { name: 'AXIOM-EARN',   id: AGENT_IDS.EARN,   model: 'claude-haiku-4.5' },
  market: { name: 'AXIOM-MARKET', id: AGENT_IDS.MARKET, model: 'claude-sonnet-4.6' },
  ops:    { name: 'AXIOM-OPS',    id: AGENT_IDS.OPS,    model: 'claude-haiku-4.5' },
} as const;

export async function runAgent(agentName: string, agentId: string, prompt: string): Promise<string> {
  await updateAgentStatus(agentId, 'active');
  try {
    await logAgentActivity({
      agentId,
      eventType: 'run_start',
      message: `Running: ${prompt.slice(0, 200)}`,
      metadata: { agent: agentName },
    });
    // Simulate agent work - in production this calls OpenRouter API
    const output = `${agentName} completed task: ${prompt.slice(0, 100)}`;
    await logAgentActivity({
      agentId,
      eventType: 'run_complete',
      message: output,
      metadata: { agent: agentName },
    });
    await updateAgentStatus(agentId, 'idle');
    return output;
  } catch (error) {
    await logAgentActivity({ agentId, eventType: 'error', message: String(error), metadata: { error: true } });
    await updateAgentStatus(agentId, 'error');
    throw error;
  }
}