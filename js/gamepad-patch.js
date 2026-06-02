// Patch navigator.getGamepads BEFORE Babylon loads — some sandboxed iframes
// (Claude artifact preview, etc.) block this API via Permissions Policy and
// Babylon's input system will crash trying to call it.
(function patchGamepads() {
  try {
    const test = navigator.getGamepads && navigator.getGamepads();
  } catch (e) {
    Object.defineProperty(navigator, 'getGamepads', {
      value: function() { return []; },
      configurable: true, writable: true
    });
  }
  // Even if the call worked above, some browsers throw later in event listeners.
  // Wrap it defensively.
  const orig = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
  Object.defineProperty(navigator, 'getGamepads', {
    value: function() { try { return orig ? orig() : []; } catch (e) { return []; } },
    configurable: true, writable: true
  });
})();
