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
- **Tagging & Grouping** -- tag ports and group by project, process type, or resource usage
- **Profiles** -- save and switch between port configurations, filters, and auto-actions
- **Notifications** -- get alerted on port changes, high CPU/memory, and crashes
- **Session Restore** -- picks up where you left off across Ports, Text, Database, and Settings
- **Activity Log** -- track every action (kills, restarts, opens) with timestamps
- **Keyboard-first** -- extensive shortcuts for every action
- **Themes** -- light and dark mode with system preference detection
- **Auto-updater** -- get notified of new versions automatically

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

| Shortcut | Action |
|----------|--------|
| `Cmd + Option + P` | Launch/focus PortPilot (global, works from any app; customizable) |
| `Cmd + K` | Open command palette |
| `Cmd + ,` | Open settings |
| `Cmd + 1` | Ports |
| `Cmd + 2` | Text & Data |
| `Cmd + 3` | Database |
| `/` | Focus search (Ports) |
| `Escape` | Close modals / clear selection |
| `Space` | Quick peek selected port |
| `K` | Kill selected port |
| `Arrow Up / Down` | Navigate port list |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+

### Setup

```bash
git clone git@github.com:Shailesh200/PortPilot.git
cd PortPilot
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Package for distribution

```bash
# macOS
npm run build && npx electron-builder --mac

# Windows
npm run build && npx electron-builder --win
```

## Tech Stack

- **Desktop Shell** -- Electron
- **UI** -- React + TypeScript
- **State Management** -- Zustand (with persistence)
- **Styling** -- TailwindCSS
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
