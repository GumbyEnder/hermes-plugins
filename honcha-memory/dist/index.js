import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
export default function HonchaMemory() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/plugins/honcha-memory/stats');
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setStats(data);
            setError(null);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim())
            return;
        setSearchLoading(true);
        setSearchError(null);
        setSearchResults([]);
        try {
            const res = await fetch('/api/plugins/honcha-memory/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, limit: 10 }),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setSearchResults(data.results || []);
        }
        catch (e) {
            setSearchError(e.message);
        }
        finally {
            setSearchLoading(false);
        }
    };
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [fetchStats]);
    return (_jsxs("div", { className: "honcha-memory-plugin", children: [_jsxs("header", { className: "plugin-header", children: [_jsx("h1", { children: "Honcha Memory" }), _jsx("div", { className: `health-badge ${stats?.healthy ? 'healthy' : 'unhealthy'}`, children: stats?.healthy ? 'Healthy' : 'Offline' })] }), loading ? (_jsx("div", { className: "loading", children: "Loading memory stats..." })) : error ? (_jsxs("div", { className: "error", children: ["Error: ", error] })) : stats ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Documents" }), _jsx("span", { className: "stat-value", children: stats.documents.toLocaleString() }), _jsxs("span", { className: "stat-sub", children: ["+", stats.documents_24h, " in 24h"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Messages" }), _jsx("span", { className: "stat-value", children: stats.messages.toLocaleString() })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Embeddings" }), _jsx("span", { className: "stat-value", children: stats.embeddings.toLocaleString() })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Queue" }), _jsx("span", { className: "stat-value", children: stats.queue_pending }), _jsx("span", { className: "stat-sub", children: "pending" })] })] }), stats.peers && Object.keys(stats.peers).length > 0 && (_jsxs("section", { className: "section", children: [_jsx("h2", { children: "Per-Agent Documents" }), _jsxs("table", { className: "peers-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Agent" }), _jsx("th", { children: "Documents" })] }) }), _jsx("tbody", { children: Object.entries(stats.peers).map(([peer, count]) => (_jsxs("tr", { children: [_jsx("td", { children: peer }), _jsx("td", { children: count.toLocaleString() })] }, peer))) })] })] })), _jsxs("section", { className: "section", children: [_jsx("h2", { children: "Semantic Search" }), _jsxs("form", { className: "search-form", onSubmit: handleSearch, children: [_jsx("input", { type: "text", value: searchQuery, onChange: e => setSearchQuery(e.target.value), placeholder: "Search memories...", className: "search-input" }), _jsx("button", { type: "submit", disabled: searchLoading, className: "search-btn", children: searchLoading ? 'Searching' : 'Search' })] }), searchError && _jsx("div", { className: "error", children: searchError }), searchResults.length > 0 && (_jsx("div", { className: "search-results", children: searchResults.map(r => (_jsxs("div", { className: "result-card", children: [_jsxs("div", { className: "result-meta", children: [_jsx("span", { className: "result-id", children: r.id }), r.observer && _jsx("span", { className: "result-observer", children: r.observer }), r.score !== undefined && _jsxs("span", { className: "result-score", children: [(r.score * 100).toFixed(1), "%"] })] }), _jsx("div", { className: "result-content", children: r.content })] }, r.id))) })), searchResults.length === 0 && !searchLoading && !searchError && searchQuery && (_jsx("div", { className: "no-results", children: "No results found." }))] }), _jsx("footer", { className: "plugin-footer", children: _jsxs("small", { children: ["Updated: ", stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'unknown', stats.cached !== undefined && ` · Cached: ${stats.cached ? 'yes' : 'no'}`, stats.cache_age !== undefined && ` · Age: ${stats.cache_age}s`] }) })] })) : null] }));
}
