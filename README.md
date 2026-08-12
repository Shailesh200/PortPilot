# PortPilot

A desktop utility for developers to monitor local ports and processes, and to work with text, clipboard history, and databases. Built with Electron, React, and TypeScript.

## Features

- **Real-time Port Monitoring** -- see every active port, its PID, CPU/memory usage, and the project it belongs to
- **Process Management** -- kill, restart, or inspect any process directly from the dashboard
- **Terminal Integration** -- jump to the exact terminal tab (Terminal.app, iTerm2, Warp, Cursor, VS Code) where a process is running
- **Editor Integration** -- open any project in VS Code or Cursor with one click
- **Browser Preview** -- open `localhost` URLs for any port instantly
- **Text & Data tools** -- JSON formatter/diff, JS console, text diff, and format conversion (JSON, YAML, CSV, Markdown, HTML, PDF, DOCX, XLSX)
- **Clipboard history** -- searchable capture of copied text, JSON, URLs, and more
- **Database client** -- Postgres, MySQL, SQLite, Turso, Redis, and MongoDB, with optional SSH tunnels
- **Command Palette** (`Cmd + K`) -- fuzzy search across ports, processes, clipboard, and navigation
- **Global Launcher** (`Cmd + Option + P` by default) -- summon PortPilot from anywhere on your system
- **Menu Bar Tray** -- quick access to active ports from the macOS menu bar
- **Batch Actions** -- select multiple ports and kill/restart them all at once
- **Tagging & Grouping** -- tag ports and group by project
- **Profiles** -- save and switch between port favorites, filters, and preferences
- **Notifications** -- alerts when ports start/stop (including unexpected disappearances) and for high CPU/memory
- **Session Restore** -- picks up where you left off across Ports, Text, Database, and Settings
- **Keyboard-first** -- shortcuts listed in Settings → Shortcuts (source: `src/shared/shortcuts.ts`)
- **Themes** -- light and dark mode with system preference detection
- **Update checks** -- in-app notice when a new release is available (macOS unsigned builds may still need a manual download)

## Download

Download the latest release from the [GitHub Releases page](https://github.com/Shailesh200/PortPilot/releases/latest).

| Platform | File | Description |
|----------|------|-------------|
| macOS (Apple Silicon) | `PortPilot-x.x.x-arm64.dmg` | Disk image installer |
| Windows | `PortPilot-Setup-x.x.x.exe` | One-click installer |

### macOS Installation

1. Download the `.dmg` file from [Releases](https://github.com/Shailesh200/PortPilot/releases/latest)
2. Open the DMG and drag **PortPilot** to your Applications folder
3. Before opening for the first time, run this in Terminal:

```bash
sudo xattr -rd com.apple.quarantine /Applications/PortPilot.app
codesign --force --deep --sign - /Applications/PortPilot.app
```

4. Open PortPilot from Applications

> **Why is this needed?** The app is not signed with an Apple Developer certificate. macOS quarantines all apps downloaded from the internet, and unsigned apps are blocked by Gatekeeper. The commands above remove the quarantine flag and re-apply a valid ad-hoc signature.

### Windows Installation

1. Download the `.exe` file from [Releases](https://github.com/Shailesh200/PortPilot/releases/latest)
2. Run the installer -- it will install and launch automatically
3. If Windows Defender SmartScreen shows a warning, click **More info** then **Run anyway**

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

> Prefer **Cmd+Option+P** as the global launcher. **Cmd+Shift+P** is VS Code’s command palette — only choose it in Settings if you intentionally want that conflict.

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

### Build for production

```bash
bun run build
```

### Package for distribution

```bash
# macOS
bun run build && bunx electron-builder --mac

# Windows
bun run build && bunx electron-builder --win
```

## Tech Stack

- **Desktop Shell** -- Electron
- **UI** -- React + TypeScript
- **State Management** -- Zustand (with persistence)
- **Styling** -- Tailwind CSS
- **Package manager** -- Bun
- **Search** -- Fuse.js (fuzzy matching)
- **Auto-updates** -- electron-updater
- **Logging** -- electron-log
- **CI/CD** -- GitHub Actions (auto-build on merge to main)

## Release Process

Releases are fully automated. Every push to `main`:

1. A GitHub Actions workflow bumps the patch version automatically
2. Builds macOS (DMG + ZIP) and Windows (EXE) artifacts in parallel
3. Creates a GitHub Release with all downloadable files
4. Existing users get an in-app update notification

## License

MIT
