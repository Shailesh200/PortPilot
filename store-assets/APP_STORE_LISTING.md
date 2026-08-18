# App Store Connect — copy/paste

Locale: **English (U.S.)** unless you add more languages.

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
PortPilot runs on your Mac. Connections go from your machine to the databases and hosts you configure. Auto-update checks GitHub Releases for new versions.

Requires macOS on Apple Silicon.
```

**Keywords** (100 bytes, commas, no spaces after commas, do not repeat the app name)
```
localhost,pid,postgres,mysql,sqlite,redis,mongodb,json,clipboard,electron,devtools,sql,ssh,vite
```
Count this in App Store Connect; trim from the right if it exceeds 100.

**Support URL** (required)
```
https://github.com/Shailesh200/PortPilot/issues
```

**Marketing URL** (optional)
```
https://github.com/Shailesh200/PortPilot
```

**Privacy Policy URL** (required)
You must host a page. Until you have a custom site:
```
https://github.com/Shailesh200/PortPilot/blob/main/PRIVACY.md
```
Create `PRIVACY.md` in the repo before submitting (App Review checks this link).

**What's New** (first version can be omitted; still useful)
```
First Mac App Store release of PortPilot Desktop: live port control, Text & Data tools, clipboard history, and a local database client with Keychain-backed passwords.
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

**Data Not Collected** is the honest default if you do not send telemetry. Auto-update only contacts GitHub for version metadata.

If you choose **Data Not Collected**, do not also list clipboard as collected to Apple’s servers.

---

## Screenshots and App Previews

**Screenshots** — 10 slots, 16:10 (use 2560 × 1600). Files in `store-assets/screenshots/`.

**App Previews** — up to 3 videos, 15–30 seconds, 1920 × 1080, H.264 `.mov` or `.mp4`, landscape. Files in `store-assets/previews/`.

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
