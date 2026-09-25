// Minecraft-style passive animals: pig, cow, sheep, chicken, rabbit, fox. Sizes in 1/16-block pixels.
import * as THREE from 'three';
import { box, fur, flat, over, pivot, parts } from './modelkit.js';
import { mulberry32 } from './noise.js';

const EYE = [20, 20, 20], WHITE = [250, 250, 250];

function eyes(px, xs, y) { for (const x of xs) { px(x, y, WHITE); px(x + 1, y, EYE); } }

// Large irregular patches (cow spots)
function patches(seed, a, b) {
  return (px, w, h) => {
    const rnd = mulberry32(seed);
    const blobs = Array.from({ length: 3 }, () => [rnd() * w, rnd() * h, 1.5 + rnd() * 2.5]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inB = blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < r * r);
      const c = inB ? b : a, n = (rnd() - 0.5) * 8;
      px(x, y, [c[0] + n, c[1] + n, c[2] + n]);
    }
  };
}

function legs(model, spec) {
  const [lw, lh, ld] = spec.leg;
  ['legFL', 'legFR', 'legBL', 'legBR'].forEach((n, i) => {
    const p = pivot(model, (i % 2 ? 1 : -1) * spec.legX, lh, i < 2 ? spec.legZf : spec.legZb, n);
    const m = box(lw, lh, ld, spec.legFaces || {}, spec.legPaint);
    m.position.y = -lh / 2;
    p.add(m);
  });
}

function root16() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.name = 'model';
  model.scale.setScalar(1 / 16);
  root.add(model);
  return { root, model };
}

export function createPig() {
  const { root, model } = root16();
  const skin = [240, 164, 164], skinP = fur(201, skin, [224, 144, 150], [250, 184, 186], 0.12);
  legs(model, { leg: [4, 6, 4], legX: 3, legZf: -5, legZb: 6, legPaint: skinP });
  const body = box(10, 8, 16, {}, skinP);
  body.position.set(0, 10, 0.5);
  model.add(body);
  const head = pivot(model, 0, 11, -7, 'head');
  const hb = box(8, 8, 8, { nz: over(skinP, px => eyes(px, [1, 5], 3)) }, skinP);
  hb.position.set(0, 1, -4);
  head.add(hb);
  const sn = box(4, 3, 1, { nz: px => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) px(x, y, [248, 196, 196]); px(1, 1, [160, 90, 100]); px(2, 1, [160, 90, 100]); } }, flat([244, 186, 186], 3));
  sn.position.set(0, 0, -8.5);
  head.add(sn);
  return root;
}

export function createCow() {
  const { root, model } = root16();
  const hide = patches(301, [72, 52, 40], [238, 238, 232]);
  legs(model, { leg: [4, 12, 4], legX: 4, legZf: -6, legZb: 7, legPaint: over(patches(302, [72, 52, 40], [238, 238, 232]), (px, w, h) => { for (let x = 0; x < w; x++) { px(x, h - 1, [60, 50, 45]); px(x, h - 2, [60, 50, 45]); } }) });
  const body = box(12, 10, 18, {}, hide);
  body.position.set(0, 17, 0.5);
  model.add(body);
  const head = pivot(model, 0, 20, -8, 'head');
  const hp = patches(303, [72, 52, 40], [238, 238, 232]);
  const hb = box(8, 8, 6, { nz: over(hp, px => { eyes(px, [1, 5], 3); }) }, hp);
  hb.position.set(0, 0, -3);
  head.add(hb);
  const mu = box(6, 4, 1, { nz: px => { for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) px(x, y, [214, 170, 160]); px(1, 1, [120, 80, 80]); px(4, 1, [120, 80, 80]); } }, flat([214, 170, 160], 4));
  mu.position.set(0, -2, -6.5);
  head.add(mu);
  for (const s of [-1, 1]) {
    const h = box(1, 3, 1, {}, flat([230, 222, 200], 5));
    h.position.set(s * 4.5, 4.5, -2);
    head.add(h);
  }
  return root;
}

