# Honcho Memory Plugin for Hermes Dashboard

Plugin for monitoring and exploring the Honcho local memory system — live stats, drill-down detail views, semantic search, and system health.

**Version:** 0.2.0  
**Status:** Active — deployed on `http://100.122.198.32:9119` (Tailscale/Carnice)

## Features

### Live Monitoring
- **Stats grid** — Documents, Messages, Embeddings, Queue with sparklines (30s auto-refresh)
- **Queue gauge** — Color-coded health bar (green <5, yellow 5-10, red >10)
- **Per-agent table** — Memory usage by agent with "Last Active" timestamps
- **CSV export** — One-click download of all stats + per-agent data

### Drill-Down Detail Views
- **Clickable stat cards** — Documents, Messages, Embeddings are clickable (↗ on hover)
- **Paginated lists** — 50 items per view with full metadata (observer, session, timestamps)
- **Content preview** — 300-char truncation with per-type metadata badges
- **Back navigation** — ← Back button returns to overview

### Semantic Search
- Proxy to Honcho's semantic search endpoint
- Result cards with relevance score, observer, and content preview
- Empty/no-results/error states handled

### System Health
- `/health` — Database connectivity check
- `/config` — Configuration snapshot with automatic secret redaction
- `/queue` — Task queue status with API-to-DB fallback

## API Endpoints

All mounted under `/api/plugins/honcha-memory/`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stats` | Aggregate counts, per-peer breakdown, 24h rate, queue depth (30s cache) |
| GET | `/documents?limit=50&offset=0` | Paginated document list (limit 1-100) with observer/session metadata |
| GET | `/messages?limit=50&offset=0` | Paginated message log (limit 1-100) with peer/token metadata |
| GET | `/embeddings?limit=50&offset=0` | Paginated embedding metadata (limit 1-100, no vector data) |
| GET | `/queue` | Task queue breakdown — Honcho API with DB fallback |
| POST | `/search` | Semantic search proxy (body: `{query, limit}`) |
| GET | `/config` | Configuration snapshot (secrets redacted) |
| GET | `/health` | Database connectivity check |

## Installation

The plugin is auto-discovered from the profile-local plugins directory.

```bash
# Symlink from NAS repo to Hermes profile plugins dir
mkdir -p ~/.hermes/profiles/frodo/plugins/
ln -s /mnt/nas/github_repos/hermes-plugins/honcha-memory \
      ~/.hermes/profiles/frodo/plugins/honcha-memory

# Restart dashboard
systemctl --user restart hermes-dashboard
```

Hard-reload the dashboard (Ctrl+Shift+R) to see the "Honcho Memory" tab.

## Development

```bash
# Repo
cd /mnt/nas/github_repos/hermes-plugins/honcha-memory

# Run tests (20 tests, requires Docker for DB-dependent tests)
~/.hermes/hermes-agent/venv/bin/python -m pytest tests/test_api.py -v

# Verify IIFE syntax
node --check dashboard/dist/index.js

# Verify paren/brace balance
python3 -c "
c=open('dashboard/dist/index.js').read()
print(f'Parens: {c.count(\"(\")-c.count(\")\")}, Braces: {c.count(\"{\")-c.count(\"}\")}')
"
```

### Project Structure

```
honcha-memory/
├── dashboard/
│   ├── api.py              # FastAPI backend (8 endpoints)
│   ├── index.tsx            # TypeScript source (readable reference)
│   ├── manifest.json        # Plugin registration (Honcho Memory v0.2.0)
│   ├── plugin.css           # Scoped dark theme (all selectors under .honcho-memory-plugin)
│   └── dist/
│       └── index.js         # IIFE build — canonical deployed artifact
├── tests/
│   ├── __init__.py
│   └── test_api.py          # Config, search, pagination, detail, frontend, and manifest tests
└── docs/
    └── plans/
        └── v0.2.0-enhancement-sprint.md
