const urls = (process.env.LOAD_TEST_URLS || "http://127.0.0.1:3201,http://127.0.0.1:3202").split(",").map((value) => value.trim()).filter(Boolean);
const matchIds = (process.env.LOAD_TEST_MATCH_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const viewers = Number(process.env.LOAD_TEST_VIEWERS || 50);
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 10_000);
const pollMs = Number(process.env.LOAD_TEST_POLL_MS || 1_000);
if (!urls.length || !matchIds.length) throw new Error("LOAD_TEST_URLS dan LOAD_TEST_MATCH_IDS wajib diisi.");

const deadline = Date.now() + durationMs;
const latencies = [];
let requests = 0;
let failures = 0;
const failureReasons = {};
let orderingErrors = 0;
let duplicates = 0;
let prismaP2028 = 0;
const databaseDurations = [];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function viewer(index) {
  const matchId = matchIds[index % matchIds.length];
  let after = "0";
  let turn = index;
  const seen = new Set();
  while (Date.now() < deadline) {
    const baseUrl = urls[turn++ % urls.length];
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/public/matches/${matchId}?realtime=1&after=${after}`, {
        headers: { "x-forwarded-for": `198.18.${Math.floor(index / 250)}.${index % 250 + 1}` },
      });
      const body = await response.json();
      const timing = response.headers.get("server-timing")?.match(/database;dur=([0-9.]+)/)?.[1];
      if (timing) databaseDurations.push(Number(timing));
      if (!response.ok || !body?.data) {
        if (body?.code === "P2028" || String(body?.error || "").includes("P2028")) prismaP2028 += 1;
        throw new Error(`HTTP ${response.status}`);
      }
      const values = (body.data.messages || []).map((item) => BigInt(item.sequence));
      if (values.some((value, position) => position > 0 && value <= values[position - 1])) orderingErrors += 1;
      for (const value of values) {
        const key = value.toString();
        if (seen.has(key) && value > BigInt(after)) duplicates += 1;
        seen.add(key);
      }
      if (values.length) after = values.at(-1).toString();
    } catch (error) {
      failures += 1;
      const reason = error instanceof Error ? error.message : "unknown";
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    } finally {
      requests += 1;
      latencies.push(performance.now() - started);
    }
    await sleep(pollMs);
  }
}

await Promise.all(Array.from({ length: viewers }, (_, index) => viewer(index)));
latencies.sort((a, b) => a - b);
databaseDurations.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0;
const databasePercentile = (p) => databaseDurations[Math.min(databaseDurations.length - 1, Math.floor(databaseDurations.length * p))] || 0;
console.log(JSON.stringify({
  urls,
  matches: matchIds.length,
  viewers,
  durationMs,
  pollMs,
  requests,
  failures,
  failureReasons,
  orderingErrors,
  duplicates,
  prismaP2028,
  p50Ms: Number(percentile(0.50).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  databaseP50Ms: Number(databasePercentile(0.50).toFixed(2)),
  databaseP95Ms: Number(databasePercentile(0.95).toFixed(2)),
  databaseP99Ms: Number(databasePercentile(0.99).toFixed(2)),
}, null, 2));
if (failures || orderingErrors || duplicates) process.exitCode = 1;
