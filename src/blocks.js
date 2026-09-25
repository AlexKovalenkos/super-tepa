// Block registry. Flat typed arrays are used on hot paths (meshing, lighting, physics).
import { TILE } from './textures.js';

export const BLOCKS = [];
export const B = {};
export const OPAQUE = new Uint8Array(256);   // full cube that hides neighbours and blocks light
export const SOLID = new Uint8Array(256);    // has collision
export const LIGHT_OP = new Uint8Array(256); // light opacity 0..15
export const EMIT = new Uint8Array(256);     // block light emission
export const SHAPE = new Uint8Array(256);    // 0 cube, 1 cross, 2 torch, 255 air
export const PASS = new Uint8Array(256);     // 0 opaque, 1 cutout, 2 translucent
export const FACE_TILE = new Uint16Array(256 * 6); // face order: +x -x +y -y +z -z
export const SLIP = new Float32Array(256).fill(0.6);
export const CULL_SAME = new Uint8Array(256); // faces between two blocks of this type are hidden (glass, water…)

const SHAPES = { cube: 0, cross: 1, torch: 2 };
const PASSES = { opaque: 0, cutout: 1, translucent: 2 };

BLOCKS[0] = { id: 0, key: 'air', name: 'Воздух', shape: 'air', inv: false };
B.air = 0;
SHAPE[0] = 255;

function def(id, key, name, o) {
  const t = o.tex;
  const f = typeof t === 'string' ? { top: t, bottom: t, side: t } : { top: t.top, bottom: t.bottom ?? t.top, side: t.side };
  const shape = o.shape || 'cube', pass = o.pass || 'opaque';
  const cubeOpaque = shape === 'cube' && pass === 'opaque';
  const b = {
    id, key, name, shape, pass,
    solid: o.solid ?? shape === 'cube',
    opaque: o.opaque ?? cubeOpaque,
    lightOpacity: o.lightOpacity ?? (cubeOpaque ? 15 : 0),
    emit: o.emit || 0,
    slip: o.slip || 0.6,
    inv: o.inv ?? true,
    needsSupport: shape !== 'cube',
  };
  CULL_SAME[id] = o.cullSame ? 1 : 0;
  BLOCKS[id] = b; B[key] = id;
  OPAQUE[id] = b.opaque ? 1 : 0;
  SOLID[id] = b.solid ? 1 : 0;
  LIGHT_OP[id] = b.lightOpacity;
  EMIT[id] = b.emit;
  SHAPE[id] = SHAPES[shape];
  PASS[id] = PASSES[pass];
  SLIP[id] = b.slip;
  [f.side, f.side, f.top, f.bottom, f.side, f.side].forEach((n, i) => {
    if (TILE[n] === undefined) throw new Error('Unknown tile ' + n);
    FACE_TILE[id * 6 + i] = TILE[n];
  });
}

def(1, 'stone', 'Камень', { tex: 'stone' });
def(2, 'grass', 'Блок травы', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' } });
def(3, 'dirt', 'Земля', { tex: 'dirt' });
def(4, 'cobblestone', 'Булыжник', { tex: 'cobblestone' });
def(5, 'planks', 'Дубовые доски', { tex: 'planks' });
def(6, 'bedrock', 'Коренная порода', { tex: 'bedrock', inv: false });
def(7, 'sand', 'Песок', { tex: 'sand' });
def(8, 'gravel', 'Гравий', { tex: 'gravel' });
def(9, 'oak_log', 'Дубовое бревно', { tex: { top: 'oak_log_top', side: 'oak_log' } });
def(10, 'oak_leaves', 'Дубовая листва', { tex: 'oak_leaves', pass: 'cutout', opaque: false, lightOpacity: 1 });
def(11, 'glass', 'Стекло', { tex: 'glass', pass: 'cutout', opaque: false, lightOpacity: 0, cullSame: true });
def(12, 'water', 'Вода', { tex: 'water', pass: 'translucent', solid: false, opaque: false, lightOpacity: 1, inv: false, cullSame: true });
def(13, 'coal_ore', 'Угольная руда', { tex: 'coal_ore' });
def(14, 'iron_ore', 'Железная руда', { tex: 'iron_ore' });
def(15, 'bricks', 'Кирпичи', { tex: 'bricks' });
def(16, 'snow', 'Снег', { tex: 'snow' });
def(17, 'birch_log', 'Берёзовое бревно', { tex: { top: 'birch_log_top', side: 'birch_log' } });
def(18, 'birch_leaves', 'Берёзовая листва', { tex: 'birch_leaves', pass: 'cutout', opaque: false, lightOpacity: 1 });
def(19, 'glowstone', 'Светокамень', { tex: 'glowstone', emit: 15 });
def(20, 'torch', 'Факел', { tex: 'torch', shape: 'torch', pass: 'cutout', solid: false, emit: 14 });
def(21, 'wool_white', 'Белая шерсть', { tex: 'wool_white' });
def(22, 'wool_red', 'Красная шерсть', { tex: 'wool_red' });
def(23, 'wool_blue', 'Синяя шерсть', { tex: 'wool_blue' });
def(24, 'wool_yellow', 'Жёлтая шерсть', { tex: 'wool_yellow' });
def(25, 'gold_block', 'Золотой блок', { tex: 'gold_block' });
def(26, 'sandstone', 'Песчаник', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' } });
def(27, 'stone_bricks', 'Каменные кирпичи', { tex: 'stone_bricks' });
def(28, 'ice', 'Лёд', { tex: 'ice', pass: 'translucent', opaque: false, lightOpacity: 1, slip: 0.98, cullSame: true });
def(29, 'short_grass', 'Трава', { tex: 'short_grass', shape: 'cross', pass: 'cutout' });
def(30, 'dandelion', 'Одуванчик', { tex: 'dandelion', shape: 'cross', pass: 'cutout' });
def(31, 'poppy', 'Мак', { tex: 'poppy', shape: 'cross', pass: 'cutout' });
def(32, 'wool_green', 'Зелёная шерсть', { tex: 'wool_green' });
def(33, 'wool_black', 'Чёрная шерсть', { tex: 'wool_black' });
def(34, 'white_stone', 'Белый камень замка', { tex: 'white_stone' });
def(35, 'pink_stone', 'Розовый камень', { tex: 'pink_stone' });
def(36, 'blue_roof', 'Синяя черепица', { tex: 'blue_roof' });
def(37, 'window', 'Витраж', { tex: 'window', pass: 'translucent', opaque: false, lightOpacity: 0, cullSame: true });

export const INVENTORY_BLOCKS = BLOCKS.filter(b => b && b.inv).map(b => b.id);
