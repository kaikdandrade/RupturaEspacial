"use strict";

/**
 * @file Progresso do jogador: setores liberados, resultado de cada partida (centelhas,
 * recorde, abates) e a loja do hangar (upgrades e naves). Lê e altera o SAVE e grava com DATA.
 */

// ============================================================
// SETORES
// ============================================================

/** Maior setor que o jogador pode jogar: o seguinte ao maior vencido. */
function unlockedLevel() {
  return SAVE.highestLevel + 1;
}

/**
 * Progresso do setor atual (HUD, pausa, game over e setor concluído).
 * - Setor normal: asteroides destruídos / total do setor.
 * - Setor de boss: vida tirada do boss / vida total (a barra enche conforme ele perde vida).
 * @returns {{ boss: boolean, label: string, detail: string, done: number, total: number, ratio: number }}
 */
function levelProgress() {
  if (state.levelConfig?.isLevelBoss) {
    const total = state.bossTotalHp;
    // remainingHp: a Hidra conta também os estágios que ainda vão nascer
    const remaining = asteroids.reduce((sum, a) => sum + (a.boss && !a.dead ? (a.remainingHp?.() ?? a.hp) : 0), 0);
    const done = state.bossSpawned ? clamp(total - remaining, 0, total) : 0;
    return { boss: true, label: "Boss", detail: "Vida tirada do boss", done, total, ratio: total > 0 ? done / total : 0 };
  }
  const total = state.spawnPlan?.total ?? 0;
  const done = state.playing.kills.total;
  return {
    boss: false, label: "Asteroides", detail: "Asteroides destruídos",
    done, total, ratio: total > 0 ? Math.min(1, done / total) : 0,
  };
}

// ============================================================
// FIM DA PARTIDA
// ============================================================

/**
 * Centelhas ganhas na partida (BALANCE.rewards):
 * pontuação × coinsPerScore + setor × levelBonus; setor de boss multiplica; derrota paga só uma parte.
 */
function calculateCoins(completed) {
  const { coinsPerScore, levelBonus, bossMultiplier, defeatMultiplier } = BALANCE.rewards;
  let coins = Math.floor(state.playing.score) * coinsPerScore + level.number * levelBonus;
  if (state.levelConfig.isLevelBoss) coins *= bossMultiplier;
  if (!completed) coins *= defeatMultiplier;
  return Math.round(coins);
}

/**
 * Bônus de vitória sobre o boss, pelo desempenho: rapidez (parTime / tempo da luta) ×
 * escudo que sobrou (0,5 + fração restante; sem escudo comprado conta como cheio).
 * Soma na pontuação e mostra o multiplicador na tela. Retorna os pontos dados.
 */
function awardBossVictory() {
  const { bossVictory, bossPerformance: perf } = BALANCE.score;
  const fightTime = Math.max(1, state.playing.time);
  const speed = perf.parTime / fightTime;
  const shield = player.maxResistance > 0 ? player.resistance / player.maxResistance : 1;
  const performance = clamp(speed * (0.5 + shield), perf.min, perf.max);
  const points = Math.round(Asteroid.levelHp() * bossVictory * performance * effects.scoreMultiplier());
  state.playing.score += points;
  state.playing.bossPerformance = performance;
  spawnFloatingText(VIEW.w / 2, VIEW.h * 0.42, `VITÓRIA ×${performance.toFixed(1)}  +${money(points)}`, "#ffd267");
  return points;
}

/** Soma os abates de uma partida ao total do save (o "total" do objetivo não entra). */
function addKills(kills) {
  for (const [type, value] of Object.entries(kills)) {
    if (type !== "total") SAVE.kills[type] = (SAVE.kills[type] ?? 0) + value;
  }
}

/**
 * Fecha a partida e grava no save: centelhas, recorde, setor vencido e abates.
 * Só roda uma vez por partida (o resultado fica em state.playing.result).
 * @param {boolean} completed venceu o setor?
 * @returns {{ newRecord: boolean, coins: number }}
 */
function finishRun(completed) {
  if (state.playing.result) return state.playing.result;
  const coins = calculateCoins(completed);
  const score = Math.floor(state.playing.score);
  const newRecord = score > SAVE.bestScore;

  SAVE.coins += coins;
  if (newRecord) SAVE.bestScore = score;
  if (completed) {
    SAVE.highestLevel = Math.max(SAVE.highestLevel, level.number);
    SAVE.selectedLevel = level.number + 1; // o seletor do hangar já fica no próximo setor
  }
  // O boss conta como 1 abate do tipo dele ao vencer (a Hidra conta 1, não 1 por pedaço)
  const kills = { ...state.playing.kills };
  if (completed && state.levelConfig.isLevelBoss) kills[state.bossType] = (kills[state.bossType] ?? 0) + 1;
  addKills(kills);
  DATA.save(SAVE);

  state.playing.coins = coins;
  state.playing.result = { newRecord, coins };
  return state.playing.result;
}

/** Saiu no meio da partida (pelo pause): os abates feitos até ali entram no glossário (aba Ameaças). */
function abandonRun() {
  if (state.playing.result) return;
  addKills(state.playing.kills);
  DATA.save(SAVE);
  state.playing.result = { quit: true };
}

// ============================================================
// LOJA DO HANGAR
// ============================================================

/**
 * Preço do próximo nível de um upgrade da nave selecionada: base × (nível atual + 1)^exp
 * (BALANCE.upgradeCosts). Cada nave tem os próprios níveis (shipUpgrades em Player.js).
 */
function getCostUpgrade(type, currentLevel = shipUpgrades()[type]) {
  const { base, exp } = BALANCE.upgradeCosts[type];
  return Math.round(base * Math.pow(currentLevel + 1, exp));
}

/** A cadência já está no máximo (intervalo mínimo entre tiros)? */
function fireRateMaxed() {
  return fireIntervalFor(shipUpgrades().fireRate) <= BALANCE.minFireInterval;
}

/** Desconta centelhas. Sem saldo, toca o som de erro e retorna false. */
function spend(cost) {
  if (SAVE.coins < cost) {
    playTone(180, 0.18, 0.04, "square");
    return false;
  }
  playTone(760, 0.09, 0.03, "triangle");
  SAVE.coins -= cost;
  return true;
}

/** Compra o próximo nível de um upgrade ("damage" | "fireRate" | "resistance") da nave selecionada. */
function buyUpgrade(type) {
  if (!SAVE.ownedShips[SAVE.selectedShip]) return; // nave ainda não comprada
  if (type === "fireRate" && fireRateMaxed()) return;
  if (!spend(getCostUpgrade(type))) return;
  shipUpgrades()[type]++;
  DATA.save(SAVE);
}

/**
 * Compra a nave. Sem saldo, o botão balança (animação "denied").
 * @returns {boolean} comprou?
 */
function buyShip(index) {
  if (SAVE.ownedShips[index]) return true;
  if (!spend(SHIPS[index].value)) {
    shipButton.classList.remove("denied");
    void shipButton.offsetWidth; // reinicia a animação se clicar de novo
    shipButton.classList.add("denied");
    return false;
  }
  SAVE.ownedShips[index] = true;
  DATA.save(SAVE);
  return true;
}
