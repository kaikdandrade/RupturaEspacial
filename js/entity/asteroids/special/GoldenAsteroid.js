"use strict";

/**
 * @file Asteroide Dourado: mais resistente e mais rápido. Não dropa card: ao ser destruído
 * pelo jogador dá um bônus grande de pontuação na hora (BALANCE.golden).
 */
class GoldenAsteroid extends Asteroid {
  constructor(config) {
    const g = BALANCE.golden;
    super({
      ...config,
      type: "golden",
      hp: Math.max(1, Math.round((config.hp ?? 3) * g.hpMultiplier)),
      speed: (config.speed ?? 84) * g.speedMultiplier,
    });
  }

  resolveSprite() {
    return ASSETS.special.golden;
  }

  /** Bônus de pontos + chuva de brilhos. */
  onDestroyed(reason) {
    if (reason !== "shot" && reason !== "burn") return;
    const g = BALANCE.golden;
    const bonus = Math.round((g.baseBonus + g.hpBonus * Asteroid.levelHp()) * effects.scoreMultiplier());
    state.playing.score += bonus;
    const info = ASTEROID_INFO.golden;
    spawnFloatingText(this.x, this.y, `${info.name.toUpperCase()} +${bonus}`, info.color);
    this.spawnFxParticles(22, () => [random(0, 1) < 0.5 ? "255, 222, 120" : "255, 245, 200"], {
      speed: [60, 190], life: [0.4, 0.8], size: [2, 3.6],
    });
    playTone(1180, 0.12, 0.035, "triangle");
  }

  /** Brilho dourado pulsando + 3 estrelinhas girando. */
  drawSpecialEffects() {
    const pulse = 0.5 + Math.sin(this.age * 4) * 0.5;
    Asteroid.drawAura(this.radius * 1.6, 0.44, "255, 210, 103", 0.25 + pulse * 0.2);
    ctx.save();
    ctx.fillStyle = "rgba(255, 248, 215, .95)";
    for (let i = 0; i < 3; i++) {
      const a = this.age * 1.3 + (i * Math.PI * 2) / 3;
      const twinkle = 2 + Math.abs(Math.sin(this.age * 5 + i * 2)) * 3;
      Asteroid.drawSparkle(Math.cos(a) * this.radius * 1.15, Math.sin(a) * this.radius * 1.15, twinkle);
    }
    ctx.restore();
  }
}

Asteroid.register("golden", GoldenAsteroid);
