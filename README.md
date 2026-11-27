# Ruptura Espacial

Jogo de nave em **pixel art** feito com HTML, CSS e JavaScript puro (Canvas 2D, sem bibliotecas
e sem arquivos de áudio). Defenda a nave de ondas de asteroides que nunca param de ficar mais
difíceis, combine efeitos elementais, enfrente um chefe a cada 5 setores e evolua sua frota na
oficina.

## 🎮 Jogue agora

**[kaikdandrade.github.io/RupturaEspacial](https://kaikdandrade.github.io/RupturaEspacial/)**

Roda direto no navegador pelo GitHub Pages, no PC, no celular ou no tablet. O progresso
(centelhas, naves, melhorias, recorde, configurações) fica salvo no próprio navegador.

## Controles

| Ação     | Teclado e mouse                                | Celular e tablet                                  |
| -------- | ---------------------------------------------- | ------------------------------------------------- |
| Mover    | `W` `A` `S` `D` ou setas                       | Joystick: encostar e arrastar o dedo no lado dele |
| Atirar   | Segurar `Espaço`, `Enter` ou o botão do mouse  | Segurar o botão vermelho ou ligar o **AUTO**      |
| Pausar   | `Esc`                                          | Botão de pause no canto superior direito          |

No celular o jogo pausa sozinho ao trocar de aplicativo ou bloquear a tela. Os controles de
toque são ajustáveis no glossário (aba **Áudio e Controles**):

- **Tamanho** do joystick e dos botões, de 60% a 150%;
- **Lado do joystick**, esquerda ou direita (para canhotos);
- **Modo** flutuante (o joystick nasce onde o dedo encosta) ou fixo;
- **Tiro automático**.

## Como jogar

### Setores

- O jogo **não tem fim**: cada setor pede um número de asteroides destruídos, e a vida, a
  quantidade, a velocidade e o dano deles crescem para sempre.
- Os setores vencidos ficam liberados no hangar, para voltar a jogar qualquer um.
- Pontos vêm do dano causado, de abates em **sequência (combo)**, de asteroides especiais e do
  tempo sobrevivido. Bater o recorde toca uma vinheta própria.
- O escudo da nave aguenta algumas batidas; quando ele acaba, a partida termina.

### Asteroides

| Asteroide     | O que faz                                                                     |
| ------------- | ----------------------------------------------------------------------------- |
| **Comum**     | A ameaça mais frequente, sem efeitos extras.                                  |
| **Vulcânico** | Deixa um card de **fogo**.                                                    |
| **Glacial**   | Deixa um card de **gelo**.                                                    |
| **Elétrico**  | Deixa um card de **raio**.                                                    |
| **Místico**   | Deixa um **bônus para a nave** por 8 s.                                       |
| **Dourado**   | Mais rápido e resistente; não deixa card, mas dá um grande bônus de pontos.   |

Os especiais aparecem a partir do **setor 5** e podem vir em dupla, mas nunca três seguidos.
Todo efeito vale igual para todos os asteroides; só os chefes resistem um pouco.

### Efeitos elementais

Pegar um card ativa o efeito **básico**. Pegar outro card enquanto um efeito está ativo
**combina** os dois num efeito **avançado**.

| Básico           | Duração | O que faz                                                          |
| ---------------- | ------- | ------------------------------------------------------------------ |
| **Chamas**       | 10 s    | Todos os asteroides pegam fogo e perdem vida aos poucos.           |
| **Lentidão**     | 10 s    | Todos os asteroides andam na metade da velocidade.                 |
| **Tiro elétrico**| 10 s    | Cada tiro que acerta solta um raio que pula para até 3 vizinhos.   |

|           | Fogo            | Gelo              | Raio              |
| --------- | --------------- | ----------------- | ----------------- |
| **Fogo**  | Incineração     | Evaporação        | Sobrecarga        |
| **Gelo**  |                 | Congelamento      | Supercondutor     |
| **Raio**  |                 |                   | Tempestade        |

| Avançado          | Duração     | O que faz                                                                  |
| ----------------- | ----------- | -------------------------------------------------------------------------- |
| **Incineração**   | 6 s         | Fogo feroz: dano contínuo e muito rápido.                                  |
| **Congelamento**  | 6 s         | Tudo congela no lugar (chefes só ficam mais lentos).                       |
| **Tempestade**    | 6 s         | A nave dá choques em cadeia sozinha nos asteroides que chegam perto.       |
| **Supercondutor** | 6 s         | O tiro elétrico causa mais dano, alcança mais longe e pula mais vezes.     |
| **Sobrecarga**    | 6 s         | Asteroide em chamas vira bomba-relógio: ao morrer explode e solta raios, em reação em cadeia. |
| **Evaporação**    | instantânea | Destrói todos os asteroides, não importa a vida; chefes perdem boa parte da vida. |

**Bônus ao jogador** (Místico, 8 s, um deles ao acaso): tiro rápido, dano extra (+50%), tiro
perfurante, velocidade (+35%), pontos extras (+50%) ou invulnerabilidade.

### Chefes

Um chefe a cada 5 setores, sempre nesta ordem (e depois o ciclo recomeça, mais forte). A
arena manda asteroides e especiais durante a luta, e o nome e a vida do chefe ficam no topo.

| Setor | Chefe             | Como luta                                                                         |
| ----- | ----------------- | --------------------------------------------------------------------------------- |
| 5     | **Espinhoso**     | Anéis de espinhos que cravam no ar e disparam na nave, espirais e rajadas miradas. |
| 10    | **Hidra**         | Cospe ácido. Quando a vida zera, se divide em duas, até a quarta forma: oito Hidras pequenas e rápidas. |
| 15    | **Gravitacional** | Rouba os asteroides da arena, prende em órbita como escudo e arremessa na nave. Perto dele nada congela, e os asteroides da arena dele não dão pontos. |
| 20    | **Binário**       | Dois núcleos ligados por um feixe que fere a nave. Se um cair, o outro o revive: derrube os dois quase juntos. |
| 25    | **Resistente**    | Armadura em placas que precisa ser quebrada antes da vida e se regenera aos poucos. |
| 30    | **Cibernético**   | Olho travado na nave e esferas de energia teleguiadas.                             |

Vencer um chefe paga um **bônus de vitória pelo desempenho**: quanto mais rápida a luta e
mais escudo sobrar, maior o multiplicador.

### Hangar e oficina

- **Centelhas** são ganhas só **vencendo** o setor (setores de chefe pagam mais). Perder não
  dá centelhas.
- **Naves:** Alpha (inicial, 1 canhão), Beta (2.500, 2 canhões), Gamma (9.000, 3 canhões) e
  Suam (24.000, 4 canhões). Cada uma tem seu próprio som de tiro.
- **Melhorias:** dano, cadência e resistência (escudo). **Cada nave tem as próprias
  melhorias**: uma nave recém-comprada começa do nível inicial. O preço cresce a cada nível.

### Glossário

Pelo botão **"?"** no hangar ou na pausa. Tem três abas:

- **Ameaças:** todos os asteroides e chefes, com quantos você já derrotou;
- **Efeitos:** os elementais básicos, avançados e os bônus ao jogador;
- **Áudio e Controles:** volume de música e efeitos, liga/desliga do som, os controles e as
  opções de toque.

### Trilha sonora

Chiptune gerada por código com a Web Audio API: tema do hangar, música de batalha que ganha
camadas conforme o setor esquenta, tema de chefe e vinhetas de vitória, recorde e derrota. O
som começa depois do primeiro clique ou toque (regra dos navegadores).

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
index.html          telas, HUD, modais, glossário e ordem de carregamento dos scripts
style.css           estilos (layout responsivo para PC, tablet e celular)
LICENSE             licença do código (MIT)
assets/             sprites (asteroides, chefes, naves) e ícones
  LICENSE.md        licença da arte (CC BY-NC-SA 4.0)
js/
  core/             base do jogo
    config.js         constantes e todo o balanceamento (BALANCE)
    dom.js            referências aos elementos da página
    utils.js          utilidades, escala da tela, imagens, sinais (Signals)
    render.js         cache de sprites e brilho (desempenho)
    Data.js           salvar e carregar o progresso e as configurações
    audio.js          motor de áudio sintetizado e efeitos sonoros
    Collisions.js     hitboxes e colisões
    Effects.js        efeitos ativos e combinações elementais
    Level.js          configuração de cada setor
    state.js          estado da partida
  entity/
    Player.js         nave, tiros e melhorias de cada nave
    PickupCard.js     cards de efeito
    asteroids/
      Asteroid.js       classe base dos asteroides
      CommonAsteroid.js
      special/          um arquivo por asteroide especial
      bosses/           um arquivo por chefe (com os projéteis dele)
  game/
    spawner.js        geração de asteroides, especiais e chefes
    progress.js       pontuação, centelhas, recorde e loja
    reactions.js      explosões, raios e evaporação dos efeitos
    fx.js             efeitos visuais (partículas, raios, textos)
    music.js          partituras e sequenciador da trilha
  ui/
    interface.js      HUD, hangar, modais e glossário
    touch.js          controles de toque e suas opções
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
