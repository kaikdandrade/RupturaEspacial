"use strict";

class Asteroid {
  constructor({
    x,
    y = -70,
    hp,
    speed,
    type = "common",
    size = null,
    child = false,
    boss = false,
    helper = false,
    isPrimary = true,
    entryDelay = 0,
  }) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.child = child;
    this.boss = boss;
    this.helper = helper;
    this.isPrimary = !!isPrimary;
    this.maxHp = Math.max(1, Math.round(hp));
    this.hp = this.maxHp;
    this.speed = speed;
    this.size = size || random(55, 79);
    this.radius = this.size * 0.37;
    this.rotation = random(0, Math.PI * 2);
    this.rotationSpeed = random(-0.75, 0.75);
    this.dead = false;
    this.age = 0;
    this.entryDelay = Math.max(0, entryDelay);
    this.enteredArena = y >= 78 + this.radius;
    const launchAngle = random(Math.PI * 0.22, Math.PI * 0.78);
    this.vx = Math.cos(launchAngle) * this.speed * random(0.68, 1.02);
    this.vy = Math.sin(launchAngle) * this.speed * random(0.82, 1.08);
    this.burnTicks = 0;
    this.nextBurn = 0;
    this.thornTimer = boss ? 0.7 : 1;
    this.cyberTimer = boss ? random(0.9, 1.35) : random(2.1, 3.0);
    this.cyberCharge = 0;
    this.cyberAim = 0;
    this.orbitHost = null;
    this.orbitAngle = 0;
    this.orbitRadius = 0;
    this.orbitSpeed = 0;
    this.gravityCaptureTimer = boss ? 1.2 : 1.8;
    this.image = this.resolveImage();

    this.armor = 0;
    this.maxArmor = 0;
    if (this.type === "resistance") {
      const armorFactor = this.boss ? 1.35 : 0.9;
      this.maxArmor = Math.max(2, Math.ceil(this.maxHp * armorFactor));
      this.armor = this.maxArmor;
      this.size *= this.boss ? 1.28 : 1.06;
      this.radius = this.size * 0.39;
    }

    if (this.type === "fractionalSlice") {
      this.size *= 0.58;
      this.radius = this.size * 0.34;
    }

    if (this.type === "cyber") {
      this.size *= this.boss ? 1.34 : 1.05;
      this.radius = this.size * 0.36;
    }

    if (this.type === "gravity" && this.boss) {
      this.size *= 1.34;
      this.radius = this.size * 0.38;
    }

