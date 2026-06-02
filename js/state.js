/* ================================================================
   STATE
   ================================================================ */
const SAVE_KEY = 'sygl_save_v1';
const GRID_SIZE = 100;    // 100x100 tile grid
const TILE_SIZE = 2;      // each tile = 2 world units
const TICK_MS = 600;

const state = {
  quizScores: {}, quizIndex: 0, recommendedSygl: null, selectedSygl: null,
  player: null,
  combat: null,
  path: null, pathStep: 0,
  worldClock: 250, // start at midday (worldClock/1000 * 2π = π/2 → sun at zenith)
  logEntries: [],
  currentTab: 'stats',
  pendingAction: null, // { type: 'attack', enemyId } after walk completes
  obstacles: new Set(), // "x,y" tile keys
  enemies: [],
  enemyMeshes: new Map(),
  playerMesh: null,
  scene: null, engine: null, camera: null, sunLight: null, ambientLight: null,
  targetMarker: null,
  hudScale: 1,
  ready: false
};

/* ================================================================
   LOG
   ================================================================ */
function log(text, cls = '') {
  state.logEntries.push({ text, cls });
  if (state.logEntries.length > 80) state.logEntries.shift();
  const el = document.getElementById('log');
  if (el) {
    el.innerHTML = state.logEntries.map(e => `<div class="entry ${e.cls}">${e.text}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }
}

/* ================================================================
   SCREEN FLOW
   ================================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