export const WOOL_COLORS = [[234, 234, 234], [234, 234, 234], [234, 234, 234], [234, 234, 234], [240, 170, 200], [170, 200, 240], [250, 220, 120], [120, 110, 105]];

export function createSheep(wool = WOOL_COLORS[0]) {
  const { root, model } = root16();
  const woolP = over(fur(401, wool, wool.map(v => v - 18), wool.map(v => Math.min(255, v + 10)), 0.25), (px, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y * 2) % 5 === 0) px(x, y, wool.map(v => v - 10)); });
  const skin = [226, 206, 186];
  legs(model, { leg: [4, 12, 4], legX: 3, legZf: -5, legZb: 6, legPaint: over(flat(skin, 6), (px, w, h) => { for (let y = 0; y < h / 2; y++) for (let x = 0; x < w; x++) px(x, y, wool); }) });
  const body = box(11, 10, 17, {}, woolP);
  body.position.set(0, 17, 0.5);
  model.add(body);
  const head = pivot(model, 0, 19, -8, 'head');
  const face = box(6, 6, 7, { nz: over(flat(skin, 7), px => { eyes(px, [0, 4], 2); px(2, 4, [170, 120, 110]); px(3, 4, [170, 120, 110]); }) }, flat(skin, 8));
  face.position.set(0, 1, -3.5);
  head.add(face);
  const cap = box(7, 3, 5, {}, woolP);
  cap.position.set(0, 4.5, -2.5);
  head.add(cap);
  return root;
}

export function createChicken() {
  const { root, model } = root16();
  const feathers = fur(501, [245, 245, 240], [220, 220, 214], [255, 255, 255], 0.14);
  const orange = [240, 170, 50];
  ['legL', 'legR'].forEach((n, i) => {
    const p = pivot(model, i ? 1.5 : -1.5, 5, 1, n);
    const m = box(1, 5, 1, {}, flat(orange, 9));
    m.position.y = -2.5;
    p.add(m);
    const foot = box(3, 0.5, 3, {}, flat(orange, 10));
    foot.position.set(0, -4.75, -0.5);
    p.add(foot);
  });
  const body = box(6, 6, 8, {}, feathers);
  body.position.set(0, 8, 0);
  model.add(body);
  for (const s of [-1, 1]) {
    const w = pivot(model, s * 3.5, 11, 0, s < 0 ? 'wingL' : 'wingR');
    const m = box(1, 4, 6, {}, feathers);
    m.position.y = -2;
    w.add(m);
  }
  const head = pivot(model, 0, 9, -3.5, 'head');
  const hb = box(4, 6, 3, { nz: over(feathers, px => { px(0, 1, EYE); px(3, 1, EYE); }) }, feathers);
  hb.position.set(0, 3, -1);
  head.add(hb);
  const beak = box(4, 2, 2, {}, flat(orange, 11));
  beak.position.set(0, 3.5, -3.5);
  head.add(beak);
  const wattle = box(2, 2, 1, {}, flat([220, 40, 40], 12));
  wattle.position.set(0, 1.5, -3);
  head.add(wattle);
  return root;
}

export function createRabbit(color = [150, 110, 75]) {
  const { root, model } = root16();
  const furP = fur(601, color, color.map(v => v - 20), color.map(v => v + 16));
  legs(model, { leg: [2, 3, 3], legX: 2, legZf: -3, legZb: 3, legPaint: furP });
  const body = box(6, 5, 8, {}, furP);
  body.position.set(0, 5.5, 0.5);
  model.add(body);
  const tail = box(3, 3, 2, {}, flat([245, 245, 245], 13));
  tail.position.set(0, 6.5, 5);
  model.add(tail);
  const head = pivot(model, 0, 7, -3, 'head');
  const hb = box(5, 5, 5, { nz: over(furP, px => { px(0, 1, EYE); px(4, 1, EYE); px(2, 3, [230, 150, 160]); }) }, furP);
  hb.position.set(0, 1, -2.5);
  head.add(hb);
  for (const s of [-1, 1]) {
    const e = pivot(head, s * 1.3, 3.5, -1.5, s < 0 ? 'earL' : 'earR');
    const m = box(1, 5, 2, { nz: flat([235, 170, 175], 14) }, furP);
    m.position.y = 2.5;
    e.add(m);
  }
  return root;
}

