// Procedural 16x16 pixel-art block textures packed into a 256x256 atlas.
// Everything is drawn in code: no Mojang assets are used.
import { mulberry32 } from './noise.js';

export const TILE_NAMES = [
  'stone', 'dirt', 'grass_top', 'grass_side', 'cobblestone', 'planks', 'bedrock', 'sand',
  'gravel', 'oak_log', 'oak_log_top', 'oak_leaves', 'glass', 'water', 'coal_ore', 'iron_ore',
  'bricks', 'snow', 'birch_log', 'birch_log_top', 'birch_leaves', 'glowstone', 'torch', 'wool_white',
  'wool_red', 'wool_blue', 'wool_yellow', 'wool_green', 'wool_black', 'gold_block', 'sandstone_top', 'sandstone_side',
  'sandstone_bottom', 'stone_bricks', 'ice', 'short_grass', 'dandelion', 'poppy', 'white_stone', 'pink_stone',
  'blue_roof', 'window', 'fx_white', 'fx_heart', 'fx_spark', 'fx_note',
];
export const TILE = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));

const j = (rnd, a) => (rnd() - 0.5) * a;
const pick = (rnd, pal) => pal[(rnd() * pal.length) | 0];
function each(fn) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) fn(x, y); }
function palFill(px, rnd, pal, n = 8) {
  each((x, y) => { const c = pick(rnd, pal); const d = j(rnd, n); px(x, y, c[0] + d, c[1] + d, c[2] + d); });
}
function shade(px, x, y, c, d) { px(x, y, c[0] + d, c[1] + d, c[2] + d); }

const DIRT = [[134, 96, 67], [121, 85, 58], [150, 108, 74], [108, 76, 52], [143, 103, 72]];
const GRASS = [[104, 166, 58], [93, 152, 50], [117, 180, 70], [84, 140, 44], [110, 172, 64]];
const BARK = [[104, 82, 48], [88, 68, 39], [122, 97, 58], [74, 57, 33], [96, 75, 44]];

const P = {};

P.stone = (px, rnd) => each((x, y) => {
  let c = 124 + j(rnd, 10);
  const r = rnd();
  if (r < 0.13) c = 104 + j(rnd, 8); else if (r < 0.21) c = 142 + j(rnd, 8);
  px(x, y, c, c, c);
});

P.dirt = (px, rnd) => {
  palFill(px, rnd, DIRT, 6);
  for (let i = 0; i < 9; i++) px((rnd() * 16) | 0, (rnd() * 16) | 0, 170, 130, 96);
  for (let i = 0; i < 9; i++) px((rnd() * 16) | 0, (rnd() * 16) | 0, 92, 64, 44);
};

P.grass_top = (px, rnd) => palFill(px, rnd, GRASS, 8);

P.grass_side = (px, rnd) => {
  P.dirt(px, rnd);
  for (let x = 0; x < 16; x++) {
    const len = 3 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
    for (let y = 0; y < len; y++) shade(px, x, y, y === len - 1 ? [82, 136, 42] : pick(rnd, GRASS), j(rnd, 8));
  }
};

P.sand = (px, rnd) => {
  palFill(px, rnd, [[219, 207, 163], [213, 200, 155], [226, 214, 172], [208, 195, 150]], 6);
  for (let i = 0; i < 10; i++) px((rnd() * 16) | 0, (rnd() * 16) | 0, 196, 180, 134);
};

P.gravel = (px, rnd) => palFill(px, rnd, [[136, 126, 126], [115, 108, 106], [152, 144, 142], [98, 92, 90], [128, 116, 108], [145, 128, 112]], 10);

P.bedrock = (px, rnd) => palFill(px, rnd, [[85, 85, 85], [52, 52, 52], [118, 118, 118], [32, 32, 32], [70, 70, 70]], 10);

