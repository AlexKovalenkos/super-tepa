// Tepa: a brown dog with yellow butterfly wings, built like a Minecraft mob
// (boxes measured in 1/16-block "pixels", pixel-art skin painted in code).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const C = {
  fur: [176, 104, 52], furDark: [146, 82, 40], furLight: [196, 128, 70],
  ear: [104, 56, 34], earIn: [84, 44, 28],
  tan: [236, 192, 150], tanDark: [214, 166, 124],
  leg: [150, 86, 42], paw: [120, 68, 36],
  eye: [22, 18, 18], eyeHi: [255, 255, 255], nose: [30, 24, 24], mouth: [120, 70, 50],
};

function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = (x, y, c, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = a;
  };
  paint(px, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// Mottled fur, like the reference drawing
function fur(seed, base = C.fur, dark = C.furDark, light = C.furLight) {
  return (px, w, h) => {
    const rnd = mulberry32(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = rnd();
      const c = r < 0.16 ? dark : r < 0.3 ? light : base;
      const n = (rnd() - 0.5) * 10;
      px(x, y, [c[0] + n, c[1] + n, c[2] + n]);
    }
  };
}
const flat = (c, seed = 1) => fur(seed, c, c.map(v => v - 14), c.map(v => v + 10));

// Box of w x h x d pixels. faces: {px,nx,py,ny,pz,nz} painters (front of the dog is -z = 'nz').
function box(w, h, d, faces, def) {
  const dims = { px: [d, h], nx: [d, h], py: [w, d], ny: [w, d], pz: [w, h], nz: [w, h] };
  const mats = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(f => {
    const [tw, th] = dims[f];
    const paint = faces[f] || def;
    return new THREE.MeshLambertMaterial({ map: canvasTex(Math.max(1, Math.round(tw)), Math.max(1, Math.round(th)), paint) });
  });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// 13 x 11 butterfly wing (row 0 = wing tip, last row = hinge; left columns = front)
const WING = [
  '....OOOO.....',
  '..OOYYYYO..OO',
  '.OYYLBYYYOOYO',
  'OYYBDBYLYOYBO',
  'OYLYBYYYYOBDO',
  'OYYYYYBYYOYBO',
  '.OYBYYDBYOYYO',
  '.OYDBYYBYOYO.',
  '..OYYYYYYYO..',
  '...OYYYYYO...',
  '....OYYYO....',
];
const WING_COL = { O: [214, 140, 24], Y: [252, 212, 44], L: [255, 242, 140], B: [74, 124, 214], D: [40, 72, 160] };

function wingMesh() {
  const W = WING[0].length, Hh = WING.length;
  const tex = canvasTex(W, Hh, px => {
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const ch = WING[y][W - 1 - x]; // texture u runs back->front after rotation
      if (ch === '.') px(x, y, [0, 0, 0], 0); else px(x, y, WING_COL[ch]);
    }
  });
  const g = new THREE.PlaneGeometry(W, Hh);
  g.translate(0, Hh / 2, 0);
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5 }));
  return m;
}

