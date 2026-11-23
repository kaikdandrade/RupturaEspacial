"use strict";

function showScreen(id = null) {
  screens.forEach((screen) => screen.classList.toggle("active", !!id && screen.id === id));
}

function showModal(id = null) {
  modals.forEach((modal) => (!!id && modal.id === id) ? modal.showModal() : modal.close());
}

function closeModals() {
  modals.forEach((modal) => modal.close());
}

function pauseGame() {
  if (state.mode === "playing") {
    updatePauseUI();
    showModal("pause");
    state.mode = "paused";
  }
}

function resumeGame() {
  if (state.mode === "paused") {
    closeModals();
    state.mode = "playing";
  }
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Estrelas
  const target = Math.max(45, Math.round((rect.width * rect.height) / 7200));
  if (stars.length === target) return;
  stars = Array.from({ length: target }, () => ({
    x: Math.random() * rect.width,
    y: Math.random() * rect.height,
    size: random(0.35, 2),
    speed: random(10, 40),
    alpha: random(0.18, 0.82),
  }));

  // Jogador
  if (player) {
    player.x = clamp(player.x, 30, rect.width - 30);
    player.y = clamp(player.y, 70, rect.height - 30);
  }
}
resize();

function randomTypeBoss(lConfig = state.levelConfig) {
  if (lConfig.isLevelBoss)
    return BOSSES_ASTEROIDS[Math.floor(lConfig.number / 5) - 1 % BOSSES_ASTEROIDS.length];
  return null;
}

function randomTypeAsteroids(lConfig = state.levelConfig) {
  if (lConfig.number <= LEVEL_UNLOCK_SPECIALS) return "common";
  if (Math.random() <= lConfig.specialChance)
    return SPECIALS_ASTEROIDS[Math.floor(Math.random() * SPECIALS_ASTEROIDS.length)];
  else return "common";
}

function spawnAsteroid({ helper = false, isPrimary = true, entryDelay, x, y, size }, lConfig = state.levelConfig) {
  const { w } = viewport();
  const finalHp = randomInt(lConfig.enemies.hp.min, lConfig.enemies.hp.max);
  const finalSpeed = lConfig.enemies.speed * random(0.86, 1.086);
  const finalSize = size || random(54, 78);
  const finalX =
    x ??
    random(
      finalSize * 0.65,
      Math.max(finalSize * 0.65 + 1, w - finalSize * 0.65),
    );
  const finalY = y ?? -finalSize - random(12, 100);
  const type = randomTypeAsteroids();
  console.log("FINAL SPEED", finalSpeed);

  const options = {
    x: finalX,
    y: finalY,
    hp: finalHp,
    speed: finalSpeed,
    type: type,
    size: finalSize,
    helper,
    isPrimary,
    entryDelay,
  };
  switch (type) {
    case "resistance":
      return new ResistanceAsteroid(options);
    case "fractionalSlice":
      return new FractionalSliceAsteroid(options);
    case "fractional":
      return new FractionalAsteroid(options);
    case "cyber":
      return new CyberAsteroid(options);
    case "gravity":
      return new GravityAsteroid(options);
    case "thorny":
      return new ThornyAsteroid(options);
    case "frozen":
      return new FrozenAsteroid(options);
    case "mystic":
      return new MysticAsteroid(options);
    case "volcanic":
      return new VolcanicAsteroid(options);
    case "common":
    default:
      return new CommonAsteroid(options);
  }
}

function spawnNormalBatch(requestedCount) {
  const cfg = state.levelConfig;
  const plan = state.spawnPlan;
  if (cfg.isLevelBoss) return 0;

  const activeThreats = asteroids.filter((a) => !a.dead).length;
  const freeSlots = Math.max(0, plan.activeCap - activeThreats);
  const count = Math.max(
    0,
    Math.min(requestedCount, freeSlots),
  );
  if (!count) return 0;

  for (let i = 0; i < count; i++) {
    // O lote entra como grupo, mas com uma pequena defasagem para não sobrepor sprites na borda superior.
    const entryDelay = i * random(0.086, 0.172);
    const asteroid = spawnAsteroid({ isPrimary: true, entryDelay });
    if (asteroid) {
      asteroids.push(asteroid);
      plan.spawned++;
    }
  }
  return count;
}

function beginNormalEncounter() {
  const cfg = state.levelConfig;
  if (cfg.isLevelBoss) return;
  const entered = spawnNormalBatch(state.spawnPlan.batchMax);
  state.spawnPlan.timer = random(
    state.spawnPlan.intervalMin,
    state.spawnPlan.intervalMax,
  );

  console.log(state);
  console.log(`${entered} ameaças entrando • ${state.spawnPlan.total} no setor`);
}

