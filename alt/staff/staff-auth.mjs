export const STAFF_AUTH_KEY = 'studentos.staff.auth';
const PROVIDER_KEY = 'studentos.staff.github';
const keys = [STAFF_AUTH_KEY, PROVIDER_KEY, STAFF_AUTH_KEY + '-code-verifier', STAFF_AUTH_KEY + '-user'];
const read = (storage, key) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
const write = (storage, key, value) => { try { storage.setItem(key, value); return true; } catch { return false; } };
const remove = (storage, key) => { try { storage?.removeItem(key); } catch { /* unavailable storage */ } };
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
function usable(storage) {
  const probe = STAFF_AUTH_KEY + '.probe';
  if (!storage || !write(storage, probe, '1')) return false;
  remove(storage, probe);
  return true;
}
export function createStaffSessionStorage({ persistent, tab }) {
  const memory = new Map();
  const fallback = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const storage = usable(persistent) ? persistent : usable(tab) ? tab : fallback;
  const persistentAvailable = storage === persistent;
  const legacySession = parse(read(tab, STAFF_AUTH_KEY));
  // Retain a running staff session when upgrading, without replacing a newer
  // persistent account or copying the learner app's separate authentication.
  if (!read(storage, STAFF_AUTH_KEY) && legacySession) {
    if (write(storage, STAFF_AUTH_KEY, JSON.stringify(legacySession)) && storage !== tab) remove(tab, STAFF_AUTH_KEY);
  }
  const verifier = read(tab, STAFF_AUTH_KEY + '-code-verifier');
  if (storage !== tab && verifier && !read(storage, STAFF_AUTH_KEY + '-code-verifier')) {
    if (write(storage, STAFF_AUTH_KEY + '-code-verifier', verifier)) remove(tab, STAFF_AUTH_KEY + '-code-verifier');
  }
  function providerToken(session) {
    const id = session?.user?.id;
    if (!id) return null;
    if (session.provider_token) {
      write(storage, PROVIDER_KEY, JSON.stringify({ user_id: id, token: session.provider_token }));
      return session.provider_token;
    }
    const saved = parse(read(storage, PROVIDER_KEY));
    return saved?.user_id === id && typeof saved.token === 'string' ? saved.token : null;
  }
  // Supabase refreshes its own tokens, but omits the GitHub provider token from
  // refreshed sessions. Capture it before SDK initialization can refresh them.
  const savedSession = parse(read(storage, STAFF_AUTH_KEY));
  if (savedSession?.provider_token) providerToken(savedSession);
  else if (!providerToken(savedSession) && legacySession?.user?.id && savedSession?.user?.id === legacySession.user.id) {
    const legacyToken = read(tab, PROVIDER_KEY);
    if (legacyToken && !parse(legacyToken)) providerToken({ user: legacySession.user, provider_token: legacyToken });
  }
  if (storage !== tab) remove(tab, PROVIDER_KEY);
  return {
    storage, persistentAvailable, providerToken,
    forgetProvider() { remove(storage, PROVIDER_KEY); remove(tab, PROVIDER_KEY); },
    clear() { for (const target of new Set([storage, persistent, tab])) for (const key of keys) remove(target, key); },
  };
}
