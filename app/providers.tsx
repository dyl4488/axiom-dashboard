'use client';

/**
 * AXIOM Dashboard — App Providers
 *
 * Wraps the entire app with:
 * 1. PowerSyncProvider — makes the local SQLite DB available to all components
 *    via usePowerSync() and usePowerSyncQuery() hooks
 * 2. QueryClientProvider — TanStack Query for server-state (API routes)
 *
 * The PowerSyncProvider is the key piece:
 * - It initializes the local SQLite database in the browser
 * - Connects to the PowerSync sync service
 * - Starts streaming changes from Supabase → local SQLite
 * - All child components can now query SQLite via hooks — instantly, offline-capable
 */

import React, { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getPowerSync, connector } from '@/lib/powersync/client';
import type { PowerSyncDatabase } from '@powersync/web';

// TanStack Query client — for non-PowerSync data (API calls, mutations)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,  // 30s — PowerSync handles freshness for SQLite queries
      retry: 2,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [powerSync, setPowerSync] = useState<PowerSyncDatabase | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const db = getPowerSync();

        // Connect to the PowerSync sync service
        // This starts the bidirectional sync: Supabase ↔ local SQLite
        await db.connect(connector);

        if (mounted) {
          setPowerSync(db);
          setSyncStatus('connected');
          console.log('[AXIOM] PowerSync connected. Local SQLite syncing.');
        }
      } catch (error) {
        console.error('[AXIOM] PowerSync connection failed:', error);
        if (mounted) setSyncStatus('error');
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {powerSync ? (
        // PowerSyncContext makes the DB instance available to all child hooks
        <PowerSyncContext.Provider value={powerSync}>
          {/* Sync status indicator */}
          <div className="fixed bottom-4 right-4 z-50">
            <SyncStatusBadge status={syncStatus} />
          </div>
          {children}
        </PowerSyncContext.Provider>
      ) : (
        // Loading state while PowerSync initializes local SQLite
        <div className="min-h-screen bg-axiom-bg flex items-center justify-center">
          <div className="text-center">
            <div className="text-axiom-green text-2xl font-mono mb-2">AXIOM</div>
            <div className="text-axiom-muted text-sm font-mono">
              {syncStatus === 'error' ? '⚠ Sync connection failed' : '⟳ Initializing local database...'}
            </div>
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}

// Small badge showing sync connection status
function SyncStatusBadge({ status }: { status: 'connecting' | 'connected' | 'error' }) {
  const config = {
    connecting: { color: 'bg-axiom-amber',  dot: 'animate-pulse', label: 'Connecting' },
    connected:  { color: 'bg-axiom-green',  dot: 'animate-pulse', label: 'Live'       },
    error:      { color: 'bg-axiom-red',    dot: '',              label: 'Offline'    },
  }[status];

  return (
    <div className="flex items-center gap-1.5 bg-axiom-surface border border-axiom-border rounded-full px-3 py-1">
      <div className={`w-2 h-2 rounded-full ${config.color} ${config.dot}`} />
      <span className="text-xs font-mono text-axiom-muted">{config.label}</span>
    </div>
  );
}
