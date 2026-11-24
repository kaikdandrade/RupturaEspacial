"use strict";

/**
 * @file Boss Cibernético: patrulha o topo da arena, gira o corpo para manter o olho
 * travado na nave e dispara orbes de energia teleguiados (CyberOrb) saindo do olho.
 */
class CyberBoss extends BossAsteroid {
  /** Posição do olho no sprite (fração da imagem). */
  static EYE = { x: 0.749, y: 0.473 };
  /** Ângulo do olho em relação ao centro do sprite. */
  static EYE_ANGLE = Math.atan2(CyberBoss.EYE.y - 0.5, CyberBoss.EYE.x - 0.5);
  /** Velocidade (rad/s) com que o corpo gira para acompanhar a nave. */
  static TURN_SPEED = 3.2;

  constructor(config) {
    super({ ...config, type: "cyber" });
    this.rotationSpeed = 0; // não gira à toa: só para mirar
    this.rotation = this.targetRotation();
  }

  get patrols() { return true; }

  resolveSprite() {
    return ASSETS.bosses.cyber;
  }

  /** Rotação em que o olho do sprite aponta para a nave. */
  targetRotation() {
    return this.aimAtPlayer() - CyberBoss.EYE_ANGLE;
  }

  update(dt) {
    super.update(dt);
    if (this.dead) return;
    // Gira suavemente até o olho encarar a nave (o gelo desacelera o giro também)
    const turn = CyberBoss.TURN_SPEED * dt * effects.asteroidSpeedMultiplier(this);
    this.rotation += clamp(angleDelta(this.rotation, this.targetRotation()), -turn, turn);
  }

  /** Posição do olho no mundo (o tiro sai dele). */
  eyePosition() {
    const { EYE } = CyberBoss;
    const box = this.spriteBox();
    const ox = (EYE.x - 0.5) * box.w;
    const oy = (EYE.y - 0.5) * box.h;
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
    return { x: this.x + ox * c - oy * s, y: this.y + ox * s + oy * c };
  }

  /** Orbes teleguiados duram: ataques mais espaçados que os outros bosses. */
  attackInterval() {
    return this.phase === 3 ? 1.6 : this.phase === 2 ? 2 : 2.6;
  }

  /** Orbes saindo do olho: 1 / 2 / 3 conforme a fase, em leque. */
  attack() {
    const count = this.phase;
    const aim = this.aimAtPlayer();
    const eye = this.eyePosition();
    for (let i = 0; i < count; i++) {
      this.fire(CyberOrb, { speed: 170, angle: aim + (i - (count - 1) / 2) * 0.35, x: eye.x, y: eye.y });
    }
  }
}

/** Orbe de energia do Cibernético: persegue a nave (curva limitada) e some em 5 segundos. */
class CyberOrb extends BossProjectile {
  static KIND = "cyber";
  /** Quanto o orbe consegue virar por segundo (rad/s) para perseguir a nave. */
  static TURN_RATE = 1.2;

  constructor(options) {
    super({ ...options, radius: 10, life: 5 });
  }

  steer(dt) {
    const desired = Math.atan2(player.y - this.y, player.x - this.x);
    const turn = CyberOrb.TURN_RATE * dt;
    this.angle += clamp(angleDelta(this.angle, desired), -turn, turn);
  }

  /** Halo + anel + núcleo pré-renderizados (era o desenho mais caro do jogo, com 2 desfoques por orbe). */
  static sprite(r) {
    const size = Math.ceil(r * 2.4 * 1.12) * 2;
    return SpriteCache.shape(`cyberOrb|${r.toFixed(1)}`, size, size, (c) => {
      const halo = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      halo.addColorStop(0, "rgba(120, 230, 255, .55)");
      halo.addColorStop(0.45, "rgba(40, 140, 255, .25)");
      halo.addColorStop(1, "rgba(20, 80, 255, 0)");
      c.fillStyle = halo;
      c.beginPath();
      c.arc(0, 0, r * 2.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(120, 220, 255, .7)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      c.stroke();
      c.shadowColor = "#7fe8ff";
      c.shadowBlur = 12 * RENDER_DPR;
      const core = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.75);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.5, "#b8f4ff");
      core.addColorStop(1, "rgba(80, 200, 255, .2)");
      c.fillStyle = core;
      c.beginPath();
      c.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      c.fill();
    });
  }

  /** Rastro, corpo pulsando (do cache) e raios elétricos girando. */
  draw() {
    if (this.dead) return;
    const r = this.radius;
    const t = this.age;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawTrail("60, 170, 255", 0.22, [0.35, 0.9]);

    ctx.translate(this.x, this.y);
    SpriteCache.drawCentered(CyberOrb.sprite(r), 1 + Math.sin(t * 14) * 0.12);

    // Raios elétricos (3 arcos tremidos girando)
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(200, 245, 255, .85)";
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a0 = t * 6 + (i * Math.PI * 2) / 3;
      for (let j = 0; j <= 4; j++) {
        const a = a0 + j * 0.32;
        const rr = r * (1.05 + ((j * 37 + Math.floor(t * 20) * 13 + i * 7) % 5) * 0.08);
        if (j === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

Asteroid.register("cyber", CyberBoss);