P.cobblestone = (px, rnd) => {
  const pts = [];
  for (let i = 0; i < 11; i++) pts.push([rnd() * 16, rnd() * 16, 105 + rnd() * 45]);
  each((x, y) => {
    let d1 = 1e9, d2 = 1e9, c = 0;
    for (const p of pts) {
      for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const dx = x + 0.5 - (p[0] + ox), dy = y + 0.5 - (p[1] + oy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; c = p[2]; } else if (d < d2) d2 = d;
      }
    }
    if (d2 - d1 < 1.2) { const m = 70 + j(rnd, 10); px(x, y, m, m, m); }
    else { const s = c + j(rnd, 14) - d1 * 2.5; px(x, y, s, s, s); }
  });
};

P.oak_log = (px, rnd) => {
  for (let x = 0; x < 16; x++) {
    const base = pick(rnd, BARK);
    for (let y = 0; y < 16; y++) shade(px, x, y, rnd() < 0.22 ? pick(rnd, BARK) : base, j(rnd, 8));
  }
};

function logTop(px, rnd, bark, ringA, ringB) {
  each((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    const c = d > 6.9 ? bark : (Math.floor(d) % 2 ? ringA : ringB);
    shade(px, x, y, c, j(rnd, 8));
  });
}
P.oak_log_top = (px, rnd) => logTop(px, rnd, [92, 72, 42], [176, 140, 86], [154, 121, 72]);

P.planks = (px, rnd) => {
  const joints = [11, 3, 13, 6];
  each((x, y) => {
    const row = y >> 2;
    let c;
    if (y % 4 === 3) c = [115, 90, 52];
    else if (x === joints[row]) c = [126, 99, 58];
    else {
      const g = ((x * 7 + row * 13 + ((x >> 2) + row) * 5) % 5) - 2;
      c = [160 + g * 4, 128 + g * 3, 76 + g * 2];
    }
    shade(px, x, y, c, j(rnd, 6));
  });
};

function leaves(px, rnd, pal) {
  each((x, y) => {
    if (rnd() < 0.2) { px(x, y, 0, 0, 0, 0); return; }
    const c = pick(rnd, pal); px(x, y, c[0], c[1], c[2]);
  });
}
P.oak_leaves = (px, rnd) => leaves(px, rnd, [[58, 122, 30], [48, 104, 24], [70, 140, 38], [40, 90, 20], [64, 130, 34]]);
P.birch_leaves = (px, rnd) => leaves(px, rnd, [[98, 140, 62], [86, 126, 52], [110, 154, 72], [76, 112, 44]]);

P.glass = (px) => {
  each((x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) {
      const corner = (x === 0 || x === 15) && (y === 0 || y === 15);
      const c = corner ? [170, 200, 210] : [212, 236, 242];
      px(x, y, c[0], c[1], c[2]);
    } else px(x, y, 255, 255, 255, 0);
  });
  [[3, 5], [4, 4], [5, 3], [9, 12], [10, 11], [11, 10], [12, 9], [4, 6]].forEach(([x, y]) => px(x, y, 240, 250, 255));
};

P.water = (px, rnd) => each((x, y) => {
  const c = pick(rnd, [[50, 86, 210], [44, 78, 200], [58, 98, 222], [48, 82, 206]]);
  px(x, y, c[0], c[1], c[2], 180);
});

function ore(px, rnd, col, hi) {
  P.stone(px, rnd);
  for (let k = 0; k < 5; k++) {
    const cx = 1 + ((rnd() * 13) | 0), cy = 1 + ((rnd() * 13) | 0);
    const n = 3 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) px(cx + ((rnd() * 3) | 0) - 1, cy + ((rnd() * 3) | 0) - 1, col[0], col[1], col[2]);
    px(cx, cy, hi[0], hi[1], hi[2]);
  }
}
P.coal_ore = (px, rnd) => ore(px, rnd, [38, 38, 38], [70, 70, 70]);
P.iron_ore = (px, rnd) => ore(px, rnd, [216, 175, 147], [180, 138, 108]);

P.bricks = (px, rnd) => {
  const pal = [[150, 72, 56], [140, 64, 50], [160, 82, 64], [132, 62, 48]];
  each((x, y) => {
    const row = y >> 2, xo = x + (row % 2) * 4;
    const mortar = y % 4 === 3 || xo % 8 === 7;
    const c = mortar ? [168, 160, 152] : pal[((row * 4 + (xo >> 3)) * 7) % 4];
    shade(px, x, y, c, j(rnd, 10));
  });
};

