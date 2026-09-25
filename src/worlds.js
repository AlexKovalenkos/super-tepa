// Several saved worlds (like Minecraft's world list): create, copy, rename, delete.
// Each world's save lives under its own localStorage key; a small index keeps names and dates.

const INDEX = 'supertepa-worlds-v1';
const LEGACY = 'supertepa-save-v1'; // single-world save used before v0.5
const dataKey = id => 'supertepa-world-' + id;

export class WorldStore {
  // store: { get(k), set(k, v) -> boolean, del(k) }
  constructor(store) {
    this.s = store;
    const idx = store.get(INDEX);
    this.index = Array.isArray(idx) ? idx : [];
    if (!Array.isArray(idx)) this.migrate();
  }

  // The old single save becomes two worlds: a clean "Мой мир" (same landscape, no hand-made changes)
  // and "Мой мир — с постройками" that keeps everything that was built or broken.
  migrate() {
    const old = this.s.get(LEGACY);
    if (!old) return;
    const now = Date.now();
    if (old.mods && Object.keys(old.mods).length) this.create('Мой мир — с постройками', old, now - 1000);
    this.create('Мой мир', { seed: old.seed, time: old.time, hotbar: old.hotbar, sel: old.sel, mods: {} }, now);
    this.s.del(LEGACY);
  }

  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  saveIndex() { return this.s.set(INDEX, this.index); }

  create(name, data, played = Date.now()) {
    const id = this.newId();
    if (!this.s.set(dataKey(id), data)) return null;
    this.index.push({ id, name, created: Date.now(), played });
    this.saveIndex();
    return id;
  }

  list() { return [...this.index].sort((a, b) => b.played - a.played); }
  meta(id) { return this.index.find(w => w.id === id); }
  get(id) { return this.s.get(dataKey(id)); }

  save(id, data) {
    const ok = this.s.set(dataKey(id), data);
    const w = this.meta(id);
    if (w) { w.played = Date.now(); this.saveIndex(); }
    return ok;
  }

  copy(id, name) {
    const d = this.get(id);
    return d ? this.create(name, d) : null;
  }

  rename(id, name) {
    const w = this.meta(id);
    if (w) { w.name = name; this.saveIndex(); }
  }

  remove(id) {
    this.s.del(dataKey(id));
    this.index = this.index.filter(w => w.id !== id);
    this.saveIndex();
  }
}

export function formatDate(t) {
  return new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
