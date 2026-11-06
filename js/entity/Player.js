"use strict";

class Bullet {
  constructor(x, y, vx = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = -770;
    this.radius = 3.5;
    this.dead = false;
    this.damage = Math.max(
      0,
      1 + SAVE.upgrades_level.damage //+ effectDamageBonus() - effectDamagePenalty(),
    );
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
  // #FIRE_RATE = Math.max(
  //   BALANCE.minFireInterval,
  //   Math.round(
  //     BALANCE.baseFireInterval * Math.pow(0.89, SAVE.upgrades_level.fireRate),
  //   ),
  // );
  #shoots = 1;
  #FIRE_RATE = 340;
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
    this.radius = 27;
    this.width = 66;
    this.height = 66;
    this.image = loadImage(ASSETS.ships[this.#skinIndex]);
    ((this.resistance = 0), (this.maxResistance = this.resistance));
    this.vx = 0;
    this.vy = 0;
    this.acceleration = 1000;
    this.drag = 2.4;
    this.invuln = 0;
    this.hitbox = new Hitbox(this, this.radius);

    const onAsteroidContact = ({ other, group }) => {
      if (group !== "asteroids") return;
      if (this.invuln > 0 || other.dead) return;

      console.log("Nave atingida por um asteroide!");

      // this.invuln = 0.7;
      // Aqui você poderá implementar o dano da nave.
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
    // ========================================
    // TIROS
    // ========================================

    if (
      this.#keys.has("enter") ||
      this.#keys.has(" ") ||
      this.#isShooting
    ) {
      this.shoot();
    }

    this.#bullets.forEach(b => b.update(dt));
    this.#bullets = this.#bullets.filter(b => !b.dead);

    // ========================================
    // MOVIMENTAÇÃO
    // ========================================

    const { w, h } = viewport();
    const maxSpeed = BALANCE.baseMoveSpeed;

    // Direção desejada pelo jogador
    let dx = 0;
    let dy = 0;

    if (this.#keys.has("arrowleft") || this.#keys.has("a")) dx--;
    if (this.#keys.has("arrowright") || this.#keys.has("d")) dx++;
    if (this.#keys.has("arrowup") || this.#keys.has("w")) dy--;
    if (this.#keys.has("arrowdown") || this.#keys.has("s")) dy++;

    // ========================================
    // ACELERAÇÃO E INÉRCIA
    // ========================================

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

    // ========================================
    // LIMITE DE VELOCIDADE
    // ========================================

    const currentSpeed = Math.hypot(this.vx, this.vy);

    if (currentSpeed > maxSpeed) {
      const factor = maxSpeed / currentSpeed;

      this.vx *= factor;
      this.vy *= factor;
    }

    // ========================================
    // ATUALIZAÇÃO DA POSIÇÃO
    // ========================================

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // ========================================
    // LIMITES DA ARENA
    // ========================================

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

  draw(alpha = 1) {
    this.#bullets.forEach((b) => b.draw());
    const { width, height, image } = this;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.#launch.scale, this.#launch.scale);
    ctx.globalAlpha = alpha;
    drawSprite(image, -width / 2, -height / 2, width, height);
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
    if (now - this.#lastShotTime >= this.#FIRE_RATE) {
      this.#lastShotTime = now;
      playTone(560, 0.035, 0.018, "square"); // SOM do tiro
      switch (this.#shoots) {
        case 4:
          // Tiro Quádruplo
          this.#bullets.push(new Bullet(player.x - 12, player.y - 25, -135));
          this.#bullets.push(new Bullet(player.x - 4, player.y - 31, -45));
          this.#bullets.push(new Bullet(player.x + 4, player.y - 31, 45));
          this.#bullets.push(new Bullet(player.x + 12, player.y - 25, 135));
          break;
        case 3:
          // Tiro Triplo
          this.#bullets.push(new Bullet(player.x - 9, player.y - 25, -105));
          this.#bullets.push(new Bullet(player.x, player.y - 31, 0));
          this.#bullets.push(new Bullet(player.x + 9, player.y - 25, 105));
          break;
        case 2:
          // Tiro Duplo
          this.#bullets.push(new Bullet(player.x - 6, player.y - 29, -45));
          this.#bullets.push(new Bullet(player.x + 6, player.y - 29, 45));
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
