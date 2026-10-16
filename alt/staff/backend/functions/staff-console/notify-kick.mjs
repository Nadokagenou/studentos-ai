export function createNotifyKick({ url, key, fetcher = fetch, waitUntil, warn = console.warn }) {
  return (action, payload, result) => {
    if (result?.duplicate || !(action === 'grant' || (action === 'publish' && payload.push))) return;
    const task = (async () => {
      try {
        const response = await fetcher(url + '/functions/v1/staff-notify', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
          body: JSON.stringify({ background: true }),
          signal: AbortSignal.timeout(10000),
        });
        await response.text();
        if (!response.ok) warn('[staff-notify] immediate dispatch unavailable; cron will retry');
      } catch {
        warn('[staff-notify] immediate dispatch unavailable; cron will retry');
      }
    })();
    waitUntil(task);
  };
}
