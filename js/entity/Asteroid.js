"use strict";

class AsteroidSignals {
  #listeners = new Map();

  on(signal, callback) {
    if (typeof callback !== "function") throw new TypeError("O listener deve ser uma função");
    if (!this.#listeners.has(signal)) this.#listeners.set(signal, new Set());
    this.#listeners.get(signal).add(callback);
    return () => this.#listeners.get(signal)?.delete(callback);
  }

  emit(signal, payload = {}) {
    // Copia os listeners para permitir remoção segura durante a emissão.
    for (const callback of [...(this.#listeners.get(signal) || [])]) callback(payload);
  }

  clearListeners() { this.#listeners.clear(); }
}

class Asteroid extends AsteroidSignals {
  static DESTROY_SHAKE_BOSS = 2.0;

  // Poeira da destruição. Valores em segundos (0.20 = 200 ms).
  // Ajuste aqui para alterar o tempo e a intensidade do efeito.
  static DUST_LIFE_MIN = 0.20;
  static DUST_LIFE_MAX = 0.42;
  static DUST_MAX_ACTIVE = 380;

  constructor({ x, y, hp, speed, type, size, child, boss = false, helper = false, isPrimary = true, entryDelay } = {}) {
    super();
    if (!Number.isFinite(x)) throw new Error("Asteroid requer uma posição x válida");

    this.x = x;
    this.y = y;
    this.type = type;
    this.boss = !!boss;
    this.child = !!child;
    this.helper = !!helper;
    this.isPrimary = !!isPrimary;
    this.maxHp = Math.max(1, Math.round(Number.isFinite(hp) ? hp : 3));
    this.hp = this.maxHp;
    this.speed = Math.max(1, Number.isFinite(speed) ? speed : 84);
    this.size = size ?? random(55, 79);
    this.radius = this.size * 0.37;
    this.rotation = random(0, Math.PI * 2);
    this.rotationSpeed = random(-0.75, 0.75);
    this.dead = false;
    this.age = 0;
    this.entryDelay = Math.max(0, entryDelay);
    this.enteredArena = y >= 82 + this.radius;
    this.armor = 0;
    this.maxArmor = 0;
    this.burnTicks = 0;
    this.burnCountdown = 0;

    this.orbitHost = null;
    this.orbitAngle = 0;
    this.orbitRadius = 0;
    this.orbitSpeed = 0;

    const angle = random(Math.PI * 0.22, Math.PI * 0.78);
    this.vx = Math.cos(angle) * this.speed * random(0.68, 1.02);
    this.vy = Math.sin(angle) * this.speed * random(0.82, 1.08);

    this.image = loadImage(this.resolveSprite());
    this.hitbox = new Hitbox(this, (this.radius + 3));
    this.hitbox.on("enter", ({ other, group }) => {
      if (this.dead || this.entryDelay > 0 || !this.enteredArena) return;
      if (group === "bullets" && other && !other.dead) {
        other.dead = true;
        this.hit(other.damage ?? 1, "shot");
      }
      if (group === "player" && other && !other.dead) {
        this.emit("touchPlayer", { asteroid: this, player: other });
      }
    });
    // Se a nave continuar encostada, o jogo decide quando aplicar dano novamente.
    this.hitbox.on("stay", ({ other, group }) => {
      if (!this.dead && group === "player" && this.enteredArena && other && !other.dead) {
        this.emit("touchPlayer", { asteroid: this, player: other });
      }
    });
  }

  static create(config = {}) {
    const type = config.type === "commom" ? "common" : (config.type || "common");
    const types = {
      common: CommonAsteroid, frozen: FrozenAsteroid, volcanic: VolcanicAsteroid,
      mystic: MysticAsteroid, fractional: FractionalAsteroid,
      fractionalSlice: FractionalSliceAsteroid, resistance: ResistanceBoss,
      cyber: CyberBoss, gravity: GravityBoss, thorny: ThornyBoss,
    };
    const ClassType = types[type] || CommonAsteroid;
    return new ClassType({ ...config, type });
  }

  resolveSprite() { return ASSETS.common[0]; }

  setSize(size, radiusFactor = 0.37) {
    this.size = size;
    this.radius = size * radiusFactor;
    this.hitbox.radius = this.radius;
    return this;
  }

  applyBurn(ticks = 5) {
    if (this.dead) return;
    this.burnTicks = Math.max(this.burnTicks, ticks);
    this.burnCountdown = Math.min(this.burnCountdown || 0.52, 0.52);
  }

  updateBurn(dt) {
    if (!this.burnTicks) return;
    this.burnCountdown -= dt;
    if (this.burnCountdown > 0) return;
    this.burnCountdown += 0.52;
    this.burnTicks -= 1;
    this.hit(1, "burn");
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;
    this.rotation += this.rotationSpeed * dt;
    this.updateBurn(dt);
    if (this.dead) return;
    if (this.entryDelay > 0) {
      this.entryDelay = Math.max(0, this.entryDelay - dt);
      return;
    }

    if (this.orbitHost) {
      if (!this.orbitHost.dead) {
        this.orbitAngle += this.orbitSpeed * dt;
        this.x = this.orbitHost.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = this.orbitHost.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.updateBehavior(dt);
        return;
      }
      this.orbitHost = null;
    }

    const slow = typeof state !== "undefined" && state.effects?.asteroidSlowUntil > state.time
      ? 0.5 : 1;
    this.updateMovement(dt * slow);
    if (this.enteredArena) this.updateBehavior(dt);
  }

  updateMovement(dt) {
    if (!this.enteredArena) {
      this.y += this.speed * 1.12 * dt;
      this.x += this.vx * 0.16 * dt;
      if (this.y >= 82 + this.radius) this.enteredArena = true;
      return;
    }

    const { w, h } = viewport();
    const padding = this.getArenaPadding();
    const top = 82 + this.radius + padding;
    const bottom = Math.max(top, h - 14 - this.radius - padding);
    const left = 10 + this.radius + padding;
    const right = Math.max(left, w - 10 - this.radius - padding);
    const band = Math.min(125, Math.max(72, Math.min(w, h) * 0.14));
    const force = this.boss ? 310 : 255;
    let ax = 0, ay = 0;

    if (this.x - left < band) ax += (1 - (this.x - left) / band) * force;
    if (right - this.x < band) ax -= (1 - (right - this.x) / band) * force;
    if (this.y - top < band) ay += (1 - (this.y - top) / band) * force;
    if (bottom - this.y < band) ay -= (1 - (bottom - this.y) / band) * force;
    this.applyCustomSteering(dt);
    this.vx += ax * dt;
    this.vy += ay * dt;

    const current = Math.hypot(this.vx, this.vy) || 1;
    const target = this.speed * (this.boss ? 0.86 : 1);
    const adjustment = clamp((target - current) * dt * 1.8, -24, 24);
    this.vx += (this.vx / current) * adjustment;
    this.vy += (this.vy / current) * adjustment;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < left - 12) { this.x = left - 12; this.vx = Math.abs(this.vx) * 0.55; }
    if (this.x > right + 12) { this.x = right + 12; this.vx = -Math.abs(this.vx) * 0.55; }
    if (this.y < top - 12) { this.y = top - 12; this.vy = Math.abs(this.vy) * 0.55; }
    if (this.y > bottom + 12) { this.y = bottom + 12; this.vy = -Math.abs(this.vy) * 0.55; }
  }

  getArenaPadding() { return 0; }
  applyCustomSteering(dt) { }
  updateBehavior(dt) { }
  onDamaged(amount, source) { }
  onDestroyed(reason) { }
  drawSpecialEffects() { }

  hit(damage, source = "shot") {
    if (this.dead) return;
    let amount = Math.max(0, Math.round(Number(damage) || 0));
    if (!amount) return;
    if (this.armor > 0) {
      const blocked = Math.min(amount, this.armor);
      this.armor -= blocked;
      amount -= blocked;
      this.emit("armorDamaged", { asteroid: this, amount: blocked, armor: this.armor });
    }
    if (amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.onDamaged(amount, source);
    this.emit("damaged", { asteroid: this, amount, source, hp: this.hp });
    if (this.hp === 0) this.destroy(source);
  }

  /**
 * Solta uma nuvem curta de poeira, reaproveitando o array `particles` do jogo.
 * game_loop.js já move, desacelera, desenha e desvanece essas partículas.
 * Não é necessário alterar outros arquivos para o efeito funcionar.
 */
  spawnDust() {
    if (typeof particles === "undefined" || !Array.isArray(particles)) return;

    // Uma cor sutil para cada tipo, sem efeito luminoso de explosão.
    const colors = {
      common: [155, 154, 153],
      frozen: [160, 202, 222],
      volcanic: [173, 113, 92],
      mystic: [162, 138, 199],
      fractional: [156, 153, 171],
      fractionalSlice: [156, 153, 171],
      cyber: [123, 174, 197],
      gravity: [155, 133, 185],
      thorny: [146, 169, 126],
      resistance: [170, 160, 123],
    };
    const base = colors[this.type] || colors.common;
    const count = this.boss ? 46 : this.child ? 9 : Math.round(clamp(this.size * 0.28, 15, 24));
    const available = Math.min(count, Math.max(0, Asteroid.DUST_MAX_ACTIVE - particles.length));

    for (let i = 0; i < available; i++) {
      const angle = random(0, Math.PI * 2);
      // Começa distribuída dentro do corpo do asteroide para parecer poeira soltando.
      const origin = Math.sqrt(Math.random()) * this.radius * 0.72;
      const speed = random(28, this.boss ? 145 : 105);
      const isCloud = Math.random() < 0.72;
      const lifetime = random(Asteroid.DUST_LIFE_MIN, Asteroid.DUST_LIFE_MAX)
        * (this.boss ? 1.22 : this.child ? 0.82 : 1);
      const shade = random(0.77, 1.15);
      const r = Math.min(255, Math.round(base[0] * shade));
      const g = Math.min(255, Math.round(base[1] * shade));
      const b = Math.min(255, Math.round(base[2] * shade));
      const opacity = isCloud ? random(0.34, 0.59) : random(0.65, 0.9);
      const size = (isCloud ? random(2.3, 4.3) : random(1, 2.3))
        * (this.boss ? 1.25 : this.child ? 0.72 : 1);

      particles.push({
        x: this.x + Math.cos(angle) * origin,
        y: this.y + Math.sin(angle) * origin,
        vx: Math.cos(angle) * speed + this.vx * 0.12,
        vy: Math.sin(angle) * speed + this.vy * 0.12,
        size,
        color: `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`,
        life: lifetime,
        maxLife: lifetime,
      });
    }
  }

  collisionPower() {
    return this.boss
      ? Math.max(8, Math.ceil((this.hp + this.armor) * 0.22))
      : Math.max(1, this.hp + this.armor);
  }

  destroy(reason = "shot") {
    if (this.dead) return;
    this.dead = true;
    const playerKill = reason === "shot" || reason === "burn";
    if (typeof state !== "undefined") {
      if (this.isPrimary && !this.child && !this.boss) state.playing.kills.total += 1;
      state.totalDestroyed += 1;
      if (playerKill) {
        const bonus = this.type === "common" || this.type === "fractionalSlice" ? 0 : this.boss ? 22 : 4;
        state.playing.score += Math.max(1, Math.round(this.maxHp * (this.boss ? 1.2 : this.child ? 0.22 : 0.5) + bonus));
        state.score += Math.round(this.maxHp * (this.boss ? 34 : this.child ? 6 : 12) + bonus * 12);
        // Usa o maior valor, NÃO soma os shakes de múltiplas destruições.
        // Outros efeitos (por exemplo, dano no jogador) permanecem independentes.
        const shake = this.boss ? Asteroid.DESTROY_SHAKE_BOSS : 0;
        state.shake = Math.max(Number.isFinite(state.shake) ? state.shake : 0.5, shake);
      }
      if (this.boss && state.boss === this) state.boss = null;
    }
    this.spawnDust();
    this.onDestroyed(reason);
    this.emit("destroyed", { asteroid: this, reason, playerKill });
  }

  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.drawSpecialEffects();
    if (this.burnTicks > 0) {
      ctx.save();
      ctx.strokeStyle = "#ff9159";
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(this.rotation);
    ctx.shadowColor = this.boss ? "rgba(255,213,118,.45)" : "rgba(0,0,0,.25)";
    ctx.shadowBlur = this.boss ? 18 : 8;
    if (!drawSprite(this.image, -this.size / 2, -this.size / 2, this.size, this.size)) {
      ctx.fillStyle = "#8b92a6";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (this.armor > 0) {
      ctx.save();
      ctx.strokeStyle = "#6ee6ff";
      ctx.lineWidth = this.boss ? 4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.12, -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (this.armor / this.maxArmor));
      ctx.stroke();
      ctx.restore();
    }
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(this.hp, 0, 5);
    if (this.boss) {
      const width = this.size * 0.95;
      ctx.fillStyle = "#252a44";
      ctx.fillRect(-width / 2, -this.radius - 20, width, 5);
      ctx.fillStyle = "#ffbf66";
      ctx.fillRect(-width / 2, -this.radius - 20, width * (this.hp / this.maxHp), 5);
    }
    ctx.restore();
  }
}

class CommonAsteroid extends Asteroid {
  constructor(config) { super({ ...config, type: "common" }); }
  resolveSprite() { return ASSETS.common[randomInt(0, ASSETS.common.length - 1)]; }
}

class FrozenAsteroid extends Asteroid {
  constructor(config) { super({ ...config, type: "frozen" }); }
  resolveSprite() { return ASSETS.special.frozen; }
  onDestroyed(reason) {
    // Pickup de frozen: desativado temporariamente. Para reativar, descomente:
    // if (reason === "shot" || reason === "burn") this.emit("drop", { asteroid: this, type: "frozen", x: this.x, y: this.y });
  }
}

class MysticAsteroid extends Asteroid {
  constructor(config) { super({ ...config, type: "mystic" }); }
  resolveSprite() { return ASSETS.special.mystic; }
  onDestroyed(reason) {
    // Pickup de mystic: desativado temporariamente. Para reativar, descomente:
    // if (reason === "shot" || reason === "burn") this.emit("drop", { asteroid: this, type: "mystic", x: this.x, y: this.y });
  }
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

class VolcanicAsteroid extends Asteroid {
  constructor(config) { super({ ...config, type: "volcanic" }); }
  resolveSprite() { return ASSETS.special.volcanic; }
  onDestroyed(reason) {
    // Pickup de volcanic: desativado temporariamente. Para reativar, descomente:
    // if (reason === "shot" || reason === "burn") this.emit("drop", { asteroid: this, type: "volcanic", x: this.x, y: this.y });
  }
  drawSpecialEffects() {
    ctx.save();
    ctx.shadowColor = "#ff7544";
    ctx.shadowBlur = 19;
    ctx.strokeStyle = "rgba(255,120,66,.4)";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.07, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class FractionalSliceAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, type: "fractionalSlice", child: true, isPrimary: false });
    this.setSize(this.size * 0.58, 0.34);
  }
  resolveSprite() { return ASSETS.special.fractionalSlice; }
}

class FractionalAsteroid extends Asteroid {
  constructor(config) { super({ ...config, type: "fractional" }); }
  resolveSprite() { return ASSETS.special.fractional; }
  onDestroyed(reason) {
    if ((reason === "shot" || reason === "burn") && !this.child) {
      this.emit("spawnFragments", { asteroid: this, count: randomInt(2, 5) });
    }
  }
}

class BossAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, boss: true, size: config.size ?? 140 });
    this.phase = 1;
    this.attackTimer = 1.8;
  }
  updateBehavior(dt) {
    const ratio = this.hp / this.maxHp;
    const nextPhase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.onPhaseChanged(nextPhase);
      this.emit("phaseChanged", { boss: this, phase: nextPhase });
    }
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attack();
      this.attackTimer = this.phase === 3 ? 0.85 : this.phase === 2 ? 1.35 : 2.1;
    }
  }
  onPhaseChanged(phase) { }
  attack() { }
}

