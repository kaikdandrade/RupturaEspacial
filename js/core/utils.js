"use strict";

function playTone(freq = 440, duration = 0.04, volume = 0.03, type = "sine") {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.currentTime + duration,
    );
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    /* áudio opcional */
  }
}

// Segundos -> "mm:ss" (ou "h:mm:ss" a partir de 1 hora)
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function money(value) {
  const units = ["", "K", "M", "B", "T"];
  const sign = value < 0 ? "-" : "";
  let n = Math.abs(value);

  if (n < 1000) return sign + Math.floor(n);

  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }

  // Corta (não arredonda) pra 1 casa decimal: 1999 → "1.9k", nunca "2.0k" nem "1000k"
  const truncated = Math.floor(n * 10) / 10;
  return sign + truncated.toString().replace(/\.0$/, "") + units[i];
}

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
    (_, i) => `assets/asteroids/common/asteroid_${i + 1}.png`,
  ),
  special: {
    fractional: "assets/asteroids/special/fractional.png",
    fractionalSlice: "assets/asteroids/special/fractional_slice.png",
    frozen: "assets/asteroids/special/frozen.png",
    mystic: "assets/asteroids/special/mystic.png",
    volcanic: "assets/asteroids/special/volcanic.png",
    golden: "assets/asteroids/special/golden.png", // novo tipo, ainda sem funcionalidade
  },
  bosses: {
    cyber: "assets/asteroids/bosses/cyber.png",
    gravity: "assets/asteroids/bosses/gravity.png",
    gravityAura: "assets/asteroids/bosses/gravity_aura.png",
    resistance: "assets/asteroids/bosses/resistance.png",
    thorny: "assets/asteroids/bosses/thorny.png",
    thornySpike: "assets/asteroids/bosses/thorny_spike.png",
  },
  ships: Array.from(
    { length: 4 },
    (_, i) => `assets/ships/ship_${i + 1}.png`,
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
