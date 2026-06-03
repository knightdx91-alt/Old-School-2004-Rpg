// Babylon.js loader — tries local bundle first, then CDN fallbacks.
// Once Babylon loads, injects game scripts in order to guarantee BABYLON is defined.
(function loadBabylon() {
  const sources = [
    'js/babylon.js',
    'https://cdn.babylonjs.com/babylon.js',
    'https://cdn.jsdelivr.net/npm/babylonjs@6.49.0/babylon.min.js',
    'https://unpkg.com/babylonjs@6.49.0/babylon.js'
  ];

  const loaderSources = [
    'js/babylonjs.loaders.min.js',
    'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js',
    'https://cdn.jsdelivr.net/npm/babylonjs-loaders@6.49.0/babylonjs.loaders.min.js',
    'https://unpkg.com/babylonjs-loaders@6.49.0/babylonjs.loaders.min.js'
  ];

  const gameScripts = [
    'js/data.js',
    'js/state.js',
    'js/items.js',
    'js/quiz.js',
    'js/world.js',
    'js/combat.js',
    'js/hud.js',
    'js/main.js'
  ];

  function loadScriptsSequentially(scripts, done) {
    if (!scripts.length) { done && done(); return; }
    const s = document.createElement('script');
    s.src = scripts[0] + '?v=5';
    s.onload = () => loadScriptsSequentially(scripts.slice(1), done);
    s.onerror = () => console.error('Failed to load ' + scripts[0]);
    document.head.appendChild(s);
  }

  function loadLoadersThenGame(li) {
    if (li >= loaderSources.length) {
      // All loader CDNs failed — proceed anyway (GLBs won't work but game will start)
      console.warn('babylonjs.loaders failed to load from all CDNs');
      loadScriptsSequentially(gameScripts);
      return;
    }
    const s = document.createElement('script');
    s.src = loaderSources[li];
    s.crossOrigin = 'anonymous';
    s.onload = () => loadScriptsSequentially(gameScripts);
    s.onerror = () => loadLoadersThenGame(li + 1);
    document.head.appendChild(s);
  }

  let i = 0;
  function tryNext() {
    if (i >= sources.length) {
      document.body.innerHTML = '<div style="color:#d4a847;font-family:Georgia,serif;padding:40px;max-width:600px;margin:60px auto;text-align:center;line-height:1.6;">' +
        '<h2 style="font-family:Cinzel,serif;letter-spacing:0.15em;margin-bottom:1rem;">Could Not Load Babylon.js</h2>' +
        '<p style="font-style:italic;opacity:0.8;">The 3D engine failed to load from all sources. Likely causes:</p>' +
        '<ul style="text-align:left;display:inline-block;margin:1rem 0;font-style:italic;opacity:0.8;">' +
        '<li>You are offline</li><li>An ad blocker or firewall is blocking the CDNs</li><li>The local js/babylon.js file is missing</li></ul></div>';
      return;
    }
    const s = document.createElement('script');
    s.src = sources[i++];
    s.crossOrigin = 'anonymous';
    s.onload = () => { window.__babylonLoaded = true; loadLoadersThenGame(0); };
    s.onerror = () => tryNext();
    document.head.appendChild(s);
  }
  tryNext();
})();
