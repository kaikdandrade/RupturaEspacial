"use strict";

class Level {
  #defConfig() {
    const isLevelBoss = level % 5 === 0;
    // const bossIndex = isBoss ? Math.floor(level / 5) - 1 : -1;
    // const bossType = isBoss ? BOSS_ORDER[bossIndex % BOSS_ORDER.length] : null;
    // const bossCycle = isBoss ? Math.floor(bossIndex / BOSS_ORDER.length) : 0;
    // const target = Math.min(60, 10 + Math.floor((level - 1) * 1.35));
    // const reward = (isBoss ? 180 : 80) + level * (isBoss ? 24 : 15);
    const enemies = {
      hp: {
        min: 1 + Math.floor((level - 1) * 0.72),
        max: (1 + Math.floor((level - 1) * 0.72)) + 2 + Math.floor(level / 4),
      },
      speed: 82 + Math.min(118, (level - 1) * 4.8),
    };
    // const specialChance = Math.min(0.38, 0.08 + Math.max(0, level - 2) * 0.025);
    // const bossHp = isBoss
    //   ? Math.max(24, Math.round((maxHp + minHp) * (4.8 + bossCycle * 0.8)))
    //   : 0;
    // const helperCap = isBoss ? Math.min(11, 5 + Math.floor(level / 10)) : 0;
    // const summonInterval = isBoss ? Math.max(2.35, 4.2 - level * 0.035) : 0;

    return {
    //   level,
      isLevelBoss,
      //   bossType,
      //   bossCycle,
      //   target,
      //   reward,
      enemies,
      //   specialChance,
      //   availableSpecials,
      //   bossHp,
      //   helperCap,
      //   summonInterval,
    };
  }

  set(level = 1) {
    this.number = level;
    Object.assign(state, {
      time: 0,
      score: 0,
      runCoins: 0,
      kills: 0,
      totalDestroyed: 0,
      selectedLevel: level,
      levelConfig: this.#defConfig(),

      lastShot: -9999,
      shake: 0,
      flash: 0,

      runBanked: false,
      completionQueued: false,

      pointerDown: false,
      pointerActive: false,

      boss: null,
      bossSummonTimer: 0,

      spawnPlan: null,
      launch: null,
    });

    // beginLevelCombat();
    lastFrame = performance.now();
    return;
  }
}

const level = new Level();
