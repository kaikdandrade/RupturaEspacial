"use strict";

class Bullet {
  constructor(x, y, vx = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = -770;
    this.radius = 3.5;
    this.dead = false;
    this.damage = SAVE.upgrades_level.damage * BALANCE.damagePerLevel + 1;
    this.hitbox = new Hitbox(this, this.radius);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const { w } = viewport();
    if (this.y < -20 || this.x < -25 || this.x > w + 25) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = "#86f6ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#5eeaff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + 15);
    ctx.lineTo(this.x - this.vx * 0.008, this.y - 7);
    ctx.stroke();
    ctx.restore();
  }
}

class Player {
  #skinIndex = SAVE.selectedShip;
  #keys = new Set();
  #launch = {};
  #isShooting = false;
  #lastShotTime = 0;
  #bullets = [];
  #shoots = 1;
  #ACTION_KEYS = [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "a",
    "w",
    "s",
    "d",
    "enter",
    " ",
  ];

  constructor() {
    const { w, h } = viewport();
    this.x = w / 2;
    this.y = h - 90;
    this.vx = 0;
    this.vy = 0;
    this.radius = 27;
    this.width = 66;
    this.height = 66;
    this.image = loadImage(ASSETS.ships[this.#skinIndex]);
    this.resistance = SAVE.upgrades_level.resistance * BALANCE.resistancePerLevel;
    this.maxResistance = this.resistance;
    this.shieldProgress = 0;
    this.shieldDisplayedResistance = 0;
    this.acceleration = 1000;
    this.drag = 2.4;
    this.fireRate = BALANCE.baseFireInterval - (SAVE.upgrades_level.fireRate * BALANCE.fireRatePerLevel);
    this.invuln = 0;
    this.hitbox = new Hitbox(this, (this.resistance) ? this.radius + 16 : this.radius);

    const onAsteroidContact = ({ other, group }) => {
      if (group !== "asteroids") return;
      if (this.invuln > 0 || other.dead) return;

      // Próximo impacto após perder o escudo = Game Over
      if (this.resistance <= 0) {
        state.mode = "gameover";
        showModal(state.mode);
        return;
      }

      const damage = Math.max(0, Number(other.hp) || 0); // Dano ao PLayer pelo impacto
      other.destroy(); // Destrói o asteroide
      this.resistance = Math.max(0, this.resistance - damage); // Aplica o dano à resistência

      // Quando o escudo acaba, restaura a hitbox original
      if (this.resistance <= 0) {
        this.hitbox = new Hitbox(this, this.radius);

        // Registra novamente o evento de colisão
        this.hitbox.on("enter", onAsteroidContact);
      }
    };

    this.hitbox.on("enter", onAsteroidContact);
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (this.#ACTION_KEYS.includes(key)) {
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
    if (["enter", " "].includes([...this.#keys]) || this.#isShooting)
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

    // Guarda o último valor para exibir durante a animação
    // de desaparecimento.
    if (shieldActive) {
      this.shieldDisplayedResistance = Math.ceil(this.resistance);
    }

    // ============================
    // MOVIMENTAÇÃO
    // ============================
    const { w, h } = viewport();
    const maxSpeed = BALANCE.baseMoveSpeed;

    // Direção desejada pelo jogador
    let dx = 0;
    let dy = 0;
    if (this.#keys.has("arrowleft") || this.#keys.has("a")) dx--;
    if (this.#keys.has("arrowright") || this.#keys.has("d")) dx++;
    if (this.#keys.has("arrowup") || this.#keys.has("w")) dy--;
    if (this.#keys.has("arrowdown") || this.#keys.has("s")) dy++;

    // ACELERAÇÃO E INÉRCIA
    if (dx !== 0 || dy !== 0) {
      // Normaliza a direção diagonal
      const length = Math.hypot(dx, dy);

      dx /= length;
      dy /= length;

      // Aplica a aceleração
      this.vx += dx * this.acceleration * dt;
      this.vy += dy * this.acceleration * dt;

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
    const margin = this.radius + 8;
    const minX = margin;
    const maxX = Math.max(minX, w - margin);
    const minY = margin;
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

    // Invulnerabilidade
    // this.invuln = Math.max(0, this.invuln - dt);
  }

  /**
   * Cria a animação da nave:
   * - começa em startY;
   * - diminui o scale até minScale;
   * - sobe até sair pelo topo.
   * - aparece abaixo da viewport;
   * - sobe até endY;
   * - recupera a escala até 1.
   */
  updateLaunch(dt) {
    if (!this.#launch) return;
    this.#launch.elapsed += dt;
    const { w, h } = viewport();
    const t = clamp(this.#launch.elapsed / this.#launch.duration, 0, 1);
    const minScale = 0.24;
    const split = 0.5;

    if (t < split) {
      const p = t / split;
      const e = p * p * (3 - 2 * p);
      this.#launch.scale = 1.1 + (minScale - 1.1) * e;
      this.x = w / 2;
      const exitY = -(this.height * minScale);
      this.y = this.#launch.startY + (exitY - this.#launch.startY) * e;
    } else {
      const p = (t - split) / (1 - split);
      const e = 1 - Math.pow(1 - p, 3);
      const scaledHeight = this.height * minScale;
      const entryY = h + scaledHeight;
      this.y = entryY + (this.#launch.endY - entryY) * e;
      this.#launch.scale = minScale + (1.25 - minScale) * e;
    }

    if (t >= 1) {
      this.y = this.#launch.endY;
      this.#launch.scale = 1.25;
    }
  }

  draw() {
    this.#bullets.forEach((b) => b.draw());
    const { width, height, image } = this;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.#launch.scale, this.#launch.scale);
    ctx.globalAlpha = 1;
    drawSprite(image, -width / 2, -height / 2, width, height);
    if (state.mode != "launching") this.drawShield();
    ctx.restore();
  }

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

    const radius = this.radius + 8;
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
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = shieldColor;
    ctx.shadowBlur = critical
      ? 12 + oscillation * 8
      : 12;

    ctx.stroke();

    // ========================================
    // ARCOS DE ENERGIA
    // ========================================
    ctx.globalAlpha = parentAlpha * progress * arcOpacity;
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.shadowColor = shieldColor;
    ctx.shadowBlur = critical
      ? 8 + oscillation * 10
      : 0;

    const rotation = time * 0.8;
    const spacing = (Math.PI * 2) / 3;

    for (let i = 0; i < arcCount; i++) {
      const start = rotation + i * spacing;
      const end = start + 0.65;

      ctx.beginPath();
      ctx.arc(0, 0, radius + 3, start, end);
      ctx.stroke();
    }

    ctx.restore();
  }

  getMenuShipPose() {
    const ship = $("shipPreview");
    const shipRect = ship?.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    if (!shipRect || !canvasRect.width || !canvasRect.height) {
      const { w, h } = viewport();

      return {
        x: w / 2,
        y: h * 0.46,
        size: 112,
      };
    }

    return {
      x: shipRect.left - canvasRect.left + shipRect.width / 2,
      y: shipRect.top - canvasRect.top + shipRect.height / 2,
      size: Math.max(72, Math.min(shipRect.width, shipRect.height)),
    };
  }

  setLaunchParam(duration = 2) {
    const pose = this.getMenuShipPose();
    const { h } = viewport();
    this.#launch = {
      elapsed: 0,
      duration: duration,
      startX: pose.x,
      startY: pose.y,
      endY: h - 90,
    };
  }

  setShipSkin(index) {
    this.#skinIndex = index;
    this.image = loadImage(ASSETS.ships[this.#skinIndex]);
  }

  setShoots(n) {
    this.#shoots = n;
  }

  shoot() {
    const now = performance.now();
    if (now - this.#lastShotTime >= this.fireRate) {
      this.#lastShotTime = now;
      playTone(560, 0.035, 0.018, "square"); // SOM do tiro
      switch (this.#shoots) {
        case 4:
          // Tiro Quádruplo
          this.#bullets.push(new Bullet(player.x - 6, player.y - 12, -58));
          this.#bullets.push(new Bullet(player.x - 2, player.y - 15, -22));
          this.#bullets.push(new Bullet(player.x + 2, player.y - 15, 22));
          this.#bullets.push(new Bullet(player.x + 6, player.y - 12, 58));
          break;
        case 3:
          // Tiro Triplo
          this.#bullets.push(new Bullet(player.x - 3, player.y - 12, -52));
          this.#bullets.push(new Bullet(player.x, player.y - 15, 0));
          this.#bullets.push(new Bullet(player.x + 3, player.y - 12, 52));
          break;
        case 2:
          // Tiro Duplo
          this.#bullets.push(new Bullet(player.x - 3, player.y - 15, -22));
          this.#bullets.push(new Bullet(player.x + 3, player.y - 15, 22));
          break;
        case 1:
        default:
          // Tiro Simples
          this.#bullets.push(new Bullet(player.x, player.y - 29, 0));
          break;
      }
    }
  }

  get bullets() {
    return this.#bullets;
  }
}

const player = new Player();
