// Mobs: Minecraft-style animals and magic dogs with super powers.
// Each mob uses the same physics body as the player (collisions, gravity, stepping, swimming).
import * as THREE from 'three';
import { Player } from './player.js';
import { B, SOLID } from './blocks.js';
import { mulberry32 } from './noise.js';
import { BIOME } from './worldgen.js';
import { TILE } from './textures.js';
import { nameTag } from './modelkit.js';
import { createPig, createCow, createSheep, createChicken, createRabbit, createFox, animateAnimal, WOOL_COLORS } from './animals.js';
import { createDog, animateDog } from './tepa.js';

// Magic dogs: colour scheme, wings and a super power each
export const POWERS = {
  fire: {
    title: 'огонь', names: ['Огонёк', 'Уголёк', 'Искорка'],
    palette: { fur: [214, 70, 30], furDark: [170, 40, 20], furLight: [250, 130, 40], ear: [120, 30, 20], tan: [255, 200, 80], tanDark: [240, 160, 60], leg: [180, 50, 25], paw: [110, 30, 20] },
    wings: { O: [200, 40, 10], Y: [255, 140, 20], L: [255, 220, 90], B: [230, 40, 30], D: [150, 20, 10] }, glow: true,
  },
  ice: {
    title: 'лёд: ходит по воде', names: ['Снежок', 'Льдинка', 'Пломбир'],
    palette: { fur: [226, 240, 252], furDark: [190, 214, 240], furLight: [250, 252, 255], ear: [150, 190, 230], tan: [255, 255, 255], tanDark: [220, 230, 245], leg: [200, 222, 245], paw: [150, 190, 230] },
    wings: { O: [140, 190, 240], Y: [210, 235, 255], L: [255, 255, 255], B: [110, 170, 240], D: [70, 120, 200] },
  },
  flower: {
    title: 'сажает цветы', names: ['Ромашка', 'Незабудка', 'Лютик'],
    palette: { fur: [248, 248, 240], furDark: [230, 226, 210], furLight: [255, 255, 255], ear: [120, 180, 80], tan: [255, 236, 120], tanDark: [240, 210, 90], leg: [236, 236, 226], paw: [120, 180, 80] },
    wings: null,
  },
  teleport: {
    title: 'телепортация', names: ['Фиалка', 'Мигалка', 'Хоп'],
    palette: { fur: [130, 70, 190], furDark: [96, 48, 150], furLight: [170, 110, 220], ear: [70, 30, 110], tan: [220, 190, 255], tanDark: [190, 160, 235], leg: [110, 60, 170], paw: [60, 30, 100] },
    wings: null,
  },
  jump: {
    title: 'суперпрыжок', names: ['Пружинка', 'Попрыгунчик', 'Кенгуру'],
    palette: { fur: [250, 210, 60], furDark: [226, 178, 40], furLight: [255, 232, 120], ear: [200, 140, 30], tan: [255, 245, 200], tanDark: [240, 225, 170], leg: [236, 190, 50], paw: [180, 120, 30] },
    wings: null,
  },
  fly: {
    title: 'летает', names: ['Облачко', 'Пушинка', 'Ветерок'],
    palette: { fur: [250, 250, 252], furDark: [226, 226, 234], furLight: [255, 255, 255], ear: [230, 200, 150], tan: [255, 240, 220], tanDark: [240, 222, 200], leg: [240, 240, 244], paw: [220, 200, 170] },
    wings: { O: [230, 190, 90], Y: [255, 250, 240], L: [255, 255, 255], B: [250, 220, 140], D: [230, 190, 90] },
  },
  rainbow: {
    title: 'радуга', names: ['Радужка', 'Карамелька', 'Зефирка'],
    palette: { fur: [250, 170, 210], furDark: [230, 140, 190], furLight: [255, 210, 235], ear: [150, 120, 230], tan: [255, 240, 250], tanDark: [245, 220, 240], leg: [240, 160, 200], paw: [150, 120, 230] },
    wings: { O: [230, 60, 60], Y: [255, 200, 60], L: [120, 220, 120], B: [80, 150, 250], D: [170, 90, 230] },
  },
  glow: {
    title: 'светится', names: ['Светлячок', 'Звёздочка', 'Лучик'],
    palette: { fur: [255, 236, 150], furDark: [240, 210, 110], furLight: [255, 250, 200], ear: [250, 190, 80], tan: [255, 255, 230], tanDark: [255, 240, 190], leg: [250, 226, 140], paw: [240, 190, 80] },
    wings: { O: [255, 230, 120], Y: [255, 255, 200], L: [255, 255, 255], B: [255, 240, 150], D: [255, 220, 100] }, glow: true,
  },
  speed: {
    title: 'молния', names: ['Молния', 'Ракета', 'Шустрик'],
    palette: { fur: [70, 110, 200], furDark: [46, 80, 160], furLight: [110, 150, 230], ear: [30, 50, 110], tan: [255, 230, 60], tanDark: [240, 200, 40], leg: [60, 96, 180], paw: [30, 50, 110] },
    wings: null,
  },
};
const POWER_KEYS = Object.keys(POWERS);

