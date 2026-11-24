"use strict";

/**
 * @file Boss Resistente: o tanque. Lento, com uma armadura (placas em anel) que absorve o
 * dano antes da vida e se regenera aos poucos. A luta é longa, então a arena ajuda com
 * asteroides e especiais (BALANCE.bossArena.resistance).
 */
class ResistanceBoss extends BossAsteroid {
  static PLATES = 12; // placas da armadura em volta do boss

  constructor(config) {
    super({ ...config, type: "resistance" });
    this.maxArmor = Math.max(6, Math.ceil(this.maxHp * 0.5));
    this.armor = this.maxArmor;
    this.armorFlash = 0;   // brilho ao absorver um tiro
    this.armorPulse = 0;   // onda ao regenerar
    this.on("armorDamaged", () => { this.armorFlash = 0.18; });
  }

  resolveSprite() {
    return ASSETS.bosses.resistance;
  }

  /** O tanque é lento: o desafio é a resistência, não a velocidade. */
  get speedFactor() { return 0.55; }

  /** Ao mudar de fase, a armadura volta a pelo menos 38%. */
  onPhaseChanged() { this.armor = Math.max(this.armor, Math.ceil(this.maxArmor * 0.38)); }

  update(dt) {
    super.update(dt);
    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this.armorPulse = Math.max(0, this.armorPulse - dt);
  }

  /** Regenera a armadura com menos frequência que os outros bosses atacam. */
  attackInterval() {
    return this.phase === 3 ? 1.5 : this.phase === 2 ? 2 : 2.6;
  }

  attack() {
    // Diferente dos outros bosses, recupera parcialmente sua armadura (5% por pulso).
    const before = this.armor;
    this.armor = Math.min(this.maxArmor, this.armor + Math.ceil(this.maxArmor * 0.05));
    if (this.armor > before) this.armorPulse = 0.6;
  }

  /** Placas de energia em anel: acesas proporcionalmente à armadura restante. */
  drawArmor() {
    const plates = ResistanceBoss.PLATES;
    const ratio = this.maxArmor > 0 ? this.armor / this.maxArmor : 0;
    const lit = this.armor > 0 ? Math.max(1, Math.ceil(ratio * plates)) : 0;
    const thickness = this.radius * 0.16;
    const r = this.size * 0.5 + thickness * 0.7; // logo depois da borda do sprite
    const gap = 0.07;
    const spin = this.age * 0.35;
    const flash = this.armorFlash / 0.18;

    ctx.save();

    // Bolha de energia enquanto houver armadura
    if (lit > 0) {
      const bubble = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, r + thickness);
      bubble.addColorStop(0, "rgba(110, 230, 255, 0)");
      bubble.addColorStop(1, `rgba(110, 230, 255, ${0.1 + ratio * 0.12 + flash * 0.25})`);
      ctx.fillStyle = bubble;
      ctx.beginPath();
      ctx.arc(0, 0, r + thickness, 0, Math.PI * 2);
      ctx.fill();
    }

    // Brilho das placas acesas: um anel largo e transparente (barato) no lugar do desfoque
    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 + flash * 0.25;
      ctx.strokeStyle = "#6ee6ff";
      ctx.lineWidth = thickness * 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r, spin, spin + (lit / plates) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Placas
    for (let i = 0; i < plates; i++) {
      const start = spin + (i / plates) * Math.PI * 2 + gap;
      const end = spin + ((i + 1) / plates) * Math.PI * 2 - gap;
      const on = i < lit;
      ctx.beginPath();
      ctx.arc(0, 0, r + thickness / 2, start, end);
      ctx.arc(0, 0, r - thickness / 2, end, start, true);
      ctx.closePath();
      if (on) {
        ctx.fillStyle = flash > 0 ? `rgba(235, 252, 255, ${0.55 + flash * 0.4})` : "rgba(110, 230, 255, .55)";
        ctx.fill();
        ctx.strokeStyle = "rgba(225, 250, 255, .9)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Placa quebrada: só o contorno apagado
        ctx.strokeStyle = "rgba(110, 230, 255, .18)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Onda de regeneração
    if (this.armorPulse > 0) {
      const k = 1 - this.armorPulse / 0.6;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(0, 0, r + thickness + k * this.radius * 0.8, 0, Math.PI * 2);
      glowStroke("#9ff0ff", 3, { glow: 12, glowAlpha: 0.35 });
    }
    ctx.restore();
  }
}

Asteroid.register("resistance", ResistanceBoss);
