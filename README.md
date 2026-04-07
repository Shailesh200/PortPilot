# PortPilot

A premium desktop utility for developers to monitor, manage, and control local ports, processes, and development workflows. Built with Electron, React, and TypeScript.

## Features

- **Real-time Port Monitoring** -- see every active port, its PID, CPU/memory usage, and the project it belongs to
- **Process Management** -- kill, restart, or inspect any process directly from the dashboard
- **Terminal Integration** -- jump to the exact terminal tab (Terminal.app, iTerm2, Warp, Cursor, VS Code) where a process is running
- **Editor Integration** -- open any project in VS Code or Cursor with one click
- **Browser Preview** -- open `localhost` URLs for any port instantly
- **Command Palette** (`Cmd + K`) -- fuzzy search across ports, processes, and actions
- **Global Launcher** (`Cmd + Shift + P`) -- summon PortPilot from anywhere on your system
- **Menu Bar Tray** -- quick access to active ports from the macOS menu bar
- **Batch Actions** -- select multiple ports and kill/restart them all at once
- **Tagging & Grouping** -- tag ports and group by project, process type, or resource usage
- **Profiles** -- save and switch between port configurations, filters, and auto-actions
- **Notifications** -- get alerted on port changes, high CPU/memory, and crashes
- **Session Restore** -- picks up where you left off with filters, selections, and panels
- **Activity Log** -- track every action (kills, restarts, opens) with timestamps
- **Process Logs** -- view real-time stdout/stderr output for any running process
- **Keyboard-first** -- extensive shortcuts for every action, fully customizable
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
| `Cmd + Shift + P` | Launch/focus PortPilot (global, works from any app) |
| `Cmd + K` | Open command palette |
| `Cmd + ,` | Open settings |
| `Cmd + 1-5` | Switch sidebar tabs |
| `Cmd + R` | Refresh ports |
| `Cmd + F` | Focus search |
| `Escape` | Close modals / clear selection |
| `Space` | Quick peek selected port |
| `Delete / Backspace` | Kill selected port |
| `Arrow Up / Down` | Navigate port list |

## Development

### Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- [Node.js](https://nodejs.org/) 22+

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
bun run build && npx electron-builder --mac

# Windows
bun run build && npx electron-builder --win
```

## Tech Stack

- **Desktop Shell** -- Electron
- **Runtime** -- Bun
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