const KINDS = {
  pig: { make: () => createPig(), hw: 0.45, h: 0.9, amount: 0.5, name: 'Свинка' },
  cow: { make: () => createCow(), hw: 0.45, h: 1.4, amount: 0.45, name: 'Корова' },
  sheep: { make: v => createSheep(WOOL_COLORS[v % WOOL_COLORS.length]), variants: WOOL_COLORS.length, hw: 0.45, h: 1.3, amount: 0.5, name: 'Овечка' },
  chicken: { make: () => createChicken(), hw: 0.2, h: 0.7, amount: 0.45, slowFall: true, name: 'Курочка' },
  rabbit: { make: v => createRabbit([[150, 110, 75], [236, 236, 236], [215, 180, 110]][v]), variants: 3, hw: 0.2, h: 0.5, amount: 0.7, hop: true, name: 'Кролик' },
  fox: { make: v => createFox(v === 1), variants: 2, hw: 0.3, h: 0.7, amount: 0.8, name: 'Лиса' },
  dog: { hw: 0.3, h: 0.85, amount: 0.7 },
};

const HEART = TILE.fx_heart, SPARK = TILE.fx_spark, WHITE = TILE.fx_white;

export class Mobs {
  constructor(scene, world, particles) {
    this.scene = scene; this.world = world; this.fx = particles;
    this.list = [];
    this.protos = new Map();
    this.max = 80;
  }

  proto(kind, v) {
    const k = kind + ':' + v;
    if (!this.protos.has(k)) {
      if (kind === 'dog') {
        const p = POWERS[v];
        this.protos.set(k, createDog({ palette: p.palette, wings: p.wings, glow: p.glow, scale: 0.75, seed: 90 + POWER_KEYS.indexOf(v) }));
      } else this.protos.set(k, KINDS[kind].make(v));
    }
    return this.protos.get(k);
  }

