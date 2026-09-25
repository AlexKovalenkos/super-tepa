// Super Tepa: game bootstrap, input, camera, block interaction, save/load and the main loop.
import * as THREE from 'three';
import { createAtlasCanvas } from './textures.js';
import { B, BLOCKS, SOLID, SHAPE, OPAQUE } from './blocks.js';
import { World } from './world.js';
import { BIOME_NAMES } from './worldgen.js';
import { makeTerrainMaterials, ChunkManager } from './renderer.js';
import { buildItemGeometry } from './mesher.js';
import { Player } from './player.js';
import { Sky } from './sky.js';
import { createTepa, animateTepa, createPaw } from './tepa.js';
import { Particles } from './particles.js';
import { UI, makeIcons } from './ui.js';
import { TICK_MS, DAY_TICKS, VERSION } from './consts.js';

THREE.ColorManagement.enabled = false;

const SAVE_KEY = 'supertepa-save-v1';
const SETTINGS_KEY = 'supertepa-settings-v1';
const REACH = 5;
const DEFAULT_HOTBAR = [B.grass, B.dirt, B.stone, B.cobblestone, B.planks, B.oak_log, B.glass, B.torch, B.bricks];

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const settings = Object.assign({ renderDistance: 8, fov: 70, sensitivity: 1, bobbing: true }, store.get(SETTINGS_KEY) || {});

// ---------- Renderer & scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 1000);
camera.rotation.order = 'YXZ';
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
handScene.add(new THREE.AmbientLight(0xffffff, 1));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = handCamera.aspect = w / h;
  camera.updateProjectionMatrix(); handCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const atlasCanvas = createAtlasCanvas();
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
atlas.generateMipmaps = false;
const terrain = makeTerrainMaterials(atlas);
const sky = new Sky(scene);
const particles = new Particles(scene, atlas);
const ui = new UI(makeIcons(atlasCanvas));

// Tepa (visible in third person and on the title screen)
const tepa = createTepa();
scene.add(tepa);
const ambient = new THREE.AmbientLight(0xffffff, 1.8);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(0.4, 1, 0.3);
scene.add(ambient, sun);

// First-person paw + held block
const hand = new THREE.Group();
handScene.add(hand);
const paw = createPaw();
paw.traverse(o => { if (o.material) o.material = o.material.map(m => new THREE.MeshBasicMaterial({ map: m.map })); });
hand.add(paw);
const heldMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
const held = new THREE.Mesh(new THREE.BufferGeometry(), heldMat);
hand.add(held);

// Block selection outline
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
);
outline.visible = false;
scene.add(outline);

// ---------- Game state ----------
const game = {
  state: 'title', // title | playing | paused | inventory | help
  world: null, chunks: null, player: null,
  time: 1000, ticks: 0,
  hotbar: [...DEFAULT_HOTBAR], sel: 0,
  camMode: 0, // 0 first person, 1 behind, 2 front
  debug: false,
  target: null,
  breakCd: 0, placeCd: 0, swing: 0, prevSwing: 0,
  fov: settings.fov,
  spawnReady: false,
  helpFrom: 'title',
};
window.game = game; // for debugging from the console

function newWorld(seed, saved) {
  if (game.chunks) game.chunks.clear();
  game.world = new World(seed, saved?.mods);
  game.chunks = new ChunkManager(scene, game.world, terrain.list);
  game.chunks.setRadius(settings.renderDistance);
  game.player = new Player(game.world);
  game.time = saved?.time ?? 1000;
  game.hotbar = saved?.hotbar ?? [...DEFAULT_HOTBAR];
  game.sel = saved?.sel ?? 0;
  game.spawnReady = false;
  if (saved?.player) {
    const p = saved.player;
    game.player.setPos(p.x, p.y, p.z);
    game.player.yaw = p.yaw; game.player.pitch = p.pitch; game.player.flying = !!p.flying;
    game.spawnReady = 'saved';
  } else {
    const s = game.world.findSpawn();
    game.player.setPos(s.x, 200, s.z);
    game.spawnReady = 'find';
  }
  refreshHotbar();
}

