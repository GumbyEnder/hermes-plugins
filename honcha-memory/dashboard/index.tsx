/**
 * Honcho Memory Dashboard Plugin — React Component (TypeScript source)
 * 
 * This is the readable reference implementation. The actual deployed build is
 * the hand-crafted IIFE at dashboard/dist/index.js (loaded as plain <script>,
 * not <script type="module">). Keep this source in sync with any feature
 * changes made to the IIFE build.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './plugin.css';

interface Stats {
  documents: number;
  messages: number;
  embeddings: number;
  documents_24h: number;
  queue_pending: number;
  peers: Record<string, number>;
  peers_detail: Record<string, { count: number; last_seen: string | null }>;
  healthy: boolean;
  cached?: boolean;
  cache_age?: number;
  timestamp?: string;
}

interface SearchResult {
  id: string;
  content: string;
  observer?: string;
  score?: number;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const seconds = (Date.now() - new Date(ts).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function exportCSV(stats: Stats) {
  const rows: (string | number)[][] = [["Metric", "Value"]];
  rows.push(["Documents", stats.documents]);
  rows.push(["Messages", stats.messages]);
  rows.push(["Embeddings", stats.embeddings]);
  rows.push(["Documents (24h)", stats.documents_24h]);
  rows.push(["Queue Pending", stats.queue_pending]);
  rows.push(["Healthy", String(stats.healthy)]);
  rows.push([]);
  rows.push(["Agent", "Documents"]);
  if (stats.peers_detail) {
    Object.entries(stats.peers_detail).forEach(([agent, detail]) => {
      rows.push([agent, detail.count]);
    });
  }
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "honcho-memory-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function SparklineChart({ values }: { values: number[] }) {
  if (!values || values.length < 2) {
    return <div className="sparkline-placeholder">—</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = Math.max(40, Math.min(120, values.length * 4));
  const h = 24;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / range) * h,
  ]);
  const pathD = "M" + pts.map(p => p[0] + "," + p[1]).join(" L");
  const gradId = "grad-" + Math.random().toString(36).substr(2, 9);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline-svg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={`M0,${h} ${pathD} L${w},${h} Z`} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({
  label, value, sub, sparkValues,
}: {
  label: string;
  value: number | string;
  sub?: string;
  sparkValues?: number[];
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      {sparkValues && <SparklineChart values={sparkValues} />}
    </div>
  );
}

function PeerRow({ peer, count, lastSeen }: { peer: string; count: number; lastSeen: string | null }) {
  return (
    <tr>
      <td className="peer-name">{peer}</td>
      <td className="peer-count">{count.toLocaleString()}</td>
      <td className="peer-last">{timeAgo(lastSeen)}</td>
    </tr>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="result-card">
      <div className="result-header">
        <span className="result-id">{result.id}</span>
        {result.observer && <span className="result-observer">{result.observer}</span>}
        {result.score !== undefined && (
          <span className="result-score">{(result.score * 100).toFixed(1)}%</span>
        )}
      </div>
      <div className="result-content">{result.content}</div>
    </div>
  );
}

export default function HonchoMemory() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sparklineRef = useRef<Record<string, number[]>>({
    documents: [], messages: [], embeddings: [], queue_pending: [],
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/plugins/honcha-memory/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Stats = await res.json();
      setStats(data);
      setError(null);
      // Push to sparkline history (keep last 50)
      const sl = sparklineRef.current;
      (["documents", "messages", "embeddings", "queue_pending"] as const).forEach((k) => {
        sl[k].push(data[k]);
        if (sl[k].length > 50) sl[k].shift();
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch("/api/plugins/honcha-memory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 10 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      setSearchError(e.message);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Loading & error states
  if (loading && !stats) {
    return <div className="plugin-status loading">Loading...</div>;
  }
  if (error) {
    return <div className="plugin-status error">Error: {error}</div>;
  }
  if (!stats) {
    return <div className="plugin-status empty">No data available</div>;
  }

  return (
    <div className="honcho-memory-plugin">
      {/* ==================== HEADER ==================== */}
      <header className="plugin-header">
        <div className="header-branding">
          <div className="plugin-icon">🕷️</div>
          <div>
            <h1>Honcho Memory</h1>
            <p className="header-subtitle">Intelligence stream from your agents</p>
          </div>
        </div>
        <div className="header-meta">
          <div className="queue-status">
            <span className="queue-label">Queue</span>
            <span className="queue-value">{stats.queue_pending}</span>
            <div className="queue-gauge-bar">
              <div
                className="queue-gauge-fill"
                style={{
                  width: Math.min(stats.queue_pending * 10, 100) + "%",
                  backgroundColor:
                    stats.queue_pending < 5 ? "var(--success)" :
                    stats.queue_pending < 10 ? "#fbbf24" :
                    "var(--error)",
                }}
              />
            </div>
          </div>
          <button
            className="btn-export"
            onClick={() => exportCSV(stats)}
            title="Download stats as CSV"
          >
            📥 Export CSV
          </button>
        </div>
      </header>

      {/* ==================== STATS GRID ==================== */}
      <section className="section">
        <h2 className="section-title">Current Metrics</h2>
        <div className="stats-grid">
          <StatCard
            label="Documents"
            value={stats.documents}
            sub={`+${stats.documents_24h} new in 24h`}
            sparkValues={sparklineRef.current.documents}
          />
          <StatCard
            label="Messages"
            value={stats.messages}
            sparkValues={sparklineRef.current.messages}
          />
          <StatCard
            label="Embeddings"
            value={stats.embeddings}
            sparkValues={sparklineRef.current.embeddings}
          />
          <StatCard
            label="Queue"
            value={stats.queue_pending}
            sub="pending"
            sparkValues={sparklineRef.current.queue_pending}
          />
        </div>
      </section>

      {/* ==================== AGENT TABLE ==================== */}
      {stats.peers_detail && Object.keys(stats.peers_detail).length > 0 && (
        <section className="section">
          <h2 className="section-title">Agent Memory Usage</h2>
          <div className="table-wrapper">
            <table className="peers-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="th-numeric">Docs</th>
                  <th className="th-numeric">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.peers_detail).map(([peer, detail]) => (
                  <PeerRow
                    key={peer}
                    peer={peer}
                    count={detail.count}
                    lastSeen={detail.last_seen}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ==================== SEARCH ==================== */}
      <section className="section">
        <h2 className="section-title">Semantic Search</h2>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search agent memories..."
            className="search-input"
            disabled={searchLoading}
          />
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="btn-search"
          >
            {searchLoading ? "Searching…" : "Search"}
          </button>
        </form>
        {searchError && <div className="search-error">{searchError}</div>}
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(r => (
              <SearchResultCard key={r.id} result={r} />
            ))}
          </div>
        )}
        {searchResults.length === 0 && !searchLoading && !searchError && searchQuery && (
          <div className="search-empty">No results found for "{searchQuery}"</div>
        )}
      </section>
    </div>
  );
}
