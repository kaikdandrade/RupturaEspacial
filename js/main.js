"use strict";

// ============================================================
// RUPTURA ESPACIAL - Versão 1.0
// ============================================================
const LEVEL_UNLOCK_SPECIALS = 5;
const SPECIALS_ASTEROIDS = ["vulcanic", "frozen", "mystic", "fractional"];
const BOSSES_ASTEROIDS = ["resistance", "gravity", "thorny", "cyber"];

const screens = [...document.querySelectorAll(".screen")];
const modals = [...document.querySelectorAll("dialog")];
const buttonCloseModals = [...document.querySelectorAll(".close-modal")];
const shipPreview = $('ship-preview');
const bestScore = $("best-score");
const highestLevel = $("highest-level");
const moneyLabel = $("money-label")
const playShipButton = $('play-ship-button');
const shipButton = $('ship-button');
const nextShipButton = $('next-ship-button');
const prevShipButton = $('prev-ship-button');
const prevLevelButton = $("prev-level-button");
const nextLevelButton = $("next-level-button");
const levelLabel = $("level-info");
const rankingButton = $("ranking-button");
const helpButton = $("help-button");
const hubKills = $("hubKills");
const hubTarget = $("hubTarget");
const hubLevel = $("selectedLevel");
const hubScore = $("playScore");
const levelProgressBar = $("levelProgressBar");

// function upgradeCost(type) {
//   const cfg = BALANCE.upgradeCosts[type];
//   return Math.round(cfg.base * Math.pow(cfg.growth, save.upgrades[type]));
// }

function showScreen(id = null) {
  screens.forEach((screen) => screen.classList.toggle("active", !!id && screen.id === id));
  console.log(screens);
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
  if (!cfg || cfg.isBoss || !plan) return 0;

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
  if (!cfg || cfg.isBoss) return;
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
  // if (!cfg || cfg.isBoss || !plan || plan.remaining <= 0) return;

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

// function buyUpgrade(type) {
//   if (!BALANCE.upgradeCosts[type]) return;
//   const cost = upgradeCost(type);
//   if (save.coins < cost) {
//     console.log("Créditos insuficientes");
//     return;
//   }
//   save.coins -= cost;
//   save.upgrades[type]++;
//   storeSave();
//   updateMenuUI();
//   // CLICK (upgrades)
//   playTone(760, 0.09, 0.03, "triangle");
//   console.log("Melhoria instalada");
// }

// CLICK (antigo handleShipAction)
// playTone(840, 0.13, 0.035, "triangle");

// Função chamada para carregar os dados salvos e espelha-los no DOM
function loadMenuUI() {
  // Remover aquele efeito de arrastar imagens do navegador, que atrapalha a jogabilidade
  for (const img of document.getElementsByTagName("img"))
    img.addEventListener("dragstart", (event) => event.preventDefault());

  let level = SAVE.selectedLevel;
  levelLabel.innerHTML = level + ((level < SAVE.highestLevel) ? " Concluído" : (level % 5 === 0) ? " BOSS" : " Disponível");

  shipPreview.src = ships[SAVE.selectedShip].src;
  shipPreview.name = ships[SAVE.selectedShip].name;
  bestScore.textContent = SAVE.bestScore;
  highestLevel.textContent = SAVE.highestLevel;
  moneyLabel.textContent = SAVE.coins;
  prevLevelButton.disabled = SAVE.selectedLevel <= 1;
  nextLevelButton.disabled = SAVE.selectedLevel >= SAVE.highestLevel;
  prevShipButton.disabled = SAVE.selectedShip <= 0;
  nextShipButton.disabled = SAVE.selectedShip >= ships.length - 1;

  // Upgrades...
}

function updateHud() {
  const total = state.spawnPlan?.total ?? 0;
  const kills = state.kills;

  hubKills.textContent = kills;
  hubTarget.textContent = total;

  hubLevel.textContent = state.selectedLevel;
  hubScore.textContent = Math.floor(state.score);

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
window.addEventListener("blur", () => {
  if (state.mode === "playing")
    pauseGame();
});

// ----------------------------------------------------
// Slider de seleção de nave
// ----------------------------------------------------
let currentShipIndex = 0;
function sliderSelectorShip(index) {
  prevShipButton.disabled = currentShipIndex === 0;
  nextShipButton.disabled = currentShipIndex === ships.length - 1;
  shipButton.classList.toggle("ship-lock", !SAVE.ownedShips[currentShipIndex]);
  shipButton.innerHTML = (SAVE.ownedShips[currentShipIndex]) ? "Jogar" : "<img src='assets/icons/sparks.png' /> " + ships[currentShipIndex].value;
  player.setShipSkin(currentShipIndex);
  shipPreview.style.opacity = '0';
  shipPreview.style.transform = 'scale(0.7)';

  setTimeout(() => {
    shipPreview.src = ships[index].src;
    shipPreview.alt = ships[index].name;
    shipPreview.style.opacity = '1';
    shipPreview.style.transform = 'scale(1)';
  }, 300);
}

prevShipButton.addEventListener('click', (e) => {
  currentShipIndex = Math.max(0, currentShipIndex - 1);
  sliderSelectorShip(currentShipIndex);
});

nextShipButton.addEventListener('click', (e) => {
  currentShipIndex = Math.min(ships.length - 1, currentShipIndex + 1);
  sliderSelectorShip(currentShipIndex);
});

playShipButton.addEventListener("click", () => {
  player.setLaunchParam(2);
  state.mode = "launching";
  showScreen("hud");
  setTimeout((_) => {
    level.set(1);
    state.mode = "playing";
    beginNormalEncounter();
  }, 2000);
});

// ----------------------------------------------------
// Seleção de nível
// ----------------------------------------------------
function changeSelectorLevel(delta) {
  const next = clamp(SAVE.selectedLevel + delta, 1, SAVE.highestLevel + 10);
  if (next === SAVE.selectedLevel) return;
  SAVE.selectedLevel = next;
  DATA.storeSave(SAVE);
  levelLabel.innerHTML = next + ((next < SAVE.highestLevel) ? " Concluído" : (next % 5 === 0) ? " BOSS" : " Disponível");
  prevShipButton.disabled = SAVE.selectedShip <= 0;
  nextShipButton.disabled = SAVE.selectedShip >= ships.length - 1;
}
prevLevelButton.addEventListener("click", () => changeSelectorLevel(-1));
nextLevelButton.addEventListener("click", () => changeSelectorLevel(1));

buttonCloseModals.forEach((btn) => btn.addEventListener('click', (e) => (btn.parentNode.parentNode)?.close()));
rankingButton.addEventListener("click", () => showModal("ranking"));
helpButton.addEventListener("click", () => showModal("help"));
// $("pauseButton").addEventListener("click", () => togglePause(true));
// $("resumeButton").addEventListener("click", () => togglePause(false));
// $("quitButton").addEventListener("click", quitRun);
// $("retryButton").addEventListener("click", () =>
//   startLevel(state.selectedLevel),
// );
// $("menuButton").addEventListener("click", showMenu);
// $("completeMenuButton").addEventListener("click", showMenu);

// Inicialização
// resetEffects();
resize();
loadMenuUI();