function updateNormalSpawner(dt) {
  const cfg = state.levelConfig;
  const plan = state.spawnPlan;
  if (cfg.isLevelBoss || plan.spawned >= plan.total) return;

  plan.timer -= dt;
  if (plan.timer > 0) return;

  const activeThreats = asteroids.filter((a) => !a.dead).length;
  const freeSlots = Math.max(0, plan.activeCap - activeThreats);
  if (freeSlots <= 0) {
    // Não despeja novos inimigos enquanto a arena já estiver cheia.
    plan.timer = 0.35;
    return;
  }

  const desired = randomInt(plan.batchMin, plan.batchMax);
  const entered = spawnNormalBatch(Math.min(desired, freeSlots));
  plan.timer = entered ? random(plan.intervalMin, plan.intervalMax) : 0.35;
}

// Desconta o valor dos créditos. Retorna false (e toca um som de erro) se não houver saldo.
function buy(costValue) {
  if (!Number.isFinite(costValue) || SAVE.coins < costValue) {
    playTone(180, 0.18, 0.04, "square"); // ERRO
    return false;
  }
  playTone(760, 0.09, 0.03, "triangle"); // CLICK
  SAVE.coins -= costValue;
  DATA.storeSave(SAVE);
  return true;
}

function buyUpgrade(type) {
  if (!buy(getCostUpgrade(type))) return;
  SAVE.upgrades_level[type]++;
  DATA.storeSave(SAVE);
}

function buyShip(index) {
  if (SAVE.ownedShips[index]) return;
  if (!buy(SHIPS[index].value)) {
    // Feedback visual de saldo insuficiente
    shipButton.classList.remove("denied");
    void shipButton.offsetWidth; // reinicia a animação se clicar de novo
    shipButton.classList.add("denied");
    return;
  }
  SAVE.ownedShips[index] = true;
  DATA.storeSave(SAVE);
}

function getCostUpgrade(type) {
  return Math.round(BALANCE.upgradeCosts.base * Math.pow(BALANCE.upgradeCosts.growth, SAVE.upgrades_level[type]));
}

function updateMenuUI() {
  // HUD
  bestScore.textContent = SAVE.bestScore;
  highestLevel.textContent = SAVE.highestLevel;
  moneyLabel.textContent = money(SAVE.coins);

  // Level...
  let level = SAVE.selectedLevel;
  levelLabel.innerText = level;
  const levelStatus = (level < SAVE.highestLevel) ? "completed" : (level % 5 === 0) ? "boss" : "available";
  levelLabelStatus.dataset.status = levelStatus; // cor definida no CSS (.level [data-status])
  levelLabelStatus.innerText = { completed: ' "CONCLUÍDO"', boss: ' "BOSS"', available: ' "Disponível"' }[levelStatus];
  prevLevelButton.disabled = SAVE.selectedLevel <= 1;
  nextLevelButton.disabled = SAVE.selectedLevel >= SAVE.highestLevel;

  // Ship
  shipPreview.src = SHIPS[SAVE.selectedShip].src;
  shipPreview.name = SHIPS[SAVE.selectedShip].name;
  shipButton.classList.toggle("ship-lock", !SAVE.ownedShips[currentShipIndex]);
  const shipButtonHTML = (SAVE.ownedShips[currentShipIndex])
    ? "Jogar"
    : "<img src='assets/icons/sparks.png' alt='' /> " + money(SHIPS[currentShipIndex].value);
  if (shipButton.dataset.html !== shipButtonHTML) {
    shipButton.innerHTML = shipButtonHTML;
    shipButton.dataset.html = shipButtonHTML;
  }
  prevShipButton.disabled = SAVE.selectedShip <= 0;
  nextShipButton.disabled = SAVE.selectedShip >= SHIPS.length - 1;

  // Upgrades...
  damageButton.disabled = SAVE.coins < getCostUpgrade("damage");
  damageValue.textContent = SAVE.upgrades_level.damage * BALANCE.damagePerLevel + 1;
  damageLevel.textContent = SAVE.upgrades_level.damage;
  damageCost.textContent = money(getCostUpgrade("damage"));

  const fireRate = BALANCE.baseFireInterval - (SAVE.upgrades_level.fireRate * BALANCE.fireRatePerLevel);
  if (fireRate <= BALANCE.minFireInterval) {
    fireRateButton.disabled = true;
    fireRateButton.classList.add("max");
    fireRateLevel.textContent = "MAX";
    fireRateCost.parentElement.remove();
  } else {
    fireRateButton.disabled = SAVE.coins < getCostUpgrade("fireRate");
    fireRateLevel.textContent = SAVE.upgrades_level.fireRate;
    fireRateCost.textContent = money(getCostUpgrade("fireRate"));
  }
  fireRateValue.textContent = (BALANCE.baseFireInterval - (SAVE.upgrades_level.fireRate * BALANCE.fireRatePerLevel)) + " ms";

  resistanceButton.disabled = SAVE.coins < getCostUpgrade("resistance");
  resistanceValue.textContent = BALANCE.resistancePerLevel * SAVE.upgrades_level.resistance;
  resistanceLevel.textContent = SAVE.upgrades_level.resistance;
  resistanceCost.textContent = money(getCostUpgrade("resistance"));
}

