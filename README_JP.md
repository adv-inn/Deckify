<p align="center">
  <img src="assets/logo.png" width="128" alt="Deckify Logo">
</p>

<h1 align="center">Deckify</h1>

<p align="center">Steam Deck 向けの Spotify 音楽マネージャープラグイン。<a href="https://github.com/SteamDeckHomebrew/decky-loader">Decky Loader</a> 上で動作します。</p>

<p align="center"><a href="README.md">English</a> | <a href="README_ZH.md">中文</a> | 日本語</p>

## 機能

- **Spotify Connect** — [librespot](https://github.com/librespot-org/librespot) により Steam Deck を Spotify Connect デバイスとして利用可能
- **再生コントロール** — クイックアクセスパネルから再生/一時停止、スキップ、前の曲、音量を操作
- **デバイス管理** — Spotify Connect デバイスの一覧表示と再生先の切り替え
- **Web ダッシュボード** — Steam ブラウザ上でフル機能の再生 UI とライブラリ閲覧
- **OAuth (PKCE)** — QR コードによる安全な Spotify ログイン、サーバー不要

## スクリーンショット

| クイックアクセスパネル | 再生コントロール |
|:--:|:--:|
| ![Plugin Panel](assets/deckyInit.jpg) | ![Now Playing](assets/deckypanel.jpg) |

| QR コードログイン | Web ダッシュボード |
|:--:|:--:|
| ![QR Login](assets/deckyQRcode.jpg) | ![Dashboard](assets/dashboard.jpg) |

| ダッシュボードライブラリ |
|:--:|
| ![Library](assets/dashboard-library.jpg) |

## インストール

Steam Deck に [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) がインストールされている必要があります。

```bash
curl -fsSL https://deckify.advinn.co/install.sh | sh
```

アンインストール：

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh
```

## Spotify アカウント設定

各ユーザーは [developer.spotify.com](https://developer.spotify.com) で Spotify App を登録する必要があります：

1. 以下の設定で新しいアプリを作成：
   - **App name:** `Deckify`
   - **App description:** `Deckify`
   - **Redirect URI:** `https://steamdeck.local:39281/callback`
   - **Web API** にチェック

   ![Create App](assets/createApp.png)

2. **Client ID** をコピーし、プラグインの Spotify ログインフローで入力
3. QR コードをスキャンする際、ブラウザが証明書のセキュリティ警告を表示する場合があります。これは正常です（ローカル HTTPS の自己署名証明書）。そのまま続行してください。
4. Steam Deck のホスト名を変更している場合は、Redirect URI の `steamdeck` を適宜置き換えてください
5. Spotify 開発者モードでは、各 Client ID につき 5 人の認証ユーザーに制限されています

> **注意：** OpenHarmony を搭載したデバイスは、mDNS / Zeroconf が未対応のため、現時点では本プラグインを利用できません。

## 既知の問題

- **スリープ復帰後のデバイスリスト遅延** — Steam Deck がスリープから復帰した際、librespot の再起動と Spotify への再登録に数秒かかります。この間、デバイスリストには他のデバイスのみが表示される場合があります。しばらく待ってから更新してください。
- **デバイス切り替えの即時反映なし** — ドロップダウンでデバイスを切り替えた後、選択状態が一時的に前のデバイスのまま表示される場合があります。これは Spotify API の伝播遅延によるもので、しばらくすると更新されます。

## 開発

### 前提条件

- Node.js v16.14+
- pnpm v9

### ビルド

```bash
pnpm i
pnpm run build    # プラグインフロントエンド + ダッシュボードをビルド
```

### Steam Deck へのデプロイ

```bash
./deploy.sh               # .vscode/settings.json のデフォルト設定を使用
./deploy.sh --build        # デプロイ前にビルド
./deploy.sh deck@10.0.0.5  # デプロイ先を指定
```

## 謝辞

- [librespot](https://github.com/librespot-org/librespot) (MIT) — オープンソース Spotify クライアントライブラリ
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) — Steam Deck プラグインフレームワーク
- [@decky/ui](https://github.com/SteamDeckHomebrew/decky-frontend-lib) — Steam ネイティブ React コンポーネント

## ライセンス

GPL-3.0
