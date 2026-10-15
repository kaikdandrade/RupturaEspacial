"use strict";

const ships = [
  { id: 1, src: 'assets/spaceship/spaceship_1.png', name: 'Nave Alpha', value: 0 },
  { id: 2, src: 'assets/spaceship/spaceship_2.png', name: 'Nave Beta', value: 1800 },
  { id: 3, src: 'assets/spaceship/spaceship_3.png', name: 'Nave Gamma', value: 3200 },
  { id: 4, src: 'assets/spaceship/spaceship_4.png', name: 'Nave Suam', value: 10000 }
];

const state = {
  mode: "menu",
  time: 0,
  score: 0,
  runCoins: 0,
  kills: 0,
  totalDestroyed: 0,
  selectedLevel: SAVE.selectedLevel,
  levelConfig: null,
  lastSpawn: 0,
  lastShot: -9999,
  shake: 0,
  flash: 0,
  pointerDown: false,
  pointerActive: false,
  pointerX: 0,
  pointerY: 0,
  runBanked: false,
  completionQueued: false,
  effects: null,
  boss: null,
  bossSummonTimer: 0,
  waveEntered: false,
  spawnPlan: null,
  launch: null,
};


const stats = {
  resistance: () => 1 * BALANCE.resistancePerLevel, // SAVE.upgrades_level.resistance * BALANCE.resistancePerLevel,
  moveSpeed: () => BALANCE.baseMoveSpeed
};

let bullets = [];
let asteroids = [];
let particles = [];
let cyberOrb = [];
let enemyProjectiles = [];
let pickups = [];
let stars = [];
let lastFrame = performance.now();
let audioCtx = null;

function resetEffects() {
  state.effects = {
    asteroidSlow: 0,
    damageBoost: 0,
    rapidFire: 0,
    multiShot: 0,
    speedBoost: 0,
    volcanicPenalty: 0,
  };
}