function updateHud() {
  const total = state.spawnPlan?.total ?? 0;
  const kills = state.playing.kills.total;

  hubKills.textContent = kills;
  hubTarget.textContent = total;
  hubLevel.textContent = SAVE.selectedLevel;
  hubScore.textContent = Math.floor(state.playing.score);
  hubTime.textContent = formatTime(state.playing.time);

  const progress = total > 0
    ? Math.min(100, (kills / total) * 100)
    : 0;

  levelProgressBar.style.width = `${progress}%`;
}

function updateGameOverUI() {
  const kills = state.playing.kills.total;
  const total = state.spawnPlan?.total ?? 0;
  const percent = total > 0 ? Math.min(100, (kills / total) * 100) : 0;

  resultLevel.textContent = String(level.number).padStart(2, "0");
  resultKills.textContent = kills;
  resultTotal.textContent = total;
  resultBest.textContent = money(Math.floor(state.playing.score));
  resultCoins.textContent = `+${money(state.playing.coins ?? 0)}`;
  resultProgressBar.style.width = `${percent}%`;
}

function updatePauseUI() {
  const kills = state.playing.kills.total;
  const total = state.spawnPlan?.total ?? 0;

  pauseScore.textContent = money(Math.floor(state.playing.score));
  pauseKills.textContent = `${kills} / ${total}`;
  pauseTime.textContent = formatTime(state.playing.time);
  pauseResistance.textContent = `${Math.ceil(player.resistance)} / ${player.maxResistance}`;
}

function playGame() {
  playTone(840, 0.13, 0.035, "triangle"); // CLICK
  resultProgressBar.style.width = "0";
  asteroids = [];
  player.retryLevel();
  level.set(SAVE.selectedLevel);
  showScreen("hud");
  updateHud();
  player.setShipSkin(SAVE.selectedShip);
  player.setLaunchParam(LAUNCH_TIME);
  player.setShoots(SHIPS[SAVE.selectedShip].shoots);
  state.mode = "launching";

  setTimeout((_) => {
    state.mode = "playing";
    beginNormalEncounter();
  }, LAUNCH_TIME * 1000);
}

// -------------------------- Eventos --------------------------
window.addEventListener("resize", resize);
document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "escape") {
    if (state.mode === "playing") pauseGame();
    else resumeGame();
    event.preventDefault();
  }
});
window.addEventListener("blur", (_) => {
  if (state.mode === "playing")
    pauseGame();
});

// Selecção de nível
function changeSelectorLevel(delta) {
  const next = clamp(SAVE.selectedLevel + delta, 1, SAVE.highestLevel + 10);
  if (next === SAVE.selectedLevel) return;
  SAVE.selectedLevel = next;
  DATA.storeSave(SAVE);
}

// Slider de seleção de nave
let currentShipIndex = SAVE.selectedShip;
function sliderSelectorShip(index) {
  player.setShipSkin(index);
  SAVE.selectedShip = index;
  DATA.storeSave(SAVE);
}

// O #ship-button fica dentro do #play-ship-button, então um único listener cuida dos dois:
// nave bloqueada -> compra; nave liberada -> joga.
playShipButton.addEventListener("click", (_) => {
  if (SAVE.ownedShips[currentShipIndex]) playGame();
  else buyShip(currentShipIndex);
});
shipButton.addEventListener("animationend", (e) => {
  if (e.animationName === "denied") shipButton.classList.remove("denied");
});

prevLevelButton.addEventListener("click", (_) => changeSelectorLevel(-1));
nextLevelButton.addEventListener("click", (_) => changeSelectorLevel(1));
prevShipButton.addEventListener("click", (_) => {
  currentShipIndex = Math.max(0, currentShipIndex - 1);
  sliderSelectorShip(currentShipIndex);
});
nextShipButton.addEventListener("click", (_) => {
  currentShipIndex = Math.min(SHIPS.length - 1, currentShipIndex + 1);
  sliderSelectorShip(currentShipIndex);
});

buttonCloseModals.forEach((btn) => btn.addEventListener("click", _ => btn.closest("dialog")?.close()));
helpButton.addEventListener("click", (_) => showModal("help"));
damageButton.addEventListener("click", (_) => buyUpgrade("damage"));
fireRateButton.addEventListener("click", (_) => buyUpgrade("fireRate"));
resistanceButton.addEventListener("click", (_) => buyUpgrade("resistance"));
pauseButton.addEventListener("click", (_) => pauseGame());
resumeButton.addEventListener("click", (_) => resumeGame())
hangarButtons.forEach(button => {
  button.addEventListener("click", (_) => {
    closeModals();
    showScreen("mainMenu");
    state.mode = "menu";
  });
});
retryButton.addEventListener("click", () => {
  closeModals();
  playGame();
});
restartButton.addEventListener("click", (_) => {
  closeModals();
  playGame();
});

// Remover aquele efeito de arrastar imagens do navegador, que atrapalha a jogabilidade
for (const img of document.getElementsByTagName("img"))
  img.addEventListener("dragstart", (event) => event.preventDefault());