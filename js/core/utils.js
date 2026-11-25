"use strict";

/**
 * @file Funções utilitárias usadas pelo jogo todo: matemática, formatação, som,
 * escala da tela e carregamento de imagens.
 */

// ============================================================
// MATEMÁTICA
// ============================================================

/** Número aleatório entre min e max (float). */
function random(min, max) {
  return min + Math.random() * (max - min);
}

/** Inteiro aleatório entre min e max (inclusive). */
function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

/** Limita v ao intervalo [min, max]. */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Dois círculos ({x, y, radius}) se tocam? */
function circlesTouch(a, b) {
  const r = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

/** Diferença entre dois ângulos, normalizada para -π..π (para girar pelo caminho mais curto). */
function angleDelta(from, to) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

// ============================================================
// FORMATAÇÃO
// ============================================================

/** Segundos -> "mm:ss" (ou "h:mm:ss" a partir de 1 hora). */
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * Número curto para a interface: 999, 1.2K, 3.4M, 5B, 1T.
 * Corta (não arredonda) para 1 casa decimal: 1999 → "1.9K", nunca "2.0K".
 */
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
  const truncated = Math.floor(n * 10) / 10;
  return sign + truncated.toString().replace(/\.0$/, "") + units[i];
}

// ============================================================
// TELA E ESCALA
// ============================================================

/**
 * Escala do mundo: nave, asteroides, bosses, tiros e cards acompanham o tamanho da tela.
 * 1 = tela de referência (WORLD_REF). Atualizada em resize() (main.js).
 */
let SCALE = 1;

/** Converte uma medida da tela de referência para a tela atual. */
const px = (value) => value * SCALE;

/**
 * Escala do mundo para uma tela w×h (pixels CSS).
 * - Tela deitada: a altura manda (o mundo tem sempre WORLD_REF.h unidades de altura).
 * - Tela em pé: a largura manda (o mundo tem WORLD_REF.narrowW unidades de largura), senão no
 *   celular tudo ficaria minúsculo para caber uma largura de PC.
 */
function worldScale(w, h) {
  return clamp(Math.min(h / WORLD_REF.h, w / WORLD_REF.narrowW), WORLD_REF.min, WORLD_REF.max) || 1;
}

/**
 * Quanto da arena de referência cabe na tela atual (0,45 a 1). Telas em pé mostram um mundo
 * menor (ex.: celular ≈ 0,6), então cabem menos asteroides ao mesmo tempo sem lotar a arena.
 */
function arenaDensityFactor() {
  const worldArea = (VIEW.w / SCALE) * ((VIEW.h - ARENA_TOP) / SCALE);
  const refArea = WORLD_REF.w * (WORLD_REF.h - ARENA_TOP);
  return clamp(worldArea / refArea, 0.45, 1);
}

/** Máximo de asteroides ao mesmo tempo ajustado ao tamanho da arena (caps até 2 não mudam). */
function fitActiveCap(cap) {
  if (cap <= 2) return cap;
  return Math.max(2, Math.round(cap * arenaDensityFactor()));
}

/** Tamanho atual do canvas em pixels CSS. Atualizado em resize(): ler aqui é grátis. */
const VIEW = { w: 0, h: 0 };

/**
 * Tamanho da área de jogo. Usa o valor guardado no resize() em vez de ler o DOM
 * (ler clientWidth várias vezes por quadro força o navegador a recalcular o layout).
 */
function viewport() {
  return VIEW;
}

/** Monta (sem desenhar) o caminho de um retângulo de cantos arredondados. */
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

// ============================================================
// IMAGENS
// ============================================================

/** Imagens já criadas, por caminho: cada arquivo é carregado uma vez só. */
const imageCache = new Map();

/** Imagem do caminho (criada e cacheada na primeira vez). */
function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return img;
}

/** A imagem já terminou de carregar? */
function imageReady(img) {
  return !!img?.complete && img.naturalWidth > 0;
}

/** Desenha a imagem se ela já carregou. Retorna false se ainda não deu para desenhar. */
function drawSprite(img, x, y, w, h) {
  if (!imageReady(img)) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

// Pré-carrega todas as imagens do jogo
[
  ...ASSETS.common,
  ...Object.values(ASSETS.special),
  ...Object.values(ASSETS.bosses),
  ...ASSETS.ships,
].forEach(loadImage);

// ============================================================
// SINAIS (eventos)
// ============================================================

/**
 * Sinais simples (padrão observer). Classes que emitem eventos herdam daqui:
 * Asteroid, Player, Effect e Hitbox.
 *
 *   const off = objeto.on("destroyed", (payload) => { ... }); // off() cancela
 *   objeto.emit("destroyed", { ... });
 */
class Signals {
  #listeners = new Map();

  /**
   * Escuta um sinal.
   * @param {string} signal nome do sinal
   * @param {(payload: object) => void} callback
   * @returns {() => void} função que cancela a escuta
   */
  on(signal, callback) {
    if (typeof callback !== "function") throw new TypeError("O listener deve ser uma função");
    if (!this.#listeners.has(signal)) this.#listeners.set(signal, new Set());
    this.#listeners.get(signal).add(callback);
    return () => this.#listeners.get(signal)?.delete(callback);
  }

  /** Dispara um sinal para todos os listeners (copia a lista: dá para cancelar durante o disparo). */
  emit(signal, payload = {}) {
    const listeners = this.#listeners.get(signal);
    if (!listeners) return;
    for (const callback of [...listeners]) callback(payload);
  }
}
