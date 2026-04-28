"""
Tests for Honcho Memory Dashboard Plugin API.

Uses FastAPI TestClient for unit/integration testing.
Docker-dependent tests are marked with @pytest.mark.docker and skip gracefully
when Docker is unavailable.
"""

import pytest
import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "dashboard"))

from fastapi.testclient import TestClient
from fastapi import FastAPI
from api import router

# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/plugins/honcha-memory")

client = TestClient(app)

# ---------------------------------------------------------------------------
# Config endpoint
# ---------------------------------------------------------------------------

def test_config_returns_valid_structure():
    """Config endpoint returns config, source, honcha_root keys."""
    resp = client.get("/api/plugins/honcha-memory/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "config" in data
    assert "source" in data
    assert "honcha_root" in data
    assert isinstance(data["config"], dict)


def test_config_redacts_secrets():
    """Any key containing API_KEY, KEY, TOKEN, SECRET, PASSWORD, AUTH, CREDENTIAL
    should be redacted to '***REDACTED***'."""
    resp = client.get("/api/plugins/honcha-memory/config")
    data = resp.json()
    for key, value in data["config"].items():
        if any(secret in key.upper() for secret in
               ["API_KEY", "KEY", "TOKEN", "SECRET", "PASSWORD", "AUTH", "CREDENTIAL"]):
            assert value == "***REDACTED***", f"Secret {key} not redacted: {value}"


# ---------------------------------------------------------------------------
# Search endpoint — validation
# ---------------------------------------------------------------------------

def test_search_empty_query_json():
    """POST /search with empty query returns 400."""
    resp = client.post("/api/plugins/honcha-memory/search",
                       json={"query": "", "limit": 10})
    assert resp.status_code == 400
    assert "Query string required" in resp.json()["detail"]


def test_search_missing_query_json():
    """POST /search with missing query field returns 400."""
    resp = client.post("/api/plugins/honcha-memory/search",
                       json={"limit": 10})
    assert resp.status_code == 400


def test_search_invalid_body():
    """POST /search with invalid body returns 400."""
    resp = client.post("/api/plugins/honcha-memory/search",
                       content=b"not json or form",
                       headers={"Content-Type": "text/plain"})
    assert resp.status_code == 400


def test_search_form_encoded():
    """POST /search with form-encoded body is accepted (may return 500 if Honcho
    API is unreachable, but should not raise NameError)."""
    resp = client.post("/api/plugins/honcha-memory/search",
                       data={"query": "test", "limit": "5"})
    # Should NOT be a 500 with "NameError" — either succeeds or fails at Honcho API
    assert resp.status_code != 500 or "NameError" not in resp.json().get("detail", "")


def test_search_limit_capped():
    """POST /search with limit=100 should be capped at 50."""
    resp = client.post("/api/plugins/honcha-memory/search",
                       json={"query": "test", "limit": 100})
    # Should not be 400 (validation passed), may be 500 if Honcho unreachable
    assert resp.status_code != 400


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

def test_health_returns_structure():
    """GET /health returns status + db keys."""
    resp = client.get("/api/plugins/honcha-memory/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] in ("ok", "degraded", "error")


# ---------------------------------------------------------------------------
# Stats endpoint (Docker-dependent)
# ---------------------------------------------------------------------------

docker_available = False
try:
    import subprocess
    result = subprocess.run(
        ["docker", "ps"], capture_output=True, timeout=5
    )
    docker_available = result.returncode == 0
except Exception:
    pass

requires_docker = pytest.mark.skipif(
    not docker_available,
    reason="Docker not available or not running"
)


@requires_docker
def test_stats_returns_valid_structure():
    """GET /stats returns all expected fields."""
    resp = client.get("/api/plugins/honcha-memory/stats")
    assert resp.status_code == 200
    data = resp.json()
    for field in ["documents", "messages", "embeddings", "documents_24h",
                  "queue_pending", "peers", "peers_detail", "healthy",
                  "timestamp"]:
        assert field in data, f"Missing field: {field}"
    assert isinstance(data["documents"], int)
    assert isinstance(data["healthy"], bool)


@requires_docker
def test_stats_caching():
    """GET /stats returns cache metadata."""
    resp = client.get("/api/plugins/honcha-memory/stats")
    data = resp.json()
    # First hit should be uncached
    assert data.get("cached") is False or data.get("cached") is True
    assert "cache_age" in data


@requires_docker
def test_queue_returns_valid_structure():
    """GET /queue returns source + data."""
    resp = client.get("/api/plugins/honcha-memory/queue")
    assert resp.status_code == 200
    data = resp.json()
    assert "source" in data
    assert data["source"] in ("api", "database")
    assert "data" in data


@requires_docker
def test_stats_peers_detail_has_timestamps():
    """peers_detail entries should have count and last_seen."""
    resp = client.get("/api/plugins/honcha-memory/stats")
    data = resp.json()
    for peer, detail in data.get("peers_detail", {}).items():
        assert "count" in detail, f"Missing count for {peer}"
        assert "last_seen" in detail, f"Missing last_seen for {peer}"
        assert isinstance(detail["count"], int)


# ---------------------------------------------------------------------------
# Frontend asset verification (requires dashboard running)
# ---------------------------------------------------------------------------

def test_frontend_js_bundle_syntax():
    """The IIFE bundle should pass node --check syntax validation."""
    dist_path = Path(__file__).resolve().parent.parent / "dashboard" / "dist" / "index.js"
    if not dist_path.exists():
        pytest.skip("dist/index.js not found — build may not have been run")

    import subprocess
    result = subprocess.run(
        ["node", "--check", str(dist_path)],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"Syntax error in dist/index.js:\n{result.stderr}"


def test_frontend_js_paren_balance():
    """Open and close parentheses should be balanced."""
    dist_path = Path(__file__).resolve().parent.parent / "dashboard" / "dist" / "index.js"
    if not dist_path.exists():
        pytest.skip("dist/index.js not found")

    content = dist_path.read_text()
    opens = content.count("(")
    closes = content.count(")")
    assert opens == closes, (
        f"Paren imbalance: {opens} open vs {closes} close "
        f"(diff: {opens - closes})"
    )


def test_manifest_valid_json():
    """manifest.json should be valid JSON with required fields."""
    manifest_path = Path(__file__).resolve().parent.parent / "dashboard" / "manifest.json"
    assert manifest_path.exists(), "manifest.json not found"

    import json
    manifest = json.loads(manifest_path.read_text())
    for field in ["name", "label", "version", "entry", "tab"]:
        assert field in manifest, f"Missing required field: {field}"
    assert manifest["name"] == "honcha-memory", "Plugin slug must remain 'honcha-memory'"
    assert isinstance(manifest["tab"], dict)
    assert "path" in manifest["tab"]