P.stone_bricks = (px, rnd) => each((x, y) => {
  const row = y >> 3, xo = (x + (row % 2) * 8) % 16, yo = y % 8;
  let c = 122;
  if (yo === 7 || xo === 15) c = 78;
  else if (yo === 0 || xo === 0) c = 138;
  else if (yo === 6 || xo === 14) c = 104;
  c += j(rnd, 8);
  px(x, y, c, c, c);
});

P.snow = (px, rnd) => {
  palFill(px, rnd, [[244, 251, 251], [236, 245, 248], [250, 255, 255]], 4);
  for (let i = 0; i < 8; i++) px((rnd() * 16) | 0, (rnd() * 16) | 0, 214, 228, 236);
};

P.birch_log = (px, rnd) => {
  palFill(px, rnd, [[216, 216, 208], [228, 228, 222], [204, 204, 196]], 6);
  for (let i = 0; i < 7; i++) {
    const x0 = (rnd() * 16) | 0, y = (rnd() * 16) | 0, len = 2 + ((rnd() * 3) | 0);
    for (let k = 0; k < len; k++) px((x0 + k) & 15, y, 44, 44, 40);
  }
};
P.birch_log_top = (px, rnd) => logTop(px, rnd, [216, 216, 208], [196, 176, 122], [182, 160, 108]);

P.glowstone = (px, rnd) => palFill(px, rnd, [[255, 236, 160], [232, 184, 96], [204, 146, 68], [255, 248, 206], [240, 206, 120]], 10);

P.torch = (px) => {
  for (let y = 8; y < 16; y++) { px(7, y, 120, 90, 52); px(8, y, 96, 70, 40); }
  px(7, 6, 255, 255, 190); px(8, 6, 255, 222, 100);
  px(7, 7, 255, 214, 90); px(8, 7, 240, 170, 60);
};

function wool(c) {
  return (px, rnd) => each((x, y) => {
    const k = ((x + y * 3) % 4 === 0) ? -14 : ((x * 3 + y) % 5 === 0 ? 10 : 0);
    shade(px, x, y, c, j(rnd, 8) + k);
  });
}
P.wool_white = wool([222, 222, 222]);
P.wool_red = wool([160, 39, 34]);
P.wool_blue = wool([53, 57, 157]);
P.wool_yellow = wool([248, 197, 39]);
P.wool_green = wool([84, 109, 27]);
P.wool_black = wool([28, 25, 25]);

P.gold_block = (px, rnd) => each((x, y) => {
  let c = [246, 208, 61];
  if (x === 0 || y === 0) c = [255, 240, 140];
  else if (x === 15 || y === 15) c = [200, 158, 30];
  shade(px, x, y, c, j(rnd, 10));
});

P.sandstone_top = (px, rnd) => palFill(px, rnd, [[224, 212, 164], [218, 205, 156], [230, 219, 172]], 4);
P.sandstone_bottom = (px, rnd) => palFill(px, rnd, [[208, 193, 140], [200, 186, 132]], 4);
P.sandstone_side = (px, rnd) => each((x, y) => {
  let c;
  if (y < 3) c = [228, 216, 168];
  else if (y === 3 || y === 12) c = [198, 182, 128];
  else if (y < 12) c = [216, 202, 150];
  else c = [208, 193, 140];
  shade(px, x, y, c, j(rnd, 6));
});

P.ice = (px, rnd) => {
  each((x, y) => {
    const c = pick(rnd, [[146, 184, 252], [132, 172, 246], [160, 196, 255]]);
    px(x, y, c[0], c[1], c[2], 190);
  });
  [[2, 3], [3, 2], [4, 1], [9, 10], [10, 9], [11, 8], [12, 7], [6, 13], [7, 12]].forEach(([x, y]) => px(x, y, 235, 245, 255, 220));
};

