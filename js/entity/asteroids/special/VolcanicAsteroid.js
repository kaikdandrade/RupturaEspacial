"use strict";

/**
 * @file Asteroide Vulcânico: ao ser destruído dropa o card de fogo (efeito "flame":
 * queima todos os asteroides; pegando outro com ele ativo, tudo explode). É imune ao fogo.
 */
class VolcanicAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, type: "volcanic" });
  }

  resolveSprite() {
    return ASSETS.special.volcanic;
  }

  onDestroyed(reason) {
    this.tryDrop(reason);
  }

  /** Anel de calor em volta. */
  drawSpecialEffects() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.07, 0, Math.PI * 2);
    glowStroke("rgba(255, 120, 66, .45)", 1.5, { glow: px(12), glowAlpha: 0.35 });
    ctx.restore();
  }
}

Asteroid.register("volcanic", VolcanicAsteroid);
