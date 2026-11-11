"use strict";

// ============================================================
// RUPTURA ESPACIAL - Versão 1.0
// ============================================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
const $ = (id) => document.getElementById(id);

const GROWTH_SPAWN = 5;
const SCORE_TIME_LIMIT = 40;
const LEVEL_UNLOCK_SPECIALS = 5;
const SPECIALS_ASTEROIDS = ["volcanic", "frozen", "mystic"]; //, "fractional"];
const BOSSES_ASTEROIDS = ["resistance", "gravity", "thorny", "cyber"];

const screens = [...document.querySelectorAll(".screen")];
const modals = [...document.querySelectorAll("dialog")];
const buttonCloseModals = [...document.querySelectorAll(".close-modal")];
const shipPreview = $("ship-preview");
const bestScore = $("best-score");
const highestLevel = $("highest-level");
const moneyLabel = $("money-label")
const playShipButton = $("play-ship-button");
const shipButton = $("ship-button");
const nextShipButton = $("next-ship-button");
const prevShipButton = $("prev-ship-button");
const prevLevelButton = $("prev-level-button");
const nextLevelButton = $("next-level-button");
const levelLabel = $("level-value");
const levelLabelStatus = $("level-status");
const rankingButton = $("ranking-button");
const helpButton = $("help-button");
const hubKills = $("hubKills");
const hubTarget = $("hubTarget");
const hubLevel = $("selectedLevel");
const hubScore = $("playScore");
const levelProgressBar = $("levelProgressBar");
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
const pauseButton = $("pauseButton");
const resumeButton = $("resumeButton");

const SHIPS = [
  { id: 1, src: "assets/spaceship/spaceship_1.png", name: "Nave Alpha", value: 0, shoots: 1 },
  { id: 2, src: "assets/spaceship/spaceship_2.png", name: "Nave Beta", value: 1800, shoots: 2 },
  { id: 3, src: "assets/spaceship/spaceship_3.png", name: "Nave Gamma", value: 3200, shoots: 3 },
  { id: 4, src: "assets/spaceship/spaceship_4.png", name: "Nave Suam", value: 10000, shoots: 4 }
];

const BALANCE = {
  baseFireInterval: 340,
  minFireInterval: 100,
  damagePerLevel: 1,
  fireRatePerLevel: 5,
  resistancePerLevel: 10,
  baseMoveSpeed: 390,
  upgradeCosts: { base: 100, growth: 1.6 },
  cardsLifetime: 10,
};

const state = {
  mode: "menu",
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
  levelConfig: null,
  spawnPlan: null,
  // waveEntered: false,
  lastSpawn: 0,
  lastShot: -9999,
  shake: 0,
  flash: 0,
  // boss: null,
  bossSummonTimer: 0,
};

let asteroids = [];
let particles = [];
let pickups = [];
let stars = [];
let lastFrame = performance.now();
let audioCtx = null;

const collisions = new Collisions()
  .group("player", () => [player])
  .group("bullets", () => player.bullets)
  .group("asteroids", () => asteroids)

  .connect("bullets", "asteroids")
  .connect("player", "asteroids");