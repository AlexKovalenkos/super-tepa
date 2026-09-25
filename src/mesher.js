// Chunk mesher: face culling, Minecraft "smooth lighting" (per-vertex light average + ambient occlusion),
// directional face shading, lowered water surface, cross-shaped plants and torches.
import * as THREE from 'three';
import { B, OPAQUE, SHAPE, PASS, FACE_TILE, CULL_SAME } from './blocks.js';
import { H } from './consts.js';

const P = 18, PP = P * P; // padded chunk: 16 + 1 block border on each side
const pb = new Uint8Array(PP * H), ps = new Uint8Array(PP * H), pl = new Uint8Array(PP * H);

const AO_CURVE = [0.5, 0.66, 0.82, 1.0];
const E = 0.0005; // UV inset against atlas bleeding
const STRIDE = [1, PP, P]; // x, y, z strides in the padded array

// face order: +x -x +y -y +z -z
export const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.6, uv: c => [1 - c[2], c[1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6, uv: c => [c[2], c[1]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0, uv: c => [c[0], 1 - c[2]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, uv: c => [c[0], c[2]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8, uv: c => [c[0], c[1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.8, uv: c => [1 - c[0], c[1]] },
];
for (const F of FACES) {
  // make corner order counter-clockwise when seen from outside
  const [a, b, c] = F.c;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * F.n[0] + cr[1] * F.n[1] + cr[2] * F.n[2] < 0) F.c.reverse();
  const na = F.n.findIndex(q => q !== 0);
  const t = [0, 1, 2].filter(q => q !== na);
  F.no = F.n[0] * STRIDE[0] + F.n[1] * STRIDE[1] + F.n[2] * STRIDE[2];
  F.ao = F.c.map(cc => {
    const o1 = (cc[t[0]] ? 1 : -1) * STRIDE[t[0]], o2 = (cc[t[1]] ? 1 : -1) * STRIDE[t[1]];
    return [F.no + o1, F.no + o2, F.no + o1 + o2];
  });
  F.uvs = F.c.map(cc => F.uv(cc));
}

class Buf {
  constructor() { this.pos = []; this.uv = []; this.lt = []; this.idx = []; this.n = 0; }
  v(x, y, z, u, v, s, b, sh) { this.pos.push(x, y, z); this.uv.push(u, v); this.lt.push(s, b, sh); }
  q(flip) {
    const n = this.n;
    if (flip) this.idx.push(n + 1, n + 2, n + 3, n + 1, n + 3, n);
    else this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.n += 4;
  }
  qBack() { const n = this.n; this.idx.push(n, n + 2, n + 1, n, n + 3, n + 2); this.n += 4; }
}

const clampUV = t => (t < E ? E : t > 1 - E ? 1 - E : t);

// One face of an axis-aligned box inside a block, with a sub-rectangle of the tile.
function boxFace(buf, f, x, y, z, min, max, tile, rect, s, b, shadeMul = 1) {
  const F = FACES[f];
  const tu = (tile & 15) / 16, tv = 1 - ((tile >> 4) + 1) / 16;
  for (let k = 0; k < 4; k++) {
    const c = F.c[k], uv = F.uvs[k];
    buf.v(
      x + (c[0] ? max[0] : min[0]), y + (c[1] ? max[1] : min[1]), z + (c[2] ? max[2] : min[2]),
      tu + clampUV(rect[0] + uv[0] * (rect[2] - rect[0])) / 16,
      tv + clampUV(rect[1] + uv[1] * (rect[3] - rect[1])) / 16,
      s, b, F.shade * shadeMul,
    );
  }
  buf.q(false);
}

function crossQuads(buf, x, y, z, id, s, b) {
  const tile = FACE_TILE[id * 6];
  const tu = (tile & 15) / 16, tv = 1 - ((tile >> 4) + 1) / 16, t = 1 / 16;
  const e = 0.146;
  for (const [x1, z1, x2, z2] of [[e, e, 1 - e, 1 - e], [1 - e, e, e, 1 - e]]) {
    for (let side = 0; side < 2; side++) {
      buf.v(x + x1, y, z + z1, tu + E, tv + E, s, b, 0.9);
      buf.v(x + x2, y, z + z2, tu + t - E, tv + E, s, b, 0.9);
      buf.v(x + x2, y + 1, z + z2, tu + t - E, tv + t - E, s, b, 0.9);
      buf.v(x + x1, y + 1, z + z1, tu + E, tv + t - E, s, b, 0.9);
      if (side) buf.qBack(); else buf.q(false);
    }
  }
}

const TORCH_MIN = [7 / 16, 0, 7 / 16], TORCH_MAX = [9 / 16, 10 / 16, 9 / 16];
function torch(buf, x, y, z, id, s, b) {
  const tile = FACE_TILE[id * 6];
  for (const f of [0, 1, 4, 5]) boxFace(buf, f, x, y, z, TORCH_MIN, TORCH_MAX, tile, [7 / 16, 0, 9 / 16, 10 / 16], s, b, 1 / FACES[f].shade);
  boxFace(buf, 2, x, y, z, TORCH_MIN, TORCH_MAX, tile, [7 / 16, 8 / 16, 9 / 16, 10 / 16], s, b);
}

function fillPad(world, c) {
  let ymax = 0;
  const ns = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const n = world.getChunk(c.cx + dx, c.cz + dz);
    ns.push(n);
    if (n && n.maxY > ymax) ymax = n.maxY;
  }
  ymax = Math.min(H - 2, ymax + 1);
  const lim = (ymax + 2) * PP;
  pb.fill(0, 0, lim); ps.fill(15, 0, lim); pl.fill(0, 0, lim);
  let k = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++, k++) {
    const n = ns[k];
    if (!n) continue;
    const zs = dz < 0 ? 15 : 0, ze = dz > 0 ? 0 : 15;
    for (let y = 0; y <= ymax + 1; y++) for (let lz = zs; lz <= ze; lz++) {
      const pz = dz < 0 ? 0 : dz > 0 ? 17 : lz + 1;
      const src = (y << 8) | (lz << 4), dst = (y * P + pz) * P;
      if (dx === 0) {
        pb.set(n.blocks.subarray(src, src + 16), dst + 1);
        ps.set(n.sky.subarray(src, src + 16), dst + 1);
        pl.set(n.bl.subarray(src, src + 16), dst + 1);
      } else {
        const sx = dx < 0 ? 15 : 0, px = dx < 0 ? 0 : 17;
        pb[dst + px] = n.blocks[src + sx]; ps[dst + px] = n.sky[src + sx]; pl[dst + px] = n.bl[src + sx];
      }
    }
  }
  return ymax;
}

export function buildChunk(world, c) {
  const ymax = fillPad(world, c);
  const bufs = [new Buf(), new Buf(), new Buf()];
  const vs = new Float32Array(4), vb = new Float32Array(4), va = new Float32Array(4);
  for (let y = 0; y <= ymax; y++) for (let z = 0; z < 16; z++) {
    let pi = (y * P + z + 1) * P + 1;
    for (let x = 0; x < 16; x++, pi++) {
      const id = pb[pi];
      if (!id) continue;
      const shape = SHAPE[id], buf = bufs[PASS[id]];
      if (shape === 1) { crossQuads(buf, x, y, z, id, ps[pi] / 15, pl[pi] / 15); continue; }
      if (shape === 2) { torch(buf, x, y, z, id, ps[pi] / 15, pl[pi] / 15); continue; }
      const isWater = id === B.water;
      const waterTop = isWater && pb[pi + PP] !== B.water;
      const flat = isWater;
      for (let f = 0; f < 6; f++) {
        if (f === 3 && y === 0) continue;
        const F = FACES[f], ni = pi + F.no, nid = pb[ni];
        if (nid) {
          if (OPAQUE[nid]) continue;
          if (nid === id && CULL_SAME[id]) continue;
        }
        const tile = FACE_TILE[id * 6 + f];
        const tu = (tile & 15) / 16, tv = 1 - ((tile >> 4) + 1) / 16;
        for (let k = 0; k < 4; k++) {
          let s = ps[ni], b = pl[ni], a = 1;
          if (!flat) {
            const ao = F.ao[k];
            const i1 = pi + ao[0], i2 = pi + ao[1], i3 = pi + ao[2];
            const o1 = OPAQUE[pb[i1]], o2 = OPAQUE[pb[i2]], o3 = OPAQUE[pb[i3]];
            a = AO_CURVE[(o1 && o2) ? 0 : 3 - (o1 + o2 + o3)];
            let n = 1;
            if (!o1) { s += ps[i1]; b += pl[i1]; n++; }
            if (!o2) { s += ps[i2]; b += pl[i2]; n++; }
            if (!o3 && !(o1 && o2)) { s += ps[i3]; b += pl[i3]; n++; }
            s /= n; b /= n;
          }
          vs[k] = s; vb[k] = b; va[k] = a;
        }
        const br = k => va[k] * (Math.max(vs[k], vb[k]) + 2);
        const flip = br(0) + br(2) < br(1) + br(3);
        for (let k = 0; k < 4; k++) {
          const c = F.c[k], uv = F.uvs[k];
          let vy = y + c[1], vl = uv[1];
          if (waterTop && c[1] === 1) { vy = y + 0.875; if (f !== 2) vl = 0.875; }
          buf.v(x + c[0], vy, z + c[2], tu + clampUV(uv[0]) / 16, tv + clampUV(vl) / 16, vs[k] / 15, vb[k] / 15, F.shade * va[k]);
        }
        buf.q(flip);
      }
    }
  }
  return bufs.map(toGeometry);
}

function toGeometry(buf) {
  if (!buf.n) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
  g.setAttribute('lt', new THREE.Float32BufferAttribute(buf.lt, 3));
  g.setIndex(buf.n > 65535 ? new THREE.Uint32BufferAttribute(buf.idx, 1) : new THREE.Uint16BufferAttribute(buf.idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Geometry for a single block held in hand / shown as an item (centered at origin, vertex colors = face shade)
export function buildItemGeometry(id) {
  const buf = new Buf();
  if (SHAPE[id] === 1 || SHAPE[id] === 2) {
    const tile = FACE_TILE[id * 6];
    const tu = (tile & 15) / 16, tv = 1 - ((tile >> 4) + 1) / 16, t = 1 / 16;
    buf.v(-0.5, -0.5, 0, tu + E, tv + E, 1, 0, 1);
    buf.v(0.5, -0.5, 0, tu + t - E, tv + E, 1, 0, 1);
    buf.v(0.5, 0.5, 0, tu + t - E, tv + t - E, 1, 0, 1);
    buf.v(-0.5, 0.5, 0, tu + E, tv + t - E, 1, 0, 1);
    buf.q(false);
    buf.v(-0.5, -0.5, 0, tu + E, tv + E, 1, 0, 1);
    buf.v(0.5, -0.5, 0, tu + t - E, tv + E, 1, 0, 1);
    buf.v(0.5, 0.5, 0, tu + t - E, tv + t - E, 1, 0, 1);
    buf.v(-0.5, 0.5, 0, tu + E, tv + t - E, 1, 0, 1);
    buf.qBack();
  } else {
    for (let f = 0; f < 6; f++) boxFace(buf, f, -0.5, -0.5, -0.5, [0, 0, 0], [1, 1, 1], FACE_TILE[id * 6 + f], [0, 0, 1, 1], 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
  const col = [];
  for (let i = 0; i < buf.lt.length; i += 3) { const s = buf.lt[i + 2]; col.push(s, s, s); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(buf.idx);
  return g;
}
