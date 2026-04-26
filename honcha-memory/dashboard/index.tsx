// Honcha Memory Dashboard Plugin — Frontend
// Provides observability into Honcha local memory system

import { useState, useEffect } from 'react';
import { PluginAPI } from 'hermes-dashboard-plugin-api';

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

interface QueueItem {
  task_type: string;
  total: number;
  pending: number;
  last_task?: string;
}

export default function HonchaMemoryTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch stats every 30s
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await PluginAPI.get('/stats');
        setStats(res);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch queue on mount
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await PluginAPI.get('/queue');
        const items = res.source === 'api' ? res.data.tasks : res.data.tasks;
        setQueue(items);
      } catch (e) {
        console.error('Queue fetch failed', e);
      }
    };
    fetchQueue();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await PluginAPI.post('/search', { query: searchQuery, limit: 10 });
      setSearchResults(res.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="p-4"><p>Loading Honcha memory stats…</p></div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="honcha-memory p-4 space-y-6">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Honcha Memory</h2>
        <span className={`px-2 py-1 rounded text-sm ${stats?.healthy ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
          {stats?.healthy ? '● Healthy' : '● Degraded'}
        </span>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Memories" value={stats?.documents ?? 0} />
        <StatCard label="Messages" value={stats?.messages ?? 0} />
        <StatCard label="Embeddings" value={stats?.embeddings ?? 0} />
        <StatCard label="Last 24h" value={stats?.documents_24h ?? 0} />
        <StatCard label="Queue Pending" value={stats?.queue_pending ?? 0} highlight={stats?.queue_pending && stats.queue_pending > 5} />
      </section>

      {/* Peer Breakdown */}
      {stats?.peers && Object.keys(stats.peers).length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Memories by Agent</h3>
          <div className="bg-gray-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-2">Agent</th>
                  <th className="text-right p-2">Memories</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.peers).map(([peer, count]) => (
                  <tr key={peer} className="border-t border-gray-700">
                    <td className="p-2 font-mono text-xs">{peer}</td>
                    <td className="text-right p-2">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Queue Status */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Task Queue</h3>
        {queue.length === 0 ? (
          <p className="text-gray-500 text-sm">No queue data available</p>
        ) : (
          <div className="bg-gray-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-2">Task Type</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Pending</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.task_type} className="border-t border-gray-700">
                    <td className="p-2 font-mono text-xs">{item.task_type}</td>
                    <td className="text-right p-2">{item.total}</td>
                    <td className="text-right p-2">{item.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Search */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Search Memories</h3>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Semantic search..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded text-sm"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="bg-gray-800 p-3 rounded border-l-4 border-blue-500">
                <p className="text-sm">{r.content || r.text || JSON.stringify(r)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cache info */}
      {stats?.cached && (
        <p className="text-xs text-gray-500">Cached ({stats.cache_age}s ago) — refreshes every 30s</p>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded ${highlight ? 'bg-red-900/30 border border-red-700' : 'bg-gray-800'}`}>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// Register plugin (frontend bridge)
if (typeof window !== 'undefined') {
  (window as any).registerPlugin?.({
    name: 'honcha-memory',
    component: HonchaMemoryTab,
    slot: 'tab',
    path: '/honcha-memory'
  });
}
