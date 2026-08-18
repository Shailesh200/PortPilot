# PortPilot

A desktop utility for developers to monitor local ports and processes, and to work with text, clipboard history, and databases. Built with Electron, React, and TypeScript.

Distributed as a signed, notarized Mac app and a Windows installer from [GitHub Releases](https://github.com/Shailesh200/PortPilot/releases/latest) — not the Mac App Store.

## Features

- **Real-time port monitoring** — every active port, PID, CPU/memory, and the project it belongs to
- **Process management** — kill, restart, or inspect processes from the dashboard
- **Terminal integration** — jump to the tab in Terminal.app, iTerm2, Warp, Cursor, or VS Code where a process is running
- **Editor integration** — open the project in VS Code or Cursor
- **Browser preview** — open `localhost` for any port
- **Text & Data** — JSON formatter/diff, JS console, text diff, and conversion (JSON, YAML, CSV, Markdown, HTML, PDF, DOCX, XLSX)
- **Clipboard history** — searchable capture of copied text, JSON, URLs, and more
- **Database client** — Postgres, MySQL, SQLite, Turso, Redis, and MongoDB, with optional SSH tunnels
- **Saved DB passwords** — OS keychain (macOS Keychain / Windows Credential Manager) plus an in-memory cache for the current session. Uncheck **Save password for next launch** to keep the password in RAM only
- **Command palette** (`Cmd + K`) — fuzzy search across ports, processes, clipboard, and navigation
- **Global launcher** (`Cmd + Option + P` by default) — summon PortPilot from anywhere
- **Menu bar tray** — quick access to active ports on macOS
- **Batch actions** — select multiple ports and kill/restart them together
- **Tagging & grouping** — tag ports and group by project
- **Profiles** — save and switch port favorites, filters, and preferences
- **Notifications** — ports start/stop (including unexpected disappearances) and high CPU/memory
- **Launch on Ports** — cold start always opens the Ports dashboard; the last screen inside each module is restored when you go back to it
- **Keyboard-first** — shortcuts in Settings → Shortcuts (source: `src/shared/shortcuts.ts`)
- **Themes** — light and dark mode with system preference detection
- **Auto-updater** — notified when a new GitHub Release is available

## Download

Get the latest build from [GitHub Releases](https://github.com/Shailesh200/PortPilot/releases/latest). Prefer **v1.0.24+** (or the newest tag that lists a `.dmg` / `.exe`). Ignore `.blockmap` files — those are for delta updates, not installers.

| Platform | File | Description |
|----------|------|-------------|
| macOS (Apple Silicon) | `PortPilot-x.x.x-arm64.dmg` | Disk image — drag to Applications |
| macOS (zip) | `PortPilot-x.x.x-arm64-mac.zip` | Alternate Mac package |
| Windows | `PortPilot-Setup-x.x.x.exe` | One-click installer |

### macOS

1. Download the `.dmg` from [Releases](https://github.com/Shailesh200/PortPilot/releases/latest)
2. Open it and drag **PortPilot** into Applications
3. Open PortPilot from Applications (or Spotlight)

Releases from v1.0.16 onward are signed with Developer ID and notarized. Gatekeeper should allow them without extra steps. Older unsigned copies may still need:

```bash
sudo xattr -rd com.apple.quarantine /Applications/PortPilot.app
```

macOS does **not** delete app data when you drag PortPilot to Trash. To wipe connections, keychain passwords, clipboard history, and settings: **Settings → Safety → Erase all PortPilot data**, or run `resources/uninstall-macos.sh` after removing the app.

### Windows

1. Download the `.exe` from [Releases](https://github.com/Shailesh200/PortPilot/releases/latest)
2. Run the installer — it installs and launches automatically
3. If SmartScreen appears, choose **More info** → **Run anyway**

Uninstalling via Windows Settings / the installer also deletes PortPilot app data.

## Keyboard Shortcuts

Keep this table in sync with `src/shared/shortcuts.ts` (also shown under **Settings → Shortcuts**).

| Shortcut | Action |
|----------|--------|
| `Cmd + Option + P` | Launch/focus PortPilot (global; customizable in Settings) |
| `Cmd + K` | Open command palette |
| `Cmd + ,` | Open settings |
| `Cmd + 1` | Ports |
| `Cmd + 2` | Text & Data |
| `Cmd + 3` | Database |
| `/` | Focus search (Ports dashboard / heatmap) |
| `Escape` | Close Quick Peek |
| `Space` | Quick peek selected port |
| `K` | Kill selected port |
| `R` | Restart selected port |
| `O` | Open selected port in browser |
| `T` | Open terminal for selected process |
| `V` | Open project in VS Code / Cursor |
| `Arrow Up / Down` | Navigate port list |
| `Arrow Right` | Expand / collapse port row (dashboard) |

Prefer **Cmd+Option+P** as the global launcher. **Cmd+Shift+P** is VS Code’s command palette — only choose it in Settings if you want that conflict.

## Development

### Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Node.js](https://nodejs.org/) 22+ (used by Electron tooling)

### Setup

```bash
git clone git@github.com:Shailesh200/PortPilot.git
cd PortPilot
bun install
```

### Run in development

```bash
bun run dev
```

### Typecheck

```bash
bun run typecheck
```

### Package for distribution

```bash
# macOS (signed locally if you have Developer ID certs)
bun run dist:mac

# Windows
bun run dist:win
```

`bun run dist:mac` / `dist:win` run `electron-builder` through Node 22 (required for blockmaps).

## Tech Stack

- **Desktop shell** — Electron
- **UI** — React + TypeScript
- **State** — Zustand (with persistence)
- **Styling** — Tailwind CSS
- **Package manager** — Bun
- **Search** — Fuse.js
- **Auto-updates** — electron-updater (GitHub Releases)
- **Logging** — electron-log
- **CI/CD** — GitHub Actions on every push to `main`

## Release Process

Every push to `main` (except commits marked `[skip ci]`):

1. GitHub Actions bumps the patch version
2. Creates one draft GitHub Release for that tag
3. Builds macOS (DMG + ZIP) and Windows (EXE) in parallel and uploads them to that draft
4. Publishes the release when both jobs succeed
5. Installed copies are notified in-app via electron-updater

## License

MIT
