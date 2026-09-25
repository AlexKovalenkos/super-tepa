// Player movement, a port of Minecraft Java Edition's LivingEntity/Player movement code.
// Units: blocks and ticks (20 ticks per second). Velocities are blocks per tick.
//
//   gravity             0.08 per tick, then vertical drag * 0.98
//   jump velocity       0.42 (sprint-jump adds a 0.2 forward boost)
//   walk speed attr     0.10 (sprint * 1.3)  -> 4.317 m/s walk, 5.612 m/s sprint
//   ground friction     slipperiness * 0.91 (0.6 normal, 0.98 ice); air 0.91
//   air control         0.02 (sprinting 0.026)
//   sneaking            input * 0.3 -> 1.295 m/s, won't walk off edges
//   creative flight     0.05 (sprint 0.1) -> 10.9 m/s, vertical +-0.15 with * 0.6 damping
//   step height         0.6, hitbox 0.6 x 1.8, eyes at 1.62 (1.27 sneaking)
import { SOLID, SLIP, B } from './blocks.js';

const STEP = 0.6;

function clipY(bx, b, dy) {
  for (let i = 0; i < bx.length; i += 3) {
    const x = bx[i], y = bx[i + 1], z = bx[i + 2];
    if (x + 1 <= b.x0 || x >= b.x1 || z + 1 <= b.z0 || z >= b.z1) continue;
    if (dy > 0 && y >= b.y1 - 1e-7) { const d = y - b.y1; if (d < dy) dy = Math.max(0, d); }
    else if (dy < 0 && y + 1 <= b.y0 + 1e-7) { const d = y + 1 - b.y0; if (d > dy) dy = Math.min(0, d); }
  }
  return dy;
}
function clipX(bx, b, dx) {
  for (let i = 0; i < bx.length; i += 3) {
    const x = bx[i], y = bx[i + 1], z = bx[i + 2];
    if (y + 1 <= b.y0 || y >= b.y1 || z + 1 <= b.z0 || z >= b.z1) continue;
    if (dx > 0 && x >= b.x1 - 1e-7) { const d = x - b.x1; if (d < dx) dx = Math.max(0, d); }
    else if (dx < 0 && x + 1 <= b.x0 + 1e-7) { const d = x + 1 - b.x0; if (d > dx) dx = Math.min(0, d); }
  }
  return dx;
}
function clipZ(bx, b, dz) {
  for (let i = 0; i < bx.length; i += 3) {
    const x = bx[i], y = bx[i + 1], z = bx[i + 2];
    if (x + 1 <= b.x0 || x >= b.x1 || y + 1 <= b.y0 || y >= b.y1) continue;
    if (dz > 0 && z >= b.z1 - 1e-7) { const d = z - b.z1; if (d < dz) dz = Math.max(0, d); }
    else if (dz < 0 && z + 1 <= b.z0 + 1e-7) { const d = z + 1 - b.z0; if (d > dz) dz = Math.min(0, d); }
  }
  return dz;
}
function offset(b, x, y, z) { b.x0 += x; b.x1 += x; b.y0 += y; b.y1 += y; b.z0 += z; b.z1 += z; }

export class Player {
  // opts: { hw: half width, h: height, speed: movement speed attribute, slowFall }
  constructor(world, opts = {}) {
    this.world = world;
    this.hw = opts.hw ?? 0.3; this.h = opts.h ?? 1.8;
    this.speedAttr = opts.speed ?? 0.1;
    this.slowFall = !!opts.slowFall;
    this.pos = { x: 0.5, y: 80, z: 0.5 };
    this.prev = { ...this.pos };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.hColl = false;
    this.flying = false; this.sprinting = false; this.sneaking = false;
    this.inWater = false;
    this.jumpDelay = 0;
    this.eye = 1.62; this.prevEye = 1.62;
    this.walkDist = 0; this.prevWalkDist = 0;
    this.bob = 0; this.prevBob = 0;
    this.limbPos = 0; this.limbAmt = 0; this.prevLimbPos = 0; this.prevLimbAmt = 0;
    this.speed = 0; // horizontal speed in blocks/second, for the debug screen
  }

  box() {
    const p = this.pos;
    const hw = this.hw;
    return { x0: p.x - hw, y0: p.y, z0: p.z - hw, x1: p.x + hw, y1: p.y + this.h, z1: p.z + hw };
  }

  setPos(x, y, z) {
    this.pos = { x, y, z }; this.prev = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
  }

