# AXIOM Dashboard

### Local-First AI Agent Monitoring System
**PowerSync AI Hackathon 2026 Submission**

---

## What It Does

AXIOM Dashboard is a real-time operations center for a fleet of autonomous AI agents. Humans and AI agents share a **live synchronized workspace** — task queue, P&L ledger, market positions, and agent activity logs — all powered by PowerSync.

**The killer demo:** Open the dashboard in 3 browser tabs. Trigger an agent from one tab. Watch all three update simultaneously — from **local SQLite**, with zero network round-trips on the read path.

---

## Why PowerSync Makes This Better

### The Problem With REST APIs

A typical approach would poll a REST endpoint every few seconds:
```
Browser → GET /api/tasks (every 5s) → Postgres → JSON → Re-render
```

Problems:
- **Latency**: Every read hits the network. 50–500ms round-trip.
- **No offline support**: If the connection drops, the UI is dead.
- **Polling waste**: Most polls return no new data.
- **Stale data**: Between polls, users see outdated state.
- **Scale issues**: 100 clients = 100 polling loops = database hammered.

### The PowerSync Solution

```
Supabase (Postgres) → PowerSync Sync Service → Local SQLite (browser)
                                                      ↑
                                            usePowerSyncQuery()
                                                      ↑
                                            React components
```

Benefits:
- **Zero read latency**: Components query local SQLite. No network request.
- **Offline-first**: SQLite persists. Data available when disconnected.
- **Push, not pull**: PowerSync watches Postgres replication stream. Changes stream to clients instantly.
- **Multi-tab sync**: All open tabs share the same local SQLite — updates broadcast instantly.
- **Efficient**: PowerSync only sends changed rows, not full table dumps.

### Code Comparison

**Without PowerSync (polling):**
```typescript
// Every 5 seconds, hit the network
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

**With PowerSync (local SQLite):**
```typescript
// Query local SQLite — re-renders automatically when data changes
const { data: tasks } = usePowerSyncQuery(`
  SELECT t.*, a.name as agent_name
  FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id
  ORDER BY priority ASC
`);
```

The PowerSync version: faster, offline-capable, real-time, and simpler.

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Sync Engine | **PowerSync** | Supabase → local SQLite sync |
| Backend | **Supabase** (PostgreSQL) | Source of truth, RLS, replication |
| Agents | **Mastra** | AI agent orchestration framework |
| Frontend | **Next.js 14** (App Router) | React UI |
| Data Layer | **TanStack Query** | Server mutations, API calls |
| Local DB | **SQLite** (via PowerSync Web SDK) | In-browser, instant reads |
| Styling | **Tailwind CSS** | Terminal dark aesthetic |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   Next.js   │    │    PowerSync Web SDK      │   │
│  │   React UI  │◄───│    (local SQLite)         │   │
│  │             │    │                          │   │
│  │ AgentCard   │    │  usePowerSyncQuery()      │   │
│  │ TaskFeed    │    │  ← queries local SQLite   │   │
│  │ PnLWidget   │    │  ← re-renders on changes  │   │
│  │ PositionTbl │    └──────────────┬───────────┘   │
│  └──────┬──────┘                   │                │
│         │ POST /api/agent/run      │ sync stream    │
└─────────┼───────────────────────── ┼────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────┐      ┌───────────────────────┐
│   Next.js API   │      │   PowerSync Service   │
│   Routes        │      │                       │
│                 │      │  Watches Postgres WAL  │
│  Mastra Agents  │      │  Streams changes to   │
│  ─ AXIOM-CORE  │      │  all connected clients │
│  ─ AXIOM-EARN  │      └──────────┬────────────┘
│  ─ AXIOM-MARKET│                 │
│  ─ AXIOM-OPS   │                 │
└────────┬────────┘                │
         │ write                   │ replication
         ▼                         ▼
┌─────────────────────────────────────────────────────┐
│                 Supabase (PostgreSQL)                │
│                                                     │
│  agents  tasks  ledger_entries  positions            │
│  market_signals  agent_logs                         │
│                                                     │
│  RLS policies  •  Indexes  •  Publication           │
└─────────────────────────────────────────────────────┘
```

### Write Flow (Agent Updates State)
1. User triggers an agent via the dashboard UI
2. Browser POSTs to `/api/agent/run`
3. Mastra agent runs (LLM call), does work
4. Agent writes results to Supabase via service role key
5. Supabase triggers change in Postgres WAL (Write-Ahead Log)
6. PowerSync detects the change via replication stream
7. PowerSync streams the delta to all connected clients
8. Each client's local SQLite updates
9. React components using `usePowerSyncQuery` re-render automatically

**Total time from write to all clients updating: ~100–300ms.**

