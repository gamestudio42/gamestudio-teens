// Tour interativo: destaca cada parte do estúdio. Os passos com ação esperam
// a pessoa fazer; os outros têm o botão Próximo.
(function () {
  const { bus } = GS;
  let index = -1, raf = 0, listener = null, built = false;
  const $ = (id) => document.getElementById(id);

  const STEPS = [
    { text: 'Bem-vindo ao Game Studio Teen! Aqui cada personagem, item ou bloco é um ator: ele tem um desenho e regras. Este projeto já vem com um jogo pronto para você mudar do seu jeito.', next: true },
    { text: 'Comece pela Arte. Clique na aba para editar os desenhos.', target: '#tab-arte', wait: 'tab:arte' },
    { text: 'Escolha uma cor na paleta e desenhe no jogador. Atalhos: B lápis, E borracha, G balde, L linha, R retângulo, M espelho.', target: '#art-canvas', wait: 'art:painted', next: true },
    { text: 'Cada ator pode ter vários quadros de animação. "+ Quadro" duplica o atual, e a cebola mostra o quadro anterior por baixo para você desenhar o movimento.', target: '#art-frames', next: true },
    { text: 'Agora as Regras: elas dizem o que cada ator faz.', target: '#tab-regras', wait: 'tab:regras' },
    { text: 'Cada regra tem um QUANDO (o evento) e um ou mais FAÇA (as ações). Experimente mudar a força do pulo ou a velocidade e depois teste.', target: '#rules-list', next: true },
    { text: 'Clique em "Ver como código" para ver as mesmas regras escritas como um programa. É o mesmo jogo, de outro jeito.', target: '#btn-code', wait: 'code:open', next: true },
    { text: 'Em Fases você monta os níveis: escolha um ator e clique na grade. Dá para criar várias fases e escolher a vista de lado ou de cima.', target: '#tab-fases', wait: 'tab:fases' },
    { text: 'Pronto para jogar? Clique em Testar.', target: '#tab-testar', wait: 'tab:testar' },
    { text: 'Setas movem, seta para cima pula e espaço atira. Quando o jogo estiver do seu jeito, Exportar HTML gera um arquivo que roda em qualquer navegador para você compartilhar.', target: '#btn-export', next: true, finish: true },
  ];

  function build() {
    if (built) return;
    built = true;
    $('tour-skip').addEventListener('click', () => stop(true));
    $('tour-next').addEventListener('click', advance);
    $('tour-min').addEventListener('click', () => $('tour-panel').classList.toggle('min'));
    $('tour-voice').addEventListener('click', () => {
      const on = GS.Storage.pref('voz') === 'on' ? 'off' : 'on';
      GS.Storage.pref('voz', on);
      syncVoice();
      if (on === 'on' && STEPS[index]) GS.say(STEPS[index].text);
      else if ('speechSynthesis' in window) speechSynthesis.cancel();
    });
  }

  function syncVoice() {
    const on = GS.Storage.pref('voz') === 'on';
    $('tour-voice').textContent = on ? '🔊' : '🔈';
    $('tour-voice').title = on ? 'Desligar a voz' : 'Ler em voz alta';
  }

  function start() {
    build();
    syncVoice();
    document.body.classList.add('touring');
    $('tour').hidden = false;
    index = -1;
    advance();
    cancelAnimationFrame(raf);
    const follow = () => { position(); raf = requestAnimationFrame(follow); };
    raf = requestAnimationFrame(follow);
    if (GS.app && GS.app.syncPlayFocus) GS.app.syncPlayFocus();
  }

  function advance() {
    if (listener) { bus.off(listener.name, listener.fn); listener = null; }
    if (STEPS[index] && STEPS[index].finish) { finish(); return; }
    index++;
    const s = STEPS[index];
    if (!s) { finish(); return; }
    $('tour-count').textContent = `Passo ${index + 1} de ${STEPS.length}`;
    $('tour-text').textContent = s.text;
    $('tour-next').hidden = !s.next;
    $('tour-next').textContent = s.finish ? 'Terminar' : 'Próximo';
    GS.say(s.text);
    if (s.wait) {
      const fn = () => {
        bus.off(s.wait, fn);
        listener = null;
        setTimeout(advance, 300);
      };
      listener = { name: s.wait, fn };
      bus.on(s.wait, fn);
    }
  }

  function position() {
    const s = STEPS[index], ring = $('tour-ring');
    const el = s && s.target && document.querySelector(s.target);
    if (!el || el.offsetParent === null) { ring.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    ring.style.display = 'block';
    ring.style.left = r.left - 5 + 'px';
    ring.style.top = r.top - 5 + 'px';
    ring.style.width = r.width + 10 + 'px';
    ring.style.height = r.height + 10 + 'px';
    // o painel vai para o canto que não cobre o destaque
    const panel = $('tour-panel'), pw = panel.offsetWidth + 16, ph = panel.offsetHeight + 16;
    const W = window.innerWidth, H = window.innerHeight;
    const corners = [['br', W - pw, H - ph], ['bl', 0, H - ph], ['tr', W - pw, 56], ['tl', 0, 56]];
    const free = corners.find(([, x, y]) => x > r.right || x + pw < r.left || y > r.bottom || y + ph < r.top) || corners[0];
    panel.dataset.corner = free[0];
  }

  function finish() {
    stop(false);
    if (GS.app.project) { GS.app.project.tourDone = true; GS.app.save(); }
    GS.app.toast('Tour concluído. Bom jogo!');
  }

  function stop(skipped) {
    if (listener) { bus.off(listener.name, listener.fn); listener = null; }
    cancelAnimationFrame(raf);
    index = -1;
    document.body.classList.remove('touring');
    $('tour').hidden = true;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (skipped && GS.app.project) { GS.app.project.tourDone = true; GS.app.save(); }
    if (GS.app && GS.app.syncPlayFocus) GS.app.syncPlayFocus();
  }

  GS.Tour = { start, stop, active: () => index >= 0 };
})();
