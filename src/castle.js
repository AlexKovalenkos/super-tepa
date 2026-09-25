// Fairy-tale castle (Disney / Neuschwanstein style) built from blocks.
// Local coordinates: x/z centred on the castle, y = 0 is the courtyard floor. The gate faces +z (towards spawn).
import { B } from './blocks.js';

export const CASTLE = {
  PLATEAU: 27,  // square plateau half-size (Chebyshev distance)
  MOAT: 35,     // moat from PLATEAU+1 to MOAT (8 blocks wide, room for the whale)
  BLEND: 48,    // terrain blends back to natural up to here
};

export function buildCastle() {
  const m = new Map(); // packed key -> block id
  const key = (x, y, z) => ((x + 128) * 256 + (z + 128)) * 256 + y;
  const set = (x, y, z, id) => { if (y >= 0 && y < 250) m.set(key(Math.round(x), y, Math.round(z)), id); };
  const get = (x, y, z) => m.get(key(x, y, z));
  const W = B.white_stone, P = B.pink_stone, R = B.blue_roof, Au = B.gold_block, Gl = B.window;
  const F = B.planks, SB = B.stone_bricks, L = B.glowstone, AIR = 0;

  const fill = (x0, y0, z0, x1, y1, z1, id) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, id);
  };
  const disk = (cx, cz, y, r, id) => {
    const R2 = (r + 0.5) * (r + 0.5);
    for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = (x - cx) ** 2 + (z - cz) ** 2;
      if (d <= R2) set(x, y, z, id);
    }
  };
  const ring = (cx, cz, y, r, id, t = 1.2) => {
    for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
      if (d <= r + 0.5 && d > r + 0.5 - t) set(x, y, z, id);
    }
  };

  // Conical roof with a gold spire, like the blue Disney turrets
  const cone = (cx, cz, y0, r, steep = 2.6) => {
    const hgt = Math.round((r + 1) * steep);
    for (let k = 0; k < hgt; k++) {
      const rr = (r + 1) * (1 - k / hgt);
      if (rr < 1.2) set(cx, y0 + k, cz, R);
      else ring(cx, cz, y0 + k, rr, R, 1.6);
    }
    set(cx, y0 + hgt, cz, Au);
    set(cx, y0 + hgt + 1, cz, Au);
    set(cx, y0 + hgt + 2, cz, B.torch);
    return y0 + hgt + 2;
  };

  // Round tower: hollow walls, windows, floors with lights, pink band, battlement, cone roof
  const tower = (cx, cz, y0, height, r, steep) => {
    const top = y0 + height;
    for (let y = y0; y < top; y++) {
      ring(cx, cz, y, r, (y - y0) % 7 === 6 || y === top - 2 ? P : W);
      const ly = (y - y0) % 7;
      if ((ly === 3 || ly === 4) && y > y0 + 2) {
        for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) set(cx + dx, y, cz + dz, Gl);
      }
      if (ly === 0 && y > y0) { disk(cx, cz, y, r - 1, F); set(cx, y + 3, cz, L); }
    }
    ring(cx, cz, top, r + 1, W, 2.2);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      if (a % 2 === 0) set(cx + Math.cos(ang) * (r + 1), top + 1, cz + Math.sin(ang) * (r + 1), W);
    }
    return cone(cx, cz, top + 1, r, steep);
  };

  // Rectangular hall with windows, floors, lights and a stepped blue roof
  const hall = (x0, z0, x1, z1, y0, height) => {
    const top = y0 + height;
    for (let y = y0; y < top; y++) {
      const band = (y - y0) % 7 === 6 || y === top - 1;
      for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) set(x, y, z, band ? P : W);
      for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) set(x, y, z, band ? P : W);
      const ly = (y - y0) % 7;
      if (ly >= 2 && ly <= 4) {
        for (let x = x0 + 2; x <= x1 - 2; x += 3) { set(x, y, z0, Gl); set(x, y, z1, Gl); }
        for (let z = z0 + 2; z <= z1 - 2; z += 3) { set(x0, y, z, Gl); set(x1, y, z, Gl); }
      }
      if (ly === 0 && y > y0) {
        fill(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, F);
        for (let x = x0 + 3; x < x1; x += 5) for (let z = z0 + 3; z < z1; z += 5) set(x, y + 4, z, L);
      }
    }
    for (let x = x0 + 3; x < x1; x += 5) for (let z = z0 + 3; z < z1; z += 5) set(x, y0 + 4, z, L);
    // stepped hip roof
    for (let k = 0; ; k++) {
      const a = x0 - 1 + k, b = x1 + 1 - k, c = z0 - 1 + k, d = z1 + 1 - k;
      if (a > b || c > d) break;
      for (let x = a; x <= b; x++) { set(x, top + k, c, R); set(x, top + k, d, R); }
      for (let z = c; z <= d; z++) { set(a, top + k, z, R); set(b, top + k, z, R); }
      if (a === b || c === d) { for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) set(x, top + k, z, R); break; }
    }
    return top;
  };

  // ---- Courtyard and foundation ----
  fill(-27, 0, -27, 27, 0, 27, SB);

  // ---- Curtain wall ----
  const WR = 22;
  for (let y = 1; y <= 9; y++) {
    for (let t = -WR; t <= WR; t++) for (const s of [WR, WR - 1]) {
      const id = y === 8 ? P : W;
      set(t, y, s, id); set(t, y, -s, id); set(s, y, t, id); set(-s, y, t, id);
    }
  }
  for (let t = -WR; t <= WR; t += 2) { set(t, 10, WR, W); set(t, 10, -WR, W); set(WR, 10, t, W); set(-WR, 10, t, W); }
  for (let t = -WR + 4; t <= WR - 4; t += 8) { set(t, 10, WR - 1, L); set(t, 10, -WR + 1, L); set(WR - 1, 10, t, L); set(-WR + 1, 10, t, L); }
  // Gate arch
  for (let y = 1; y <= 6; y++) for (let x = -3; x <= 3; x++) {
    const inside = y <= 5 ? Math.abs(x) <= 2 : Math.abs(x) <= 1;
    if (inside) { set(x, y, WR, AIR); set(x, y, WR - 1, AIR); }
  }
  for (let x = -2; x <= 2; x++) set(x, 8, WR, Au);
  set(0, 9, WR, Au);

  // Corner and gate towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * WR, sz * WR, 1, 17, 4, 2.4);
  tower(-6, WR + 1, 1, 15, 3, 2.8);
  tower(6, WR + 1, 1, 15, 3, 2.8);

  // Bridge over the moat
  for (let z = WR + 1; z <= CASTLE.MOAT + 2; z++) {
    for (let x = -2; x <= 2; x++) set(x, 0, z, F);
    if (z > 27) { set(-3, 1, z, W); set(3, 1, z, W); if (z % 3 === 0) { set(-3, 2, z, L); set(3, 2, z, L); } }
  }

  // ---- Palace ----
  hall(-13, -16, 13, 4, 1, 21);
  // Entrance
  for (let y = 1; y <= 5; y++) for (let x = -2; x <= 2; x++) if (y < 5 || Math.abs(x) < 2) set(x, y, 4, AIR);
  for (let x = -3; x <= 3; x++) set(x, 6, 4, Au);
  // Steps to the door
  fill(-3, 0, 5, 3, 0, 7, W);

  // Palace towers
  for (const sx of [-1, 1]) {
    tower(sx * 13, -16, 1, 30, 3, 3.0);
    tower(sx * 13, 4, 1, 27, 3, 3.0);
    tower(sx * 7, 5, 1, 25, 2, 3.4);
    tower(sx * 8, -6, 18, 20, 3, 3.2);
    tower(sx * 6, -14, 18, 16, 2, 3.4);
  }

  // Grand central tower with a pink balcony and a tall spire
  const cx = 0, cz = -6;
  for (let y = 1; y <= 34; y++) {
    ring(cx, cz, y, 5, y % 7 === 6 ? P : W);
    const ly = y % 7;
    if ((ly === 3 || ly === 4) && y > 22) for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) set(cx + dx, y, cz + dz, Gl);
  }
  for (let y = 22; y <= 34; y += 6) { disk(cx, cz, y, 4, F); set(cx, y + 3, cz, L); }
  disk(cx, cz, 35, 7, P);
  ring(cx, cz, 36, 7, W, 1.2);
  for (let a = 0; a < 24; a += 2) set(cx + Math.cos(a / 24 * Math.PI * 2) * 7, 37, cz + Math.sin(a / 24 * Math.PI * 2) * 7, Au);
  for (let y = 36; y <= 46; y++) {
    ring(cx, cz, y, 3, y === 46 ? P : W);
    if (y === 40 || y === 41) for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) set(cx + dx, y, cz + dz, Gl);
  }
  set(cx, 38, cz, L);
  cone(cx, cz, 47, 4, 3.6);

  // ---- Courtyard garden and lamps ----
  for (const [x, z] of [[-10, 12], [10, 12], [-17, 12], [17, 12], [-10, 18], [10, 18], [-17, 0], [17, 0], [-17, -12], [17, -12]]) {
    set(x, 1, z, W); set(x, 2, z, W); set(x, 3, z, L);
  }
  for (let z = 8; z <= 20; z++) for (let x = -20; x <= 20; x++) {
    if (Math.abs(x) <= 3 || get(x, 1, z) !== undefined) continue;
    const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
    if (h % 7 === 0) { set(x, 0, z, B.grass); set(x, 1, z, h % 2 ? B.poppy : B.dandelion); }
    else if (h % 5 === 0) { set(x, 0, z, B.grass); set(x, 1, z, B.short_grass); }
    else if (h % 3 === 0) set(x, 0, z, B.grass);
  }

  // Unpack into a list
  const out = [];
  for (const [k, id] of m) {
    const y = k % 256, xz = Math.floor(k / 256);
    out.push([Math.floor(xz / 256) - 128, y, (xz % 256) - 128, id]);
  }
  return out;
}
