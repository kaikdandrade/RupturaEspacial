"use strict";

/**
 * Card que cai quando um asteroide especial é destruído.
 * Ao encostar na nave, ativa o efeito correspondente em `effects` (Effects.js).
 *
 * Interface usada pelo jogo: new PickupCard(x, y, type), update(dt), draw(), dead, hitbox.
 * Avisos/sons de cada efeito ficam nos eventos do `effects` ("activated", "evolved"...).
 */
class PickupCard {
  /**
   * Um registro por tipo de asteroide especial que dropa card.
   * - effect: nome do efeito em Effect.CONFIG, ou uma lista (sorteia um).
   * - color: cor da borda e do brilho.
   */
  static TYPES = {
    frozen: { effect: "frozen", color: "#78e7ff" },
    volcanic: { effect: "flame", color: "#ff8c5c" },
    mystic: {
      effect: ["scoreBonus", "quickShot", "speedBoost", "damageBoost", "piercingShot", "invulnerability"],
      color: "#bd86ff",
    },
  };

  static SIZE = 56;          // lado do card (quadrado)
  static ICON_SIZE = 40;     // área máxima da imagem do asteroide dentro do card
  static FALL_SPEED = 48;    // px/s
  static BLINK_TIME = 2;     // segundos finais em que o card pisca antes de sumir

  constructor(x, y, type) {
    const config = PickupCard.TYPES[type];
    if (!config) throw new Error(`PickupCard: tipo sem configuração: ${type}`);

    this.x = x;
    this.y = y;
    this.type = type;
    this.config = config;
    this.size = PickupCard.SIZE;
    this.radius = this.size * 0.46;
    this.dead = false;
    this.age = 0;
    this.life = BALANCE.cardsLifetime;
    this.image = loadImage(ASSETS.special[type]);

    this.hitbox = new Hitbox(this, this.radius);
    this.hitbox.on("enter", ({ group }) => {
      if (group === "player") this.collect();
    });
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;
    this.life -= dt;
    this.y += PickupCard.FALL_SPEED * dt;
    this.x += Math.sin(this.age * 3) * 9 * dt; // leve balanço lateral

    if (this.life <= 0 || this.y > viewport().h + this.size) this.dead = true;
  }

  /** Ativa o efeito do card. Retorna o nome do efeito aplicado (pode ser uma evolução). */
  collect() {
    if (this.dead) return null;
    this.dead = true;

    const { effect: options } = this.config;
    const name = Array.isArray(options) ? options[randomInt(0, options.length - 1)] : options;
    const applied = effects.activate(name);

    playTone(760, 0.09, 0.035, "triangle");
    return applied;
  }

  draw() {
    if (this.dead) return;
    const { size, config } = this;
    const half = size / 2;

    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.age * 4) * 4);
    const pulse = 0.92 + Math.sin(this.age * 5) * 0.06;
    ctx.scale(pulse, pulse);

    // Pisca nos últimos segundos de vida
    if (this.life < PickupCard.BLINK_TIME) {
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(this.age * 10));
    }

    // Fundo
    roundedRectPath(-half, -half, size, size, 12);
    const gradient = ctx.createLinearGradient(0, -half, 0, half);
    gradient.addColorStop(0, "rgba(34, 48, 91, .98)");
    gradient.addColorStop(1, "rgba(9, 14, 35, .98)");
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = gradient;
    ctx.fill();

    // Borda
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = config.color;
    ctx.stroke();

    // Asteroide centralizado, mantendo a proporção da imagem
    const img = this.image;
    if (img?.naturalWidth) {
      const fit = Math.min(PickupCard.ICON_SIZE / img.naturalWidth, PickupCard.ICON_SIZE / img.naturalHeight);
      const w = img.naturalWidth * fit;
      const h = img.naturalHeight * fit;
      drawSprite(img, -w / 2, -h / 2, w, h);
    }

    ctx.restore();
  }
}
