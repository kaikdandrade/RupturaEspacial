"use strict";

/**
 * @file Setores. O jogo não tem setor máximo: todas as curvas (BALANCE.levels)
 * crescem para sempre, rápido no começo e devagar depois.
 */
class Level {
  /** Curva suave: base no setor 1, sobe rápido e se aproxima de base + soft (sem passar). */
  static soft(n, { base, soft, tau }) {
    return base + soft * (1 - Math.exp(-(n - 1) / tau));
  }

  /** Vida média dos asteroides do setor n. */
  static averageHp(n) {
    const { base, perLevel, curve } = BALANCE.levels.hp;
    return base + perLevel * (n - 1) + curve * (n - 1) ** 2;
  }

  /** Asteroides do objetivo do setor n. */
  static count(n) {
    const c = BALANCE.levels.count;
    return Math.round(Level.soft(n, c) + c.perLevelAfter * Math.max(0, n - c.after));
  }

  /** Asteroides ao mesmo tempo na arena no setor n. */
  static activeCap(n) {
    const a = BALANCE.levels.active;
    return Math.round(Level.soft(n, a)) + Math.floor(Math.max(0, n - a.after) / a.every);
  }

  /** Velocidade base dos asteroides do setor n (px/s na tela de referência). */
  static speed(n) {
    const s = BALANCE.levels.speed;
    return Level.soft(n, s) + s.perLevelAfter * Math.max(0, n - s.after);
  }

  /** Dano da batida de um asteroide com vida cheia no setor n. */
  static contactDamage(n) {
    const { base, perLevel, curve, activeRef } = BALANCE.levels.contact;
    const raw = base + perLevel * (n - 1) + curve * (n - 1) ** 2;
    return raw * Math.sqrt(activeRef / Level.activeCap(n));
  }

  /** Configuração do setor atual: vida, velocidade, dano de batida e chance de especial. */
  #defConfig() {
    const n = this.number;
    const L = BALANCE.levels;
    const isLevelBoss = n % 5 === 0;
    const avg = Level.averageHp(n);
    const min = Math.max(1, Math.round(avg * (1 - L.hp.spread)));
    const max = Math.max(min + 1, Math.round(avg * (1 + L.hp.spread)));
    const enemies = {
      hp: { min, max },
      averageHp: avg,
      speed: Level.speed(n),
      contact: Level.contactDamage(n),
    };
    // Especiais: nenhum antes do desbloqueio; depois sobem devagar até o teto
    const specialChance = n < LEVEL_UNLOCK_SPECIALS ? 0
      : Math.min(L.special.max, L.special.start + (n - LEVEL_UNLOCK_SPECIALS) * L.special.perLevel);

    return { number: n, isLevelBoss, enemies, specialChance };
  }

  /** Quantos asteroides o setor tem, quantos ao mesmo tempo e o ritmo dos lotes. */
  #defSpawnPlan() {
    const n = this.number;
    const total = Level.count(n);
    const activeCap = Level.activeCap(n);
    // Entram em lotes: no máximo metade da arena de uma vez
    const batchMax = clamp(Math.ceil(activeCap / 2), 2, 6);
    const batchMin = n >= 15 ? 2 : 1;
    const intervalMin = Math.max(1.1, 1.85 - n * 0.012);
    const intervalMax = Math.max(intervalMin + 0.3, 2.35 - n * 0.01);
    return {
      total,
      spawned: 0,
      batchMin,
      batchMax,
      activeCap,
      intervalMin,
      intervalMax,
      timer: 0,
    };
  }

  /**
   * Prepara o setor n: configuração, plano de geração e um estado de partida limpo.
   * @param {number} n número do setor (1, 2, 3...)
   */
  set(n = 1) {
    this.number = n;
    const config = this.#defConfig();

    Object.assign(state, {
      playing: { time: 0, score: 0, combo: { count: 0, timer: 0 }, kills: { total: 0 }, result: null, coins: 0 },
      levelConfig: config,
      spawnPlan: this.#defSpawnPlan(),
      shake: 0,
      flash: 0,
      boss: null,
      bossType: null,
      bossSpawned: false,
      bossTotalHp: 0,
      bossSummonTimer: 0,
    });

    // Efeitos zerados; o dano deles é uma fração da vida média dos asteroides deste setor
    effects.reset();
    effects.setDifficulty(config.enemies.averageHp);
  }
}

/** Setor atual. */
const level = new Level();
