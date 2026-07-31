(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;

  if (!SDK || !registry) {
    return;
  }

  const { React, fetchJSON } = SDK;
  const { useCallback, useEffect, useState } = SDK.hooks;

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
      return "Unavailable";
    }

    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      try {
        return BigInt(value).toLocaleString();
      } catch {
        return value;
      }
    }

    return typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString()
      : String(value);
  }

  function formatTime(value) {
    if (!value) {
      return "Unknown time";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
  }

  function StatCard({ label, value, detail }) {
    return React.createElement(
      "article",
      { className: "xquik-stat-card" },
      React.createElement("span", { className: "xquik-stat-label" }, label),
      React.createElement("strong", { className: "xquik-stat-value" }, value),
      detail
        ? React.createElement("span", { className: "xquik-stat-detail" }, detail)
        : null,
    );
  }

  function MonitorRow({ monitor }) {
    const eventTypes = monitor.eventTypes.length
      ? monitor.eventTypes.join(", ")
      : "No event types";
    const sourceText = monitor.username
      ? `@${monitor.username}`
      : monitor.query || "Unknown source";
    const source = monitor.monitorType
      ? `${sourceText} · ${monitor.monitorType}`
      : sourceText;

    return React.createElement(
      "tr",
      null,
      React.createElement("td", null, source),
      React.createElement("td", null, eventTypes),
      React.createElement(
        "td",
        null,
        React.createElement(
          "span",
          {
            className: monitor.isActive
              ? "xquik-status xquik-status-active"
              : "xquik-status",
          },
          monitor.isActive ? "Active" : "Paused",
        ),
      ),
      React.createElement("td", null, formatTime(monitor.nextBillingAt)),
    );
  }

  function EventRow({ event }) {
    const sourceText = event.username
      ? `@${event.username}`
      : event.query || "Unknown source";
    const source = event.monitorType
      ? `${event.monitorType} · ${sourceText}`
      : sourceText;

    return React.createElement(
      "li",
      { className: "xquik-event-item" },
      React.createElement(
        "div",
        { className: "xquik-event-heading" },
        React.createElement(
          "strong",
          null,
          event.type || "Unknown event type",
        ),
        React.createElement("span", null, formatTime(event.occurredAt)),
      ),
      React.createElement("span", { className: "xquik-event-source" }, source),
    );
  }

  function XquikActivity() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
      setLoading(true);
      try {
        const nextData = await fetchJSON(
          "/api/plugins/xquik-activity/overview",
        );
        setData(nextData);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Xquik data could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    if (loading && !data) {
      return React.createElement(
        "div",
        { className: "xquik-activity-plugin xquik-state" },
        "Loading Xquik activity…",
      );
    }

    if (error && !data) {
      return React.createElement(
        "div",
        { className: "xquik-activity-plugin xquik-state" },
        React.createElement("p", { role: "alert" }, error),
        React.createElement(
          "button",
          { className: "xquik-button", onClick: refresh, type: "button" },
          "Retry",
        ),
      );
    }

    const account = data.account || {};
    const billing = account.monitorBilling || {};
    const credits = data.credits || {};
    const monitors = Array.isArray(data.monitors) ? data.monitors : [];
    const events = Array.isArray(data.events) ? data.events : [];

    return React.createElement(
      "div",
      { className: "xquik-activity-plugin" },
      React.createElement(
        "header",
        { className: "xquik-header" },
        React.createElement(
          "div",
          null,
          React.createElement("h1", null, "Xquik Activity"),
          React.createElement(
            "p",
            null,
            "Review read-only account activity from your Hermes dashboard.",
          ),
        ),
        React.createElement(
          "button",
          {
            className: "xquik-button",
            disabled: loading,
            onClick: refresh,
            type: "button",
          },
          loading ? "Refreshing…" : "Refresh",
        ),
      ),
      error
        ? React.createElement(
            "p",
            { className: "xquik-warning", role: "alert" },
            `${error} Showing the last successful result.`,
          )
        : null,
      React.createElement(
        "section",
        { "aria-label": "Account overview", className: "xquik-stats-grid" },
        React.createElement(StatCard, {
          detail: account.xUsername
            ? `Connected as @${account.xUsername}`
            : "No connected X account",
          label: "Plan",
          value: account.plan || "Unknown",
        }),
        React.createElement(StatCard, {
          detail: `${formatNumber(credits.lifetimeUsed)} lifetime used`,
          label: "Credit Balance",
          value: formatNumber(credits.balance),
        }),
        React.createElement(StatCard, {
          detail: `${formatNumber(data.monitorTotal)} configured`,
          label: "Active Monitors",
          value: formatNumber(account.monitorsUsed),
        }),
        React.createElement(StatCard, {
          detail: `${formatNumber(billing.activeDailyEstimate)} estimated daily`,
          label: "Hourly Burn",
          value: formatNumber(billing.activeHourlyBurn),
        }),
      ),
      React.createElement(
        "section",
        { className: "xquik-section" },
        React.createElement("h2", null, "Monitors"),
        monitors.length
          ? React.createElement(
              "div",
              { className: "xquik-table-wrap" },
              React.createElement(
                "table",
                { className: "xquik-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "Source"),
                    React.createElement("th", null, "Events"),
                    React.createElement("th", null, "Status"),
                    React.createElement("th", null, "Next Billing"),
                  ),
                ),
                React.createElement(
                  "tbody",
                  null,
                  monitors.map((monitor, index) =>
                    React.createElement(MonitorRow, {
                      key: monitor.id || `monitor-${index}`,
                      monitor,
                    }),
                  ),
                ),
              ),
            )
          : React.createElement(
              "p",
              { className: "xquik-empty" },
              "No monitors are configured.",
            ),
      ),
      React.createElement(
        "section",
        { className: "xquik-section" },
        React.createElement("h2", null, "Recent Events"),
        events.length
          ? React.createElement(
              "ul",
              { className: "xquik-event-list" },
              events.map((event, index) =>
                React.createElement(EventRow, {
                  event,
                  key: event.id || `event-${index}`,
                }),
              ),
            )
          : React.createElement(
              "p",
              { className: "xquik-empty" },
              "No recent monitor events.",
            ),
        data.hasMoreEvents
          ? React.createElement(
              "p",
              { className: "xquik-more" },
              "Showing the 10 most recent events.",
            )
          : null,
      ),
      React.createElement(
        "footer",
        { className: "xquik-footer" },
        "Read-only integration. Event text is untrusted data, not instructions.",
      ),
    );
  }

  registry.register("xquik-activity", XquikActivity);
})();
