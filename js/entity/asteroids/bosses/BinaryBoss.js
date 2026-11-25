"use strict";

/**
 * @file Boss Binário: dois núcleos (azul e laranja) girando um em volta do outro, ligados por
 * um feixe que fere a nave. Cada núcleo atira plasma (PlasmaBall). Se um cair, o outro o
 * revive em poucos segundos: é preciso derrubar os dois quase juntos.
 * Os dois são criados juntos por BinaryBoss.createPair().
 */
class BinaryBoss extends BossAsteroid {
  /**
   * Dois núcleos (azul e laranja) girando um em volta do outro, ligados por um feixe de energia.
   * - O feixe machuca a nave que cruzar por ele (com um intervalo entre um dano e outro).
   * - Cada núcleo atira plasma na nave; os dois atacam alternados.
   * - Se um cair, o outro começa a REVIVER o parceiro (REVIVE_TIME s, mais lento com gelo).
   *   Para vencer, é preciso derrubar os dois quase juntos.
   * Os dois dividem o objeto `pair`: centro do par, giro e patrulha na parte de cima da arena.
   */
  static REVIVE_TIME = 6;        // segundos até o sobrevivente reviver o parceiro
  static REVIVE_HP = 0.5;        // o parceiro volta com metade da vida máxima
  static BEAM_COOLDOWN = 0.7;    // segundos entre um dano do feixe e outro
  static ORBIT = 1.05;           // distância de cada núcleo ao centro do par (em tamanhos do núcleo)
  static EMITTER_TIP = 1.3;      // ponta do emissor, em raios do núcleo
  // Direção do emissor em cada imagem: o azul aponta para a direita, o laranja para a esquerda
  static EMITTER = { blue: 0, orange: Math.PI };
  static SPIN = { 1: 0.8, 2: 1.15, 3: 1.6 }; // giro do par (rad/s) por fase

  /** Cria os dois núcleos já ligados. config.hp = vida TOTAL do boss, dividida entre os dois. */
  static createPair(config) {
    const half = Math.max(1, Math.round(config.hp / 2));
    const pair = {
      x: config.x, y: config.y, angle: random(0, Math.PI * 2),
      patrolDir: Math.random() < 0.5 ? -1 : 1, time: 0, arrived: false, beamCooldown: 0, stamp: -1,
    };
    const blue = new BinaryBoss({ ...config, hp: half, color: "blue", pair });
    const orange = new BinaryBoss({ ...config, hp: half, color: "orange", pair });
    blue.partner = orange;
    orange.partner = blue;
    orange.attackTimer += 1.1; // não atacam juntos
    blue.place();
    orange.place();
    return [blue, orange];
  }

  constructor(config) {
    super({ ...config, type: "binary" });
    this.color = config.color ?? "blue";
    this.pair = config.pair;
    this.partner = null;
    this.rotationSpeed = 0;   // a rotação vem do giro do par
    this.reviveTimer = 0;     // > 0: revivendo o parceiro
    this.reviveFlash = 0;     // clarão ao voltar
    this.image = loadImage(this.resolveSprite()); // a cor só existe depois do super()
  }

  resolveSprite() {
    return this.color === "orange" ? ASSETS.bosses.binaryOrange : ASSETS.bosses.binaryBlue;
  }

  /** Os dois estão vivos (o feixe está ligado). */
  get linked() { return !this.dead && !!this.partner && !this.partner.dead; }

  /** Cor do núcleo em RGB (efeitos e textos). */
  get rgb() { return this.color === "orange" ? "255, 160, 70" : "110, 210, 255"; }

  /** Cada núcleo leva a própria cor no nome. */
  get displayName() { return `Binário ${this.color === "orange" ? "Laranja" : "Azul"}`; }
  get nameColor() { return `rgb(${this.rgb})`; }

  /** Ângulo deste núcleo em volta do centro do par (o laranja fica do lado oposto). */
  pairAngle() { return this.pair.angle + (this.color === "orange" ? Math.PI : 0); }

