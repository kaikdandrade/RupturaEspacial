"use strict";

/**
 * @file Base dos bosses e dos projéteis deles.
 *
 * BossAsteroid: vida em fases (1 > 70%, 2 > 30%, 3 até o fim), ataque periódico
 * (attackInterval + attack), entrada invencível até a arena e o movimento:
 * livre na parte de cima da arena ou patrulha no topo (patrols).
 *
 * BossProjectile: tiro de boss. Cada boss tem a sua subclasse no próprio arquivo
 * (espinho, orbe, ácido, plasma) e dispara com this.fire(Classe, { ... }).
 */
class BossAsteroid extends Asteroid {
  /**
   * Bosses que andam livres ficam na parte de cima da arena (até FLOOR da altura):
   * a parte de baixo fica para a nave desviar. A batida só acontece se a nave subir.
   */
  static FLOOR = 0.62;

  constructor(config) {
    super({ ...config, boss: true, size: config.size ?? px(140) });
    this.phase = 1;
    this.attackTimer = 1.8;
    /** @type {BossProjectile[]} tiros deste boss (as colisões com a nave leem daqui) */
    this.projectiles = [];
  }

  update(dt) {
    super.update(dt);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  draw() {
    super.draw();
    for (const p of this.projectiles) p.draw();
  }

  /** Patrulha o topo da arena (Cibernético e Gravitacional) em vez de andar livre. */
  get patrols() { return false; }

  /** Nome mostrado ao lado da vida (em português, de ASTEROID_INFO). */
  get displayName() { return ASTEROID_INFO[this.type]?.name ?? ""; }

  /** Cor do nome ao lado da vida. */
  get nameColor() { return ASTEROID_INFO[this.type]?.color ?? "#fff"; }

  /** Velocidade do boss em relação aos asteroides do setor. */
  get speedFactor() { return 0.86; }

  /** Bosses que andam livres não descem abaixo de FLOOR da altura da tela. */
  arenaBottom(h) {
    return Math.min(super.arenaBottom(h), h * BossAsteroid.FLOOR);
  }

  updateMovement(dt) {
    if (this.patrols && this.enteredArena) this.patrolTop(dt);
    else super.updateMovement(dt);
  }

  /**
   * Vai e volta na horizontal, numa linha logo abaixo do topo da arena, deixando espaço
   * acima para o nome e a barra de vida (drawHealth) não ficarem atrás do HUD.
   */
  patrolTop(dt) {
    const { w } = viewport();
    const left = 10 + this.radius + 6;
    const right = Math.max(left, w - 10 - this.radius - 6);
    const lineY = ARENA_TOP + this.radius + px(44);
    const speed = this.speed * 0.6;
    this.patrolDir ??= Math.random() < 0.5 ? -1 : 1;

    this.y += (lineY - this.y) * Math.min(1, dt * 3);
    this.x += this.patrolDir * speed * dt;
    if (this.x <= left) { this.x = left; this.patrolDir = 1; }
    if (this.x >= right) { this.x = right; this.patrolDir = -1; }
    this.vx = this.patrolDir * speed;
    this.vy = 0;
  }

  /**
   * Dano de um tipo de projétil: dano de batida do setor × multiplicador do tipo
   * (BALANCE.bossProjectileDamage). Cresce com o setor junto com o resto do jogo.
   */
  projectileDamage(kind) {
    const contact = state.levelConfig?.enemies?.contact ?? 5;
    const mult = BALANCE.bossProjectileDamage[kind] ?? 1;
    return Math.max(1, Math.round(contact * mult));
  }

  /** Ângulo do boss até a nave. */
  aimAtPlayer() {
    return Math.atan2(player.y - this.y, player.x - this.x);
  }

  /**
   * Dispara um projétil.
   * @param {typeof BossProjectile} ProjectileClass classe do projétil (define KIND e o desenho)
   * @param {object} options angle, speed (px/s na tela de referência), x, y e opções da classe
   */
  fire(ProjectileClass, { speed, x = this.x, y = this.y, ...options }) {
    this.projectiles.push(new ProjectileClass({
      ...options,
      x, y,
      speed: px(speed),
      damage: this.projectileDamage(ProjectileClass.KIND),
    }));
  }

  /** Segundos entre ataques, por fase. Cada boss pode ajustar. */
  attackInterval() {
    return this.phase === 3 ? 0.85 : this.phase === 2 ? 1.35 : 2.1;
  }

  /** Troca de fase pela vida e dispara o ataque quando o timer zera. */
  updateBehavior(dt) {
    const ratio = this.hp / this.maxHp;
    const nextPhase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.onPhaseChanged(nextPhase);
    }
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attack();
      this.attackTimer = this.attackInterval();
    }
  }

  /** Mudou de fase (ex.: o Resistente recupera armadura). */
  onPhaseChanged(phase) { }

  /** Ataque do boss (cada um define o seu). */
  attack() { }
}