    if (this.type === "thorny" && this.boss) {
      this.size *= 1.3;
      this.radius = this.size * 0.38;
    }
  }

  resolveImage() {
    if (this.type === "common")
      return loadImage(
        ASSETS.common[Math.floor(Math.random() * ASSETS.common.length)],
      );
    if (this.type === "fractionalSlice")
      return loadImage(ASSETS.special.fractionalSlice);
    return loadImage(ASSETS.special[this.type] || ASSETS.common[0]);
  }

  applyBurn(ticks = 5) {
    this.burnTicks = Math.max(this.burnTicks, ticks);
    this.nextBurn = Math.min(this.nextBurn || state.time, state.time + 0.06);
  }

  updateBurn() {
    if (this.burnTicks <= 0 || state.time < this.nextBurn || this.dead) return;
    this.burnTicks--;
    this.nextBurn = state.time + 0.52;
    this.hit(1, "burn");
    if (!this.dead)
      burst(
        this.x + random(-10, 10),
        this.y + random(-10, 10),
        "#ff8a54",
        5,
        55,
      );
  }

  gravityShieldCount() {
    if (this.type !== "gravity") return 0;
    return asteroids.reduce(
      (sum, candidate) =>
        sum + (!candidate.dead && candidate.orbitHost === this ? 1 : 0),
      0,
    );
  }

  updateOrbit(dt) {
    if (!this.orbitHost || this.orbitHost.dead) {
      if (this.orbitHost?.dead) releaseFromGravityOrbit(this);
      return false;
    }
    this.orbitAngle += this.orbitSpeed * dt * 60;
    this.x = this.orbitHost.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.orbitHost.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.rotation += this.rotationSpeed * dt;
    return true;
  }

  applyArenaSteering(dt, movementFactor = 1) {
    const { w, h } = viewport();
    const shieldPadding = this.boss && this.type === "gravity" ? 82 : 0;
    const top = 82 + this.radius + shieldPadding;
    const bottom = h - 14 - this.radius - shieldPadding;
    const left = 10 + this.radius + shieldPadding;
    const right = w - 10 - this.radius - shieldPadding;
    const band = Math.min(125, Math.max(72, Math.min(w, h) * 0.14));
    const turnForce = this.boss ? 310 : 255;
    let ax = 0;
    let ay = 0;

    const dl = this.x - left;
    const dr = right - this.x;
    const dtp = this.y - top;
    const db = bottom - this.y;
    if (dl < band) ax += (1 - dl / band) * turnForce;
    if (dr < band) ax -= (1 - dr / band) * turnForce;
    if (dtp < band) ay += (1 - dtp / band) * turnForce;
    if (db < band) ay -= (1 - db / band) * turnForce;

    // Gravity boss persegue o jogador, mas continua preso ao campo orbital.
    if (this.boss && this.type === "gravity" && player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      ax += (dx / d) * 92;
      ay += (dy / d) * 92;
    }

    this.vx += ax * dt;
    this.vy += ay * dt;

    const current = Math.hypot(this.vx, this.vy) || 1;
    const desired = this.speed * (this.boss ? 0.86 : 1);
    const adjust = clamp((desired - current) * dt * 1.8, -24, 24);
    this.vx += (this.vx / current) * adjust;
    this.vy += (this.vy / current) * adjust;

    this.x += this.vx * dt * movementFactor;
    this.y += this.vy * dt * movementFactor;

    // Segurança contra escapes num frame muito rápido. O retorno é suave; não há ricochete seco.
    if (this.x < left - 12) {
      this.x = left - 12;
      this.vx = Math.abs(this.vx) * 0.55;
    }
    if (this.x > right + 12) {
      this.x = right + 12;
      this.vx = -Math.abs(this.vx) * 0.55;
    }
    if (this.y < top - 12) {
      this.y = top - 12;
      this.vy = Math.abs(this.vy) * 0.55;
    }
    if (this.y > bottom + 12) {
      this.y = bottom + 12;
      this.vy = -Math.abs(this.vy) * 0.55;
    }
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;
    this.updateBurn();
    if (this.dead) return;

    if (this.orbitHost && this.updateOrbit(dt)) return;

    if (this.entryDelay > 0) {
      this.entryDelay -= dt;
      this.rotation += this.rotationSpeed * dt;
      return;
    }

    const slow = asteroidSpeedFactor();

    if (this.type === "cyber" && player) {
      const aim = Math.atan2(player.y - this.y, player.x - this.x);
      this.rotation = aim + Math.PI / 2;
      this.cyberAim = aim;
      if (this.cyberCharge > 0) {
        this.cyberCharge -= dt;
        if (this.cyberCharge <= 0) {
          const ox = Math.cos(this.cyberAim) * this.radius * 0.72;
          const oy = Math.sin(this.cyberAim) * this.radius * 0.72;
          enemyProjectiles.push(
            new CyberOrbProjectile(
              this.x + ox,
              this.y + oy,
              this.cyberAim,
              this.boss,
            ),
          );
          this.cyberTimer = this.boss ? random(0.95, 1.45) : random(2.3, 3.2);
          playTone(this.boss ? 320 : 270, 0.12, 0.025, "sine");
        }
      } else {
        this.cyberTimer -= dt;
        if (this.cyberTimer <= 0) this.cyberCharge = this.boss ? 0.38 : 0.7;
      }
    } else {
      this.rotation += this.rotationSpeed * dt;
    }

    if (this.type === "thorny") {
      this.thornTimer -= dt;
      if (this.thornTimer <= 0) {
        this.thornTimer += this.boss ? 0.7 : 1;
        fireThornSpike(this);
      }
    }

    if (!this.enteredArena) {
      this.y += this.speed * 1.12 * dt * slow;
      this.x += this.vx * 0.16 * dt * slow;
      if (this.y >= 82 + this.radius) this.enteredArena = true;
      return;
    }

    this.applyArenaSteering(dt, slow);
  }

  hit(damage, source = "shot") {
    if (this.dead) return;
    const amount = Math.max(0, Math.round(damage));
    if (amount <= 0) {
      burst(this.x, this.y, "#7d879f", 3, 45);
      return;
    }

    if (this.type === "gravity" && this.gravityShieldCount() > 0) {
      burst(this.x, this.y, "#ad8cff", 7, 70);
      playTone(205, 0.045, 0.012, "sine");
      return;
    }

    if (this.armor > 0) {
      this.armor = Math.max(0, this.armor - amount);
      burst(
        this.x,
        this.y - this.radius * 0.2,
        "#63d9ff",
        Math.min(8, amount + 2),
        75,
      );
      if (this.armor === 0) {
        state.shake = Math.min(8, state.shake + 1.6);
        burst(this.x, this.y, "#8deaff", 14, 110);
        playTone(410, 0.08, 0.025, "square");
      }
      return;
    }

    this.hp -= amount;
    burst(
      this.x,
      this.y - this.radius * 0.25,
      source === "burn" ? "#ff8a54" : "#90efff",
      Math.min(7, amount + 2),
      70,
    );
    if (this.hp <= 0) this.destroy(source);
  }

  collisionPower() {
    if (this.boss) return Math.max(8, Math.ceil((this.hp + this.armor) * 0.22));
    return Math.max(1, this.hp + this.armor);
  }

  destroy(reason = "shot") {
    if (this.dead) return;
    this.dead = true;
    const playerKill = reason === "shot" || reason === "burn";

    if (this.orbitHost) this.orbitHost = null;
    for (const satellite of asteroids) {
      if (!satellite.dead && satellite.orbitHost === this)
        releaseFromGravityOrbit(satellite);
    }

    if (this.isPrimary && !this.child && !this.boss) state.kills++;
    state.totalDestroyed++;

    if (playerKill) {
      const specialBonus =
        this.type === "common" || this.type === "fractionalSlice"
          ? 0
          : this.boss
            ? 22
            : 4;
      const reward = Math.max(
        1,
        Math.round(
          this.maxHp * (this.boss ? 1.2 : this.child ? 0.22 : 0.5) +
            specialBonus,
        ),
      );
      state.runCoins += reward;
      state.score += Math.round(
        this.maxHp * (this.boss ? 34 : this.child ? 6 : 12) + specialBonus * 12,
      );
      state.shake = Math.min(
        12,
        state.shake + (this.boss ? 7 : this.child ? 1 : 2.4),
      );
      burst(
        this.x,
        this.y,
        this.type === "volcanic"
          ? "#ff8b56"
          : this.boss
            ? "#ffe7a1"
            : "#c2dcff",
        this.boss ? 34 : this.child ? 8 : 15,
        this.boss ? 220 : 145,
      );
      playTone(
        this.boss ? 92 : 130,
        this.boss ? 0.18 : 0.07,
        this.boss ? 0.04 : 0.025,
        "triangle",
      );
      this.onPlayerDestroyed();
    }

    if (this.boss && state.boss === this) state.boss = null;
    checkLevelCompletion();
  }

  onPlayerDestroyed() {
    if (this.type === "fractional" && !this.child) spawnFractionalSlices(this);
    if (this.type === "frozen")
      pickups.push(new PickupCard(this.x, this.y, "frozen"));
    if (this.type === "mystic")
      pickups.push(new PickupCard(this.x, this.y, "mystic"));
    if (this.type === "volcanic")
      pickups.push(new PickupCard(this.x, this.y, "volcanic"));
    if (this.type === "thorny") releaseThornBurst(this, this.boss ? 5 : null);
  }

  drawGravityLinks() {
    if (this.type !== "gravity") return;
    const satellites = asteroids.filter((a) => !a.dead && a.orbitHost === this);
    if (!satellites.length) return;
    ctx.save();
    ctx.strokeStyle = "rgba(176, 126, 255, .36)";
    ctx.lineWidth = 1.7;
    ctx.setLineDash([5, 6]);
    for (const sat of satellites) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sat.x - this.x, sat.y - this.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.boss) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,210,112,.58)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 8]);
      ctx.rotate(this.age * 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.type === "gravity") {
      this.drawGravityLinks();
      const aura = loadImage(ASSETS.special.gravityAura);
      ctx.save();
      ctx.globalAlpha = this.gravityShieldCount() ? 0.88 : 0.48;
      ctx.rotate(-this.age * 0.22);
      const auraSize = this.size * (this.boss ? 2.0 : 1.65);
      drawSprite(aura, -auraSize / 2, -auraSize / 2, auraSize, auraSize);
      ctx.restore();
    }

    if (this.burnTicks > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.age * 15) * 0.12;
      ctx.shadowColor = "#ff6f42";
      ctx.shadowBlur = 25;
      ctx.strokeStyle = "#ff8a54";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(this.rotation);
    ctx.shadowColor =
      this.type === "cyber"
        ? "rgba(57,171,255,.48)"
        : this.boss
          ? "rgba(255,213,118,.34)"
          : "rgba(0,0,0,.24)";
    ctx.shadowBlur = this.boss ? 20 : this.type === "cyber" ? 16 : 8;
    if (
      !drawSprite(
        this.image,
        -this.size / 2,
        -this.size / 2,
        this.size,
        this.size,
      )
    ) {
      ctx.fillStyle = "#8b92a6";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (this.type === "cyber" && this.cyberCharge > 0) {
      const duration = this.boss ? 0.38 : 0.7;
      const progress = 1 - this.cyberCharge / duration;
      const d = this.radius * 0.78;
      const ox = Math.cos(this.cyberAim) * d;
      const oy = Math.sin(this.cyberAim) * d;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.globalAlpha = 0.55 + progress * 0.45;
      ctx.fillStyle = "#8deeff";
      ctx.shadowColor = "#35adff";
      ctx.shadowBlur = this.boss ? 25 : 18;
      ctx.beginPath();
      ctx.arc(0, 0, 4 + progress * (this.boss ? 9 : 6), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.armor > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(92, 222, 255, .9)";
      ctx.lineWidth = this.boss ? 4 : 3;
      ctx.shadowColor = "#43cbff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        this.radius * 1.1,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (this.armor / this.maxArmor),
      );
      ctx.stroke();
      ctx.restore();
    }

    drawAsteroidCounter(this);
    ctx.restore();
  }
}
