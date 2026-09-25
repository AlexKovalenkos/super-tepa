// World storage, block edits and Minecraft-style flood-fill lighting (sky light + block light, 0..15).
import { B, OPAQUE, LIGHT_OP, EMIT, SOLID } from './blocks.js';
import { Generator, BIOME } from './worldgen.js';
import { H, SEA } from './consts.js';

export const ckey = (cx, cz) => (((cx & 0xffff) << 16) | (cz & 0xffff)) >>> 0;
const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
const DOWN = 3;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(16 * 16 * H); // index = (y << 8) | (z << 4) | x
    this.sky = new Uint8Array(16 * 16 * H);
    this.bl = new Uint8Array(16 * 16 * H);
    this.maxY = 0;
    this.dirty = true;
    this.meshes = null;
  }
  computeMaxY() {
    for (let y = H - 1; y >= 0; y--) {
      const o = y << 8;
      for (let i = 0; i < 256; i++) if (this.blocks[o + i]) { this.maxY = y; return; }
    }
    this.maxY = 0;
  }
}

export class World {
  constructor(seed, mods) {
    this.seed = seed;
    this.gen = new Generator(seed);
    this.chunks = new Map();
    this.mods = new Map(); // "cx,cz" -> Map(index -> block id): player edits, re-applied on regeneration
    if (mods) for (const k in mods) this.mods.set(k, new Map(mods[k]));
  }