function saveGame() {
  if (!game.world) return;
  const p = game.player;
  store.set(SAVE_KEY, {
    seed: game.world.seed, time: game.time, hotbar: game.hotbar, sel: game.sel,
    player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying },
    mods: game.world.serializeMods(),
  });
}

function refreshHotbar() {
  ui.setHotbar(game.hotbar, game.sel);
  const id = game.hotbar[game.sel];
  held.geometry.dispose();
  held.geometry = id ? buildItemGeometry(id) : new THREE.BufferGeometry();
  held.visible = !!id;
}

function selectSlot(i) {
  game.sel = (i + 9) % 9;
  refreshHotbar();
  ui.showItemName(game.hotbar[game.sel]);
}

// ---------- Input ----------
const keys = new Set();
const inp = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false };
let sprintLatch = false, lastW = 0, lastSpace = 0;
let mouseL = false, mouseR = false;
const locked = () => document.pointerLockElement === canvas;

function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch { /* pointer lock not available */ }
}

function setState(s) {
  game.state = s;
  ui.show('title', s === 'title');
  ui.show('pause', s === 'paused');
  ui.show('inventory', s === 'inventory');
  ui.show('help', s === 'help');
  ui.show('hud', s === 'playing' || s === 'inventory');
  if (s !== 'playing') { keys.clear(); mouseL = mouseR = false; }
}

function startPlaying() {
  setState('playing');
  lockPointer();
}

document.addEventListener('pointerlockchange', () => {
  if (!locked() && game.state === 'playing') { setState('paused'); saveGame(); }
});

document.addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'F3' || e.code === 'F5' || e.code === 'Space') e.preventDefault();
  if (game.state === 'inventory' && (e.code === 'KeyE' || e.code === 'Escape')) { startPlaying(); return; }
  if (game.state === 'inventory' && e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1) selectSlot(n - 1); return; }
  if (game.state === 'paused' && e.code === 'Escape' && !e.repeat) { startPlaying(); return; }
  if (game.state !== 'playing') return;
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  const now = performance.now();
  if (e.code === 'KeyW') { if (now - lastW < 300) sprintLatch = true; lastW = now; }
  if (e.code === 'Space') {
    if (now - lastSpace < 300 && !game.player.inWater) {
      game.player.flying = !game.player.flying;
      if (!game.player.flying) game.player.vel.y = 0;
      lastSpace = 0;
    } else lastSpace = now;
  }
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1) selectSlot(n - 1); }
  if (e.code === 'F5' || e.code === 'KeyV') game.camMode = (game.camMode + 1) % 3;
  if (e.code === 'F3' || e.code === 'Backquote') game.debug = !game.debug;
  if (e.code === 'KeyE') { setState('inventory'); document.exitPointerLock(); }
});
document.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'KeyW') sprintLatch = false;
});
window.addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });

document.addEventListener('mousemove', e => {
  if (game.state !== 'playing' || !locked()) return;
  const p = game.player, s = 0.0022 * settings.sensitivity;
  p.yaw -= e.movementX * s;
  p.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, p.pitch - e.movementY * s));
});

