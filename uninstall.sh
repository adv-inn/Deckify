#!/bin/sh
set -e

PURGE=false
case "$#:$1" in
  0:) ;;
  1:--purge) PURGE=true ;;
  1:--help|1:-h)
    echo "Usage: sh uninstall.sh [--purge]"
    echo "By default, settings and data are kept for reinstallation."
    echo "--purge also deletes saved login credentials, settings, cache, certificates, and logs."
    exit 0
    ;;
  *) echo "Usage: sh uninstall.sh [--purge]" >&2; exit 1 ;;
esac

case "$HOME" in
  /*) [ "$HOME" != / ] || exit 1 ;;
  *) echo "Error: HOME must be an absolute user home directory." >&2; exit 1 ;;
esac

DECKY_DIR="$HOME/homebrew"
INSTALL_DIR="$DECKY_DIR/plugins/Deckify"

if [ ! -d "$INSTALL_DIR" ] && [ "$PURGE" = false ]; then
  echo "Deckify is not installed."
  echo "Use --purge to remove any remaining settings and data."
  exit 0
fi

echo "Stopping Decky plugin loader..."
sudo systemctl stop plugin_loader
trap 'sudo systemctl start plugin_loader' 0
trap 'exit 1' HUP INT TERM

sudo rm -rf -- "$INSTALL_DIR"

if [ "$PURGE" = true ]; then
  sudo rm -rf -- \
    "$DECKY_DIR/settings/Deckify" \
    "$DECKY_DIR/data/Deckify" \
    "$DECKY_DIR/logs/Deckify" \
    "$DECKY_DIR/settings/deckify.json" \
    "$DECKY_DIR/deckify" \
    "$HOME/.config/deckify" \
    "$HOME/.local/share/deckify"
  echo "Deckify settings, login credentials, cache, certificates, and logs removed."
else
  echo "Settings and data kept. Use --purge to remove them as well."
fi

echo "Starting Decky plugin loader..."
sudo systemctl start plugin_loader
trap - 0 HUP INT TERM

echo "Deckify uninstalled successfully."
