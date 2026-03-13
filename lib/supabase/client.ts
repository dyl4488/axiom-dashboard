/**
 * AXIOM Dashboard — Supabase Client
 *
 * Two clients:
 * 1. Browser client (anon key) — used for auth and client-side reads
 *    NOTE: In AXIOM we prefer PowerSync for reads (local SQLite is faster)
 *    The browser client is mainly for auth flows.
 *
 * 2. Server client (service role) — used in API routes for agent writes
 *    Agents call /api/agent/* routes which use this to bypass RLS and write
 *    directly to Supabase. PowerSync then syncs those writes to all clients.
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// Browser Client (anon key — safe to expose)
// =============================================================================
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// =============================================================================
// Server Client (service role — API routes only, never in browser code)
// This bypasses RLS and is used by Mastra agents to write logs/tasks/ledger.
// =============================================================================
export function createServerSupabaseClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. This client is for server use only.');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// =============================================================================
// Helper: log agent activity to Supabase
// Called by Mastra agents. PowerSync syncs the new row to all clients.
// =============================================================================
export async function logAgentActivity(params: {
  agentId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const client = createServerSupabaseClient();

  const { error } = await client.from('agent_logs').insert({
    agent_id:   params.agentId,
    event_type: params.eventType,
    message:    params.message,
    metadata:   params.metadata ?? {},
  });

  if (error) {
    console.error('[Supabase] Failed to log agent activity:', error);
    throw error;
  }
}

// =============================================================================
// Helper: update agent status
// =============================================================================
export async function updateAgentStatus(
  agentId: string,
  status: 'idle' | 'active' | 'error' | 'offline',
) {
  const client = createServerSupabaseClient();

  const { error } = await client
    .from('agents')
    .update({ status, last_active: new Date().toISOString() })
    .eq('id', agentId);

  if (error) {
    console.error('[Supabase] Failed to update agent status:', error);
    throw error;
  }
}
