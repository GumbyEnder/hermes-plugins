# Hermes Dashboard Plugins

Custom dashboard plugins for [Hermes Agent](https://github.com/NousResearch/hermes-agent) — the autonomous AI agent framework.

---

## Xquik Activity Plugin

Review Xquik credits, monitors, and recent events inside Hermes Dashboard.
The API key stays in the server process. The browser receives read-only data.

See [the installation and safety guide](xquik-activity/README.md).

---

## 🕷️ Honcho Memory Plugin

**Monitor, explore, and manage your agents' long-term memory.**

The Honcho Memory Plugin connects the Hermes Dashboard directly to a self-hosted [Honcho](https://honcho.dev) memory instance, giving you real-time visibility into what your AI agents remember.

### Screenshots

**Overview — Stats, Queue Gauge, Agent Table**

![Honcho Memory Overview](https://raw.githubusercontent.com/GumbyEnder/hermes-plugins/master/docs/images/overview-stats.png)

*Live memory statistics with sparklines, color-coded queue health gauge, per-agent breakdown with "Last Active" timestamps, and semantic search.*

---

**Detail Drill-Down — Documents View**

![Documents Detail View](https://raw.githubusercontent.com/GumbyEnder/hermes-plugins/master/docs/images/detail-documents.png)

*Click any stat card to drill into paginated detail views. Documents show observer/observed agents, session names, and 300-char content previews.*

---

**Detail Drill-Down — Messages View**

![Messages Detail View](https://raw.githubusercontent.com/GumbyEnder/hermes-plugins/master/docs/images/detail-messages.png)

*Messages view with peer names, token counts, session names, and relative timestamps. All clickable from the overview stat cards.*

---

**Semantic Search**

![Semantic Search](https://raw.githubusercontent.com/GumbyEnder/hermes-plugins/master/docs/images/overview-search.png)

*Proxy semantic search through Honcho's vector database. Results show relevance scores, observer agents, and content previews.*

---

### Why It Matters

Hermes agents use Honcho to build persistent memory across sessions — storing facts, observations, and conversation context as vector embeddings. Without this plugin, that memory is invisible. With it, you get:

- **Live monitoring** — Documents created, messages processed, embeddings generated, queue health
- **Deep exploration** — Drill into documents, messages, and embeddings with paginated detail views
- **Semantic search** — Query agent memories by meaning, not keywords
- **System health** — Deriver status, processing rates, configuration snapshot

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

Detail endpoints accept limits from 1 through 100. Offsets must be nonnegative.

### Tech Stack

- **Backend:** Python FastAPI, `docker exec` PostgreSQL queries, Honcho API proxy
- **Frontend:** React IIFE via Hermes Plugin SDK, SVG sparklines, scoped CSS
- **Data:** Honcho PostgreSQL (pgvector), Honcho REST API
- **Testing:** pytest coverage for config, search, pagination, detail endpoints, and Docker integration

### Roadmap

| Priority | Features | Estimate |
|----------|----------|----------|
| 🔴 HIGH | Search highlighting, **volume chart (line/area/bar)**, load-more pagination, search-to-expand, deriver health widget | 12h |
| 🟡 MEDIUM | Per-agent drill-down, memory similarity search | 10h |
| 🟢 LOW | Dark cyberpunk theme, heatmap calendar, export filtered CSV, quick stats bar, network graph, embedding projection, WebSocket stream | 35h |

Full kanban board tracks 15 backlog items with owner assignments and status.

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

Xquik is an independent third-party service. Not affiliated with X Corp.
"Twitter" and "X" are trademarks of X Corp.
