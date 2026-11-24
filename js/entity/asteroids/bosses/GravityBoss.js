"use strict";

/**
 * @file Boss Gravitacional: patrulha o topo da arena e NÃO gera asteroides. A arena gera
 * (BALANCE.bossArena.gravity) e ele rouba: puxa os mais próximos para orbitar em volta
 * (escudo) e arremessa na nave. Perto dele nada congela (ver Effects).
 */
class GravityBoss extends BossAsteroid {
  constructor(config) {
    super({ ...config, type: "gravity" });
    this.rotationSpeed = 0.25;
  }

  get patrols() { return true; }

  resolveSprite() {
    return ASSETS.bosses.gravity;
  }

  /** Quantos asteroides ele segura em órbita (escudo): 4 / 5 / 6 conforme a fase. */
  maxShields() { return 3 + this.phase; }

  /** Asteroides presos na gravidade dele. */
  orbiters() {
    return asteroids.filter((a) => !a.dead && a.orbitHost === this);
  }

  updateBehavior(dt) {
    super.updateBehavior(dt); // fases + timer de ataque
    this.captureAsteroids();
  }

  /**
   * Rouba asteroides da arena: puxa os mais próximos para orbitar em volta dele (escudo).
   * Ele não gera asteroides; quem gera é a arena (BALANCE.bossArena.gravity).
   */
  captureAsteroids() {
    let free = this.maxShields() - this.orbiters().length;
    if (free <= 0) return;
    const distance = (a) => Math.hypot(a.x - this.x, a.y - this.y);
    const candidates = asteroids
      .filter((a) => !a.dead && !a.boss && !a.orbitHost && !a.launched && a.inArena && !(a.entryDelay > 0))
      .sort((a, b) => distance(a) - distance(b));
    for (const a of candidates) {
      if (free-- <= 0) break;
      a.orbitHost = this;
      a.orbitAngle = Math.atan2(a.y - this.y, a.x - this.x);
      a.orbitRadius = distance(a);                       // começa onde está...
      a.orbitTargetRadius = this.radius + px(34 + random(0, 16)); // ...e é puxado até a órbita
      a.orbitSpeed = 1.5;
    }
  }

  /**
   * Ataque: arremessa asteroides da órbita na direção da nave (1 / 2 / 3 conforme a fase),
   * sempre deixando pelo menos 1 como escudo. Sem nada em órbita, não ataca: espera roubar.
   */
  attack() {
    const shields = this.orbiters();
    // Só arremessa se sobrar escudo; sem asteroides suficientes, tenta de novo logo
    const throwable = Math.min(this.phase, shields.length - 1);
    if (throwable <= 0) {
      this.attackTimer = 0.6;
      return;
    }

    const target = player;
    const toPlayer = (a) => Math.hypot(target.x - a.x, target.y - a.y);
    const thrown = shields.sort((a, b) => toPlayer(a) - toPlayer(b)).slice(0, throwable);
    const speed = px(300 + (state.levelConfig?.number ?? 1) * 4);
    for (const a of thrown) {
      const angle = Math.atan2(target.y - a.y, target.x - a.x);
      a.orbitHost = null;
      a.orbitTargetRadius = 0;
      a.launched = true;
      a.vx = Math.cos(angle) * speed;
      a.vy = Math.sin(angle) * speed;
    }
  }

  /** Aura girando (imagem em cache, já no tamanho da tela) + fios até os asteroides presos. */
  drawSpecialEffects() {
    // O buraco do meio da aura tem raio de ~22,8% da imagem: com 2,05× o tamanho do boss,
    // ele encaixa justo em volta do corpo.
    const auraSize = this.size * 2.05;
    const aura = SpriteCache.image(loadImage(ASSETS.bosses.gravityAura), auraSize);
    ctx.save();
    ctx.rotate(-this.age * 0.3);
    ctx.globalAlpha = 0.68;
    SpriteCache.drawCentered(aura, aura ? auraSize / aura.size : 1);
    ctx.restore();

    // Fios de gravidade até os asteroides presos
    ctx.save();
    ctx.lineWidth = 2;
    for (const a of this.orbiters()) {
      const dx = a.x - this.x;
      const dy = a.y - this.y;
      const grad = ctx.createLinearGradient(0, 0, dx, dy);
      grad.addColorStop(0, "rgba(190, 140, 255, .5)");
      grad.addColorStop(1, "rgba(190, 140, 255, 0)");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dx * 0.5 + dy * 0.15, dy * 0.5 - dx * 0.15, dx, dy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

Asteroid.register("gravity", GravityBoss);
