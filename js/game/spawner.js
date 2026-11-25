"use strict";

/**
 * @file Geração de asteroides: sorteio dos tipos, o fluxo dos setores normais (lotes até o
 * objetivo) e a luta de boss (o boss + os asteroides que a arena manda, BALANCE.bossArena).
 */

// ============================================================
// SORTEIO DOS TIPOS
// ============================================================

/** Boss do setor (a lista BOSSES_ASTEROIDS se repete: setor 5 = 1º, 10 = 2º...). null se não for setor de boss. */
function randomTypeBoss(config = state.levelConfig) {
  if (!config.isLevelBoss) return null;
  return BOSSES_ASTEROIDS[(Math.floor(config.number / 5) - 1) % BOSSES_ASTEROIDS.length];
}

/** Sorteia um especial respeitando SPECIAL_WEIGHTS (o Dourado vem menos). */
function randomSpecialType() {
  const total = SPECIALS_ASTEROIDS.reduce((sum, type) => sum + (SPECIAL_WEIGHTS[type] ?? 1), 0);
  let roll = Math.random() * total;
  for (const type of SPECIALS_ASTEROIDS) {
    roll -= SPECIAL_WEIGHTS[type] ?? 1;
    if (roll < 0) return type;
  }
  return SPECIALS_ASTEROIDS[0];
}

/**
 * Tipo de um asteroide da arena: especial (com a chance dada) ou comum.
 * Antes de LEVEL_UNLOCK_SPECIALS só vem comum.
 * Sequência (state.playing.specialStreak): logo depois de um especial a chance sobe para
 * BALANCE.levels.special.followUp (pode vir uma dupla); depois de dois seguidos, o próximo é
 * sempre comum e a sequência zera (nunca vêm três especiais seguidos).
 */
function randomTypeAsteroids(config = state.levelConfig, specialChance = config.specialChance) {
  if (config.number < LEVEL_UNLOCK_SPECIALS) return "common";
  const run = state.playing;
  const streak = run?.specialStreak ?? 0;
  const chance = streak >= 2 ? 0
    : streak === 1 ? Math.max(specialChance, BALANCE.levels.special.followUp)
    : specialChance;
  const special = Math.random() < chance;
  if (run) run.specialStreak = special ? streak + 1 : 0;
  return special ? randomSpecialType() : "common";
}

// ============================================================
// CRIAÇÃO
// ============================================================

/**
 * Cria (sem adicionar à arena) um asteroide do setor atual. Sem posição, nasce acima da tela
 * numa coluna aleatória. Vida, velocidade e tamanho vêm do setor (e da escala da tela).
 * @param {object} [options]
 * @param {string} [options.type] tipo; sem ele, sorteia (randomTypeAsteroids)
 * @param {number} [options.hp] vida; sem ela, sorteia dentro da faixa do setor
 * @returns {Asteroid}
 */
function spawnAsteroid({ helper = false, isPrimary = true, entryDelay = 0, x, y, size, type, hp } = {}) {
  const config = state.levelConfig;
  const { w } = viewport();
  const finalSize = size || px(random(54, 78));
  const margin = finalSize * 0.65;
  return Asteroid.create({
    type: type ?? randomTypeAsteroids(config),
    x: x ?? random(margin, Math.max(margin + 1, w - margin)),
    y: y ?? -finalSize - px(random(12, 100)),
    hp: hp ?? randomInt(config.enemies.hp.min, config.enemies.hp.max),
    speed: px(config.enemies.speed * random(0.86, 1.086)),
    size: finalSize,
    helper,
    isPrimary,
    entryDelay,
  });
}

// ============================================================
// SETOR NORMAL
// ============================================================

/**
 * Coloca na arena um lote de até `requestedCount` asteroides, respeitando o máximo ao mesmo
 * tempo (activeCap) e o objetivo do setor (nunca gera além do total).
 * @returns {number} quantos entraram
 */
function spawnNormalBatch(requestedCount) {
  const plan = state.spawnPlan;
  const freeSlots = Math.max(0, fitActiveCap(plan.activeCap) - asteroids.length);
  const remaining = Math.max(0, plan.total - plan.spawned);
  const count = Math.min(requestedCount, freeSlots, remaining);
  for (let i = 0; i < count; i++) {
    // O lote entra junto, com uma pequena defasagem para os sprites não se sobreporem no topo
    asteroids.push(spawnAsteroid({ entryDelay: i * random(0.086, 0.172) }));
    plan.spawned++;
  }
  return count;
}

