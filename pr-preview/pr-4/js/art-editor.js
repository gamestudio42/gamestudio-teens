// Editor de arte: pixel art 16x16 ou 32x32, quadros de animação, paleta editável.
(function () {
  const { KINDS, KIND_ORDER, bus } = GS;

  let tool = 'lapis', color = 8, mirror = false, onion = true;
  let frame = 0, painting = false, changed = false, start = null, base = null;
  let built = false, previewTimer = 0;
  const history = {}; // por ator: { undo: [], redo: [] }

  const $ = (id) => document.getElementById(id);
  const app = () => GS.app;
  const actor = () => app().actor();
  const pal = () => app().project.palette;
  const px = () => actor().frames[frame];

  function hist() {
    const id = app().project.id + ':' + actor().id; // ids de ator se repetem entre projetos
    return (history[id] = history[id] || { undo: [], redo: [] });
  }
  function snapshot() { return { size: actor().size, frames: actor().frames.map((f) => f.slice()) }; }
  function pushUndo() {
    const h = hist();
    h.undo.push(snapshot());
    if (h.undo.length > 60) h.undo.shift();
    h.redo.length = 0;
  }
  function restore(s) {
    actor().size = s.size;
    actor().frames = s.frames;
    frame = Math.min(frame, s.frames.length - 1);
  }
  function undo() { const h = hist(); if (!h.undo.length) return; h.redo.push(snapshot()); restore(h.undo.pop()); commit(true); }
  function redo() { const h = hist(); if (!h.redo.length) return; h.undo.push(snapshot()); restore(h.redo.pop()); commit(true); }

  function build() {
    if (built) return;
    built = true;

    document.querySelectorAll('#art-tools [data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    $('art-mirror').addEventListener('click', () => { mirror = !mirror; sync(); draw(); });
    $('art-onion').addEventListener('click', () => { onion = !onion; sync(); draw(); });
    $('art-undo').addEventListener('click', undo);
    $('art-redo').addEventListener('click', redo);
    $('art-clear').addEventListener('click', () => { pushUndo(); px().fill(-1); commit(); });

    $('frame-add').addEventListener('click', () => {
      if (actor().frames.length >= 12) { app().toast('Máximo de 12 quadros por ator.'); return; }
      pushUndo();
      actor().frames.splice(frame + 1, 0, px().slice());
      frame++;
      commit(true);
    });
    $('frame-del').addEventListener('click', () => {
      if (actor().frames.length <= 1) return;
      pushUndo();
      actor().frames.splice(frame, 1);
      frame = Math.max(0, frame - 1);
      commit(true);
    });

    $('art-fps').addEventListener('input', (e) => { actor().fps = Number(e.target.value); $('art-fps-val').textContent = actor().fps; app().save(); });
    $('art-name').addEventListener('input', (e) => { actor().name = e.target.value || KINDS[actor().kind].nome; app().save(); app().renderActorList($('art-actors'), pickActor); });
    const kindSel = $('art-kind');
    KIND_ORDER.forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = `${KINDS[k].icone} ${KINDS[k].nome}`; kindSel.appendChild(o); });
    kindSel.addEventListener('change', () => {
      actor().kind = kindSel.value;
      if (GS.TILE_KINDS.includes(actor().kind) && actor().size === 32) { pushUndo(); resize(16); }
      commit(true);
    });
    document.querySelectorAll('.size-switch [data-size]').forEach((b) => b.addEventListener('click', () => {
      const s = Number(b.dataset.size);
      if (s === actor().size) return;
      if (s === 32 && GS.TILE_KINDS.includes(actor().kind)) { app().toast('Blocos e plataformas são sempre 16×16, do tamanho de uma célula.'); return; }
      pushUndo();
      resize(s);
      commit(true);
    }));

    $('color-edit').addEventListener('input', (e) => {
      pal()[color] = e.target.value;
      app().save();
      buildPalette();
      draw();
      app().renderActorList($('art-actors'), pickActor);
    });

    $('art-new-actor').addEventListener('click', () => {
      const m = $('art-new-kind');
      if (!m.hidden) { m.hidden = true; return; }
      m.innerHTML = '';
      KIND_ORDER.forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small ghost';
        b.textContent = `${KINDS[k].icone} ${KINDS[k].nome}`;
        b.addEventListener('click', () => {
          const a = GS.newActor(k);
          app().project.actors.push(a);
          app().actorId = a.id;
          frame = 0;
          m.hidden = true;
          app().save();
          show();
          bus.emit('actor:new', a);
        });
        m.appendChild(b);
      });
      m.hidden = false;
    });
    $('art-del-actor').addEventListener('click', async () => {
      const p = app().project, a = actor();
      if (p.actors.length <= 1) return;
      if (!(await GS.ask({ icon: '🗑️', text: `Apagar "${a.name}"? Ele sai de todas as fases e das regras que o criam.`, yes: 'Apagar' }))) return;
      p.actors = p.actors.filter((x) => x !== a);
      p.levels.forEach((l) => { l.cells = l.cells.map((c) => (c === a.id ? null : c)); });
      app().actorId = p.actors[0].id;
      app().save();
      show();
    });

    const c = $('art-canvas');
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const p = cellAt(e);
      if (!p) return;
      const erase = e.button === 2;
      if (tool === 'conta') { const v = px()[p.y * actor().size + p.x]; if (v >= 0) { color = v; setTool('lapis'); } return; }
      pushUndo();
      painting = { erase };
      changed = false;
      start = p;
      base = px().slice();
      paint(p);
      draw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const p = cellAt(e);
      if (!p) return;
      if (tool === 'lapis' || tool === 'borracha') paint(p);
      else if (tool === 'linha' || tool === 'retangulo') { actor().frames[frame] = base.slice(); shape(start, p); }
      draw();
    });
    const end = () => {
      if (!painting) return;
      painting = false;
      if (changed) commit();
      else hist().undo.pop();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    document.addEventListener('keydown', (e) => {
      if (app().tab !== 'arte' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
      const map = { b: 'lapis', e: 'borracha', g: 'balde', i: 'conta', l: 'linha', r: 'retangulo' };
      if (map[k]) setTool(map[k]);
      if (k === 'm') { mirror = !mirror; sync(); draw(); }
      if (k === 'o') { onion = !onion; sync(); draw(); }
    });
    window.addEventListener('resize', () => { if (app().tab === 'arte') fit(); });
  }

  function resize(s) {
    const a = actor(), old = a.size;
    a.frames = a.frames.map((f) => {
      const out = GS.blank(s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const sx = Math.floor((x * old) / s), sy = Math.floor((y * old) / s);
        out[y * s + x] = f[sy * old + sx];
      }
      return out;
    });
    a.size = s;
  }

  function setTool(t) { tool = t; sync(); }

  function cellAt(e) {
    const r = $('art-canvas').getBoundingClientRect(), s = actor().size;
    const x = Math.floor(((e.clientX - r.left) / r.width) * s), y = Math.floor(((e.clientY - r.top) / r.height) * s);
    return x < 0 || y < 0 || x >= s || y >= s ? null : { x, y };
  }

  function value() { return painting && painting.erase ? -1 : tool === 'borracha' ? -1 : color; }

  function set(x, y, v) {
    const s = actor().size, f = px();
    if (x < 0 || y < 0 || x >= s || y >= s) return;
    if (f[y * s + x] !== v) { f[y * s + x] = v; changed = true; }
    if (mirror) { const mx = s - 1 - x; if (f[y * s + mx] !== v) { f[y * s + mx] = v; changed = true; } }
  }

  function paint(p) {
    if (tool === 'balde') return flood(p.x, p.y, value());
    if (tool === 'linha' || tool === 'retangulo') return shape(p, p);
    set(p.x, p.y, value());
  }

  function shape(a, b) {
    const v = value();
    if (tool === 'linha') {
      let x0 = a.x, y0 = a.y;
      const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0), sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        set(x0, y0, v);
        if (x0 === b.x && y0 === b.y) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    } else {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let x = x0; x <= x1; x++) { set(x, y0, v); set(x, y1, v); }
      for (let y = y0; y <= y1; y++) { set(x0, y, v); set(x1, y, v); }
    }
  }

  function flood(x, y, v) {
    const s = actor().size, f = px(), target = f[y * s + x];
    if (target === v) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= s || cy >= s || f[cy * s + cx] !== target) continue;
      f[cy * s + cx] = v;
      changed = true;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function commit(silent) {
    app().save();
    show(true);
    if (!silent) bus.emit('art:painted', { actor: actor(), filled: px().filter((v) => v >= 0).length });
  }

  function buildPalette() {
    const box = $('palette');
    box.innerHTML = '';
    pal().forEach((hex, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (i === color ? ' on' : '');
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', () => { color = i; if (tool === 'borracha' || tool === 'conta') setTool('lapis'); buildPalette(); $('color-edit').value = hex; });
      box.appendChild(b);
    });
    $('color-edit').value = pal()[color];
  }

  function sync() {
    document.querySelectorAll('#art-tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    $('art-mirror').classList.toggle('on', mirror);
    $('art-onion').classList.toggle('on', onion);
    const a = actor();
    $('art-name').value = a.name;
    $('art-kind').value = a.kind;
    $('art-fps').value = a.fps || 6;
    $('art-fps-val').textContent = a.fps || 6;
    document.querySelectorAll('.size-switch [data-size]').forEach((b) => b.classList.toggle('on', Number(b.dataset.size) === a.size));
    $('art-del-actor').hidden = app().project.actors.length <= 1;
  }

  function fit() {
    const st = $('art-stage').getBoundingClientRect();
    const s = actor().size;
    const side = Math.max(192, Math.min(st.width, st.height, 640));
    const cell = Math.floor(side / s);
    const c = $('art-canvas');
    c.width = c.height = cell * s;
    draw();
  }

  function draw() {
    const c = $('art-canvas'), ctx = c.getContext('2d'), a = actor(), s = a.size, cell = c.width / s, f = px();
    const prev = onion && frame > 0 ? a.frames[frame - 1] : null;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = f[y * s + x];
        ctx.fillStyle = v >= 0 ? pal()[v] : (x + y) % 2 ? '#262a3d' : '#2e3249';
        ctx.fillRect(x * cell, y * cell, cell, cell);
        if (v < 0 && prev && prev[y * s + x] >= 0) {
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = pal()[prev[y * s + x]];
          ctx.fillRect(x * cell, y * cell, cell, cell);
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    for (let i = 0; i <= s; i++) {
      ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, c.height);
      ctx.moveTo(0, i * cell + 0.5); ctx.lineTo(c.width, i * cell + 0.5);
    }
    ctx.stroke();
    // linhas mais fortes a cada 8 pixels ajudam a medir
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    for (let i = 0; i <= s; i += 8) {
      ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, c.height);
      ctx.moveTo(0, i * cell + 0.5); ctx.lineTo(c.width, i * cell + 0.5);
    }
    ctx.stroke();
    if (mirror) {
      ctx.strokeStyle = '#ff4f9a';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.width / 2, 0); ctx.lineTo(c.width / 2, c.height); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }
  }

  function renderFrames() {
    const list = $('frame-list');
    list.innerHTML = '';
    actor().frames.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame' + (i === frame ? ' on' : '');
      b.appendChild(GS.thumb(actor(), pal(), i));
      const n = document.createElement('span');
      n.textContent = i + 1;
      b.appendChild(n);
      b.addEventListener('click', () => { frame = i; show(true); });
      list.appendChild(b);
    });
    $('frame-del').disabled = actor().frames.length <= 1;
  }

  function animatePreview() {
    clearInterval(previewTimer);
    let i = 0;
    const tick = () => {
      if (app().tab !== 'arte' || !app().project) return;
      const a = actor(), c = $('art-preview');
      c.width = c.height = a.size;
      c.getContext('2d').drawImage(GS.thumb(a, pal(), i % a.frames.length), 0, 0);
      i++;
    };
    tick();
    previewTimer = setInterval(tick, 1000 / (actor().fps || 6));
  }

  function pickActor(id) { app().actorId = id; frame = 0; show(); }

  function show(keepLayout) {
    build();
    if (!actor()) app().actorId = app().project.actors[0].id;
    frame = Math.min(frame, actor().frames.length - 1);
    $('art-new-kind').hidden = true;
    app().renderActorList($('art-actors'), pickActor);
    buildPalette();
    sync();
    renderFrames();
    animatePreview();
    if (keepLayout) fit();
    else requestAnimationFrame(fit);
  }

  GS.ArtEditor = { show, stop: () => clearInterval(previewTimer) };
})();