  collect(b, dx, dy, dz) {
    const x0 = Math.floor(Math.min(b.x0, b.x0 + dx) - 1e-7), x1 = Math.floor(Math.max(b.x1, b.x1 + dx) + 1e-7);
    const y0 = Math.floor(Math.min(b.y0, b.y0 + dy) - 1e-7), y1 = Math.floor(Math.max(b.y1, b.y1 + dy) + 1e-7);
    const z0 = Math.floor(Math.min(b.z0, b.z0 + dz) - 1e-7), z1 = Math.floor(Math.max(b.z1, b.z1 + dz) + 1e-7);
    const out = [];
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (SOLID[this.world.getBlock(x, y, z)]) out.push(x, y, z);
    }
    return out;
  }

  noCollision(b) {
    const x0 = Math.floor(b.x0), x1 = Math.floor(b.x1 - 1e-7);
    const y0 = Math.floor(b.y0), y1 = Math.floor(b.y1 - 1e-7);
    const z0 = Math.floor(b.z0), z1 = Math.floor(b.z1 - 1e-7);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (SOLID[this.world.getBlock(x, y, z)]) return false;
    }
    return true;
  }

  // Minecraft's maybeBackOffFromEdge: while sneaking on ground, don't step off ledges
  sneakClamp(dx, dz) {
    const st = 0.05;
    const free = (ox, oz) => { const b = this.box(); offset(b, ox, -STEP, oz); return this.noCollision(b); };
    const shrink = v => (Math.abs(v) < st ? 0 : v - Math.sign(v) * st);
    while (dx !== 0 && free(dx, 0)) dx = shrink(dx);
    while (dz !== 0 && free(0, dz)) dz = shrink(dz);
    while (dx !== 0 && dz !== 0 && free(dx, dz)) { dx = shrink(dx); dz = shrink(dz); }
    return [dx, dz];
  }

  move(dx, dy, dz) {
    if (this.sneaking && this.onGround && !this.flying) [dx, dz] = this.sneakClamp(dx, dz);
    const ox = dx, oy = dy, oz = dz;
    let b = this.box();
    const boxes = this.collect(b, dx, dy, dz);
    dy = clipY(boxes, b, dy); offset(b, 0, dy, 0);
    dx = clipX(boxes, b, dx); offset(b, dx, 0, 0);
    dz = clipZ(boxes, b, dz); offset(b, 0, 0, dz);

    const grounded = this.onGround || (oy !== dy && oy < 0);
    if (grounded && (ox !== dx || oz !== dz)) {
      // Step-up: try the same move lifted by 0.6 blocks, keep it if it goes further
      const sb = this.box();
      const sboxes = this.collect(sb, ox, STEP, oz);
      const sy = clipY(sboxes, sb, STEP); offset(sb, 0, sy, 0);
      const sx = clipX(sboxes, sb, ox); offset(sb, sx, 0, 0);
      const sz = clipZ(sboxes, sb, oz); offset(sb, 0, 0, sz);
      const down = clipY(sboxes, sb, -sy + (oy < 0 ? oy : 0)); offset(sb, 0, down, 0);
      if (sx * sx + sz * sz > dx * dx + dz * dz + 1e-9) { b = sb; dx = sx; dz = sz; dy = sy + down; }
    }

    this.pos.x = (b.x0 + b.x1) / 2; this.pos.y = b.y0; this.pos.z = (b.z0 + b.z1) / 2;
    this.hColl = ox !== dx || oz !== dz;
    this.onGround = oy !== dy && oy < 0;
    if (ox !== dx) this.vel.x = 0;
    if (oz !== dz) this.vel.z = 0;
    if (oy !== dy) this.vel.y = 0;
  }

  checkWater() {
    const b = this.box();
    const x0 = Math.floor(b.x0 + 0.001), x1 = Math.floor(b.x1 - 0.001);
    const y0 = Math.floor(b.y0 + 0.001), y1 = Math.floor(b.y1 - 0.001);
    const z0 = Math.floor(b.z0 + 0.001), z1 = Math.floor(b.z1 - 0.001);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (this.world.getBlock(x, y, z) !== B.water) continue;
      const top = y + (this.world.getBlock(x, y + 1, z) === B.water ? 1 : 0.875);
      if (top > b.y0) return true;
    }
    return false;
  }

  eyeInWater(eyeY) {
    const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z), y = Math.floor(eyeY);
    if (this.world.getBlock(x, y, z) !== B.water) return false;
    const top = y + (this.world.getBlock(x, y + 1, z) === B.water ? 1 : 0.875);
    return eyeY < top;
  }

  moveRelative(xxa, zza, speed) {
    let l = xxa * xxa + zza * zza;
    if (l < 1e-7) return;
    l = l > 1 ? Math.sqrt(l) : 1;
    const s = (xxa / l) * speed, w = (zza / l) * speed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    this.vel.x += -w * sin + s * cos;
    this.vel.z += -w * cos - s * sin;
  }

  jump() {
    this.vel.y = 0.42;
    if (this.sprinting) {
      this.vel.x += -Math.sin(this.yaw) * 0.2;
      this.vel.z += -Math.cos(this.yaw) * 0.2;
    }
  }

  tick(inp) {
    const p = this.pos;
    this.prev = { x: p.x, y: p.y, z: p.z };
    this.prevEye = this.eye; this.prevWalkDist = this.walkDist; this.prevBob = this.bob;
    this.prevLimbPos = this.limbPos; this.prevLimbAmt = this.limbAmt;
    if (!this.world.getChunk(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4)) return;

    const v = this.vel;
    if (Math.abs(v.x) < 0.003) v.x = 0;
    if (Math.abs(v.y) < 0.003) v.y = 0;
    if (Math.abs(v.z) < 0.003) v.z = 0;

    // Analog input (touch joystick) or keys
    const fwd = inp.moveZ ?? ((inp.forward ? 1 : 0) - (inp.back ? 1 : 0));
    const str = inp.moveX ?? ((inp.right ? 1 : 0) - (inp.left ? 1 : 0));
    this.sneaking = inp.sneak && !this.flying;
    if (inp.sprint && fwd > 0 && !this.sneaking) this.sprinting = true;
    if (fwd <= 0 || this.sneaking || (this.hColl && !this.flying)) this.sprinting = false;

    const amount = inp.amount ?? 0.98;
    let xxa = str * amount, zza = fwd * amount;
    if (this.sneaking) { xxa *= 0.3; zza *= 0.3; }

    this.inWater = !this.flying && this.checkWater();
    if (this.flying) {
      if (inp.jump) v.y += 0.15;
      if (inp.sneak) v.y -= 0.15;
    } else if (inp.jump) {
      if (this.inWater) v.y += 0.04;
      else if (this.onGround && this.jumpDelay === 0) { this.jump(); this.jumpDelay = 10; }
    } else this.jumpDelay = 0;
    if (this.jumpDelay > 0) this.jumpDelay--;

    this.travel(xxa, zza);
    if (this.flying && this.onGround) this.flying = false;

    const targetEye = this.sneaking ? 1.27 : 1.62; // only meaningful for the player
    this.eye += (targetEye - this.eye) * 0.5;

    const dx = p.x - this.prev.x, dz = p.z - this.prev.z;
    const hd = Math.sqrt(dx * dx + dz * dz);
    this.speed = hd * 20;
    this.walkDist += hd * 0.6;
    const bobT = this.onGround && !this.flying ? Math.min(0.1, hd) : 0;
    this.bob += (bobT - this.bob) * 0.4;
    const ls = Math.min(hd * 4, 1);
    this.limbAmt += (ls - this.limbAmt) * 0.4;
    this.limbPos += this.limbAmt;
  }

  travel(xxa, zza) {
    const v = this.vel;
    if (this.flying) {
      const dy0 = v.y;
      this.moveRelative(xxa, zza, this.sprinting ? 0.1 : 0.05);
      this.move(v.x, v.y, v.z);
      v.y = dy0 * 0.6; v.x *= 0.91; v.z *= 0.91;
      return;
    }
    if (this.inWater) {
      this.moveRelative(xxa, zza, 0.02);
      this.move(v.x, v.y, v.z);
      const f = this.sprinting ? 0.9 : 0.8;
      v.x *= f; v.y *= 0.8; v.z *= f;
      v.y -= 0.005;
      if (this.hColl) {
        const b = this.box(); offset(b, v.x, 0.6, v.z);
        if (this.noCollision(b)) v.y = 0.3;
      }
      return;
    }
    const slip = this.onGround
      ? SLIP[this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5000001), Math.floor(this.pos.z))]
      : 1;
    const f = this.onGround ? slip * 0.91 : 0.91;
    const speed = this.onGround
      ? this.speedAttr * (this.sprinting ? 1.3 : 1) * (0.21600002 / (slip * slip * slip))
      : (this.sprinting ? 0.026 : 0.02);
    this.moveRelative(xxa, zza, speed);
    this.move(v.x, v.y, v.z);
    v.y = (v.y - 0.08) * 0.98;
    if (this.slowFall && !this.onGround && v.y < 0) v.y *= 0.6; // chicken
    v.x *= f; v.z *= f;
  }
}
