# App Store Connect — copy/paste

**Product page:** https://apps.apple.com/app/portpilot-desktop/id6801225932?mt=12  
**Apple ID:** `6801225932`

Paste **English (U.S.) first**. The live listing previously had only the subtitle in the Description field — that block is 4000 characters of ranking and conversion copy. Do not skip it.

Then add storefronts **English (U.K.)** and **German**. Each locale has its own Description, Keywords, What’s New, and Promotional Text.

Character counts are noted. Do not add extra spaces in Keywords.

---

## App Information

**Name** (30)
```
PortPilot Desktop
```
17 characters. (`PortPilot` alone is taken.)

**Subtitle** (30)
```
Ports, processes, databases
```
27 characters.

**Bundle ID**
```
com.portpilot.app
```

**SKU**
```
portpilot-mac
```

**Primary category**
Developer Tools

**Secondary category**
Utilities

**Content rights**
This app does not contain, show, or access third-party content. (Unless you later add licensed icons/fonts that need a claim.)

**Age rating**
4+ — no unrestricted web, no user-generated public content, no gambling.

**Copyright**
```
2026 Shailesh Jha
```
Use the legal name on your Apple Developer account if it differs.

---

## Version / Platform (macOS)

**Promotional Text** (170) — editable anytime, no new review
```
Signed Mac app for local ports, processes, clipboard, and databases. Kill a stuck :3000, format JSON, or query Postgres — without leaving one window.
```
149 characters.

**Description** (4000)
```
PortPilot is a local developer workstation for macOS. Watch every port on your machine, control the process behind it, and keep text, clipboard, and database tools in the same app.

PORTS AND PROCESSES
• Live table of listening ports with PID, CPU, memory, and project path
• Kill or restart a process without hunting in Activity Monitor
• Open localhost in the browser, jump to the terminal tab, or open the project in VS Code or Cursor
• Heatmap to spot port collisions
• Batch select to kill or restart many ports at once
• Menu bar tray for a quick look at what is running
• Profiles for favorites, filters, and per-project setups

TEXT AND DATA
• JSON formatter and JSON diff
• Text diff
• JavaScript console
• Convert JSON, YAML, CSV, Markdown, HTML, PDF, DOCX, and XLSX
• Searchable clipboard history for copied text, JSON, and URLs

DATABASE
• Postgres, MySQL, SQLite, Turso (libSQL), Redis, and MongoDB
• Optional SSH tunnels
• SQL editor, table browser, and query history
• Passwords stay in the macOS Keychain, with an in-memory cache for the current session. Uncheck “Save password for next launch” to keep a password only until you quit.

KEYBOARD FIRST
• Global launcher (default: Option-Command-P)
• Command palette (Command-K) across ports, clipboard, and tools
• Shortcuts listed in Settings

PRIVACY
PortPilot runs on your Mac. Connections go from your machine to the databases and hosts you configure. Mac App Store builds update through Apple. Direct GitHub builds may check GitHub Releases for a new version.

Requires macOS on Apple Silicon.
```

**Keywords** (100 bytes, commas, no spaces after commas, do not repeat the app name or subtitle words)
```
monitor,kill,formatter,yaml,localhost,postgres,mysql,sqlite,redis,mongodb,clipboard,sql,ssh,json
```
95 bytes. Dropped `electron` and `vite` (nobody searches those for this app).

**Support URL** (required)
```
https://github.com/Shailesh200/PortPilot/issues
```

**Marketing URL**
```
https://apps.apple.com/app/portpilot-desktop/id6801225932?mt=12
```

**Privacy Policy URL** (required)
You must host a page. Until you have a custom site:
```
https://github.com/Shailesh200/PortPilot/blob/main/PRIVACY.md
```
Create `PRIVACY.md` in the repo before submitting (App Review checks this link).

**What's New**
```
The Dock icon now matches other Mac apps. After you kill or restart a few stuck processes, PortPilot may ask you to leave a rating — never on first launch, and you can skip it.
```

---

## Pricing and availability

**Price**
Free, or a one-time paid Mac app (no IAP required for v1). Pick the price tier in Pricing and Availability.

**Availability**
All countries, or start with the countries you can support in English.

**Pre-order**
No.

---

## App Review Information

**Contact**
Your name, phone, and the email on the Apple Developer account.

**Demo account**
Not required if the app works fully offline / on localhost. In Notes, say:

```
No login. Port monitoring uses the local machine. Database features need a local or remote DB the reviewer can skip; Ports and Text & Data work with no account.
```

**Notes**
```
This is a developer utility. It lists local TCP ports and can terminate processes the user selects. It is not sandboxed the same way as a typical Mac App Store app if you are still on the Developer ID build — only submit a MAS-sandboxed build.

Sign in is not required. Please try: Ports dashboard, Command-K palette, Text & Data → JSON Formatter, Settings → Safety.
```

**Attachment**
None required.

---

## App Privacy (nutrition labels)

Declare only what the app actually does:

| Data type | Collected? | Linked to identity? | Used for tracking? |
|-----------|------------|---------------------|--------------------|
| Contact Info | No | — | — |
| Health | No | — | — |
| Location | No | — | — |
| User Content (clipboard, query history, DB connection names) | Stored on device only | No | No |
| Identifiers | No (no analytics SDK) | — | — |
| Usage Data | No | — | — |
| Diagnostics | Crash reports stay on device unless you add a reporter | No | No |

**Data Not Collected** is the honest default if you do not send telemetry. Mac App Store updates go through Apple. Direct builds may contact GitHub for version metadata.

If you choose **Data Not Collected**, do not also list clipboard as collected to Apple’s servers.

---

## Screenshots and App Previews