```

### Architecture Notes

- **Backend:** FastAPI with `docker exec psql` for direct DB access (no separate API server needed)
- **Frontend:** React IIFE via Hermes Plugin SDK (`window.__HERMES_PLUGIN_SDK__`)
- **Build:** `index.tsx` is the readable TypeScript source; `dist/index.js` is the hand-crafted IIFE build. Features are developed in the IIFE, then synced to TS source.
- **CSS:** All selectors scoped under `.honcho-memory-plugin` to prevent cross-plugin collisions. CSS variables for theming.
- **Caching:** Stats endpoint has 30s in-memory cache. Frontend polls every 30s.
- **Schema:** Queries match actual Honcho PostgreSQL schema (`documents.session_name`, `messages.public_id`, `message_embeddings.peer_name`, etc.)

## Data Flow

```
React Component (dist/index.js)
     ↓ fetch() /api/plugins/honcha-memory/*
FastAPI Router (api.py)
     ↓ docker exec → psql          or     curl → localhost:8002
PostgreSQL (honcho-database-1)           Honcho API (honcho-api-1)
```

## Backlog

Prioritized feature backlog in the project kanban board:

### HIGH Priority (~8.5h)
- **HON-15** — Search result match highlighting (3h)
- **HON-31** — Load more pagination + content expand (1.5h)
- **HON-32** — Clickable search results → full document expand (2h)
- **HON-33** — Deriver health widget (2h)

### MEDIUM Priority (~10h)
- **HON-16** — Per-agent detail drill-down (6h)
- **HON-34** — Memory similarity search (4h)

### LOW Priority (~33.5h)
- **HON-35** — Export filtered data as CSV (30m)
- **HON-36** — Quick stats bar (1h)
- **HON-14** — Dark terminal/cyberpunk theme (2h)
- **HON-20** — Memory heatmap calendar (4h)
- **HON-17** — Memory network graph (12h)
- **HON-18** — Embedding 2D projection (16h)
- **HON-19** — Real-time WebSocket stream (10h)

Full kanban: `/mnt/nas/Obsidian Vault/Kanban/Honcha-Memory-Plugin.md`

## Troubleshooting

**Plugin not appearing?**
```bash
# Check manifest
cat ~/.hermes/profiles/frodo/plugins/honcha-memory/dashboard/manifest.json
# Restart dashboard
systemctl --user restart hermes-dashboard
# Wait 15s, then check logs
journalctl --user -u hermes-dashboard.service -f | grep honch
```

**DB connection errors?**
```bash
# Verify container
docker ps | grep honcho
# Test connection
docker exec honcho-database-1 psql -U honcho -d honcho -c "SELECT 1"
```

**Stuck on "Loading..."?**
Hard-reload the dashboard (Ctrl+Shift+R). Check browser console for fetch errors. If API returns 500, run `journalctl --user -u hermes-dashboard.service -n 50` to see the Python traceback.

**API changes not reflected?**
`api.py` changes require a full dashboard restart. Frontend JS changes only need a browser hard-reload.

## Changelog

### v0.2.0 (2026-04-28)
- **Drill-down detail views** — Clickable Documents/Messages/Embeddings cards with paginated list views
- **8 API endpoints** — Added `/documents`, `/messages`, `/embeddings` (paginated)
- **Bug fixes** — Deadlock guard removed (loading stuck), NameError on form-encoded search fixed, dashboard crash loop resolved
- **CSS scoping** — All selectors under `.honcho-memory-plugin` to prevent cross-plugin collisions
- **TypeScript source** — `index.tsx` synced to v0.2.0 feature set
- **Tests** — 20 tests (config, search validation, stats, detail endpoints, frontend syntax, manifest)

### v0.1.0 (2026-04-27)
- Initial release: stats grid, per-agent table, semantic search, health/config/queue endpoints
- Sparklines, queue gauge, CSV export, memory freshness indicators
- Typo fix: Honcha → Honcho in UI labels

## License

MIT — part of Hermes plugin ecosystem.