  serializeMods() {
    const out = {};
    for (const [k, m] of this.mods) if (m.size) out[k] = [...m];
    return out;
  }

  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }

  getBlock(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y >= H) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    return c ? c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  }

  getLight(x, y, z) {
    if (y >= H) return [15, 0];
    if (y < 0) return [0, 0];
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c) return [15, 0];
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    return [c.sky[i], c.bl[i]];
  }

  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    this.gen.fill(c);
    const m = this.mods.get(cx + ',' + cz);
    if (m) for (const [i, id] of m) c.blocks[i] = id;
    c.computeMaxY();
    this.chunks.set(ckey(cx, cz), c);
    this.initLight(c);
    return c;
  }

  // Surface height at a column, from generated data when available
  topSolidY(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return this.gen.column(x, z).h;
    for (let y = c.maxY; y > 0; y--) {
      const id = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
      if (SOLID[id] || id === B.water) return y;
    }
    return 0;
  }

  findSpawn() {
    for (let r = 0; r < 4000; r += 24) {
      for (let a = 0; a < 12; a++) {
        const x = Math.round(Math.cos(a * Math.PI / 6) * r), z = Math.round(Math.sin(a * Math.PI / 6) * r);
        const col = this.gen.column(x, z);
        if (col.h >= SEA + 2 && col.h < 95 && (col.biome === BIOME.PLAINS || col.biome === BIOME.FOREST)) return { x: x + 0.5, z: z + 0.5 };
      }
    }
    return { x: 0.5, z: 0.5 };
  }

  // Marks a chunk (and neighbours when on a border) for re-meshing
  _mark(x, z) {
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    const m = (a, b) => { const c = this.chunks.get(ckey(a, b)); if (c) c.dirty = true; };
    m(cx, cz);
    const ex = lx === 0 ? -1 : lx === 15 ? 1 : 0, ez = lz === 0 ? -1 : lz === 15 ? 1 : 0;
    if (ex) m(cx + ex, cz);
    if (ez) m(cx, cz + ez);
    if (ex && ez) m(cx + ex, cz + ez);
  }

  setBlock(x, y, z, id) {
    if (y < 1 || y >= H - 2) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return false;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    if (c.blocks[i] === id) return false;
    c.blocks[i] = id;
    const k = c.cx + ',' + c.cz;
    if (!this.mods.has(k)) this.mods.set(k, new Map());
    this.mods.get(k).set(i, id);
    if (id && y > c.maxY) c.maxY = y;
    this._mark(x, z);
    this._relight(c, x, y, z, i, id);
    return true;
  }

  _relight(c, x, y, z, i, id) {
    for (const sky of [true, false]) {
      const arr = sky ? c.sky : c.bl;
      const old = arr[i];
      arr[i] = 0;
      const addQ = [];
      if (!sky && EMIT[id] > 0) { arr[i] = EMIT[id]; addQ.push(x, y, z); }
      if (LIGHT_OP[id] < 15) {
        for (let d = 0; d < 6; d++) {
          const ny = y + DY[d];
          if (ny >= 0 && ny < H) addQ.push(x + DX[d], ny, z + DZ[d]);
        }
      }
      if (old > 0) this._remove([x, y, z, old], sky);
      this._propagate(addQ, sky);
    }
  }

  // BFS light spread across loaded chunks
  _propagate(q, sky) {
    const key = sky ? 'sky' : 'bl';
    let head = 0;
    while (head < q.length) {
      const x = q[head++], y = q[head++], z = q[head++];
      const c = this.chunks.get(ckey(x >> 4, z >> 4));
      if (!c) continue;
      const l = c[key][(y << 8) | ((z & 15) << 4) | (x & 15)];
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < 0 || ny >= H) continue;
        const nc = ((nx >> 4) === (x >> 4) && (nz >> 4) === (z >> 4)) ? c : this.chunks.get(ckey(nx >> 4, nz >> 4));
        if (!nc) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const op = LIGHT_OP[nc.blocks[ni]];
        if (op >= 15) continue;
        const nl = (sky && d === DOWN && l === 15 && op === 0) ? 15 : l - (op > 1 ? op : 1);
        if (nl > nc[key][ni]) {
          nc[key][ni] = nl;
          this._mark(nx, nz);
          q.push(nx, ny, nz);
        }
      }
    }
  }

  // Standard two-queue light removal
  _remove(rq, sky) {
    const key = sky ? 'sky' : 'bl';
    const addQ = [];
    let head = 0;
    while (head < rq.length) {
      const x = rq[head++], y = rq[head++], z = rq[head++], l = rq[head++];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < 0 || ny >= H) continue;
        const nc = this.chunks.get(ckey(nx >> 4, nz >> 4));
        if (!nc) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const nl = nc[key][ni];
        if (nl === 0) continue;
        if (nl < l || (sky && d === DOWN && l === 15 && nl === 15)) {
          nc[key][ni] = 0;
          this._mark(nx, nz);
          rq.push(nx, ny, nz, nl);
          const e = sky ? 0 : EMIT[nc.blocks[ni]];
          if (e) { nc[key][ni] = e; addQ.push(nx, ny, nz); }
        } else {
          addQ.push(nx, ny, nz);
        }
      }
    }
    this._propagate(addQ, sky);
  }

  initLight(c) {
    const { blocks, sky, bl } = c;
    const x0 = c.cx * 16, z0 = c.cz * 16;
    // 1. Straight-down sky light per column
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let l = 15;
      for (let y = H - 1; y >= 0; y--) {
        const i = (y << 8) | (lz << 4) | lx;
        const op = LIGHT_OP[blocks[i]];
        if (op >= 15) break;
        l = (l === 15 && op === 0) ? 15 : Math.max(0, l - Math.max(1, op));
        if (l === 0) break;
        sky[i] = l;
      }
    }
    // 2. Seeds for horizontal spread: lit cells next to darker cells, plus borders
    const qs = [], qb = [];
    const ytop = Math.min(H - 1, c.maxY + 1);
    for (let y = 0; y <= ytop; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const i = (y << 8) | (lz << 4) | lx;
      const e = EMIT[blocks[i]];
      if (e) { bl[i] = e; qb.push(x0 + lx, y, z0 + lz); }
      const l = sky[i];
      if (l <= 1) continue;
      let seed = lx === 0 || lx === 15 || lz === 0 || lz === 15;
      if (!seed) {
        const n = [i + 1, i - 1, i + 16, i - 16];
        for (let k = 0; k < 4; k++) if (!OPAQUE[blocks[n[k]]] && sky[n[k]] < l - 1) { seed = true; break; }
      }
      if (seed) qs.push(x0 + lx, y, z0 + lz);
    }
    // 3. Pull light in from already-loaded neighbours
    const nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of nb) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n) continue;
      const top = Math.min(H - 1, Math.max(c.maxY, n.maxY) + 1);
      for (let y = 0; y <= top; y++) for (let k = 0; k < 16; k++) {
        const lx = dx === -1 ? 15 : dx === 1 ? 0 : k, lz = dz === -1 ? 15 : dz === 1 ? 0 : k;
        const i = (y << 8) | (lz << 4) | lx;
        const wx = (c.cx + dx) * 16 + lx, wz = (c.cz + dz) * 16 + lz;
        if (n.sky[i] > 1) qs.push(wx, y, wz);
        if (n.bl[i] > 1) qb.push(wx, y, wz);
      }
    }
    this._propagate(qs, true);
    this._propagate(qb, false);
    c.dirty = true;
  }
}

