#!/bin/sh
set -e

INSTALL_DIR="$HOME/homebrew/plugins/Deckify"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "Deckify is not installed."
  exit 0
fi

sudo rm -rf "$INSTALL_DIR"

echo "Restarting Decky plugin loader..."
sudo systemctl restart plugin_loader

echo "Deckify uninstalled successfully."
