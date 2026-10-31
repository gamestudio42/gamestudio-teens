// Motor do jogo. Fica inteiro dentro desta função para poder ser copiado
// para o HTML exportado (Exportar usa GST_RUNTIME.toString()).
window.GST_RUNTIME = function (global) {
  const T = 16; // tamanho de uma célula da fase
  const VW = 256, VH = 192; // área visível: 16 x 12 células
  const GRAV = 0.32, MAX_FALL = 6, MAX_ENTS = 300;

  const KEYMAP = {
    ArrowLeft: 'esquerda', a: 'esquerda', A: 'esquerda',
    ArrowRight: 'direita', d: 'direita', D: 'direita',
    ArrowUp: 'cima', w: 'cima', W: 'cima',
    ArrowDown: 'baixo', s: 'baixo', S: 'baixo',
    ' ': 'espaco', z: 'z', Z: 'z', x: 'x', X: 'x', Enter: 'enter', m: 'musica', M: 'musica',
  };
  const CONFETTI = ['#ff4f9a', '#ffd23f', '#2ee6a6', '#7c5cff', '#29adff', '#ffffff'];

  // ---------- Sons ----------
  let actx = null;
  function beep(freq, dur, type, slideTo, vol) {
    try {
      actx = actx || new (global.AudioContext || global.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gn.gain.setValueAtTime(vol || 0.07, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(actx.destination);
      o.start(t);
      o.stop(t + dur);
    } catch (e) { /* sem áudio */ }
  }
  const SOUNDS = {
    pulo: () => beep(300, 0.18, 'square', 620),
    moeda: () => { beep(988, 0.08); setTimeout(() => beep(1319, 0.14), 80); },
    dano: () => beep(220, 0.3, 'sawtooth', 70),
    tiro: () => beep(900, 0.1, 'square', 200, 0.05),
    explosao: () => beep(160, 0.25, 'sawtooth', 40, 0.1),
    bip: () => beep(660, 0.06, 'triangle'),
    vitoria: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 130)),
    derrota: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle'), i * 180)),
  };

  // ---------- Música de fundo ----------
  // Melodia e baixo em notas MIDI (0 = pausa), colcheias a 140 bpm, em lá menor
  const MELODY = [69, 0, 72, 76, 0, 72, 74, 0, 71, 0, 74, 79, 0, 74, 76, 0, 69, 0, 72, 76, 0, 81, 79, 76, 74, 0, 71, 0, 74, 76, 0, 0];
  const BASS = [45, 45, 41, 41, 43, 43, 40, 40];
  const STEP = 60 / 140 / 2;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(freq, t, dur, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const music = {
    timer: 0, next: 0, n: 0,
    start() {
      music.stop();
      try {
        actx = actx || new (global.AudioContext || global.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
      } catch (e) { return; }
      music.next = actx.currentTime + 0.1;
      music.n = 0;
      music.timer = setInterval(() => {
        while (music.next < actx.currentTime + 0.25) {
          const n = music.n, m = MELODY[n % MELODY.length];
          if (m) tone(hz(m), music.next, STEP * 0.8, 'square', 0.02);
          if (n % 4 === 0) tone(hz(BASS[(n / 4) % BASS.length]), music.next, STEP * 3.6, 'triangle', 0.05);
          if (n % 2 === 1) tone(5200, music.next, 0.03, 'square', 0.006); // chimbal
          music.next += STEP;
          music.n++;
        }
      }, 60);
    },
    stop() { clearInterval(music.timer); music.timer = 0; },
  };

  // ---------- Desenhos ----------
  function frameCanvas(px, size, palette) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    for (let i = 0; i < px.length; i++) {
      if (px[i] < 0) continue;
      ctx.fillStyle = palette[px[i]];
      ctx.fillRect(i % size, Math.floor(i / size), 1, 1);
    }
    return c;
  }

  // Cor mais usada no primeiro quadro: vira a cor das partículas do ator
  function mainColor(actor, palette) {
    const count = {};
    actor.frames[0].forEach((v) => { if (v >= 0) count[v] = (count[v] || 0) + 1; });
    const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    return best === undefined ? '#ffffff' : palette[best];
  }
  function shade(hex, f) {
    const n = parseInt(String(hex).slice(1), 16);
    if (isNaN(n)) return hex;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const mix = (c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  // Caixa de colisão = retângulo dos pixels pintados do primeiro quadro
  function hitbox(actor) {
    const s = actor.size, px = actor.frames[0];
    let x0 = s, y0 = s, x1 = -1, y1 = -1;
    for (let i = 0; i < px.length; i++) {
      if (px[i] < 0) continue;
      const x = i % s, y = Math.floor(i / s);
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    if (x1 < 0) return { ox: 0, oy: 0, w: s, h: s };
    let w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 4) { x0 -= (4 - w) / 2; w = 4; }
    if (h < 4) { y0 -= (4 - h) / 2; h = 4; }
    return { ox: x0, oy: y0, w, h };
  }

  function createGame(canvas, project, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    canvas.width = VW;
    canvas.height = VH;
    const byId = {};
    const art = {};
    const boxes = {};
    const colors = {};
    project.actors.forEach((a) => {
      byId[a.id] = a;
      art[a.id] = a.frames.map((f) => frameCanvas(f, a.size, project.palette));
      boxes[a.id] = hitbox(a);
      colors[a.id] = mainColor(a, project.palette);
    });
    const backs = project.actors.filter((a) => a.kind === 'cenario');
    // cor da última linha do primeiro cenário: continua o desenho até embaixo
    const backFill = (() => {
      const a = backs[0];
      if (!a) return 'transparent';
      for (let y = a.size - 1; y >= 0; y--) { const v = a.frames[0][y * a.size + Math.floor(a.size / 2)]; if (v >= 0) return project.palette[v]; }
      return 'transparent';
    })();
    let musicOn = opts.music !== undefined ? opts.music : !(project.settings && project.settings.musica === false);
    let parts = [], texts = [], shake = 0, flash = 0, flashColor = '255,79,154', fade = 0;
    function burst(x, y, n, cols, speed, o) {
      o = o || {};
      for (let i = 0; i < n && parts.length < 600; i++) {
        const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8), life = (o.life || 30) * (0.6 + Math.random() * 0.6);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: o.grav === undefined ? 0.12 : o.grav, life, max: life, color: cols[(Math.random() * cols.length) | 0], size: o.size || 1 + ((Math.random() * 2) | 0) });
      }
    }
    const center = (e) => [e.x + e.w / 2, e.y + e.h / 2];
    function poof(e) { const [x, y] = center(e); burst(x, y, 16, [colors[e.actor.id], '#ffffff'], 2); }

    const keys = {}, pressed = {};
    const g = { level: 0, score: 0, lives: 3, state: 'play', msg: '', msgT: 0, t: 0, banner: 0, vars: {} };
    const varList = Array.isArray(project.vars) ? project.vars : [];
    // modo de investigar: caixas de colisão, velocidade e passo a passo
    let debug = !!opts.debug, speed = 1, stepOne = false;
    let L, ents, tiles, solid, player, contacts, camX = 0, camY = 0, uid = 0, raf = 0;

    // ---------- Fase ----------
    function solidAt(tx, ty) {
      if (tx < 0 || tx >= L.w) return true;
      if (ty < 0 || ty >= L.h) return L.view === 'cima';
      return solid[ty * L.w + tx] === 1;
    }
    // plataforma: só segura quem cai por cima
    function platAt(tx, ty) {
      if (tx < 0 || tx >= L.w || ty < 0 || ty >= L.h) return false;
      return solid[ty * L.w + tx] === 2;
    }

    function spawn(a, x, y, dir) {
      if (ents.length >= MAX_ENTS) return null;
      const hb = boxes[a.id];
      const e = {
        uid: ++uid, actor: a, x: x + hb.ox, y: y + hb.oy, w: hb.w, h: hb.h,
        vy: 0, mx: 0, my: 0, dir: dir || 1, onGround: false, alive: true, invuln: 0, kx: 1, ky: 1, // kx/ky = esticar e amassar
        gravity: !!(a.props && a.props.gravidade) && L.view === 'lado',
        collide: a.kind !== 'decoracao', timers: {}, fired: {}, moving: false,
      };
      e.sx = e.x; e.sy = e.y;
      ents.push(e);
      return e;
    }

    function loadLevel(i) {
      g.level = i;
      L = project.levels[i];
      solid = new Uint8Array(L.w * L.h);
      tiles = [];
      ents = [];
      contacts = new Set();
      L.cells.forEach((id, idx) => {
        const a = id && byId[id];
        if (!a) return;
        const cx = (idx % L.w) * T, cy = Math.floor(idx / L.w) * T;
        if (a.kind === 'bloco' || a.kind === 'plataforma') { solid[idx] = a.kind === 'bloco' ? 1 : 2; tiles.push({ a, x: cx, y: cy }); return; }
        if (a.kind === 'cenario') return; // cenário aparece no fundo, não na fase
        // o desenho fica apoiado no fundo da célula e centralizado nela
        spawn(a, cx + T / 2 - a.size / 2, cy + T - a.size, 1);
      });
      player = ents.find((e) => e.actor.kind === 'jogador') || null;
      ents.slice().forEach((e) => fire(e, 'inicio'));
      g.banner = 90;
      parts = [];
      texts = [];
      fade = 30;
      snapCamera();
    }

    function restart() {
      g.score = 0;
      g.vars = {};
      varList.forEach((v) => { g.vars[v.id] = Number(v.start) || 0; });
      g.lives = (project.settings && project.settings.vidas) || 3;
      g.state = 'play';
      g.msg = '';
      loadLevel(Math.min(opts.level || 0, project.levels.length - 1));
      if (musicOn && raf) music.start();
    }

    function nextLevel() {
      if (g.level + 1 < project.levels.length) { SOUNDS.bip(); loadLevel(g.level + 1); }
      else win();
    }
    function win() {
      if (g.state !== 'play') return;
      g.state = 'win';
      music.stop();
      SOUNDS.vitoria();
      for (let i = 0; i < 5; i++) burst(camX + VW / 2, camY + VH / 2, 20, CONFETTI, 3.4, { grav: 0.06, life: 80, size: 2 });
      if (opts.onEvent) opts.onEvent('win');
    }
    function lose() {
      if (g.state !== 'play') return;
      g.state = 'lose';
      music.stop();
      SOUNDS.derrota();
      shake = 18;
      if (opts.onEvent) opts.onEvent('lose');
    }
    function hurtFx(e) {
      shake = 14;
      flash = 12;
      if (e) { const [x, y] = center(e); burst(x, y, 18, ['#ffffff', '#ff4f9a', colors[e.actor.id]], 2.2); }
    }

    function hurtPlayer() {
      g.lives--;
      SOUNDS.dano();
      hurtFx(player);
      if (g.lives <= 0) { lose(); return; }
      if (player) { player.x = player.sx; player.y = player.sy; player.vy = 0; player.invuln = 60; player.alive = true; }
    }

    // ---------- Regras ----------
    function matches(target, other) {
      if (!other || !target) return false;
      const [k, v] = target.split(':');
      return k === 'kind' ? other.actor.kind === v : other.actor.id === v;
    }

    // Variáveis: "v:<id>" é uma variável do projeto; "g:pontos" e "g:vidas" são os números do jogo
    function getVar(ref) {
      if (ref === 'g:pontos') return g.score;
      if (ref === 'g:vidas') return g.lives;
      return g.vars[String(ref).slice(2)] || 0;
    }
    function compare(c) {
      const a = getVar(c.var), b = Number(c.value) || 0;
      switch (c.cmp) {
        case '>': return a > b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '==': return a === b;
        case '!=': return a !== b;
        default: return a >= b;
      }
    }
    // {nome} numa mensagem vira o valor da variável
    function fill(str) {
      return String(str || '').replace(/\{([^}]+)\}/g, (m, name) => {
        if (name === 'pontos') return g.score;
        if (name === 'vidas') return g.lives;
        const v = varList.find((x) => x.name === name);
        return v ? getVar('v:' + v.id) : m;
      });
    }

    function runRule(e, i, other) {
      const r = e.actor.rules[i];
      if (r.if && !compare(r.if)) return false;
      if (opts.onRule) opts.onRule(e.actor.id, i);
      run(e, r.do, other);
      return true;
    }

    function fire(e, type, other) {
      let ran = false;
      const rules = e.actor.rules || [];
      for (let i = 0; i < rules.length; i++) {
        const w = rules[i].when;
        if (w.type !== type) continue;
        if ((type === 'tocar' || type === 'tocarPorCima') && !matches(w.target, other)) continue;
        if (runRule(e, i, other)) ran = true;
      }
      return ran;
    }

    function towardPlayer(e) {
      if (!player || player === e) return [0, 0];
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    }

    function run(e, actions, other) {
      for (const a of actions) {
        if (g.state !== 'play') return;
        const n = Number(a.value);
        switch (a.type) {
          case 'mover': {
            const s = Number(a.speed) || 0;
            if (a.dir === 'frente') e.mx += e.dir * s;
            else if (a.dir === 'esquerda') { e.mx -= s; e.dir = -1; }
            else if (a.dir === 'direita') { e.mx += s; e.dir = 1; }
            else if (a.dir === 'cima') e.my -= s;
            else if (a.dir === 'baixo') e.my += s;
            else if (a.dir === 'jogador') {
              const [ux, uy] = towardPlayer(e);
              e.mx += ux * s;
              if (!e.gravity) e.my += uy * s;
              if (ux) e.dir = ux > 0 ? 1 : -1;
            }
            break;
          }
          case 'pular':
            if (e.gravity && e.onGround) {
              e.vy = -(Number(a.force) || 6);
              e.onGround = false;
              e.kx = 0.7; e.ky = 1.3;
              burst(e.x + e.w / 2, e.y + e.h, 6, ['#ffffff', '#c9ccef'], 0.9, { up: true, grav: 0.02, life: 18 });
            }
            break;
          case 'quicar':
            e.vy = -(Number(a.force) || 4); e.kx = 0.75; e.ky = 1.25;
            if (other && other.actor.kind === 'mola') { other.kx = 1.35; other.ky = 0.55; burst(e.x + e.w / 2, e.y + e.h, 10, [colors[other.actor.id], '#ffffff'], 1.6, { up: true, grav: 0.08 }); }
            break;
          case 'virar': e.dir = -e.dir; break;
          case 'pontos':
            g.score += n || 0;
            if (n) texts.push({ x: e.x + e.w / 2, y: e.y - 2, text: (n > 0 ? '+' : '') + n, color: n > 0 ? '#ffd23f' : '#ff4f9a', life: 45 });
            break;
          case 'vida':
            if (n < 0 && e === player && e.invuln > 0) break;
            g.lives += n || 0;
            if (n < 0) { SOUNDS.dano(); hurtFx(e); if (e === player) e.invuln = 60; }
            if (n > 0) texts.push({ x: e.x + e.w / 2, y: e.y - 2, text: '+' + n + ' ♥', color: '#ff4f9a', life: 45 });
            if (g.lives <= 0) lose();
            break;
          case 'som': if (SOUNDS[a.name]) SOUNDS[a.name](); break;
          case 'criar': {
            const b = byId[a.actor];
            if (!b) break;
            const hb = boxes[b.id];
            const x = e.dir > 0 ? e.x + e.w + 1 - hb.ox : e.x - 1 - hb.w - hb.ox;
            const y = e.y + e.h / 2 - hb.h / 2 - hb.oy;
            const c = spawn(b, x, y, e.dir);
            if (c) { fire(c, 'inicio'); burst(c.x + c.w / 2, c.y + c.h / 2, 5, [colors[b.id], '#ffffff'], 1.2, { grav: 0, life: 12 }); }
            break;
          }
          case 'sumir': if (e.alive) { e.alive = false; if (e !== player) poof(e); } break;
          case 'sumirOutro':
            if (other && other.alive) { other.alive = false; poof(other); if (other.actor.kind === 'inimigo') shake = Math.max(shake, 7); }
            break;
          case 'mensagem': g.msg = fill(a.text); g.msgT = 150; break;
          case 'voltarInicio': e.x = e.sx; e.y = e.sy; e.vy = 0; e.invuln = 60; break;
          case 'salvarPartida': {
            if (!player) break;
            // o jogador volta para cá, com o pé no chão do ponto de controle
            const ref = e === player ? e : null;
            const nx = ref ? e.x : e.x + e.w / 2 - player.w / 2, ny = ref ? e.y : e.y + e.h - player.h;
            if (Math.abs(player.sx - nx) < 1 && Math.abs(player.sy - ny) < 1) break;
            player.sx = nx; player.sy = ny;
            for (const o of ents) if (o.actor.kind === 'checkpoint') o.lit = false;
            e.lit = true;
            SOUNDS.bip();
            texts.push({ x: e.x + e.w / 2, y: e.y - 2, text: 'salvo!', color: '#2ee6a6', life: 50 });
            burst(e.x + e.w / 2, e.y + 2, 14, [colors[e.actor.id], '#ffffff', '#2ee6a6'], 1.6, { up: true, grav: 0.05 });
            break;
          }
          case 'mudarVar': {
            const id = String(a.var || '').slice(2);
            if (!a.var || !(id in g.vars)) break;
            g.vars[id] = a.op === 'definir' ? n || 0 : g.vars[id] + (n || 0);
            break;
          }
          case 'sortear': {
            const id = String(a.var || '').slice(2);
            if (!a.var || !(id in g.vars)) break;
            const lo = Math.round(Math.min(Number(a.min) || 0, Number(a.max) || 0)), hi = Math.round(Math.max(Number(a.min) || 0, Number(a.max) || 0));
            g.vars[id] = lo + Math.floor(Math.random() * (hi - lo + 1));
            break;
          }
          case 'irFase': nextLevel(); return;
          case 'vencer': win(); return;
          case 'perder': lose(); return;
        }
      }
    }

    // ---------- Física ----------
    function moveAxis(e, dx, dy) {
      if (!dx && !dy) return false;
      e.x += dx;
      e.y += dy;
      if (!e.collide) return false;
      const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
      const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!solidAt(tx, ty)) {
            if (dy > 0 && platAt(tx, ty) && e.y + e.h - dy <= ty * T + 0.5) { e.y = ty * T - e.h; return true; }
            continue;
          }
          if (dx > 0) e.x = tx * T - e.w;
          else if (dx < 0) e.x = (tx + 1) * T;
          else if (dy > 0) e.y = ty * T - e.h;
          else e.y = (ty + 1) * T;
          return true;
        }
      }
      return false;
    }

    function physics(e) {
      if (e.actor.kind === 'decoracao') return;
      if (e.gravity) e.vy = Math.min(e.vy + GRAV, MAX_FALL);
      const dy = (e.gravity ? e.vy : 0) + e.my;
      const hitX = moveAxis(e, e.mx, 0);
      const hitY = moveAxis(e, 0, dy);
      if (e.gravity) {
        if (hitY && dy > 0) {
          if (!e.onGround && dy > 2.5) {
            e.kx = 1.3; e.ky = 0.72; // amassa ao cair
            burst(e.x + e.w / 2, e.y + e.h, 7, ['#ffffff', '#c9ccef'], 1, { up: true, grav: 0.03, life: 16 });
          }
          e.onGround = true; e.vy = 0;
        } else { if (hitY && dy < 0) e.vy = 0; e.onGround = false; }
      }
      e.kx += (1 - e.kx) * 0.2;
      e.ky += (1 - e.ky) * 0.2;
      if (e === player && e.onGround && e.mx && g.t % 9 === 0) burst(e.x + e.w / 2 - e.dir * 5, e.y + e.h, 1, ['#e8e8f5'], 0.4, { up: true, grav: 0, life: 14 });
      if (hitX || (!e.gravity && hitY)) fire(e, 'bater');
      if (e.gravity && e.onGround && e.mx) {
        const ax = e.mx > 0 ? e.x + e.w + 1 : e.x - 1;
        const btx = Math.floor(ax / T), bty = Math.floor((e.y + e.h + 1) / T);
        if (!solidAt(btx, bty) && !platAt(btx, bty)) fire(e, 'beirada');
      }
      e.moving = !!(e.mx || e.my);
      if (e.y > L.h * T + 64) {
        if (e === player) hurtPlayer();
        else e.alive = false;
      }
    }

    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    function touch(a, b) {
      if (!a.alive || !b.alive) return;
      const fromTop = a.gravity && a.vy > 0 && a.y + a.h - b.y < 8 && a.y < b.y;
      if (fromTop && fire(a, 'tocarPorCima', b)) return;
      if (a.invuln > 0 || b.invuln > 0) return;
      fire(a, 'tocar', b);
    }

    // ---------- Passo do jogo ----------
    function step() {
      g.t++;
      if (g.banner > 0) g.banner--;
      if (g.msgT > 0) g.msgT--;
      if (shake > 0) shake--;
      if (flash > 0) flash--;
      if (fade > 0) fade--;
      for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.98; p.life--; }
      parts = parts.filter((p) => p.life > 0);
      for (const t of texts) { t.y -= 0.5; t.life--; }
      texts = texts.filter((t) => t.life > 0);
      if (g.state === 'win' && g.t % 3 === 0) burst(camX + Math.random() * VW, camY - 4, 3, CONFETTI, 0.6, { grav: 0.03, life: 140, size: 2 });
      if (g.state !== 'play') {
        if (pressed.enter || pressed.tap) restart();
        return;
      }
      for (const e of ents) { e.mx = 0; e.my = 0; if (e.invuln > 0) e.invuln--; }
      for (const e of ents.slice()) {
        if (!e.alive) continue;
        const rules = e.actor.rules || [];
        for (let i = 0; i < rules.length; i++) {
          const w = rules[i].when;
          let go = false;
          if (w.type === 'sempre') go = true;
          else if (w.type === 'tecla') go = !!keys[w.key];
          else if (w.type === 'teclaPressionada') go = !!pressed[w.key];
          else if (w.type === 'tempo') {
            e.timers[i] = (e.timers[i] || 0) + 1;
            if (e.timers[i] >= Math.max(6, (Number(w.seconds) || 1) * 60)) { e.timers[i] = 0; go = true; }
          } else if (w.type === 'pontos') {
            if (!e.fired[i] && g.score >= Number(w.value)) { e.fired[i] = true; go = true; }
          } else if (w.type === 'variavel') {
            // dispara quando a comparação passa de falsa para verdadeira
            const now = compare(w);
            go = now && !e.fired[i];
            e.fired[i] = now;
          }
          if (go) runRule(e, i);
          if (g.state !== 'play') return;
        }
      }
      for (const e of ents) if (e.alive) physics(e);
      if (g.state !== 'play') return;

      // contatos: as regras de toque rodam uma vez quando os dois se encostam
      const now = new Set();
      const live = ents.filter((e) => e.alive && e.collide);
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j];
          if (!overlap(a, b)) continue;
          const key = a.uid + ':' + b.uid;
          now.add(key);
          if (contacts.has(key)) continue;
          touch(a, b);
          touch(b, a);
          if (g.state !== 'play') return;
        }
      }
      contacts = now;

      if (player && !player.alive) hurtPlayer();
      ents = ents.filter((e) => e.alive || e === player);
      moveCamera(0.09);
    }

    function snapCamera() { moveCamera(1); }
    function moveCamera(k) {
      const maxX = Math.max(0, L.w * T - VW), maxY = Math.max(0, L.h * T - VH);
      const fx = player ? player.x + player.w / 2 - VW / 2 + (L.view === 'lado' ? player.dir * 24 : 0) : 0;
      const fy = player ? player.y + player.h / 2 - VH / 2 : maxY;
      camX += (Math.min(maxX, Math.max(0, fx)) - camX) * k;
      camY += (Math.min(maxY, Math.max(0, fy)) - camY) * k;
    }

    // ---------- Desenho ----------
    function drawEntity(e) {
      const a = e.actor, hb = boxes[a.id], frames = art[a.id];
      let f = 0;
      if (a.kind === 'checkpoint') f = e.lit ? frames.length - 1 : 0;
      else if (frames.length > 1 && (a.kind !== 'jogador' || e.moving)) f = Math.floor(g.t / (60 / (a.fps || 6))) % frames.length;
      if (e.invuln > 0 && g.t % 6 < 3) return;
      // desenha a partir do pé, para esticar e amassar sem sair do chão
      const footX = Math.round(e.x + e.w / 2), footY = Math.round(e.y + e.h);
      const left = e.x - hb.ox - footX, top = e.y - hb.oy - footY;
      const breathe = a.kind === 'jogador' && e.onGround && !e.moving ? 1 + Math.sin(g.t / 18) * 0.03 : 1;
      ctx.save();
      ctx.translate(footX, footY);
      ctx.scale((e.dir < 0 ? -1 : 1) * e.kx, e.ky * breathe);
      ctx.drawImage(frames[f], left, top); // com escala -1 isto espelha em volta do pé
      ctx.restore();
    }

    function hills(speed, base, amp, color, seed) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, VH);
      for (let x = 0; x <= VW; x += 4) {
        const wx = x + camX * speed;
        ctx.lineTo(x, base - camY * speed * 0.3 - Math.sin(wx / 37 + seed) * amp - Math.sin(wx / 13 + seed * 2) * amp * 0.3);
      }
      ctx.lineTo(VW, VH);
      ctx.fill();
    }

    function text(str, x, y, size, color, align) {
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      ctx.textAlign = align || 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(str, x + 1, y + 1);
      ctx.fillStyle = color || '#fff';
      ctx.fillText(str, x, y);
    }

    function draw() {
      ctx.imageSmoothingEnabled = false;
      const bg = L.bg || '#5fc4ff';
      if (L.view === 'lado') {
        const grad = ctx.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, shade(bg, -0.15));
        grad.addColorStop(1, shade(bg, 0.45));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);
        hills(0.2, 150, 14, shade(bg, -0.12), 1);
        if (backs.length) {
          // atores do tipo Cenário: repetidos lado a lado, em dobro, andando mais devagar que a fase
          const size = 32, span = size * backs.length, base = 120 - camY * 0.15;
          const off = ((camX * 0.35) % span + span) % span;
          for (let x = -off, k = 0; x < VW; x += size, k++) ctx.drawImage(art[backs[k % backs.length].id][0], Math.round(x), Math.round(base), size, size);
          ctx.fillStyle = backFill;
          ctx.fillRect(0, Math.round(base) + size - 1, VW, VH);
        } else hills(0.45, 172, 12, shade(bg, -0.25), 4);
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, VW, VH);
        // pontinhos no chão andam com a câmera para dar sensação de movimento
        ctx.fillStyle = shade(bg, -0.12);
        for (let y = -((camY | 0) % 24); y < VH; y += 24) for (let x = -((camX | 0) % 24); x < VW; x += 24) ctx.fillRect(x + 6, y + 10, 2, 2);
      }
      ctx.save();
      const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
      ctx.translate(-Math.round(camX) + Math.round(sx), -Math.round(camY) + Math.round(sy));
      for (const t of tiles) {
        if (t.x + T < camX || t.x > camX + VW || t.y + T < camY || t.y > camY + VH) continue;
        ctx.drawImage(art[t.a.id][0], t.x, t.y, T, T);
      }
      for (const e of ents) if (e.alive && e.actor.kind === 'decoracao') drawEntity(e);
      for (const e of ents) if (e.alive && e.actor.kind !== 'decoracao' && e !== player) drawEntity(e);
      if (player && player.alive) drawEntity(player);
      for (const p of parts) {
        ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        ctx.globalAlpha = Math.min(1, t.life / 15);
        text(t.text, Math.round(t.x), Math.round(t.y), 9, t.color, 'center');
      }
      ctx.globalAlpha = 1;
      if (debug) drawDebug();
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(${flashColor},${flash / 30})`; ctx.fillRect(0, 0, VW, VH); }
      if (fade > 0) { ctx.fillStyle = `rgba(18,19,28,${fade / 30})`; ctx.fillRect(0, 0, VW, VH); }

      text('★ ' + g.score, 6, 14, 11, '#ffd23f');
      text('♥ ' + Math.max(0, g.lives), 52, 14, 11, '#ff4f9a');
      // variáveis marcadas "mostrar na tela"
      let hy = 27;
      for (const v of varList) if (v.hud) { text(`${v.name}: ${getVar('v:' + v.id)}`, 6, hy, 9, '#c9f7ff'); hy += 11; }
      if (debug) text(speed === 0 ? 'PAUSADO' : speed < 1 ? 'CÂMERA LENTA' : 'INVESTIGANDO', VW - 6, VH - 6, 9, '#ffd23f', 'right');
      text(L.name || 'Fase ' + (g.level + 1), VW - 6, 14, 10, '#fff', 'right');
      if (!player) text('Coloque um jogador nesta fase', VW / 2, VH / 2, 11, '#fff', 'center');
      if (g.banner > 0 && g.state === 'play') text(L.name || 'Fase ' + (g.level + 1), VW / 2, 60, 16, '#fff', 'center');
      if (g.msgT > 0 && g.msg) {
        ctx.fillStyle = 'rgba(18,19,28,0.85)';
        ctx.fillRect(16, VH - 40, VW - 32, 26);
        text(g.msg.slice(0, 48), VW / 2, VH - 23, 10, '#fff', 'center');
      }
      if (g.state !== 'play') {
        ctx.fillStyle = 'rgba(18,19,28,0.75)';
        ctx.fillRect(0, 0, VW, VH);
        text(g.state === 'win' ? 'VOCÊ VENCEU!' : 'FIM DE JOGO', VW / 2, 84, 20, g.state === 'win' ? '#2ee6a6' : '#ff4f9a', 'center');
        text('Pontos: ' + g.score, VW / 2, 106, 12, '#fff', 'center');
        text('Enter ou toque para jogar de novo', VW / 2, 132, 9, '#c9ccef', 'center');
      }
      if (g.state === 'win') {
        // confete por cima do aviso de vitória
        for (const p of parts) {
          ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }
    }

    const DEBUG_COLORS = { jogador: '#2ee6a6', inimigo: '#ff4f9a', perigo: '#ff4f9a', item: '#ffd23f', objetivo: '#ffd23f', checkpoint: '#2ee6a6', mola: '#ff9d2e', projetil: '#ffffff' };
    function drawDebug() {
      ctx.lineWidth = 1;
      for (const t of tiles) {
        if (t.x + T < camX || t.x > camX + VW || t.y + T < camY || t.y > camY + VH) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        if (t.a.kind === 'plataforma') { ctx.beginPath(); ctx.moveTo(t.x, t.y + 0.5); ctx.lineTo(t.x + T, t.y + 0.5); ctx.stroke(); }
        else ctx.strokeRect(t.x + 0.5, t.y + 0.5, T - 1, T - 1);
      }
      for (const e of ents) {
        if (!e.alive || !e.collide) continue;
        ctx.strokeStyle = DEBUG_COLORS[e.actor.kind] || '#38f2ff';
        ctx.strokeRect(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, Math.round(e.w) - 1, Math.round(e.h) - 1);
        // risquinho para o lado que o ator está olhando
        const cy = Math.round(e.y + e.h / 2) + 0.5, cx = Math.round(e.x + e.w / 2);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + e.dir * (e.w / 2 + 3), cy); ctx.stroke();
      }
      if (player) {
        // onde o jogador volta quando perde vida
        ctx.fillStyle = '#2ee6a6';
        ctx.fillRect(Math.round(player.sx + player.w / 2) - 1, Math.round(player.sy + player.h) - 3, 3, 3);
      }
    }

    // ---------- Laço ----------
    function frame(now) {
      frame.acc += Math.min(100, now - frame.last) * speed;
      frame.last = now;
      if (stepOne) { stepOne = false; frame.acc = 1000 / 60; }
      while (frame.acc >= 1000 / 60) {
        step();
        for (const k in pressed) delete pressed[k];
        frame.acc -= 1000 / 60;
      }
      draw();
      raf = requestAnimationFrame(frame);
    }

    function onKey(e) {
      const k = KEYMAP[e.key];
      if (!k) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
      if (k === 'musica') { if (e.type === 'keydown') setMusic(!musicOn); return; }
      key(k, e.type === 'keydown');
    }
    function key(k, down) {
      if (down && !keys[k]) pressed[k] = true;
      keys[k] = down;
    }
    function onTap() { if (g.state !== 'play') pressed.tap = true; }
    function setMusic(on) {
      musicOn = on;
      if (on && g.state === 'play' && raf) music.start();
      else music.stop();
      if (opts.onEvent) opts.onEvent(on ? 'music:on' : 'music:off');
    }

    return {
      start() {
        restart();
        frame.acc = 0;
        frame.last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
        global.addEventListener('keydown', onKey);
        global.addEventListener('keyup', onKey);
        canvas.addEventListener('pointerdown', onTap);
        if (musicOn) music.start();
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        music.stop();
        global.removeEventListener('keydown', onKey);
        global.removeEventListener('keyup', onKey);
        canvas.removeEventListener('pointerdown', onTap);
        for (const k in keys) keys[k] = false;
      },
      key,
      restart,
      setMusic,
      music: () => musicOn,
      setDebug(on) { debug = !!on; if (!on) speed = 1; },
      setSpeed(s) { speed = s; },
      stepOnce() { speed = 0; stepOne = true; },
      vars: () => varList.map((v) => ({ name: v.name, value: getVar('v:' + v.id) })),
      state: () => ({ msg: g.msgT > 0 ? g.msg : '', level: g.level, score: g.score, lives: g.lives, state: g.state, ents: ents.length, vars: Object.assign({}, g.vars), player: player && { x: player.x, y: player.y, sx: player.sx, sy: player.sy } }),
    };
  }

  // Liga os botões de toque (elementos com data-key) a um jogo
  function bindPad(root, getGame) {
    root.querySelectorAll('[data-key]').forEach((b) => {
      const k = b.dataset.key;
      const on = (e) => { e.preventDefault(); const gm = getGame(); if (gm) gm.key(k, true); b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); const gm = getGame(); if (gm) gm.key(k, false); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
    });
  }

  global.GST = { createGame, bindPad, SOUNDS, hitbox };
};
window.GST_RUNTIME(window);
