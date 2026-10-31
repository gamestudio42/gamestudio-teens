// Editor de fases: várias fases, tamanho, vista (de lado ou de cima), cor de fundo
// e uma grade onde se colocam os atores.
(function () {
  const { KINDS, KIND_ORDER, T, bus } = GS;

  let built = false, selected = null, erase = false, zoom = 2, painting = null;
  // Desfazer e refazer: fotos das fases do projeto antes de cada mudança
  let hist = { id: null, past: [], future: [] };
  const $ = (id) => document.getElementById(id);
  const app = () => GS.app;
  const project = () => app().project;
  const level = () => project().levels[app().levelIndex] || project().levels[0];

  function snap() { return JSON.stringify({ levels: project().levels, index: app().levelIndex }); }
  function history() {
    if (hist.id !== project().id) hist = { id: project().id, past: [], future: [] };
    return hist;
  }
  function remember(before) {
    const h = history();
    h.past.push(before || snap());
    if (h.past.length > 60) h.past.shift();
    h.future = [];
    syncUndo();
  }
  function restore(from, to) {
    const h = history();
    if (!h[from].length) return;
    h[to].push(snap());
    const s = JSON.parse(h[from].pop());
    project().levels = s.levels;
    app().levelIndex = Math.min(s.index, s.levels.length - 1);
    saved();
  }
  function syncUndo() {
    const h = history();
    $('lvl-undo').disabled = !h.past.length;
    $('lvl-redo').disabled = !h.future.length;
  }

  function build() {
    if (built) return;
    built = true;
    // em tela estreita as opções começam fechadas, para a grade da fase aparecer logo
    if (window.matchMedia('(max-width: 860px)').matches) $('lvl-opts').open = false;
    $('lvl-undo').addEventListener('click', () => restore('past', 'future'));
    $('lvl-redo').addEventListener('click', () => restore('future', 'past'));
    document.addEventListener('keydown', (e) => {
      if (app().tab !== 'fases' || !(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); restore('past', 'future'); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); restore('future', 'past'); }
    });
    $('lvl-add').addEventListener('click', () => {
      remember();
      const cur = level();
      const l = GS.newLevel('Fase ' + (project().levels.length + 1), cur.w, cur.h, cur.view);
      project().levels.push(l);
      app().levelIndex = project().levels.length - 1;
      saved();
    });
    $('lvl-dup').addEventListener('click', () => {
      remember();
      const l = JSON.parse(JSON.stringify(level()));
      l.id = GS.uid();
      l.name = (l.name + ' (cópia)').slice(0, 24);
      project().levels.splice(app().levelIndex + 1, 0, l);
      app().levelIndex++;
      saved();
    });
    $('lvl-del').addEventListener('click', async () => {
      if (project().levels.length <= 1) { app().toast('O jogo precisa de pelo menos uma fase.'); return; }
      if (!(await GS.ask({ icon: '🗺️', text: `Apagar a fase "${level().name}"? Dá para desfazer com ↩️.`, yes: 'Apagar' }))) return;
      remember();
      project().levels.splice(app().levelIndex, 1);
      app().levelIndex = Math.max(0, app().levelIndex - 1);
      saved();
    });
    $('lvl-name').addEventListener('input', (e) => { level().name = e.target.value; app().save(); renderList(); });
    $('lvl-view').addEventListener('change', (e) => {
      remember();
      level().view = e.target.value;
      app().save();
      if (e.target.value === 'cima') app().toast('Na vista de cima não há gravidade. Use "Controles de vista de cima" nas regras do jogador.');
    });
    $('lvl-bg').addEventListener('input', (e) => { level().bg = e.target.value; app().save(); draw(); });
    const resize = () => {
      const w = Math.max(16, Math.min(200, Number($('lvl-w').value) || level().w));
      const h = Math.max(12, Math.min(100, Number($('lvl-h').value) || level().h));
      const l = level();
      if (w === l.w && h === l.h) return;
      remember();
      const cells = new Array(w * h).fill(null);
      for (let y = 0; y < Math.min(h, l.h); y++) for (let x = 0; x < Math.min(w, l.w); x++) cells[y * w + x] = l.cells[y * l.w + x];
      l.w = w; l.h = h; l.cells = cells;
      saved();
    };
    $('lvl-w').addEventListener('change', resize);
    $('lvl-h').addEventListener('change', resize);
    $('lvl-erase').addEventListener('click', () => { erase = !erase; renderPalette(); });
    $('lvl-zoom-in').addEventListener('click', () => { zoom = Math.min(4, zoom + 0.5); fit(); });
    $('lvl-zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom - 0.5); fit(); });

    const c = $('lvl-canvas');
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      painting = { erase: erase || e.button === 2, before: snap(), changed: false };
      placeAt(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const a = !painting.erase && byId(selected);
      if (a && a.kind === 'jogador') return;
      placeAt(e);
    });
    const end = () => { painting = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  const byId = (id) => project().actors.find((a) => a.id === id);

  function saved() { app().save(); show(); }

  function placeAt(e) {
    const r = $('lvl-canvas').getBoundingClientRect(), l = level();
    const x = Math.floor(((e.clientX - r.left) / r.width) * l.w), y = Math.floor(((e.clientY - r.top) / r.height) * l.h);
    if (x < 0 || y < 0 || x >= l.w || y >= l.h) return;
    const i = y * l.w + x;
    const v = painting.erase ? null : selected;
    if (l.cells[i] === v) return;
    if (!painting.changed) { painting.changed = true; remember(painting.before); }
    const a = v && byId(v);
    if (a && a.kind === 'jogador') {
      // uma fase tem um jogador só
      l.cells = l.cells.map((c) => { const o = c && byId(c); return o && o.kind === 'jogador' ? null : c; });
    }
    l.cells[i] = v;
    app().save();
    draw();
    bus.emit('level:placed', { kind: a ? a.kind : null });
  }

  function renderList() {
    const box = $('lvl-list');
    box.innerHTML = '';
    project().levels.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lvl-item' + (i === app().levelIndex ? ' on' : '');
      b.innerHTML = `<span class="n">${i + 1}</span><span class="t"></span><small>${l.view === 'cima' ? 'de cima' : 'de lado'} · ${l.w}×${l.h}</small>`;
      b.querySelector('.t').textContent = l.name;
      b.addEventListener('click', () => { app().levelIndex = i; show(); });
      box.appendChild(b);
    });
  }

  function renderPalette() {
    const box = $('lvl-palette');
    box.innerHTML = '';
    const actors = project().actors.filter((a) => a.kind !== 'cenario').sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    if (!byId(selected)) selected = (actors.find((a) => a.kind === 'bloco') || actors[0]).id;
    actors.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal-actor' + (a.id === selected && !erase ? ' on' : '');
      b.title = `${a.name} (${KINDS[a.kind].nome})`;
      b.dataset.actor = a.id;
      b.dataset.kind = a.kind;
      b.appendChild(GS.thumb(a, project().palette));
      const s = document.createElement('span');
      s.textContent = a.name;
      b.appendChild(s);
      b.addEventListener('click', () => { selected = a.id; erase = false; renderPalette(); });
      box.appendChild(b);
    });
    $('lvl-erase').classList.toggle('on', erase);
  }

  function fit() {
    const l = level(), c = $('lvl-canvas');
    const cell = Math.round(T * zoom);
    c.width = l.w * cell;
    c.height = l.h * cell;
    draw();
  }

  function draw() {
    const l = level(), c = $('lvl-canvas'), ctx = c.getContext('2d'), cell = c.width / l.w;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = l.bg || '#5fc4ff';
    ctx.fillRect(0, 0, c.width, c.height);
    // moldura da área visível no começo (16 x 12 células)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(1, 1, Math.min(16, l.w) * cell - 2, Math.min(12, l.h) * cell - 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    for (let x = 0; x <= l.w; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, c.height); }
    for (let y = 0; y <= l.h; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(c.width, y * cell + 0.5); }
    ctx.stroke();
    const cache = {};
    l.cells.forEach((id, i) => {
      const a = id && byId(id);
      if (!a) return;
      const img = cache[id] || (cache[id] = GS.thumb(a, project().palette));
      const x = (i % l.w) * cell, y = Math.floor(i / l.w) * cell;
      if (GS.TILE_KINDS.includes(a.kind)) ctx.drawImage(img, x, y, cell, cell);
      else {
        const s = (a.size / T) * cell;
        ctx.drawImage(img, x + cell / 2 - s / 2, y + cell - s, s, s);
      }
    });
  }

  function show() {
    build();
    if (app().levelIndex >= project().levels.length) app().levelIndex = 0;
    const l = level();
    $('lvl-name').value = l.name;
    $('lvl-view').value = l.view;
    $('lvl-w').value = l.w;
    $('lvl-h').value = l.h;
    $('lvl-bg').value = l.bg || '#5fc4ff';
    renderList();
    renderPalette();
    syncUndo();
    fit();
  }

  GS.LevelEditor = { show };
})();
