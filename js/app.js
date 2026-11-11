// Liga as telas: início com modelos, abas do estúdio, lista de atores, salvar, importar e exportar.
(function () {
  const { Storage, bus, KINDS, KIND_ORDER } = GS;
  const $ = (id) => document.getElementById(id);
  let template = 'plataforma', saveTimer = 0, toastTimer = 0;
  // Tab to restore when leaving phone play. The tour never enters that mode.
  let playFrom = 'fases';
  const playMq = window.matchMedia('(max-width: 820px), (max-height: 540px)');

  const app = (GS.app = {
    project: null,
    tab: null,
    actorId: null,
    levelIndex: 0,
    actor: () => app.project.actors.find((a) => a.id === app.actorId),
    save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!app.project) return;
        app.project.updatedAt = Date.now();
        if (!Storage.save(app.project)) toast('Não consegui salvar no navegador. Baixe o .gst para não perder o projeto.');
      }, 300);
    },
    toast,
    setTab,
    renderActorList,
    syncPlayFocus,
  });

  // Lista de atores usada nas abas Arte e Regras
  function renderActorList(box, onPick) {
    box.innerHTML = '';
    const p = app.project;
    const actors = p.actors.slice().sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    actors.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'actor-item' + (a.id === app.actorId ? ' on' : '');
      b.appendChild(GS.thumb(a, p.palette));
      const t = document.createElement('span');
      t.className = 'a-text';
      const n = document.createElement('b');
      n.textContent = a.name;
      const k = document.createElement('small');
      k.textContent = `${KINDS[a.kind].icone} ${KINDS[a.kind].nome} · ${a.rules.length} regra${a.rules.length === 1 ? '' : 's'}`;
      t.append(n, k);
      b.appendChild(t);
      b.addEventListener('click', () => onPick(a.id));
      box.appendChild(b);
    });
  }

  // ---------- Início ----------
  function showHome() {
    GS.Play.stop();
    GS.ArtEditor.stop();
    app.tab = null;
    document.body.classList.remove('play-focus');
    GS.Tour.stop(false);
    if (app.project) Storage.save(app.project);
    app.project = null;
    $('studio').hidden = true;
    $('home').hidden = false;
    renderHome();
  }

  function renderHome() {
    const list = $('project-list');
    list.innerHTML = '';
    const projects = Storage.list();
    $('project-empty').hidden = projects.length > 0;
    $('btn-export-all').hidden = !projects.length;
    renderBackup(projects);
    projects.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'project-open';
      const hero = p.actors.find((a) => a.kind === 'jogador') || p.actors[0];
      if (hero) open.appendChild(GS.thumb(hero, p.palette));
      const info = document.createElement('span');
      const n = document.createElement('b');
      n.textContent = p.name;
      const d = document.createElement('small');
      d.textContent = `${p.levels.length} fase${p.levels.length === 1 ? '' : 's'} · ${p.actors.length} atores · ${new Date(p.updatedAt).toLocaleDateString('pt-BR')}`;
      info.append(n, d);
      open.appendChild(info);
      open.addEventListener('click', () => openProject(p, false));
      const acts = document.createElement('div');
      acts.className = 'project-actions';
      const mk = (txt, title, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ' + (cls || 'ghost'); b.textContent = txt; b.title = title; b.addEventListener('click', fn); return b; };
      acts.append(
        mk('📦 HTML', 'Exportar o jogo', () => GS.Play.exportHTML(p)),
        mk('💾 .gst', 'Baixar o projeto', () => { GS.Play.exportProject(p); renderHome(); }),
        mk('Apagar', 'Apagar projeto', async () => {
          if (!(await GS.ask({ icon: '🗑️', text: `Apagar o projeto "${p.name}"? Isso não dá para desfazer.`, yes: 'Apagar' }))) return;
          Storage.remove(p.id);
          renderHome();
        }, 'danger'),
      );
      card.append(open, acts);
      list.appendChild(card);
    });
  }

  function newProject() {
    const name = $('new-name').value.trim() || `Meu jogo ${Storage.list().length + 1}`;
    const p = GS.newProject(name.slice(0, 40), template);
    Storage.save(p);
    $('new-name').value = '';
    openProject(p, $('chk-tour').checked);
  }

  function openProject(p, withTour) {
    app.project = p;
    app.actorId = (p.actors.find((a) => a.kind === 'jogador') || p.actors[0]).id;
    app.levelIndex = 0;
    $('home').hidden = true;
    $('studio').hidden = false;
    $('project-name').value = p.name;
    // com o tour, começa em Fases para mostrar o jogo pronto antes de editar
    setTab(withTour ? 'fases' : 'arte');
    if (withTour) GS.Tour.start();
  }

  // ---------- Abas ----------
  function wantsPlayFocus() {
    return app.tab === 'testar' && !document.body.classList.contains('touring') && playMq.matches;
  }

  function syncPlayFocus() {
    document.body.classList.toggle('play-focus', wantsPlayFocus());
  }

  function setTab(t) {
    if (t === 'testar' && app.tab && app.tab !== 'testar') playFrom = app.tab;
    if (app.tab === 'testar' && t !== 'testar') GS.Play.stop();
    if (app.tab === 'arte' && t !== 'arte') GS.ArtEditor.stop();
    app.tab = t;
    ['arte', 'regras', 'fases', 'testar'].forEach((n) => {
      $('view-' + n).hidden = n !== t;
      $('tab-' + n).classList.toggle('on', n === t);
    });
    try {
      if (t === 'arte') GS.ArtEditor.show();
      if (t === 'regras') GS.RulesEditor.show();
      if (t === 'fases') GS.LevelEditor.show();
      if (t === 'testar') GS.Play.show();
    } finally {
      // Keep the phone chrome in sync even if an editor fails to open.
      syncPlayFocus();
      bus.emit('tab:' + t);
    }
  }

  // A nearby phone can open an http(s) address that is not this machine's loopback.
  function addressStaysOnThisDevice() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return true;
    const host = location.hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }

  function openShare() {
    const url = location.href;
    const localOnly = addressStaysOnThisDevice();
    const canvas = $('share-qr');
    $('share-url').textContent = url;
    $('share-text').textContent = localOnly
      ? 'Este endereço só abre neste aparelho.'
      : 'Aponte a câmera do outro celular para este desenho.';
    if (localOnly || !GS.qr.draw(canvas, url)) {
      canvas.hidden = true;
      if (!localOnly) $('share-text').textContent = 'Este endereço é longo demais para o desenho.';
    } else canvas.hidden = false;
    $('share-send').hidden = localOnly || typeof navigator.share !== 'function';
    const game = GS.Play.game && GS.Play.game();
    if (game) ['esquerda', 'direita', 'cima', 'baixo', 'espaco', 'z', 'x', 'enter'].forEach((k) => game.key(k, false));
    $('share').hidden = false;
    $('share-close').focus();
  }

  function closeShare() {
    $('share').hidden = true;
  }

  async function sendShare() {
    try {
      await navigator.share({ title: 'Game Studio Teen', url: location.href });
    } catch (e) {
      if (!e || e.name !== 'AbortError') toast('Não consegui enviar o endereço.');
    }
  }

  // ---------- Cópia de segurança ----------
  // O lembrete aparece quando um projeto com mais de 10 minutos de trabalho mudou desde a última cópia
  const DAY = 24 * 60 * 60 * 1000;
  function needsBackup(p) { return p.updatedAt - p.createdAt > 10 * 60 * 1000 && p.updatedAt > (p.exportedAt || 0); }
  function renderBackup(projects) {
    const later = Number(Storage.pref('lembrete')) || 0;
    $('backup').hidden = !(projects.some(needsBackup) && Date.now() - later > DAY);
  }
  // Todos os projetos num arquivo só (um "pacote" .gst)
  function exportAll() {
    const projects = Storage.list();
    if (!projects.length) return;
    GS.Play.download(`Meus_jogos_${new Date().toISOString().slice(0, 10)}.gst`,
      JSON.stringify({ format: 'gst-pack', version: 1, projects: projects.map(({ exportedAt, ...p }) => p) }), 'application/json');
    const now = Date.now();
    projects.forEach((p) => { p.exportedAt = now; Storage.save(p); });
    renderHome();
    toast('💾 Cópia baixada. Ela está na pasta de downloads.');
  }

  // ---------- Importar ----------
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const list = data && data.format === 'gst-pack' && Array.isArray(data.projects) ? data.projects : [data];
        if (!list.length || !list.every(GS.validProject)) throw new Error('formato');
        list.forEach((p) => {
          if (Storage.get(p.id)) p.id = GS.uid(); // não sobrescreve um projeto que já existe
          p.updatedAt = p.exportedAt = Date.now();
          Storage.save(p);
        });
        renderHome();
        toast(list.length > 1 ? `${list.length} projetos importados.` : `"${list[0].name}" importado.`);
      } catch (e) {
        toast('Este arquivo não é um projeto do Game Studio Teen (.gst).');
      }
    };
    r.readAsText(file);
  }

  // ---------- Pergunta ----------
  // Troca o confirm() do navegador por uma janela no estilo do estúdio
  GS.ask = function (o) {
    return new Promise((resolve) => {
      const box = $('ask');
      $('ask-icon').textContent = o.icon || '❓';
      $('ask-text').textContent = o.text;
      $('ask-yes').textContent = o.yes || 'Sim';
      box.hidden = false;
      const done = (v) => {
        box.hidden = true;
        $('ask-yes').onclick = $('ask-no').onclick = box.onclick = box.onkeydown = null;
        resolve(v);
      };
      $('ask-yes').onclick = () => done(true);
      $('ask-no').onclick = () => done(false);
      box.onclick = (e) => { if (e.target === box) done(false); };
      box.onkeydown = (e) => { if (e.key === 'Escape') done(false); };
      $('ask-no').focus();
    });
  };

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
  }

  function init() {
    document.querySelectorAll('#templates .template').forEach((b) => b.addEventListener('click', () => {
      template = b.dataset.template;
      document.querySelectorAll('#templates .template').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('btn-new').addEventListener('click', newProject);
    $('btn-export-all').addEventListener('click', exportAll);
    $('btn-backup').addEventListener('click', exportAll);
    $('btn-backup-later').addEventListener('click', () => { Storage.pref('lembrete', Date.now()); renderHome(); });
    $('new-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') newProject(); });
    $('btn-home').addEventListener('click', showHome);
    $('btn-share').addEventListener('click', openShare);
    $('btn-share-studio').addEventListener('click', openShare);
    $('share-close').addEventListener('click', closeShare);
    $('share-send').addEventListener('click', sendShare);
    $('share').addEventListener('click', (e) => { if (e.target === $('share')) closeShare(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('share').hidden) closeShare(); });
    $('btn-play-back').addEventListener('click', () => setTab(playFrom || 'fases'));
    window.addEventListener('resize', syncPlayFocus);
    playMq.addEventListener('change', syncPlayFocus);
    $('btn-tour').addEventListener('click', () => (GS.Tour.active() ? GS.Tour.stop(false) : GS.Tour.start()));
    $('btn-export').addEventListener('click', () => { Storage.save(app.project); GS.Play.exportHTML(app.project); bus.emit('export'); });
    $('btn-save-file').addEventListener('click', () => GS.Play.exportProject(app.project));
    $('project-name').addEventListener('input', (e) => { app.project.name = e.target.value.slice(0, 40) || 'Sem nome'; app.save(); });
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('file-import').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
    window.addEventListener('pagehide', () => { if (app.project) Storage.save(app.project); });
    renderHome();
  }

  init();
})();
