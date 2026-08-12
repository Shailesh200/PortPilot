# PortPilot architecture baseline (pre–Tier 1)

Captured: **2026-08-12** on **Apple M1 / 8 GB / macOS 26.5.2 / arm64**  
App version: **1.0.13** (`main`)  
Method notes: production `electron-vite` build; cold start via `PORTPILOT_BENCH=1` + `scripts/bench-baseline.py` (3 runs). Release sizes from GitHub `v1.0.13` assets.

## Stack under measurement

| Layer | Version |
|---|---|
| Shell | Electron **30.5.1** (`^30.0.0`) |
| Bundler | electron-vite **2.3.x** + Vite **5.4.21** |
| UI | React **18.3**, Tailwind **3.4**, Zustand **4.5** |
| Package manager | npm **10.9.0** + `package-lock.json` |
| TypeScript | **5.5** |
| Node (dev host) | **23.1.0** |
| Bun available | **1.3.11** (not used by project yet) |

## Source & dependency footprint

| Metric | Value |
|---|---|
| TS/TSX files | 69 |
| Approx. LOC (`src/**/*.ts(x)`) | ~21,958 |
| Main process LOC | ~5,563 |
| Renderer LOC | ~15,556 |
| Preload + shared LOC | ~839 |
| Runtime deps | 45 |
| Dev deps | 18 |
| `node_modules` | **739 MB** |
| Direct `electron` install | **235 MB** (dist app **224 MB**) |
| `lucide-react` on disk | **31 MB** (icon tree; tree-shaken at build) |
| `pdfjs-dist` on disk | **34 MB** |
| `sql.js` on disk | **18 MB** |
| Preload `api` invoke methods | ~57 |
| IPC call sites (rough) | ~124 |

## Build performance (local)

| Step | Wall time |
|---|---|
| `npm run typecheck` | **0.42 s** |
| `npm run build` (electron-vite) | **~5.9 s** (renderer ~4.7–4.8 s) |
| `npm ci` (warm cache / existing tree) | **~51 s** (626 packages) |

### Production `out/` sizes

| Artifact | Raw | gzip (level 9) |
|---|---|---|
| `out/` total | **6.9 MB** | — |
| `out/main/index.js` | 136 KB | — |
| `out/preload/index.js` | 7.5 KB | — |
| Renderer JS chunk (primary) | **4.74 MB** | **1.05 MB** |
| Renderer JS chunk (secondary) | 0.68 MB | 0.12 MB |
| `pdf.worker.min-*.mjs` | **1.25 MB** | 0.37 MB |
| CSS | 72 KB | 0.01 MB |

**Observation:** Almost all of the app UI ships in one ~4.7 MB JS chunk. Fingerprints in that chunk include CodeMirror, pdf.js, docx/mammoth paths, lucide, marked, excel helpers — i.e. Text/Data tools are not aggressively code-split from the shell.

Vite also warns that `portStore` is both statically and dynamically imported, so the dynamic import cannot split it.

## Packaged release sizes (`v1.0.13`)

| Asset | Size |
|---|---|
| `PortPilot-1.0.13-arm64.dmg` | **135.9 MB** |
| `PortPilot-1.0.13-arm64-mac.zip` | **130.7 MB** |
| `PortPilot-Setup-1.0.13.exe` | **106.0 MB** |

**Observation:** Installer size is dominated by the Electron/Chromium runtime, not the 6.9 MB `out/` payload. Tier 1 (Bun/React/Tailwind/Vite) will **not** move installer size much; shell migrations (Tier 3) would.

## Runtime: cold start & idle memory (production, local)

Three clean launches after killing prior Electron instances:

| Run | Wall → first `show` | `whenReady` (from main JS) | `show` (from main JS) | Idle RSS (all Electron.* for app) |
|---|---|---|---|---|
| 1 | 1512 ms | 220 ms | 744 ms | 390.8 MB |
| 2 | 1179 ms | 128 ms | 401 ms | 385.8 MB |
| 3 | 903 ms | 112 ms | 383 ms | 367.0 MB |
| **Avg** | **1198 ms** | **153 ms** | **509 ms** | **381 MB** |

Typical idle process split (run 1): main ~151 MB, renderer ~135 MB, GPU ~65 MB, utility ~33 MB, crashpad ~7 MB.

**Observations:**
1. ~0.7–1.0 s of wall time is Chromium/Electron bootstrap **before** main-process JS markers.
2. After main JS starts, window show averages ~0.5 s — reasonable for a monolithic renderer bundle.
3. Idle RSS ~**380 MB** on 8 GB M1 is heavy for a utility; renderer alone ~130 MB reflects the large eager JS graph + Chromium baseline.
4. First run is coldest (disk/cache); subsequent runs improve ~40%.

Machine file: `docs/baseline-metrics.json`. Re-run with:

```bash
PORTPILOT_BENCH=1 npm run build && python3 scripts/bench-baseline.py
```

## Qualitative architecture observations (relevant to Tier 1)

