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
| Mover       | `W` `A` `S` `D` ou setas  | Joystick (arrastar o dedo no lado dele)       |
| Atirar      | `Espaço`, `Enter` ou mouse | Segurar o botão vermelho ou ligar o **AUTO** |
| Pausar      | `Esc` ou botão de pause   | Botão de pause no HUD                         |

No celular o jogo também pausa sozinho ao trocar de aplicativo ou bloquear a tela. Tamanho dos
controles, lado do joystick (canhotos), modo fixo ou flutuante e tiro automático são ajustáveis no
glossário (aba Áudio e Controles).

## Como funciona

- **Setores sem fim:** cada setor pede um número de asteroides destruídos. A dificuldade (vida,
  quantidade, velocidade e dano) cresce sem limite de nível.
- **Asteroides especiais** (a partir do setor 5) deixam cartas de efeito ao serem destruídos:
  - **Glacial:** gelo (Lentidão)
  - **Vulcânico:** fogo (Chamas)
  - **Elétrico:** raio (Tiro elétrico com dano em cascata)
  - **Místico:** um bônus surpresa por 8 s (tiro rápido, perfurante, mais dano, velocidade,
    pontos extras ou invulnerabilidade)
  - **Dourado:** não deixa carta, mas dá um bônus grande de pontos
- **Combinações elementais:** pegar um card com outro elemento ativo combina os dois.

  |             | Fogo        | Gelo          | Raio          |
  | ----------- | ----------- | ------------- | ------------- |
  | **Fogo**    | Incineração | Evaporação    | Sobrecarga    |
  | **Gelo**    |             | Congelamento  | Supercondutor |
  | **Raio**    |             |               | Tempestade    |

  Básicos duram 10 s, avançados 6 s; a Evaporação é instantânea e destrói todos os asteroides.
- **Chefes** a cada 5 setores: Espinhoso, Hidra, Gravitacional, Binário, Resistente e
  Cibernético. Cada um tem seus ataques e regras próprias de arena, e paga um **bônus de
  vitória pelo desempenho** (rapidez e escudo que sobrou).
- **Oficina:** as centelhas ganhas compram melhorias de dano, cadência e resistência **de cada
  nave** (nave nova começa do nível inicial), além de novas naves. Só se ganha centelhas
  vencendo o setor.
- **Trilha sonora chiptune** gerada por código (Web Audio, sem arquivos de áudio): tema do
  hangar, batalha que ganha camadas conforme o setor esquenta, tema de chefe e vinhetas de
  vitória, recorde e derrota. Volume de música e efeitos e liga/desliga do som no glossário (aba Áudio e Controles).
- **Glossário** (botão "?" no hangar ou atalho na pausa): ameaças, efeitos, e áudio e controles.

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
LICENSE             licença do código (MIT)
style.css           estilos (layout responsivo para PC, tablet e celular)
assets/             sprites (asteroides, chefes, naves) e ícones
  LICENSE.md        licença da arte (CC BY-NC-SA 4.0)
js/
  core/             base do jogo
    config.js         constantes e todo o balanceamento (BALANCE)
    dom.js            referências aos elementos da página
    utils.js          utilidades, escala da tela, imagens, sinais (Signals)
    render.js         cache de sprites e brilho (desempenho)
    Data.js           salvar e carregar o progresso
    audio.js          motor de áudio sintetizado e efeitos sonoros (tiro)
    Collisions.js     hitboxes e colisões
    Effects.js        efeitos ativos e combinações elementais (chamas, tempestade, tiro rápido...)
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
                    (music.js: partituras e sequenciador da trilha;
                     reactions.js: explosões, raios e evaporação dos efeitos)
  ui/               interface (HUD, menus) e controles de toque
  main.js           eventos, início e fim de partida, redimensionamento
  game_loop.js      laço principal: atualizar e desenhar
```

## Tecnologias

- HTML5 Canvas 2D
- Web Audio API (música e efeitos sintetizados)
- CSS sem nesting e com reservas para recursos novos (container queries, `dvh`)
- JavaScript (ES2022, classes com campos privados), sem frameworks

Funciona em navegadores a partir de 2021–2022 (Chrome/Edge 88+, Safari 15.4+, Firefox 98+).

## Licença

- **Código** (HTML, CSS e JavaScript, incluindo a trilha sonora e os efeitos sonoros, que são
  gerados por código): [MIT](LICENSE). Pode usar, estudar, modificar e distribuir, inclusive
  comercialmente, mantendo o aviso de copyright.
- **Arte** (tudo em `assets/`: naves, asteroides, chefes, ícones e logo):
  [CC BY-NC-SA 4.0](assets/LICENSE.md). Pode usar e adaptar com crédito, sem fins comerciais e
  mantendo a mesma licença.

© 2026 Kaik D' Andrade
