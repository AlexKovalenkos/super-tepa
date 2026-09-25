// Helpers for Minecraft-style box models: pixel-art canvas textures, boxes measured in pixels, pivots.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = (x, y, c, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] ?? a;
  };
  paint(px, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// Mottled fur / skin: base colour with darker and lighter speckles
export function fur(seed, base, dark, light, rate = 0.16) {
  dark = dark || base.map(v => v - 22);
  light = light || base.map(v => v + 18);
  return (px, w, h) => {
    const rnd = mulberry32(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = rnd();
      const c = r < rate ? dark : r < rate * 1.9 ? light : base;
      const n = (rnd() - 0.5) * 10;
      px(x, y, [c[0] + n, c[1] + n, c[2] + n]);
    }
  };
}
export const flat = (c, seed = 1) => fur(seed, c, c.map(v => v - 12), c.map(v => v + 8), 0.12);

// Layer a painter on top of another
export const over = (a, b) => (px, w, h) => { a(px, w, h); b(px, w, h); };

// Box of w x h x d pixels; faces {px,nx,py,ny,pz,nz} override the default painter. Front of a mob is -z ("nz").
// All six faces are painted side by side into one texture, so each box is a single draw call.
export function box(w, h, d, faces, def, matOpts = {}) {
  const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const dims = { px: [d, h], nx: [d, h], py: [w, d], ny: [w, d], pz: [w, h], nz: [w, h] };
  const sizes = order.map(f => dims[f].map(v => Math.max(1, Math.round(v))));
  const W = sizes.reduce((s, [fw]) => s + fw + 1, 0), H = Math.max(...sizes.map(([, fh]) => fh));
  const offs = [];
  let ox = 0;
  for (const [fw] of sizes) { offs.push(ox); ox += fw + 1; }
  const map = canvasTex(W, H, px => {
    order.forEach((f, i) => {
      const [fw, fh] = sizes[i];
      const sub = (x, y, c, a) => { if (x >= 0 && y >= 0 && x < fw && y < fh) px(offs[i] + x, y, c, a); };
      (faces[f] || def)(sub, fw, fh);
    });
  });
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < 6; i++) {
    const [fw, fh] = sizes[i];
    for (let k = 0; k < 4; k++) {
      const j = i * 4 + k;
      uv.setXY(j, (offs[i] + uv.getX(j) * fw) / W, 1 - fh / H + uv.getY(j) * fh / H);
    }
  }
  g.clearGroups();
  const m = new THREE.MeshLambertMaterial({ map, ...matOpts });
  if (matOpts.emissive) m.emissiveMap = map;
  return new THREE.Mesh(g, m);
}

export function pivot(parent, x, y, z, name) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (name) g.name = name;
  parent.add(g);
  return g;
}

// Named parts lookup that also works for clones (cached on the instance, not in userData)
export function parts(root, names) {
  if (!root.__parts) {
    root.__parts = {};
    for (const n of names) root.__parts[n] = root.getObjectByName(n) || null;
  }
  return root.__parts;
}

// Flat sprite painted from an ASCII grid (wings, membranes)
export function gridPlane(rows, colors, { flipX = false, doubleSide = true, emissive = false } = {}) {
  const W = rows[0].length, H = rows.length;
  const tex = canvasTex(W, H, px => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][flipX ? W - 1 - x : x];
      if (ch === '.') px(x, y, [0, 0, 0], 0); else px(x, y, colors[ch]);
    }
  });
  const g = new THREE.PlaneGeometry(W, H);
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide, alphaTest: 0.5 });
  if (emissive) { mat.emissive = new THREE.Color(0.35, 0.35, 0.35); mat.emissiveMap = tex; }
  return { geometry: g, material: mat, W, H };
}

// Minecraft-style name tag above a mob
export function nameTag(text, sub) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const f1 = 'bold 28px ui-sans-serif, system-ui, sans-serif', f2 = '22px ui-sans-serif, system-ui, sans-serif';
  ctx.font = f1;
  let w = ctx.measureText(text).width;
  if (sub) { ctx.font = f2; w = Math.max(w, ctx.measureText(sub).width); }
  const H = sub ? 70 : 40;
  cv.width = Math.ceil(w + 20); cv.height = H;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = f1; ctx.fillStyle = '#fff'; ctx.fillText(text, cv.width / 2, 5);
  if (sub) { ctx.font = f2; ctx.fillStyle = '#ffe680'; ctx.fillText(sub, cv.width / 2, 40); }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(cv.width / 110, cv.height / 110, 1);
  return s;
}
