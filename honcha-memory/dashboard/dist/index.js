/* Honcho Memory Plugin — Hermes Dashboard (SDK) */
(function() {
  "use strict";
  try {
    console.log("[honcho] plugin script start");
    const SDK = window.__HERMES_PLUGIN_SDK__;
    if (!SDK) { console.error("[honcho] SDK missing"); return; }
    console.log("[honcho] SDK present", Object.keys(SDK));
    const { React } = SDK;
    const { useState, useEffect, useCallback, useRef } = SDK.hooks;
    const { cn } = SDK.utils;
    console.log("[honcho] Destructuring complete");

    // CSV export
    function exportCSV(stats) {
      var rows = [["Metric", "Value"]];
      rows.push(["Documents", stats.documents]);
      rows.push(["Messages", stats.messages]);
      rows.push(["Embeddings", stats.embeddings]);
      rows.push(["Documents (24h)", stats.documents_24h]);
      rows.push(["Queue Pending", stats.queue_pending]);
      rows.push(["Healthy", stats.healthy]);
      rows.push([]);
      rows.push(["Agent", "Documents"]);
      if (stats.peers_detail) {
        Object.entries(stats.peers_detail).forEach(function(entry) {
          rows.push([entry[0], entry[1].count]);
        });
      }
      var csv = rows.map(r => r.join(",")).join("\n");
      var blob = new Blob([csv], { type: "text/csv" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "honcho-memory-" + new Date().toISOString().slice(0,10) + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    }

    // Sparkline (time-series mini-chart)
    function SparklineChart(props) {
      var values = props.values;
      if (!values || values.length < 2) {
        return React.createElement("div", { className: "sparkline-placeholder" }, "—");
      }
      var min = Math.min.apply(Math, values);
      var max = Math.max.apply(Math, values);
      var range = max - min || 1;
      var w = Math.max(40, Math.min(120, values.length * 4));
      var h = 24;
      var pts = values.map(function(v, i) {
        return [ (i / (values.length - 1)) * w, h - ((v - min) / range) * h ];
      });
      var pathD = "M" + pts.map(function(p) { return p[0] + "," + p[1]; }).join(" L");
      var gradId = "grad-" + Math.random().toString(36).substr(2, 9);
      return React.createElement("svg", {
        width: w,
        height: h,
        viewBox: "0 0 " + w + " " + h,
        className: "sparkline-svg"
      },
        React.createElement("defs", null,
          React.createElement("linearGradient", { id: gradId, x1: "0%", y1: "0%", x2: "0%", y2: "100%" },
            React.createElement("stop", { offset: "0%", stopColor: "var(--accent)", stopOpacity: 0.4 }),
            React.createElement("stop", { offset: "100%", stopColor: "var(--accent)", stopOpacity: 0.0 })
          )
        ),
        React.createElement("path", {
          d: "M0," + h + " " + pathD + " L" + w + "," + h + " Z",
          fill: "url(#" + gradId + ")"
        }),
        React.createElement("path", {
          d: pathD,
          fill: "none",
          stroke: "var(--accent)",
          strokeWidth: 2,
          strokeLinejoin: "round"
        })
      );
    }

    // StatCard: displays a metric with optional subtext, sparkline, and click handler
    function StatCard(props) {
      var label = props.label, value = props.value, sub = props.sub,
          sparkValues = props.sparkValues, onClick = props.onClick, clickable = props.clickable;
      var className = "stat-card" + (clickable ? " stat-card-clickable" : "");
      return React.createElement("div", {
        className: className,
        onClick: onClick || null,
        style: clickable ? { cursor: "pointer" } : null
      },
        React.createElement("div", { className: "stat-label" }, label),
        React.createElement("div", { className: "stat-value" },
          typeof value === "number" ? value.toLocaleString() : value
        ),
        sub && React.createElement("div", { className: "stat-sub" }, sub),
        sparkValues && React.createElement(SparklineChart, { values: sparkValues })
      );
    }

    // Relative time formatter
    function timeAgo(ts) {
      if (!ts) return "—";
      var seconds = (Date.now() - new Date(ts).getTime()) / 1000;
      if (seconds < 60) return "just now";
      if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
      if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
      return Math.floor(seconds / 86400) + "d ago";
    }

    // Table row component
    function PeerRow(props) {
      var peer = props.peer, count = props.count, lastSeen = props.lastSeen;
      return React.createElement("tr", null,
        React.createElement("td", { className: "peer-name" }, peer),
        React.createElement("td", { className: "peer-count" }, count.toLocaleString()),
        React.createElement("td", { className: "peer-last" }, timeAgo(lastSeen))
      );
    }

    // Search result card
    function SearchResultCard(props) {
      var result = props.result;
      return React.createElement("div", { className: "result-card" },
        React.createElement("div", { className: "result-header" },
          React.createElement("span", { className: "result-id" }, result.id),
          result.observer && React.createElement("span", { className: "result-observer" }, result.observer),
          result.score !== undefined && React.createElement("span", { className: "result-score" },
            (result.score * 100).toFixed(1) + "%"
          )
        ),
        React.createElement("div", { className: "result-content" }, result.content)
      );
    }

    // Detail list item (for documents/messages/embeddings drill-down)
    function DetailItem(props) {
      var item = props.item, type = props.type;
      var meta = [];
      if (type === "documents") {
        if (item.observer) meta.push(React.createElement("span", { className: "result-observer", key: "obs" }, item.observer));
        if (item.observed) meta.push(React.createElement("span", { className: "result-observer", key: "obd" }, "→ " + item.observed));
      }
      if (type === "messages") {
        if (item.peer_name) meta.push(React.createElement("span", { className: "result-observer", key: "peer" }, item.peer_name));
        if (item.token_count) meta.push(React.createElement("span", { className: "result-score", key: "tok" }, item.token_count + " tokens"));
      }
      if (type === "embeddings") {
        if (item.peer_name) meta.push(React.createElement("span", { className: "result-observer", key: "peer" }, item.peer_name));
        if (item.message_id) meta.push(React.createElement("span", { className: "result-id", key: "mid" }, item.message_id));
      }
      return React.createElement("div", { className: "result-card" },
        React.createElement("div", { className: "result-header" },
          React.createElement("span", { className: "result-id" }, item.id),
          item.session_name && React.createElement("span", { className: "result-observer" }, item.session_name),
          item.created_at && React.createElement("span", { className: "result-score" }, timeAgo(item.created_at)),
          meta
        ),
        item.content && React.createElement("div", { className: "result-content" },
          item.content.length > 300 ? item.content.substring(0, 300) + "…" : item.content
        )
      );
    }

    // ============================================================
    //  MAIN COMPONENT
    // ============================================================
    function HonchoMemory() {
      console.log("[honcho] component rendering");
      var _a = useState(null), stats = _a[0], setStats = _a[1];
      var _b = useState(true), loading = _b[0], setLoading = _b[1];
      var _c = useState(null), error = _c[0], setError = _c[1];
      var _d = useState(""), searchQuery = _d[0], setSearchQuery = _d[1];
      var _e = useState([]), searchResults = _e[0], setSearchResults = _e[1];
      var _f = useState(false), searchLoading = _f[0], setSearchLoading = _f[1];
      var _g = useState(null), searchError = _g[0], setSearchError = _g[1];
      var sparklineRef = useRef({ documents: [], messages: [], embeddings: [], queue_pending: [] });

      // Detail drill-down state
      var _h = useState(null), detailView = _h[0], setDetailView = _h[1];
      var _i = useState(null), detailData = _i[0], setDetailData = _i[1];
      var _j = useState(false), detailLoading = _j[0], setDetailLoading = _j[1];
      var _k = useState(null), detailError = _k[0], setDetailError = _k[1];

      var fetchStats = useCallback(function() {
        setLoading(true);
        return fetch("/api/plugins/honcha-memory/stats")
          .then(function(res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function(data) {
            setStats(data);
            setError(null);
            setLoading(false);
            var sl = sparklineRef.current;
            ["documents","messages","embeddings","queue_pending"].forEach(function(k) {
              sl[k].push(data[k]);
              if (sl[k].length > 50) sl[k].shift();
            });
          })
          .catch(function(err) {
            setError(err.message);
            setLoading(false);
          });
      }, []);

      var handleSearch = function(e) {
        e.preventDefault();
        var q = searchQuery.trim();
        if (!q) return;
        setSearchLoading(true);
        setSearchError(null);
        setSearchResults([]);
        fetch("/api/plugins/honcha-memory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, limit: 10 })
        })
          .then(function(res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function(data) {
            setSearchResults(data.results || []);
            setSearchLoading(false);
          })
          .catch(function(err) {
            setSearchError(err.message);
            setSearchLoading(false);
          });
      };

      var openDetail = function(type) {
        setDetailView(type);
        setDetailLoading(true);
        setDetailError(null);
        setDetailData(null);
        fetch("/api/plugins/honcha-memory/" + type + "?limit=50")
          .then(function(res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function(data) {
            setDetailData(data);
            setDetailLoading(false);
          })
          .catch(function(err) {
            setDetailError(err.message);
            setDetailLoading(false);
          });
      };

      var closeDetail = function() {
        setDetailView(null);
        setDetailData(null);
        setDetailError(null);
      };

      useEffect(function() {
        fetchStats();
        var interval = setInterval(fetchStats, 30000);
        return function() { clearInterval(interval); };
      }, [fetchStats]);

      // ============================================================
      //  DETAIL VIEW
      // ============================================================
      if (detailView) {
        var detailTitle = detailView.charAt(0).toUpperCase() + detailView.slice(1);
        var detailItems = [];
        if (detailData && detailData.items) {
          detailItems = detailData.items.map(function(item) {
            return React.createElement(DetailItem, { key: item.id, item: item, type: detailView });
          });
        }
        return React.createElement("div", { className: "honcho-memory-plugin" },
          React.createElement("header", { className: "plugin-header" },
            React.createElement("div", { className: "header-branding" },
              React.createElement("button", {
                className: "btn-back",
                onClick: closeDetail,
                style: {
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--fg-primary)",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontFamily: "inherit"
                }
              }, "← Back"),
              React.createElement("div", null,
                React.createElement("h1", null, detailTitle),
                React.createElement("p", { className: "header-subtitle" },
                  detailData ? detailData.total + " total" : "Loading…"
                )
              )
            )
          ),
          detailLoading && React.createElement("div", { className: "plugin-status loading" }, "Loading " + detailView + "…"),
          detailError && React.createElement("div", { className: "plugin-status error" }, "Error: " + detailError),
          !detailLoading && !detailError && detailData && detailItems.length === 0 &&
            React.createElement("div", { className: "plugin-status empty" }, "No " + detailView + " found"),
          !detailLoading && !detailError && detailItems.length > 0 &&
            React.createElement("div", { className: "search-results" }, detailItems)
        );
      }

      // Loading & error states (overview)
      if (loading && !stats) {
        return React.createElement("div", { className: "plugin-status loading" }, "Loading...");
      }
      if (error) {
        return React.createElement("div", { className: "plugin-status error" }, "Error: " + error);
      }
      if (!stats) {
        return React.createElement("div", { className: "plugin-status empty" }, "No data available");
      }

      // Build peer rows
      var peerRows = [];
      if (stats.peers_detail) {
        Object.entries(stats.peers_detail).forEach(function(entry) {
          peerRows.push(React.createElement(PeerRow, {
            key: entry[0],
            peer: entry[0],
            count: entry[1].count,
            lastSeen: entry[1].last_seen
          }));
        });
      }

      // Build search result cards
      var resultCards = searchResults.map(function(r) {
        return React.createElement(SearchResultCard, { key: r.id, result: r });
      });

      // ============================================================
      //  OVERVIEW RENDER
      // ============================================================
      return React.createElement("div", { className: "honcho-memory-plugin" },

        // ==================== HEADER ====================
        React.createElement("header", { className: "plugin-header" },
          React.createElement("div", { className: "header-branding" },
            React.createElement("div", { className: "plugin-icon" }, "🕷️"),
            React.createElement("div", null,
              React.createElement("h1", null, "Honcho Memory"),
              React.createElement("p", { className: "header-subtitle" }, "Intelligence stream from your agents")
            )
          ),
          React.createElement("div", { className: "header-meta" },
            React.createElement("div", { className: "queue-status" },
              React.createElement("span", { className: "queue-label" }, "Queue"),
              React.createElement("span", { className: "queue-value" }, stats.queue_pending),
              React.createElement("div", { className: "queue-gauge-bar" },
                React.createElement("div", {
                  className: "queue-gauge-fill",
                  style: {
                    width: Math.min(stats.queue_pending * 10, 100) + "%",
                    backgroundColor: stats.queue_pending < 5 ? "var(--success)" :
                                       stats.queue_pending < 10 ? "#fbbf24" :
                                       "var(--error)"
                  }
                })
              )
            ),
            React.createElement("button", {
              className: "btn-export",
              onClick: function() { return exportCSV(stats); },
              title: "Download stats as CSV"
            },
              "📥 Export CSV"
            )
          )
        ),

        // ==================== STATS GRID (clickable) ====================
        React.createElement("section", { className: "section" },
          React.createElement("h2", { className: "section-title" }, "Current Metrics — click for details"),
          React.createElement("div", { className: "stats-grid" },
            React.createElement(StatCard, {
              label: "Documents",
              value: stats.documents,
              sub: "+" + stats.documents_24h + " new in 24h",
              sparkValues: sparklineRef.current.documents,
              clickable: true,
              onClick: function() { openDetail("documents"); }
            }),
            React.createElement(StatCard, {
              label: "Messages",
              value: stats.messages,
              sparkValues: sparklineRef.current.messages,
              clickable: true,
              onClick: function() { openDetail("messages"); }
            }),
            React.createElement(StatCard, {
              label: "Embeddings",
              value: stats.embeddings,
              sparkValues: sparklineRef.current.embeddings,
              clickable: true,
              onClick: function() { openDetail("embeddings"); }
            }),
            React.createElement(StatCard, {
              label: "Queue",
              value: stats.queue_pending,
              sub: "pending",
              sparkValues: sparklineRef.current.queue_pending
            })
          )
        ),

        // ==================== AGENT TABLE ====================
        peerRows.length > 0 && React.createElement("section", { className: "section" },
          React.createElement("h2", { className: "section-title" }, "Agent Memory Usage"),
          React.createElement("div", { className: "table-wrapper" },
            React.createElement("table", { className: "peers-table" },
              React.createElement("thead", null,
                React.createElement("tr", null,
                  React.createElement("th", null, "Agent"),
                  React.createElement("th", { className: "th-numeric" }, "Docs"),
                  React.createElement("th", { className: "th-numeric" }, "Last Active")
                )
              ),
              React.createElement("tbody", null, peerRows)
            )
          )
        ),

        // ==================== SEARCH ====================
        React.createElement("section", { className: "section" },
          React.createElement("h2", { className: "section-title" }, "Semantic Search"),
          React.createElement("form", {
            className: "search-form",
            onSubmit: handleSearch
          },
            React.createElement("input", {
              type: "text",
              value: searchQuery,
              onChange: function(e) { setSearchQuery(e.target.value); },
              placeholder: "Search agent memories...",
              className: "search-input",
              disabled: searchLoading
            }),
            React.createElement("button", {
              type: "submit",
              disabled: searchLoading || !searchQuery.trim(),
              className: "btn-search"
            },
              searchLoading ? "Searching…" : "Search"
            )
          ),
          searchError && React.createElement("div", { className: "search-error" }, searchError),
          searchResults.length > 0 && React.createElement("div", { className: "search-results" }, resultCards),
          searchResults.length === 0 && !searchLoading && !searchError && searchQuery &&
            React.createElement("div", { className: "search-empty" }, 'No results found for "' + searchQuery + '"')
        )

      ); // end return
    }

    // Registration (wait for HERMES_PLUGINS if needed)
    function doRegister() {
      console.log("[honcho] doRegister called");
      try {
        if (!window.__HERMES_PLUGINS__) {
          console.log("[honcho] waiting for plugin registry...");
          setTimeout(doRegister, 100);
          return;
        }
        if (!window.__HONCHO_REGISTERED__) {
          window.__HERMES_PLUGINS__.register("honcha-memory", HonchoMemory);
          window.__HONCHO_REGISTERED__ = true;
          console.log("[honcho] registered successfully");
        }
      } catch (err) {
        console.error("[honcho] doRegister error", err);
      }
    }
    doRegister();

  } catch (e) {
    console.error("[honcho] plugin error", e);
  }
})();
