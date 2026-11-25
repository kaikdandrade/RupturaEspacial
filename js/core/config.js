"use strict";

/**
 * @file Configuração do jogo: tudo que é DADO e não muda durante a partida.
 * - Constantes gerais (depuração, desbloqueios, escala de referência)
 * - Tipos de asteroides e bosses (nomes em português, cores, ordem dos bosses)
 * - Naves, caminhos das imagens (ASSETS) e o equilíbrio do jogo (BALANCE)
 *
 * Carregado primeiro: não depende de nenhum outro arquivo.
 */

// ============================================================
// GERAL
// ============================================================

/** Mostra as hitboxes na tela (depuração). */
const VIEW_HITBOX = false;

/** Setor em que os asteroides especiais começam a aparecer. */
const LEVEL_UNLOCK_SPECIALS = 5;

/** Duração (s) da animação de lançamento da nave antes de cada partida. */
const LAUNCH_TIME = 2;

/** Linha (px) do topo da arena, logo abaixo do HUD. Mesmo valor de --arena-top no CSS + 4. */
const ARENA_TOP = 82;

/**
 * Referência da escala do mundo (ver worldScale em utils.js). O mundo visível sempre tem
 * `h` unidades de altura em telas deitadas (PC, notebook) e pelo menos `narrowW` de largura em
 * telas em pé (celular, tablet). Com isso os objetos ocupam a mesma fração da tela em qualquer
 * aparelho, em vez de encolherem no celular. min/max: limites da escala.
 * `w` é a largura do mundo de referência, usada para medir a densidade da arena.
 */
const WORLD_REF = { w: 1280, h: 900, narrowW: 560, min: 0.55, max: 1.3 };

// ============================================================
// ASTEROIDES E BOSSES
// ============================================================

/** Tipos de asteroides especiais que a arena pode gerar. */
const SPECIALS_ASTEROIDS = ["volcanic", "frozen", "mystic", "electric", "golden"];

/** Peso de cada especial no sorteio (o dourado aparece menos: ele só dá pontos). */
const SPECIAL_WEIGHTS = { volcanic: 1, frozen: 1, mystic: 1, electric: 1, golden: 0.5 };

/**
 * Nome e cor de cada tipo PARA O JOGADOR (o "type" em inglês é só do código).
 * - category: common | special | boss (usado no glossário, aba Ameaças)
 * - color: cor de textos e cards
 * - dust: cor (RGB) da poeira quando é destruído
 */
const ASTEROID_INFO = {
  common: { name: "Comum", category: "common", color: "#c9d3e6", dust: [155, 154, 153] },
  frozen: { name: "Glacial", category: "special", color: "#78e7ff", dust: [160, 202, 222] },
  volcanic: { name: "Vulcânico", category: "special", color: "#ff8c5c", dust: [173, 113, 92] },
  mystic: { name: "Místico", category: "special", color: "#bd86ff", dust: [162, 138, 199] },
  electric: { name: "Elétrico", category: "special", color: "#ffe66d", dust: [150, 170, 200] },
  golden: { name: "Dourado", category: "special", color: "#ffd267", dust: [235, 196, 96] },
  resistance: { name: "Resistente", category: "boss", color: "#6ee6ff", dust: [170, 160, 123] },
  gravity: { name: "Gravitacional", category: "boss", color: "#bd86ff", dust: [155, 133, 185] },
  thorny: { name: "Espinhoso", category: "boss", color: "#ff9a6e", dust: [146, 169, 126] },
  cyber: { name: "Cibernético", category: "boss", color: "#4fd8ff", dust: [123, 174, 197] },
  hydra: { name: "Hidra", category: "boss", color: "#7dff6a", dust: [92, 150, 96] },
  binary: { name: "Binário", category: "boss", color: "#ffb86b", dust: [150, 160, 180] },
};

/** Ordem dos bosses: o setor 5 é o 1º, o 10 é o 2º... e depois a lista se repete. */
const BOSSES_ASTEROIDS = ["thorny", "hydra", "gravity", "binary", "resistance", "cyber"];

// ============================================================
// NAVES
// ============================================================

