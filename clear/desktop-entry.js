// Load desktop controls only when entering a desktop-sized viewport.
(() => {
  const wide = matchMedia('(min-width:1025px) and (hover:hover) and (pointer:fine)');
  let loaded = false;
  const load = () => {
    if (!wide.matches || loaded) return;
    loaded = true;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'desktop.js?v=20261020-sidebar';
    document.body.appendChild(script);
  };
  wide.addEventListener('change', load);
  load();
})();