P.short_grass = (px, rnd) => {
  for (let b = 0; b < 9; b++) {
    const x = 1 + ((rnd() * 14) | 0), h = 5 + ((rnd() * 9) | 0), lean = rnd() < 0.5 ? -1 : 1;
    for (let i = 0; i < h; i++) {
      const c = i > h - 3 ? [120, 190, 80] : [80, 150, 50];
      shade(px, x + (i > h * 0.6 ? lean : 0), 15 - i, c, j(rnd, 10));
    }
  }
};

function flower(px, rnd, petal, dark, center) {
  for (let y = 9; y < 16; y++) px(7, y, 70, 130, 40);
  [[6, 13], [8, 12], [5, 14], [9, 14], [6, 12]].forEach(([x, y]) => px(x, y, 84, 150, 50));
  for (let y = 5; y < 9; y++) for (let x = 6; x < 10; x++) {
    if ((x === 6 || x === 9) && (y === 5 || y === 8)) continue;
    const c = rnd() < 0.3 ? dark : petal;
    px(x, y, c[0], c[1], c[2]);
  }
  if (center) { px(7, 6, ...center); px(8, 7, ...center); }
}
P.dandelion = (px, rnd) => flower(px, rnd, [255, 236, 40], [224, 190, 20], null);
P.poppy = (px, rnd) => flower(px, rnd, [222, 32, 32], [170, 20, 20], [40, 20, 20]);

// Castle blocks: smooth fairy-tale stone bricks, scalloped roof tiles, stained glass
function castleBricks(px, rnd, base, line) {
  each((x, y) => {
    const row = y >> 2, xo = (x + (row % 2) * 4) & 15;
    shade(px, x, y, (y % 4 === 3 || xo % 8 === 7) ? line : base, j(rnd, 6));
  });
}
P.white_stone = (px, rnd) => castleBricks(px, rnd, [238, 233, 222], [208, 201, 188]);
P.pink_stone = (px, rnd) => castleBricks(px, rnd, [236, 170, 192], [206, 138, 162]);
P.blue_roof = (px, rnd) => each((x, y) => {
  const row = y >> 2, xo = (x + (row % 2) * 2) % 4, yo = y % 4;
  let c = [58, 98, 200];
  if (yo === 3) c = [34, 62, 140];
  else if (xo === 3) c = [44, 78, 170];
  else if (yo === 0) c = [92, 134, 228];
  shade(px, x, y, c, j(rnd, 8));
});
P.window = (px) => each((x, y) => {
  if (x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || y === 7) px(x, y, 238, 233, 222, 255);
  else px(x, y, 120, 170, 240, 150);
});

// Particle sprites
P.fx_white = (px) => each((x, y) => px(x, y, 255, 255, 255));
function sprite(rows, px, col) {
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    const c = col[ch];
    for (let k = 0; k < 4; k++) px(x * 2 + (k & 1) + 1, y * 2 + (k >> 1) + 1, c[0], c[1], c[2]);
  }));
}
P.fx_heart = (px) => sprite(['.RR.RR.', 'RWRRRRR', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], px, { R: [232, 40, 70], W: [255, 200, 210] });
P.fx_spark = (px) => sprite(['...W...', '...W...', '..WYW..', 'WWYYYWW', '..WYW..', '...W...', '...W...'], px, { W: [255, 255, 255], Y: [255, 240, 150] });
P.fx_note = (px) => sprite(['..WWWW.', '..W..W.', '..W..W.', '..W..W.', 'WWW.WWW', 'WWW.WWW'], px, { W: [255, 255, 255] });

// Builds the atlas canvas (16 tiles per row)
export function createAtlasCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  TILE_NAMES.forEach((name, i) => {
    const img = ctx.createImageData(16, 16);
    const d = img.data;
    const rnd = mulberry32(1000 + i * 7919);
    const px = (x, y, r, g, b, a = 255) => {
      if (x < 0 || y < 0 || x > 15 || y > 15) return;
      const o = (y * 16 + x) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
    };
    P[name](px, rnd);
    ctx.putImageData(img, (i % 16) * 16, Math.floor(i / 16) * 16);
  });
  return cv;
}
