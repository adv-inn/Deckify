<p align="center">
  <img src="assets/logo.png" width="128" alt="Deckify Logo">
</p>

<h1 align="center">Deckify</h1>

<p align="center">Steam Deck 上的 Spotify 音乐管理插件，基于 <a href="https://github.com/SteamDeckHomebrew/decky-loader">Decky Loader</a> 构建。</p>

<p align="center"><a href="README.md">English</a> | 中文 | <a href="README_JP.md">日本語</a></p>

## 功能

- **Spotify Connect** — 通过 [librespot](https://github.com/librespot-org/librespot) 使 Steam Deck 成为 Spotify Connect 设备
- **播放控制** — 在快捷访问面板中控制播放/暂停、上一首、下一首、音量
- **设备管理** — 查看并在 Spotify Connect 设备之间切换播放
- **自定义设备名称** — 设置 Spotify Connect 显示名称，或使用系统主机名
- **Web 仪表盘** — 在 Steam 浏览器中提供完整的播放界面和曲库浏览
- **OAuth (PKCE)** — 通过二维码安全登录 Spotify，无需额外服务器

## 截图

| 快捷访问面板 | 播放控制 |
|:--:|:--:|
| ![Plugin Panel](assets/deckyInit.jpg) | ![Now Playing](assets/deckypanel.jpg) |

| 二维码登录 | 仪表盘曲库 |
|:--:|:--:|
| ![QR Login](assets/deckyQRcode.jpg) | ![Library](assets/dashboard-library.jpg) |

| Web 仪表盘 |
|:--:|
| ![Dashboard](assets/dashboard.jpg) |

## 安装 / 更新

需要在 Steam Deck 上预先安装 [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)。

```bash
curl -fsSL https://deckify.advinn.co/install.sh | sh
```

同一命令也可将现有安装更新至[最新发布版本](https://github.com/adv-inn/Deckify/releases/latest)，并保留配置和登录信息。

## 卸载

移除插件并保留配置和数据，方便重新安装：

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh
```

如需同时删除登录信息、配置、缓存、证书和日志（含旧版存储位置），可选择添加 `--purge`：

```bash
curl -fsSL https://deckify.advinn.co/uninstall.sh | sh -s -- --purge
```

插件已移除后，仍可使用 `--purge` 清理本机 Deckify 数据。两种卸载模式执行时都会短暂停止并重新启动 Decky Loader。

## 设备名称

在 Deckify 的 **Settings → Device name** 中填写 Spotify Connect 显示名称，点击 **Save** 保存。如果 Spotify Connect 服务正在运行，点击 **Restart Now** 应用更改。留空并保存则使用系统主机名。

## Spotify 账户设置

每位用户需要在 [developer.spotify.com](https://developer.spotify.com) 注册一个 Spotify App：

1. 创建新应用，填写以下信息：
   - **App name:** `Deckify`
   - **App description:** `Deckify`
   - **Redirect URI：**复制 Deckify Spotify 登录页面显示的完整地址（主机名为小写 `steamdeck` 时，地址为 `https://steamdeck.local:39281/callback`）
   - 勾选 **Web API**

   ![Create App](assets/createApp.png)

2. 复制 **Client ID**，在插件的 Spotify 登录流程中输入
3. 扫描二维码时，浏览器可能会显示证书安全警告——这是正常现象（本地 HTTPS 使用自签名证书），点击继续访问即可
4. Redirect URI 必须完全一致，包括主机名大小写。即使你没有修改主机名，也请以登录页面显示的地址为准。

## 开发

### 环境要求

- Node.js 20.19+（20.x，与 CI 一致）、22.13+（22.x）或 24+
- pnpm v9
- Python 3.11+，用于运行后端测试

### 构建

```bash
pnpm i
pnpm run build    # 构建插件前端 + 仪表盘
```

### 检查

```bash
python -m unittest discover -s tests -v
pnpm run typecheck
pnpm run lint
```

卸载测试使用模拟的特权命令，不会删除已安装的插件或其数据。

### 部署到 Steam Deck

```bash
./deploy.sh               # 使用 .vscode/settings.json 默认配置
./deploy.sh --build        # 部署前先构建
./deploy.sh deck@10.0.0.5  # 指定目标地址
```

## 致谢

- [librespot](https://github.com/librespot-org/librespot) (MIT) — 开源 Spotify 客户端库
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) — Steam Deck 插件框架
- [@decky/ui](https://github.com/SteamDeckHomebrew/decky-frontend-lib) — Steam 原生 React 组件库

## 许可证

GPL-3.0
