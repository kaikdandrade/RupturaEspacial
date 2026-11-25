"use strict";

/**
 * @file Boss Hidra: cospe ácido (AcidSpit) na nave. Quando a vida de um pedaço ZERA, em vez de
 * morrer ele se divide em dois, cada um com vida cheia (metade da vida máxima do pedaço).
 * São 4 estágios (1 → 2 → 4 → 8 pedaços) e cada estágio soma a vida da Hidra inteira.
 */
class HydraBoss extends BossAsteroid {
  /**
   * Geração 0 = inteira, 1 = metades, 2 = quartos, 3 = oitavos (estes morrem de verdade).
   * Cada pedaço que zera a vida vira dois com vida cheia = metade da vida máxima dele.
   */
  static MAX_GENERATION = 3;
  static SIZE_FACTOR = 0.76;   // cada divisão fica com 76% do tamanho...
  static SPEED_FACTOR = 1.18;  // ...e 18% mais rápida
  static SPLIT_PUSH = 220;     // empurrão que separa as metades (px na tela de referência)

  constructor(config) {
    super({ ...config, type: "hydra" });
    this.generation = config.generation ?? 0;
    this.rotationSpeed = random(-0.25, 0.25);
    this.splitFlash = 0;
  }

  resolveSprite() {
    return ASSETS.bosses.hydra;
  }

  /** Pedaços menores atacam com menos frequência (são vários ao mesmo tempo). */
  attackInterval() {
    const base = this.phase === 3 ? 1.4 : this.phase === 2 ? 1.8 : 2.3;
    return base + this.generation * 0.45;
  }

  /** Vida total da Hidra (todos os estágios), usada na barra de progresso da luta. */
  get totalHp() {
    return this.maxHp * (HydraBoss.MAX_GENERATION - this.generation + 1);
  }

  /** Vida que ainda falta tirar deste pedaço e de todos os que vão nascer dele. */
  remainingHp() {
    return this.hp + this.maxHp * (HydraBoss.MAX_GENERATION - this.generation);
  }

  /** Vida zerada pelo jogador: se ainda pode dividir, divide em vez de morrer. */
  destroy(reason = "shot") {
    const playerKill = reason === "shot" || reason === "burn";
    if (!this.dead && playerKill && this.generation < HydraBoss.MAX_GENERATION) {
      this.split();
      return;
    }
    super.destroy(reason);
  }

  /** Divide em dois: este pedaço encolhe e uma "gêmea" nasce indo para o lado oposto. */
  split() {
    const half = Math.max(1, Math.ceil(this.maxHp / 2));
    const generation = this.generation + 1;
    const size = this.size * HydraBoss.SIZE_FACTOR;
    const angle = random(0, Math.PI * 2);
    const push = px(HydraBoss.SPLIT_PUSH);

    // Este pedaço encolhe e vira uma das metades
    this.generation = generation;
    this.maxHp = half;
    this.hp = half;
    this.setSize(size);
    this.speed *= HydraBoss.SPEED_FACTOR;
    this.vx = Math.cos(angle) * push;
    this.vy = Math.sin(angle) * push;
    this.splitFlash = 0.45;

    // A outra metade nasce no mesmo lugar e vai para o lado oposto
    const twin = new HydraBoss({
      x: this.x, y: this.y, hp: half, speed: this.speed, size, generation,
      entryDelay: 0, isPrimary: false,
    });
    twin.enteredArena = twin.inArena = true;
    twin.vx = -this.vx;
    twin.vy = -this.vy;
    twin.attackTimer = this.attackTimer + 0.6; // não atacam juntas
    twin.splitFlash = 0.45;
    asteroids.push(twin);

    this.spawnFxParticles(26, () => [random(0, 1) < 0.5 ? "125, 255, 95" : "40, 160, 60"], {
      speed: [60, 200], life: [0.35, 0.7], size: [2, 4],
    });
    spawnFloatingText(this.x, this.y - this.radius, "DIVIDIU!", ASTEROID_INFO.hydra.color);
    addShake(4);
  }

  /** Cuspe ácido na nave: a Hidra inteira cospe 1 / 2 / 3 (fase); os pedaços, 1 cada. */
  attack() {
    const count = this.generation === 0 ? this.phase : 1;
    const aim = this.aimAtPlayer();
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.3;
      this.fire(AcidSpit, {
        speed: 200 + this.generation * 35, angle,
        x: this.x + Math.cos(angle) * this.radius * 0.8,
        y: this.y + Math.sin(angle) * this.radius * 0.8,
      });
    }
  }

  update(dt) {
    super.update(dt);
    if (this.dead) return;
    this.splitFlash = Math.max(0, this.splitFlash - dt);
    // Névoa ácida vazando das fendas
    if (this.enteredArena && Math.random() < dt * 6) {
      this.spawnFxParticles(1, () => ["110, 240, 90"], { speed: [8, 26], life: [0.5, 0.9], size: [1.5, 3], spread: 0.8 });
    }
  }

  /** Clarão verde logo depois de se dividir. */
  drawOverSprite() {
    if (this.splitFlash <= 0) return;
    ctx.save();
    ctx.rotate(this.rotation);
    this.drawTint("#b6ff8f", (this.splitFlash / 0.45) * 0.75);
    ctx.restore();
  }

  /** Quando um pedaço morre, o HUD passa a acompanhar outro pedaço vivo. */
  onDestroyed() {
    if (!state.boss || state.boss === this || state.boss.dead) {
      state.boss = asteroids.find((a) => a instanceof HydraBoss && !a.dead && a !== this) ?? null;
    }
  }
}

/** Cuspe ácido da Hidra: gota verde que anda reta, tremendo, com rastro de pingos. */
class AcidSpit extends BossProjectile {
  static KIND = "acid";

  constructor(options) {
    super({ ...options, radius: 10, life: 7 });
  }

  /** Corpo da gota (gradiente + brilho) pré-renderizado. */
  static sprite(r) {
    const w = Math.ceil(r * 1.3 * 2 + 24);
    const h = Math.ceil(r * 1.0 * 2 + 24);
    return SpriteCache.shape(`acid|${r.toFixed(1)}`, w, h, (c) => {
      c.shadowColor = "#7dff4f";
      c.shadowBlur = 14 * RENDER_DPR;
      const body = c.createRadialGradient(r * 0.25, -r * 0.2, 0, 0, 0, r * 1.2);
      body.addColorStop(0, "#eaffc2");
      body.addColorStop(0.35, "#8dff4a");
      body.addColorStop(1, "#1f7a24");
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
      c.fill();
    });
  }

  draw() {
    if (this.dead) return;
    const r = this.radius;
    const t = this.age;
    ctx.save();
    this.drawTrail("110, 230, 70", 0.35, [0.2, 0.65]);

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Gota alongada na direção do movimento, "tremendo"
    const wobble = 1 + Math.sin(t * 18) * 0.08;
    ctx.save();
    ctx.scale(wobble, 1 / wobble);
    SpriteCache.drawCentered(AcidSpit.sprite(r));
    ctx.restore();

    // Bolhinhas
    ctx.fillStyle = "rgba(235, 255, 200, .8)";
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.35, r * (0.1 + i * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

Asteroid.register("hydra", HydraBoss);
