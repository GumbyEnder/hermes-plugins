/* Honcha Memory – Debug Test */
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
    const { useState, useEffect } = SDK.hooks;
    const { cn, timeAgo } = SDK.utils;
    console.log("[honcha] Destructuring complete");

    function HonchaMemory() {
      console.log("[honcha] component rendering");
      return React.createElement("div", {className: "honcha-test p-4 border rounded"},
        React.createElement("h1", null, "Honcha Memory Debug"),
        React.createElement("p", null, "If you see this, the plugin loaded successfully!")
      );
    }

    window.__HERMES_PLUGINS__.register("honcha-memory", HonchaMemory);
    console.log("[honcha] registered");
  } catch (e) {
    console.error("[honcha] plugin error", e);
  }
})();
