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
    const target = Math.min(60, 10 + Math.floor((this.number - 1) * 1.35));
    const batchMin = target >= 18 ? 2 : 1;
    const batchMax = target >= 42 ? 5 : clamp(Math.ceil(Math.sqrt(target)), 4, 6);
    const activeCap = clamp(batchMax + Math.floor(this.number / 8), 6, 14);
    const intervalMin = Math.max(1.25, 1.85 - this.number * 0.012);
    const intervalMax = Math.max(intervalMin + 0.3, 2.35 - this.number * 0.01);
    return {
      total: target,
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
      time: 0,
      score: 0,
      runCoins: 0,
      kills: 0,
      totalDestroyed: 0,
      selectedLevel: nlevel,
      levelConfig: config,

      lastShot: -9999,
      shake: 0,
      flash: 0,

      runBanked: false,
      completionQueued: false,

      pointerDown: false,
      pointerActive: false,

      boss: null,
      bossSummonTimer: 0,

      spawnPlan: this.#defSpawnPlan(config),
      launch: null,
    });
  }
}

const level = new Level();
