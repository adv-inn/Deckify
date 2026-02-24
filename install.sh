#!/bin/sh
set -e

REPO="adv-inn/Deckify"
PLUGIN_DIR="$HOME/homebrew/plugins"
INSTALL_DIR="$PLUGIN_DIR/Deckify"

# Check Decky Loader
if [ ! -d "$PLUGIN_DIR" ]; then
  echo "Error: Decky Loader not found ($PLUGIN_DIR does not exist)"
  echo "Install Decky Loader first: https://decky.xyz"
  exit 1
fi

# Get latest release download URL
echo "Fetching latest release..."
DOWNLOAD_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o '"browser_download_url":\s*"[^"]*Deckify\.tar\.gz"' \
  | head -1 \
  | sed 's/"browser_download_url":\s*"//;s/"$//')

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: could not find Deckify.tar.gz in latest release"
  exit 1
fi

# Download to temp dir
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
echo "Downloading $DOWNLOAD_URL ..."
curl -fSL -o "$TMPDIR/Deckify.tar.gz" "$DOWNLOAD_URL"

# Install
rm -rf "$INSTALL_DIR"
tar -xzf "$TMPDIR/Deckify.tar.gz" -C "$PLUGIN_DIR"
chmod +x "$INSTALL_DIR/bin/librespot"

# Restart plugin loader
echo "Restarting Decky plugin loader..."
sudo systemctl restart plugin_loader

echo "Deckify installed successfully!"
