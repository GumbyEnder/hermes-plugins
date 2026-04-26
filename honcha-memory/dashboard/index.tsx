/**
 * Honcha Memory Dashboard Plugin for Herrhes
 * Displays local memory statistics, queue status, and semantic search
 * Backend: /api/plugins/honcha-memory/*
 */

import { useState, useEffect, useCallback } from 'react';
import styles from './plugin.css';

interface Stats {
  documents: number;
  messages: number;
  embeddings: number;
  documents_24h: number;
  queue_pending: number;
  peers: Record<string, number>;
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

export default function HonchaMemory() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins/honcha-memory/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      const data: Stats = await res.json();
      setStats(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      const res = await fetch('/api/plugins/honcha-memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
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

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="honcha-memory-plugin">
      <header className="plugin-header">
        <h1>Honcha Memory</h1>
        <div className={`health-badge ${stats?.healthy ? 'healthy' : 'unhealthy'}`}>
          {stats?.healthy ? '● Healthy' : '● Offline'}
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading memory stats...</div>
      ) : error ? (
        <div className="error">Error: {error}</div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Documents</span>
              <span className="stat-value">{stats.documents.toLocaleString()}</span>
              <span className="stat-sub">+{stats.documents_24h} in 24h</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Messages</span>
              <span className="stat-value">{stats.messages.toLocaleString()}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Embeddings</span>
              <span className="stat-value">{stats.embeddings.toLocaleString()}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Queue</span>
              <span className="stat-value">{stats.queue_pending}</span>
              <span className="stat-sub">pending</span>
            </div>
          </div>

          {/* Peers Breakdown */}
          {stats.peers && Object.keys(stats.peers).length > 0 && (
            <section className="section">
              <h2>Per-Agent Documents</h2>
              <table className="peers-table">
                <thead>
                  <tr><th>Agent</th><th>Documents</th></tr>
                </thead>
                <tbody>
                  {Object.entries(stats.peers).map(([peer, count]) => (
                    <tr key={peer}>
                      <td>{peer}</td>
                      <td>{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

      {/* Search */}
      <section className="section">
        <h2>Semantic Search</h2>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="search-input"
          />
          <button type="submit" disabled={searchLoading} className="search-btn">
            {searchLoading ? '🔍' : 'Search'}
          </button>
        </form>
        {searchError && <div className="error">{searchError}</div>}
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(r => (
              <div key={r.id} className="result-card">
                <div className="result-meta">
                  <span className="result-id">{r.id}</span>
                  {r.observer && <span className="result-observer">{r.observer}</span>}
                  {r.score !== undefined && <span className="result-score">{(r.score * 100).toFixed(1)}%</span>}
                </div>
                <div className="result-content">{r.content}</div>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && !searchLoading && !searchError && searchQuery && (
          <div className="no-results">No results found.</div>
        )}
      </section>

      {/* Footer */}
      <footer className="plugin-footer">
        <small>
          Updated: {stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'unknown'}
          {stats.cached !== undefined && ` · Cached: ${stats.cached ? 'yes' : 'no'}`}
          {stats.cache_age !== undefined && ` · Age: ${stats.cache_age}s`}
        </small>
      </footer>
    </>
  ) : null}
}
