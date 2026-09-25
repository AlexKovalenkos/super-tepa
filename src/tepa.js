// Dogs: Tepa (brown dog with yellow butterfly wings) and the magic dogs that share her body plan.
// Built like a Minecraft mob: boxes measured in 1/16-block pixels with pixel-art skins.
import * as THREE from 'three';
import { box, fur, flat, over, pivot, parts, gridPlane } from './modelkit.js';

export const TEPA_PALETTE = {
  fur: [176, 104, 52], furDark: [146, 82, 40], furLight: [196, 128, 70],
  ear: [104, 56, 34], tan: [236, 192, 150], tanDark: [214, 166, 124],
  leg: [150, 86, 42], paw: [120, 68, 36],
  eye: [22, 18, 18], eyeHi: [255, 255, 255], nose: [30, 24, 24], mouth: [120, 70, 50],
};

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
export const TEPA_WING = { O: [214, 140, 24], Y: [252, 212, 44], L: [255, 242, 140], B: [74, 124, 214], D: [40, 72, 160] };

function wingMesh(colors, emissive) {
  const { geometry, material, H } = gridPlane(WING, colors, { flipX: true, emissive });
  geometry.translate(0, H / 2, 0);
  geometry.rotateY(Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

// opts: { palette, wings: colors | null (no wings), scale, glow, seed }
export function createDog(opts = {}) {
  const C = { ...TEPA_PALETTE, ...(opts.palette || {}) };
  const seed = opts.seed || 11;
  const matOpts = opts.glow ? { emissive: new THREE.Color(0.55, 0.55, 0.55) } : {};
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.name = 'model';
  model.scale.setScalar((opts.scale ?? 1.1) / 16);
  root.add(model);

  const bodyPaint = fur(seed, C.fur, C.furDark, C.furLight);
  const body = box(8, 7, 16, {
    ny: flat(C.tan, 3),
    nz: over(bodyPaint, px => { for (let y = 2; y < 7; y++) for (let x = 2; x < 6; x++) px(x, y, C.tan); }),
  }, bodyPaint, matOpts);
  body.position.set(0, 11.5, 1);
  model.add(body);

  const legPaint = over(fur(seed + 10, C.leg, C.paw, C.fur), (px, w, h) => { for (let x = 0; x < w; x++) { px(x, h - 1, C.paw); px(x, h - 2, C.paw); } });
  ['legFL', 'legFR', 'legBL', 'legBR'].forEach((n, i) => {
    const p = pivot(model, i % 2 ? 2.5 : -2.5, 8, i < 2 ? -5 : 6, n);
    const m = box(3, 8, 3, { ny: flat(C.paw, 5), py: flat(C.leg, 6) }, legPaint, matOpts);
    m.position.y = -4;
    p.add(m);
  });

  const head = pivot(model, 0, 14, -7, 'head');
  const headPaint = fur(seed + 20, C.fur, C.furDark, C.furLight);
  const headBox = box(8, 8, 7, {
    nz: over(headPaint, px => {
      for (let y = 5; y < 8; y++) for (let x = 1; x < 7; x++) px(x, y, C.tan);
      for (const ex of [1, 5]) {
        px(ex, 2, C.eyeHi); px(ex + 1, 2, C.eye); px(ex, 3, C.eye); px(ex + 1, 3, C.eye);
        px(ex, 1, C.furDark); px(ex + 1, 1, C.furDark);
      }
    }),
  }, headPaint, matOpts);
  headBox.position.set(0, 3, -3.5);
  head.add(headBox);

  const snout = box(4, 3, 3, {
    nz: px => {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) px(x, y, C.tan);
      px(1, 0, C.nose); px(2, 0, C.nose);
      px(0, 2, C.tanDark); px(1, 2, C.mouth); px(2, 2, C.mouth); px(3, 2, C.tanDark);
    },
    py: px => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) px(x, y, C.tan); px(1, 0, C.nose); px(2, 0, C.nose); },
  }, flat(C.tan, 7), matOpts);
  snout.position.set(0, 0.5, -8.5);
  head.add(snout);

  for (const s of [-1, 1]) {
    const p = pivot(head, s * 4.6, 7, -4, s < 0 ? 'earL' : 'earR');
    const e = box(1.2, 6, 3, {}, flat(C.ear, 40 + s), matOpts);
    e.position.y = -3;
    p.add(e);
    p.rotation.z = s * 0.12;
  }

  // Curly tail
  const tail = pivot(model, 0, 14, 9, 'tail');
  const t1 = box(2, 2, 5, {}, fur(seed + 30, C.fur, C.furDark, C.furLight), matOpts);
  t1.position.z = 2.5;
  tail.add(t1);
  tail.rotation.x = -0.9;
  const tail2 = pivot(tail, 0, 0, 5);
  const t2 = box(2, 2, 3, {}, fur(seed + 31, C.fur, C.furDark, C.furLight), matOpts);
  t2.position.z = 1.5;
  tail2.add(t2);
  tail2.rotation.x = -1.3;
  const tail3 = pivot(tail2, 0, 0, 3);
  const t3 = box(2, 2, 2, {}, flat(C.furDark, 53), matOpts);
  t3.position.z = 1;
  tail3.add(t3);
  tail3.rotation.x = -1.2;

  if (opts.wings !== null) {
    const colors = opts.wings || TEPA_WING;
    for (const s of [-1, 1]) {
      const p = pivot(model, s * 1.5, 15, -1, s < 0 ? 'wingL' : 'wingR');
      p.add(wingMesh(colors, !!opts.glow));
    }
  }
  root.userData.wingAngle = 0.5;
  return root;
}