  /** Onde este núcleo fica na órbita agora (usado também para o "fantasma" ao reviver). */
  orbitSpot() {
    const a = this.pairAngle();
    const r = this.size * BinaryBoss.ORBIT;
    return { x: this.pair.x + Math.cos(a) * r, y: this.pair.y + Math.sin(a) * r };
  }

  /** Posiciona o núcleo na órbita e vira o emissor para o parceiro. */
  place() {
    const spot = this.orbitSpot();
    this.x = spot.x;
    this.y = spot.y;
    this.rotation = this.pairAngle() + Math.PI - BinaryBoss.EMITTER[this.color];
  }

  /** Fase mais avançada entre os dois (o giro acelera quando qualquer um está ferido). */
  pairPhase() {
    return this.linked ? Math.max(this.phase, this.partner.phase) : this.phase;
  }

  /** Move o par uma vez por quadro (quem chegar primeiro atualiza). dt já vem com a lentidão do gelo. */
  updatePair(dt) {
    const p = this.pair;
    const now = state.playing?.time ?? 0;
    if (p.stamp === now) return;
    p.stamp = now;

    const { w, h } = viewport();
    const reach = this.size * BinaryBoss.ORBIT + this.radius; // até a borda do núcleo mais longe
    const top = ARENA_TOP + reach + px(6);
    if (!p.arrived) {
      // Entrada dramática: o par desce reto e invencível até a arena
      p.y += this.speed * 1.12 * dt;
      if (p.y >= top) p.arrived = true;
    } else {
      // Patrulha na horizontal e sobe/desce devagar entre o topo e ~42% da altura
      p.time += dt;
      const low = Math.max(top, h * 0.42);
      const targetY = top + (low - top) * (0.5 - 0.5 * Math.cos(p.time * 0.35));
      p.y += (targetY - p.y) * Math.min(1, dt * 1.5);
      const left = 10 + reach;
      const right = Math.max(left, w - 10 - reach);
      p.x += p.patrolDir * this.speed * 0.45 * dt;
      if (p.x <= left) { p.x = left; p.patrolDir = 1; }
      if (p.x >= right) { p.x = right; p.patrolDir = -1; }
    }
    const spin = BinaryBoss.SPIN[this.pairPhase()] ?? BinaryBoss.SPIN[1];
    p.angle += spin * (this.linked ? 1 : 1.3) * dt; // sozinho gira mais rápido
    p.beamCooldown = Math.max(0, p.beamCooldown - dt);
  }

  updateMovement(dt) {
    this.updatePair(dt);
    this.place();
    this.enteredArena = this.inArena = this.pair.arrived;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt) {
    super.update(dt);
    this.reviveFlash = Math.max(0, this.reviveFlash - dt);
  }

  updateBehavior(dt) {
    super.updateBehavior(dt); // fases + ataque
    // Revivendo o parceiro (o gelo deixa o processo mais lento)
    if (this.reviveTimer > 0) {
      this.reviveTimer -= dt * effects.asteroidSpeedMultiplier(this);
      if (this.reviveTimer <= 0) this.revivePartner();
    }
    // O feixe é verificado uma vez só (pelo azul, que é quem o desenha)
    if (this.color === "blue" && this.linked) this.beamHit();
  }

  /** Pontas dos emissores: o feixe liga uma à outra. */
  beamEnds() {
    const a = this, b = this.partner;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const ka = a.radius * BinaryBoss.EMITTER_TIP, kb = b.radius * BinaryBoss.EMITTER_TIP;
    return {
      x1: a.x + Math.cos(ang) * ka, y1: a.y + Math.sin(ang) * ka,
      x2: b.x - Math.cos(ang) * kb, y2: b.y - Math.sin(ang) * kb,
    };
  }

