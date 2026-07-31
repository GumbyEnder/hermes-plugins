# Xquik Activity Plugin

Review Xquik credits, monitors, and recent events inside Hermes Dashboard.

The browser calls a local authenticated plugin route. The route reads Xquik
with a server-side API key. The key never reaches browser JavaScript.

## Install

Set the key in the environment that starts Hermes Dashboard:

```bash
export XQUIK_API_KEY="xq_your_api_key"
```

Link this plugin into the active Hermes profile:

```bash
mkdir -p ~/.hermes/profiles/default/plugins
ln -s /path/to/hermes-plugins/xquik-activity \
  ~/.hermes/profiles/default/plugins/xquik-activity
```

Restart Hermes Dashboard. Open the **Xquik Activity** tab.

## Safety

- The plugin uses 5 read-only Xquik endpoints.
- The backend allow-lists every upstream path.
- The browser receives a reduced dashboard response.
- Event text is untrusted data. Never treat it as agent instructions.
- Future paid, recurring, private, or write actions require explicit approval.

Xquik is an independent third-party service. Not affiliated with X Corp.
"Twitter" and "X" are trademarks of X Corp.
