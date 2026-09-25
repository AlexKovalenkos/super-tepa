// Touch controls for iPad / phones, in the spirit of Minecraft Bedrock on tablets:
// left thumb = floating joystick, right thumb = drag to look, tap to place / pet, hold to break,
// plus round buttons for jump, flight, going down, breaking, placing, camera, blocks and pause.

export const isTouch = (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;

// api: { key(code, down), look(dx, dy), use(), breakOnce(), move(x, z, sprint) , isFlying(), state() }
export function setupTouch(api) {
  document.body.classList.add('touch');
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="joy-base"><div id="joy-knob"></div></div>
    <button class="tbtn" id="t-pause" aria-label="Пауза">❚❚</button>
    <button class="tbtn small" id="t-cam" aria-label="Камера">👁</button>
    <button class="tbtn small" id="t-inv" aria-label="Все блоки">▦</button>
    <button class="tbtn" id="t-break" aria-label="Сломать"><span>⛏</span><small>сломать</small></button>
    <button class="tbtn" id="t-place" aria-label="Поставить"><span>■</span><small>поставить</small></button>
    <button class="tbtn" id="t-fly" aria-label="Полёт"><span>🦋</span><small>взлететь</small></button>
    <button class="tbtn" id="t-down" aria-label="Вниз"><span>▼</span><small>вниз</small></button>
    <button class="tbtn big" id="t-jump" aria-label="Прыжок"><span>▲</span><small>прыжок</small></button>`;
  document.body.appendChild(root);

  // Buttons that behave like held keys (repeat while held) or single taps
  const hold = (id, code) => {
    const el = root.querySelector(id);
    const up = e => { if (el.dataset.pid == e.pointerId) { el.classList.remove('on'); delete el.dataset.pid; api.key(code, false); } };
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.dataset.pid = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } el.classList.add('on'); api.key(code, true); });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const tap = (id, fn) => root.querySelector(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  hold('#t-jump', 'Space');
  hold('#t-down', 'ShiftLeft');
  hold('#t-break', 'KeyZ');
  hold('#t-place', 'KeyX');
  tap('#t-fly', () => { api.key('KeyF', true); api.key('KeyF', false); });
  tap('#t-cam', () => { api.key('KeyV', true); api.key('KeyV', false); });
  tap('#t-inv', () => { api.key('KeyE', true); api.key('KeyE', false); });
  tap('#t-pause', () => api.pause());

  // Joystick (left 40% of the screen) and look / tap (the rest)
  const base = root.querySelector('#joy-base'), knob = root.querySelector('#joy-knob');
  const R = 56;
  let joy = null, look = null;

  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.tbtn')) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.4 && !joy) {
      joy = { id: e.pointerId, x: e.clientX, y: e.clientY };
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
      base.classList.add('on');
      knob.style.transform = 'translate(-50%, -50%)';
    } else if (!look) {
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, breaking: false };
      look.timer = setTimeout(() => { if (look && !look.moved) { look.breaking = true; api.key('KeyZ', true); } }, 350);
    }
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });

  root.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) {
      let dx = e.clientX - joy.x, dy = e.clientY - joy.y;
      const d = Math.hypot(dx, dy);
      const sprint = d > R * 1.25 && dy < 0;
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, d / R);
      api.move(m < 0.15 ? 0 : dx / R, m < 0.15 ? 0 : -dy / R, sprint);
    } else if (look && e.pointerId === look.id) {
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.x = e.clientX; look.y = e.clientY;
      if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) > 10) look.moved = true;
      api.look(dx, dy);
    }
  });

  const end = e => {
    if (joy && e.pointerId === joy.id) {
      joy = null;
      base.classList.remove('on');
      api.move(0, 0, false);
    } else if (look && e.pointerId === look.id) {
      clearTimeout(look.timer);
      if (look.breaking) api.key('KeyZ', false);
      else if (!look.moved && performance.now() - look.t < 300) api.use(); // quick tap: place a block / pet a mob
      look = null;
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  // No page zoom / scroll / callouts on iPad
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (!e.target.closest('#world-list, #inv-grid')) e.preventDefault(); }, { passive: false });

  return {
    update() {
      root.classList.toggle('show', api.state() === 'playing');
      const flying = api.isFlying();
      root.querySelector('#t-down').classList.toggle('hidden', !flying);
      const fly = root.querySelector('#t-fly');
      fly.classList.toggle('on', flying);
      fly.querySelector('small').textContent = flying ? 'сесть' : 'взлететь';
    },
  };
}
