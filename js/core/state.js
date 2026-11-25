"use strict";

/**
 * @file Estado do jogo em execução: modo atual, dados da partida e as listas de entidades.
 * Diferente de config.js (dados fixos) e do SAVE (progresso guardado), tudo aqui muda
 * a cada quadro e é recomeçado a cada partida (Level.set).
 */

/**
 * Estado global.
 * mode: "menu" | "launching" | "playing" | "paused" | "gameover" | "complete"
 */
const state = {
  mode: "menu",
  /** Dados da partida atual (recriados em Level.set). */
  playing: {
    time: 0,                       // segundos de partida
    score: 0,                      // pontuação
    combo: { count: 0, timer: 0 }, // sequência de abates
    kills: { total: 0 },           // abates por tipo; total conta para o objetivo
    result: null,                  // resultado registrado ao fim (evita registrar duas vezes)
    coins: 0,                      // centelhas ganhas (calculadas ao fim)
  },
  levelConfig: null,  // configuração do setor (Level.#defConfig)
  spawnPlan: null,    // plano de geração dos asteroides do setor (Level.#defSpawnPlan)
  shake: 0,           // intensidade do tremor da tela (diminui sozinho)
  flash: 0,           // flash vermelho de dano (segundos restantes)
  boss: null,         // boss que o HUD acompanha (null quando todos caíram)
  bossType: null,     // tipo do boss do setor
  bossSpawned: false,
  bossTotalHp: 0,     // vida total do boss (Hidra/Binário: soma dos pedaços)
  bossSummonTimer: 0, // segundos até a arena do boss gerar o próximo asteroide
};

// ---------------- Entidades e efeitos visuais da partida ----------------
/** @type {Asteroid[]} asteroides e bosses vivos */
let asteroids = [];
/** @type {PickupCard[]} cards caindo */
let pickups = [];
/** Partículas simples: { x, y, vx, vy, size, color, life, maxLife } */
let particles = [];
/** Textos que sobem e somem (combo, nomes dos especiais...): { x, y, text, color, life, maxLife } */
let floatingTexts = [];
/** Raios elétricos (só visual): { points, life, maxLife, color } */
let bolts = [];
/** Anéis de explosão (Sobrecarga, só visual): { x, y, radius, life, maxLife, color } */
let blasts = [];
/** Estrelas do fundo: { x, y, size, speed, alpha } */
let stars = [];

/** Colisões checadas a cada quadro (ver Collisions.js). */
const collisions = new Collisions()
  .group("player", () => [player])
  .group("bullets", () => player.bullets)
  .group("asteroids", () => asteroids)
  .group("pickups", () => pickups)
  .group("enemyProjectiles", () => asteroids.flatMap((a) => a.projectiles ?? [])) // tiros dos bosses
  .connect("bullets", "asteroids")
  .connect("player", "asteroids")
  .connect("player", "pickups")
  .connect("player", "enemyProjectiles");
