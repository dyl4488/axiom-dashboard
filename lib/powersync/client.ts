import { PowerSyncDatabase, AbstractPowerSyncDatabase } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';
import { AppSchema } from './schema';

class SupabaseConnector {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async fetchCredentials() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
      token: session?.access_token ?? '',
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
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

let powerSyncInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  if (!powerSyncInstance) {
    powerSyncInstance = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: 'axiom-dashboard.db' },
    });
  }
  return powerSyncInstance;
}

export const connector = new SupabaseConnector();

export async function initPowerSync(): Promise<PowerSyncDatabase> {
  const db = getPowerSync();
  await db.connect(connector);
  console.log('[PowerSync] Connected. Local SQLite is syncing.');
  return db;
}
