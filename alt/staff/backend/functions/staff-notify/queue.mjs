// Keep work bounded: one slow recipient must not stall everybody behind them.
export async function mapConcurrent(items, limit, run) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await run(items[index]);
    }
  }));
  return results;
}

export async function drainQueue({ claim, deliver, now = Date.now,
  batchSize = 16, concurrency = 8, maxJobs = 96, budgetMs = 15000 }) {
  const started = now();
  const result = { processed: 0, accepted: 0, retry_or_failed: 0, cancelled: 0, more: false };
  while (result.processed < maxJobs && now() - started < budgetMs) {
    const limit = Math.min(batchSize, maxJobs - result.processed);
    const jobs = await claim(limit);
    if (!jobs.length) { result.more = false; break; }
    const outcomes = await mapConcurrent(jobs, concurrency, deliver);
    result.processed += jobs.length;
    for (const outcome of outcomes) {
      if (outcome === 'accepted') result.accepted++;
      else if (outcome === 'cancelled') result.cancelled++;
      else result.retry_or_failed++;
    }
    result.more = jobs.length === limit;
    if (!result.more) break;
  }
  return result;
}

// Each continuation starts a new short-lived request, never one task per user.
export function nextDrain(result, depth, isPrivateTest) {
  return result.more && !isPrivateTest && depth < 10
    ? { background: true, drain_depth: depth + 1 } : null;
}
