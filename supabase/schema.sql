-- =============================================================================
-- AXIOM Dashboard — Supabase Schema
-- PowerSync AI Hackathon 2026
-- =============================================================================
-- Local-first AI agent monitoring system.
-- All tables are synced to local SQLite via PowerSync.
-- PowerSync requires replication-friendly tables: UUIDs, no sequences for PKs.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: agents
-- The AXIOM agent fleet. Each agent has a role, model, and live status.
-- =============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,                       -- e.g. "AXIOM-EARN"
  role        TEXT NOT NULL,                       -- e.g. "Freelance income"
  model       TEXT NOT NULL,                       -- e.g. "claude-haiku-4.5"
  status      TEXT NOT NULL DEFAULT 'idle'         -- idle | active | error | offline
                CHECK (status IN ('idle', 'active', 'error', 'offline')),
  last_active TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_active ON agents(last_active DESC);

-- =============================================================================
-- TABLE: tasks
-- Task queue shared between human and agents. Live-synced via PowerSync.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority        INTEGER NOT NULL DEFAULT 3        -- 1 = highest, 5 = lowest
                    CHECK (priority BETWEEN 1 AND 5),
  estimated_value NUMERIC(10, 2) DEFAULT 0,         -- estimated dollar value of task
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- =============================================================================
-- TABLE: ledger_entries
-- Immutable financial ledger. All income and spend tracked here.
-- =============================================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('income', 'spend')),
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ledger_type ON ledger_entries(type);
CREATE INDEX idx_ledger_agent_id ON ledger_entries(agent_id);
CREATE INDEX idx_ledger_created_at ON ledger_entries(created_at DESC);

-- =============================================================================
-- TABLE: positions
-- Paper trading positions tracked by AXIOM-MARKET.
-- =============================================================================
CREATE TABLE IF NOT EXISTS positions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol        TEXT NOT NULL,                     -- e.g. "AAPL", "BTC-USD"
  direction     TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  shares        NUMERIC(18, 6) NOT NULL,
  entry_price   NUMERIC(18, 4) NOT NULL,
  current_price NUMERIC(18, 4),                    -- updated periodically by agents
  pnl           NUMERIC(18, 4) GENERATED ALWAYS AS (
                  (current_price - entry_price) * shares *
                  CASE direction WHEN 'long' THEN 1 ELSE -1 END
                ) STORED,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_created_at ON positions(created_at DESC);

-- =============================================================================
-- TABLE: market_signals
-- Signals emitted by AXIOM-MARKET. Consumed by agents and displayed in UI.
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_signals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol      TEXT NOT NULL,
  signal_type TEXT NOT NULL,                       -- e.g. "BUY", "SELL", "HOLD", "ALERT"
  confidence  NUMERIC(5, 2) CHECK (confidence BETWEEN 0 AND 100),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_signals_symbol ON market_signals(symbol);
CREATE INDEX idx_signals_signal_type ON market_signals(signal_type);
CREATE INDEX idx_signals_created_at ON market_signals(created_at DESC);

-- =============================================================================
-- TABLE: agent_logs
-- High-volume event log. PowerSync syncs last 100 per agent for performance.
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                        -- e.g. "task_started", "error", "heartbeat"
  message    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}'::jsonb,            -- arbitrary structured data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — critical for PowerSync's row-number window function
CREATE INDEX idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX idx_agent_logs_event_type ON agent_logs(event_type);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at DESC);
-- Composite index used by PowerSync sync rule window query
CREATE INDEX idx_agent_logs_agent_created ON agent_logs(agent_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- PowerSync connects via a service role (bypasses RLS).
-- RLS here protects against direct client access via anon key.
-- All tables are readable by authenticated users; writes restricted.

ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs     ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read everything (PowerSync syncs it down to SQLite)
CREATE POLICY "Authenticated read: agents"
  ON agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read: tasks"
  ON tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read: ledger_entries"
  ON ledger_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read: positions"
  ON positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read: market_signals"
  ON market_signals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read: agent_logs"
  ON agent_logs FOR SELECT TO authenticated USING (true);

-- Writes: only service role (agents use service role via server-side API)
-- The anon/authenticated key is read-only from the browser.
-- Agents call a Next.js API route which uses the service role to write.

-- =============================================================================
-- REPLICATION (required for PowerSync)
-- PowerSync requires tables to have replication enabled via publications.
-- =============================================================================
CREATE PUBLICATION powersync FOR TABLE
  agents,
  tasks,
  ledger_entries,
  positions,
  market_signals,
  agent_logs;

-- =============================================================================
-- SEED DATA — AXIOM Fleet
-- =============================================================================
INSERT INTO agents (id, name, role, model, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'AXIOM-CORE',   'Orchestrator & ledger keeper',       'claude-sonnet-4.6', 'active'),
  ('a1000000-0000-0000-0000-000000000002', 'AXIOM-EARN',   'Freelance income via ClawWork',       'claude-haiku-4.5',  'idle'),
  ('a1000000-0000-0000-0000-000000000003', 'AXIOM-MARKET', 'Prediction markets & paper trading',  'claude-sonnet-4.6', 'idle'),
  ('a1000000-0000-0000-0000-000000000004', 'AXIOM-CREATE', 'Content & digital products',          'claude-sonnet-4.6', 'idle'),
  ('a1000000-0000-0000-0000-000000000005', 'AXIOM-OPS',    'Background automation & outreach',    'claude-haiku-4.5',  'idle'),
  ('a1000000-0000-0000-0000-000000000006', 'AXIOM-ARCH',   'Business builder & architecture',     'claude-opus-4.6',   'idle')
ON CONFLICT (id) DO NOTHING;
