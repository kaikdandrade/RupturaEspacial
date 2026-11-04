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
  levelConfig: null,
  lastSpawn: 0,
  lastShot: -9999,
  shake: 0,
  flash: 0,
  runBanked: false,
  completionQueued: false,
  effects: null,
  boss: null,
  bossSummonTimer: 0,
  waveEntered: false,
  spawnPlan: null,
  launch: null,
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