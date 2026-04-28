"""
Honcha Memory Dashboard Plugin — Backend API.

Mounted at /api/plugins/honcha-memory/ by Hermes web server.
Queries Honcha local memory (PostgreSQL) and proxies Honcha API endpoints.
"""

from fastapi import APIRouter, HTTPException, Request
from pathlib import Path
import subprocess
import json
import os
from datetime import datetime, timedelta

router = APIRouter()

# Configuration
HERMES_HOME = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
HONCHA_ROOT = Path("/home/gumbyender/honcha")
HONCHA_DB_CONTAINER = "honcho-database-1"
HONCHA_DB_NAME = "honcho"
HONCHA_DB_USER = "honcho"
HONCHA_API_URL = "http://localhost:8002"

# Cache for 30 seconds to avoid hammering DB
from functools import lru_cache
import time

_stats_cache = {"data": None, "ts": 0}
CACHE_TTL = 30  # seconds


def _docker_exec_psql(query: str, container: str = HONCHA_DB_CONTAINER):
    """Execute a SQL query via docker exec; returns (rows, error)."""
    cmd = [
        "docker", "exec", container,
        "psql", "-U", HONCHA_DB_USER, "-d", HONCHA_DB_NAME,
        "-t", "-A", "-c", query
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None, result.stderr.strip()
        return result.stdout.strip(), None
    except subprocess.TimeoutExpired:
        return None, "Query timeout after 10s"


@router.get("/stats")
async def get_stats():
    """
    Aggregate memory statistics.
    Cached for 30 seconds.
    
    Returns:
        {
          "documents": int,          # total memories
          "messages": int,           # total raw messages
          "embeddings": int,         # total vector embeddings
          "documents_24h": int,      # new memories last 24h
          "queue_pending": int,      # tasks awaiting processing
          "peers": {agent: count},   # per-agent memory breakdown
          "healthy": bool,           # queue depth healthy (<10 pending)
          "cache_age": int           # seconds since last DB hit
        }
    """
    global _stats_cache
    now = time.time()
    
    # Return cached if fresh
    if _stats_cache["data"] and (now - _stats_cache["ts"]) < CACHE_TTL:
        return {**_stats_cache["data"], "cached": True, "cache_age": int(now - _stats_cache["ts"])}
    
    # Composite query: one round-trip for main counts
    query = """
    SELECT 
        (SELECT COUNT(*) FROM documents) as docs,
        (SELECT COUNT(*) FROM messages) as msgs,
        (SELECT COUNT(*) FROM message_embeddings) as vecs,
        (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '24 hours') as docs_24h,
        (SELECT COUNT(*) FROM queue WHERE NOT processed) as queue_pending
    """
    rows, err = _docker_exec_psql(query)
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")
    
    vals = rows.split('|')
    if len(vals) != 5:
        raise HTTPException(status_code=500, detail=f"Unexpected query result: {rows}")
    
    docs, msgs, vecs, docs_24h, queue_pending = map(str.strip, vals)
    
    # Per-peer breakdown
    peer_query = """SELECT observer, COUNT(*) as doc_count, MAX(created_at) as last_seen
FROM documents GROUP BY observer ORDER BY doc_count DESC"""
    peer_rows, err = _docker_exec_psql(peer_query)
    peers = {}
    peers_detail = {}
    if not err and peer_rows:
        for line in peer_rows.split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 3:
                    obs, cnt, last = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    peers[obs] = int(cnt)
                    peers_detail[obs] = {"count": int(cnt), "last_seen": last if last and last != "None" else None}
                elif len(parts) >= 2:
                    obs, cnt = parts[0].strip(), parts[1].strip()
                    peers[obs] = int(cnt)
    
    payload = {
        "documents": int(docs),
        "messages": int(msgs),
        "embeddings": int(vecs),
        "documents_24h": int(docs_24h),
        "queue_pending": int(queue_pending),
        "peers": peers,
        "peers_detail": peers_detail,
        "healthy": int(queue_pending) < 10,
        "cached": False,
        "cache_age": 0,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    _stats_cache = {"data": payload, "ts": now}
    return payload


@router.get("/queue")
async def get_queue():
    """
    Detailed queue status.
    Tries Honcha API first (http://localhost:8002), falls back to direct DB.
    """
    # Try Honcha API
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{HONCHA_API_URL}/v3/workspaces/hermes/queue/status",
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            return {"source": "api", "data": data}
    except Exception as api_err:
        # Fallback to DB
        query = """
        SELECT task_type, COUNT(*) as total,
               SUM(CASE WHEN NOT processed THEN 1 ELSE 0 END) as pending,
               MAX(created_at) as last_task
        FROM queue GROUP BY task_type ORDER BY task_type
        """
        rows, err = _docker_exec_psql(query)
        if err:
            raise HTTPException(status_code=500, detail=f"Queue DB error: {err}")
        
        items = []
        if rows:
            for line in rows.split('\n'):
                parts = line.split('|')
                if len(parts) >= 3:
                    ttype, total, pending = parts[:3]
                    last = parts[3] if len(parts) > 3 else None
                    items.append({
                        "task_type": ttype,
                        "total": int(total),
                        "pending": int(pending),
                        "last_task": last
                    })
        return {"source": "database", "data": {"tasks": items}}


@router.post("/search")
async def search_memories(request: Request):
    """
    Proxy semantic search to Honcha.
    Accepts either JSON body { "query": "text", "limit": 10 }
    or form-encoded body query=text&limit=10.
    """
    try:
        # Try JSON first
        try:
            body = await request.json()
            query_text = body.get("query", "").strip()
            limit = int(body.get("limit", 10))
        except Exception:
            # Fallback to form-encoded
            form = await request.form()
            query_text = form.get("query", "").strip()
            limit = int(form.get("limit", 10))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    if not query_text:
        raise HTTPException(status_code=400, detail="Query string required")
    limit = min(limit, 50)  # cap at 50
    
    try:
        import urllib.request
        payload = json.dumps({"query": query_text, "limit": limit}).encode()
        req = urllib.request.Request(
            f"{HONCHA_API_URL}/v3/workspaces/hermes/search",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return {"source": "honcha", "results": json.loads(resp.read())}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise HTTPException(status_code=e.code, detail=body[:500])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_config():
    """
    Return sanitised Honcha configuration (secrets redacted).
    Checks ~/honcha/.env and docker-compose env vars.
    """
    conf = {}
    looked_at = None
    
    for env_path in [
        HONCHA_ROOT / ".env",
        HERMES_HOME.parent / "honcha" / ".env",
        Path("/home/gumbyender/.hermes/honcha/.env"),
    ]:
        if env_path.exists():
            looked_at = str(env_path)
            for line in env_path.read_text().split('\n'):
                if '=' in line and not line.strip().startswith('#'):
                    k, _, v = line.partition('=')
                    k = k.strip()
                    v = v.strip()
                    # Redact anything that looks like a secret
                    if any(secret in k.upper() for secret in ['API_KEY', 'KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'AUTH', 'CREDENTIAL']):
                        v = '***REDACTED***'
                    conf[k] = v
            break
    
    return {
        "config": conf,
        "source": looked_at,
        "honcha_root": str(HONCHA_ROOT) if HONCHA_ROOT.exists() else None
    }


@router.get("/health")
async def health():
    """Quick health check — can Honcha be reached?"""
    try:
        # Try simple DB connection
        rows, err = _docker_exec_psql("SELECT 1")
        if err:
            return {"status": "degraded", "db": "unreachable", "error": err}
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---------------------------------------------------------------------------
# Detail drill-down endpoints — paginated lists for Documents, Messages, Embeddings
# ---------------------------------------------------------------------------

@router.get("/documents")
async def get_documents(limit: int = 50, offset: int = 0):
    """Paginated document list (memories)."""
    query = f"""
    SELECT id, content, observer, created_at, session_name, observed
    FROM documents
    ORDER BY created_at DESC
    LIMIT {limit} OFFSET {offset}
    """
    rows, err = _docker_exec_psql(query)
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")

    count_q = "SELECT COUNT(*) FROM documents"
    total_raw, _ = _docker_exec_psql(count_q)
    total = int(total_raw.strip()) if total_raw else 0

    items = []
    if rows:
        for line in rows.split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 6:
                    items.append({
                        "id": parts[0].strip(),
                        "content": parts[1].strip()[:500],
                        "observer": parts[2].strip(),
                        "created_at": parts[3].strip(),
                        "session_name": parts[4].strip() if parts[4].strip() != "" else None,
                        "observed": parts[5].strip() if len(parts) > 5 and parts[5].strip() != "" else None,
                    })

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/messages")
async def get_messages(limit: int = 50, offset: int = 0):
    """Paginated message log."""
    query = f"""
    SELECT public_id, content, peer_name, created_at, session_name, token_count
    FROM messages
    ORDER BY created_at DESC
    LIMIT {limit} OFFSET {offset}
    """
    rows, err = _docker_exec_psql(query)
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")

    count_q = "SELECT COUNT(*) FROM messages"
    total_raw, _ = _docker_exec_psql(count_q)
    total = int(total_raw.strip()) if total_raw else 0

    items = []
    if rows:
        for line in rows.split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 6:
                    items.append({
                        "id": parts[0].strip(),
                        "content": parts[1].strip()[:500],
                        "peer_name": parts[2].strip(),
                        "created_at": parts[3].strip(),
                        "session_name": parts[4].strip() if parts[4].strip() != "" else None,
                        "token_count": int(parts[5].strip()) if parts[5].strip().isdigit() else 0,
                    })

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/embeddings")
async def get_embeddings(limit: int = 50, offset: int = 0):
    """Paginated embedding metadata (no vector data)."""
    query = f"""
    SELECT e.id, e.message_id, e.created_at, e.peer_name, e.session_name
    FROM message_embeddings e
    ORDER BY e.created_at DESC
    LIMIT {limit} OFFSET {offset}
    """
    rows, err = _docker_exec_psql(query)
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")

    count_q = "SELECT COUNT(*) FROM message_embeddings"
    total_raw, _ = _docker_exec_psql(count_q)
    total = int(total_raw.strip()) if total_raw else 0

    items = []
    if rows:
        for line in rows.split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 5:
                    items.append({
                        "id": parts[0].strip(),
                        "message_id": parts[1].strip(),
                        "created_at": parts[2].strip(),
                        "peer_name": parts[3].strip() if parts[3].strip() != "" else None,
                        "session_name": parts[4].strip() if len(parts) > 4 and parts[4].strip() != "" else None,
                    })

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
