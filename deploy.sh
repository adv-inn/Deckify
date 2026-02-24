#!/usr/bin/env bash
# Deckify — lightweight dev deploy script
# Syncs plugin files to Steam Deck via scp and restarts plugin_loader.
#
# Usage:
#   ./deploy.sh                    # uses defaults from .vscode/settings.json
#   ./deploy.sh deck@192.168.1.50  # override user@host
#   ./deploy.sh --build            # build frontend before deploying
#   ./deploy.sh --dashboard-only   # only sync dashboard files (no restart)
#
# Prerequisites:
#   - SSH key auth (ed25519) configured to the Deck

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse .vscode/settings.json for defaults ──────────────────
SETTINGS_FILE="${SCRIPT_DIR}/.vscode/settings.json"
if [[ -f "$SETTINGS_FILE" ]]; then
    DECK_IP=$(grep -o '"deckip"[[:space:]]*:[[:space:]]*"[^"]*"' "$SETTINGS_FILE" | head -1 | sed 's/.*"deckip"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
    DECK_PORT=$(grep -o '"deckport"[[:space:]]*:[[:space:]]*"[^"]*"' "$SETTINGS_FILE" | head -1 | sed 's/.*"deckport"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
    DECK_USER=$(grep -o '"deckuser"[[:space:]]*:[[:space:]]*"[^"]*"' "$SETTINGS_FILE" | head -1 | sed 's/.*"deckuser"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
    DECK_DIR=$(grep -o '"deckdir"[[:space:]]*:[[:space:]]*"[^"]*"' "$SETTINGS_FILE" | head -1 | sed 's/.*"deckdir"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
    PLUGIN_NAME=$(grep -o '"pluginname"[[:space:]]*:[[:space:]]*"[^"]*"' "$SETTINGS_FILE" | head -1 | sed 's/.*"pluginname"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
fi

# Defaults
DECK_IP="${DECK_IP:-steamdeck.local}"
DECK_PORT="${DECK_PORT:-22}"
DECK_USER="${DECK_USER:-deck}"
DECK_DIR="${DECK_DIR:-/home/deck}"
PLUGIN_NAME="${PLUGIN_NAME:-Deckify}"
DO_BUILD=false
DASHBOARD_ONLY=false

# ── Parse CLI args ────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --build)
            DO_BUILD=true
            ;;
        --dashboard-only)
            DASHBOARD_ONLY=true
            ;;
        *@*)
            DECK_USER="${arg%%@*}"
            DECK_IP="${arg#*@}"
            ;;
        *)
            DECK_IP="$arg"
            ;;
    esac
done

REMOTE="${DECK_USER}@${DECK_IP}"
REMOTE_PLUGIN_DIR="${DECK_DIR}/homebrew/plugins/${PLUGIN_NAME}"
SSH_OPTS="-p ${DECK_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=5"

echo "=== Deckify Deploy ==="
echo "Target: ${REMOTE}:${REMOTE_PLUGIN_DIR}"
echo "Port:   ${DECK_PORT}"

# ── Optional: build frontend ─────────────────────────────────
if $DO_BUILD && ! $DASHBOARD_ONLY; then
    echo ""
    echo "--- Building frontend ---"
    (cd "$SCRIPT_DIR" && pnpm run build)
fi

# Verify dist exists (skip for dashboard-only deploys)
if ! $DASHBOARD_ONLY && [[ ! -f "${SCRIPT_DIR}/dist/index.js" ]]; then
    echo "ERROR: dist/index.js not found. Run 'pnpm run build' first or use --build flag."
    exit 1
fi

# ── SSH / SCP helpers ─────────────────────────────────────────
run_ssh() {
    ssh $SSH_OPTS "$REMOTE" "$@"
}

run_scp() {
    scp -P "${DECK_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$@"
}

# ── Create remote plugin dir ─────────────────────────────────
echo ""
echo "--- Creating remote directory ---"
run_ssh "sudo mkdir -p '${REMOTE_PLUGIN_DIR}/bin' '${REMOTE_PLUGIN_DIR}/dist' '${REMOTE_PLUGIN_DIR}/dashboard/dist/assets' && sudo chown -R deck:deck '${REMOTE_PLUGIN_DIR}'"

# ── Deploy plugin files via scp ──────────────────────────────
echo ""
echo "--- Syncing files ---"

if ! $DASHBOARD_ONLY; then
    # Core plugin files
    run_scp "${SCRIPT_DIR}/main.py" "${SCRIPT_DIR}/package.json" \
        "${REMOTE}:${REMOTE_PLUGIN_DIR}/"

    # plugin.json may be owned by root after plugin_loader restart; ignore errors
    run_scp "${SCRIPT_DIR}/plugin.json" "${REMOTE}:${REMOTE_PLUGIN_DIR}/" 2>/dev/null || \
        echo "  WARN: plugin.json skipped (root-owned). Run 'sudo chown deck:deck ${REMOTE_PLUGIN_DIR}/plugin.json' on Deck if it needs updating."

    # Frontend bundle
    run_scp "${SCRIPT_DIR}/dist/index.js" "${REMOTE}:${REMOTE_PLUGIN_DIR}/dist/"

    # librespot binary (if present locally, only sync when remote is missing or outdated)
    if [[ -f "${SCRIPT_DIR}/bin/librespot" ]]; then
        LOCAL_SIZE=$(stat -c%s "${SCRIPT_DIR}/bin/librespot")
        REMOTE_SIZE=$(run_ssh "stat -c%s '${REMOTE_PLUGIN_DIR}/bin/librespot' 2>/dev/null" 2>/dev/null || echo "0")
        if [[ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]]; then
            echo "  Syncing librespot binary (local=${LOCAL_SIZE} remote=${REMOTE_SIZE})..."
            run_scp "${SCRIPT_DIR}/bin/librespot" "${REMOTE}:${REMOTE_PLUGIN_DIR}/bin/" || \
                echo "  WARN: librespot binary upload failed (file may be in use). Skipping."
        else
            echo "  librespot binary unchanged, skipping."
        fi
    else
        echo "  NOTE: bin/librespot not found locally, skipping binary sync."
    fi
fi

# Dashboard
if [[ -d "${SCRIPT_DIR}/dashboard/dist" ]]; then
    echo "  Syncing dashboard..."
    run_ssh "sudo mkdir -p '${REMOTE_PLUGIN_DIR}/dashboard/dist/assets' && sudo chown -R deck:deck '${REMOTE_PLUGIN_DIR}/dashboard'"
    run_scp "${SCRIPT_DIR}/dashboard/dist/index.html" "${REMOTE}:${REMOTE_PLUGIN_DIR}/dashboard/dist/"
    # Sync all asset files (js/css with hashes)
    for f in "${SCRIPT_DIR}/dashboard/dist/assets/"*; do
        [[ -f "$f" ]] && run_scp "$f" "${REMOTE}:${REMOTE_PLUGIN_DIR}/dashboard/dist/assets/"
    done
else
    echo "  WARN: dashboard/dist not found, skipping dashboard deploy."
fi

# Ensure binaries are executable on target
run_ssh "if [ -f '${REMOTE_PLUGIN_DIR}/bin/librespot' ]; then chmod +x '${REMOTE_PLUGIN_DIR}/bin/librespot'; fi"

# ── Restart plugin_loader (only when plugin files changed) ──
if ! $DASHBOARD_ONLY; then
    echo ""
    echo "--- Restarting plugin_loader ---"
    run_ssh "sudo systemctl restart plugin_loader" && echo "  plugin_loader restarted" || {
        echo "  WARN: systemctl restart failed."
    }
fi

echo ""
echo "=== Deploy complete ==="
echo "Plugin should now appear in Decky Loader's Quick Access menu."
