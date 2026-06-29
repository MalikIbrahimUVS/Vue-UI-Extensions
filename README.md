# Vue UI Extensions

Portable Frappe app for **build-time `.vue` overrides** of official Vue SPAs (HRMS, Helpdesk, and more) without modifying upstream apps.

## Requirements

- Frappe v16+ (tested on v16.24)
- Python 3.14+
- Node 18+ and Yarn
- Target Vue apps installed on the same bench (e.g. `hrms`, `helpdesk`)

## Install

```bash
cd ~/frappe-bench-experiments   # or your bench
bench get-app <path-or-repo> vue_ui_extensions
bench --site <site> install-app vue_ui_extensions
```

Install `vue_ui_extensions` **after** the target apps so `website_route_rules` take effect.

## Override convention

Mirror the upstream `src/` path under:

```
vue_ui_extensions/extensions/<target_app>/overrides/
```

Examples:

| Target | Override file | Replaces |
|--------|---------------|----------|
| helpdesk | `extensions/helpdesk/overrides/components/layouts/Sidebar.vue` | `helpdesk/desk/src/components/layouts/Sidebar.vue` |
| hrms | `extensions/hrms/overrides/components/CheckInPanel.vue` | `hrms/frontend/src/components/CheckInPanel.vue` |

## Build

After adding or changing override files:

```bash
bench build --app vue_ui_extensions
```

You will be prompted to build **helpdesk**, **hrms**, or **all** (default). Non-interactive builds (CI) build all targets with overrides unless you set:

```bash
# Single target
VUE_EXT_TARGET=helpdesk bench build --app vue_ui_extensions

# Multiple targets
VUE_EXT_TARGETS=helpdesk,hrms bench build --app vue_ui_extensions

# Skip prompt and build all
VUE_EXT_BUILD_ALL=1 bench build --app vue_ui_extensions
```

Then clear website cache so routing picks up changes:

```bash
bench --site <site> clear-cache
```

If changes still do not appear, hard-reload the browser (Ctrl+Shift+R) and confirm the page loads assets from `/assets/vue_ui_extensions/built/...` (not `/assets/helpdesk/desk/...`).

This runs the `after_build` hook, which:

1. Discovers installed targets with override files
2. Copies upstream frontend into `.tmp/` (upstream never modified)
3. Merges your `overrides/` on top of `src/`
4. Runs `vite build` using the target app's `node_modules`
5. Writes assets to `vue_ui_extensions/public/built/<target>/`
6. Generates Jinja www entry pages with boot data

Build a single target:

```bash
bench execute vue_ui_extensions.build.build_target --args '["hrms"]'
```

## Serving

`website_route_rules` in `hooks.py` route `/hrms` and `/helpdesk` to:

- `www/hrms_extended.html` + `hrms_extended.py`
- `www/helpdesk_extended/index.html` + `index.py`

Boot context is delegated to the upstream app handlers.

## Registry

Target apps are defined in `vue_ui_extensions/registry/*.json`. Add a new JSON file to support another Vue app (CRM, etc.).

## Upgrade workflow

1. `bench update --pull` on target apps
2. Update `VERSIONS.txt` / registry `tested_version`
3. Diff your override files against upstream `src/` changes
4. `bench build --app vue_ui_extensions`
5. Smoke-test `/hrms` and `/helpdesk`

## Uninstall

Uninstalling `vue_ui_extensions` removes route hijacking; upstream SPAs serve from their original `www/` entries.

## Experiments bench

This app was developed on `~/frappe-bench-experiments` (port **8001**, isolated from production `~/frappe-bench`).

```bash
# Start Redis for experiments bench (if not running)
redis-server ~/frappe-bench-experiments/config/redis_cache.conf --daemonize yes
redis-server ~/frappe-bench-experiments/config/redis_queue.conf --daemonize yes

bench start
# http://experiments.localhost:8001/hrms
# http://experiments.localhost:8001/helpdesk
```

## MVP proofs (this repo)

- **Helpdesk:** sidebar Search label → `Search (Vue Ext)`
- **HRMS:** check-in panel greeting → `Hey, {name} 👋 [Vue Ext]`
