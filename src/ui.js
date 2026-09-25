// DOM interface: title screen, hotbar, block icons, inventory, pause menu, debug screen.
import { BLOCKS, FACE_TILE, SHAPE, INVENTORY_BLOCKS } from './blocks.js';

const $ = id => document.getElementById(id);

// Isometric inventory icon drawn from the atlas, like Minecraft's block items
export function makeIcons(atlasCanvas) {
  const icons = {};
  for (const id of INVENTORY_BLOCKS) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tile = f => { const t = FACE_TILE[id * 6 + f]; return [(t & 15) * 16, (t >> 4) * 16]; };
    if (SHAPE[id] !== 0) {
      const [sx, sy] = tile(0);
      ctx.drawImage(atlasCanvas, sx, sy, 16, 16, 4, 4, 56, 56);
    } else {
      const face = (f, a, b, c, d, e, g, dark) => {
        const [sx, sy] = tile(f);
        ctx.setTransform(a, b, c, d, e, g);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
        if (dark) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(0,0,0,${dark})`;
          ctx.fillRect(0, 0, 16, 16);
        }
      };
      face(2, 28 / 16, -14 / 16, 28 / 16, 14 / 16, 4, 18, 0);        // top
      face(4, 28 / 16, 14 / 16, 0, 28 / 16, 4, 18, 0.25);            // left
      face(0, 28 / 16, -14 / 16, 0, 28 / 16, 32, 32, 0.45);          // right
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    icons[id] = cv.toDataURL();
  }
  return icons;
}

export class UI {
  constructor(icons) {
    this.icons = icons;
    this.nameTimer = null;
    this.hotbarEl = $('hotbar');
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      const img = document.createElement('img');
      s.appendChild(img);
      this.hotbarEl.appendChild(s);
      this.slots.push(s);
    }
    const grid = $('inv-grid');
    this.invCells = [];
    for (const id of INVENTORY_BLOCKS) {
      const c = document.createElement('div');
      c.className = 'slot inv-cell';
      c.title = BLOCKS[id].name;
      c.dataset.id = id;
      const img = document.createElement('img');
      img.src = icons[id];
      c.appendChild(img);
      grid.appendChild(c);
      this.invCells.push(c);
    }
  }

  setHotbar(items, sel) {
    items.forEach((id, i) => {
      const img = this.slots[i].firstChild;
      if (id) { img.src = this.icons[id]; img.style.visibility = 'visible'; } else img.style.visibility = 'hidden';
      this.slots[i].classList.toggle('selected', i === sel);
    });
  }

  showItemName(id) {
    const el = $('item-name');
    el.textContent = id ? BLOCKS[id].name : '';
    el.classList.remove('fade');
    void el.offsetWidth;
    el.classList.add('fade');
  }

  show(id, on) { $(id).classList.toggle('hidden', !on); }

  setDebug(text) {
    const el = $('debug');
    if (text == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.textContent = text;
  }
}