### Read Flow (Component Queries Data)
1. Component calls `usePowerSyncQuery(sql)`
2. PowerSync queries local SQLite
3. Result returns in **< 1ms**
4. Zero network request

---

## Agent Fleet (Mastra)

| Agent | Model | Role |
|-------|-------|------|
| **AXIOM-CORE** | Claude Sonnet | Orchestrator, ledger keeper, fleet monitor |
| **AXIOM-EARN** | Claude Haiku | Task queue, freelance income |
| **AXIOM-MARKET** | Claude Sonnet | Paper trading, market signals, P&L |
| **AXIOM-OPS** | Claude Haiku | Background monitoring, health checks |

Each agent:
- Has a defined personality and instructions
- Can use tools (`checkTasks`, `reportPnL`, `updateTaskStatus`)
- Writes all activity to `agent_logs` in Supabase
- PowerSync syncs those logs to every client instantly

---

## Setup

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- PowerSync account (free tier: https://app.powersync.com)
- OpenRouter API key (for Mastra agents)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/axiom-dashboard
cd axiom-dashboard
npm install
```

### 2. Supabase Setup
1. Create a new Supabase project
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. This creates tables, indexes, RLS policies, seed agents, and enables replication

### 3. PowerSync Setup
1. Create a PowerSync instance at https://app.powersync.com
2. Connect it to your Supabase database
3. Upload `powersync/sync-rules.yaml` as your sync rules
4. Note your PowerSync endpoint URL

### 4. Environment Variables
```bash
cp .env.example .env.local
```
Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
OPENROUTER_API_KEY=your-openrouter-key
```

### 5. Run
```bash
npm run dev
```

Open http://localhost:3000

**Demo:** Open 3 browser tabs. Click "Run" on any agent in one tab. Watch all three tabs update simultaneously.

---

## Project Structure

```
axiom-dashboard/
├── app/
│   ├── api/
│   │   └── agent/run/route.ts   # Agent trigger endpoint
│   ├── globals.css
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Main dashboard
│   └── providers.tsx            # PowerSync + TanStack providers
├── components/
│   ├── AgentCard.tsx            # Agent status card (live from SQLite)
│   ├── TaskFeed.tsx             # Live task queue (live from SQLite)
│   ├── PnLWidget.tsx            # P&L summary (live from SQLite)
│   └── PositionTable.tsx        # Trading positions (live from SQLite)
├── lib/
│   ├── mastra/
│   │   └── agents.ts            # Mastra agent fleet definitions
│   ├── powersync/
│   │   ├── client.ts            # PowerSync client + connector
│   │   └── schema.ts            # Client-side SQLite schema
│   └── supabase/
│       └── client.ts            # Supabase clients (browser + server)
├── powersync/
│   └── sync-rules.yaml          # PowerSync sync configuration
├── supabase/
│   └── schema.sql               # Full Postgres schema + RLS
├── .env.example
├── next.config.ts               # WASM + COOP/COEP headers config
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Key PowerSync Features Used

### 1. `usePowerSyncQuery` — Live Local Queries
```typescript
// In TaskFeed.tsx — queries local SQLite, re-renders on changes
const { data: tasks } = usePowerSyncQuery(`
  SELECT t.*, a.name AS agent_name
  FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id
  ORDER BY priority ASC
  LIMIT 50
`);
```

### 2. Parameterized Queries — Per-Agent Log Fetch
```typescript
// In AgentCard.tsx — fetches logs for specific agent
const { data: logs } = usePowerSyncQuery(`
  SELECT message, event_type, created_at
  FROM agent_logs WHERE agent_id = ?
  ORDER BY created_at DESC LIMIT 1
`, [agent.id]);
```

### 3. Sync Rules — Performance Filtering
```yaml
# Only sync last 100 logs per agent — prevents SQLite bloat
- SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at DESC) AS rn
    FROM agent_logs
  ) WHERE rn <= 100
```

### 4. Offline-First
The dashboard continues to work when offline. SQLite is local. When reconnected, PowerSync replays missed changes automatically.

---

## Bonus Prize Targeting

### Supabase Prize
- Full PostgreSQL schema with RLS policies
- Row-level security for all 6 tables
- Optimized indexes for PowerSync's query patterns
- Postgres publication for replication

### Mastra Prize
- 4 distinct agents with unique personalities and models
- Custom tools (`checkTasks`, `reportPnL`, `updateTaskStatus`)
- Agents as the write path — they drive the real-time updates

---

## Built For

**PowerSync AI Hackathon 2026** — https://powersync.com/hackathon

The core thesis: **AI agents and humans sharing a live workspace** is fundamentally different from polling an API. PowerSync makes that sharing instant, offline-capable, and scalable without any polling infrastructure.

---

*AXIOM Dashboard — Built by the AXIOM fleet, for the AXIOM fleet.*
