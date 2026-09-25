// A big friendly dragon that flies around Tepa: mint-green scales, cream belly, big kind eyes,
// pink back spikes and lavender wings. Built from Minecraft-style boxes.
import * as THREE from 'three';
import { box, fur, flat, over, pivot, canvasTex } from './modelkit.js';

const C = {
  body: [120, 205, 160], dark: [92, 178, 134], light: [152, 226, 186],
  belly: [252, 238, 196], spike: [244, 150, 190], horn: [250, 240, 210],
  cheek: [250, 160, 180], eye: [30, 40, 60], white: [255, 255, 255],
  membrane: [214, 190, 250], rib: [168, 138, 220],
};
const SCALE = 2.5; // one model pixel = 2.5/16 block

const scales = seed => fur(seed, C.body, C.dark, C.light, 0.2);

function membrane(w, d, seed) {
  const tex = canvasTex(w, d, px => {
    for (let x = 0; x < w; x++) {
      const k = (x % 8) / 8;
      const depth = Math.round(d - 1 - Math.sin(Math.PI * k) * (d * 0.3) - (x / w) * d * 0.25);
      for (let z = 0; z < d; z++) {
        if (z > depth) { px(x, z, [0, 0, 0], 0); continue; }
        const rib = x % 8 === 0 || (z === depth);
        const n = ((x * 7 + z * 13 + seed) % 5) * 3;
        px(x, z, rib ? C.rib : [C.membrane[0] - n, C.membrane[1] - n, C.membrane[2] - n]);
      }
    }
  });
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);          // lie flat, texture rows run along +z
  g.translate(w / 2, 0, d / 2);     // hinge at x=0, trailing edge towards +z
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5 }));
}

export function createDragon() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(SCALE / 16);
  root.add(model);
  const P = {};

  const body = box(14, 12, 26, { ny: flat(C.belly, 2) }, scales(1));
  model.add(body);
  for (let i = 0; i < 4; i++) {
    const s = box(3, 4, 3, {}, flat(C.spike, 3 + i));
    s.position.set(0, 7.5, -8 + i * 6);
    model.add(s);
  }

  // Legs tucked under the body while flying
  P.legs = [];
  for (const [x, z] of [[-5, -8], [5, -8], [-5, 8], [5, 8]]) {
    const p = pivot(model, x, -5, z);
    const m = box(5, 9, 5, { ny: flat(C.horn, 7) }, scales(8));
    m.position.y = -4.5;
    p.add(m);
    p.rotation.x = z < 0 ? 0.9 : -0.9;
    P.legs.push(p);
  }

  // Neck and head
  const neck = pivot(model, 0, 3, -13);
  const nb = box(8, 8, 12, { ny: flat(C.belly, 9) }, scales(10));
  nb.position.z = -5;
  neck.add(nb);
  neck.rotation.x = 0.45;
  P.neck = neck;
  const head = pivot(neck, 0, 0, -11);
  const headPaint = scales(11);
  const hb = box(12, 10, 12, {
    nz: over(headPaint, px => {
      // big kind eyes with highlights
      for (const ex of [1, 7]) {
        for (let y = 2; y < 6; y++) for (let x = ex; x < ex + 4; x++) px(x, y, C.eye);
        px(ex, 2, C.white); px(ex + 1, 2, C.white); px(ex, 3, C.white);
        px(ex + 3, 5, [90, 110, 150]);
      }
      for (const cx of [0, 10]) { px(cx, 7, C.cheek); px(cx + 1, 7, C.cheek); }
    }),
    px: over(headPaint, px => { for (let y = 2; y < 5; y++) for (let x = 8; x < 11; x++) px(x, y, C.eye); px(8, 2, C.white); }),
    nx: over(headPaint, px => { for (let y = 2; y < 5; y++) for (let x = 1; x < 4; x++) px(x, y, C.eye); px(3, 2, C.white); }),
  }, headPaint);
  hb.position.set(0, 3, -4);
  head.add(hb);
  const snout = box(8, 6, 8, {
    nz: over(flat(C.light, 12), px => { px(2, 1, C.dark); px(5, 1, C.dark); for (let x = 1; x < 7; x++) px(x, 4, [70, 120, 100]); px(1, 3, [70, 120, 100]); px(6, 3, [70, 120, 100]); }),
    ny: flat(C.belly, 13),
  }, flat(C.light, 14));
  snout.position.set(0, 0, -14);
  head.add(snout);
  for (const s of [-1, 1]) {
    const h = pivot(head, s * 3.5, 8, 0);
    const hm = box(2, 6, 2, {}, flat(C.horn, 15));
    hm.position.y = 3;
    h.add(hm);
    h.rotation.x = 0.6;
    h.rotation.z = -s * 0.25;
  }
  P.head = head;

  // Tail: four segments and a heart-shaped tip
  P.tail = [];
  let parent = model, z = 13;
  [[9, 8, 10], [7, 6, 10], [5, 5, 10], [4, 4, 9]].forEach(([w, h, d], i) => {
    const p = pivot(parent, 0, i === 0 ? -1 : 0, z);
    const m = box(w, h, d, { ny: flat(C.belly, 20 + i) }, scales(24 + i));
    m.position.z = d / 2;
    p.add(m);
    if (i < 3) {
      const s = box(2, 3, 2, {}, flat(C.spike, 30 + i));
      s.position.set(0, h / 2 + 1.5, d / 2);
      p.add(s);
    }
    P.tail.push(p);
    parent = p; z = d;
  });
  const tip = box(8, 1.5, 6, {}, flat(C.spike, 40));
  tip.position.z = 12;
  parent.add(tip);

  // Wings: inner arm + membrane, outer arm + membrane (flap around the body axis)
  P.wings = [];
  for (const s of [-1, 1]) {
    const inner = pivot(model, s * 7, 5, -6);
    const bone = box(24, 3, 3, {}, scales(50));
    bone.position.x = s * 12;
    inner.add(bone);
    const mem = membrane(24, 18, 1);
    if (s < 0) mem.scale.x = -1;
    mem.position.z = 1;
    inner.add(mem);
    const outer = pivot(inner, s * 24, 0, 0);
    const bone2 = box(18, 2, 2, {}, scales(51));
    bone2.position.x = s * 9;
    outer.add(bone2);
    const mem2 = membrane(18, 14, 2);
    if (s < 0) mem2.scale.x = -1;
    mem2.position.z = 1;
    outer.add(mem2);
    P.wings.push({ inner, outer, s });
  }

  root.userData.P = P;
  return root;
}

