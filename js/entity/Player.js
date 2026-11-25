"use strict";

/**
 * @file A nave do jogador (Player) e o tiro dela (Bullet).
 * Controles: setas/WASD movem, botão do mouse, espaço ou Enter atiram.
 * No celular: joystick e botão de tiro de js/ui/touch.js (touchControls).
 */

/** Tiro da nave. Sobe reto (com um desvio lateral vx para as naves com canos nas asas). */
class Bullet {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} vx desvio lateral em px/s na tela de referência
   */
  constructor(x, y, vx = 0) {
    this.x = x;
    this.y = y;
    this.vx = px(vx);
    this.vy = -px(770);
    this.radius = Math.max(2, px(3.5));
    this.dead = false;
    // Dano base do upgrade, ajustado pelo efeito damageBoost
    this.damage = effects.damage(playerBaseDamage());
    // Quantos asteroides extras o tiro atravessa (piercingShot). Consumido no hitbox do Asteroid.
    this.pierce = effects.pierceCount();
    // Tiro elétrico: { jumps, range, falloff } enquanto o efeito estiver ativo (raio em cascata)
    this.electric = effects.chainLightning();
    this.hitbox = new Hitbox(this, this.radius);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const { w } = viewport();
    if (this.y < -20 || this.x < -25 || this.x > w + 25) this.dead = true;
  }

  /** Traço brilhante (2 passadas no lugar de shadowBlur, que era caro com muitos tiros). */
  /**
   * Sprite do tiro (linha fina com brilho desfocado, o visual original), desenhado uma vez
   * no cache com shadowBlur e depois só copiado: fica bonito sem pesar com muitos tiros.
   */
  static sprite(electric) {
    const length = px(22);
    const width = Math.max(2, px(3));
    const blur = electric ? 16 : 12;
    const pad = Math.ceil(blur * 1.6);
    const key = `bullet|${electric}|${length.toFixed(1)}|${width.toFixed(1)}`;
    return SpriteCache.shape(key, width + pad * 2, length + pad * 2, (c) => {
      c.strokeStyle = electric ? "#fff3a0" : "#86f6ff";
      c.lineWidth = width;
      c.shadowColor = electric ? "#ffe66d" : "#5eeaff";
      c.shadowBlur = blur * RENDER_DPR; // shadowBlur ignora a escala do contexto
      c.beginPath();
      c.moveTo(0, length / 2);
      c.lineTo(0, -length / 2);
      c.stroke();
    });
  }

  draw() {
    const entry = Bullet.sprite(this.electric);
    // Do pé (y + 15) à ponta (y - 7), inclinado pelo vx dos canos laterais
    const dx = -this.vx * 0.008;
    const cx = this.x + dx / 2;
    const cy = this.y + px(4);
    if (!dx) {
      ctx.drawImage(entry.canvas, cx - entry.w / 2, cy - entry.h / 2, entry.w, entry.h);
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dx, px(22)));
    SpriteCache.drawCentered(entry);
    ctx.restore();
  }
}

/** Dano base do tiro: 1 + nível do upgrade de dano. */
function playerBaseDamage() {
  return 1 + SAVE.upgrades_level.damage * BALANCE.damagePerLevel;
}

/**
 * Nave do jogador: movimento com inércia, tiros pelos canos da arte (SHIPS[].muzzles),
 * escudo (resistência) e a animação de lançamento do hangar para a arena.
 * Sinal emitido: "death" ({ player, asteroid?, projectile? }).
 */