/**
 * Naves do hangar.
 * - value: preço em centelhas (0 = já vem liberada)
 * - muzzles: ponta de cada cano na arte, em fração da imagem (x, y), + desvio lateral do tiro (vx).
 *   Medidos nas imagens de assets/ships; se trocar a arte, os pontos precisam ser medidos de novo.
 */
const SHIPS = [
  {
    src: "assets/ships/ship_1.png", name: "Nave Alpha", value: 0,
    muzzles: [{ x: 0.483, y: 0.0, vx: 0 }],                                   // bico
  },
  {
    src: "assets/ships/ship_2.png", name: "Nave Beta", value: 2500,
    muzzles: [{ x: 0.189, y: 0.208, vx: -22 }, { x: 0.779, y: 0.208, vx: 22 }], // canhões das asas
  },
  {
    src: "assets/ships/ship_3.png", name: "Nave Gamma", value: 9000,
    muzzles: [                                                                  // pontas das asas + bico
      { x: 0.047, y: 0.421, vx: -52 }, { x: 0.492, y: 0.0, vx: 0 }, { x: 0.932, y: 0.421, vx: 52 },
    ],
  },
  {
    src: "assets/ships/ship_4.png", name: "Nave Suam", value: 24000,
    muzzles: [                                                                  // um tiro por canhão: asas + ombros
      { x: 0.048, y: 0.351, vx: -58 }, { x: 0.242, y: 0.146, vx: -22 },
      { x: 0.758, y: 0.146, vx: 22 }, { x: 0.952, y: 0.351, vx: 58 },
    ],
  },
];

// ============================================================
// IMAGENS
// ============================================================

/** Caminho de todas as imagens usadas no canvas (pré-carregadas em utils.js). */
const ASSETS = {
  common: Array.from(
    { length: 9 },
    (_, i) => `assets/asteroids/common/asteroid_${i + 1}.png`,
  ),
  special: {
    frozen: "assets/asteroids/special/frozen.png",
    mystic: "assets/asteroids/special/mystic.png",
    volcanic: "assets/asteroids/special/volcanic.png",
    electric: "assets/asteroids/special/electric.png",
    golden: "assets/asteroids/special/golden.png",
  },
  bosses: {
    cyber: "assets/asteroids/bosses/cyber.png",
    gravity: "assets/asteroids/bosses/gravity.png",
    gravityAura: "assets/asteroids/bosses/gravity_aura.png",
    resistance: "assets/asteroids/bosses/resistance.png",
    thorny: "assets/asteroids/bosses/thorny.png",
    thornySpike: "assets/asteroids/bosses/thorny_spike.png",
    hydra: "assets/asteroids/bosses/hydra.png",
    binaryBlue: "assets/asteroids/bosses/binary_blue.png",
    binaryOrange: "assets/asteroids/bosses/binary_orange.png",
  },
  ships: Array.from(
    { length: 4 },
    (_, i) => `assets/ships/ship_${i + 1}.png`,
  ),
};

