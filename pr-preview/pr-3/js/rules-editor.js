// Editor de regras: cada regra é "QUANDO algo acontece, FAÇA estas ações".
// O painel de código mostra as mesmas regras escritas como programa.
(function () {
  const { EVENTS, ACTIONS, KINDS, KIND_ORDER, bus } = GS;

  let built = false, showCode = false, showVars = false, focusRule = null;
  const $ = (id) => document.getElementById(id);
  const app = () => GS.app;
  const actor = () => app().actor();

  function build() {
    if (built) return;
    built = true;
    const pre = $('rules-preset');
    Object.entries(GS.PRESETS).forEach(([k, p]) => { const o = document.createElement('option'); o.value = k; o.textContent = p.nome; pre.appendChild(o); });
    pre.addEventListener('change', () => {
      if (!pre.value) return;
      actor().rules.push(...GS.PRESETS[pre.value].rules(app().project));
      pre.value = '';
      changed();
    });
    $('rules-gravity').addEventListener('change', (e) => { actor().props.gravidade = e.target.checked; changed(); });
    $('rule-add').addEventListener('click', () => {
      actor().rules.push({ when: GS.newWhen('sempre'), do: [] });
      changed();
    });
    $('btn-vars').addEventListener('click', () => { showVars = !showVars; render(); });
    $('var-add').addEventListener('click', () => {
      GS.newVar(app().project, 'chaves');
      app().save();
      render();
      const inputs = $('vars-list').querySelectorAll('input[type="text"]');
      if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
    });
    $('btn-code').addEventListener('click', () => {
      showCode = !showCode;
      render();
      if (showCode) bus.emit('code:open');
    });
  }

  function changed() {
    // as regras mudaram: as marcas de "disparou" do último teste não valem mais
    if (app().ruleHits) delete app().ruleHits[actor().id];
    app().save();
    render();
    bus.emit('rules:changed');
  }

  function select(options, value, onChange) {
    const s = document.createElement('select');
    s.className = 'input';
    options.forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; s.appendChild(o); });
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function paramInput(p, obj) {
    const project = app().project;
    const set = (v) => { obj[p.k] = v; app().save(); renderCode(); bus.emit('rules:changed'); };
    switch (p.t) {
      case 'key': return select(Object.entries(GS.KEYS), obj[p.k], set);
      case 'dir': return select(Object.entries(GS.DIRS), obj[p.k], set);
      case 'sound': return select(Object.entries(GS.SOUND_NAMES), obj[p.k], set);
      case 'cmp': return select(Object.entries(GS.CMPS).map(([k, l]) => [k, l.split(' ')[0]]), obj[p.k], set);
      case 'op': return select(Object.entries(GS.OPS), obj[p.k], set);
      case 'operand':
      case 'var': {
        const opts = GS.vars(project).map((v) => ['v:' + v.id, v.name]);
        if (p.t === 'operand') opts.push(['g:pontos', 'pontos'], ['g:vidas', 'vidas']);
        if (!opts.length) {
          const b = miniBtn('+ criar variável', 'Criar uma variável do jogo', () => {
            const v = GS.newVar(project, 'chaves');
            obj[p.k] = 'v:' + v.id;
            showVars = true;
            changed();
          });
          b.classList.add('needs');
          return b;
        }
        if (!opts.some(([v]) => v === obj[p.k])) opts.unshift([obj[p.k] || '', '(escolha)']);
        return select(opts, obj[p.k], set);
      }
      case 'target': {
        const opts = KIND_ORDER.map((k) => ['kind:' + k, `qualquer ${KINDS[k].nome}`]);
        project.actors.forEach((a) => opts.push(['id:' + a.id, `o ator "${a.name}"`]));
        return select(opts, obj[p.k], set);
      }
      case 'actor': return select(project.actors.map((a) => [a.id, a.name]), obj[p.k], set);
      case 'number': {
        const wrap = document.createElement('label');
        wrap.className = 'num';
        if (p.label) wrap.append(p.label + ' ');
        const i = document.createElement('input');
        i.type = 'number';
        i.className = 'input';
        i.step = p.step || 1;
        if (p.min !== undefined) i.min = p.min;
        i.value = obj[p.k];
        i.addEventListener('input', () => { if (i.value !== '' && !isNaN(Number(i.value))) set(Number(i.value)); });
        wrap.appendChild(i);
        return wrap;
      }
      default: {
        const i = document.createElement('input');
        i.type = 'text';
        i.className = 'input';
        i.maxLength = 48;
        i.value = obj[p.k];
        i.addEventListener('input', () => set(i.value));
        return i;
      }
    }
  }

  function miniBtn(text, title, fn, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small ghost ' + (cls || '');
    b.textContent = text;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  }

  function renderRule(rule, idx) {
    const a = actor();
    const card = document.createElement('div');
    card.className = 'rule';

    const head = document.createElement('div');
    head.className = 'rule-when';
    const tag = document.createElement('span');
    tag.className = 'tag when';
    tag.textContent = 'QUANDO';
    head.appendChild(tag);
    head.appendChild(select(Object.entries(EVENTS).map(([k, e]) => [k, e.label]), rule.when.type, (v) => { rule.when = GS.newWhen(v, app().project); changed(); }));
    EVENTS[rule.when.type].params.forEach((p) => head.appendChild(paramInput(p, rule.when)));
    const tools = document.createElement('span');
    tools.className = 'rule-tools';
    const hits = app().ruleHits && app().ruleHits[a.id] && app().ruleHits[a.id][idx];
    if (hits) {
      const h = document.createElement('span');
      h.className = 'hit';
      h.title = 'Quantas vezes esta regra rodou no último teste com o modo de investigar';
      h.textContent = `⚡ ${hits}×`;
      tools.appendChild(h);
      card.classList.add('fired');
    }
    if (!rule.if) tools.appendChild(miniBtn('+ se', 'Só rodar esta regra se uma variável estiver de um jeito', () => {
      const vars = GS.vars(app().project);
      rule.if = { var: vars.length ? 'v:' + vars[0].id : 'g:pontos', cmp: '>=', value: 1 };
      changed();
    }));
    if (idx > 0) tools.appendChild(miniBtn('↑', 'Subir', () => { a.rules.splice(idx - 1, 0, a.rules.splice(idx, 1)[0]); changed(); }));
    if (idx < a.rules.length - 1) tools.appendChild(miniBtn('↓', 'Descer', () => { a.rules.splice(idx + 1, 0, a.rules.splice(idx, 1)[0]); changed(); }));
    tools.appendChild(miniBtn('✕', 'Apagar regra', () => { a.rules.splice(idx, 1); changed(); }, 'danger'));
    head.appendChild(tools);
    card.appendChild(head);

    if (rule.if) {
      const cond = document.createElement('div');
      cond.className = 'rule-if';
      const t = document.createElement('span');
      t.className = 'tag if';
      t.textContent = 'SE';
      cond.appendChild(t);
      cond.appendChild(paramInput({ k: 'var', t: 'operand' }, rule.if));
      cond.appendChild(paramInput({ k: 'cmp', t: 'cmp' }, rule.if));
      cond.appendChild(paramInput({ k: 'value', t: 'number', step: 1 }, rule.if));
      cond.appendChild(miniBtn('✕', 'Tirar a condição', () => { delete rule.if; changed(); }, 'danger'));
      card.appendChild(cond);
    }

    const body = document.createElement('div');
    body.className = 'rule-do';
    rule.do.forEach((act, j) => {
      const row = document.createElement('div');
      row.className = 'action';
      const t = document.createElement('span');
      t.className = 'tag do';
      t.textContent = 'FAÇA';
      row.appendChild(t);
      row.appendChild(select(Object.entries(ACTIONS).map(([k, x]) => [k, x.label]), act.type, (v) => { rule.do[j] = GS.newAction(v, app().project); changed(); }));
      ACTIONS[act.type].params.forEach((p) => row.appendChild(paramInput(p, act)));
      row.appendChild(miniBtn('✕', 'Apagar ação', () => { rule.do.splice(j, 1); changed(); }, 'danger'));
      body.appendChild(row);
    });
    const add = miniBtn('+ ação', 'Adicionar ação', () => { rule.do.push(GS.newAction('mover', app().project)); changed(); });
    body.appendChild(add);
    card.appendChild(body);
    return card;
  }

  // Variáveis do jogo: nome, valor inicial e se aparece na tela
  function renderVars() {
    const p = app().project, box = $('vars-list');
    $('vars-panel').hidden = !showVars;
    $('btn-vars').classList.toggle('on', showVars);
    $('btn-vars').textContent = `🔢 Variáveis (${GS.vars(p).length})`;
    if (!showVars) return;
    box.innerHTML = '';
    if (!GS.vars(p).length) {
      const e = document.createElement('p');
      e.className = 'muted';
      e.textContent = 'Uma variável guarda um número que as regras podem mudar e conferir, como chaves, moedas especiais ou tempo. Todos os atores enxergam as mesmas variáveis.';
      box.appendChild(e);
    }
    GS.vars(p).forEach((v) => {
      const row = document.createElement('div');
      row.className = 'var-row';
      const name = document.createElement('input');
      name.type = 'text';
      name.className = 'input';
      name.maxLength = 16;
      name.value = v.name;
      name.setAttribute('aria-label', 'Nome da variável');
      name.addEventListener('change', () => { v.name = GS.cleanVarName(p, name.value, v.id); app().save(); render(); });
      const start = document.createElement('label');
      start.className = 'num';
      start.append('começa em ');
      const si = document.createElement('input');
      si.type = 'number';
      si.className = 'input';
      si.value = v.start;
      si.addEventListener('input', () => { if (si.value !== '' && !isNaN(Number(si.value))) { v.start = Number(si.value); app().save(); renderCode(); } });
      start.appendChild(si);
      const hud = document.createElement('label');
      hud.className = 'check';
      const hi = document.createElement('input');
      hi.type = 'checkbox';
      hi.checked = !!v.hud;
      hi.addEventListener('change', () => { v.hud = hi.checked; app().save(); });
      hud.append(hi, ' na tela');
      const del = miniBtn('✕', 'Apagar variável', async () => {
        const uses = p.actors.reduce((n, a) => n + a.rules.filter((r) => JSON.stringify(r).includes('v:' + v.id)).length, 0);
        const text = uses ? `Apagar "${v.name}"? Ela é usada em ${uses} regra${uses > 1 ? 's' : ''}, que vão parar de funcionar.` : `Apagar "${v.name}"?`;
        if (!(await GS.ask({ icon: '🔢', text, yes: 'Apagar' }))) return;
        p.vars = GS.vars(p).filter((x) => x !== v);
        changed();
      }, 'danger');
      row.append(name, start, hud, del);
      box.appendChild(row);
    });
  }

  function renderCode() {
    const box = $('rules-code');
    box.hidden = !showCode;
    if (showCode) box.textContent = GS.rulesToCode(actor(), app().project);
  }

  function render() {
    const a = actor();
    app().renderActorList($('rules-actors'), (id) => { app().actorId = id; render(); });
    const th = $('rules-thumb');
    th.width = th.height = a.size;
    th.getContext('2d').drawImage(GS.thumb(a, app().project.palette), 0, 0);
    $('rules-actor-name').textContent = `${KINDS[a.kind].icone} ${a.name}`;
    $('rules-gravity').checked = !!a.props.gravidade;
    $('btn-code').classList.toggle('on', showCode);
    $('btn-code').textContent = showCode ? '✕ Fechar código' : '</> Ver como código';
    const list = $('rules-list');
    list.innerHTML = '';
    if (!a.rules.length) {
      const p = document.createElement('p');
      p.className = 'muted empty';
      p.textContent = a.kind === 'bloco' || a.kind === 'plataforma'
        ? 'Blocos e plataformas são o chão e as paredes da fase. Eles não usam regras.'
        : a.kind === 'cenario'
        ? 'Cenário aparece repetido no fundo da fase (vista de lado), atrás de tudo. Ele não usa regras.'
        : 'Este ator ainda não tem regras, então ele fica parado. Crie uma regra ou escolha uma das regras prontas.';
      list.appendChild(p);
    }
    a.rules.forEach((r, i) => list.appendChild(renderRule(r, i)));
    renderVars();
    renderCode();
    if (focusRule !== null) {
      const card = list.children[focusRule];
      focusRule = null;
      if (card && card.classList.contains('rule')) {
        card.classList.add('spot');
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => card.classList.remove('spot'), 2200);
      }
    }
  }

  function show() {
    build();
    if (!actor()) app().actorId = app().project.actors[0].id;
    render();
  }

  // Abre as regras de um ator e acende uma regra (usado pelo modo de investigar)
  function reveal(actorId, idx) {
    app().actorId = actorId;
    focusRule = idx;
  }

  GS.RulesEditor = { show, reveal };
})();
