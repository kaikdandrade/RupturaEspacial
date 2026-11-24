"use strict";

/**
 * @file Asteroide Místico: ao ser destruído dropa um card com um buff aleatório para a nave
 * (pontos extras, tiro rápido, velocidade, dano extra, tiro perfurante ou invulnerabilidade).
 */
class MysticAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, type: "mystic" });
  }

  resolveSprite() {
    return ASSETS.special.mystic;
  }

  onDestroyed(reason) {
    this.tryDrop(reason);
  }

  /** Anel roxo pulsando. */
  drawSpecialEffects() {
    ctx.save();
    ctx.strokeStyle = `rgba(188, 134, 255, ${0.35 + Math.sin(this.age * 3) * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

Asteroid.register("mystic", MysticAsteroid);
