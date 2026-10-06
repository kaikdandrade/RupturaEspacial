"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
const $ = (id) => document.getElementById(id);

function viewport() {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function circlesTouch(a, b, extra = 0) {
  const r = a.radius + b.radius + extra;
  return distSq(a, b) <= r * r;
}

// Definindo o caminho dos assets usados no jogo e criando o sistema de chace das imagens.
const ASSETS = {
  common: Array.from(
    { length: 9 },
    (_, i) => `assets/asteroid/asteroid_${i + 1}.png`,
  ),
  special: {
    fractional: "assets/asteroid_special/asteroid_fractional.png",
    fractionalSlice: "assets/asteroid_special/asteroid_factional_slice.png",
    frozen: "assets/asteroid_special/asteroid_frozen.png",
    mystic: "assets/asteroid_special/asteroid_mystic.png",
    volcanic: "assets/asteroid_special/asteroid_volcanic.png",
  },
  bosses: {
    cyber: "assets/asteroid_special/asteroid_ciber.png",
    gravity: "assets/asteroid_special/asteroid_gravity.png",
    gravityAura: "assets/asteroid_special/asteroid_gravity_aurea.png",
    resistance: "assets/asteroid_special/asteroid_resistence.png",
    thorny: "assets/asteroid_special/asteroid_thorny.png",
    thornySpike: "assets/asteroid_special/asteroid_thorny_spikes.png",
  },
  ships: Array.from(
    { length: 4 },
    (_, i) => `assets/spaceship/spaceship_${i + 1}.png`,
  ),
};
const imageCache = new Map();
function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return img;
}
[
  ...ASSETS.common,
  ...Object.values(ASSETS.special),
  ...Object.values(ASSETS.bosses),
  ...ASSETS.ships,
].forEach(loadImage);
function drawSprite(img, x, y, w, h) {
  if (!img?.complete || !img.naturalWidth) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}
