// A friendly blue whale that swims around the castle moat, surfaces now and then
// and blows a big fountain of water from its blowhole.
import * as THREE from 'three';
import { box, fur, flat, over, pivot } from './modelkit.js';
import { TILE } from './textures.js';

const C = {
  blue: [74, 116, 196], dark: [52, 88, 164], light: [98, 140, 214],
  belly: [226, 234, 244], groove: [196, 208, 224], eye: [20, 24, 40], white: [255, 255, 255], mouth: [40, 60, 110],
};
const SCALE = 3; // one model pixel = 3/16 block

function createWhaleModel() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(SCALE / 16);
  root.add(model);
  const skin = fur(801, C.blue, C.dark, C.light, 0.14);
  const side = front => over(skin, (px, w, h) => {
    // eye near the front, a long friendly smile and a light belly strip
    const ex = front === 'right' ? w - 6 : 5;
    px(ex, 4, C.white); px(ex + (front === 'right' ? -1 : 1), 4, C.eye); px(ex, 5, C.eye); px(ex + (front === 'right' ? -1 : 1), 5, C.eye);
    for (let i = 0; i < 9; i++) px(front === 'right' ? w - 1 - i : i, 7 - (i > 6 ? 1 : 0), C.mouth);
    for (let x = 0; x < w; x++) { px(x, h - 1, C.belly); px(x, h - 2, C.belly); }
  });
  const body = box(12, 10, 28, {
    px: side('right'), nx: side('left'),
    ny: over(flat(C.belly, 2), (px, w, h) => { for (let y = 0; y < h; y += 3) for (let x = 2; x < w - 2; x++) px(x, y, C.groove); }),
    nz: over(skin, (px, w, h) => { for (let x = 1; x < w - 1; x++) px(x, 7, C.mouth); for (let y = 8; y < h; y++) for (let x = 0; x < w; x++) px(x, y, C.belly); }),
    py: over(skin, px => { px(5, 6, C.dark); px(6, 6, C.dark); }), // blowhole
  }, skin);
  model.add(body);

  // Flippers
  const fins = [];
  for (const s of [-1, 1]) {
    const p = pivot(model, s * 6, -2, -6);
    const f = box(8, 2, 5, { ny: flat(C.belly, 3) }, fur(802, C.blue, C.dark, C.light));
    f.position.x = s * 4;
    p.add(f);
    p.rotation.z = s * -0.5;
    fins.push({ p, s });
  }

  // Tail with horizontal flukes (whales wave their tails up and down)
  const tail = pivot(model, 0, 0, 14);
  const peduncle = box(7, 6, 10, { ny: flat(C.belly, 4) }, fur(803, C.blue, C.dark, C.light));
  peduncle.position.z = 5;
  tail.add(peduncle);
  const flukeP = pivot(tail, 0, 0, 10);
  const fluke = box(20, 2, 7, {}, fur(804, C.blue, C.dark, C.light));
  fluke.position.z = 3;
  flukeP.add(fluke);

  root.userData = { fins, tail, flukeP };
  return root;
}

export class Whale {
  constructor(scene, particles) {
    this.root = createWhaleModel();
    this.root.visible = false;
    scene.add(this.root);
    this.fx = particles;
    this.s = 0;          // position along the moat loop
    this.yaw = 0;
    this.depth = 0;      // 0 = cruising under water, 1 = surfaced
    this.phase = 'swim';
    this.timer = 12;
    this.spout = 0;
  }

  // Square loop along the middle of the moat (half size h), counter-clockwise seen from above
  pathAt(s, h) {
    const P = 8 * h;
    s = ((s % P) + P) % P;
    const side = Math.floor(s / (2 * h)), u = (s % (2 * h)) - h;
    switch (side) {
      case 0: return { x: u, z: h, dx: 1, dz: 0 };
      case 1: return { x: h, z: -u, dx: 0, dz: -1 };
      case 2: return { x: -u, z: -h, dx: -1, dz: 0 };
      default: return { x: -h, z: u, dx: 0, dz: 1 };
    }
  }

  update(dt, t, castle, playerPos, moatMid) {
    if (!castle) return;
    const dist = Math.hypot(playerPos.x - castle.x, playerPos.z - castle.z);
    this.root.visible = dist < 140;
    if (!this.root.visible) return;

    // Surfacing cycle: swim -> rise -> blow a fountain -> dive
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.phase === 'swim') { this.phase = 'rise'; this.timer = 2.5; }
      else if (this.phase === 'rise') { this.phase = 'spout'; this.timer = 3.5; }
      else if (this.phase === 'spout') { this.phase = 'dive'; this.timer = 2.5; }
      else { this.phase = 'swim'; this.timer = 14 + Math.random() * 14; }
    }
    const up = this.phase === 'rise' || this.phase === 'spout';
    this.depth += ((up ? 1 : 0) - this.depth) * Math.min(1, dt * 1.2);

    const speed = this.phase === 'spout' ? 0.8 : 2.4;
    this.s += speed * dt;
    const p = this.pathAt(this.s, moatMid), ahead = this.pathAt(this.s + 3, moatMid);
    const yawT = Math.atan2(-(ahead.x - p.x), -(ahead.z - p.z));
    let d = yawT - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 1.5);

    const y = castle.g - 4 + this.depth * 2.5 + Math.sin(t * 0.8) * 0.12; // surfaced: the back just breaks the surface
    this.root.position.set(castle.x + 0.5 + p.x, y, castle.z + 0.5 + p.z);
    this.root.rotation.set(Math.sin(t * 1.3) * 0.04 - (this.phase === 'rise' ? 0.12 : this.phase === 'dive' ? -0.12 : 0), this.yaw, 0, 'YXZ');

    const U = this.root.userData;
    U.tail.rotation.x = Math.sin(t * 2.2) * 0.3;
    U.flukeP.rotation.x = Math.sin(t * 2.2 - 0.8) * 0.4;
    for (const f of U.fins) f.p.rotation.x = Math.sin(t * 1.6) * 0.25;

    // Big fountain from the blowhole
    if (this.phase === 'spout' && this.depth > 0.8) {
      this.spout += dt * 120;
      const hole = new THREE.Vector3(0, 1.0, -1.2).applyEuler(this.root.rotation).add(this.root.position);
      while (this.spout >= 1) {
        this.spout -= 1;
        this.fx.burst(hole.x, hole.y, hole.z, {
          tile: TILE.fx_white, count: 1, spread: 0.15,
          vx: (Math.random() - 0.5) * 0.12, vy: 0.7 + Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.12,
          gravity: 0.035, drag: 0.99, life: 44, size: 0.14 + Math.random() * 0.14,
          color: Math.random() < 0.5 ? [0.85, 0.93, 1] : [0.6, 0.78, 1],
        });
      }
    }
  }
}
