"use strict";

class Player {
  #keys = new Set();
  #launch = {};
  #isShooting = false;
  #lastShotTime = 0;
  #FIRE_RATE = Math.max(
    BALANCE.minFireInterval,
    Math.round(
      BALANCE.baseFireInterval * Math.pow(0.89, SAVE.upgrades_level.fireRate),
    ),
  );

  constructor() {
    const { w, h } = viewport();
    this.x = w / 2;
    this.y = h - 90;
    this.radius = 21;
    this.width = 66;
    this.height = 66;
    this.image = loadImage(ASSETS.ships[SAVE.selectedShip]);
    ((this.resistance = 0), (this.maxResistance = this.resistance));
    this.invuln = 0;

    window.addEventListener("keydown", (event) => {
      event.preventDefault();
      const key = event.key.toLowerCase();

      if (
        [
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
        ].includes(key)
      )
        this.#keys.add(key);
    });
    window.addEventListener("keyup", (event) =>
      this.#keys.delete(event.key.toLowerCase()),
    );
    let shootInterval = null;
    window.addEventListener(
      "mousedown",
      (e) => (this.#isShooting = e.button === 0),
    );
    window.addEventListener("mouseup", _ => (this.#isShooting = false));
    window.addEventListener("blur", (_) => {
      this.#keys = new Set();
      this.#isShooting = false;
    });
  }

  update(dt) {
    // Tiro da nave
    if (this.#keys.has("enter") || this.#isShooting) 
      this.shoot();

    // Movimentação da nave
    const { w, h } = viewport();
    const speed = stats.moveSpeed();
    let dx = 0;
    let dy = 0;

    if (this.#keys.has("arrowleft") || this.#keys.has("a")) dx -= 1;
    if (this.#keys.has("arrowright") || this.#keys.has("d")) dx += 1;
    if (this.#keys.has("arrowup") || this.#keys.has("w")) dy -= 1;
    if (this.#keys.has("arrowdown") || this.#keys.has("s")) dy += 1;

    // Normalização da velocidade quando nave em diagonal
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      this.x += (dx / len) * speed * dt;
      this.y += (dy / len) * speed * dt;
    }

    this.x = clamp(this.x, this.radius + 7, w - this.radius - 14);
    this.y = clamp(this.y, 80, h - this.radius - 9);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  /**
   * Cria a animação da nave:
   * - começa em startY;
   * - diminui de startScale até minScale;
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
      this.#launch.scale =
        this.#launch.startScale + (minScale - this.#launch.startScale) * e;
      this.x = w / 2;
      const exitY = -(this.height * minScale);
      this.y = this.#launch.startY + (exitY - this.#launch.startY) * e;
    } else {
      const p = (t - split) / (1 - split);
      const e = 1 - Math.pow(1 - p, 3);
      const scaledHeight = this.height * minScale;
      const entryY = h + scaledHeight;
      this.y = entryY + (this.#launch.endY - entryY) * e;
      this.#launch.scale = minScale + (1 - minScale) * e;
    }

    if (t >= 1) {
      this.y = this.#launch.endY;
      this.#launch.scale = 1;
    }
  }

  draw(alpha = 1) {
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
      startScale: clamp(pose.size / Math.max(1, this.height), 1.15, 2.1),
      endY: h - 90,
    };
  }

  shoot() {
    const now = performance.now();
    if (now - this.#lastShotTime >= this.#FIRE_RATE) {
      this.#lastShotTime = now;
      bullets.push(new Bullet(player.x, player.y - 29, 0));

      // Tiro Triplo
      // bullets.push(new Bullet(player.x - 9, player.y - 25, -105));
      // bullets.push(new Bullet(player.x, player.y - 31, 0));
      // bullets.push(new Bullet(player.x + 9, player.y - 25, 105));
      playTone(560, 0.035, 0.018, "square");
    }
  }
}

const player = new Player();