/**
 * AXIOM Dashboard — PowerSync Client-Side Schema
 *
 * This mirrors the Supabase PostgreSQL schema on the client.
 * PowerSync stores synced data in local SQLite using this schema.
 *
 * WHY THIS MATTERS:
 * When PowerSync syncs data from Supabase, it writes it into a local SQLite
 * database on the user's device. React hooks (usePowerSyncQuery) then query
 * this SQLite DB directly — sub-millisecond reads, zero network latency,
 * works offline. This schema tells PowerSync how to structure those local tables.
 *
 * Docs: https://docs.powersync.com/client-sdk-references/react-native-and-expo/schema
 */

import {
  column,
  Schema,
  Table,
} from '@powersync/web';

/**
 * agents table
 * The AXIOM fleet — each agent's identity, model, and live status.
 */
const agents = new Table({
  name:        column.text,
  role:        column.text,
  model:       column.text,
  status:      column.text,   // idle | active | error | offline
  last_active: column.text,   // ISO timestamp string (SQLite has no native timestamp)
  created_at:  column.text,
});

/**
 * tasks table
 * The shared task queue. Agents pick tasks, humans add tasks, everyone sees updates.
 */
const tasks = new Table({
  agent_id:        column.text,   // FK to agents.id
  title:           column.text,
  description:     column.text,
  status:          column.text,   // pending | in_progress | completed | failed | cancelled
  priority:        column.integer, // 1 (highest) to 5 (lowest)
  estimated_value: column.real,   // dollar value estimate
  created_at:      column.text,
  completed_at:    column.text,
});

/**
 * ledger_entries table
 * Immutable financial ledger — income and spend from all agents.
 */
const ledger_entries = new Table({
  type:        column.text,   // income | spend
  amount:      column.real,
  description: column.text,
  agent_id:    column.text,
  created_at:  column.text,
});

/**
 * positions table
 * Paper trading positions managed by AXIOM-MARKET.
 * P&L is a computed column in Postgres; synced as a real value here.
 */
const positions = new Table({
  symbol:        column.text,
  direction:     column.text,   // long | short
  shares:        column.real,
  entry_price:   column.real,
  current_price: column.real,
  pnl:           column.real,   // computed in Postgres, synced as value
  status:        column.text,   // open | closed
  created_at:    column.text,
});

/**
 * market_signals table
 * Trading signals emitted by AXIOM-MARKET.
 */
const market_signals = new Table({
  symbol:      column.text,
  signal_type: column.text,   // BUY | SELL | HOLD | ALERT
  confidence:  column.real,   // 0–100
  notes:       column.text,
  created_at:  column.text,
});

/**
 * agent_logs table
 * High-frequency event log. PowerSync syncs only last 100 per agent
 * (see sync-rules.yaml). Still gives us live log streaming in the UI.
 */
const agent_logs = new Table({
  agent_id:   column.text,
  event_type: column.text,
  message:    column.text,
  metadata:   column.text,   // JSONB → serialized as JSON string in SQLite
  created_at: column.text,
});

/**
 * The AXIOM PowerSync Schema
 * Register all tables so PowerSync knows how to create the local SQLite schema.
 */
export const AppSchema = new Schema({
  agents,
  tasks,
  ledger_entries,
  positions,
  market_signals,
  agent_logs,
});

// Export type helpers for TypeScript
export type Database = (typeof AppSchema)['types'];
export type Agent = Database['agents'];
export type Task = Database['tasks'];
export type LedgerEntry = Database['ledger_entries'];
export type Position = Database['positions'];
export type MarketSignal = Database['market_signals'];
export type AgentLog = Database['agent_logs'];
