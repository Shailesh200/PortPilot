#!/usr/bin/env python3
import json
import os
import signal
import statistics
import subprocess
import time

cwd = "/Users/shaileshjha/Desktop/port-pilot"
electron = os.path.join(
    cwd, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
)
bench_path = "/tmp/portpilot-bench.json"
env = os.environ.copy()
env["NODE_ENV"] = "production"
env["PORTPILOT_BENCH"] = "1"


def kill_app() -> None:
    out = subprocess.check_output(["ps", "-axo", "pid=,args="], text=True)
    for line in out.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) < 2:
            continue
        pid, args = parts
        if cwd in args and "Electron" in args:
            try:
                os.kill(int(pid), signal.SIGTERM)
            except ProcessLookupError:
                pass


def measure_rss() -> tuple[float, list[tuple[str, float]]]:
    out = subprocess.check_output(["ps", "-axo", "pid=,rss=,args="], text=True)
    total = 0
    breakdown: list[tuple[str, float]] = []
    for line in out.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) < 3:
            continue
        _pid, rss_s, args = parts
        if cwd not in args or "Electron.app" not in args:
            continue
        rss = int(rss_s)
        total += rss
        if "Helper (Renderer)" in args:
            kind = "renderer"
        elif "Helper (GPU)" in args:
            kind = "gpu"
        elif "crashpad" in args:
            kind = "crashpad"
        elif "Helper.app" in args:
            kind = "utility"
        elif "Helper" in args:
            kind = "helper"
        else:
            kind = "main"
        breakdown.append((kind, rss / 1024))
    return total / 1024, breakdown


def one_run(run: int) -> dict:
    try:
        os.remove(bench_path)
    except FileNotFoundError:
        pass
    t0 = time.perf_counter()
    proc = subprocess.Popen(
        [electron, "."],
        cwd=cwd,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 25
    bench = None
    while time.time() < deadline:
        if os.path.exists(bench_path):
            try:
                bench = json.loads(open(bench_path).read())
                if "show" in bench:
                    break
            except Exception:
                pass
        time.sleep(0.02)
    wall_ms = (time.perf_counter() - t0) * 1000
    time.sleep(5)
    rss_mb, breakdown = measure_rss()
    kill_app()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
    time.sleep(1.2)
    return {
        "run": run,
        "wall_to_show_ms": round(wall_ms, 1),
        "bench": bench,
        "idle_rss_mb": round(rss_mb, 1),
        "breakdown": [(k, round(v, 1)) for k, v in breakdown],
    }


def main() -> None:
    kill_app()
    time.sleep(1)
    results = []
    for i in range(3):
        row = one_run(i + 1)
        results.append(row)
        print(json.dumps(row), flush=True)
    walls = [r["wall_to_show_ms"] for r in results]
    shows = [r["bench"]["show"] for r in results if r.get("bench") and "show" in r["bench"]]
    wr = [
        r["bench"]["whenReady"]
        for r in results
        if r.get("bench") and "whenReady" in r["bench"]
    ]
    rss = [r["idle_rss_mb"] for r in results]
    summary = {
        "avg_wall_to_show_ms": round(statistics.mean(walls), 1),
        "avg_whenReady_ms": round(statistics.mean(wr), 1) if wr else None,
        "avg_show_from_mainjs_ms": round(statistics.mean(shows), 1) if shows else None,
        "avg_idle_rss_mb": round(statistics.mean(rss), 1),
        "min_wall_ms": min(walls),
        "max_wall_ms": max(walls),
    }
    print("SUMMARY " + json.dumps(summary), flush=True)
    out_path = os.path.join(cwd, "docs", "baseline-metrics.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"runs": results, "summary": summary}, f, indent=2)
    print(f"wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