// ============================================================
// EQUILÍBRIO DO JOGO
// O jogo não tem setor máximo: todas as curvas crescem para sempre. As que crescem rápido
// no começo usam uma curva "suave" (sobe rápido e desacelera) + um crescimento lento sem teto.
//   suave(n) = base + soft × (1 - e^(-(n-1)/tau))     (n = setor)
// ============================================================
const BALANCE = {
  // ---------------- Nave e upgrades ----------------
  baseFireInterval: 340,
  minFireInterval: 100,
  fireRateFactor: 0.92,   // cada nível de cadência: intervalo × 0,92 (~9% mais tiros por nível; máx. no nível 15)
  damagePerLevel: 1,      // dano do tiro = 1 + nível
  resistancePerLevel: 10, // escudo = 10 × nível
  baseMoveSpeed: 390,
  // Preço do PRÓXIMO nível = base × (nível atual + 1)^exp. Crescimento polinomial (e não exponencial):
  // em um jogo sem fim os upgrades continuam alcançáveis, sempre um pouco atrás da dificuldade.
  upgradeCosts: {
    damage: { base: 90, exp: 1.95 },     // 90, 350, 770, 1.3K, 2.1K ... nível 10 ≈ 9.8K
    fireRate: { base: 70, exp: 1.85 },   // 70, 250, 530, 910 ... nível 10 ≈ 6.5K
    resistance: { base: 60, exp: 1.9 },  // 60, 220, 480, 840 ... nível 10 ≈ 5.7K
  },
  cardsLifetime: 10,

  // ---------------- Setores (Level.js) ----------------
  levels: {
    // Vida média: base + perLevel·(n-1) + curve·(n-1)²; cada asteroide sorteia ±spread em volta dela
    // setor 1 ≈ 2 · 10 ≈ 11 · 20 ≈ 23 · 40 ≈ 51 · 100 ≈ 162 · 200 ≈ 448
    hp: { base: 2, perLevel: 1, curve: 0.00625, spread: 0.18 },
    // Asteroides por setor: suave(10 → 40) + perLevelAfter por setor depois do setor `after`
    // setor 1 = 10 · 10 ≈ 19 · 20 ≈ 26 · 40 ≈ 34 · 100 ≈ 46 · 200 ≈ 56
    count: { base: 10, soft: 30, tau: 25, perLevelAfter: 0.1, after: 40 },
    // Asteroides ao mesmo tempo na arena: suave(4 → 12) + 1 a cada `every` setores depois de `after`
    active: { base: 4, soft: 8, tau: 30, every: 30, after: 60 },
    // Velocidade (px/s na tela de referência): suave(80 → 180) + perLevelAfter depois de `after`
    // setor 1 = 80 · 10 ≈ 106 · 30 ≈ 143 · 60 ≈ 166 · 100 ≈ 183 · 200 ≈ 201
    speed: { base: 80, soft: 100, tau: 30, perLevelAfter: 0.15, after: 60 },
    // Dano da batida de um asteroide no escudo: (base + perLevel·(n-1) + curve·(n-1)²) × √(activeRef / simultâneos)
    // (mais asteroides ao mesmo tempo = cada batida dói um pouco menos). Um asteroide já ferido
    // bate mais fraco: o dano vai de minFraction (quase morto) a 100% (vida cheia).
    // setor 5 ≈ 8 · 10 ≈ 11 · 20 ≈ 16 · 40 ≈ 28 · 100 ≈ 71 · 200 ≈ 160
    contact: { base: 5, perLevel: 0.9, curve: 0.0035, activeRef: 4, minFraction: 0.5 },
    // Chance de especial: começa em `start` no setor LEVEL_UNLOCK_SPECIALS e sobe até `max`
    // followUp: logo depois de um especial, a chance do PRÓXIMO também ser especial (dupla).
    // Depois de dois seguidos a sequência zera: o terceiro é sempre comum.
    special: { start: 0.1, perLevel: 0.003, max: 0.18, followUp: 0.45 },
  },

  // ---------------- Pontuação ----------------
  // Quase tudo é proporcional à vida média do setor, então a pontuação cresce junto com o jogo.
  score: {
    perDamage: 1,          // pontos por ponto de vida tirado (tiro, raio ou efeito)
    specialKill: 1,        // abater um especial: + specialKill × vida média
    bossKill: 6,           // abater um boss (cada núcleo/pedaço): + bossKill × vida média
    // Vitória sobre o boss: + bossVictory × vida média × desempenho (performance.min..max).
    // Desempenho = rapidez (parTime / tempo da luta) × escudo que sobrou (0,5 + fração restante).
    bossVictory: 30,
    bossPerformance: { parTime: 45, min: 0.4, max: 2 },
    timePerSecond: 0.03,   // sobrevivência: + timePerSecond × vida média por segundo...
    timeLimit: 60,         // ...durante os primeiros timeLimit segundos
  },
  combo: {
    // Segundos para o próximo abate manter a sequência. Diminui conforme o setor tem mais
    // asteroides: window até windowFromTotal, minWindow a partir de windowToTotal.
    window: 2.5,
    minWindow: 1,
    windowFromTotal: 10,
    windowToTotal: 50,
    bonusPerStep: 0.1,     // bônus = (sequência - 1) × bonusPerStep × vida média (mínimo 1 por passo)
    maxSteps: 10,          // teto da sequência
  },

  // ---------------- Centelhas ----------------
  rewards: {
    coinsPerScore: 0.7,    // centelhas por ponto
    levelBonus: 50,        // + 50 por setor (pesa mais no começo, quando a pontuação ainda é baixa)
    bossMultiplier: 1.6,   // setor de boss paga mais
    defeatMultiplier: 0,   // perdendo, não leva centelhas (só vencendo o setor)
  },

  // ---------------- Bosses ----------------
  // Vida = vida média do setor × (base + soft × (1 - e^(-n/tau)) + perLevel × n) × factor do boss
  // setor 5 ≈ 105 · 10 ≈ 250 · 20 ≈ 700 · 40 ≈ 2.2K · 100 ≈ 10K (antes do factor)
  // O Resistente ainda tem armadura (50% da vida) que regenera; a Hidra se divide até 8 pedaços
  // (só quando a vida do pedaço zera), então a vida total dela é 4× a do primeiro estágio.
  bossHp: {
    base: 15, soft: 38, tau: 30, perLevel: 0.065,
    // hydra: vida de UM estágio (são 4 estágios, cada um somando essa vida)
    factor: { thorny: 0.7, hydra: 0.5, gravity: 1, binary: 0.85, resistance: 1.15, cyber: 0.9 },
  },
  // Dano dos projéteis de boss no escudo = dano de batida do setor × multiplicador
  // (sem escudo, qualquer acerto mata)
  bossProjectileDamage: {
    thorn: 0.85,          // espinho do Espinhoso (são muitos)
    cyber: 1.5,           // orbe teleguiado do Cibernético
    acid: 1.4,            // cuspe ácido da Hidra
    plasma: 0.9,          // plasma dos núcleos do Binário
    beam: 1.3,            // feixe entre os núcleos do Binário (a cada 0,7s encostado)
  },
  // Arena dos bosses: asteroides que a própria arena gera durante a luta (o boss não gera nada).
  // interval: segundos entre um e outro; first: o primeiro; cap: máximo vivos ao mesmo tempo
  // (+1 a cada capPerLevels setores); special: chance de vir especial; onlySpecials: só especiais.
  bossArena: {
    // Luta longa (armadura): a arena ajuda com asteroides e cards para quebrar a defesa
    resistance: { interval: [3.5, 5], first: 2, cap: 3, capPerLevels: 25, special: 0.45 },
    // A arena gera e o Gravitacional ROUBA: usa como escudo em órbita e arremessa na nave.
    // noScore: esses asteroides não dão pontos (evita farm); o boss paga pela vitória.
    // Ele depende disso: cap conta só os asteroides SOLTOS (os presos na órbita ou arremessados
    // não ocupam vaga), cada leva manda `batch` de uma vez e `nearBoss` faz eles nascerem na
    // faixa onde o boss está (a até nearBoss px dele na horizontal), para ele conseguir puxar.
    gravity: { interval: [1, 1.6], first: 0.5, batch: 2, cap: 4, capPerLevels: 20, special: 0.12, nearBoss: 220, noScore: true },
    // Já são difíceis por si: só um especial de vez em quando
    thorny: { interval: [11, 15], first: 7, cap: 2, onlySpecials: true },
    cyber: { interval: [10, 14], first: 6, cap: 2, onlySpecials: true },
    hydra: { interval: [11, 15], first: 7, cap: 2, onlySpecials: true },
    binary: { interval: [10, 14], first: 6, cap: 2, onlySpecials: true },
  },

  // ---------------- Especiais ----------------
  // Asteroide dourado: não dropa card, dá bônus de pontuação ao ser derrotado
  golden: {
    baseBonus: 30,        // bônus = baseBonus + hpBonus × vida média do setor
    hpBonus: 8,
    hpMultiplier: 1.5,
    speedMultiplier: 1.25,
  },
  // Asteroides arremessados pelo Gravitacional batem mais forte
  launchedContactMultiplier: 1.3,
};

/**
 * Intervalo entre tiros (ms) para um nível de cadência.
 * @param {number} level nível do upgrade de cadência
 * @returns {number}
 */
function fireIntervalFor(level = 0) {
  const { baseFireInterval, minFireInterval, fireRateFactor } = BALANCE;
  return Math.max(minFireInterval, Math.round(baseFireInterval * Math.pow(fireRateFactor, level)));
}
