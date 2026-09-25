// Terrain generator: continents, hills, mountains, biomes, caves, ores, trees, flowers.
// Deterministic per chunk, so any chunk can be (re)generated independently.
import { Simplex, fbm2, mulberry32, hash3 } from './noise.js';
import { B } from './blocks.js';
import { H, SEA } from './consts.js';
import { CASTLE } from './castle.js';

export const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOWY: 3, MOUNTAIN: 4, BEACH: 5, OCEAN: 6 };
export const BIOME_NAMES = ['Равнины', 'Лес', 'Пустыня', 'Снежные равнины', 'Горы', 'Пляж', 'Океан'];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function topBlock(biome, h) {
  switch (biome) {
    case BIOME.DESERT: case BIOME.BEACH: return B.sand;
    case BIOME.SNOWY: return B.snow;
    case BIOME.MOUNTAIN: return h >= 118 ? B.snow : h < 108 ? B.grass : B.stone;
    case BIOME.OCEAN: return h >= SEA - 5 ? B.sand : B.gravel;
    default: return B.grass;
  }
}

export class Generator {
  constructor(seed) {
    this.seed = seed | 0;
    const r = mulberry32(seed);
    const mk = () => new Simplex((r() * 4294967296) >>> 0);
    this.nC = mk(); this.nE = mk(); this.nD = mk(); this.nM = mk();
    this.nT = mk(); this.nH = mk(); this.c1 = mk(); this.c2 = mk(); this.c3 = mk();
  }

  // Castle site: world centre (x, z), courtyard level g, block list in local coordinates
  setCastle(x, z, g, blocks) {
    this.castle = { x, z, g };
    this.castleChunks = new Map();
    for (const [dx, dy, dz, id] of blocks) {
      const wx = x + dx, wy = g + dy, wz = z + dz;
      const k = (wx >> 4) + ',' + (wz >> 4);
      if (!this.castleChunks.has(k)) this.castleChunks.set(k, []);
      this.castleChunks.get(k).push(((wy << 8) | ((wz & 15) << 4) | (wx & 15)), id);
    }
  }

  column(x, z) {
    const col = this.naturalColumn(x, z);
    const c = this.castle;
    if (!c) return col;
    const d = Math.max(Math.abs(x - c.x), Math.abs(z - c.z));
    if (d > CASTLE.BLEND) return col;
    col.castle = true;
    if (col.biome !== BIOME.SNOWY) col.biome = BIOME.PLAINS;
    if (d <= CASTLE.PLATEAU) col.h = c.g;
    else if (d <= CASTLE.MOAT) { col.h = c.g - 7; col.water = c.g - 1; col.biome = BIOME.OCEAN; }
    else {
      const t = (d - CASTLE.MOAT) / (CASTLE.BLEND - CASTLE.MOAT), k = t * t * (3 - 2 * t);
      col.h = Math.round(c.g - 1 + (col.h - (c.g - 1)) * k);
    }
    return col;
  }

  naturalColumn(x, z) {
    const cont = fbm2(this.nC, x / 900, z / 900, 4) * 1.5;
    const ero = fbm2(this.nE, x / 320, z / 320, 3);
    const det = fbm2(this.nD, x / 64, z / 64, 3);
    let h;
    if (cont < -0.2) {
      h = SEA - 6 + (cont + 0.2) * 70 + det * 3;
    } else {
      h = SEA - 3 + smooth(-0.2, 0.05, cont) * 9 + cont * 14 + ero * 9 + det * 4;
      const ridge = 1 - Math.abs(fbm2(this.nM, x / 260, z / 260, 4) * 1.6);
      const mm = smooth(0.12, 0.45, cont) * smooth(-0.15, 0.3, ero);
      h += mm * Math.pow(Math.max(0, ridge), 2.5) * 80;
    }
    h = Math.max(8, Math.min(H - 40, Math.floor(h)));
    const temp = fbm2(this.nT, x / 700, z / 700, 2) * 1.4;
    const hum = fbm2(this.nH, x / 560, z / 560, 2) * 1.4;
    let biome;
    if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (h <= SEA + 1 && temp > -0.35) biome = BIOME.BEACH;
    else if (h > 100) biome = BIOME.MOUNTAIN;
    else if (temp > 0.3 && hum < 0.1) biome = BIOME.DESERT;
    else if (temp < -0.35) biome = BIOME.SNOWY;
    else if (hum > 0.05) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    return { h, biome, cold: temp < -0.35 };
  }

  isCave(x, y, z) {
    const s = 1 / 28;
    const a = this.c1.noise3D(x * s, y * s * 1.5, z * s);
    const b = this.c2.noise3D(x * s, y * s * 1.5, z * s);
    if (a * a + b * b < 0.006) return true; // "spaghetti" tunnels
    if (y < 48 && this.c3.noise3D(x / 70, y / 34, z / 70) > 0.62) return true; // big caverns
    return false;
  }

