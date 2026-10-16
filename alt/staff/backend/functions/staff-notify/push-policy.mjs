// Subscription endpoints are user-supplied. Never let the worker send requests
// to arbitrary internal hosts using its service credentials/runtime network.
export function safePushEndpoint(endpoint, extraHosts = []) {
  try {
    const u = new URL(endpoint);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443")
    )
      return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "fcm.googleapis.com" ||
      h === "web.push.apple.com" ||
      h === "updates.push.services.mozilla.com" ||
      h.endsWith(".push.services.mozilla.com") ||
      h.endsWith(".notify.windows.com") ||
      extraHosts.includes(h)
    );
  } catch {
    return false;
  }
}
