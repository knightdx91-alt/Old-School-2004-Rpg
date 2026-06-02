// Babylon.js loader with CDN fallback chain.
// If one CDN is blocked/offline, try the next. Show a visible error if all fail.
(function loadBabylon() {
  const cdns = [
    'https://cdn.babylonjs.com/babylon.js',
    'https://cdn.jsdelivr.net/npm/babylonjs@6.49.0/babylon.min.js',
    'https://unpkg.com/babylonjs@6.49.0/babylon.js'
  ];
  let i = 0;
  function tryNext() {
    if (i >= cdns.length) {
      document.body.innerHTML = '<div style="color:#d4a847;font-family:Georgia,serif;padding:40px;max-width:600px;margin:60px auto;text-align:center;line-height:1.6;">' +
        '<h2 style="font-family:Cinzel,serif;letter-spacing:0.15em;margin-bottom:1rem;">Could Not Load Babylon.js</h2>' +
        '<p style="font-style:italic;opacity:0.8;">The 3D engine failed to load from all three CDNs. Likely causes:</p>' +
        '<ul style="text-align:left;display:inline-block;margin:1rem 0;font-style:italic;opacity:0.8;">' +
        '<li>You are offline</li><li>An ad blocker or corporate firewall is blocking cdn.babylonjs.com, jsdelivr.net, and unpkg.com</li><li>The browser is sandboxing local files too aggressively</li></ul>' +
        '<p style="font-style:italic;opacity:0.8;">Try: refresh, disable ad blockers for this page, or open in a different browser.</p></div>';
      return;
    }
    const s = document.createElement('script');
    s.src = cdns[i++];
    s.crossOrigin = 'anonymous';
    s.onload = () => { window.__babylonLoaded = true; };
    s.onerror = () => { tryNext(); };
    document.head.appendChild(s);
  }
  tryNext();
})();
