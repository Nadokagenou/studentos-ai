// Android companion passes only a draft in the URL fragment (not a server query).
// Never submit it, mint tokens, or bypass the existing sign-in/onboarding screens.
(() => {
  const KEY = 'studentos.shortcutDraft';
  const TTL = 10 * 60 * 1000;
  let pending = null;
  try {
    const query = new URLSearchParams(location.search);
    const route = query.get('go');
    const hash = new URLSearchParams(location.hash.slice(1));
    if ((route === 'quick' || route === 'assistant') && hash.has('sos-draft')) {
      const text = hash.get('sos-draft').trim().slice(0, route === 'quick' ? 500 : 2000);
      if (text) pending = { route, text, at: Date.now() };
      // Remove private draft before other modules/analytics can inspect the URL.
      history.replaceState(history.state, '', location.pathname + location.search);
      if (pending) { try { sessionStorage.setItem(KEY, JSON.stringify(pending)); } catch (_) {} }
    } else {
      try { pending = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    }
  } catch (_) {}
  function valid() {
    if (!pending || !['quick', 'assistant'].includes(pending.route) || typeof pending.text !== 'string'
      || !Number.isFinite(pending.at) || Date.now() < pending.at || Date.now() - pending.at >= TTL) {
      pending = null;
      try { sessionStorage.removeItem(KEY); } catch (_) {}
      return false;
    }
    return true;
  }
  window.shortcutDraftRoute = () => valid() ? pending.route : null;
  window.shortcutDraftApply = route => {
    if (!valid() || route !== pending.route) return false;
    const input = document.getElementById(route === 'quick' ? 'qaIn' : 'aiInput');
    if (!input || input.disabled || input.value) return false;
    input.value = pending.text.slice(0, route === 'quick' ? 500 : 2000);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    pending = null;
    try { sessionStorage.removeItem(KEY); } catch (_) {}
    return true;
  };
})();