/**
 * Projétil de boss: anda na direção `angle` com `speed`, some ao acabar a vida ou sair da tela.
 * Subclasses definem KIND (chave do dano em BALANCE.bossProjectileDamage), o desenho e,
 * se precisarem, steer() (mudar a direção) e affectedByEffects (sofre gelo/BLEVE).
 */
class BossProjectile {
  /** Tipo do projétil (chave em BALANCE.bossProjectileDamage). */
  static KIND = "";
  /** Quantos pontos o rastro guarda (0 = sem rastro). */
  static TRAIL = 9;

  /**
   * @param {object} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.angle direção do movimento (rad)
   * @param {number} options.speed px/s (já na escala da tela)
   * @param {number} options.damage dano no escudo da nave
   * @param {number} [options.radius] raio na tela de referência
   * @param {number} [options.life] segundos até sumir
   */
  constructor({ x, y, angle = Math.PI / 2, speed = 180, damage = 2, radius = 10, life = 7 }) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.radius = px(radius);
    this.life = life;
    this.age = 0;
    this.dead = false;
    /** Últimas posições, para o rastro: { x, y }[] */
    this.trail = [];
    this.hitbox = new Hitbox(this, this.radius);
  }

  /** Tipo deste projétil (ex.: "thorn"). */
  get kind() { return this.constructor.KIND; }

  /** Sofre lentidão/congelamento do gelo e quebra no BLEVE? */
  get affectedByEffects() { return false; }

  /** Muda a direção a cada quadro (teleguiado, cravado...). dt = real, sdt = com lentidão. */
  steer(dt, sdt) { }

  update(dt) {
    if (this.dead) return;
    // frozen deixa lento, freeze para tudo (inclusive os timers)
    const sdt = this.affectedByEffects ? dt * effects.projectileSpeedMultiplier() : dt;
    this.age += sdt;
    this.steer(dt, sdt);
    this.x += Math.cos(this.angle) * this.speed * sdt;
    this.y += Math.sin(this.angle) * this.speed * sdt;
    this.life -= sdt;

    const trailLength = this.constructor.TRAIL;
    if (trailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > trailLength) this.trail.shift();
    }

    const { w, h } = viewport();
    if (this.life <= 0 || this.x < -90 || this.x > w + 90 || this.y < -90 || this.y > h + 90) this.dead = true;
  }

  /**
   * Rastro de bolinhas que diminuem e somem (modo "lighter": brilha somando cor).
   * @param {string} rgb cor "r, g, b"
   * @param {number} alpha opacidade da bolinha mais nova
   * @param {[number, number]} sizes raio da mais velha e da mais nova (em raios do projétil)
   */
  drawTrail(rgb, alpha, [from, to]) {
    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      const p = this.trail[i];
      ctx.fillStyle = `rgba(${rgb}, ${alpha * k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.radius * (from + k * (to - from)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Desenho do projétil (cada subclasse define). */
  draw() { }
}
