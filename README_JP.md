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
- **デバイス名のカスタマイズ** — Spotify Connect の表示名を設定、またはシステムのホスト名を使用
- **Web ダッシュボード** — Steam ブラウザ上でフル機能の再生 UI とライブラリ閲覧
- **OAuth (PKCE)** — QR コードによる安全な Spotify ログイン、サーバー不要

## スクリーンショット

| クイックアクセスパネル | 再生コントロール |
|:--:|:--:|
| ![Plugin Panel](assets/deckyInit.jpg) | ![Now Playing](assets/deckypanel.jpg) |

| QR コードログイン | ダッシュボードライブラリ |
|:--:|:--:|
| ![QR Login](assets/deckyQRcode.jpg) | ![Library](assets/dashboard-library.jpg) |

| Web ダッシュボード |
|:--:|
| ![Dashboard](assets/dashboard.jpg) |

## インストール / 更新

Steam Deck に [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) がインストールされている必要があります。

```bash
curl -fsSL https://deckify.advinn.co/install.sh | sh
```

同じコマンドで既存のインストールを[最新リリース](https://github.com/adv-inn/Deckify/releases/latest)に更新できます。設定とログイン情報は保持されます。

## アンインストール

再インストール用に設定とデータを保持してプラグインを削除します：

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh
```

ログイン情報、設定、キャッシュ、証明書、ログ（旧バージョンの保存先を含む）も削除する場合は、`--purge` を追加してください：

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh -s -- --purge
```

プラグインを削除済みの場合も、`--purge` でローカルの Deckify データを削除できます。どちらのモードも、アンインストール時に Decky Loader を一時停止して再起動します。

## デバイス名

Deckify の **Settings → Device name** に Spotify Connect の表示名を入力し、**Save** を選択してください。Spotify Connect サービスが実行中の場合は、**Restart Now** で変更を適用します。空欄で保存すると、システムのホスト名を使用します。

## Spotify アカウント設定

各ユーザーは [developer.spotify.com](https://developer.spotify.com) で Spotify App を登録する必要があります：

1. 以下の設定で新しいアプリを作成：
   - **App name:** `Deckify`
   - **App description:** `Deckify`
   - **Redirect URI:** Deckify の Spotify ログイン画面に表示される URI をそのまま登録してください（ホスト名が小文字の `steamdeck` なら `https://steamdeck.local:39281/callback`）
   - **Web API** にチェック

   ![Create App](assets/createApp.png)

2. **Client ID** をコピーし、プラグインの Spotify ログインフローで入力
3. QR コードをスキャンする際、ブラウザが証明書のセキュリティ警告を表示する場合があります。これは正常です（ローカル HTTPS の自己署名証明書）。そのまま続行してください。
4. Redirect URI はホスト名の大文字・小文字も含めて完全に一致する必要があります。ホスト名を変更していない場合も、ログイン画面に表示される URI を使用してください。

## 開発

### 前提条件

- Node.js 20.19+（20.x、CI と同じ）、22.13+（22.x）、または 24+
- pnpm v9
- Python 3.11+（バックエンドテスト用）

### ビルド

```bash
pnpm i
pnpm run build    # プラグインフロントエンド + ダッシュボードをビルド
```

### チェック

```bash
python -m unittest discover -s tests -v
pnpm run typecheck
pnpm run lint
```

アンインストールのテストでは特権コマンドをモック化しているため、インストール済みのプラグインやデータは削除されません。

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
