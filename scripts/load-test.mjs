const baseUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:3000";
const path = process.env.LOAD_TEST_PATH || "/api/health/live";
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20);
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 10_000);
const deadline = Date.now() + durationMs;
const latencies = [];
let failures = 0;

async function worker() {
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl));
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    }
    latencies.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0;
console.log(JSON.stringify({
  baseUrl, path, concurrency, durationMs, requests: latencies.length, failures,
  requestsPerSecond: Number((latencies.length / (durationMs / 1000)).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)), p95Ms: Number(percentile(0.95).toFixed(2)), p99Ms: Number(percentile(0.99).toFixed(2)),
}, null, 2));