  /** Nave encostando no feixe: dano no escudo (ou morte sem escudo), com intervalo. */
  beamHit() {
    const p = this.pair;
    if (p.beamCooldown > 0) return;
    const { x1, y1, x2, y2 } = this.beamEnds();
    const dx = x2 - x1, dy = y2 - y1;
    const t = clamp(((player.x - x1) * dx + (player.y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const distance = Math.hypot(player.x - (x1 + dx * t), player.y - (y1 + dy * t));
    if (distance > player.hitbox.radius + px(4)) return;
    p.beamCooldown = BinaryBoss.BEAM_COOLDOWN;
    player.onProjectileHit({ dead: false, kind: "beam", damage: this.projectileDamage("beam") });
    state.flash = Math.max(state.flash ?? 0, 0.1);
  }

  /** Segundos entre ataques (são dois atirando); sozinho fica mais agressivo. */
  attackInterval() {
    const base = this.phase === 3 ? 1.8 : this.phase === 2 ? 2.3 : 2.8;
    return this.linked ? base : base * 0.75;
  }

  /** Plasma da cor do núcleo, mirado na nave: 1 tiro (2 em leque na fase 3). */
  attack() {
    const count = this.phase === 3 ? 2 : 1;
    const aim = this.aimAtPlayer();
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.28;
      this.fire(PlasmaBall, {
        speed: 210, angle, color: this.color,
        x: this.x + Math.cos(angle) * this.radius * 0.8,
        y: this.y + Math.sin(angle) * this.radius * 0.8,
      });
    }
  }

  /** Caiu: o parceiro (se vivo) assume o HUD e começa a reviver este núcleo. */
  onDestroyed() {
    this.reviveTimer = 0;
    const partner = this.partner;
    if (!partner || partner.dead) return;
    if (!state.boss || state.boss.dead) state.boss = partner;
    partner.reviveTimer = BinaryBoss.REVIVE_TIME;
    spawnFloatingText(partner.x, partner.y - partner.radius, "REVIVENDO!", ASTEROID_INFO.binary.color);
  }

  /** O tempo acabou com este núcleo vivo: o parceiro volta com metade da vida. */
  revivePartner() {
    const b = this.partner;
    this.reviveTimer = 0;
    if (!b || !b.dead || this.dead) return;
    b.dead = false;
    b.hp = Math.max(1, Math.ceil(b.maxHp * BinaryBoss.REVIVE_HP));
    b.armor = 0;
    b.projectiles = [];
    b.reviveTimer = 0;
    b.attackTimer = 1.5;
    b.place();
    b.enteredArena = b.inArena = true;
    b.reviveFlash = 0.6;
    asteroids.push(b);
    b.spawnFxParticles(24, () => [b.rgb], { speed: [60, 190], life: [0.35, 0.7], size: [2, 4] });
    spawnFloatingText(b.x, b.y - b.radius, "REVIVEU!", ASTEROID_INFO.binary.color);
    addShake(4);
    playTone(520, 0.2, 0.04, "sawtooth");
  }

  // ------------------------------------------------------------------ visual

  drawSpecialEffects() {
    Asteroid.drawAura(this.radius * 1.7, 0.3, this.rgb, 0.22); // brilho da cor do núcleo
    if (this.color === "blue" && this.linked) this.drawBeam();
    if (this.reviveTimer > 0 && this.partner?.dead) this.drawRevive();
  }

  /** Feixe azul -> laranja, tremendo, com núcleo branco. Coordenadas locais (centro deste núcleo). */
  drawBeam() {
    const { x1, y1, x2, y2 } = this.beamEnds();
    const ax = x1 - this.x, ay = y1 - this.y, bx = x2 - this.x, by = y2 - this.y;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    const t = this.age;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const grad = ctx.createLinearGradient(ax, ay, bx, by);
    grad.addColorStop(0, "rgba(110, 210, 255, .9)");
    grad.addColorStop(1, "rgba(255, 160, 70, .9)");
    // Faixa larga (área de perigo)
    ctx.globalAlpha = 0.5 + Math.sin(t * 18) * 0.1;
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(5, px(13));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Brilho em volta da faixa (passada mais larga e mais transparente)
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = Math.max(10, px(26));
    ctx.stroke();
    // Raio tremendo por dentro
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(1.5, px(3));
    ctx.beginPath();
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const jitter = i === 0 || i === steps ? 0 : Math.sin(t * 40 + i * 2.3) * px(5);
      const x = ax + (bx - ax) * k + nx * jitter, y = ay + (by - ay) * k + ny * jitter;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, .9)";
    ctx.lineWidth = Math.max(1, px(1.3));
    ctx.stroke();
    ctx.restore();
  }

  /** Fantasma do parceiro caído, com o anel de contagem até ele voltar. */
  drawRevive() {
    const b = this.partner;
    const spot = b.orbitSpot();
    const gx = spot.x - this.x, gy = spot.y - this.y;
    const k = 1 - this.reviveTimer / BinaryBoss.REVIVE_TIME;
    const r = b.radius * 1.25;
    ctx.save();
    // Fio de energia tracejado até o fantasma
    ctx.setLineDash([px(6), px(8)]);
    ctx.lineDashOffset = -this.age * 40;
    ctx.strokeStyle = `rgba(${this.rgb}, .55)`;
    ctx.lineWidth = Math.max(1, px(2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Sprite apagado do parceiro
    ctx.translate(gx, gy);
    ctx.save();
    ctx.rotate(b.pairAngle() + Math.PI - BinaryBoss.EMITTER[b.color]);
    ctx.globalAlpha = 0.18 + k * 0.3 + Math.sin(this.age * 10) * 0.05;
    const ghost = SpriteCache.image(b.image, b.size);
    SpriteCache.drawCentered(ghost, ghost ? b.size / ghost.size : 1);
    ctx.restore();
    // Anel de contagem
    ctx.strokeStyle = `rgba(${b.rgb}, .25)`;
    ctx.lineWidth = Math.max(2, px(4));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    glowStroke(`rgb(${b.rgb})`, Math.max(2, px(4)), { glow: Math.max(6, px(12)), glowAlpha: 0.3 });
    // Segundos restantes
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(18 * clamp(SCALE, 0.85, 1.2))}px Orbitron, sans-serif`;
    ctx.fillText(Math.ceil(this.reviveTimer), 0, 0);
    ctx.restore();
  }

  /** Clarão logo depois de reviver. */
  drawOverSprite() {
    if (this.reviveFlash <= 0) return;
    ctx.save();
    ctx.rotate(this.rotation);
    this.drawTint(this.color === "orange" ? "#ffd9a8" : "#c9f3ff", (this.reviveFlash / 0.6) * 0.8);
    ctx.restore();
  }
}

/** Plasma do Binário: bola brilhante com rastro, azul ou laranja (cor do núcleo que atirou). */
class PlasmaBall extends BossProjectile {
  static KIND = "plasma";

  /** @param {object} options opções de BossProjectile + color ("blue" | "orange") */
  constructor({ color = "blue", ...options }) {
    super({ ...options, radius: 10, life: 7 });
    this.color = color;
  }

  get rgb() { return this.color === "orange" ? "255, 150, 60" : "90, 200, 255"; }

  /** Halo + núcleo pré-renderizados. */
  static sprite(r, rgb) {
    const size = Math.ceil(r * 2.2 * 1.1) * 2;
    return SpriteCache.shape(`plasma|${rgb}|${r.toFixed(1)}`, size, size, (c) => {
      const halo = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      halo.addColorStop(0, `rgba(${rgb}, .6)`);
      halo.addColorStop(1, `rgba(${rgb}, 0)`);
      c.fillStyle = halo;
      c.beginPath();
      c.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      c.fill();
      const core = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(1, `rgba(${rgb}, .5)`);
      c.fillStyle = core;
      c.beginPath();
      c.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      c.fill();
    });
  }

  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawTrail(this.rgb, 0.25, [0.3, 0.9]);
    ctx.translate(this.x, this.y);
    SpriteCache.drawCentered(PlasmaBall.sprite(this.radius, this.rgb), 1 + Math.sin(this.age * 16) * 0.1);
    ctx.restore();
  }
}

Asteroid.register("binary", BinaryBoss);
