"use strict";

/**
 * @file Boss Espinhoso: anda livre na parte de cima da arena e enche a tela de espinhos
 * (ThornSpike) em três padrões. Os espinhos sofrem o gelo (ficam lentos ou param) e
 * quebram no BLEVE.
 */
class ThornyBoss extends BossAsteroid {
  /**
   * Três ataques, em sequência (mais agressiva a cada fase):
   * - crown  (coroa):   anel de espinhos que voa para fora, CRAVA no ar, vira a ponta para a
   *                     nave e dispara em sequência. Deixa um "campo minado" momentâneo.
   * - spiral (espiral): gira soltando espinhos sem parar (2 braços na fase 3).
   * - aimed  (rajada):  3 espinhos rápidos mirados na nave, um atrás do outro.
   */
  static SEQUENCES = {
    1: ["crown", "aimed"],
    2: ["crown", "spiral", "aimed"],
    3: ["crown", "spiral", "crown", "aimed"],
  };

  constructor(config) {
    super({ ...config, type: "thorny" });
    this.patternIndex = 0;
    this.spiralState = null; // { time, timer, angle, arms }
    this.burstState = null;  // { left, timer }
    this.baseRotationSpeed = this.rotationSpeed;
  }

  resolveSprite() {
    return ASSETS.bosses.thorny;
  }

  /** Ataques mais espaçados que os outros bosses: cada um enche a tela de espinhos. */
  attackInterval() {
    return this.phase === 3 ? 1.7 : this.phase === 2 ? 2.1 : 2.6;
  }

  /** Velocidade dos espinhos cresce com o setor (até +60 px/s). */
  spikeSpeed(base) {
    return base + Math.min(60, (state.levelConfig?.number ?? 1) * 2);
  }

  /** Ponto na borda do boss na direção do ângulo (o espinho nasce "saindo" do corpo). */
  edge(angle, factor = 0.85) {
    return { x: this.x + Math.cos(angle) * this.radius * factor, y: this.y + Math.sin(angle) * this.radius * factor };
  }

  /** Próximo padrão da sequência da fase atual. */
  attack() {
    const sequence = ThornyBoss.SEQUENCES[this.phase] ?? ThornyBoss.SEQUENCES[1];
    const pattern = sequence[this.patternIndex++ % sequence.length];
    this[pattern]();
  }

  /** Coroa: anel de espinhos que cravam no ar e disparam um depois do outro. */
  crown() {
    const count = 4 + this.phase * 2; // 6 / 8 / 10
    const offset = random(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      this.fire(ThornSpike, {
        angle, speed: 260, ...this.edge(angle),
        stake: {
          decel: 470,                        // freia até parar (~0,55s)
          hold: 0.75 + i * (0.5 / count),    // cada um dispara um pouco depois do outro
          relaunchSpeed: this.spikeSpeed(330),
        },
      });
    }
  }

  /** Espiral: começa a soltar espinhos girando (continua em updateBehavior). */
  spiral() {
    this.spiralState = { time: 1.4, timer: 0, angle: random(0, Math.PI * 2), arms: this.phase === 3 ? 2 : 1 };
  }

  /** Rajada: 3 espinhos rápidos mirados na nave (continua em updateBehavior). */
  aimed() {
    this.burstState = { left: 3, timer: 0 };
  }

  updateBehavior(dt) {
    super.updateBehavior(dt);

    // Espiral: um espinho a cada 0,08s, girando
    if (this.spiralState) {
      const sp = this.spiralState;
      sp.time -= dt;
      sp.timer -= dt;
      this.rotationSpeed = 5; // o boss gira rápido enquanto solta a espiral
      while (sp.timer <= 0 && sp.time > 0) {
        sp.timer += 0.08;
        sp.angle += 0.42;
        for (let arm = 0; arm < sp.arms; arm++) {
          const angle = sp.angle + (arm * Math.PI * 2) / sp.arms;
          this.fire(ThornSpike, { angle, speed: this.spikeSpeed(210), ...this.edge(angle) });
        }
      }
      if (sp.time <= 0) {
        this.spiralState = null;
        this.rotationSpeed = this.baseRotationSpeed;
      }
    }

    // Rajada mirada: 3 espinhos, um a cada 0,14s
    if (this.burstState) {
      this.burstState.timer -= dt;
      if (this.burstState.timer <= 0) {
        this.burstState.timer = 0.14;
        this.burstState.left--;
        const angle = this.aimAtPlayer();
        this.fire(ThornSpike, { angle, speed: this.spikeSpeed(380), ...this.edge(angle) });
        if (this.burstState.left <= 0) this.burstState = null;
      }
    }
  }
}