export const createTepa = () => createDog();

const PART_NAMES = ['legFL', 'legFR', 'legBL', 'legBR', 'head', 'tail', 'earL', 'earR', 'wingL', 'wingR'];

// s: { limbPos, limbAmt, pitch, flying, onGround, inWater, t }
export function animateDog(root, s, dt) {
  const P = parts(root, PART_NAMES);
  const sw = s.limbPos * 0.6662, amt = s.limbAmt;
  if (s.flying) {
    const w = Math.sin(s.t * 3) * 0.08;
    P.legFL.rotation.x = P.legFR.rotation.x = 0.9 + w;
    P.legBL.rotation.x = P.legBR.rotation.x = -0.9 - w;
  } else {
    P.legFL.rotation.x = P.legBR.rotation.x = Math.cos(sw) * 1.4 * amt;
    P.legFR.rotation.x = P.legBL.rotation.x = Math.cos(sw + Math.PI) * 1.4 * amt;
  }
  P.head.rotation.x = Math.max(-0.8, Math.min(0.8, s.pitch));
  P.tail.rotation.y = Math.sin(s.t * 11) * 0.35 * (0.5 + amt);
  const earBack = s.flying ? -0.7 : 0;
  for (const e of [P.earL, P.earR]) e.rotation.x += ((earBack + Math.sin(sw) * 0.15 * amt) - e.rotation.x) * Math.min(1, dt * 10);

  if (!P.wingL) return;
  let target;
  if (s.flying) target = 0.8 + Math.sin(s.t * 16) * 0.6;
  else if (!s.onGround && !s.inWater) target = 1.0 + Math.sin(s.t * 10) * 0.25;
  else target = 0.5 + Math.sin(s.t * 1.6) * 0.05;
  const k = s.flying ? 1 : Math.min(1, dt * 8);
  root.userData.wingAngle += (target - root.userData.wingAngle) * k;
  P.wingL.rotation.z = root.userData.wingAngle; P.wingL.rotation.y = -0.12;
  P.wingR.rotation.z = -root.userData.wingAngle; P.wingR.rotation.y = 0.12;
}
export const animateTepa = animateDog;

// First-person paw
export function createPaw() {
  const C = TEPA_PALETTE;
  const g = new THREE.Group();
  const legPaint = over(fur(61, C.leg, C.paw, C.fur), (px, w) => { for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) px(x, y, C.tan); });
  const m = box(4, 12, 4, { py: flat(C.tan, 62) }, legPaint);
  m.position.y = 6;
  g.add(m);
  g.scale.setScalar(1 / 16);
  return g;
}