export function createFox(snow = false) {
  const { root, model } = root16();
  const main = snow ? [236, 236, 240] : [226, 124, 52];
  const white = [245, 240, 232], black = [46, 38, 36];
  const furP = fur(701, main, main.map(v => v - 24), main.map(v => Math.min(255, v + 14)));
  legs(model, { leg: [2, 6, 2], legX: 2, legZf: -4, legZb: 5, legPaint: flat(black, 15) });
  const body = box(6, 6, 11, { ny: flat(white, 16), nz: flat(white, 17) }, furP);
  body.position.set(0, 9, 0.5);
  model.add(body);
  const head = pivot(model, 0, 11, -5, 'head');
  const hb = box(8, 6, 6, { nz: over(furP, px => { for (let x = 0; x < 8; x++) for (let y = 3; y < 6; y++) if (x < 2 || x > 5) px(x, y, white); px(1, 2, EYE); px(6, 2, EYE); }) }, furP);
  hb.position.set(0, 1, -3);
  head.add(hb);
  const sn = box(4, 2, 3, { nz: px => { for (let x = 0; x < 4; x++) { px(x, 0, white); px(x, 1, white); } px(1, 0, black); px(2, 0, black); } }, flat(white, 18));
  sn.position.set(0, -0.5, -7.5);
  head.add(sn);
  for (const s of [-1, 1]) {
    const e = box(2, 3, 1, { py: flat(black, 19) }, over(furP, (px, w) => { for (let x = 0; x < w; x++) px(x, 0, black); }));
    e.position.set(s * 2.5, 5.5, -2);
    head.add(e);
  }
  const tail = pivot(model, 0, 10, 6, 'tail');
  const tb = box(4, 4, 9, { pz: flat(white, 20) }, over(furP, (px, w, h) => { for (let y = 0; y < h; y++) for (let x = Math.max(0, w - 2); x < w; x++) px(x, y, white); }));
  tb.position.z = 4.5;
  tail.add(tb);
  tail.rotation.x = 0.35;
  return root;
}

const NAMES = ['legFL', 'legFR', 'legBL', 'legBR', 'legL', 'legR', 'head', 'tail', 'wingL', 'wingR', 'earL', 'earR'];

// s: { limbPos, limbAmt, onGround, t, pitch }
export function animateAnimal(root, kind, s) {
  const P = parts(root, NAMES);
  const sw = s.limbPos * 0.6662, amt = s.limbAmt;
  if (P.legFL) {
    P.legFL.rotation.x = P.legBR.rotation.x = Math.cos(sw) * 1.4 * amt;
    P.legFR.rotation.x = P.legBL.rotation.x = Math.cos(sw + Math.PI) * 1.4 * amt;
  }
  if (P.legL) {
    P.legL.rotation.x = Math.cos(sw) * 1.4 * amt;
    P.legR.rotation.x = Math.cos(sw + Math.PI) * 1.4 * amt;
  }
  if (P.head) P.head.rotation.x = s.pitch || 0;
  if (P.wingL) {
    const f = s.onGround ? 0 : Math.abs(Math.sin(s.t * 18)) * 1.2;
    P.wingL.rotation.z = f; P.wingR.rotation.z = -f;
  }
  if (P.tail && kind === 'fox') P.tail.rotation.y = Math.sin(s.t * 3) * 0.25;
  if (P.earL) { const e = s.onGround ? 0 : -0.4; P.earL.rotation.x = e; P.earR.rotation.x = e; }
}
