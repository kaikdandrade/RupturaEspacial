"use strict";

/**
 * @file Ferramentas de desenho rápido.
 *
 * Por que existe: brilho desfocado (shadowBlur) e reduzir imagens grandes são operações caras
 * para o navegador, e o jogo fazia isso A CADA QUADRO para cada asteroide, tiro e orbe
 * (era o que travava a luta contra o Cibernético). Aqui essas coisas são desenhadas UMA vez
 * num canvas fora da tela e depois só copiadas com drawImage, que é barato.
 */

/** Densidade de pixels dos sprites em cache (a mesma do canvas, até 2). Atualizada no resize(). */
let RENDER_DPR = 1;

/**
 * Teto de pixels do canvas principal (≈ 2560×1600). Pintar a tela inteira todo quadro custa
 * proporcional à área: um monitor 1080p com zoom 200% viraria um canvas 4K (8,3 milhões de
 * pixels) e derrubava o fps pela metade. Acima do teto a densidade é reduzida (ex.: 2 → 1,4).
 */
const MAX_CANVAS_PIXELS = 4_100_000;

/** Densidade de pixels para um canvas de w×h (em pixels CSS), respeitando o teto acima. */
function renderDensity(w, h) {
  const native = Math.min(2, window.devicePixelRatio || 1);
  const budget = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, w * h));
  // Arredonda para 0,05 para não recriar o cache de sprites a cada pixel de redimensionamento
  return Math.max(1, Math.min(native, Math.floor(budget * 20) / 20));
}

/**
 * Cache de sprites pré-renderizados.
 * Cada entrada: { canvas, w, h, size } — w/h é o tamanho NA TELA (com a margem do brilho)
 * e size é o tamanho do sprite usado para gerar a entrada (para corrigir a escala ao desenhar).
 */
class SpriteCache {
  static #cache = new Map();
  /** Limite de entradas (se a tela mudar muito de tamanho, o cache é recomeçado). */
  static MAX_ENTRIES = 500;

  /** Esvazia o cache (ex.: mudou a densidade de pixels da tela). */
  static clear() {
    SpriteCache.#cache.clear();
  }

  /** Cria um canvas fora da tela com tamanho lógico w×h e desenha nele com draw(c). */
  static #render(key, w, h, draw) {
    if (SpriteCache.#cache.size >= SpriteCache.MAX_ENTRIES) SpriteCache.#cache.clear();
    const canvasEl = document.createElement("canvas");
    canvasEl.width = Math.max(1, Math.ceil(w * RENDER_DPR));
    canvasEl.height = Math.max(1, Math.ceil(h * RENDER_DPR));
    const c = canvasEl.getContext("2d");
    c.scale(RENDER_DPR, RENDER_DPR);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    draw(c);
    const entry = { canvas: canvasEl, w, h };
    SpriteCache.#cache.set(key, entry);
    return entry;
  }

  /**
   * Imagem pronta para desenhar: reduzida ao tamanho da tela e, opcionalmente,
   * com brilho em volta (glow) ou toda pintada de uma cor (tint).
   * @param {HTMLImageElement} img
   * @param {number} size maior lado do sprite na tela (px)
   * @param {{ glow?: string, blur?: number, tint?: string }} [options]
   * @returns {{ canvas: HTMLCanvasElement, w: number, h: number, size: number } | null}
   *          null enquanto a imagem não carregou
   */
  static image(img, size, { glow = null, blur = 0, tint = null } = {}) {
    if (!imageReady(img)) return null;
    // Arredonda o tamanho para reaproveitar a mesma entrada em asteroides de tamanho parecido
    const step = size < 64 ? 2 : 4;
    const s = Math.max(step, Math.round(size / step) * step);
    const key = `img|${img.src}|${s}|${glow}|${blur}|${tint}|${RENDER_DPR}`;
    const cached = SpriteCache.#cache.get(key);
    if (cached) return cached;

    const k = s / Math.max(img.naturalWidth, img.naturalHeight);
    const sw = img.naturalWidth * k;
    const sh = img.naturalHeight * k;
    const pad = glow ? Math.ceil(blur * 1.6) : 0;
    const entry = SpriteCache.#render(key, sw + pad * 2, sh + pad * 2, (c) => {
      if (glow) {
        c.shadowColor = glow;
        c.shadowBlur = blur * RENDER_DPR; // shadowBlur ignora a escala do contexto
      }
      c.drawImage(img, pad, pad, sw, sh);
      if (tint) {
        c.shadowBlur = 0;
        c.globalCompositeOperation = "source-atop";
        c.fillStyle = tint;
        c.fillRect(0, 0, sw + pad * 2, sh + pad * 2);
      }
    });
    entry.size = s;
    return entry;
  }

  /**
   * Desenho feito por código (orbes, plasma, cards...) guardado em cache.
   * @param {string} key identificador único do desenho (inclua tamanho e cor)
   * @param {number} w largura na tela
   * @param {number} h altura na tela
   * @param {(c: CanvasRenderingContext2D) => void} draw desenha com a origem no CENTRO
   */
  static shape(key, w, h, draw) {
    const fullKey = `shape|${key}|${RENDER_DPR}`;
    const cached = SpriteCache.#cache.get(fullKey);
    if (cached) return cached;
    const entry = SpriteCache.#render(fullKey, w, h, (c) => {
      c.translate(w / 2, h / 2);
      draw(c);
    });
    entry.size = Math.max(w, h);
    return entry;
  }

  /**
   * Desenha uma entrada do cache centralizada na origem do ctx atual.
   * @param {{ canvas: HTMLCanvasElement, w: number, h: number }} entry
   * @param {number} [scale] escala extra (ex.: tamanho real / tamanho da entrada)
   */
  static drawCentered(entry, scale = 1) {
    if (!entry) return;
    const w = entry.w * scale;
    const h = entry.h * scale;
    ctx.drawImage(entry.canvas, -w / 2, -h / 2, w, h);
  }
}

/**
 * Contorno com brilho barato, no lugar de shadowBlur: passadas largas e transparentes por baixo
 * e a passada normal por cima. Usa o caminho (path) atual do ctx.
 * @param {string} color cor do contorno
 * @param {number} width espessura do contorno
 * @param {{ glow?: number, glowAlpha?: number, soft?: boolean }} [options]
 *   glow: largura total do brilho | glowAlpha: opacidade dele |
 *   soft: brilho em duas camadas (borda esfumada, parecida com o shadowBlur original)
 */
function glowStroke(color, width, { glow = width * 3, glowAlpha = 0.3, soft = false } = {}) {
  ctx.strokeStyle = color;
  const alpha = ctx.globalAlpha;
  if (soft) {
    ctx.globalAlpha = alpha * glowAlpha * 0.45;
    ctx.lineWidth = glow;
    ctx.stroke();
    ctx.globalAlpha = alpha * glowAlpha;
    ctx.lineWidth = width + (glow - width) * 0.45;
    ctx.stroke();
  } else {
    ctx.globalAlpha = alpha * glowAlpha;
    ctx.lineWidth = glow;
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}
