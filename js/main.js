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

function buyUpgrade(type) {
  const cost = getCostUpgrade(type);
  console.log(type, cost);
  if (!cost || SAVE.coins < cost) return;
  SAVE.coins -= cost;
  SAVE.upgrades_level[type]++;
  DATA.storeSave(SAVE);
  playTone(760, 0.09, 0.03, "triangle"); // CLICK (upgrades)
}

function getCostUpgrade(type) {
  return Math.round(BALANCE.upgradeCosts.base * Math.pow(BALANCE.upgradeCosts.growth, SAVE.upgrades_level[type]));
}

// Função chamada para carregar os dados salvos e espelha-los no DOM
function updateMenuUI() {
  let level = SAVE.selectedLevel;
  levelLabel.innerHTML = level + ((level < SAVE.highestLevel) ? ' "CONCLUÍDO"' : (level % 5 === 0) ? ' "BOSS"' : ' "Disponível"');

  shipPreview.src = SHIPS[SAVE.selectedShip].src;
  shipPreview.name = SHIPS[SAVE.selectedShip].name;
  shipButton.classList.toggle("ship-lock", !SAVE.ownedShips[currentShipIndex]);
  shipButton.innerHTML = (SAVE.ownedShips[currentShipIndex]) ? "Jogar" : "<img src='assets/icons/sparks.png' /> " + SHIPS[currentShipIndex].value;
  prevShipButton.disabled = SAVE.selectedShip <= 0;
  nextShipButton.disabled = SAVE.selectedShip >= SHIPS.length - 1;
  bestScore.textContent = SAVE.bestScore;
  highestLevel.textContent = SAVE.highestLevel;
  moneyLabel.textContent = SAVE.coins;
  prevLevelButton.disabled = SAVE.selectedLevel <= 1;
  nextLevelButton.disabled = SAVE.selectedLevel >= SAVE.highestLevel;

  // Upgrades...
  damageButton.disabled = SAVE.coins < getCostUpgrade("damage");
  damageValue.textContent = SAVE.upgrades_level.damage * BALANCE.damagePerLevel + 1;
  damageLevel.textContent = SAVE.upgrades_level.damage;
  damageCost.textContent = getCostUpgrade("damage");

  const fireRate = BALANCE.baseFireInterval - (SAVE.upgrades_level.fireRate * BALANCE.fireRatePerLevel);
  if (fireRate <= BALANCE.minFireInterval) {
    fireRateButton.disabled = true;
    fireRateButton.classList.add("max");
    fireRateLevel.textContent = "MAX";
    fireRateCost.parentElement.remove();
  } else {
    fireRateButton.disabled = SAVE.coins < getCostUpgrade("fireRate");
    fireRateLevel.textContent = SAVE.upgrades_level.fireRate;
    fireRateCost.textContent = getCostUpgrade("fireRate");
  }
  fireRateValue.textContent = (BALANCE.baseFireInterval - (SAVE.upgrades_level.fireRate * BALANCE.fireRatePerLevel)) + " ms";

  resistanceButton.disabled = SAVE.coins < getCostUpgrade("resistance");
  resistanceValue.textContent = BALANCE.resistancePerLevel * SAVE.upgrades_level.resistance;
  resistanceLevel.textContent = SAVE.upgrades_level.resistance;
  resistanceCost.textContent = getCostUpgrade("resistance");
}

function updateHud() {
  const total = state.spawnPlan?.total ?? 0;
  const kills = state.playing.kills.total;

  hubKills.textContent = kills;
  hubTarget.textContent = total;
  hubLevel.textContent = SAVE.selectedLevel;
  hubScore.textContent = Math.floor(state.playing.score);

  const progress = total > 0
    ? Math.min(100, (kills / total) * 100)
    : 0;

  levelProgressBar.style.width = `${progress}%`;
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

playShipButton.addEventListener("click", (_) => {
  playTone(840, 0.13, 0.035, "triangle"); // CLICK
  player.setLaunchParam(2); // 2 segundos de mergulho
  player.setShipSkin(SAVE.selectedShip);
  player.setShoots(SHIPS[SAVE.selectedShip].shoots);
  state.mode = "launching";

  showScreen("hud");
  setTimeout((_) => {
    level.set(SAVE.selectedLevel);
    state.mode = "playing";
    beginNormalEncounter();
  }, 2000);
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

buttonCloseModals.forEach((btn) => btn.addEventListener("click", _ => (btn.parentNode.parentNode)?.close()));
rankingButton.addEventListener("click", (_) => showModal("ranking"));
helpButton.addEventListener("click", (_) => showModal("help"));
damageButton.addEventListener("click", (_) => buyUpgrade("damage"));
fireRateButton.addEventListener("click", (_) => buyUpgrade("fireRate"));
resistanceButton.addEventListener("click", (_) => buyUpgrade("resistance"));
pauseButton.addEventListener("click", (_) => pauseGame());
resumeButton.addEventListener("click", (_) => resumeGame())
// $("quitButton").addEventListener("click", quitRun);
// $("retryButton").addEventListener("click", () =>
//   startLevel(state.selectedLevel),
// );
// $("menuButton").addEventListener("click", showMenu);
// $("completeMenuButton").addEventListener("click", showMenu);

// Remover aquele efeito de arrastar imagens do navegador, que atrapalha a jogabilidade
for (const img of document.getElementsByTagName("img"))
  img.addEventListener("dragstart", (event) => event.preventDefault());