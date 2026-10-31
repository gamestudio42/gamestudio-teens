# Game Studio Teen (leia-me em português)

Versão do Game Studio para quem já lê bem (cerca de 10 a 15 anos). Mesma ideia da versão Kids, com mais controle:
cada personagem, item ou bloco é um **ator** com desenho e **regras**, e o jogo pode ter várias fases e ser exportado como um arquivo HTML.

## Estilos

- **Neon** (padrão): noite eletrônica. Bip, o robozinho de visor azul; Olhão, o olho voador; cristais de energia, portal, ponte de metal, espinhos de cristal, mola, antena e uma cidade com janelas acesas no fundo.
- **Bosque** (modelo Plataforma Bosque): floresta de livro ilustrado. Broto, a sementinha; Besouro; bolotas, lanterna, tronco, espinheiro, flor-mola, cogumelo e pinheiros no fundo.

Cada estilo tem a sua paleta de 16 cores, que fica salva no projeto e pode ser editada.

## Como abrir

Abra o `index.html` no navegador. Não precisa instalar nada.
Para testar no tablet na mesma rede: `python3 -m http.server 8000` nesta pasta e abra `http://IP-DO-COMPUTADOR:8000`.

## O que tem

- **Novo projeto com modelos:** Plataforma Neon (2 fases prontas), Plataforma Bosque (as mesmas 2 fases, na floresta), Aventura vista de cima (labirinto neon com inimigos que perseguem) ou Do zero. "Começar com o tour" vem marcado.
- **Tour de 10 passos:** destaca cada parte do estúdio; os passos de ação esperam a pessoa fazer. Leitura em voz alta opcional (🔈), botão para minimizar e para refazer (?).
- **Arte:** 16×16 ou 32×32 (blocos são sempre 16×16), lápis, borracha, balde, conta-gotas, linha, retângulo, espelho, desfazer/refazer, até 12 quadros de animação com velocidade ajustável, "cebola" mostrando o quadro anterior, paleta de 16 cores editável por projeto.
  Atalhos: B, E, G, I, L, R, M, O, Ctrl+Z, Ctrl+Y. Botão direito apaga.
- **Regras:** cada regra é QUANDO + uma lista de FAÇA.
  - Eventos: ao começar a fase, sempre, enquanto a tecla estiver apertada, ao apertar a tecla, ao tocar em, ao pisar em, ao bater em uma parede, ao chegar na beirada, a cada X segundos, quando os pontos chegarem a N, quando a variável ficar (por exemplo `chaves >= 3`, dispara uma vez quando passa a valer).
  - Ações: mover (frente, 4 direções ou na direção do jogador), pular, quicar, virar, somar pontos, somar vidas, tocar som, criar ator (tiros), sumir, fazer o outro sumir, mostrar mensagem (com `{nome}` para mostrar uma variável), voltar ao ponto de partida, salvar aqui o ponto de partida do jogador, mudar variável (somar ou mudar para), sortear número, próxima fase, vencer, perder.
  - **Variáveis** (botão 🔢 Variáveis): números do jogo com nome, valor inicial e opção de aparecer na tela. Todos os atores enxergam as mesmas variáveis, e `pontos` e `vidas` também podem ser conferidos.
  - **+ se**: qualquer regra pode ter uma condição, e só roda quando ela vale (`quando tocar(tipo("jogador")) se (chaves >= 3) { ... }`).
  - Regras prontas para adicionar: controles de plataforma, controles de vista de cima, atirar, patrulha, persegue o jogador, coletável, objetivo, ponto de controle, projétil, dano, perigo tira vida, pular alto na mola e pisar no inimigo.
- **Tipos de ator:** jogador, bloco, plataforma (só segura quem cai por cima), item, inimigo, perigo, mola, objetivo, ponto de controle, projétil, decoração e cenário. O ponto de controle acende quando o jogador passa, e daí em diante ele volta para lá ao perder vida. Atores do tipo Cenário não vão na fase: aparecem repetidos no fundo da vista de lado, andando mais devagar que a fase.
  - **Ver como código** mostra as mesmas regras escritas como programa (`quando tecla("direita") { mover("direita", 1.6); }`).
- **Fases:** várias fases, nome, largura e altura, vista de lado ou de cima, cor de fundo, duplicar e apagar, zoom, desfazer e refazer (↩️ ↪️, Ctrl+Z e Ctrl+Y). Clique ou arraste para colocar atores; botão direito apaga. No tablet em pé e no celular, as opções da fase ficam recolhidas para a grade aparecer logo.
- **Testar:** pontos, vidas e nome da fase na tela; ao tocar a bandeira vai para a próxima fase, e na última vence. Setas/WASD, espaço, Z e X, ou botões na tela no tablet.
- **🔍 Investigar:** mostra as caixas de colisão, para onde cada ator olha e onde o jogador volta; câmera lenta, pausa e avançar um quadro; os valores das variáveis; e as regras que rodaram, com a contagem. Clicar numa regra abre a aba Regras com ela acesa, e as regras mostram ⚡ quantas vezes rodaram.
- **Exportar HTML:** gera um único arquivo `.html` com o jogo rodando sozinho, para compartilhar. **💾 .gst** baixa o projeto para editar depois (Importar .gst na tela inicial). **💾 Baixar todos** guarda todos os projetos num arquivo só, e a tela inicial lembra de fazer essa cópia quando há trabalho novo sem cópia.

- **Acabamento ("juice"):** partículas de poeira, coleta e explosão na cor de cada ator; pontos flutuando; tela treme e pisca ao levar dano; personagens esticam ao pular e amassam ao cair; colinas em camadas na vista de lado; câmera que olha à frente; transição entre fases; confete na vitória; música de fundo (botão 🎵 ou tecla M, também no HTML exportado); animações nos botões e telas, desligadas se o sistema pedir "reduzir movimento".

Projetos são salvos sozinhos no navegador (`localStorage`). Depois de carregada, a página funciona sem internet; instalada como app (veja abaixo), abre mesmo sem internet.

## Instalar como app (funciona sem internet)

Para instalar, o Game Studio Teen precisa ser aberto por um endereço `http://` ou `https://` (abrindo o arquivo direto, ele funciona, mas não instala).

1. Nesta pasta: `python3 -m http.server 8000`, ou publique a pasta em qualquer hospedagem de site estático.
2. Abra `http://localhost:8000` (no computador) ou `http://IP-DO-COMPUTADOR:8000` (no tablet).
3. Toque em **Instalar app** na tela inicial (Chrome, Edge, Android). No iPad/iPhone: Compartilhar > Adicionar à Tela de Início.

Depois de aberto uma vez, o app abre pelo ícone e funciona sem internet. Os projetos continuam salvos no aparelho.
Fora do `localhost`, instalar no tablet exige `https://` (por exemplo, uma hospedagem gratuita de site estático).
Arquivos: `manifest.webmanifest`, `sw.js` (guarda os arquivos), `js/pwa.js` (botão Instalar e aviso de internet), `icons/`.

## Estrutura

```
index.html            telas
css/style.css         visual escuro, adaptado a tablet
js/runtime.js         motor do jogo (também vai dentro do HTML exportado)
js/model.js           atores, catálogo de regras, modelos prontos, salvamento, código das regras
js/art-editor.js      editor de arte e animação
js/rules-editor.js    editor de regras e painel de código
js/level-editor.js    editor de fases
js/play.js            aba Testar e exportação
js/tour.js            tour interativo
js/app.js             tela inicial, abas e importação
```

Os formatos são diferentes da versão Kids: um projeto Teen é `.gst` e um projeto Kids é `.gsk`.
