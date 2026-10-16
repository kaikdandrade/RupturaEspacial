"use strict";

function update(dt, now) {
  // Fundo de estrelas...
  const { h, w } = viewport();
  for (const star of stars) {
    const starFactor = ["launching", "playing"].includes(state.mode) ? 10 : 0.4;
    star.y += star.speed * dt * starFactor;
    if (star.y > h + 2) {
      star.y = -2;
      star.x = Math.random() * w;
    }
  }

  // Particulas...
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.96, dt * 60);
    p.vy *= Math.pow(0.96, dt * 60);
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  // Lançamento (quando a nave mergulha)...
  if (state.mode === "launching") {
    player.updateLaunch(dt);
    return;
  }

  if (state.mode !== "playing") return;
  // state.time += dt;
  // state.score += dt * (4 + state.selectedLevel * 0.65);

  // if (state.levelConfig.isBoss) updateBossSummons(dt);
  // else updateNormalSpawner(dt);
  updateNormalSpawner(dt);

  // const wantsShoot = keys.has(" ") || keys.has("space") || state.pointerDown;
  // if (wantsShoot) shoot(now);

  player.update(dt);
  // applyGravityFields(dt);
  bullets.forEach((b) => b.update(dt));
  asteroids.forEach((a) => a.update(dt));
  // enemyProjectiles.forEach((p) => p.update(dt));
  // pickups.forEach((p) => p.update(dt));
  // handleCollisions();

  // bullets = bullets.filter((b) => !b.dead);
  // asteroids = asteroids.filter((a) => !a.dead);
  // enemyProjectiles = enemyProjectiles.filter((p) => !p.dead);
  // pickups = pickups.filter((p) => !p.dead);

  // state.shake *= Math.pow(0.86, dt * 60);
  // state.flash = Math.max(0, state.flash - dt);
  // updateHud();
}

function drawBackground() {
  const { w, h } = viewport();
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#dceaff";
    ctx.fillRect(star.x, star.y, star.size, star.size * 1.35);
  }

  const glow = ctx.createRadialGradient(
    w * 0.5,
    h * 1.04,
    0,
    w * 0.5,
    h * 1.04,
    Math.max(w, h) * 0.72,
  );
  glow.addColorStop(0, "rgba(71,84,220,.18)");
  glow.addColorStop(1, "rgba(71,84,220,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawArenaField() {
  // if (!state.levelConfig) return;
  const { w, h } = viewport();
  const x = 9;
  const y = 78;
  const width = Math.max(30, w - 18);
  const height = Math.max(50, h - 88);
  ctx.save();
  // const boss = state.levelConfig.isBoss;
  ctx.strokeStyle = "rgba(115, 164, 255, .1)";
  // ctx.strokeStyle = boss
  //   ? "rgba(255, 193, 91, .13)"
  //   : "rgba(115, 164, 255, .1)";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([8, 12]);
  roundedRectPath(x, y, width, height, 26);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.6;
  const glow = ctx.createLinearGradient(0, y, 0, y + 80);
  // glow.addColorStop(
  // 0,
  // boss ? "rgba(255, 180, 61, .055)" : "rgba(91, 142, 255, .045)",
  // );
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x + 12, y + 1, width - 24, 90);
  ctx.restore();
}

function draw() {
  const { w, h } = viewport();
  ctx.clearRect(0, 0, w, h);
  drawBackground();

  const activeGameScene = [
    "launching",
    "playing",
    "paused",
    "gameover",
    "complete",
  ].includes(state.mode);
  const sx = state.mode === "playing" ? random(-state.shake, state.shake) : 0;
  const sy = state.mode === "playing" ? random(-state.shake, state.shake) : 0;

  ctx.save();
  ctx.translate(sx, sy);

  if (activeGameScene) {
    drawArenaField();
    pickups.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    bullets.forEach((b) => b.draw());
    enemyProjectiles.forEach((p) => p.draw());
    player.draw();
  }

  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 104, 118, ${state.flash * 1.4})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function loop(now) {
  let dt = Math.min(0.033, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (state.mode === "paused") dt = 0;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