canvas.addEventListener('mousedown', e => {
  if (game.state !== 'playing') return;
  if (!locked()) { lockPointer(); return; }
  if (e.button === 0) { mouseL = true; breakBlock(); game.breakCd = 5; }
  if (e.button === 2) { mouseR = true; placeBlock(); game.placeCd = 4; }
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) mouseL = false;
  if (e.button === 2) mouseR = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  if (game.state !== 'playing') return;
  selectSlot(game.sel + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

// ---------- Block interaction ----------
function raycast() {
  const p = game.player;
  const ox = p.pos.x, oy = p.pos.y + p.eye, oz = p.pos.z;
  const cp = Math.cos(p.pitch);
  const dx = -Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * cp;
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
  let ty = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
  let tz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < 64; i++) {
    const id = game.world.getBlock(x, y, z);
    if (id && id !== B.water) return { x, y, z, nx, ny, nz, id };
    if (tx < ty && tx < tz) { if (tx > REACH) break; x += sx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { if (ty > REACH) break; y += sy; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { if (tz > REACH) break; z += sz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}

function brightnessAt(x, y, z) {
  const [s, b] = game.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  const lvl = Math.max(Math.max(0, s - sky.skyDarken), b) / 15;
  const f = 1 - lvl, v = (1 - f) / (f * 3 + 1);
  return Math.max(0.08, (v + (1 - Math.pow(1 - v, 4))) / 2);
}

function afterEdit(x, z) { game.chunks.flushAround(x, z); }

function breakBlock() {
  const t = game.target;
  game.swing = 1;
  if (!t || t.id === B.bedrock) return;
  const w = game.world;
  particles.spawnBlock(t.x, t.y, t.z, t.id, brightnessAt(t.x, t.y + 1, t.z));
  w.setBlock(t.x, t.y, t.z, 0);
  const above = w.getBlock(t.x, t.y + 1, t.z);
  if (above && BLOCKS[above].needsSupport) w.setBlock(t.x, t.y + 1, t.z, 0);
  afterEdit(t.x, t.z);
}

function placeBlock() {
  const t = game.target, id = game.hotbar[game.sel];
  if (!t || !id) return;
  game.swing = 1;
  const w = game.world;
  let x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
  if (t.id === B.short_grass) { x = t.x; y = t.y; z = t.z; }
  const cur = w.getBlock(x, y, z);
  if (cur && cur !== B.water && cur !== B.short_grass) return;
  if (BLOCKS[id].needsSupport && !OPAQUE[w.getBlock(x, y - 1, z)]) return;
  if (SOLID[id]) {
    const b = game.player.box();
    if (x < b.x1 && x + 1 > b.x0 && y < b.y1 && y + 1 > b.y0 && z < b.z1 && z + 1 > b.z0) return;
  }
  if (w.setBlock(x, y, z, id)) afterEdit(x, z);
}

function pickBlock() {
  const t = game.target;
  if (!t || !BLOCKS[t.id].inv) return;
  const i = game.hotbar.indexOf(t.id);
  if (i >= 0) selectSlot(i);
  else { game.hotbar[game.sel] = t.id; selectSlot(game.sel); }
}

// Inventory: click a block to put it in the selected hotbar slot
document.getElementById('inv-grid').addEventListener('click', e => {
  const cell = e.target.closest('.inv-cell');
  if (!cell) return;
  game.hotbar[game.sel] = +cell.dataset.id;
  selectSlot(game.sel);
});

// ---------- Menus ----------
const $ = id => document.getElementById(id);
$('btn-play').addEventListener('click', () => { if (game.spawnReady === true) startPlaying(); });
$('btn-new').addEventListener('click', () => {
  if (store.get(SAVE_KEY) && !confirm('Создать новый мир? Текущий мир будет удалён.')) return;
  store.del(SAVE_KEY);
  newWorld((Math.random() * 2147483647) | 0, null);
});
$('btn-resume').addEventListener('click', startPlaying);
$('btn-quit').addEventListener('click', () => { saveGame(); setState('title'); });
for (const id of ['btn-help', 'btn-help2']) $(id).addEventListener('click', () => { game.helpFrom = game.state; setState('help'); });
$('btn-help-back').addEventListener('click', () => setState(game.helpFrom));

function bindSlider(id, key, fmt, apply) {
  const el = $(id), out = $(id + '-v');
  el.value = settings[key];
  out.textContent = fmt(settings[key]);
  el.addEventListener('input', () => {
    settings[key] = +el.value;
    out.textContent = fmt(settings[key]);
    store.set(SETTINGS_KEY, settings);
    apply && apply();
  });
}
bindSlider('s-rd', 'renderDistance', v => `${v} чанков`, () => game.chunks.setRadius(settings.renderDistance));
bindSlider('s-fov', 'fov', v => (v === 70 ? 'Нормальное (70)' : v));
bindSlider('s-sens', 'sensitivity', v => `${Math.round(v * 100)}%`);
const bobBtn = $('btn-bob');
const bobText = () => { bobBtn.textContent = `Покачивание камеры: ${settings.bobbing ? 'ВКЛ' : 'ВЫКЛ'}`; };
bobText();
bobBtn.addEventListener('click', () => { settings.bobbing = !settings.bobbing; store.set(SETTINGS_KEY, settings); bobText(); });

window.addEventListener('beforeunload', () => { if (game.state !== 'title') saveGame(); });
setInterval(() => { if (game.state === 'playing') saveGame(); }, 30000);

// ---------- Tick ----------
function tick() {
  game.ticks++;
  game.time = (game.time + 1) % DAY_TICKS;
  const p = game.player;
  if (game.state === 'playing') {
    inp.forward = keys.has('KeyW'); inp.back = keys.has('KeyS');
    inp.left = keys.has('KeyA'); inp.right = keys.has('KeyD');
    inp.jump = keys.has('Space');
    inp.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    inp.sprint = sprintLatch || keys.has('ControlLeft') || keys.has('KeyR');
    p.tick(inp);
    if (p.pos.y < -64) { p.setPos(p.pos.x, game.world.topSolidY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 1, p.pos.z); }
    if (mouseL && --game.breakCd <= 0) { breakBlock(); game.breakCd = 5; }
    if (mouseR && --game.placeCd <= 0) { placeBlock(); game.placeCd = 4; }
  } else {
    p.prev = { ...p.pos };
    p.prevLimbPos = p.limbPos;
  }
  game.prevSwing = game.swing;
  game.swing = Math.max(0, game.swing - 1 / 6);
  particles.tick(game.world);
}

// Wait for terrain under the spawn point before letting the player fall
function checkSpawn() {
  const p = game.player;
  const cx = Math.floor(p.pos.x) >> 4, cz = Math.floor(p.pos.z) >> 4;
  const c = game.world.getChunk(cx, cz);
  if (!c || c.dirty) return;
  if (game.spawnReady === 'find') {
    const y = game.world.topSolidY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 1;
    p.setPos(p.pos.x, y, p.pos.z);
  }
  game.spawnReady = true;
  const btn = $('btn-play');
  btn.disabled = false;
  btn.textContent = 'Играть';
}

// ---------- Frame ----------
const clock = { last: performance.now(), acc: 0, fps: 0, frames: 0, fpsT: 0 };
const lerp = (a, b, t) => a + (b - a) * t;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - clock.last) / 1000);
  clock.last = now;
  clock.frames++;
  if (now - clock.fpsT > 1000) { clock.fps = clock.frames; clock.frames = 0; clock.fpsT = now; }

  const p = game.player;
  if (game.spawnReady !== true) checkSpawn();

  if (game.spawnReady === true && game.state !== 'title') {
    clock.acc += dt * 1000;
    let n = 0;
    while (clock.acc >= TICK_MS && n < 10) { tick(); clock.acc -= TICK_MS; n++; }
    if (n === 10) clock.acc = 0;
  } else {
    clock.acc += dt * 1000;
    while (clock.acc >= TICK_MS) { game.ticks++; game.time = (game.time + 1) % DAY_TICKS; clock.acc -= TICK_MS; }
  }
  const a = clock.acc / TICK_MS;

  game.chunks.update(p.pos.x, p.pos.z, game.spawnReady === true ? 6 : 14);

  // Interpolated player position
  const ix = lerp(p.prev.x, p.pos.x, a), iy = lerp(p.prev.y, p.pos.y, a), iz = lerp(p.prev.z, p.pos.z, a);
  const eye = lerp(p.prevEye, p.eye, a);
  const t = now / 1000;

  // Camera
  let fovTarget = settings.fov;
  if (game.state === 'title') {
    const ang = t * 0.12;
    const camX = ix + Math.sin(ang) * 3.4, camZ = iz + Math.cos(ang) * 3.4;
    const ground = game.world.topSolidY(Math.floor(camX), Math.floor(camZ)) + 1.4;
    const camY = Math.max(iy + 1.5, ground);
    game.titleCamY = game.titleCamY == null ? camY : lerp(game.titleCamY, camY, Math.min(1, dt * 2));
    camera.position.set(camX, game.titleCamY, camZ);
    camera.lookAt(ix, iy + 1.0, iz);
  } else {
    camera.rotation.set(p.pitch, p.yaw, 0);
    camera.position.set(ix, iy + eye, iz);
    if (game.camMode === 0 && settings.bobbing) {
      const wd = lerp(p.prevWalkDist, p.walkDist, a), bob = lerp(p.prevBob, p.bob, a);
      camera.rotation.z = Math.sin(wd * Math.PI) * bob * 3 * Math.PI / 180;
      camera.rotation.x -= Math.abs(Math.cos(wd * Math.PI - 0.2) * bob) * 5 * Math.PI / 180;
      camera.translateX(Math.sin(wd * Math.PI) * bob * 0.5);
      camera.translateY(-Math.abs(Math.cos(wd * Math.PI) * bob));
    } else if (game.camMode !== 0) {
      const dir = new THREE.Vector3(0, 0, game.camMode === 1 ? 1 : -1).applyEuler(camera.rotation);
      let dist = 4;
      for (let d = 0.2; d <= 4; d += 0.1) {
        const q = camera.position.clone().addScaledVector(dir, d);
        if (OPAQUE[game.world.getBlock(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z))]) { dist = Math.max(0.3, d - 0.3); break; }
      }
      camera.position.addScaledVector(dir, dist);
      if (game.camMode === 2) camera.rotation.set(-p.pitch, p.yaw + Math.PI, 0);
    }
    if (p.flying) fovTarget *= 1.1;
    if (p.sprinting) fovTarget *= 1.15;
  }
  game.fov += (fovTarget - game.fov) * Math.min(1, dt * 12);
  camera.fov = game.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // Sky, fog, lighting
  const R = game.chunks.R * 16;
  sky.update(camera, game.time, game.ticks + a, R);
  const u = terrain.shared;
  u.uSkyDarken.value = sky.skyDarken;
  const underwater = game.state !== 'title' && p.eyeInWater(camera.position.y);
  if (underwater) {
    u.uFogColor.value.setRGB(0.02 + 0.05 * sky.daylight, 0.05 + 0.12 * sky.daylight, 0.2 + 0.3 * sky.daylight);
    u.uFogNear.value = 0; u.uFogFar.value = 18;
  } else {
    u.uFogColor.value.copy(sky.fogColor);
    u.uFogFar.value = R - 8; u.uFogNear.value = (R - 8) * 0.6;
  }
  renderer.setClearColor(u.uFogColor.value);

  // Target block + outline
  game.target = game.state === 'playing' || game.state === 'inventory' ? raycast() : null;
  if (game.target && game.camMode !== 2) {
    const tg = game.target, sh = SHAPE[tg.id];
    outline.visible = true;
    if (sh === 2) { outline.scale.set(0.3, 0.64, 0.3); outline.position.set(tg.x + 0.5, tg.y + 0.32, tg.z + 0.5); }
    else if (sh === 1) { outline.scale.set(0.8, 0.8, 0.8); outline.position.set(tg.x + 0.5, tg.y + 0.4, tg.z + 0.5); }
    else { outline.scale.set(1, 1, 1); outline.position.set(tg.x + 0.5, tg.y + 0.5, tg.z + 0.5); }
  } else outline.visible = false;

  // Tepa model
  const bright = brightnessAt(ix, iy + 1, iz);
  ambient.intensity = 1.9 * bright;
  sun.intensity = 1.4 * bright;
  tepa.visible = game.state === 'title' || game.camMode !== 0;
  tepa.position.set(ix, iy, iz);
  tepa.rotation.y = p.yaw;
  animateTepa(tepa, {
    limbPos: lerp(p.prevLimbPos, p.limbPos, a), limbAmt: lerp(p.prevLimbAmt, p.limbAmt, a),
    pitch: game.state === 'title' ? 0.1 : p.pitch,
    flying: game.state === 'title' ? false : p.flying,
    onGround: game.state === 'title' ? true : p.onGround,
    inWater: p.inWater, t,
  }, dt);

  particles.update(camera, a);

  renderer.clear();
  renderer.render(scene, camera);

  // First-person hand
  if (game.state !== 'title' && game.camMode === 0) {
    const sw = lerp(game.prevSwing, game.swing, a), sp = Math.sin(Math.sqrt(1 - sw) * Math.PI) * (sw > 0 ? 1 : 0);
    const wd = lerp(p.prevWalkDist, p.walkDist, a), bob = settings.bobbing ? lerp(p.prevBob, p.bob, a) : 0;
    const handX = Math.min(0.5, 0.8 * Math.tan(35 * Math.PI / 180) * handCamera.aspect * 0.85);
    hand.position.set(handX + Math.sin(wd * Math.PI) * bob * 0.5 - sp * 0.12, -0.42 - Math.abs(Math.cos(wd * Math.PI) * bob) + sp * 0.08, -0.8 - sp * 0.15);
    hand.rotation.set(-sp * 0.8, -0.3 + sp * 0.35, 0);
    paw.position.set(0.03, -0.44, 0.58);
    paw.rotation.set(-1.15, 0, 0);
    held.position.set(0, 0.02, -0.04);
    held.rotation.set(0.1, 0.78, 0);
    held.scale.setScalar(SHAPE[game.hotbar[game.sel]] ? 0.3 : 0.22);
    heldMat.color.setScalar(bright);
    paw.traverse(o => { if (o.material) o.material.forEach(m => m.color.setScalar(bright)); });
    renderer.clearDepth();
    renderer.render(handScene, handCamera);
  }

  // Debug screen (F3)
  if (game.debug && game.state !== 'title') {
    const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y), bz = Math.floor(p.pos.z);
    const [sl, bl] = game.world.getLight(bx, by, bz);
    const yawDeg = ((-p.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180;
    const facing = ['север (-Z)', 'восток (+X)', 'юг (+Z)', 'запад (-X)'][Math.round(((yawDeg + 360) % 360) / 90) % 4];
    const st = game.chunks.stats();
    const col = game.world.gen.column(bx, bz);
    ui.setDebug([
      `Super Тёпа v${VERSION} (${clock.fps} fps)`,
      `Чанки: ${st.meshed} отрисовано / ${st.loaded} загружено`,
      ``,
      `XYZ: ${p.pos.x.toFixed(3)} / ${p.pos.y.toFixed(5)} / ${p.pos.z.toFixed(3)}`,
      `Блок: ${bx} ${by} ${bz}   Чанк: ${bx >> 4} ${bz >> 4}`,
      `Смотрит: ${facing} (${yawDeg.toFixed(1)} / ${(p.pitch * 180 / Math.PI).toFixed(1)})`,
      `Биом: ${BIOME_NAMES[col.biome]}`,
      `Свет: небо ${sl}, блоки ${bl}`,
      `Скорость: ${p.speed.toFixed(3)} м/с   vY: ${(p.vel.y * 20).toFixed(3)} м/с`,
      `На земле: ${p.onGround ? 'да' : 'нет'}  Полёт: ${p.flying ? 'да' : 'нет'}  Бег: ${p.sprinting ? 'да' : 'нет'}  Присед: ${p.sneaking ? 'да' : 'нет'}  Вода: ${p.inWater ? 'да' : 'нет'}`,
      `Время: ${Math.floor(game.time)} (день ${Math.floor(game.ticks / DAY_TICKS) + 1})`,
      game.target ? `Цель: ${BLOCKS[game.target.id].name} ${game.target.x} ${game.target.y} ${game.target.z}` : '',
    ].join('\n'));
  } else ui.setDebug(null);
}

// ---------- Boot ----------
const saved = store.get(SAVE_KEY);
newWorld(saved?.seed ?? ((Math.random() * 2147483647) | 0), saved);
setState('title');
requestAnimationFrame(frame);

// Test hooks (used for automated checks)
game.input = { keys, inp };
game.setKey = (code, down) => { if (down) keys.add(code); else keys.delete(code); };
game.play = () => setState('playing');
game.breakBlock = breakBlock;
game.placeBlock = placeBlock;
