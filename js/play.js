// Aba Testar e exportação do jogo como um único arquivo HTML.
(function () {
  let game = null, built = false, debugOn = false, panelTimer = 0;
  // modo de investigar: quantas vezes cada regra rodou e quando foi a última
  let lastFire = {};
  const $ = (id) => document.getElementById(id);
  const app = () => GS.app;

  function build() {
    if (built) return;
    built = true;
    GST.bindPad($('pad'), () => game);
    $('play-restart').addEventListener('click', start);
    $('play-level').addEventListener('change', start);
    $('play-music').addEventListener('click', () => { if (game) game.setMusic(!game.music()); });
    $('play-debug').addEventListener('click', () => {
      debugOn = !debugOn;
      if (debugOn) { app().ruleHits = {}; lastFire = {}; }
      if (game) game.setDebug(debugOn);
      syncDebug();
      GS.bus.emit(debugOn ? 'debug:on' : 'debug:off');
    });
    document.querySelectorAll('#debug-bar [data-speed]').forEach((b) => b.addEventListener('click', () => {
      if (game) game.setSpeed(Number(b.dataset.speed));
      syncSpeed(Number(b.dataset.speed));
    }));
    $('debug-step').addEventListener('click', () => { if (game) game.stepOnce(); syncSpeed(0); });
    $('debug-rules').addEventListener('click', (e) => {
      const row = e.target.closest('[data-actor]');
      if (!row) return;
      GS.RulesEditor.reveal(row.dataset.actor, Number(row.dataset.rule));
      app().setTab('regras');
    });
  }

  function syncSpeed(sp) {
    document.querySelectorAll('#debug-bar [data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === sp));
  }
  function syncDebug() {
    $('play-debug').classList.toggle('on', debugOn);
    $('debug-bar').hidden = $('debug-panel').hidden = !debugOn;
    $('view-testar').classList.toggle('debugging', debugOn);
    syncSpeed(1);
    clearInterval(panelTimer);
    if (debugOn) { panelTimer = setInterval(renderPanel, 250); renderPanel(); }
  }

  // Painel: valores das variáveis e as regras que já rodaram neste teste
  function renderPanel() {
    if (!game) return;
    const p = app().project, st = game.state();
    const vars = $('debug-vars');
    vars.innerHTML = '';
    [['pontos', st.score], ['vidas', st.lives], ...game.vars().map((v) => [v.name, v.value])].forEach(([n, v]) => {
      const d = document.createElement('div');
      d.className = 'dv';
      d.innerHTML = '<span></span><b></b>';
      d.firstChild.textContent = n;
      d.lastChild.textContent = v;
      vars.appendChild(d);
    });
    const box = $('debug-rules'), hits = app().ruleHits || {}, now = performance.now();
    box.innerHTML = '';
    p.actors.forEach((a) => Object.keys(hits[a.id] || {}).forEach((i) => {
      const r = a.rules[i];
      if (!r) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dr' + (now - (lastFire[a.id + ':' + i] || 0) < 400 ? ' live' : '');
      b.dataset.actor = a.id;
      b.dataset.rule = i;
      b.title = 'Abrir esta regra';
      const ev = GS.EVENTS[r.when.type];
      b.innerHTML = '<b></b><span></span><em></em>';
      b.children[0].textContent = a.name;
      const tgt = r.when.target ? String(r.when.target).split(':') : null;
      const who = tgt ? ' ' + (tgt[0] === 'kind' ? (GS.KINDS[tgt[1]] || {}).nome || '' : (p.actors.find((x) => x.id === tgt[1]) || {}).name || '?').toLowerCase() : '';
      b.children[1].textContent = ev.label + who + (r.if ? ` se ${GS.varName(p, r.if.var)} ${r.if.cmp} ${r.if.value}` : '');
      b.children[2].textContent = hits[a.id][i] + '×';
      box.appendChild(b);
    }));
    if (!box.children.length) box.innerHTML = '<p class="muted">Jogue um pouco: as regras que rodarem aparecem aqui. Clique numa para abrir.</p>';
  }

  function start() {
    stop();
    const p = app().project;
    game = GST.createGame($('game-canvas'), p, {
      level: Number($('play-level').value) || 0,
      debug: debugOn,
      onRule: (actorId, i) => {
        if (!debugOn) return;
        const h = (app().ruleHits = app().ruleHits || {});
        const m = (h[actorId] = h[actorId] || {});
        m[i] = (m[i] || 0) + 1;
        lastFire[actorId + ':' + i] = performance.now();
      },
      onEvent: (type) => {
        if (type === 'music:on' || type === 'music:off') {
          p.settings.musica = type === 'music:on';
          app().save();
          syncMusic();
        }
        GS.bus.emit('game:' + type);
      },
    });
    if (debugOn) { app().ruleHits = {}; lastFire = {}; }
    game.start();
    syncMusic();
    syncDebug();
  }

  function syncMusic() {
    const on = !!(game && game.music());
    $('play-music').textContent = on ? '🎵 Música' : '🔇 Sem música';
    $('play-music').classList.toggle('on', on);
  }

  function stop() {
    clearInterval(panelTimer);
    if (game) game.stop();
    game = null;
  }

  function show() {
    build();
    const sel = $('play-level');
    const keep = Math.min(Number(sel.value) || 0, app().project.levels.length - 1);
    sel.innerHTML = '';
    app().project.levels.forEach((l, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1}. ${l.name}`; sel.appendChild(o); });
    sel.value = keep;
    start();
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const safeName = (s) => (s || 'jogo').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '_') || 'jogo';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Gera um HTML que roda o jogo sozinho, sem o estúdio
  function exportHTML(p) {
    const data = JSON.stringify({ palette: p.palette, settings: p.settings, vars: p.vars || [], actors: p.actors, levels: p.levels }).replace(/</g, '\\u003c');
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${esc(p.name)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #12131c; color: #eef0ff; font-family: system-ui, sans-serif; overflow: hidden; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 12px; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
  h1 { margin: 0; font-size: 18px; }
  canvas { width: min(100%, calc((100vh - 200px) * 4 / 3)); aspect-ratio: 4 / 3; image-rendering: pixelated; border-radius: 12px; box-shadow: 0 0 0 3px #2c2f45; touch-action: none; }
  .pad { display: flex; justify-content: space-between; width: min(100%, 640px); }
  .dpad { display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(2, 56px); gap: 6px; }
  .pb { border: 0; border-radius: 14px; background: #1d1f2e; color: #eef0ff; font-size: 22px; box-shadow: 0 4px 0 #0b0c12; touch-action: none; }
  .pb.on { background: #7c5cff; transform: translateY(3px); box-shadow: 0 1px 0 #0b0c12; }
  .up { grid-column: 2; } .left { grid-column: 1; grid-row: 2; } .down { grid-column: 2; grid-row: 2; } .right { grid-column: 3; grid-row: 2; }
  .abtns { display: flex; gap: 10px; align-items: flex-end; } .abtns .pb { width: 64px; height: 64px; } .abtns .big { width: 84px; height: 84px; background: #ff4f9a; }
  small { color: #9aa0c0; }
  @media (hover: hover) and (pointer: fine) { .pad { display: none; } }
</style>
</head>
<body>
<h1>${esc(p.name)}</h1>
<canvas id="c" width="256" height="192"></canvas>
<div class="pad" id="pad">
  <div class="dpad"><button data-key="cima" class="pb up">▲</button><button data-key="esquerda" class="pb left">◀</button><button data-key="baixo" class="pb down">▼</button><button data-key="direita" class="pb right">▶</button></div>
  <div class="abtns"><button data-key="z" class="pb">Z</button><button data-key="espaco" class="pb big">●</button></div>
</div>
<small>Setas ou WASD movem · Espaço, Z e X são ações · M liga ou desliga a música · Feito no Game Studio Teen</small>
<script>
(${window.GST_RUNTIME.toString()})(window);
const game = GST.createGame(document.getElementById('c'), ${data});
GST.bindPad(document.getElementById('pad'), () => game);
game.start();
</script>
</body>
</html>`;
    download(safeName(p.name) + '.html', html, 'text/html');
  }

  function exportProject(p) {
    const { exportedAt, ...data } = p;
    download(safeName(p.name) + '.gst', JSON.stringify(data), 'application/json');
    p.exportedAt = Date.now();
    GS.Storage.save(p);
  }

  GS.Play = { show, stop, exportHTML, exportProject, download, game: () => game };
})();