export function createTepa(scale = 1.1) {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(scale / 16);
  root.add(model);
  const parts = {};

  // Body
  const bodyPaint = fur(11);
  const body = box(8, 7, 16, {
    ny: flat(C.tan, 3),
    nz: (px, w, h) => { bodyPaint(px, w, h); for (let y = 2; y < h; y++) for (let x = 2; x < w - 2; x++) px(x, y, C.tan); },
  }, bodyPaint);
  body.position.set(0, 11.5, 1);
  model.add(body);
  parts.body = body;

  // Legs (hips at y=8)
  const legPaint = (px, w, h) => { fur(21, C.leg, C.paw, C.fur)(px, w, h); for (let x = 0; x < w; x++) { px(x, h - 1, C.paw); px(x, h - 2, C.paw); } };
  const legs = [];
  for (const [x, z] of [[-2.5, -5], [2.5, -5], [-2.5, 6], [2.5, 6]]) {
    const p = pivot(model, x, 8, z);
    const m = box(3, 8, 3, { ny: flat(C.paw, 5), py: flat(C.leg, 6) }, legPaint);
    m.position.y = -4;
    p.add(m);
    legs.push(p);
  }
  parts.legs = legs; // FL, FR, BL, BR

  // Head (neck pivot at the top-front of the body)
  const head = pivot(model, 0, 14, -7);
  parts.head = head;
  const headPaint = fur(31);
  const headBox = box(8, 8, 7, {
    nz: (px, w, h) => {
      headPaint(px, w, h);
      for (let y = 5; y < h; y++) for (let x = 1; x < w - 1; x++) px(x, y, C.tan);
      for (const ex of [1, 5]) {
        px(ex, 2, C.eyeHi); px(ex + 1, 2, C.eye); px(ex, 3, C.eye); px(ex + 1, 3, C.eye);
        px(ex, 1, C.furDark); px(ex + 1, 1, C.furDark);
      }
    },
  }, headPaint);
  headBox.position.set(0, 3, -3.5);
  head.add(headBox);

  const snout = box(4, 3, 3, {
    nz: (px) => {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) px(x, y, C.tan);
      px(1, 0, C.nose); px(2, 0, C.nose);
      px(0, 2, C.tanDark); px(1, 2, C.mouth); px(2, 2, C.mouth); px(3, 2, C.tanDark);
    },
    py: (px) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) px(x, y, C.tan); px(1, 0, C.nose); px(2, 0, C.nose); },
  }, flat(C.tan, 7));
  snout.position.set(0, 0.5, -8.5);
  head.add(snout);

  // Floppy ears hanging at the sides of the head
  const ears = [];
  for (const s of [-1, 1]) {
    const p = pivot(head, s * 4.6, 7, -4);
    const e = box(1.2, 6, 3, {}, flat(C.ear, 40 + s));
    e.position.y = -3;
    p.add(e);
    p.rotation.z = s * 0.12;
    ears.push(p);
  }
  parts.ears = ears;

  // Curly tail: base goes up and back, then curls over
  const tail = pivot(model, 0, 14, 9);
  const t1 = box(2, 2, 5, {}, fur(51));
  t1.position.z = 2.5;
  tail.add(t1);
  tail.rotation.x = -0.9;
  const tail2 = pivot(tail, 0, 0, 5);
  const t2 = box(2, 2, 3, {}, fur(52));
  t2.position.z = 1.5;
  tail2.add(t2);
  tail2.rotation.x = -1.3;
  const tail3 = pivot(tail2, 0, 0, 3);
  const t3 = box(2, 2, 2, {}, flat(C.furDark, 53));
  t3.position.z = 1;
  tail3.add(t3);
  tail3.rotation.x = -1.2;
  parts.tail = tail;

  // Butterfly wings hinged along the top of the back
  const wings = [];
  for (const s of [-1, 1]) {
    const p = pivot(model, s * 1.5, 15, -1);
    p.add(wingMesh());
    wings.push({ p, s });
  }
  parts.wings = wings;

  root.userData.parts = parts;
  root.userData.wingAngle = 0.5;
  return root;
}

// s: { limbPos, limbAmt, pitch, flying, onGround, inWater, t }
export function animateTepa(root, s, dt) {
  const P = root.userData.parts;
  const sw = s.limbPos * 0.6662, amt = s.limbAmt;
  const [fl, fr, bl, br] = P.legs;
  if (s.flying) {
    const w = Math.sin(s.t * 3) * 0.08;
    fl.rotation.x = fr.rotation.x = 0.9 + w;
    bl.rotation.x = br.rotation.x = -0.9 - w;
  } else {
    fl.rotation.x = Math.cos(sw) * 1.4 * amt;
    br.rotation.x = Math.cos(sw) * 1.4 * amt;
    fr.rotation.x = Math.cos(sw + Math.PI) * 1.4 * amt;
    bl.rotation.x = Math.cos(sw + Math.PI) * 1.4 * amt;
  }
  P.head.rotation.x = Math.max(-0.8, Math.min(0.8, s.pitch));
  P.tail.rotation.y = Math.sin(s.t * 11) * 0.35 * (0.5 + amt);
  const earBack = s.flying ? -0.7 : 0;
  for (const e of P.ears) e.rotation.x += ((earBack + Math.sin(sw) * 0.15 * amt) - e.rotation.x) * Math.min(1, dt * 10);

  // Wings: resting raised over the back, flapping in flight, half-open when falling
  let target;
  if (s.flying) target = 0.8 + Math.sin(s.t * 16) * 0.6;
  else if (!s.onGround && !s.inWater) target = 1.0 + Math.sin(s.t * 10) * 0.25;
  else target = 0.5 + Math.sin(s.t * 1.6) * 0.05;
  const k = s.flying ? 1 : Math.min(1, dt * 8);
  root.userData.wingAngle += (target - root.userData.wingAngle) * k;
  for (const { p, s: side } of P.wings) {
    p.rotation.z = -side * root.userData.wingAngle;
    p.rotation.y = side * 0.12;
  }
}

// First-person paw
export function createPaw() {
  const g = new THREE.Group();
  const legPaint = (px, w, h) => { fur(61, C.leg, C.paw, C.fur)(px, w, h); for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) px(x, y, C.tan); };
  const m = box(4, 12, 4, { py: flat(C.tan, 62) }, legPaint);
  m.position.y = 6;
  g.add(m);
  g.scale.setScalar(1 / 16);
  return g;
}