1. **Package manager:** npm-only; Windows release previously needed an explicit `@rollup/rollup-win32-x64-msvc` install after `npm ci` (optional-deps bug). Bun may avoid that class of issue but CI must be validated.
2. **Electron 30** is behind current Electron lines (security/Chromium); upgrade is Tier 1’s highest-risk item (native modules: `ssh2`, `sql.js`, electron-builder).
3. **React 18 / Zustand 4 / Tailwind 3 / Vite 5** are stable but aging; upgrades are mostly mechanical if electron-vite keeps pace.
4. **Bundle composition** is the main *app-owned* size/start lever inside Electron — Tier 1 won’t replace Chromium, but React 19 + better splitting / dependency bumps can trim renderer JS and idle renderer RSS slightly.
5. **IPC** is a large string-channel surface (~57 preload methods). Untouched in Tier 1; typed IPC is Tier 2.
6. **Heavy libraries kept in renderer:** pdf.js worker always emitted; CodeMirror language packs; docx stack — candidates for lazy routes later (not required for Tier 1).

## Success criteria for post–Tier 1 re-measure

Compare against this baseline:

- Install / CI time (`bun install` vs `npm ci`)
- `typecheck` + `build` wall time
- Renderer primary chunk raw + gzip
- Cold start avg wall → show
- Idle RSS avg
- Packaged DMG/EXE if a release is cut

Expect **large wins on install/CI**, **modest wins on build**, **small or neutral** on installer MB and cold start unless Electron upgrade changes Chromium footprint.

---

## After Tier 1 (same machine, 2026-08-12)

Resolved stack: Electron **35.7.5**, React **19.2.8**, Vite **6.4.3**, electron-vite **5.0.0**, Tailwind **4.3.3** (`@tailwindcss/vite`), Zustand **5.0.14**, lucide-react **1.31.0**, package manager **Bun 1.3.11**.

| Metric | Pre (baseline) | Post (Tier 1) | Delta |
|---|---|---|---|
| Package manager install | npm ci ~**51 s** | bun frozen ~**1.1 s** | **~46× faster** |
| `node_modules` | **739 MB** | **408 MB** | **−45%** |
| Lockfile | `package-lock.json` 204 KB | `bun.lock` 144 KB | smaller |
| Typecheck (warm) | 0.42 s | 0.57 s | ~neutral |
| `build` | ~5.9 s | ~7.0 s | slightly slower |
| Primary renderer JS | 4.74 MB (gzip 1.05) | 5.06 MB (gzip 1.09) | **+7% raw** |
| CSS | 72 KB | 87 KB | +21% |
| `out/` | 6.9 MB | 7.3 MB | +0.4 MB |
| Cold start wall → show (avg 3) | **1198 ms** | **1006 ms** | **−16%** |
| Idle RSS (avg 3) | **381 MB** | **426 MB** | **+12%** |

Machine file: `docs/tier1-metrics.json`.

### Tier 1 observations

1. **Bun is the clear win** for install/CI footprint and speed; Windows rollup optional-deps workaround removed from CI.
2. **Cold start improved slightly** with Electron 35 despite a larger renderer chunk — Chromium bootstrap / main-path changes likely dominate.
3. **Idle RAM increased ~45 MB** — expected when jumping Electron 30 → 35 (newer Chromium). Not a Bun/React regression signal by itself.
4. **Renderer JS grew** with lucide-react 1.x + Tailwind 4 output; next leverage is lazy-loading Text/PDF/docx stacks (not Tier 1).
5. Typecheck/build remain healthy (`bun run typecheck` + `bun run build` pass).
6. Env-gated startup bench remains: `PORTPILOT_BENCH=1` + `bun run bench`.

---

## After app-code performance pass (same machine, 2026-08-12)

Implemented: route/tool lazy loading, dynamic heavy libs + CodeMirror, manual chunks, skip unchanged port IPC, Darwin cwd cache, Zustand/shortcut fan-out fixes, deferred workbench disk I/O + updater, Settings selectors, portStore cycle cleanup.

| Metric | Post Tier 1 | Post app-perf | Delta |
|---|---|---|---|
| Primary renderer JS (first paint) | **5.06 MB** | **0.69 MB** (706 KB) | **−86%** |
| Primary JS gzip | 1.09 MB | **0.13 MB** | **−88%** |
| Cold start wall → show (avg 3) | 1006 ms | **1029 ms** | ~neutral |
| Idle RSS (avg 3) | 426 MB | **479 MB** | +12% (noisy; renderer on ports ~121–140 MB) |
| Code-split examples | (monolith) | CodeMirror 1.3 MB, office 1.8 MB, pdfjs 1.0 MB, excel 0.3 MB, DB 0.14 MB — **async** | paid on demand |

Machine file: `docs/app-perf-metrics.json`.

### App-perf observations

1. **Biggest win is first-load JS**: ports shell no longer parses Text/PDF/docx/CodeMirror at boot.
2. Cold start wall time stays Chromium-dominated (~1 s); the JS parse win shows up more as smoother first interaction and lower *initial* renderer work than as a large wall-clock drop on this machine.
3. Unchanged port polls no longer rebuild `filteredPorts` / push IPC — less UI jank while idle on the dashboard.
4. Darwin `lsof -d cwd` is cached ~15 s so CPU/mem can refresh without a second full enrichment every tick.
5. Re-measure after opening Format Converter / DB once if comparing peak RSS with tools loaded.

---

## After next-items pass (typed IPC prep + UI polish)

Also done: deferred PDF worker helper, lazy CommandPalette/QuickPeek, PortTable memo + virtualize (>60), Heatmap memo cells, deferred `uiStore` nav rehydrate, shared `IpcChannel`/`IpcEvent`, `src/main/os` façade + resilient tray icon paths, Linux/Windows project-path cache, README shortcut sync, VS Code shortcut conflict warning.

Shell migration (Tauri/etc.) intentionally **not** started — OS façade is the prep step.

