"use strict";

/**
 * @file Asteroide Elétrico: ao ser destruído dropa o card de raio (efeito "electricShot": cada
 * tiro que acerta solta um raio que pula para os vizinhos). Combinações (Tempestade, Supercondutor,
 * Sobrecarga): Effects.js.
 */
class ElectricAsteroid extends Asteroid {
  /** Duração (s) de cada faísca na borda. */
  static ARC_LIFE = 0.12;

  constructor(config) {
    super({ ...config, type: "electric" });
    this.sparkTimer = 0;
    /** Faíscas na borda (só visual): { start, span, life, seed } */
    this.arcs = [];
  }

  resolveSprite() {
    return ASSETS.special.electric;
  }

  onDestroyed(reason) {
    this.tryDrop(reason);
  }

  update(dt) {
    super.update(dt);
    if (this.dead) return;
    for (const arc of this.arcs) arc.life -= dt;
    this.arcs = this.arcs.filter((arc) => arc.life > 0);
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = random(0.12, 0.35);
      this.arcs.push({ start: random(0, Math.PI * 2), span: random(0.5, 1.1), life: ElectricAsteroid.ARC_LIFE, seed: Math.random() * 1000 });
    }
  }

  /** Faíscas elétricas pulando na borda. */
  drawSpecialEffects() {
    ctx.save();
    ctx.lineCap = "round";
    const width = Math.max(1, px(1.6));
    for (const arc of this.arcs) {
      ctx.globalAlpha = clamp(arc.life / ElectricAsteroid.ARC_LIFE, 0, 1);
      ctx.beginPath();
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const a = arc.start + (arc.span * i) / steps;
        const jitter = i === 0 || i === steps ? 0 : (Math.sin(arc.seed + i * 12.9) * 0.5 + 0.5) * this.radius * 0.35;
        const r = this.radius * 1.02 + jitter;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      glowStroke(arc.seed % 2 > 1 ? "#fff6b0" : "#9ff3ff", width, { glow: width * 4, glowAlpha: 0.3 });
    }
    ctx.restore();
  }
}

Asteroid.register("electric", ElectricAsteroid);
