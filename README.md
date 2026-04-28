# Hermes Dashboard Plugins

Custom dashboard plugins for [Hermes Agent](https://github.com/NousResearch/hermes-agent) — the autonomous AI agent framework.

---

## 🕷️ Honcho Memory Plugin

**Monitor, explore, and manage your agents' long-term memory.**

The Honcho Memory Plugin connects the Hermes Dashboard directly to a self-hosted [Honcho](https://honcho.dev) memory instance, giving you real-time visibility into what your AI agents remember.

### Why It Matters

Hermes agents use Honcho to build persistent memory across sessions — storing facts, observations, and conversation context as vector embeddings. Without this plugin, that memory is invisible. With it, you get:

- **Live monitoring** — Documents created, messages processed, embeddings generated, queue health
- **Deep exploration** — Drill into documents, messages, and embeddings with paginated detail views
- **Semantic search** — Query agent memories by meaning, not keywords
- **System health** — Deriver status, processing rates, configuration snapshot

### What You See

```
┌──────────────────────────────────────────────────────────────┐
│  🕷️  Honcho Memory                    Queue 0 ▓░░░░  📥 CSV │
│      Intelligence stream from your agents                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │DOCUMENTS │  │ MESSAGES │  │EMBEDDINGS│  │  QUEUE   │     │
│  │   22  ↗  │  │   39  ↗  │  │   11  ↗  │  │    0     │     │
│  │ +2 in 24h│  │   ╱╲    │  │   ╱╲    │  │ pending   │     │
│  │   ╱╲    │  │  ╱  ╲   │  │ ╱    ╲  │  │   ╱╲    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                              │
│  Agent Memory Usage                                          │
│  ┌──────────────┬──────┬─────────────┐                       │
│  │ Agent        │ Docs │ Last Active │                       │
│  ├──────────────┼──────┼─────────────┤                       │
│  │ boromir      │   12 │ 20m ago     │                       │
│  │ frodo        │    8 │ 1h ago      │                       │
│  │ aragorn      │    2 │ 3d ago      │                       │
│  └──────────────┴──────┴─────────────┘                       │
│                                                              │
│  Semantic Search                         [Search memories…]  │
│  ┌──────────────────────────────────────┐                    │
│  │ "How does the Zeeva biofeedback..."  │  94.2%             │
│  │ frodo · Session zeeva-admin          │                    │
│  ├──────────────────────────────────────┤                    │
│  │ "The SchreckNet terminal should..."  │  87.1%             │
│  │ boromir · Session schrecknet-ui      │                    │
│  └──────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

### Architecture

```
Hermes Dashboard (React SPA)
        │
        ├── plugin API ──→ FastAPI Router (api.py)
        │                       │
        │              ┌────────┴────────┐
        │              │                 │
        │         docker exec       HTTP proxy
        │         psql queries      to Honcho API
        │              │                 │
        │     ┌────────┴────────┐  ┌────┴────────┐
        │     │   PostgreSQL    │  │  Honcho API  │
        │     │  (pgvector)     │  │  (port 8002) │
        │     └─────────────────┘  └──────────────┘
        │
        └── static assets ──→ dist/index.js (React IIFE)
                              plugin.css (scoped dark theme)
```

### Quick Start

```bash
# 1. Symlink into Hermes profile plugins
mkdir -p ~/.hermes/profiles/frodo/plugins/
ln -s /path/to/hermes-plugins/honcha-memory \
      ~/.hermes/profiles/frodo/plugins/honcha-memory

# 2. Restart dashboard
systemctl --user restart hermes-dashboard

# 3. Hard-reload browser → "Honcho Memory" tab appears
```

**Prerequisites:** Self-hosted Honcho instance running (Docker Compose). PostgreSQL container must be reachable via `docker exec`.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Aggregate memory statistics (30s cache) |
| GET | `/documents?limit=50` | Paginated document list |
| GET | `/messages?limit=50` | Paginated message log |
| GET | `/embeddings?limit=50` | Paginated embedding metadata |
| GET | `/queue` | Task queue status |
| POST | `/search` | Semantic search proxy |
| GET | `/config` | Configuration snapshot (secrets redacted) |
| GET | `/health` | Database connectivity check |

### Tech Stack

- **Backend:** Python FastAPI, `docker exec` PostgreSQL queries, Honcho API proxy
- **Frontend:** React IIFE via Hermes Plugin SDK, SVG sparklines, scoped CSS
- **Data:** Honcho PostgreSQL (pgvector), Honcho REST API
- **Testing:** 20 pytest tests (config, search validation, detail endpoints, Docker-dependent integration)

### Roadmap

| Priority | Features | Estimate |
|----------|----------|----------|
| 🔴 HIGH | Search highlighting, load-more pagination, deriver health widget | 6.5h |
| 🟡 MEDIUM | Per-agent drill-down, memory similarity search | 10h |
| 🟢 LOW | Dark cyberpunk theme, heatmap calendar, network graph, embedding projection, WebSocket stream | 33.5h |

Full kanban board tracks 14 backlog items with owner assignments and status.

---

## Contributing

Plugins in this repo follow the [Hermes Dashboard Plugin specification](https://github.com/NousResearch/hermes-agent/tree/main/plugins):

- `dashboard/manifest.json` — registration (tab, icon, slots)
- `dashboard/api.py` — FastAPI router (auto-mounted at `/api/plugins/<name>/`)
- `dashboard/dist/index.js` — React IIFE frontend via `window.__HERMES_PLUGIN_SDK__`
- `dashboard/plugin.css` — Scoped styles under plugin namespace

See the [plugin development skill](https://github.com/NousResearch/hermes-agent/blob/main/skills/hermes-dashboard-plugin-development/SKILL.md) for full authoring guidance.

## License

MIT — part of the Hermes plugin ecosystem.
