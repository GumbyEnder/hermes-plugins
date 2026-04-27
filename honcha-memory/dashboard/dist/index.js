/* Honcha Memory Plugin — Hermes Dashboard (SDK) */
(function() {
  "use strict";
  try {
    console.log("[honcha] plugin script start");
    const SDK = window.__HERMES_PLUGIN_SDK__;
    if (!SDK) {
      console.error("[honcha] SDK missing");
      return;
    }
    console.log("[honcha] SDK present", Object.keys(SDK));
    const { React } = SDK;
    const { useState, useEffect, useCallback } = SDK.hooks;
    const { cn } = SDK.utils;
    console.log("[honcha] Destructuring complete");

    function StatCard(_a) {
      var label = _a.label, value = _a.value, sub = _a.sub;
      return React.createElement("div", { className: "stat-card" },
        React.createElement("div", { className: "stat-label" }, label),
        React.createElement("div", { className: "stat-value" }, typeof value === "number" ? value.toLocaleString() : value),
        sub ? React.createElement("div", { className: "stat-sub" }, sub) : null
      );
    }

    function PeerRow(_a) {
      var peer = _a.peer, count = _a.count;
      return React.createElement("tr", null,
        React.createElement("td", { className: "peer-name" }, peer),
        React.createElement("td", { className: "peer-count" }, count.toLocaleString())
      );
    }

    function SearchResultCard(_a) {
      var result = _a.result;
      return React.createElement("div", { className: "result-card" },
        React.createElement("div", { className: "result-meta" },
          React.createElement("span", { className: "result-id" }, result.id),
          result.observer && React.createElement("span", { className: "result-observer" }, result.observer),
          result.score !== undefined && React.createElement("span", { className: "result-score" }, (result.score * 100).toFixed(1) + "%")
        ),
        React.createElement("div", { className: "result-content" }, result.content)
      );
    }

    function HonchaMemory() {
      console.log("[honcha] component rendering");
      var _a = useState(null), stats = _a[0], setStats = _a[1];
      var _b = useState(true), loading = _b[0], setLoading = _b[1];
      var _c = useState(null), error = _c[0], setError = _c[1];
      var _d = useState(""), searchQuery = _d[0], setSearchQuery = _d[1];
      var _e = useState([]), searchResults = _e[0], setSearchResults = _e[1];
      var _f = useState(false), searchLoading = _f[0], setSearchLoading = _f[1];
      var _g = useState(null), searchError = _g[0], setSearchError = _g[1];

      var fetchStats = useCallback(function () {
        var _a;
        return (_a = function () {
          try {
            return fetch("/api/plugins/honcha-memory/stats").then(function (res) {
              if (!res.ok) throw new Error("HTTP " + res.status);
              return res.json().then(function (data) {
                setStats(data);
                setError(null);
                setLoading(false);
              });
            });
          } catch (e) {
            setError(e.message);
            setLoading(false);
            return Promise.resolve();
          }
        })(), _a;
      }, []);

      var handleSearch = function (e) {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        setSearchError(null);
        setSearchResults([]);
        fetch("/api/plugins/honcha-memory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, limit: 10 })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (data) {
            setSearchResults(data.results || []);
            setSearchLoading(false);
          })
          .catch(function (e) {
            setSearchError(e.message);
            setSearchLoading(false);
          });
      };

      useEffect(function () {
        fetchStats();
        var interval = setInterval(fetchStats, 30000);
        return function () { return clearInterval(interval); };
      }, [fetchStats]);

      if (loading) return React.createElement("div", { className: "loading" }, "Loading...");
      if (error) return React.createElement("div", { className: "error" }, "Error: " + error);
      if (!stats) return React.createElement("div", null, "No data");

      var peerRows = stats.peers
        ? Object.entries(stats.peers).map(function (_a) {
            var peer = _a[0], count = _a[1];
            return React.createElement(PeerRow, { key: peer, peer: peer, count: count });
          })
        : null;

      var resultCards = searchResults.map(function (r) {
        return React.createElement(SearchResultCard, { key: r.id, result: r });
      });

      return React.createElement("div", { className: "honcha-memory-plugin" },
        React.createElement("header", { className: "plugin-header" },
          React.createElement("h1", null, "Honcha Memory"),
          React.createElement("div", {
            className: cn("health-badge", stats.healthy ? "healthy" : "unhealthy")
          }, stats.healthy ? "Healthy" : "Offline")
        ),
        React.createElement("div", { className: "stats-grid" },
          React.createElement(StatCard, { label: "Documents", value: stats.documents, sub: "+" + stats.documents_24h + " in 24h" }),
          React.createElement(StatCard, { label: "Messages", value: stats.messages }),
          React.createElement(StatCard, { label: "Embeddings", value: stats.embeddings }),
          React.createElement(StatCard, { label: "Queue", value: stats.queue_pending, sub: "pending" })
        ),
        peerRows && React.createElement("section", { className: "section" },
          React.createElement("h2", null, "Per-Agent Documents"),
          React.createElement("table", { className: "peers-table" },
            React.createElement("thead", null,
              React.createElement("tr", null,
                React.createElement("th", null, "Agent"),
                React.createElement("th", { style: { textAlign: "right" } }, "Count")
              )
            ),
            React.createElement("tbody", null, peerRows)
          )
        ),
        React.createElement("section", { className: "section" },
          React.createElement("h2", null, "Semantic Search"),
          React.createElement("form", { className: "search-form", onSubmit: handleSearch },
            React.createElement("input", {
              type: "text",
              value: searchQuery,
              onChange: function (e) { return setSearchQuery(e.target.value); },
              placeholder: "Search memories...",
              className: "search-input"
            }),
            React.createElement("button", {
              type: "submit",
              disabled: searchLoading,
              className: "search-btn"
            }, searchLoading ? "Searching" : "Search")
          ),
          searchError && React.createElement("div", { className: "error" }, searchError),
          searchResults.length > 0 && React.createElement("div", { className: "search-results" }, resultCards),
          searchResults.length === 0 && !searchLoading && !searchError && searchQuery && React.createElement("div", { className: "no-results" }, "No results found.")
        ),
        React.createElement("footer", { className: "plugin-footer" },
          React.createElement("small", null,
            "Updated: " + (stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : "unknown"),
            stats.cached !== undefined ? " · Cached: " + (stats.cached ? "yes" : "no") : null,
            stats.cache_age !== undefined ? " · Age: " + stats.cache_age + "s" : null
          )
        )
      );
    }

    window.__HERMES_PLUGINS__.register("honcha-memory", HonchaMemory);
    console.log("[honcha] registered");
  } catch (e) {
    console.error("[honcha] plugin error", e);
  }
})();