/**
 * Espinho do Espinhoso. Com `stake` ele sai do boss, freia, CRAVA no ar, vira a ponta
 * para a nave tremendo (aviso) e dispara: out -> hold -> launch.
 */
class ThornSpike extends BossProjectile {
  static KIND = "thorn";
  static TRAIL = 0;
  /** Na arte, a ponta do espinho aponta para cima. */
  static TIP_ANGLE = -Math.PI / 2;
  /** Comprimento do espinho na tela de referência (maior lado da imagem). */
  static LENGTH = 50;
  /** Segundos finais do "cravado" em que ele treme e brilha em vermelho. */
  static WARN_TIME = 0.6;

  /**
   * @param {object} options opções de BossProjectile +
   * @param {{ decel: number, hold: number, relaunchSpeed: number }} [options.stake]
   *   freio (px/s²), tempo cravado (s) e velocidade do disparo (px/s), na tela de referência
   */
  constructor({ stake = null, ...options }) {
    super({ ...options, radius: 9, life: stake ? 10 : 7 });
    this.stake = stake ? { ...stake, decel: px(stake.decel), relaunchSpeed: px(stake.relaunchSpeed) } : null;
    this.state = stake ? "out" : "fly";
    this.holdTimer = 0;
    this.image = loadImage(ASSETS.bosses.thornySpike);
  }

  get affectedByEffects() { return true; }

  steer(dt, sdt) {
    if (this.state === "out") {
      // Freando até parar no ar
      this.speed = Math.max(0, this.speed - this.stake.decel * sdt);
      if (this.speed <= 1) {
        this.speed = 0;
        this.state = "hold";
        this.holdTimer = this.stake.hold;
      }
    } else if (this.state === "hold") {
      // Cravado: vira a ponta devagar para a nave e depois dispara
      this.holdTimer -= sdt;
      const desired = Math.atan2(player.y - this.y, player.x - this.x);
      this.angle += clamp(angleDelta(this.angle, desired), -7 * sdt, 7 * sdt);
      if (this.holdTimer <= 0) {
        this.state = "launch";
        this.angle = desired;
        this.speed = this.stake.relaunchSpeed;
      }
    }
  }

  /** Quebra o espinho (BLEVE): some com estilhaços. */
  shatter() {
    if (this.dead) return;
    this.dead = true;
    for (let i = 0; i < 8; i++) {
      const a = random(0, Math.PI * 2);
      const v = random(60, 170);
      const life = random(0.25, 0.5);
      particles.push({
        x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        size: random(1.6, 3), color: i % 2 ? "rgba(255, 190, 120, .9)" : "rgba(200, 120, 80, .9)",
        life, maxLife: life,
      });
    }
  }

  draw() {
    if (this.dead) return;
    const length = px(ThornSpike.LENGTH);
    const sprite = SpriteCache.image(this.image, length);
    ctx.save();
    ctx.translate(this.x, this.y);

    // Cravado: treme cada vez mais perto de disparar + brilho vermelho de aviso
    let warn = 0;
    if (this.state === "hold") {
      warn = clamp(1 - this.holdTimer / ThornSpike.WARN_TIME, 0, 1);
      const shake = warn * 1.8;
      ctx.translate(random(-shake, shake), random(-shake, shake));
    }
    ctx.rotate(this.angle - ThornSpike.TIP_ANGLE);

    if (!sprite) {
      ctx.fillStyle = "#e0a070";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const scale = length / sprite.size;
    if (warn > 0) {
      ctx.globalAlpha = warn;
      SpriteCache.drawCentered(SpriteCache.image(this.image, length, { glow: "#ff4d4d", blur: px(14) }), scale);
      ctx.globalAlpha = 1;
    }
    SpriteCache.drawCentered(sprite, scale);

    // Gelo por cima quando os efeitos de frio estão ativos
    const speed = effects.projectileSpeedMultiplier();
    const frozenSolid = speed === 0;        // parado (freeze sem o Gravitacional por perto)
    const chilled = speed > 0 && speed < 1; // só lento
    if (frozenSolid || chilled) {
      ctx.globalAlpha = frozenSolid ? 0.6 : 0.32;
      SpriteCache.drawCentered(SpriteCache.image(this.image, length, { tint: frozenSolid ? "#c8f3ff" : "#8fdcff" }), scale);
      ctx.globalAlpha = 1;
      if (frozenSolid) {
        ctx.strokeStyle = "rgba(235, 252, 255, .8)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, sprite.w * scale * 0.62, sprite.h * scale * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

Asteroid.register("thorny", ThornyBoss);