/** Primeiro lote do setor (chamado quando a nave termina de entrar). */
function beginNormalEncounter() {
  const plan = state.spawnPlan;
  spawnNormalBatch(plan.batchMax);
  plan.timer = random(plan.intervalMin, plan.intervalMax);
}

/** A cada intervalo, manda um novo lote (se houver espaço na arena e asteroides a gerar). */
function updateNormalSpawner(dt) {
  const plan = state.spawnPlan;
  if (plan.spawned >= plan.total) return;
  plan.timer -= dt;
  if (plan.timer > 0) return;

  const freeSlots = fitActiveCap(plan.activeCap) - asteroids.length;
  if (freeSlots <= 0) {
    plan.timer = 0.35; // arena cheia: tenta de novo daqui a pouco
    return;
  }
  const entered = spawnNormalBatch(Math.min(randomInt(plan.batchMin, plan.batchMax), freeSlots));
  plan.timer = entered ? random(plan.intervalMin, plan.intervalMax) : 0.35;
}

// ============================================================
// SETOR DE BOSS
// ============================================================

/**
 * Coloca o boss do setor na arena (o Binário são dois núcleos que dividem a vida).
 * Vida = vida média do setor × multiplicador (BALANCE.bossHp) × ajuste do boss.
 */
function spawnBoss() {
  const config = state.levelConfig;
  const { w } = viewport();
  const type = randomTypeBoss(config);
  const B = BALANCE.bossHp;
  // Sobe rápido nos primeiros bosses e depois devagar, sem teto
  const hpMultiplier = B.base + B.soft * (1 - Math.exp(-config.number / B.tau)) + B.perLevel * config.number;
  const options = {
    type,
    hp: Math.round(config.enemies.averageHp * hpMultiplier * (B.factor[type] ?? 1)),
    size: px(140), x: w / 2, y: -px(160), isPrimary: false,
  };
  const bosses = type === "binary"
    ? BinaryBoss.createPair({ ...options, size: px(104), speed: px(config.enemies.speed) })
    : [spawnAsteroid(options)];

  asteroids.push(...bosses);
  state.boss = bosses[0];
  state.bossType = type;
  state.bossSpawned = true;
  state.bossTotalHp = bosses.reduce((sum, boss) => sum + (boss.totalHp ?? boss.maxHp), 0);
  // A arena começa a mandar asteroides depois de um tempo
  state.bossSummonTimer = bossArenaRules().first ?? 3;
}

/** Regras da arena do boss atual (BALANCE.bossArena). */
function bossArenaRules() {
  return BALANCE.bossArena[state.bossType];
}

/** Máximo de asteroides da arena vivos ao mesmo tempo na luta atual. */
function bossArenaCap(rules = bossArenaRules()) {
  const bonus = rules.capPerLevels ? Math.floor(level.number / rules.capPerLevels) : 0;
  return fitActiveCap(rules.cap + bonus);
}

/**
 * A arena do boss manda asteroides do topo (o boss em si não gera nada).
 * Só contam na vaga os asteroides soltos: os presos na órbita do Gravitacional ou já
 * arremessados por ele não impedem a arena de mandar mais.
 */
function spawnHelpers(count) {
  const rules = bossArenaRules();
  const active = asteroids.filter((a) => a.helper && !a.dead && !a.orbitHost && !a.launched).length;
  const free = Math.max(0, bossArenaCap(rules) - active);
  const { w } = viewport();
  for (let i = 0; i < Math.min(count, free); i++) {
    const type = rules.onlySpecials ? randomSpecialType() : randomTypeAsteroids(state.levelConfig, rules.special);
    // nearBoss: nasce na faixa horizontal do boss (o Gravitacional precisa alcançar para roubar)
    const x = rules.nearBoss && state.boss
      ? clamp(state.boss.x + px(random(-rules.nearBoss, rules.nearBoss)), px(50), w - px(50))
      : undefined;
    const helper = spawnAsteroid({ helper: true, isPrimary: false, entryDelay: i * 0.15, type, x });
    helper.noScore = !!rules.noScore; // arena do Gravitacional: sem pontos (anti-farm)
    asteroids.push(helper);
  }
}

/** Timer da arena do boss: a cada intervalo manda mais um asteroide. */
function updateBossSummons(dt) {
  if (!state.boss || state.boss.dead) return;
  state.bossSummonTimer -= dt;
  if (state.bossSummonTimer > 0) return;
  const [min, max] = bossArenaRules().interval;
  state.bossSummonTimer = random(min, max);
  spawnHelpers(bossArenaRules().batch ?? 1);
}