class CyberBoss extends BossAsteroid {
  constructor(config) { super({ ...config, type: "cyber" }); }
  resolveSprite() { return ASSETS.bosses.cyber; }
  attack() {
    this.emit("attack", {
      boss: this, kind: "cyber", count: this.phase,
      x: this.x, y: this.y,
    });
  }
}

class ThornyBoss extends BossAsteroid {
  constructor(config) { super({ ...config, type: "thorny" }); }
  resolveSprite() { return ASSETS.bosses.thorny; }
  attack() { this.emit("attack", { boss: this, kind: "thorn", count: 2 + this.phase, x: this.x, y: this.y }); }
}

class GravityBoss extends BossAsteroid {
  constructor(config) { super({ ...config, type: "gravity" }); }
  resolveSprite() { return ASSETS.bosses.gravity; }
  getArenaPadding() { return 45; }
  applyCustomSteering(dt) {
    if (typeof player === "undefined") return;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.vx += dx / distance * 65 * dt;
    this.vy += dy / distance * 65 * dt;
  }
  attack() { this.emit("attack", { boss: this, kind: "summon", count: 1 + this.phase, x: this.x, y: this.y }); }
  drawSpecialEffects() {
    const aura = loadImage(ASSETS.bosses.gravityAura);
    ctx.save();
    ctx.rotate(-this.age * 0.3);
    ctx.globalAlpha = 0.68;
    const s = this.size * 1.7;
    drawSprite(aura, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

class ResistanceBoss extends BossAsteroid {
  constructor(config) {
    super({ ...config, type: "resistance" });
    this.maxArmor = Math.max(6, Math.ceil(this.maxHp * 0.65));
    this.armor = this.maxArmor;
  }
  resolveSprite() { return ASSETS.bosses.resistance; }
  onPhaseChanged() { this.armor = Math.max(this.armor, Math.ceil(this.maxArmor * 0.38)); }
  attack() {
    // Diferente dos outros bosses, recupera parcialmente sua armadura.
    const before = this.armor;
    this.armor = Math.min(this.maxArmor, this.armor + Math.ceil(this.maxArmor * 0.12));
    this.emit("attack", { boss: this, kind: "armorPulse", recovered: this.armor - before, x: this.x, y: this.y });
  }
}

/** Projétil de bosses; integra-se ao mesmo sistema de hitboxes. */
class AsteroidProjectile {
  constructor({ x, y, angle = Math.PI / 2, kind = "cyber", speed = 180, damage = 2 } = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.kind = kind;
    this.speed = speed;
    this.damage = damage;
    this.radius = kind === "thorn" ? 8 : 10;
    this.life = 7;
    this.dead = false;
    this.hitbox = new Hitbox(this, this.radius);
    this.image = kind === "thorn" ? loadImage(ASSETS.bosses.thornySpike) : null;
  }
  update(dt) {
    if (this.dead) return;
    if (this.kind === "cyber" && typeof player !== "undefined") {
      const desired = Math.atan2(player.y - this.y, player.x - this.x);
      let delta = ((desired - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.angle += clamp(delta, -1.4 * dt, 1.4 * dt);
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    const { w, h } = viewport();
    if (this.life <= 0 || this.x < -90 || this.x > w + 90 || this.y < -90 || this.y > h + 90) this.dead = true;
  }
  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    if (this.kind === "thorn" && drawSprite(this.image, -13, -13, 26, 26)) {
      ctx.restore();
      return;
    }
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.kind === "cyber" ? "#36bcff" : "#a7ff85";
    ctx.fillStyle = this.kind === "cyber" ? "#72e6ff" : "#b9ff96";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