  // Called when a chunk is generated: spawn a small herd or a magic dog, like Minecraft's chunk spawning
  onChunk(c) {
    if (this.list.length >= this.max) return;
    const rnd = mulberry32((Math.imul(c.cx, 91815541) ^ Math.imul(c.cz, 12582917) ^ this.world.seed) >>> 0);
    const r = rnd();
    const lx = 3 + ((rnd() * 10) | 0), lz = 3 + ((rnd() * 10) | 0);
    const x = c.cx * 16 + lx, z = c.cz * 16 + lz;
    const col = this.world.gen.column(x, z);
    const y = this.world.topSolidY(x, z);
    const ground = c.blocks[(y << 8) | (lz << 4) | lx];
    if (ground !== B.grass && ground !== B.snow && ground !== B.sand && ground !== B.stone_bricks) return;
    if (r < 0.09) {
      this.spawn('dog', POWER_KEYS[(rnd() * POWER_KEYS.length) | 0], x + 0.5, y + 1, z + 0.5, rnd);
    } else if (r < 0.26) {
      let kinds;
      switch (col.biome) {
        case BIOME.SNOWY: kinds = ['rabbit', 'fox']; break;
        case BIOME.DESERT: case BIOME.BEACH: kinds = ['rabbit']; break;
        case BIOME.MOUNTAIN: kinds = ['sheep', 'sheep', 'cow']; break;
        case BIOME.FOREST: kinds = ['pig', 'sheep', 'chicken', 'fox', 'rabbit', 'cow']; break;
        default: kinds = ['pig', 'cow', 'sheep', 'chicken', 'sheep', 'rabbit'];
      }
      const kind = kinds[(rnd() * kinds.length) | 0];
      let v = 0;
      if (kind === 'rabbit') v = col.biome === BIOME.SNOWY ? 1 : col.biome === BIOME.DESERT ? 2 : 0;
      if (kind === 'fox') v = col.biome === BIOME.SNOWY ? 1 : 0;
      const n = kind === 'fox' ? 1 + ((rnd() * 2) | 0) : 2 + ((rnd() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const sx = x + ((rnd() * 5) | 0) - 2, sz = z + ((rnd() * 5) | 0) - 2;
        if ((sx >> 4) !== c.cx || (sz >> 4) !== c.cz) continue;
        const sy = this.world.topSolidY(sx, sz);
        if (this.world.getBlock(sx, sy, sz) === B.water) continue;
        const vv = kind === 'sheep' ? (rnd() < 0.8 ? 0 : 1 + ((rnd() * (WOOL_COLORS.length - 1)) | 0)) : v;
        this.spawn(kind, vv, sx + 0.5, sy + 1, sz + 0.5, rnd);
      }
    }
  }

  spawn(kind, v, x, y, z, rnd = Math.random) {
    const K = KINDS[kind];
    const body = new Player(this.world, { hw: K.hw, h: K.h, slowFall: K.slowFall });
    body.setPos(x, y, z);
    body.yaw = rnd() * Math.PI * 2;
    const root = this.proto(kind, v).clone();
    this.scene.add(root);
    const m = { kind, v, body, root, target: null, timer: 0, follow: false, tp: 80 + ((rnd() * 120) | 0), t: rnd() * 100, amount: K.amount, hearts: 0 };
    if (kind === 'dog') {
      const P = POWERS[v];
      m.name = P.names[(rnd() * P.names.length) | 0];
      m.power = v;
      if (v === 'speed') m.amount = 1.6;
      if (v === 'fly') body.flying = true;
      m.tag = nameTag(m.name, '✦ ' + P.title);
      m.tag.position.y = 1.35;
      root.add(m.tag);
    }
    this.list.push(m);
    return m;
  }

  remove(m) {
    this.scene.remove(m.root);
    if (m.tag) { m.tag.material.map.dispose(); m.tag.material.dispose(); }
  }

  // Right click: hearts for everyone; magic dogs start (or stop) following Tepa
  interact(m, playerPos) {
    const b = m.body;
    this.fx.burst(b.pos.x, b.pos.y + b.h + 0.3, b.pos.z, { tile: HEART, count: 6, spread: 0.4, vy: 0.08, life: 25, size: 0.18 });
    if (m.kind === 'dog') {
      m.follow = !m.follow;
      m.target = null;
      if (b.onGround) b.vel.y = 0.42;
    } else if (b.onGround) {
      b.vel.y = 0.3;
      m.body.yaw = Math.atan2(-(playerPos.x - b.pos.x), -(playerPos.z - b.pos.z));
    }
    return m.kind === 'dog' ? (m.follow ? `${m.name} теперь дружит с Тёпой!` : `${m.name} гуляет сам по себе`) : null;
  }

  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    for (const m of this.list) {
      const b = m.body.box();
      let t0 = 0, t1 = maxT;
      const axes = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
      let hit = true;
      for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { hit = false; break; } continue; }
        let a = (lo - o) / d, c = (hi - o) / d;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) { hit = false; break; }
      }
      if (hit && (!best || t0 < best.t)) best = { mob: m, t: t0 };
    }
    return best;
  }

  groundY(x, z) { return this.world.topSolidY(Math.floor(x), Math.floor(z)); }

  tick(player) {
    const w = this.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], b = m.body;
      if (!w.getChunk(Math.floor(b.pos.x) >> 4, Math.floor(b.pos.z) >> 4)) { this.remove(m); this.list.splice(i, 1); continue; }
      m.t++;
      const inp = { forward: false, jump: false, sneak: false, amount: m.amount };
      const P = player.pos;
      const pdx = P.x - b.pos.x, pdz = P.z - b.pos.z, pd = Math.hypot(pdx, pdz);

      // --- choose where to go (Minecraft "wander" goal, or follow Tepa) ---
      if (m.follow) {
        if (pd > 28) {
          const y = this.groundY(P.x - 2, P.z - 2) + 1;
          b.setPos(P.x - 1.5, y, P.z - 1.5);
          this.fx.burst(b.pos.x, b.pos.y + 0.5, b.pos.z, { tile: SPARK, count: 8, spread: 0.5, life: 15, color: [0.8, 0.6, 1] });
        }
        m.target = pd > 3.5 ? { x: P.x, z: P.z, y: P.y } : null;
        inp.amount = m.power === 'speed' ? 1.8 : 0.95;
      } else if (m.target) {
        if (--m.timer <= 0 || Math.hypot(m.target.x - b.pos.x, m.target.z - b.pos.z) < 1) m.target = null;
      } else if (Math.random() < 1 / 90) {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8;
        m.target = { x: b.pos.x + Math.cos(a) * r, z: b.pos.z + Math.sin(a) * r };
        m.timer = 160;
      }
      if (m.target) {
        const yawT = Math.atan2(-(m.target.x - b.pos.x), -(m.target.z - b.pos.z));
        let d = yawT - b.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        b.yaw += Math.max(-0.35, Math.min(0.35, d));
        inp.forward = Math.abs(d) < 1.2;
        if (b.hColl && b.onGround) inp.jump = true;
        if (KINDS[m.kind].hop && b.onGround && m.t % 8 === 0) inp.jump = true;
      } else if (pd < 7 && m.kind !== 'chicken') {
        // look at Tepa when she is close, like Minecraft's "look at player" goal
        const yawT = Math.atan2(-pdx, -pdz);
        let d = yawT - b.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        b.yaw += d * 0.15;
      }
      if (b.inWater) inp.jump = true;

      // Flying dog keeps a cruising height above the ground
      if (m.power === 'fly') {
        b.flying = true;
        const want = (m.follow ? P.y + 2 : this.groundY(b.pos.x, b.pos.z) + 3) + Math.sin(m.t * 0.05) * 1.5;
        if (b.pos.y < want - 0.5) inp.jump = true;
        else if (b.pos.y > want + 0.5) inp.sneak = true;
        inp.amount = m.follow ? 0.9 : 0.5;
      }

      b.tick(inp);
      if (m.power === 'fly') b.flying = true;
      this.power(m);
    }
  }

  power(m) {
    const b = m.body, w = this.world, fx = this.fx, x = b.pos.x, y = b.pos.y, z = b.pos.z;
    switch (m.power) {
      case 'fire':
        if (m.t % 2 === 0) fx.burst(x, y + 0.8, z, { tile: WHITE, count: 1, spread: 0.25, vy: 0.05, life: 14, size: 0.07, color: Math.random() < 0.5 ? [1, 0.55, 0.1] : [1, 0.85, 0.2], drag: 0.9 });
        break;
      case 'ice': {
        // Frost walker: freezes the water around its paws
        const by = Math.floor(y) - 1;
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (dx * dx + dz * dz > 5) continue;
          const bx = Math.floor(x) + dx, bz = Math.floor(z) + dz;
          if (w.getBlock(bx, by, bz) === B.water && w.getBlock(bx, by + 1, bz) === 0) w.setBlock(bx, by, bz, B.ice);
        }
        if (m.t % 6 === 0) fx.burst(x, y + 0.6, z, { tile: SPARK, count: 1, spread: 0.4, vy: -0.01, life: 20, size: 0.08, color: [0.8, 0.9, 1] });
        break;
      }
      case 'flower':
        if (b.onGround && m.t % 25 === 0) {
          const bx = Math.floor(x), bz = Math.floor(z), gy = Math.floor(y) - 1;
          if (w.getBlock(bx, gy, bz) === B.grass && w.getBlock(bx, gy + 1, bz) === 0) {
            w.setBlock(bx, gy + 1, bz, Math.random() < 0.5 ? B.dandelion : B.poppy);
            fx.burst(bx + 0.5, gy + 1.3, bz + 0.5, { tile: SPARK, count: 3, spread: 0.3, vy: 0.04, life: 16, size: 0.08, color: [0.6, 1, 0.5] });
          }
        }
        break;
      case 'teleport':
        if (--m.tp <= 0) {
          m.tp = 100 + ((Math.random() * 140) | 0);
          const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 7;
          const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
          if (!w.getChunk(Math.floor(nx) >> 4, Math.floor(nz) >> 4)) break;
          const ny = this.groundY(nx, nz) + 1;
          if (w.getBlock(Math.floor(nx), ny - 1, Math.floor(nz)) === B.water) break;
          fx.burst(x, y + 0.5, z, { tile: WHITE, count: 16, spread: 0.6, life: 20, size: 0.07, color: [0.7, 0.3, 1] });
          b.setPos(Math.floor(nx) + 0.5, ny, Math.floor(nz) + 0.5);
          fx.burst(b.pos.x, ny + 0.5, b.pos.z, { tile: WHITE, count: 16, spread: 0.6, life: 20, size: 0.07, color: [0.8, 0.5, 1] });
        }
        break;
      case 'jump':
        if (b.onGround && Math.random() < 0.03) {
          b.vel.y = 1.05; // about 6 blocks high
          fx.burst(x, y + 0.1, z, { tile: SPARK, count: 5, spread: 0.4, vy: 0.02, life: 14, size: 0.1, color: [1, 0.95, 0.4] });
        }
        break;
      case 'rainbow': {
        const hue = (m.t * 0.03) % 1;
        const col = new THREE.Color().setHSL(hue, 1, 0.6);
        fx.burst(x, y + 0.5, z, { tile: WHITE, count: 1, spread: 0.15, vy: 0.005, life: 30, size: 0.08, color: [col.r, col.g, col.b], gravity: 0 });
        break;
      }
      case 'glow':
        if (m.t % 3 === 0) fx.burst(x, y + 0.7, z, { tile: SPARK, count: 1, spread: 0.6, vy: 0.02, life: 18, size: 0.09, color: [1, 1, 0.7], gravity: 0 });
        break;
      case 'speed':
        if (b.speed > 3 && m.t % 2 === 0) fx.burst(x, y + 0.5, z, { tile: SPARK, count: 1, spread: 0.2, life: 10, size: 0.1, color: [0.5, 0.8, 1], gravity: 0 });
        break;
      default:
    }
  }

  update(dt, alpha, t, camPos) {
    for (const m of this.list) {
      const b = m.body;
      const ix = b.prev.x + (b.pos.x - b.prev.x) * alpha;
      const iy = b.prev.y + (b.pos.y - b.prev.y) * alpha;
      const iz = b.prev.z + (b.pos.z - b.prev.z) * alpha;
      m.root.position.set(ix, iy, iz);
      m.root.rotation.y = b.yaw;
      const st = {
        limbPos: b.prevLimbPos + (b.limbPos - b.prevLimbPos) * alpha,
        limbAmt: b.prevLimbAmt + (b.limbAmt - b.prevLimbAmt) * alpha,
        onGround: b.onGround, flying: b.flying, inWater: b.inWater, t: t + m.t * 0.01, pitch: 0,
      };
      if (m.kind === 'dog') animateDog(m.root, st, dt);
      else animateAnimal(m.root, m.kind, st);
      if (m.tag) {
        const d = Math.hypot(camPos.x - ix, camPos.y - iy, camPos.z - iz);
        m.tag.visible = d < 20;
      }
    }
  }

  clear() {
    for (const m of this.list) this.remove(m);
    this.list = [];
  }
}

export { SOLID };