const tmp = new THREE.Vector3();

export class Dragon {
  constructor(scene) {
    this.root = createDragon();
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.retarget = 0;
    this.yaw = 0; this.bank = 0; this.pitch = 0;
    this.phase = 0;
    this.flyby = false;
    this.placed = false;
  }

  place(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, -4);
    this.retarget = 0;
    this.placed = true;
  }

  ground(world, x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    return world.getChunk(xi >> 4, zi >> 4) ? world.topSolidY(xi, zi) : world.gen.column(xi, zi).h;
  }

  // onFlyby(x, y, z) is called now and then while passing close to the player
  update(dt, t, player, world, onFlyby) {
    const P = player.pos;
    if (!this.placed) this.place(P.x + 30, P.y + 25, P.z + 30);
    tmp.set(P.x - this.pos.x, P.y - this.pos.y, P.z - this.pos.z);
    const toPlayer = tmp.length();
    if (toPlayer > 110) { this.place(P.x - 60, P.y + 30, P.z - 60); }

    this.retarget -= dt;
    if (this.retarget <= 0 || this.pos.distanceTo(this.target) < 4) {
      this.flyby = Math.random() < 0.25;
      const a = Math.random() * Math.PI * 2;
      const r = this.flyby ? 5 + Math.random() * 3 : 16 + Math.random() * 16;
      const tx = P.x + Math.cos(a) * r, tz = P.z + Math.sin(a) * r;
      const ty = this.flyby ? Math.max(P.y + 5, this.ground(world, tx, tz) + 6) : Math.max(this.ground(world, tx, tz) + 14, P.y + 8) + Math.random() * 8;
      this.target.set(tx, ty, tz);
      this.retarget = 6 + Math.random() * 5;
    }

    const speed = toPlayer > 45 ? 16 : this.flyby ? 10 : 8;
    tmp.subVectors(this.target, this.pos).normalize().multiplyScalar(speed);
    this.vel.lerp(tmp, Math.min(1, dt * 0.8));
    // Keep clear of the ground (look ahead)
    const ax = this.pos.x + this.vel.x * 1.5, az = this.pos.z + this.vel.z * 1.5;
    const minY = Math.max(this.ground(world, ax, az), this.ground(world, this.pos.x, this.pos.z)) + 7;
    if (this.pos.y < minY) this.vel.y += (minY - this.pos.y) * dt * 3;
    this.pos.addScaledVector(this.vel, dt);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    const yawT = Math.atan2(-this.vel.x, -this.vel.z);
    let dy = yawT - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const turn = Math.max(-1.5, Math.min(1.5, dy * 2)) * dt;
    this.yaw += turn;
    this.bank += ((turn / Math.max(dt, 1e-3)) * 0.35 - this.bank) * Math.min(1, dt * 3);
    this.pitch += (Math.max(-0.45, Math.min(0.45, Math.atan2(this.vel.y, hs))) - this.pitch) * Math.min(1, dt * 3);

    this.root.position.copy(this.pos);
    this.root.rotation.set(this.pitch, this.yaw, -this.bank, 'YXZ');

    // Wings: strong flaps when climbing, slower when cruising, gliding when descending
    const climbing = this.vel.y > 1;
    const gliding = this.vel.y < -1.5;
    this.phase += dt * (climbing ? 5 : gliding ? 1.2 : 2.8);
    const amp = gliding ? 0.15 : 0.65;
    const P2 = this.root.userData.P;
    for (const w of P2.wings) {
      w.inner.rotation.z = -w.s * (Math.sin(this.phase) * amp + 0.05);
      w.outer.rotation.z = -w.s * (Math.sin(this.phase - 0.7) * amp * 0.8);
    }
    P2.tail.forEach((p, i) => { p.rotation.y = Math.sin(t * 1.6 - i * 0.7) * 0.2 - this.bank * 0.25; p.rotation.x = Math.sin(t * 1.1 - i) * 0.06; });
    P2.neck.rotation.x = 0.45 - this.pitch * 0.5 + Math.sin(t * 1.3) * 0.05;
    P2.head.rotation.x = -0.35;

    if (toPlayer < 9 && onFlyby && Math.random() < dt * 3) {
      tmp.set(0, 0, -6).applyEuler(this.root.rotation).add(this.pos);
      onFlyby(tmp.x, tmp.y + 1, tmp.z);
    }
  }
}
