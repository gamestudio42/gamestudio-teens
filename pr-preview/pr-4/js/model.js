// Modelo do projeto: atores (desenho + regras), fases, catálogo de regras,
// modelos prontos, salvamento e geração do "código" das regras.
(function () {
  const GS = (window.GS = {});

  GS.T = 16;

  // Paletas dos estilos. Cada projeto guarda a sua própria cópia (editável).
  GS.PALETTES = {
    neon: [
      '#0d0b1e', '#000000', '#ffffff', '#38f2ff',
      '#1b8fb8', '#b8ff5c', '#5fbf2a', '#ff4fd8',
      '#a12ca8', '#e6e8ff', '#9aa0c8', '#3a3566',
      '#262247', '#ffe45c', '#ff9d2e', '#1a1733',
    ],
    bosque: [
      '#2b1e16', '#1a120c', '#fff6e0', '#a8743f',
      '#7a4f2a', '#d9a066', '#8fc94f', '#4f8a3a',
      '#c6e87a', '#e0533a', '#a3302a', '#a9a395',
      '#6f6a60', '#ffd45e', '#e8932c', '#3d5a3a',
    ],
  };
  GS.PALETTE = GS.PALETTES.neon;

  GS.KINDS = {
    jogador: { icone: '🕹️', nome: 'Jogador' },
    bloco: { icone: '🧱', nome: 'Bloco' },
    plataforma: { icone: '➖', nome: 'Plataforma' },
    item: { icone: '💎', nome: 'Item' },
    inimigo: { icone: '👾', nome: 'Inimigo' },
    perigo: { icone: '⚠️', nome: 'Perigo' },
    mola: { icone: '🍄', nome: 'Mola' },
    objetivo: { icone: '🏁', nome: 'Objetivo' },
    checkpoint: { icone: '🚩', nome: 'Ponto de controle' },
    projetil: { icone: '✨', nome: 'Projétil' },
    decoracao: { icone: '🌿', nome: 'Decoração' },
    cenario: { icone: '🏙️', nome: 'Cenário' },
  };
  GS.KIND_ORDER = ['jogador', 'bloco', 'plataforma', 'item', 'inimigo', 'perigo', 'mola', 'objetivo', 'checkpoint', 'projetil', 'decoracao', 'cenario'];
  // Tipos que ocupam uma célula inteira e são sempre 16×16
  GS.TILE_KINDS = ['bloco', 'plataforma'];

  // ---------- Catálogo de regras ----------
  GS.KEYS = { esquerda: '← esquerda', direita: '→ direita', cima: '↑ cima', baixo: '↓ baixo', espaco: 'espaço', z: 'Z', x: 'X' };
  GS.DIRS = { frente: 'para a frente', esquerda: 'para a esquerda', direita: 'para a direita', cima: 'para cima', baixo: 'para baixo', jogador: 'na direção do jogador' };
  GS.CMPS = { '>=': '≥ (maior ou igual)', '>': '> (maior)', '==': '= (igual)', '!=': '≠ (diferente)', '<': '< (menor)', '<=': '≤ (menor ou igual)' };
  GS.OPS = { somar: 'somar', definir: 'mudar para' };
  GS.SOUND_NAMES = { bip: 'bip', pulo: 'pulo', moeda: 'moeda', tiro: 'tiro', explosao: 'explosão', dano: 'dano', vitoria: 'vitória' };

  GS.EVENTS = {
    inicio: { label: 'Ao começar a fase', code: 'inicio', params: [] },
    sempre: { label: 'Sempre (60 vezes por segundo)', code: 'sempre', params: [] },
    tecla: { label: 'Enquanto a tecla estiver apertada', code: 'tecla', params: [{ k: 'key', t: 'key', def: 'direita' }] },
    teclaPressionada: { label: 'Ao apertar a tecla', code: 'teclaPressionada', params: [{ k: 'key', t: 'key', def: 'espaco' }] },
    tocar: { label: 'Ao tocar em', code: 'tocar', params: [{ k: 'target', t: 'target', def: 'kind:jogador' }] },
    tocarPorCima: { label: 'Ao pisar em (cair por cima)', code: 'pisar', params: [{ k: 'target', t: 'target', def: 'kind:inimigo' }] },
    bater: { label: 'Ao bater em uma parede', code: 'baterNaParede', params: [] },
    beirada: { label: 'Ao chegar na beirada', code: 'chegarNaBeirada', params: [] },
    tempo: { label: 'A cada X segundos', code: 'aCada', params: [{ k: 'seconds', t: 'number', def: 1, min: 0.1, step: 0.1 }] },
    pontos: { label: 'Quando os pontos chegarem a', code: 'quandoPontos', params: [{ k: 'value', t: 'number', def: 10, step: 1 }] },
    variavel: { label: 'Quando a variável ficar', code: 'quandoVariavel', params: [{ k: 'var', t: 'operand', def: 'g:pontos' }, { k: 'cmp', t: 'cmp', def: '>=' }, { k: 'value', t: 'number', def: 3, step: 1 }] },
  };

  GS.ACTIONS = {
    mover: { label: 'Mover', code: 'mover', params: [{ k: 'dir', t: 'dir', def: 'frente' }, { k: 'speed', t: 'number', def: 1, min: 0, step: 0.1, label: 'velocidade' }] },
    pular: { label: 'Pular', code: 'pular', params: [{ k: 'force', t: 'number', def: 6, min: 0, step: 0.5, label: 'força' }] },
    quicar: { label: 'Quicar', code: 'quicar', params: [{ k: 'force', t: 'number', def: 4, min: 0, step: 0.5, label: 'força' }] },
    virar: { label: 'Virar para o outro lado', code: 'virar', params: [] },
    pontos: { label: 'Somar pontos', code: 'somarPontos', params: [{ k: 'value', t: 'number', def: 1, step: 1 }] },
    vida: { label: 'Somar vidas', code: 'somarVidas', params: [{ k: 'value', t: 'number', def: -1, step: 1 }] },
    som: { label: 'Tocar som', code: 'som', params: [{ k: 'name', t: 'sound', def: 'bip' }] },
    criar: { label: 'Criar ator', code: 'criar', params: [{ k: 'actor', t: 'actor', def: '' }] },
    sumir: { label: 'Sumir', code: 'sumir', params: [] },
    sumirOutro: { label: 'Fazer o outro sumir', code: 'sumirOutro', params: [] },
    mensagem: { label: 'Mostrar mensagem', code: 'mensagem', params: [{ k: 'text', t: 'text', def: 'Olá!' }] },
    voltarInicio: { label: 'Voltar ao ponto de partida', code: 'voltarAoInicio', params: [] },
    salvarPartida: { label: 'Salvar aqui o ponto de partida do jogador', code: 'salvarPontoDePartida', params: [] },
    mudarVar: { label: 'Mudar variável', code: 'mudar', params: [{ k: 'var', t: 'var', def: '' }, { k: 'op', t: 'op', def: 'somar' }, { k: 'value', t: 'number', def: 1, step: 1 }] },
    sortear: { label: 'Sortear número para', code: 'sortear', params: [{ k: 'var', t: 'var', def: '' }, { k: 'min', t: 'number', def: 1, step: 1, label: 'de' }, { k: 'max', t: 'number', def: 6, step: 1, label: 'até' }] },
    irFase: { label: 'Ir para a próxima fase', code: 'proximaFase', params: [] },
    vencer: { label: 'Vencer o jogo', code: 'vencer', params: [] },
    perder: { label: 'Perder o jogo', code: 'perder', params: [] },
  };

  GS.newWhen = function (type, project) {
    const w = { type };
    GS.EVENTS[type].params.forEach((p) => { w[p.k] = p.def; });
    if (type === 'variavel' && project && GS.vars(project).length) w.var = 'v:' + GS.vars(project)[0].id;
    return w;
  };
  GS.newAction = function (type, project) {
    const a = { type };
    GS.ACTIONS[type].params.forEach((p) => { a[p.k] = p.def; });
    if (a.var === '' && project && GS.vars(project).length) a.var = 'v:' + GS.vars(project)[0].id;
    if (type === 'criar' && project) {
      const pick = project.actors.find((x) => x.kind === 'projetil') || project.actors.find((x) => x.kind !== 'bloco');
      a.actor = pick ? pick.id : '';
    }
    return a;
  };

  // ---------- Variáveis do jogo ----------
  // Ficam no projeto (p.vars) e valem para todos os atores. As regras guardam
  // "v:<id>" para uma variável ou "g:pontos" / "g:vidas" para os números do jogo.
  GS.vars = (p) => (p.vars = Array.isArray(p.vars) ? p.vars : []);
  GS.varName = function (p, ref) {
    if (ref === 'g:pontos') return 'pontos';
    if (ref === 'g:vidas') return 'vidas';
    const v = GS.vars(p).find((x) => 'v:' + x.id === ref);
    return v ? v.name : '?';
  };
  // Nome de variável vira um identificador: letras, números e _
  GS.cleanVarName = function (p, name, selfId) {
    let n = String(name || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 16) || 'variavel';
    if (/^\p{N}/u.test(n)) n = '_' + n;
    const taken = (x) => x === 'pontos' || x === 'vidas' || GS.vars(p).some((v) => v.name === x && v.id !== selfId);
    let k = 2, out = n;
    while (taken(out)) out = n + k++;
    return out;
  };
  GS.newVar = function (p, name) {
    const v = { id: GS.uid(), name: GS.cleanVarName(p, name || 'chaves'), start: 0, hud: true };
    GS.vars(p).push(v);
    return v;
  };

  // Regras prontas que podem ser adicionadas a qualquer ator
  const R = (when, ...acts) => ({ when, do: acts });
  GS.PRESETS = {
    plataforma: {
      nome: 'Controles de plataforma',
      rules: (p) => [
        R({ type: 'tecla', key: 'esquerda' }, { type: 'mover', dir: 'esquerda', speed: 1.6 }),
        R({ type: 'tecla', key: 'direita' }, { type: 'mover', dir: 'direita', speed: 1.6 }),
        R({ type: 'teclaPressionada', key: 'cima' }, { type: 'pular', force: 6 }, { type: 'som', name: 'pulo' }),
      ],
    },
    cima: {
      nome: 'Controles de vista de cima',
      rules: () => ['esquerda', 'direita', 'cima', 'baixo'].map((k) => R({ type: 'tecla', key: k }, { type: 'mover', dir: k, speed: 1.4 })),
    },
    atirar: {
      nome: 'Atirar com espaço',
      rules: (p) => [R({ type: 'teclaPressionada', key: 'espaco' }, GS.newAction('criar', p), { type: 'som', name: 'tiro' })],
    },
    patrulha: {
      nome: 'Patrulha (vai e volta)',
      rules: () => [
        R({ type: 'sempre' }, { type: 'mover', dir: 'frente', speed: 0.5 }),
        R({ type: 'bater' }, { type: 'virar' }),
        R({ type: 'beirada' }, { type: 'virar' }),
      ],
    },
    persegue: {
      nome: 'Persegue o jogador',
      rules: () => [R({ type: 'sempre' }, { type: 'mover', dir: 'jogador', speed: 0.35 })],
    },
    coletavel: {
      nome: 'Coletável (dá pontos e some)',
      rules: () => [R({ type: 'tocar', target: 'kind:jogador' }, { type: 'pontos', value: 1 }, { type: 'som', name: 'moeda' }, { type: 'sumir' })],
    },
    objetivo: {
      nome: 'Objetivo (vai para a próxima fase)',
      rules: () => [R({ type: 'tocar', target: 'kind:jogador' }, { type: 'irFase' })],
    },
    projetil: {
      nome: 'Projétil (voa e derrota inimigos)',
      rules: () => [
        R({ type: 'sempre' }, { type: 'mover', dir: 'frente', speed: 3 }),
        R({ type: 'bater' }, { type: 'sumir' }),
        R({ type: 'tempo', seconds: 1.5 }, { type: 'sumir' }),
        R({ type: 'tocar', target: 'kind:inimigo' }, { type: 'sumirOutro' }, { type: 'pontos', value: 5 }, { type: 'som', name: 'explosao' }, { type: 'sumir' }),
      ],
    },
    dano: {
      nome: 'Inimigo tira vida (jogador)',
      rules: () => [R({ type: 'tocar', target: 'kind:inimigo' }, { type: 'vida', value: -1 }, { type: 'voltarInicio' })],
    },
    perigo: {
      nome: 'Perigo tira vida (jogador)',
      rules: () => [R({ type: 'tocar', target: 'kind:perigo' }, { type: 'vida', value: -1 }, { type: 'voltarInicio' })],
    },
    mola: {
      nome: 'Pular alto na mola (jogador)',
      rules: () => [R({ type: 'tocarPorCima', target: 'kind:mola' }, { type: 'quicar', force: 8.5 }, { type: 'som', name: 'pulo' })],
    },
    checkpoint: {
      nome: 'Ponto de controle (o jogador volta para cá)',
      rules: () => [R({ type: 'tocar', target: 'kind:jogador' }, { type: 'salvarPartida' })],
    },
    pisar: {
      nome: 'Pisar no inimigo (jogador)',
      rules: () => [R({ type: 'tocarPorCima', target: 'kind:inimigo' }, { type: 'sumirOutro' }, { type: 'quicar', force: 4 }, { type: 'pontos', value: 10 }, { type: 'som', name: 'explosao' })],
    },
  };

  // ---------- Desenhos iniciais ----------
  function rows(list) {
    const px = [];
    for (const r of list) for (const ch of r.padEnd(16, '.').slice(0, 16)) px.push(ch === '.' ? -1 : parseInt(ch, 16));
    while (px.length < 256) px.push(-1);
    return px;
  }
  GS.rows = rows;

  // Desenhos iniciais dos estilos Neon e Bosque (índices da paleta de cada estilo)
  const ART = {
    neon: {
      jogador: [
        rows([
          '................', '.......00.......', '.......07.......', '....00000000....',
          '...099999999a0..', '...090000000a0..', '...090333230a0..', '...090333340a0..',
          '...090000000a0..', '...0a999999aa0..', '....000aa00000..', '...0bbbbbbbbb0..',
          '..09b3bbbb3bbba0', '...0bbbbbbbb0...', '...0aa0..0aa0...', '...000....000...',
        ]),
        rows([
          '................', '................', '.......00.......', '.......07.......',
          '....00000000....', '...099999999a0..', '...090000000a0..', '...090333230a0..',
          '...090333340a0..', '...090000000a0..', '...0a999999aa0..', '....000aa00000..',
          '..09bbbbbbbbba0.', '...0b3bbbb3bb0..', '....0aa0.0aa0...', '....000..000....',
        ]),
      ],
      grama: [
        rows([
          '3333333333333333', '4444444444444444', 'bbbbbbbcbbbbbbbc', 'bbbbbbbcbbbbbbbc',
          'bbbbbbbcbbbbbbbc', 'cccccccccccccccc', 'bbbcbbbbbbbcbbbb', 'bbbcbbbbbbbcbbbb',
          'bbbcbbbbbbbcbbbb', 'cccccccccccccccc', 'bbbbbbbcbbbbbbbc', 'bbbbbbbcbbbbbbbc',
          'bbbbbbbcbbbbbbbc', 'cccccccccccccccc', 'bbbcbbbbbbbcbbbb', 'bbbcbbbbbbbcbbbb',
        ]),
      ],
      pedra: [
        rows([
          'bbbcbbbbbbbcbbbb', 'bbbcbbbbbbbcbbbb', 'cccccccccccccccc', 'bbbbbbbcbbbbbbbc',
          'bbbbbbbcbbbbbbbc', 'bbbbbbbcbbbbbbbc', 'cccccccccccccccc', 'bbbcbbbbbbbcbbbb',
          'bbbcbbbbbbbcbbbb', 'bbbcbbbbbbbcbbbb', 'cccccccccccccccc', 'bbbbbbbcbbbbbbbc',
          'bbbbbbbcbbbbbbbc', 'bbbbbbbcbbbbbbbc', 'cccccccccccccccc', 'bbbcbbbbbbbcbbbb',
        ]),
      ],
      moeda: [
        rows([
          '................', '.......00.......', '......0560......', '.....055660.....',
          '.....025660.....', '....02556660....', '....05555660....', '...0255566660...',
          '...0555566660...', '....05566660....', '....05566660....', '.....056660.....',
          '.....056660.....', '......0660......', '.......00.......', '................',
        ]),
        rows([
          '................', '.......00.......', '......0560......', '.....055660.....',
          '.....055660.....', '....05556660....', '....05555660....', '...0555566660...',
          '...0555566660...', '....05566660....', '....05566660....', '.....056660.....',
          '.....056660.....', '......0660......', '.......00.......', '................',
        ]),
      ],
      inimigo: [
        rows([
          '................', '...00......00...', '..0780....0870..', '...0880000080...',
          '....08888880....', '...0882222880...', '..088222222880..', '..082221122280..',
          '..082211112280..', '..082221122280..', '..088222222880..', '...0888888880...',
          '....00088000....', '......0780......', '.......00.......', '................',
        ]),
        rows([
          '................', '................', '...00......00...', '..0780....0870..',
          '...0880000080...', '....08888880....', '...0882222880...', '..088222222880..',
          '..082221122280..', '..082211112280..', '..082221122280..', '..088222222880..',
          '...0888888880...', '....00088000....', '......0780......', '.......00.......',
        ]),
      ],
      bandeira: [
        rows([
          '.....000000.....', '...0077777700...', '..077000000770..', '.0700......0070.',
          '.070........070.', '070..........070', '070..........070', '070..........070',
          '070..........070', '070..........070', '070..........070', '.070........070.',
          '.0700......0070.', '..077000000770..', '...0888888880...', '..0aaaaaaaaaa0..',
        ]),
        rows([
          '.....000000.....', '...0088888800...', '..088000000880..', '.0800......0080.',
          '.080........080.', '080..........080', '080..........080', '080..........080',
          '080..........080', '080..........080', '080..........080', '.080........080.',
          '.0800......0080.', '..088000000880..', '...0777777770...', '..0aaaaaaaaaa0..',
        ]),
      ],
      tiro: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '.....033330.....', '....03322330....',
          '.....033330.....', '................', '................', '................',
          '................', '................', '................', '................',
        ]),
        rows([
          '................', '................', '................', '................',
          '................', '................', '.....044440.....', '....04322340....',
          '.....044440.....', '................', '................', '................',
          '................', '................', '................', '................',
        ]),
      ],
      flor: [
        rows([
          '.......00.......', '......0dd0......', '......0de0......', '.......00.......',
          '.......00.......', '.......0a0......', '.......0a0......', '.......0a0......',
          '.......0a0......', '.......0a0......', '.......0a0......', '.......0a0......',
          '.......0a0......', '......0aaa0.....', '.....0aaaaa0....', '....00000000....',
        ]),
        rows([
          '.......00.......', '......0ee0......', '......0ed0......', '.......00.......',
          '.......00.......', '.......0a0......', '.......0a0......', '.......0a0......',
          '.......0a0......', '.......0a0......', '.......0a0......', '.......0a0......',
          '.......0a0......', '......0aaa0.....', '.....0aaaaa0....', '....00000000....',
        ]),
      ],
      ponte: [
        rows([
          '3333333333333333', '0444444444444440', '0999999999999990', '0aaaaaaaaaaaaaa0',
          '.00..........00.', '................', '................', '................',
          '................', '................', '................', '................',
          '................', '................', '................', '................',
        ]),
      ],
      espinho: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '................', '..0....0....0...',
          '.020..020..020..', '.0240.0240.0240.', '023400234002340.', '0234402344023440',
          '0233402334023340', '0000000000000000', '0bbbbbbbbbbbbbb0', '0000000000000000',
        ]),
      ],
      mola: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '....00000000....', '..002772777700..',
          '.02722777722780.', '0277227777227880', '0888888888888880', '.00000000000000.',
          '.....0dddd0.....', '....0eeeeee0....', '.....0dddd0.....', '....00000000....',
        ]),
      ],
      cenario: [
        rows([
          '................', '................', '..bb............', '..bb......cc....',
          '.bbbb.....cc....', '.b7bb....cccc...', '.bbbb....cdcc...', '.bb7b.bb.cccc...',
          '.bbbb.bb.ccdc.bb', '.b7bbbbbbbccccbb', 'bbbbbb7bbbccccbb', 'bbbbbbbbbbbcdcbb',
          'bb7bbbbbbbbcccbb', 'bbbbbbb7bbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb',
        ]),
      ],
    },
    bosque: {
      jogador: [
        rows([
          '........00......', '.......0860.....', '...00.08670.....', '..08600670......',
          '..0667070.......', '...000000000....', '...0555555530...', '..055555555530..',
          '..0555512551230.', '..0555511551130.', '..0555555555330.', '...05555500030..',
          '...04333333340..', '....043333340...', '....0440.0440...', '....000...000...',
        ]),
        rows([
          '................', '........00......', '.......0860.....', '...00.08670.....',
          '..08600670......', '..0667070.......', '...000000000....', '...0555555530...',
          '..055555555530..', '..0555512551230.', '..0555511551130.', '..0555555555330.',
          '...05555500030..', '...04333333340..', '...0440..0440...', '...000....000...',
        ]),
      ],
      grama: [
        rows([
          '..00...00....00.', '.0680.0680..0680', '0666606666006666', '6666666666666666',
          '6766667666667666', '7776777776777767', '0770770777077070', 'bbb0bbbbb0bbb0bb',
          'bbbbbbbbbbbbbbbb', 'bbcbbbbbbbbcbbbb', 'bcc0bbbbbbbcc0bb', 'bbbbbbbbbbbbbbbb',
          '0000000000000000', 'bbbbbbbb0bbbbbbb', 'bbbcbbbbbbbbbcbb', 'bbccbbb0bbbbccbb',
        ]),
      ],
      pedra: [
        rows([
          'bbbbbbbb0bbbbbbb', 'bbbcbbbbbbbbbcbb', 'bbccbbb0bbbbccbb', 'bbbbbbbbbbbbbbbb',
          '0000000000000000', 'bbbbb0bbbbbbb0bb', 'bbcbbbbbbcbbbbbb', 'bccbbbbbccbbbbbb',
          'bbbbbbbbbbbbbbbb', '0000000000000000', 'bbbbbbbb0bbbbbbb', 'bbbbbcbbbbbbcbbb',
          'bbbbccbbbbbccbbb', 'bbbbbbbbbbbbbbbb', '0000000000000000', 'bbb0bbbbbbb0bbbb',
        ]),
      ],
      moeda: [
        rows([
          '................', '........00......', '.......030......', '.....0004000....',
          '....033333330...', '...03535353530..', '...04444444440..', '....0000000000..',
          '....035555540...', '....055255540...', '....052555540...', '....055555440...',
          '.....0555440....', '......05440.....', '.......000......', '................',
        ]),
        rows([
          '................', '................', '........00......', '.......030......',
          '.....0004000....', '....033333330...', '...03535353530..', '...04444444440..',
          '....0000000000..', '....035555540...', '....055255540...', '....052555540...',
          '....055555440...', '.....0555440....', '......05440.....', '.......000......',
        ]),
      ],
      inimigo: [
        rows([
          '................', '................', '................', '.....000000.....',
          '...0099999a00...', '..09929999aaa0..', '.0929999a99aaa0.', '.0999999a99aaa0.',
          '00999999a999aa00', '0110000000000000', '0121cccccccccc0.', '01110cccccccc0..',
          '.000.00000000...', '...010.010.010..', '..010.010.010...', '................',
        ]),
        rows([
          '................', '................', '................', '.....000000.....',
          '...0099999a00...', '..09929999aaa0..', '.0929999a99aaa0.', '.0999999a99aaa0.',
          '00999999a999aa00', '0110000000000000', '0121cccccccccc0.', '01110cccccccc0..',
          '.000.00000000...', '..010.010.010...', '.010.010.010....', '................',
        ]),
      ],
      bandeira: [
        rows([
          '....00000000....', '...0333333330...', '..044444444440..', '...0000000000...',
          '....0ddddde0....', '....0d2ddde0....', '....0ddddde0....', '....0edddee0....',
          '...0000000000...', '......0440......', '......0340......', '......0340......',
          '......0340......', '......0340......', '.....033440.....', '....00000000....',
        ]),
        rows([
          '....00000000....', '...0333333330...', '..044444444440..', '...0000000000...',
          '....0eeeeee0....', '....0edeeee0....', '....0eeeeee0....', '....0eeeeee0....',
          '...0000000000...', '......0440......', '......0340......', '......0340......',
          '......0340......', '......0340......', '.....033440.....', '....00000000....',
        ]),
      ],
      tiro: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '......00........', '.....0350.......',
          '.....0340.......', '......00........', '................', '................',
          '................', '................', '................', '................',
        ]),
        rows([
          '................', '................', '................', '................',
          '................', '................', '......00........', '.....0530.......',
          '.....0430.......', '......00........', '................', '................',
          '................', '................', '................', '................',
        ]),
      ],
      flor: [
        rows([
          '................', '................', '......0000......', '....00999900....',
          '...0992299990...', '..0999299929a0..', '..0999999999a0..', '..0a9929999aa0..',
          '...0000000000...', '.....022220.....', '.....0222c0.....', '.....0222c0.....',
          '.....0222c0.....', '...67022cc076...', '..677700007776..', '................',
        ]),
      ],
      ponte: [
        rows([
          '0000000000000000', '0555555555555350', '0333333333333330', '0000000000000000',
          '.03.........30..', '.00.........00..', '................', '................',
          '................', '................', '................', '................',
          '................', '................', '................', '................',
        ]),
      ],
      espinho: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '................', '..0....0....0...',
          '.080..080..080..', '.0870.0870.0870.', '086700867008670.', '0867708677086770',
          '0866708667086670', '0000000000000000', '0444444444444440', '0000000000000000',
        ]),
      ],
      mola: [
        rows([
          '................', '................', '................', '................',
          '................', '................', '....00000000....', '..002dd2dddd00..',
          '.02d22dddd22de0.', '02dd22dddd22dee0', '0eeeeeeeeeeeeee0', '.00000000000000.',
          '.....055550.....', '....03333330....', '.....055550.....', '....00000000....',
        ]),
      ],
      cenario: [
        rows([
          '....7...........', '...777..........', '...777.......7..', '..77777.....777.',
          '..77777.....777.', '.7777777...77777', '.7777777...77777', '777777777.777777',
          '7777777777777777', '7777f77777777777', '77777777777f7777', '7777777777777777',
          '7f77777777777777', '7777777f77777777', '7777777777777777', '7777777777777777',
        ]),
      ],
    },
  };

  // Ponto de controle: quadro 1 apagado, quadro 2 aceso (o jogo troca quando o jogador passa)
  function flag(pole, off, on, hi) {
    const paint = (list) => rows(list.map((r) => r.replace(/P/g, pole).replace(/U/g, off).replace(/F/g, on).replace(/H/g, hi)));
    return [
      paint([
        '................', '......00........', '.....0P0........', '.....0P0........',
        '.....0P0........', '.....0P0........', '.....0P0........', '.....0P000000...',
        '.....0P0UUUU0...', '.....0P0UUUUU0..', '.....0P0UUU00...', '.....0P0000.....',
        '.....0P0........', '....00P00.......', '...0PPPPP0......', '...0000000......',
      ]),
      paint([
        '................', '.....000000000..', '.....0P0FFFHH0..', '.....0P0FFFFHH0.',
        '.....0P0FFFFFF0.', '.....0P0FFFF00..', '.....0P00000....', '.....0P0........',
        '.....0P0........', '.....0P0........', '.....0P0........', '.....0P0........',
        '.....0P0........', '....00P00.......', '...0PPPPP0......', '...0000000......',
      ]),
    ];
  }
  ART.neon.checkpoint = flag('a', '8', '3', '9');
  ART.bosque.checkpoint = flag('4', 'c', 'd', '2');

  GS.uid = () => Math.random().toString(36).slice(2, 10);
  GS.blank = (size) => new Array(size * size).fill(-1);

  GS.newActor = function (kind, name, size) {
    size = size || 16;
    if (GS.TILE_KINDS.includes(kind)) size = 16;
    return { id: GS.uid(), name: name || GS.KINDS[kind].nome, kind, size, fps: 6, frames: [GS.blank(size)], props: { gravidade: kind === 'jogador' || kind === 'inimigo' }, rules: [] };
  };

  function actor(id, name, kind, frames, gravidade, rules) {
    return { id, name, kind, size: 16, fps: 6, frames: frames.map((f) => f.slice()), props: { gravidade }, rules };
  }

  GS.newLevel = function (name, w, h, view) {
    return { id: GS.uid(), name, w, h, view: view || 'lado', bg: view === 'cima' ? '#1a1733' : '#120f2e', cells: new Array(w * h).fill(null) };
  };

  function put(lv, x, y, id) { if (x >= 0 && y >= 0 && x < lv.w && y < lv.h) lv.cells[y * lv.w + x] = id; }
  function line(lv, x0, x1, y, id) { for (let x = x0; x <= x1; x++) put(lv, x, y, id); }
  function col(lv, x, y0, y1, id) { for (let y = y0; y <= y1; y++) put(lv, x, y, id); }

  GS.newProject = function (name, template) {
    const top = template === 'cima';
    const style = template === 'bosque' ? 'bosque' : 'neon';
    const A = ART[style], N = style === 'bosque'
      ? { jogador: 'Broto', grama: 'Musgo', pedra: 'Pedra', moeda: 'Bolota', inimigo: 'Besouro', bandeira: 'Lanterna', checkpoint: 'Totem', tiro: 'Semente', flor: 'Cogumelo', ponte: 'Tronco', espinho: 'Espinheiro', mola: 'Flor-mola', cenario: 'Pinheiros' }
      : { jogador: 'Bip', grama: 'Chão', pedra: 'Parede', moeda: 'Cristal', inimigo: 'Olhão', bandeira: 'Portal', checkpoint: 'Antena-base', tiro: 'Laser', flor: 'Antena', ponte: 'Ponte', espinho: 'Espinhos', mola: 'Mola', cenario: 'Cidade' };
    const P = GS.PRESETS;
    const tmp = { actors: [] };
    const actors = [
      actor('jogador', N.jogador, 'jogador', A.jogador, !top, []),
      actor('grama', N.grama, 'bloco', A.grama, false, []),
      actor('pedra', N.pedra, 'bloco', A.pedra, false, []),
      actor('ponte', N.ponte, 'plataforma', A.ponte, false, []),
      actor('moeda', N.moeda, 'item', A.moeda, false, P.coletavel.rules()),
      actor('inimigo', N.inimigo, 'inimigo', A.inimigo, !top, top ? P.persegue.rules() : P.patrulha.rules()),
      actor('espinho', N.espinho, 'perigo', A.espinho, false, []),
      actor('mola', N.mola, 'mola', A.mola, false, []),
      actor('bandeira', N.bandeira, 'objetivo', A.bandeira, false, P.objetivo.rules()),
      actor('checkpoint', N.checkpoint, 'checkpoint', A.checkpoint, false, P.checkpoint.rules()),
      actor('tiro', N.tiro, 'projetil', A.tiro, false, P.projetil.rules()),
      actor('flor', N.flor, 'decoracao', A.flor, false, []),
      actor('cenario', N.cenario, 'cenario', A.cenario, false, []),
    ];
    tmp.actors = actors;
    actors[0].rules = [
      ...(top ? P.cima.rules() : P.plataforma.rules()),
      ...P.atirar.rules(tmp),
      ...(top ? [] : P.pisar.rules()),
      ...(top ? [] : P.mola.rules()),
      ...P.dano.rules(),
      ...P.perigo.rules(),
    ];

    // chão com pedra embaixo, de x0 até x1
    const ground = (lv, x0, x1) => { line(lv, x0, x1, lv.h - 2, 'grama'); line(lv, x0, x1, lv.h - 1, 'pedra'); };
    const levels = [];
    if (template === 'vazio') {
      levels.push(GS.newLevel('Fase 1', 40, 12, 'lado'));
    } else if (top) {
      const a = GS.newLevel('Labirinto', 24, 16, 'cima');
      line(a, 0, 23, 0, 'pedra'); line(a, 0, 23, 15, 'pedra'); col(a, 0, 0, 15, 'pedra'); col(a, 23, 0, 15, 'pedra');
      line(a, 4, 12, 5, 'pedra'); col(a, 16, 3, 10, 'pedra'); line(a, 6, 18, 11, 'pedra');
      [[3, 3], [8, 3], [14, 7], [20, 4], [10, 8], [4, 13], [19, 13], [12, 13]].forEach(([x, y]) => put(a, x, y, 'moeda'));
      put(a, 20, 8, 'inimigo'); put(a, 8, 9, 'inimigo');
      put(a, 13, 3, 'espinho'); put(a, 14, 3, 'espinho'); put(a, 9, 13, 'espinho');
      put(a, 6, 2, 'flor'); put(a, 18, 12, 'flor');
      put(a, 21, 14, 'bandeira');
      put(a, 2, 2, 'jogador');
      levels.push(a);
    } else {
      const bg = style === 'bosque' ? ['#bfe3d6', '#f2c48d'] : ['#120f2e', '#2a0f3e'];
      const a = GS.newLevel('Fase 1', 40, 12, 'lado');
      a.bg = bg[0];
      ground(a, 0, 13); ground(a, 16, 25); ground(a, 27, 39);
      line(a, 8, 10, 7, 'ponte'); line(a, 20, 23, 5, 'ponte'); line(a, 28, 31, 7, 'ponte');
      [[5, 9], [6, 9], [7, 9], [9, 6], [21, 4], [22, 4], [29, 6], [30, 6]].forEach(([x, y]) => put(a, x, y, 'moeda'));
      put(a, 12, 9, 'inimigo'); put(a, 24, 9, 'inimigo');
      put(a, 18, 9, 'mola'); put(a, 33, 9, 'espinho'); put(a, 34, 9, 'espinho');
      put(a, 3, 9, 'flor'); put(a, 15, 9, 'flor'); put(a, 36, 9, 'flor');
      put(a, 20, 9, 'checkpoint');
      put(a, 38, 9, 'bandeira');
      put(a, 2, 9, 'jogador');
      const b = GS.newLevel('Fase 2', 40, 12, 'lado');
      b.bg = bg[1];
      ground(b, 0, 7); ground(b, 10, 17); ground(b, 20, 27); ground(b, 30, 39);
      line(b, 13, 15, 5, 'ponte'); line(b, 21, 23, 5, 'ponte'); line(b, 29, 31, 5, 'ponte'); line(b, 36, 38, 7, 'ponte');
      [[14, 4], [22, 4], [30, 4], [6, 9], [24, 9]].forEach(([x, y]) => put(b, x, y, 'moeda'));
      [[11, 9], [16, 9], [26, 9], [33, 9]].forEach(([x, y]) => put(b, x, y, 'inimigo'));
      put(b, 5, 9, 'mola'); put(b, 19, 9, 'mola');
      [[12, 9], [13, 9], [31, 9]].forEach(([x, y]) => put(b, x, y, 'espinho'));
      put(b, 21, 9, 'checkpoint');
      put(b, 37, 6, 'bandeira');
      put(b, 2, 9, 'jogador');
      levels.push(a, b);
    }

    return {
      id: GS.uid(), name, format: 'gst', version: 1, style,
      createdAt: Date.now(), updatedAt: Date.now(), tourDone: false,
      palette: GS.PALETTES[style].slice(),
      settings: { vidas: 3 },
      vars: [],
      actors, levels,
    };
  };

  GS.validProject = function (p) {
    return p && p.format === 'gst' && Array.isArray(p.actors) && Array.isArray(p.levels) && p.levels.length > 0 &&
      Array.isArray(p.palette) && p.levels.every((l) => Array.isArray(l.cells) && l.cells.length === l.w * l.h) &&
      p.actors.every((a) => GS.KINDS[a.kind] && Array.isArray(a.frames) && a.frames.length > 0 && a.frames.every((f) => f.length === a.size * a.size));
  };

  // ---------- "Código" das regras ----------
  function fmt(p, v, project) {
    if (p.t === 'number') return String(Number(v));
    if (p.t === 'target') {
      const [k, id] = String(v).split(':');
      if (k === 'kind') return `tipo("${id}")`;
      const a = project.actors.find((x) => x.id === id);
      return `ator("${a ? a.name : '?'}")`;
    }
    if (p.t === 'operand' || p.t === 'var') return GS.varName(project, v);
    if (p.t === 'cmp') return String(v);
    if (p.t === 'actor') {
      const a = project.actors.find((x) => x.id === v);
      return `ator("${a ? a.name : '?'}")`;
    }
    return JSON.stringify(String(v));
  }
  const cond = (c, project) => `${GS.varName(project, c.var)} ${c.cmp} ${Number(c.value)}`;
  function actionCode(a, project) {
    const ac = GS.ACTIONS[a.type];
    const v = () => GS.varName(project, a.var);
    if (a.type === 'mudarVar') return a.op === 'definir' ? `${v()} = ${Number(a.value)};` : `${v()} += ${Number(a.value)};`;
    if (a.type === 'sortear') return `${v()} = sortear(${Number(a.min)}, ${Number(a.max)});`;
    return `${ac.code}(${ac.params.map((p) => fmt(p, a[p.k], project)).join(', ')});`;
  }
  GS.rulesToCode = function (actor, project) {
    const lines = [`// ${actor.name} (${GS.KINDS[actor.kind].nome})`];
    const vars = GS.vars(project);
    if (vars.length) lines.push(`// variáveis do jogo: ${vars.map((v) => `${v.name} = ${Number(v.start)}`).join(', ')}`);
    lines.push(`gravidade = ${actor.props.gravidade ? 'sim' : 'não'};`, '');
    if (!actor.rules.length) lines.push('// sem regras: este ator fica parado');
    actor.rules.forEach((r) => {
      const ev = GS.EVENTS[r.when.type];
      const head = r.when.type === 'variavel'
        ? `quando ${ev.code}(${cond(r.when, project)})`
        : `quando ${ev.code}(${ev.params.map((p) => fmt(p, r.when[p.k], project)).join(', ')})`;
      lines.push(`${head}${r.if ? ` se (${cond(r.if, project)})` : ''} {`);
      r.do.forEach((a) => lines.push('  ' + actionCode(a, project)));
      if (!r.do.length) lines.push('  // nenhuma ação ainda');
      lines.push('}', '');
    });
    return lines.join('\n');
  };

  // ---------- Salvamento ----------
  const KEY = 'gst.projects';
  function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function writeAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  GS.Storage = {
    list() { return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt); },
    get(id) { return readAll()[id] || null; },
    save(p) { const all = readAll(); all[p.id] = p; return writeAll(all); },
    remove(id) { const all = readAll(); delete all[id]; writeAll(all); },
    pref(name, value) {
      try {
        if (value === undefined) return localStorage.getItem('gst.' + name);
        localStorage.setItem('gst.' + name, value);
      } catch (e) { return null; }
    },
  };

  // ---------- Eventos ----------
  const handlers = {};
  GS.bus = {
    on(n, fn) { (handlers[n] = handlers[n] || []).push(fn); },
    off(n, fn) { handlers[n] = (handlers[n] || []).filter((f) => f !== fn); },
    emit(n, d) { (handlers[n] || []).slice().forEach((fn) => fn(d)); },
  };

  // ---------- Miniaturas ----------
  GS.thumb = function (actor, palette, frame) {
    const c = document.createElement('canvas');
    const s = actor.size;
    c.width = c.height = s;
    const px = actor.frames[frame || 0];
    const ctx = c.getContext('2d');
    for (let i = 0; i < px.length; i++) {
      if (px[i] < 0) continue;
      ctx.fillStyle = palette[px[i]];
      ctx.fillRect(i % s, Math.floor(i / s), 1, 1);
    }
    return c;
  };

  GS.say = function (text) {
    if (!('speechSynthesis' in window) || GS.Storage.pref('voz') !== 'on') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      speechSynthesis.speak(u);
    } catch (e) { /* sem voz */ }
  };
})();
