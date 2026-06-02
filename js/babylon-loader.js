// Babylon.js loader — tries local bundle first, then CDN fallbacks.
// Local file (js/babylon.js) is not committed to git (see .gitignore).
// Run `npm run download-babylon` or the curl command in README to get it.
(function loadBabylon() {
  const sources = [
    'js/babylon.js',  // local bundle for itch.io / offline use
    'https://cdn.babylonjs.com/babylon.js',
    'https://cdn.jsdelivr.net/npm/babylonjs@6.49.0/babylon.min.js',
    'https://unpkg.com/babylonjs@6.49.0/babylon.js'
  ];
  let i = 0;
  function tryNext() {
    if (i >= sources.length) {
      document.body.innerHTML = '<div style="color:#d4a847;font-family:Georgia,serif;padding:40px;max-width:600px;margin:60px auto;text-align:center;line-height:1.6;">' +
        '<h2 style="font-family:Cinzel,serif;letter-spacing:0.15em;margin-bottom:1rem;">Could Not Load Babylon.js</h2>' +
        '<p style="font-style:italic;opacity:0.8;">The 3D engine failed to load from all sources. Likely causes:</p>' +
        '<ul style="text-align:left;display:inline-block;margin:1rem 0;font-style:italic;opacity:0.8;">' +
        '<li>You are offline</li><li>An ad blocker or firewall is blocking the CDNs</li><li>The local js/babylon.js file is missing — run the download command</li></ul>' +
        '<p style="font-style:italic;opacity:0.8;">Try: refresh, disable ad blockers, or run <code>npm run download-babylon</code> in your terminal.</p></div>';
      return;
    }
    const s = document.createElement('script');
    s.src = sources[i++];
    s.crossOrigin = 'anonymous';
    s.onload = () => { window.__babylonLoaded = true; };
    s.onerror = () => { tryNext(); };
    document.head.appendChild(s);
  }
  tryNext();
})();
