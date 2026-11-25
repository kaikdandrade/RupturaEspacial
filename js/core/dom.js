"use strict";

/**
 * @file Referências do DOM (elementos do index.html usados pelo JavaScript).
 * Ficam todas aqui para o resto do código não espalhar getElementById.
 */

/** Atalho para document.getElementById. */
const $ = (id) => document.getElementById(id);
/** Atalho para document.querySelectorAll, já como array. */
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ---------------- Canvas do jogo ----------------
/** @type {HTMLCanvasElement} */
const canvas = $("gameCanvas");
/** Contexto 2D onde tudo do jogo é desenhado. */
const ctx = canvas.getContext("2d", { alpha: true });

// ---------------- Telas e modais ----------------
const screens = $$(".screen");
const modals = $$("dialog");
const buttonCloseModals = $$(".close-modal, [data-back]");

// ---------------- Hangar (menu principal) ----------------
const bestScore = $("best-score");
const highestLevel = $("highest-level");
const moneyLabel = $("money-label");
const helpButton = $("help-button");
// Seletor de nave
const shipPreview = $("ship-preview");
const playShipButton = $("play-ship-button");
const shipButton = $("ship-button");
const nextShipButton = $("next-ship-button");
const prevShipButton = $("prev-ship-button");
// Seletor de setor
const prevLevelButton = $("prev-level-button");
const nextLevelButton = $("next-level-button");
const levelLabel = $("level-value");
const levelLabelStatus = $("level-status");
// Upgrades (da nave selecionada)
const workshopShip = $("workshop-ship");
const workshopLock = $("workshop-lock");
const upgradeStrip = $("upgrade-strip");
const damageButton = $("damage-button");
const damageValue = $("damage-value");
const damageLevel = $("damage-level");
const damageCost = $("damage-cost");
const fireRateButton = $("fire-rate-button");
const fireRateValue = $("fire-rate-value");
const fireRateLevel = $("fire-rate-level");
const fireRateCost = $("fire-rate-cost");
const resistanceButton = $("resistance-button");
const resistanceValue = $("resistance-value");
const resistanceLevel = $("resistance-level");
const resistanceCost = $("resistance-cost");

// ---------------- HUD (durante a partida) ----------------
const hubLevel = $("selectedLevel");
const hubObjectiveLabel = $("hubObjectiveLabel");
const hubKills = $("hubKills");
const hubTarget = $("hubTarget");
const hubScore = $("playScore");
const hubTime = $("playTime");
const levelProgressBar = $("levelProgressBar");
const effectsBar = $("effectsBar");
const pauseButton = $("pauseButton");

// ---------------- Modal de pausa ----------------
const resumeButton = $("resumeButton");
const restartButton = $("restartButton");
const pauseKillsLabel = $("pauseKillsLabel");
const pauseScore = $("pauseScore");
const pauseKills = $("pauseKills");
const pauseTime = $("pauseTime");
const pauseResistance = $("pauseResistance");

// ---------------- Modal de game over ----------------
const resultLevel = $("resultLevel");
const resultProgressLabel = $("resultProgressLabel");
const resultKills = $("resultKills");
const resultTotal = $("resultTotal");
const resultBest = $("resultBest");
const resultProgressBar = $("resultProgressBar");

// ---------------- Modal de setor concluído ----------------
const completeLevel = $("completeLevel");
const completeSector = $("completeSector");
const completeProgressLabel = $("completeProgressLabel");
const completeDestroyed = $("completeDestroyed");
const completeTotal = $("completeTotal");
const completeProgressBar = $("completeProgressBar");
const completeScore = $("completeScore");
const completeRecord = $("completeRecord");
const completeBonus = $("completeBonus");
const completeTime = $("completeTime");
const nextLevelPlayButton = $("nextLevelPlayButton");

// ---------------- Botões que aparecem em mais de um modal ----------------
const retryButtons = $$(".btn-retry");
const hangarButtons = $$(".btn-hangar");

// ---------------- Glossário (aba Ameaças) ----------------
const archiveTotal = $("archiveTotal");
