<p align="center">
  <img src="assets/logo.png" width="128" alt="Deckify Logo">
</p>

<h1 align="center">Deckify</h1>

<p align="center">A Spotify music manager for Steam Deck, built as a <a href="https://github.com/SteamDeckHomebrew/decky-loader">Decky Loader</a> plugin.</p>

<p align="center">English | <a href="README_ZH.md">中文</a> | <a href="README_JP.md">日本語</a></p>

## Features

- **Spotify Connect** — Steam Deck appears as a Spotify Connect device via [librespot](https://github.com/librespot-org/librespot)
- **Playback Controls** — Play/pause, skip, previous, volume from the Quick Access panel
- **Device Management** — View and transfer playback between Spotify Connect devices
- **Custom Device Name** — Set the Spotify Connect display name or use the system hostname
- **Web Dashboard** — Full Now Playing UI with library browsing in the Steam browser
- **OAuth (PKCE)** — Secure Spotify login via QR code, no server required

## Screenshots

| Quick Access Panel | Playback Controls |
|:--:|:--:|
| ![Plugin Panel](assets/deckyInit.jpg) | ![Now Playing](assets/deckypanel.jpg) |

| QR Code Login | Dashboard Library |
|:--:|:--:|
| ![QR Login](assets/deckyQRcode.jpg) | ![Library](assets/dashboard-library.jpg) |

| Web Dashboard |
|:--:|
| ![Dashboard](assets/dashboard.jpg) |

## Install / Update

Requires [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) installed on your Steam Deck.

```bash
curl -fsSL https://deckify.advinn.co/install.sh | sh
```

The same command updates an existing installation to the [latest published release](https://github.com/adv-inn/Deckify/releases/latest), preserving settings and saved login data.

## Uninstall

Remove the plugin while keeping its settings and data for reinstallation:

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh
```

To also delete saved login credentials, settings, cache, certificates, and logs (including legacy locations), explicitly opt into data removal:

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh -s -- --purge
```

`--purge` can also clean up local Deckify data after the plugin has been removed. Both uninstall modes briefly stop and restart Decky Loader.

## Device Name

In Deckify's **Settings → Device name**, enter a custom Spotify Connect name and select **Save**. If the Spotify Connect service is running, select **Restart Now** to apply it. Leave the field empty and save to use the system hostname.

## Spotify Account Setup

Each user must register a Spotify App at [developer.spotify.com](https://developer.spotify.com):

1. Create a new app with the following settings:
   - **App name:** `Deckify`
   - **App description:** `Deckify`
   - **Redirect URI:** Copy the exact URI shown on Deckify's Spotify Login page (for a lowercase `steamdeck` hostname: `https://steamdeck.local:39281/callback`)
   - Check **Web API**

   ![Create App](assets/createApp.png)

2. Copy the **Client ID** and enter it in the plugin's Spotify Login flow
3. When scanning the QR code, your browser may show a certificate security warning — this is expected (self-signed cert for local HTTPS). Proceed to continue.
4. The redirect URI must match exactly, including hostname capitalization. Use the URI shown on the login page even if you did not change your hostname.

## Development

### Prerequisites

- Node.js 20.19+ on the 20.x line (matching CI), 22.13+ on the 22.x line, or 24+
- pnpm v9
- Python 3.11+ to run the backend tests

### Build

```bash
pnpm i
pnpm run build    # builds plugin frontend + dashboard
```

### Checks

```bash
python -m unittest discover -s tests -v
pnpm run typecheck
pnpm run lint
```

The uninstall tests mock privileged commands; they do not remove the installed plugin or its data.

### Deploy to Steam Deck

```bash
./deploy.sh               # uses .vscode/settings.json defaults
./deploy.sh --build        # build before deploying
./deploy.sh deck@10.0.0.5  # override target
```

## Acknowledgments

- [librespot](https://github.com/librespot-org/librespot) (MIT) — Open source Spotify client library
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) — Plugin framework for Steam Deck
- [@decky/ui](https://github.com/SteamDeckHomebrew/decky-frontend-lib) — Steam-native React components

## License

GPL-3.0
