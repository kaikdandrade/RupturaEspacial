# Ruptura Espacial

Jogo de nave em pixel art feito com HTML, CSS e JavaScript puro (Canvas 2D, sem bibliotecas).
Defenda a nave de ondas de asteroides que ficam cada vez mais difíceis, colete efeitos dos
asteroides especiais, enfrente chefes a cada 5 setores e evolua a nave na oficina.

## 🎮 Jogue agora

**[kaikdandrade.github.io/RupturaEspacial](https://kaikdandrade.github.io/RupturaEspacial/)**

A demo roda direto no navegador pelo GitHub Pages, no PC ou no celular. O progresso fica salvo
no próprio navegador.

## Controles

| Ação        | PC                        | Celular / tablet                              |
| ----------- | ------------------------- | --------------------------------------------- |
| Mover       | `W` `A` `S` `D` ou setas  | Arrastar o dedo no lado esquerdo da tela      |
| Atirar      | `Espaço`, `Enter` ou mouse | Segurar o botão vermelho ou ligar o **AUTO** |
| Pausar      | `Esc` ou botão de pause   | Botão de pause no HUD                         |

No celular o jogo também pausa sozinho ao trocar de aplicativo ou bloquear a tela.

## Como funciona

- **Setores sem fim:** cada setor pede um número de asteroides destruídos. A dificuldade (vida,
  quantidade, velocidade e dano) cresce sem limite de nível.
- **Asteroides especiais** (a partir do setor 5) deixam cartas de efeito ao serem destruídos:
  - **Congelado:** lentidão e congelamento
  - **Vulcânico:** chamas
  - **Místico:** um efeito surpresa (tiro rápido, perfurante, mais dano, velocidade, bônus
    de pontos ou invencibilidade)
  - **Elétrico:** tiro elétrico com dano em cascata
  - **Dourado:** não deixa carta, mas dá um bônus grande de pontos (e de créditos)
- **Chefes** a cada 5 setores: Espinhoso, Hidra, Gravidade, Binário, Resistente e
  Cibernético. Cada um tem seus ataques e regras próprias de arena.
- **Oficina:** os créditos ganhos compram melhorias de dano, cadência e resistência, além de
  novas naves.
- **Trilha sonora chiptune** gerada por código (Web Audio, sem arquivos de áudio): tema do
  hangar, batalha que ganha camadas conforme o setor esquenta, tema de chefe e vinhetas de
  vitória, recorde e derrota. Volume de música e efeitos e liga/desliga do som no glossário (aba Controles e áudio).
- **Glossário** (botão "?" no hangar ou atalho na pausa): ameaças, efeitos, e controles e áudio.

## Rodando localmente

Não precisa instalar nada: basta abrir o `index.html` no navegador. Se preferir um servidor
local:

```bash
npx serve .
# ou
python -m http.server
```

## Estrutura do projeto

```
index.html          telas, HUD e ordem de carregamento dos scripts
style.css           estilos (layout responsivo para PC, tablet e celular)
assets/             sprites (asteroides, chefes, naves) e ícones
js/
  core/             base do jogo
    config.js         constantes e todo o balanceamento (BALANCE)
    dom.js            referências aos elementos da página
    utils.js          utilidades, escala da tela, imagens, sinais (Signals)
    render.js         cache de sprites e brilho (desempenho)
    Data.js           salvar e carregar o progresso
    audio.js          motor de áudio sintetizado e efeitos sonoros (tiro)
    Collisions.js     hitboxes e colisões
    Effects.js        efeitos ativos (lentidão, chamas, tiro rápido...)
    Level.js          configuração de cada setor
    state.js          estado da partida
  entity/
    Player.js         nave e tiros
    PickupCard.js     cartas de efeito
    asteroids/
      Asteroid.js       classe base dos asteroides
      CommonAsteroid.js
      special/          um arquivo por asteroide especial
      bosses/           um arquivo por chefe (com os projéteis dele)
  game/             geração de asteroides, progresso/loja, efeitos visuais e música
                    (music.js: partituras e sequenciador da trilha)
  ui/               interface (HUD, menus) e controles de toque
  main.js           eventos, início e fim de partida, redimensionamento
  game_loop.js      laço principal: atualizar e desenhar
```

## Tecnologias

- HTML5 Canvas 2D
- Web Audio API (música e efeitos sintetizados)
- CSS moderno (nesting, container queries, `clamp`)
- JavaScript (ES2022+, classes com campos privados), sem frameworks
