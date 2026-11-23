"use strict";

class Level {
  #defConfig() {
    const isLevelBoss = this.number % 5 === 0;
    const enemies = {
      hp: {
        min: 1 + Math.floor((this.number - 1) * 0.72),
        max: (1 + Math.floor((this.number - 1) * 0.72)) + 2 + Math.floor(this.number / 4),
      },
      speed: 82 + Math.min(118, (this.number - 1) * 4.8),
    };
    const specialChance = Math.min(0.38, 0.08 + Math.max(0, this.number - 2) * 0.025);
    const helperCap = isLevelBoss ? Math.min(11, 5 + Math.floor(this.number / 10)) : 0;

    return {
      number: this.number,
      isLevelBoss,
      enemies,
      specialChance,
      helperCap,
    };
  }

  #defSpawnPlan() {
    const max = 60 + (GROWTH_SPAWN * Math.floor((this.number - 1) / 100));
    const total = Math.min(max, 10 + Math.floor((this.number - 1) * 1.35));
    const batchMin = total >= 18 ? 2 : 1;
    const batchMax = total >= 42 ? 5 : clamp(Math.ceil(Math.sqrt(total)), 4, 6);
    const activeCap = clamp(batchMax + Math.floor(this.number / 8), 6, 14);
    const intervalMin = Math.max(1.25, 1.85 - this.number * 0.012);
    const intervalMax = Math.max(intervalMin + 0.3, 2.35 - this.number * 0.01);
    return {
      total: total,
      spawned: 0,
      batchMin,
      batchMax,
      activeCap,
      intervalMin,
      intervalMax,
      timer: 0,
    };
  }

  set(nlevel = 1) {
    this.number = nlevel;
    const config = this.#defConfig();

    Object.assign(state, {
      playing: {
        time: 0,
        score: 0,
        effects: effects.reset(),
        kills: {
          total: 0,
          common: 0,
          freeze: 0,
          mystic: 0,
          vulcanic: 0,
          thorny: 0,
          cyber: 0,
          gravity: 0,
          resistance: 0,
          fractional: 0,
          fractionalSlice: 0,
        },
      },
      levelConfig: config,
      spawnPlan: this.#defSpawnPlan(config),
      // waveEntered: false,
      lastSpawn: 0,
      lastShot: -9999,
      shake: 0,
      flash: 0,
      // boss: null,
      bossSummonTimer: 0,
    });
  }
}

const level = new Level();