class Player extends Signals {
  /** Teclas que o jogo usa (as outras continuam funcionando normalmente no navegador). */
  static ACTION_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "a", "w", "s", "d", "enter", " "];
  /** Canos padrão (bico) se a nave não tiver muzzles definidos. */
  static DEFAULT_MUZZLES = [{ x: 0.5, y: 0, vx: 0 }];

  #skinIndex = SAVE.selectedShip;
  #keys = new Set();
  #launch = {};
  #isShooting = false;
  #lastShotTime = 0;
  #bullets = [];
  #muzzles = Player.DEFAULT_MUZZLES; // pontos dos canos na arte (SHIPS[].muzzles)

  constructor() {
    super();
    const { w, h } = viewport();
    this.x = w / 2;
    this.y = h - px(90);
    this.vx = 0;
    this.vy = 0;
    this.applyScale();
    this.image = loadImage(ASSETS.ships[this.#skinIndex]);
    this.resistance = SAVE.upgrades_level.resistance * BALANCE.resistancePerLevel;
    this.maxResistance = this.resistance;
    this.shieldProgress = 0; // 0..1: animação do escudo aparecendo/sumindo
    this.acceleration = 750;
    this.drag = 2;
    this.fireRate = fireIntervalFor(SAVE.upgrades_level.fireRate);
    this.hitbox = new Hitbox(this, this.radius);
    this.updateHitbox();

    const onAsteroidContact = ({ other, group }) => {
      // Tiros dos bosses
      if (group === "enemyProjectiles") {
        this.onProjectileHit(other);
        return;
      }

      if (group !== "asteroids") return;
      // Invulnerável: nem a nave nem o ESCUDO tomam dano (a resistência não muda).
      if (effects.isInvulnerable() || other.dead) return;

      // Próximo impacto após perder o escudo = Game Over
      if (this.resistance <= 0) {
        this.emit("death", { player: this, asteroid: other });
        return;
      }

      // Boss não é destruído na batida: empurra a nave e tira um pedaço do escudo
      if (other.boss) {
        this.onBossContact(other);
        return;
      }

      const damage = other.contactDamage(); // dano da batida (setor + vida que resta no asteroide)
      other.destroy("player"); // Destrói o asteroide (batida na nave: não conta como abate do jogador)
      this.applyShieldDamage(damage);
    };

    this.hitbox.on("enter", onAsteroidContact);
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (Player.ACTION_KEYS.includes(key)) {
        this.#keys.add(key);
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => this.#keys.delete(event.key.toLowerCase()));
    window.addEventListener("mousedown", (e) => this.#isShooting = e.button === 0);
    window.addEventListener("mouseup", (_) => this.#isShooting = false);
    window.addEventListener("blur", (_) => {
      this.#keys = new Set();
      this.#isShooting = false;
    });
  }

  update(dt) {
    // TIROS
    if (this.#keys.has("enter") || this.#keys.has(" ") || this.#isShooting || touchControls.firing)
      this.shoot();
    this.#bullets.forEach(b => b.update(dt));
    this.#bullets = this.#bullets.filter(b => !b.dead);

    // ========================================
    // ANIMAÇÃO DE ATIVAÇÃO E DESATIVAÇÃO DO ESCUDO
    // ========================================
    const shieldActive = Number.isFinite(this.resistance) && this.resistance > 0;
    const target = shieldActive ? 1 : 0;
    const duration = shieldActive ? 0.22 : 0.32;
    const step = dt / duration;

    if (this.shieldProgress < target)
      this.shieldProgress = Math.min(
        target,
        this.shieldProgress + step
      );
    else if (this.shieldProgress > target)
      this.shieldProgress = Math.max(
        target,
        this.shieldProgress - step
      );

    // ============================
    // MOVIMENTAÇÃO
    // ============================
    const { w, h } = viewport();
    const speedMultiplier = effects.moveSpeedMultiplier(); // speedBoost
    let maxSpeed = px(BALANCE.baseMoveSpeed) * speedMultiplier;
    const acceleration = px(this.acceleration) * speedMultiplier;

    // Direção desejada pelo jogador
    let dx = 0;
    let dy = 0;
    if (this.#keys.has("arrowleft") || this.#keys.has("a")) dx--;
    if (this.#keys.has("arrowright") || this.#keys.has("d")) dx++;
    if (this.#keys.has("arrowup") || this.#keys.has("w")) dy--;
    if (this.#keys.has("arrowdown") || this.#keys.has("s")) dy++;

    // Joystick de toque (analógico): sem teclas, usa a direção dele; arrastar pouco = mais devagar
    if (dx === 0 && dy === 0) {
      const stick = touchControls.move;
      const strength = Math.min(1, Math.hypot(stick.x, stick.y));
      if (strength > 0) {
        dx = stick.x;
        dy = stick.y;
        maxSpeed *= 0.35 + 0.65 * strength;
      }
    }

    // ACELERAÇÃO E INÉRCIA
    if (dx !== 0 || dy !== 0) {
      // Normaliza a direção diagonal
      const length = Math.hypot(dx, dy);

      dx /= length;
      dy /= length;

      // Aplica a aceleração
      this.vx += dx * acceleration * dt;
      this.vy += dy * acceleration * dt;

    } else {
      // Desaceleração gradual sem teclas pressionadas
      const damping = Math.exp(-this.drag * dt);

      this.vx *= damping;
      this.vy *= damping;

      // Evita velocidades residuais muito pequenas
      if (Math.abs(this.vx) < 0.5) this.vx = 0;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }

    // LIMITE DE VELOCIDADE
    const currentSpeed = Math.hypot(this.vx, this.vy);
    if (currentSpeed > maxSpeed) {
      const factor = maxSpeed / currentSpeed;
      this.vx *= factor;
      this.vy *= factor;
    }

    // ATUALIZAÇÃO DA POSIÇÃO
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // LIMITES DA ARENA
    const margin = this.radius + px(8);
    const minX = margin;
    const maxX = Math.max(minX, w - margin);
    const minY = ARENA_TOP + margin; // não entra na faixa do HUD
    const maxY = Math.max(minY, h - margin);

    if (this.x < minX) {
      this.x = minX;
      if (this.vx < 0) this.vx = 0;
    }

    if (this.x > maxX) {
      this.x = maxX;
      if (this.vx > 0) this.vx = 0;
    }

    if (this.y < minY) {
      this.y = minY;
      if (this.vy < 0) this.vy = 0;
    }

    if (this.y > maxY) {
      this.y = maxY;
      if (this.vy > 0) this.vy = 0;
    }
  }

  /**
   * Animação de lançamento (do hangar para a arena):
   * 1ª metade: sai da posição da nave do menu, encolhe e sobe até sair pelo topo;
   * 2ª metade: reaparece por baixo da tela, sobe até endY e volta ao tamanho de jogo (1.25).
   * @returns {boolean} true quando a animação terminou
   */
  updateLaunch(dt) {
    if (!this.#launch) return true;
    this.#launch.elapsed += dt;
    const { w, h } = viewport();
    const t = clamp(this.#launch.elapsed / this.#launch.duration, 0, 1);
    const minScale = 0.24;
    const split = 0.5;

    if (t < split) {
      const p = t / split;
      const e = p * p * (3 - 2 * p);
      const startScale = this.#launch.startScale;
      this.#launch.scale = startScale + (minScale - startScale) * e;
      this.x = this.#launch.startX + (w / 2 - this.#launch.startX) * e;
      const exitY = -(this.height * minScale);
      this.y = this.#launch.startY + (exitY - this.#launch.startY) * e;
    } else {
      const p = (t - split) / (1 - split);
      const e = 1 - Math.pow(1 - p, 3);
      const scaledHeight = this.height * minScale;
      const entryY = h + scaledHeight;
      this.x = w / 2;
      this.y = entryY + (this.#launch.endY - entryY) * e;
      this.#launch.scale = minScale + (1.25 - minScale) * e;
    }

    if (t >= 1) {
      this.y = this.#launch.endY;
      this.#launch.scale = 1.25;
    }
    return t >= 1;
  }

  draw() {
    this.#bullets.forEach((b) => b.draw());
    const { image } = this;
    const { width, height } = this.getSpriteSize();
    const scale = this.#launch?.scale ?? 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1;
    drawSprite(image, -width / 2, -height / 2, width, height);
    if (state.mode != "launching") {
      this.drawShield();
      if (effects.isInvulnerable()) this.drawInvulnerability();
    }
    ctx.restore();
  }

  /** Bolha dourada por cima do escudo enquanto o efeito invulnerability está ativo. */
  drawInvulnerability() {
    const t = performance.now() / 1000;
    const remaining = effects.remaining("invulnerability");
    // Pisca no último 1,5s para avisar que vai acabar
    const blink = remaining < 1.5 ? 0.35 + 0.65 * Math.abs(Math.sin(t * 12)) : 1;
    const radius = this.radius + px(8) + Math.sin(t * 5) * 1.5;

    ctx.save();
    ctx.globalAlpha *= blink;

    // Preenchimento
    const fill = ctx.createRadialGradient(0, 0, radius * 0.35, 0, 0, radius);
    fill.addColorStop(0, "rgba(255, 226, 137, 0)");
    fill.addColorStop(0.75, "rgba(255, 210, 103, .12)");
    fill.addColorStop(1, "rgba(255, 210, 103, .32)");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Contorno contínuo com brilho
    glowStroke("rgba(255, 226, 137, .9)", 2, { glow: 10, glowAlpha: 0.35 });

    // Anel tracejado girando
    ctx.rotate(t * 1.8);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255, 245, 200, .85)";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Escudo: campo de força + até 3 arcos girando (menos arcos = menos resistência; o último pisca). */
  drawShield() {
    const resistance = Math.max(0, Number(this.resistance) || 0);
    const maxResistance = Number(this.maxResistance);

    if (!Number.isFinite(maxResistance) || maxResistance <= 0) return;

    const progress = Number.isFinite(this.shieldProgress)
      ? Math.max(0, Math.min(1, this.shieldProgress))
      : (resistance > 0 ? 1 : 0);

    if (progress <= 0) return;

    const time = state.playing?.time ?? 0;
    const parentAlpha = ctx.globalAlpha;

    // ========================================
    // QUANTIDADE DE ARCOS
    // ========================================
    const ratio = Math.min(1, resistance / maxResistance);
    const arcCount = resistance > 0
      ? Math.min(3, Math.ceil(ratio * 3 - Number.EPSILON))
      : 0;

    // Oscilação quando resta apenas o último arco
    const critical = arcCount === 1;
    const oscillation = critical
      ? (Math.sin(time * 4.5) + 1) / 2
      : 0;

    // ========================================
    // COR E OPACIDADE
    // ========================================
    const blue = { r: 145, g: 239, b: 255 };
    const warning = { r: 255, g: 105, b: 150 };

    const colorMix = critical
      ? 0.15 + oscillation * 0.75
      : 0;

    const mix = (a, b) =>
      Math.round(a + (b - a) * colorMix);

    const r = mix(blue.r, warning.r);
    const g = mix(blue.g, warning.g);
    const b = mix(blue.b, warning.b);

    const shieldColor = `rgb(${r}, ${g}, ${b})`;

    const fieldOpacity = critical
      ? 0.35 + oscillation * 0.5
      : 0.82;

    const arcOpacity = critical
      ? 0.3 + oscillation * 0.65
      : 0.8;

    const radius = this.radius + px(8);
    ctx.save();

    // ========================================
    // CAMPO DE FORÇA
    // ========================================
    const fillOpacity = critical
      ? 0.02 + oscillation * 0.045
      : 0.055;

    const gradient = ctx.createRadialGradient(
      0, 0, this.radius * 0.35,
      0, 0, radius + 5
    );

    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    gradient.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, ${fillOpacity})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    // Preenchimento
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);

    ctx.globalAlpha = parentAlpha * progress;
    ctx.fillStyle = gradient;
    ctx.fill();

    // Contorno
    ctx.globalAlpha = parentAlpha * progress * fieldOpacity;
    glowStroke(shieldColor, 1.8, { glow: critical ? 6 + oscillation * 3 : 7, glowAlpha: critical ? 0.22 : 0.25, soft: true });

    // ========================================
    // ARCOS DE ENERGIA
    // ========================================
    ctx.globalAlpha = parentAlpha * progress * arcOpacity;
    ctx.lineCap = "round";
    const rotation = time * 0.8;
    const spacing = (Math.PI * 2) / 3;
    ctx.beginPath();
    for (let i = 0; i < arcCount; i++) {
      const start = rotation + i * spacing;
      ctx.moveTo(Math.cos(start) * (radius + 3), Math.sin(start) * (radius + 3));
      ctx.arc(0, 0, radius + 3, start, start + 0.65);
    }
    if (critical) glowStroke(shieldColor, 2.5, { glow: 6 + oscillation * 3, glowAlpha: 0.25, soft: true });
    else {
      ctx.strokeStyle = shieldColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Tamanho do sprite encaixado na caixa width x height, mantendo a proporção
   * da imagem (os PNGs das naves não são quadrados).
   */
  getSpriteSize() {
    const img = this.image;
    if (!img?.naturalWidth || !img?.naturalHeight) return { width: this.width, height: this.height };
    const fit = Math.min(this.width / img.naturalWidth, this.height / img.naturalHeight);
    return { width: img.naturalWidth * fit, height: img.naturalHeight * fit };
  }

  /** Posição e largura (no canvas) da nave mostrada no hangar: o lançamento começa dali. */
  getMenuShipPose() {
    const ship = $("ship-preview");
    const shipRect = ship?.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    if (!shipRect || !canvasRect.width || !canvasRect.height) {
      const { w, h } = viewport();

      return {
        x: w / 2,
        y: h * 0.46,
        width: 112,
      };
    }

    return {
      x: shipRect.left - canvasRect.left + shipRect.width / 2,
      y: shipRect.top - canvasRect.top + shipRect.height / 2,
      width: shipRect.width,
    };
  }

  /** Prepara a animação de lançamento (duração em segundos). */
  setLaunchParam(duration = 2) {
    // Lê a pose ANTES de trocar de tela, enquanto a nave do menu ainda está visível.
    const pose = this.getMenuShipPose();
    const { h } = viewport();
    // Escala inicial para a nave no canvas ter exatamente a largura da nave do menu.
    const startScale = pose.width / this.getSpriteSize().width;
    this.x = pose.x;
    this.y = pose.y;
    this.#launch = {
      elapsed: 0,
      duration: duration,
      startX: pose.x,
      startY: pose.y,
      startScale,
      scale: startScale,
      endY: h - px(90),
    };
  }

  /** Troca a arte da nave (índice em SHIPS). */
  setShipSkin(index) {
    this.#skinIndex = index;
    this.image = loadImage(ASSETS.ships[this.#skinIndex]);
  }

  /** Canos da nave atual: [{ x, y, vx }] com x/y em fração da imagem. */
  setMuzzles(muzzles) {
    this.#muzzles = muzzles?.length ? muzzles : Player.DEFAULT_MUZZLES;
  }

  /** Posição na tela de um cano, acompanhando tamanho e escala atuais da nave. */
  muzzlePosition(muzzle) {
    const { width, height } = this.getSpriteSize();
    const scale = this.#launch?.scale ?? 1;
    return {
      x: this.x + (muzzle.x - 0.5) * width * scale,
      y: this.y + (muzzle.y - 0.5) * height * scale,
    };
  }

  // ------------------------------------------------------------------
  // Dano recebido
  // ------------------------------------------------------------------

  /** Tira resistência do escudo; quando ele acaba, a hitbox volta ao tamanho da nave. */
  applyShieldDamage(amount) {
    this.resistance = Math.max(0, this.resistance - Math.max(0, Number(amount) || 0));
    if (this.resistance <= 0) this.updateHitbox();
  }

  /** Projétil de boss acertou a nave. O projétil some mesmo se a nave estiver invulnerável. */
  onProjectileHit(projectile) {
    if (!projectile || projectile.dead) return;
    projectile.dead = true;
    if (effects.isInvulnerable()) return;

    if (this.resistance <= 0) {
      this.emit("death", { player: this, projectile });
      return;
    }
    this.applyShieldDamage(projectile.damage);
  }

  /**
   * Batida no boss COM escudo: o escudo aguenta exatamente uma batida, seja qual for a
   * vida do boss ou do escudo. O escudo se esgota inteiro, a nave sobrevive (e é empurrada
   * para longe) e o boss não toma dano. Sem escudo, a batida mata (tratado antes).
   */
  onBossContact(boss) {
    const dx = this.x - boss.x;
    const dy = this.y - boss.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.vx += (dx / distance) * px(420);
    this.vy += (dy / distance) * px(420);
    this.applyShieldDamage(this.resistance); // esgota o escudo inteiro
  }

  /** Tamanho da nave acompanha a escala da tela (66px e raio 27 na tela de referência). */
  applyScale() {
    this.radius = px(27);
    this.width = px(66);
    this.height = px(66);
    this.updateHitbox();
  }

  /** Com escudo a hitbox é maior (a bolha do escudo); sem escudo, só a nave. */
  updateHitbox() {
    if (!this.hitbox) return;
    this.hitbox.radius = this.resistance > 0 ? this.radius + px(16) : this.radius;
  }

  /** Lê os upgrades do save (resistência e cadência). */
  applyUpgrades() {
    this.maxResistance = SAVE.upgrades_level.resistance * BALANCE.resistancePerLevel;
    this.fireRate = fireIntervalFor(SAVE.upgrades_level.fireRate);
  }

  /** Prepara a nave para uma nova partida (upgrades comprados no hangar já valem). */
  retryLevel() {
    this.applyUpgrades();
    this.vx = 0;
    this.vy = 0;
    this.#isShooting = false;
    this.resistance = this.maxResistance;
    this.shieldProgress = 0;
    this.#bullets = [];
    this.updateHitbox();
  }

  /** Atira por todos os canos, respeitando a cadência (e o card de tiro rápido). */
  shoot() {
    const now = performance.now();
    const fireInterval = this.fireRate * effects.fireIntervalMultiplier();
    if (now - this.#lastShotTime < fireInterval) return;
    this.#lastShotTime = now;
    Sfx.shoot(this.#skinIndex, effects.isActive("electricShot"));
    for (const muzzle of this.#muzzles) {
      const { x, y } = this.muzzlePosition(muzzle);
      this.#bullets.push(new Bullet(x, y, muzzle.vx ?? 0));
    }
  }

  /** Tiros da nave que ainda estão na tela. */
  get bullets() {
    return this.#bullets;
  }
}

/** A nave do jogador (instância única). */
const player = new Player();