  fill(c) {
    const x0 = c.cx * 16, z0 = c.cz * 16, b = c.blocks;
    const cols = new Array(400); // 20x20: the chunk plus a 2-block margin for trees
    for (let lz = -2; lz < 18; lz++) for (let lx = -2; lx < 18; lx++) cols[(lz + 2) * 20 + lx + 2] = this.column(x0 + lx, z0 + lz);
    const col = (lx, lz) => cols[(lz + 2) * 20 + lx + 2];
    const rnd = mulberry32((Math.imul(c.cx, 73856093) ^ Math.imul(c.cz, 19349663) ^ this.seed) >>> 0);

    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const { h, biome, cold, water, castle } = col(lx, lz);
      const wl = water ?? SEA;
      const top = Math.max(h, wl);
      for (let y = 0; y <= top; y++) {
        let id;
        if (y === 0 || (y < 5 && rnd() < (5 - y) / 5)) id = B.bedrock;
        else if (y < h - 3) id = (biome === BIOME.DESERT && y >= h - 8) ? B.sandstone : B.stone;
        else if (y < h) {
          if (biome === BIOME.DESERT || biome === BIOME.BEACH) id = B.sand;
          else if (biome === BIOME.OCEAN) id = h >= SEA - 5 ? B.sand : B.gravel;
          else if (biome === BIOME.MOUNTAIN && h >= 108) id = B.stone;
          else id = B.dirt;
        }
        else if (y === h) id = topBlock(biome, h);
        else id = (y === wl && cold) ? B.ice : B.water;
        b[(y << 8) | (lz << 4) | lx] = id;
      }
      const caveTop = castle ? 0 : h > SEA + 3 ? h : Math.min(h - 6, SEA - 8);
      const wx = x0 + lx, wz = z0 + lz;
      for (let y = 5; y <= caveTop; y++) {
        const i = (y << 8) | (lz << 4) | lx;
        if (b[i] !== B.bedrock && this.isCave(wx, y, wz)) b[i] = 0;
      }
    }

    // Ore veins (random walks through stone)
    const vein = (id, count, size, maxY) => {
      for (let k = 0; k < count; k++) {
        let x = (rnd() * 16) | 0, y = 5 + ((rnd() * (maxY - 5)) | 0), z = (rnd() * 16) | 0;
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < H) {
            const i = (y << 8) | (z << 4) | x;
            if (b[i] === B.stone) b[i] = id;
          }
          const d = (rnd() * 6) | 0;
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
        }
      }
    };
    vein(B.coal_ore, 18, 8, 128);
    vein(B.iron_ore, 10, 6, 64);

    // Castle blocks
    const cb = this.castleChunks && this.castleChunks.get(c.cx + ',' + c.cz);
    if (cb) for (let i = 0; i < cb.length; i += 2) b[cb[i]] = cb[i + 1];

    // Trees: candidates in the margin too, so trees crossing chunk borders are complete.
    const set = (lx, y, lz, id, onlyAir) => {
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= H - 2) return;
      const i = (y << 8) | (lz << 4) | lx, cur = b[i];
      if (onlyAir ? cur !== 0 : !(cur === 0 || cur === B.oak_leaves || cur === B.birch_leaves || cur === B.short_grass)) return;
      b[i] = id;
    };
    const inside = (lx, lz) => lx >= 0 && lx < 16 && lz >= 0 && lz < 16;
    for (let lz = -2; lz < 18; lz++) for (let lx = -2; lx < 18; lx++) {
      const cl = col(lx, lz), wx = x0 + lx, wz = z0 + lz;
      let dens = 0;
      if (cl.biome === BIOME.FOREST) dens = 0.05;
      else if (cl.biome === BIOME.PLAINS) dens = 0.005;
      else if (cl.biome === BIOME.SNOWY) dens = 0.01;
      else if (cl.biome === BIOME.MOUNTAIN && cl.h < 108) dens = 0.01;
      if (!dens || cl.h < SEA + 1 || cl.castle) continue;
      if (hash3(wx, 777, wz + this.seed) >= dens) continue;
      if (inside(lx, lz) && b[(cl.h << 8) | (lz << 4) | lx] !== topBlock(cl.biome, cl.h)) continue;
      const birch = cl.biome === BIOME.FOREST && hash3(wx, 31, wz) < 0.3;
      const th = 4 + ((hash3(wx, 11, wz) * 3) | 0) + (birch ? 1 : 0);
      const log = birch ? B.birch_log : B.oak_log, leaf = birch ? B.birch_leaves : B.oak_leaves;
      const base = cl.h + 1, topY = base + th - 1;
      // Minecraft oak shape: two wide layers (r=2) and two narrow layers (r=1)
      for (let dy = -2; dy <= 1; dy++) {
        const y = topY + dy, r = dy <= -1 ? 2 : 1;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r) {
            if (dy === 1) continue;
            if (hash3(wx + dx * 7, y, wz + dz * 13) < 0.5) continue;
          }
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          set(lx + dx, y, lz + dz, leaf, true);
        }
      }
      for (let i = 0; i < th; i++) set(lx, base + i, lz, log, false);
      if (inside(lx, lz)) b[(cl.h << 8) | (lz << 4) | lx] = B.dirt;
    }

    // Grass and flowers
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const cl = col(lx, lz);
      if ((cl.biome !== BIOME.PLAINS && cl.biome !== BIOME.FOREST) || cl.castle) continue;
      const h = cl.h;
      if (h < SEA || b[(h << 8) | (lz << 4) | lx] !== B.grass) continue;
      const i = ((h + 1) << 8) | (lz << 4) | lx;
      if (b[i] !== 0) continue;
      const r = hash3(x0 + lx, 99, z0 + lz), g = cl.biome === BIOME.PLAINS ? 0.16 : 0.07;
      if (r < g) b[i] = B.short_grass;
      else if (r < g + 0.006) b[i] = B.dandelion;
      else if (r < g + 0.012) b[i] = B.poppy;
    }
  }
}
