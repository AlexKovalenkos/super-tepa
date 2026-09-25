// Particles: block-break debris cut from the block texture, plus coloured effect sprites
// (hearts, sparks, flames, magic) used by mobs, the dragon and interactions.
import * as THREE from 'three';
import { FACE_TILE, SOLID } from './blocks.js';

const MAX = 1500;
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

export class Particles {
  constructor(scene, atlas) {
    this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 12);
    this.uv = new Float32Array(MAX * 8);
    this.col = new Float32Array(MAX * 12);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint16Array(MAX * 6);
    for (let i = 0; i < MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }

  add(p) {
    if (this.list.length >= MAX) this.list.shift();
    p.px = p.x; p.py = p.y; p.pz = p.z;
    this.list.push(p);
  }

  spawnBlock(x, y, z, id, brightness) {
    const tile = FACE_TILE[id * 6];
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) for (let iz = 0; iz < 4; iz++) {
      const px = x + (ix + 0.5) / 4, py = y + (iy + 0.5) / 4, pz = z + (iz + 0.5) / 4;
      const u = (Math.random() * 12) | 0, v = (Math.random() * 12) | 0;
      this.add({
        x: px, y: py, z: pz,
        vx: (px - x - 0.5) * 0.2 + (Math.random() - 0.5) * 0.08,
        vy: (py - y - 0.5) * 0.2 + Math.random() * 0.1,
        vz: (pz - z - 0.5) * 0.2 + (Math.random() - 0.5) * 0.08,
        life: 12 + ((Math.random() * 16) | 0), size: 0.05 + Math.random() * 0.05,
        u0: ((tile & 15) * 16 + u) / 256, v0: 1 - ((tile >> 4) * 16 + v + 4) / 256, du: 4 / 256,
        r: brightness, g: brightness, b: brightness, grav: 0.04, drag: 0.98, collide: true,
      });
    }
  }

  // o: { tile, count, spread, vx, vy, vz, life, size, color:[r,g,b] (0..1), gravity, drag }
  burst(x, y, z, o) {
    const tile = o.tile, n = o.count ?? 1, s = o.spread ?? 0.3, c = o.color || [1, 1, 1];
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * s * 2, y: y + (Math.random() - 0.5) * s, z: z + (Math.random() - 0.5) * s * 2,
        vx: (o.vx ?? 0) + (Math.random() - 0.5) * 0.04, vy: (o.vy ?? 0.02) + Math.random() * 0.02, vz: (o.vz ?? 0) + (Math.random() - 0.5) * 0.04,
        life: (o.life ?? 20) + ((Math.random() * 6) | 0), size: o.size ?? 0.12,
        u0: (tile & 15) / 16, v0: 1 - ((tile >> 4) + 1) / 16, du: 1 / 16,
        r: c[0], g: c[1], b: c[2], grav: o.gravity ?? 0, drag: o.drag ?? 0.96, collide: false,
      });
    }
  }

  tick(world) {
    for (const p of this.list) {
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.vy -= p.grav;
      p.x += p.vx; p.z += p.vz;
      const ny = p.y + p.vy;
      if (p.collide && p.vy < 0 && SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))]) {
        p.y = Math.floor(ny) + 1.001; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7;
      } else p.y = ny;
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      p.life--;
    }
    this.list = this.list.filter(p => p.life > 0);
  }

  update(camera, alpha) {
    const e = camera.matrixWorld.elements;
    const rx = e[0], ry = e[1], rz = e[2], ux = e[4], uy = e[5], uz = e[6];
    const n = this.list.length;
    for (let i = 0; i < n; i++) {
      const p = this.list[i], s = p.size;
      const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha, z = p.pz + (p.z - p.pz) * alpha;
      const o = i * 12;
      for (let k = 0; k < 4; k++) {
        const [a, b] = CORNERS[k];
        this.pos[o + k * 3] = x + (rx * a + ux * b) * s;
        this.pos[o + k * 3 + 1] = y + (ry * a + uy * b) * s;
        this.pos[o + k * 3 + 2] = z + (rz * a + uz * b) * s;
        this.col[o + k * 3] = p.r; this.col[o + k * 3 + 1] = p.g; this.col[o + k * 3 + 2] = p.b;
      }
      const t = p.du, uo = i * 8;
      this.uv[uo] = p.u0; this.uv[uo + 1] = p.v0;
      this.uv[uo + 2] = p.u0 + t; this.uv[uo + 3] = p.v0;
      this.uv[uo + 4] = p.u0 + t; this.uv[uo + 5] = p.v0 + t;
      this.uv[uo + 6] = p.u0; this.uv[uo + 7] = p.v0 + t;
    }
    this.geo.setDrawRange(0, n * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
