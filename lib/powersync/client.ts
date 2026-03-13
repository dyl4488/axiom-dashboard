/**
 * AXIOM Dashboard — PowerSync Client
 *
 * Sets up the PowerSync client that:
 * 1. Connects to the PowerSync service (which watches your Supabase DB)
 * 2. Maintains a local SQLite database on the client device
 * 3. Keeps the two in sync in real-time
 *
 * Architecture:
 *   Supabase (Postgres) ←→ PowerSync Service ←→ PowerSync Client (SQLite)
 *                                                        ↑
 *                                              React hooks query this
 *
 * The result: React components read from LOCAL SQLite. Reads are instant.
 * When Supabase data changes (e.g., an agent updates a task), PowerSync
 * streams the change to all connected clients and updates their local SQLite.
 * React hooks re-render automatically — no polling, no websocket boilerplate.
 */

import { PowerSyncDatabase } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';
import { AppSchema } from './schema';

// =============================================================================
// Supabase Connector
// PowerSync needs a connector that tells it how to authenticate with Supabase
// and how to apply local mutations back to Postgres (write path).
// =============================================================================

class SupabaseConnector {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  /**
   * fetchCredentials — called by PowerSync to get a JWT for the sync connection.
   * PowerSync uses this JWT to authenticate the sync stream and enforce RLS.
   */
  async fetchCredentials() {
    const { data: { session }, error } = await this.supabase.auth.getSession();

    if (error) throw error;

    if (!session) {
      // For demo/hackathon: allow anonymous access
      // In production: throw new Error('Not authenticated');
      return {
        endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
        token: '',  // PowerSync can operate without auth for public buckets
      };
    }

    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
      token: session.access_token,
    };
  }

  /**
   * uploadData — PowerSync calls this when local mutations need to be
   * written back to Supabase. In AXIOM, all writes go through API routes
   * (which use the service role key), so we keep this minimal.
   *
   * For a full CRUD app, you'd implement optimistic mutations here.
   */
  async uploadData(database: PowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const { table, opData, op: operation } = op;

        if (operation === 'PUT') {
          await this.supabase.from(table).upsert(opData);
        } else if (operation === 'PATCH') {
          await this.supabase.from(table).update(opData).eq('id', op.id);
        } else if (operation === 'DELETE') {
          await this.supabase.from(table).delete().eq('id', op.id);
        }
      }

      await transaction.complete();
    } catch (error) {
      console.error('[PowerSync] Failed to upload mutation:', error);
      throw error;
    }
  }
}

// =============================================================================
// PowerSync Database Instance
// Singleton — one instance per browser tab, persisted across renders.
// =============================================================================

let powerSyncInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  if (!powerSyncInstance) {
    powerSyncInstance = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        // SQLite database name — stored in browser's Origin Private File System
        dbFilename: 'axiom-dashboard.db',
      },
    });
  }
  return powerSyncInstance;
}

export const connector = new SupabaseConnector();

/**
 * initPowerSync — call this once at app startup (in providers.tsx).
 * Connects the PowerSync client to the sync service and starts streaming.
 */
export async function initPowerSync(): Promise<PowerSyncDatabase> {
  const db = getPowerSync();
  await db.connect(connector);
  console.log('[PowerSync] Connected. Local SQLite is syncing.');
  return db;
}