**Screenshots** — 10 slots, 16:10 (use 2560 × 1600). Files in `store-assets/screenshots/`. Keep slot 1 as “See every local port” with a tight crop on the table.

**App Previews** — up to 3 videos, 15–30 seconds, 1920 × 1080, H.264 `.mov` or `.mp4`, landscape. Files in `store-assets/previews/`. First preview should be live row → select → kill (no feature tour).

Upload order (first screenshot/preview is the one in search):
1. Ports dashboard
2. Heatmap
3. Kill / restart
4. Command palette
5. Text & Data
6. JSON formatter
7. Diff
8. Clipboard
9. Database
10. Settings / profiles

---

## English (U.K.)

Name, subtitle, and keywords can match U.S. (developers search in the same terms). Use this Description / What’s New / Promotional Text so the storefront is localised.

**Promotional Text** (170)
```
Signed Mac app for local ports, processes, clipboard, and databases. Kill a stuck :3000, format JSON, or query Postgres — without leaving one window.
```

**Description**
```
PortPilot is a local developer workstation for macOS. Watch every port on your machine, control the process behind it, and keep text, clipboard, and database tools in the same app.

PORTS AND PROCESSES
• Live table of listening ports with PID, CPU, memory, and project path
• Kill or restart a process without hunting in Activity Monitor
• Open localhost in the browser, jump to the terminal tab, or open the project in VS Code or Cursor
• Heatmap to spot port collisions
• Batch select to kill or restart many ports at once
• Menu bar tray for a quick look at what is running
• Profiles for favourites, filters, and per-project setups

TEXT AND DATA
• JSON formatter and JSON diff
• Text diff
• JavaScript console
• Convert JSON, YAML, CSV, Markdown, HTML, PDF, DOCX, and XLSX
• Searchable clipboard history for copied text, JSON, and URLs

DATABASE
• Postgres, MySQL, SQLite, Turso (libSQL), Redis, and MongoDB
• Optional SSH tunnels
• SQL editor, table browser, and query history
• Passwords stay in the macOS Keychain, with an in-memory cache for the current session. Uncheck “Save password for next launch” to keep a password only until you quit.

KEYBOARD FIRST
• Global launcher (default: Option-Command-P)
• Command palette (Command-K) across ports, clipboard, and tools
• Shortcuts listed in Settings

PRIVACY
PortPilot runs on your Mac. Connections go from your machine to the databases and hosts you configure. Mac App Store builds update through Apple.

Requires macOS on Apple Silicon.
```

**Keywords** — same as English (U.S.)

**What's New**
```
The Dock icon now matches other Mac apps. After you kill or restart a few stuck processes, PortPilot may ask you to leave a rating — never on first launch, and you can skip it.
```

---

## German (Deutschland)

**Name** (30) — keep
```
PortPilot Desktop
```

**Subtitle** (30)
```
Ports, Prozesse, Datenbanken
```
28 characters.

**Promotional Text** (170)
```
Mac-App für lokale Ports, Prozesse, Zwischenablage und Datenbanken. Beende :3000, formatiere JSON oder frage Postgres ab — in einem Fenster.
```

**Description**
```
PortPilot ist ein lokaler Entwickler-Arbeitsplatz für macOS. Sieh jeden Port auf dem Mac, steuere den Prozess dahinter und behalte Text-, Zwischenablage- und Datenbank-Werkzeuge in einer App.

PORTS UND PROZESSE
• Live-Tabelle der lauschenden Ports mit PID, CPU, Speicher und Projektpfad
• Prozess beenden oder neu starten, ohne in der Aktivitätsanzeige zu suchen
• Localhost im Browser öffnen, zum Terminal-Tab springen oder das Projekt in VS Code oder Cursor öffnen
• Heatmap für Port-Kollisionen
• Mehrere Ports auf einmal beenden oder neu starten
• Menüleisten-Symbol für einen schnellen Blick auf laufende Dienste
• Profile für Favoriten, Filter und projektbezogene Setups

TEXT UND DATEN
• JSON-Formatierung und JSON-Diff
• Text-Diff
• JavaScript-Konsole
• Konvertierung von JSON, YAML, CSV, Markdown, HTML, PDF, DOCX und XLSX
• Durchsuchbare Zwischenablage für Text, JSON und URLs

DATENBANK
• Postgres, MySQL, SQLite, Turso (libSQL), Redis und MongoDB
• Optionale SSH-Tunnel
• SQL-Editor, Tabellenbrowser und Abfrageverlauf
• Passwörter bleiben im macOS-Schlüsselbund, mit einem Speicher-Cache für die aktuelle Sitzung. „Passwort für den nächsten Start speichern“ deaktivieren, um ein Passwort nur bis zum Beenden zu behalten.

TASTATUR ZUERST
• Globaler Launcher (Standard: Option-Command-P)
• Befehlspalette (Command-K) für Ports, Zwischenablage und Werkzeuge
• Tastenkürzel unter Einstellungen

DATENSCHUTZ
PortPilot läuft auf deinem Mac. Verbindungen gehen von deinem Rechner zu den Datenbanken und Hosts, die du einrichtest. Mac-App-Store-Builds aktualisieren über Apple.

Erfordert macOS auf Apple Silicon.
```

**Keywords** (100 bytes)
```
monitor,json,postgres,mysql,sqlite,redis,mongodb,zwischenablage,sql,ssh,yaml,localhost
```

**What's New**
```
Das Dock-Symbol entspricht jetzt anderen Mac-Apps. Nach ein paar beendeten oder neu gestarteten Prozessen kann PortPilot um eine Bewertung bitten — nicht beim ersten Start, und du kannst überspringen.
```
