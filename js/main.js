"use strict";

/**
 * @file Ponto de entrada: liga os sinais (morte, efeitos), controla o ciclo de uma partida
 * (iniciar, pausar, terminar), a escala da tela e os botões da interface.
 */

// ============================================================
// SINAIS DO JOGO
// ============================================================

// Nave destruída: fim de partida (perdendo, não ganha centelhas)
player.on("death", () => {
  if (state.mode === "gameover") return;
  state.mode = "gameover";
  music.jingle("lose");
  finishRun(false);
  updateGameOverUI();
  showModal("gameover");
});

// Efeitos elementais (dano, explosões, avisos no HUD): ver js/game/reactions.js

// ============================================================
// TELA
// ============================================================

/** Ajusta o canvas ao tamanho da janela (com a densidade de pixels) e recalcula a escala do mundo. */
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = renderDensity(rect.width, rect.height);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Sprites são reduzidos na tela: redução de alta qualidade deixa as bordas mais limpas
  // (redimensionar o canvas reseta essa opção, por isso fica aqui)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  VIEW.w = rect.width;
  VIEW.h = rect.height;
  SCALE = worldScale(rect.width, rect.height);
  if (dpr !== RENDER_DPR) {
    RENDER_DPR = dpr;
    SpriteCache.clear();
  }
  backgroundGradients = null; // recriados no próximo quadro com o tamanho novo

  // Estrelas: quantidade proporcional à área
  const target = Math.max(45, Math.round((rect.width * rect.height) / 7200));
  if (stars.length !== target) {
    stars = Array.from({ length: target }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      size: random(0.35, 2),
      speed: random(10, 40),
      alpha: random(0.18, 0.82),
    }));
  }

  player.applyScale();
  player.x = clamp(player.x, 30, rect.width - 30);
  player.y = clamp(player.y, 70, rect.height - 30);
}

// ============================================================
// PARTIDA
// ============================================================

/**
 * Começa uma partida: limpa a arena, prepara o setor e a nave e roda a animação de
 * lançamento (a geração começa quando ela termina, em startEncounter).
 * @param {number} levelNumber setor; sem ele, usa o do seletor do hangar
 */
function playGame(levelNumber = SAVE.selectedLevel) {
  playTone(840, 0.13, 0.035, "triangle");
  asteroids = [];
  pickups = [];
  bolts = [];
  blasts = [];
  particles = [];
  Reactions.reset();
  floatingTexts = [];
  clearEffectsHud();
  level.set(levelNumber);
  player.retryLevel();
  player.setShipSkin(SAVE.selectedShip);
  player.setMuzzles(SHIPS[SAVE.selectedShip].muzzles);
  player.setLaunchParam(LAUNCH_TIME);
  showScreen("hud");
  updateHud();
  state.mode = "launching";
}

/** A nave chegou à arena: começa o setor (boss ou o primeiro lote de asteroides). */
function startEncounter() {
  state.mode = "playing";
  if (state.levelConfig.isLevelBoss) spawnBoss();
  else beginNormalEncounter();
}

/** Setor vencido: grava o resultado e mostra o modal de setor concluído. */
function winLevel() {
  if (state.mode === "complete") return;
  state.mode = "complete";
  if (state.levelConfig.isLevelBoss) awardBossVictory(); // boss paga pelo desempenho
  const result = finishRun(true);
  music.jingle(result.newRecord ? "record" : "win");
  updateCompletedUI(result);
  showModal("levelCompleted");
}

function pauseGame() {
  if (state.mode !== "playing") return;
  updatePauseUI();
  showModal("pause");
  state.mode = "paused";
}

function resumeGame() {
  if (state.mode !== "paused") return;
  closeModals();
  state.mode = "playing";
}

/** Volta ao hangar (saindo pela pausa, os abates feitos até ali ainda contam no arquivo). */
function backToHangar() {
  if (state.mode === "paused") abandonRun();
  closeModals();
  showScreen("mainMenu");
  state.mode = "menu";
}

/** Repete o setor atual (mesmo depois de vencer). */
function retryLevel() {
  closeModals();
  playGame(level.number);
}

// ============================================================
// HANGAR
// ============================================================

/** Anda no seletor de setor (de 1 até o setor liberado). */
function changeSelectorLevel(delta) {
  const next = clamp(SAVE.selectedLevel + delta, 1, unlockedLevel());
  if (next === SAVE.selectedLevel) return;
  SAVE.selectedLevel = next;
  DATA.save(SAVE);
}

/** Anda no seletor de nave (mostra também as bloqueadas, com o preço). */
function changeSelectorShip(delta) {
  const next = clamp(SAVE.selectedShip + delta, 0, SHIPS.length - 1);
  if (next === SAVE.selectedShip) return;
  SAVE.selectedShip = next;
  player.setShipSkin(next);
  DATA.save(SAVE);
}

// ============================================================
// EVENTOS
// ============================================================

window.addEventListener("resize", resize);
window.addEventListener("blur", pauseGame);
// Celular: trocar de app ou bloquear a tela pausa a partida
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
document.addEventListener("keyup", (event) => {
  if (event.key !== "Escape") return;
  // Esc com o glossário aberto só fecha o glossário (o navegador já fechou no keydown)
  if (escClosedGlossary) {
    escClosedGlossary = false;
    return;
  }
  if (state.mode === "playing") pauseGame();
  else resumeGame();
  event.preventDefault();
});

// Esc fecha o glossário no keydown (comportamento do <dialog>): marca para o keyup não
// tratar o mesmo Esc como "continuar o jogo"
let escClosedGlossary = false;
glossary.addEventListener("cancel", () => (escClosedGlossary = true));

// O #ship-button fica dentro do #play-ship-button: nave liberada -> joga; bloqueada -> compra
playShipButton.addEventListener("click", () => {
  if (SAVE.ownedShips[SAVE.selectedShip]) playGame();
  else buyShip(SAVE.selectedShip);
});
shipButton.addEventListener("animationend", (event) => {
  if (event.animationName === "denied") shipButton.classList.remove("denied");
});
prevLevelButton.addEventListener("click", () => changeSelectorLevel(-1));
nextLevelButton.addEventListener("click", () => changeSelectorLevel(1));
prevShipButton.addEventListener("click", () => changeSelectorShip(-1));
nextShipButton.addEventListener("click", () => changeSelectorShip(1));
damageButton.addEventListener("click", () => buyUpgrade("damage"));
fireRateButton.addEventListener("click", () => buyUpgrade("fireRate"));
resistanceButton.addEventListener("click", () => buyUpgrade("resistance"));
helpButton.addEventListener("click", () => openGlossary("threats"));
$("pauseGlossaryButton").addEventListener("click", () => openGlossary("settings"));

buttonCloseModals.forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", retryLevel);
retryButtons.forEach((button) => button.addEventListener("click", retryLevel));
hangarButtons.forEach((button) => button.addEventListener("click", backToHangar));
nextLevelPlayButton.addEventListener("click", () => {
  closeModals();
  playGame(); // finishRun já avançou o seletor para o próximo setor
});

// Impede o "arrastar imagem" do navegador, que atrapalha o jogo
for (const img of document.getElementsByTagName("img")) img.addEventListener("dragstart", (event) => event.preventDefault());
