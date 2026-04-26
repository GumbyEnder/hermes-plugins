# Honcha Memory Plugin for Hermes Dashboard

Plugin for monitoring Honcha local memory system — counts, rates, queue health, and search.

## Features

- Live stats: documents, messages, embeddings, 24h formation rate
- Queue status: pending vs completed tasks by type
- Per-agent memory breakdown
- Semantic search proxy (to Honcha)
- Health indicator

## Installation

The plugin is auto-discovered from `~/.hermes/plugins/honcha-memory/`.

To install manually:
```bash
# Symlink from NAS repo to Hermes plugins dir
ln -s /mnt/nas/github_repos/hermes-plugins/honcha-memory ~/.hermes/plugins/
```

Then restart Hermes dashboard:
```bash
systemctl --user restart hermes-dashboard
```

## API Endpoints

All mounted under `/api/plugins/honcha-memory/`:

| Endpoint | Purpose |
|----------|---------|
| `GET /stats` | Aggregate counts (documents, messages, embeddings, 24h rate, per-peer) |
| `GET /queue` | Task queue breakdown (source: Honcha API or DB fallback) |
| `POST /search` | Semantic search proxy (body: `{query, limit}`) |
| `GET /config` | Honcha configuration snapshot (secrets redacted) |
| `GET /health` | Database connectivity check |

## Development

Code lives in NAS GitHub repos:
```
/mnt/nas/github_repos/hermes-plugins/honcha-memory/
├── dashboard/
│   ├── api.py          # FastAPI backend
│   ├── index.tsx       # React frontend
│   ├── manifest.json   # Plugin registration
│   └── plugin.css      # Styles
└── tests/
```

Edit files in-place; dashboard reloads on service restart.

## Data Flow

```
React Component (index.tsx)
     ↓ fetch() /api/plugins/honcha-memory/
FastAPI Router (api.py)
     ↓ docker exec → psql OR curl → localhost:8002
PostgreSQL (honcha-db-1) + Honcha API (honcha-api-1)
```

## Performance

- Stats endpoint cached for 30s (in-memory)
- All DB queries single round-trip
- Search proxied directly to Honcha (no cache)

## Troubleshooting

Plugin not appearing?
- Check manifest valid: `cat ~/.hermes/plugins/honcha-memory/dashboard/manifest.json`
- Restart dashboard: `systemctl --user restart hermes-dashboard`
- Check logs: `journalctl --user -u hermes-dashboard.service -f | grep honcha`

DB connection errors?
- Verify container: `docker ps | grep honcha`
- Test manually: `docker exec honcha-database-1 psql -U honcha -d honcha -c "SELECT 1"`

## License

MIT — part of Hermes plugin ecosystem.

