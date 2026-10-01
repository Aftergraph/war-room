#!/usr/bin/env python3
import argparse, json, os, pathlib, statistics, subprocess, tempfile, time, urllib.request

PORTS = range(37621, 37632)

def percentile(values, q):
    xs = sorted(values)
    if not xs:
        return None
    pos = (len(xs) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(xs) - 1)
    frac = pos - lo
    return xs[lo] * (1 - frac) + xs[hi] * frac

def http_json(url, method="GET", headers=None, timeout=0.5):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def discover_port(deadline):
    while time.perf_counter() < deadline:
        for p in PORTS:
            try:
                x = http_json(f"http://127.0.0.1:{p}/api/health", timeout=0.08)
                if x.get("ok") is True:
                    return p
            except Exception:
                pass
        time.sleep(0.005)
    raise RuntimeError("runtime did not become healthy")

def proc_rss_bytes(pid):
    try:
        for line in pathlib.Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) * 1024
    except Exception:
        return None
    return None

def proc_cpu_seconds(pid):
    try:
        parts = pathlib.Path(f"/proc/{pid}/stat").read_text().split()
        ticks = os.sysconf(os.sysconf_names["SC_CLK_TCK"])
        return (int(parts[13]) + int(parts[14])) / ticks
    except Exception:
        return None

def health_latency_ms(port, n=120):
    samples = []
    url = f"http://127.0.0.1:{port}/api/health"
    for _ in range(n):
        t0 = time.perf_counter_ns()
        x = http_json(url, timeout=1.0)
        if x.get("ok") is not True:
            raise RuntimeError("health endpoint returned non-ok")
        samples.append((time.perf_counter_ns() - t0) / 1e6)
    return samples

def stop_runtime(port, proc):
    try:
        session = http_json(f"http://127.0.0.1:{port}/api/session", timeout=1.0)["session"]
        http_json(
            f"http://127.0.0.1:{port}/api/shutdown",
            method="POST",
            headers={"X-WarRoom-Session": session},
            timeout=1.0,
        )
    except Exception:
        pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=2)

def one_run(binary, label, iteration):
    env = os.environ.copy()
    env["WAR_ROOM_NO_BROWSER"] = "1"
    env["AFTERGRAPH_NO_BROWSER"] = "1"
    home = tempfile.mkdtemp(prefix=f"warroom-perf-{label}-{iteration}-")
    env["HOME"] = home
    start_ns = time.perf_counter_ns()
    proc = subprocess.Popen([binary], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    port = None
    try:
        port = discover_port(time.perf_counter() + 10)
        ready_ns = time.perf_counter_ns()
        startup_ms = (ready_ns - start_ns) / 1e6
        time.sleep(0.20)
        rss = proc_rss_bytes(proc.pid)
        cpu_s = proc_cpu_seconds(proc.pid)
        lat = health_latency_ms(port)
        return {
            "startup_ms": startup_ms,
            "rss_bytes": rss,
            "cpu_seconds_at_sample": cpu_s,
            "health_ms_p50": statistics.median(lat),
            "health_ms_p95": percentile(lat, 0.95),
        }
    finally:
        if port is not None:
            stop_runtime(port, proc)
        elif proc.poll() is None:
            proc.kill()

def summarize(rows):
    out = {}
    for key in rows[0]:
        vals = [r[key] for r in rows if r[key] is not None]
        out[key] = {
            "median": statistics.median(vals),
            "p95": percentile(vals, 0.95),
            "min": min(vals),
            "max": max(vals),
        }
    return out

def delta_pct(after, before):
    if before == 0:
        return 0.0 if after == 0 else None
    return (after - before) / before * 100.0

ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True)
ap.add_argument("--head", required=True)
ap.add_argument("--iterations", type=int, default=12)
ap.add_argument("--out", required=True)
args = ap.parse_args()

rows = {"base": [], "head": []}
for i in range(args.iterations):
    order = ["base", "head"] if i % 2 == 0 else ["head", "base"]
    for label in order:
        rows[label].append(one_run(getattr(args, label), label, i))

summary = {k: summarize(v) for k, v in rows.items()}
base_size = os.path.getsize(args.base)
head_size = os.path.getsize(args.head)
comparisons = {}
for metric in ["startup_ms", "rss_bytes", "cpu_seconds_at_sample", "health_ms_p50", "health_ms_p95"]:
    comparisons[metric] = {
        "base_median": summary["base"][metric]["median"],
        "head_median": summary["head"][metric]["median"],
        "delta_pct": delta_pct(summary["head"][metric]["median"], summary["base"][metric]["median"]),
    }
comparisons["binary_size"] = {
    "base": base_size,
    "head": head_size,
    "delta_pct": delta_pct(head_size, base_size),
}

# Conservative gross-regression sentinels. These do not claim statistical superiority;
# they only reject large regressions in a noisy shared CI environment.
gross = []
s = comparisons["startup_ms"]
if s["head_median"] > max(s["base_median"] * 2.0, s["base_median"] + 50):
    gross.append("startup")
r = comparisons["rss_bytes"]
if r["head_median"] > max(r["base_median"] * 1.30, r["base_median"] + 8 * 1024 * 1024):
    gross.append("rss")
h = comparisons["health_ms_p95"]
if h["head_median"] > max(h["base_median"] * 2.0, h["base_median"] + 1.0):
    gross.append("health_p95")
if head_size > base_size * 1.02:
    gross.append("binary_size")

result = {
    "iterations_per_variant": args.iterations,
    "interleaved_order": True,
    "base_binary_bytes": base_size,
    "head_binary_bytes": head_size,
    "summary": summary,
    "comparisons": comparisons,
    "gross_regressions": gross,
    "gross_regression_gate": len(gross) == 0,
}
pathlib.Path(args.out).write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
if gross:
    raise SystemExit("gross regression(s): " + ", ".join(gross))
