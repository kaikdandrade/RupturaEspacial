"use strict";

/**
 * @file Card que cai quando um asteroide especial é destruído pelo jogador.
 * Ao encostar na nave, ativa o efeito correspondente em `effects` (Effects.js).
 * Avisos e sons de cada efeito ficam nos sinais do `effects` ("activated", "evolved"...).
 */
class PickupCard {
  /**
   * Efeito de cada card (nome em Effect.CONFIG, ou uma lista: sorteia um).
   * A cor da borda é a do tipo em ASTEROID_INFO.
   */
  static EFFECTS = {
    frozen: "frozen",
    volcanic: "flame",
    mystic: ["scoreBonus", "quickShot", "speedBoost", "damageBoost", "piercingShot", "invulnerability"],
    electric: "electricShot",
  };

  // Medidas na tela de referência (o card acompanha a escala da tela, com um mínimo
  // para continuar fácil de ver em telas pequenas)
  static SIZE = 56;        // lado do card (quadrado)
  static ICON_SIZE = 40;   // área máxima da imagem do asteroide dentro do card
  static FALL_SPEED = 48;  // px/s
  static MIN_SCALE = 0.7;
  static BLINK_TIME = 2;   // segundos finais em que o card pisca antes de sumir

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} type tipo do asteroide que soltou o card (chave de PickupCard.EFFECTS)
   */
  constructor(x, y, type) {
    if (!PickupCard.EFFECTS[type]) throw new Error(`PickupCard: tipo sem efeito: ${type}`);
    this.x = x;
    this.y = y;
    this.type = type;
    this.scale = Math.max(PickupCard.MIN_SCALE, SCALE);
    this.size = PickupCard.SIZE * this.scale;
    this.radius = this.size * 0.46;
    this.dead = false;
    this.age = 0;
    this.life = BALANCE.cardsLifetime;

    this.hitbox = new Hitbox(this, this.radius);
    this.hitbox.on("enter", ({ group }) => {
      if (group === "player") this.collect();
    });
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;
    this.life -= dt;
    this.y += PickupCard.FALL_SPEED * this.scale * dt;
    this.x += Math.sin(this.age * 3) * 9 * this.scale * dt; // leve balanço lateral

    if (this.life <= 0 || this.y > viewport().h + this.size) this.dead = true;
  }

  /** A nave pegou o card: ativa o efeito (o Effects cuida das evoluções e combinações). */
  collect() {
    if (this.dead) return;
    this.dead = true;
    const options = PickupCard.EFFECTS[this.type];
    effects.activate(Array.isArray(options) ? options[randomInt(0, options.length - 1)] : options);
    playTone(760, 0.09, 0.035, "triangle");
  }

  /** Fundo, borda com brilho e o asteroide do card, desenhados uma vez (cache por tipo e tamanho). */
  static sprite(type, size) {
    const { color } = ASTEROID_INFO[type];
    const img = loadImage(ASSETS.special[type]);
    const pad = 16; // espaço para o brilho em volta
    const s = Math.round(size);
    return SpriteCache.shape(`card|${type}|${s}|${imageReady(img)}`, s + pad * 2, s + pad * 2, (c) => {
      const half = s / 2;
      const r = 12 * (s / PickupCard.SIZE);
      roundedRectPath(-half, -half, s, s, r, c); // (roundRect nativo só no Chrome 99+)
      const gradient = c.createLinearGradient(0, -half, 0, half);
      gradient.addColorStop(0, "rgba(34, 48, 91, .98)");
      gradient.addColorStop(1, "rgba(9, 14, 35, .98)");
      c.shadowColor = color;
      c.shadowBlur = 20 * RENDER_DPR;
      c.fillStyle = gradient;
      c.fill();
      c.shadowBlur = 0;
      c.lineWidth = 2;
      c.strokeStyle = color;
      c.stroke();
      // Asteroide centralizado, mantendo a proporção da imagem
      if (imageReady(img)) {
        const icon = PickupCard.ICON_SIZE * (s / PickupCard.SIZE);
        const fit = Math.min(icon / img.naturalWidth, icon / img.naturalHeight);
        const w = img.naturalWidth * fit;
        const h = img.naturalHeight * fit;
        c.drawImage(img, -w / 2, -h / 2, w, h);
      }
    });
  }

  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.age * 4) * 4 * this.scale);
    // Pisca nos últimos segundos de vida
    if (this.life < PickupCard.BLINK_TIME) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(this.age * 10));
    SpriteCache.drawCentered(PickupCard.sprite(this.type, this.size), 0.92 + Math.sin(this.age * 5) * 0.06);
    ctx.restore();
  }
}
