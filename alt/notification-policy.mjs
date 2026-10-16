// ALT no longer registers for system notifications. Retire only its own scope;
// navigator.serviceWorker.ready may still refer to the main app on first load.
export async function retireAltSubscription({ serviceWorker, scope, removeEndpoint }) {
  if (!serviceWorker) return;
  const registration = await serviceWorker.getRegistration(scope);
  if (!registration || registration.scope !== scope) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const removed = await subscription.unsubscribe();
  if (!removed && await registration.pushManager.getSubscription()) throw Error('ALT subscription still active');
  // An unsubscribed endpoint cannot receive future sends even if offline cleanup
  // fails. The delivery workers also remove expired endpoints on 404/410.
  if (removeEndpoint) {
    try { await removeEndpoint(subscription.endpoint); } catch { /* retry on expiry */ }
  }
}
