// Block-break particles: small camera-facing squares cut from the block texture, with gravity.
import * as THREE from 'three';
import { FACE_TILE, SOLID } from './blocks.js';

const MAX = 800;

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
    scene.add(this.mesh);
  }

  spawnBlock(x, y, z, id, brightness) {
    const tile = FACE_TILE[id * 6];
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) for (let iz = 0; iz < 4; iz++) {
      if (this.list.length >= MAX) this.list.shift();
      const px = x + (ix + 0.5) / 4, py = y + (iy + 0.5) / 4, pz = z + (iz + 0.5) / 4;
      const u = ((Math.random() * 12) | 0), v = ((Math.random() * 12) | 0);
      this.list.push({
        x: px, y: py, z: pz, px, py, pz,
        vx: (px - x - 0.5) * 0.2 + (Math.random() - 0.5) * 0.08,
        vy: (py - y - 0.5) * 0.2 + Math.random() * 0.1,
        vz: (pz - z - 0.5) * 0.2 + (Math.random() - 0.5) * 0.08,
        life: 4 + ((Math.random() * 16) | 0) + 8,
        size: 0.05 + Math.random() * 0.05,
        u0: ((tile & 15) * 16 + u) / 256, v0: 1 - ((tile >> 4) * 16 + v + 4) / 256,
        b: brightness,
      });
    }
  }

  tick(world) {
    for (const p of this.list) {
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.vy -= 0.04;
      p.x += p.vx; p.z += p.vz;
      const ny = p.y + p.vy;
      if (SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))] && p.vy < 0) {
        p.y = Math.floor(ny) + 1.001; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7;
      } else p.y = ny;
      p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
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
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let k = 0; k < 4; k++) {
        const [a, b] = corners[k];
        this.pos[o + k * 3] = x + (rx * a + ux * b) * s;
        this.pos[o + k * 3 + 1] = y + (ry * a + uy * b) * s;
        this.pos[o + k * 3 + 2] = z + (rz * a + uz * b) * s;
        this.col[o + k * 3] = this.col[o + k * 3 + 1] = this.col[o + k * 3 + 2] = p.b;
      }
      const t = 4 / 256, uo = i * 8;
      this.uv.set([p.u0, p.v0, p.u0 + t, p.v0, p.u0 + t, p.v0 + t, p.u0, p.v0 + t], uo);
    }
    this.geo.setDrawRange(0, n * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
