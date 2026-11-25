"use strict";

/**
 * @file Laço principal: update() avança o jogo, draw() desenha o quadro e loop() chama os dois
 * a cada quadro do navegador (requestAnimationFrame). Carregado por último: é ele que
 * inicia o jogo (resize + primeiro quadro).
 */

/** Maior passo de tempo de um quadro (s): evita saltos enormes depois de um travamento. */
const MAX_FRAME_TIME = 0.033;

/** Instante (ms) do quadro anterior. */
let lastFrame = performance.now();

// ============================================================
// UPDATE
// ============================================================

/** Relógio da partida + pontos de sobrevivência (só nos primeiros segundos) + janela do combo. */
function updateRunClock(dt) {
  const previousTime = state.playing.time;
  state.playing.time += dt;

  const { timeLimit, timePerSecond } = BALANCE.score;
  const rewardedTime = Math.max(0, Math.min(state.playing.time, timeLimit) - Math.min(previousTime, timeLimit));
  state.playing.score += rewardedTime * timePerSecond * state.levelConfig.enemies.averageHp;

  const combo = state.playing.combo;
  if (combo.timer > 0) {
    combo.timer = Math.max(0, combo.timer - dt);
    if (combo.timer === 0) combo.count = 0;
  }
}

/** Estrelas do fundo descendo (rápido durante a partida, devagar no menu). */
function updateStars(dt) {
  const { w, h } = viewport();
  const speed = state.mode === "launching" || state.mode === "playing" ? 10 : 0.4;
  for (const star of stars) {
    star.y += star.speed * dt * speed;
    if (star.y > h + 2) {
      star.y = -2;
      star.x = Math.random() * w;
    }
  }
}

/**
 * O setor foi vencido?
 * - Normal: todos os asteroides do objetivo foram gerados e destruídos e a arena está vazia.
 * - Boss: o boss caiu (Hidra/Binário: só quando o último pedaço cai; os da arena não precisam morrer).
 */
function levelWon() {
  if (state.levelConfig.isLevelBoss) return state.bossSpawned && !state.boss;
  const plan = state.spawnPlan;
  return plan.spawned >= plan.total && state.playing.kills.total >= plan.total && asteroids.length === 0;
}

/** Um quadro da partida: geração, movimento, colisões, efeitos e o fim do setor. */
function updatePlaying(dt) {
  updateRunClock(dt);
  if (state.levelConfig.isLevelBoss) updateBossSummons(dt);
  else updateNormalSpawner(dt);

  player.update(dt);
  for (const a of asteroids) a.update(dt);
  for (const p of pickups) p.update(dt);
  collisions.update();
  effects.update(dt);

  asteroids = asteroids.filter((a) => !a.dead);
  pickups = pickups.filter((p) => !p.dead);

  if (levelWon()) {
    // Boss derrotado: os asteroides da arena somem junto
    if (state.levelConfig.isLevelBoss) asteroids.forEach((a) => a.helper && a.destroy("bossDown"));
    winLevel();
  }

  state.shake *= Math.pow(0.86, dt * 60);
  state.flash = Math.max(0, state.flash - dt);
  updateHud();
}

/** Avança o jogo `dt` segundos, conforme o modo atual. */
function update(dt) {
  updateStars(dt);
  updateFx(dt);
  touchControls.sync(); // mostra/esconde os controles de toque conforme o modo
  syncMusic(dt);        // música certa para o modo atual
  switch (state.mode) {
    case "launching": // nave saindo do hangar: quando termina, a partida começa
      if (player.updateLaunch(dt)) startEncounter();
      break;
    case "menu":
      updateMenuUI();
      break;
    case "playing":
      updatePlaying(dt);
      break;
  }
}

// ============================================================
// DRAW
// ============================================================

/** Gradientes do fundo, recriados só quando a tela muda de tamanho (resize limpa). */
let backgroundGradients = null;

/** Brilho azul no fundo da tela. */
function drawBackgroundGlow() {
  const { w, h } = viewport();
  backgroundGradients ??= {
    glow: (() => {
      const g = ctx.createRadialGradient(w * 0.5, h * 1.04, 0, w * 0.5, h * 1.04, Math.max(w, h) * 0.72);
      g.addColorStop(0, "rgba(71,84,220,.18)");
      g.addColorStop(1, "rgba(71,84,220,0)");
      return g;
    })(),
    arenaTop: { normal: null, boss: null },
  };
  ctx.fillStyle = backgroundGradients.glow;
  ctx.fillRect(0, 0, w, h);
}

/** Moldura tracejada da arena (dourada em setor de boss) com um leve brilho no topo. */
function drawArenaField(boss) {
  const { w, h } = viewport();
  const x = 9, y = ARENA_TOP - 4;
  const width = Math.max(30, w - 18), height = Math.max(50, h - 88);
  ctx.save();
  ctx.strokeStyle = boss ? "rgba(255, 193, 91, .13)" : "rgba(115, 164, 255, .1)";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([8, 12]);
  roundedRectPath(x, y, width, height, 26);
  ctx.stroke();
  ctx.setLineDash([]);
  const key = boss ? "boss" : "normal";
  let top = backgroundGradients.arenaTop[key];
  if (!top) {
    top = ctx.createLinearGradient(0, y, 0, y + 80);
    top.addColorStop(0, boss ? "rgba(255, 180, 61, .033)" : "rgba(91, 142, 255, .027)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    backgroundGradients.arenaTop[key] = top;
  }
  ctx.fillStyle = top;
  ctx.fillRect(x + 12, y + 1, width - 24, 90);
  ctx.restore();
}

/** Estrelas do fundo. */
function drawStars() {
  ctx.fillStyle = "#dceaff";
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillRect(star.x, star.y, star.size, star.size * 1.35);
  }
  ctx.globalAlpha = 1;
}

/** Hitboxes (só com VIEW_HITBOX ligado). */
function drawHitboxes() {
  const circle = (hitbox, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
    ctx.stroke();
  };
  circle(player.hitbox, "#00ff00");
  for (const a of asteroids) circle(a.hitbox, "#ff0000");
  for (const b of player.bullets) circle(b.hitbox, "#00ffff");
}

/** Desenha o quadro atual. */
function draw() {
  const { w, h } = viewport();
  ctx.clearRect(0, 0, w, h);
  drawStars();

  drawBackgroundGlow();
  const inGame = state.mode !== "menu";
  if (inGame) drawArenaField(!!state.levelConfig?.isLevelBoss);

  // Tremor da tela (só enquanto joga)
  const shake = state.mode === "playing" ? state.shake : 0;
  ctx.save();
  ctx.translate(random(-shake, shake), random(-shake, shake));
  if (inGame) {
    for (const p of pickups) p.draw();
    for (const a of asteroids) a.draw();
    drawBolts();
    player.draw();
  }
  drawParticles();
  drawFloatingTexts();
  ctx.restore();

  // Flash vermelho de dano
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 104, 118, ${state.flash * 1.4})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (VIEW_HITBOX && state.mode === "playing") drawHitboxes();
}

// ============================================================
// LAÇO
// ============================================================

/** Um quadro: calcula o tempo desde o anterior, atualiza e desenha. Pausado, o tempo não anda. */
function loop(now) {
  let dt = Math.min(MAX_FRAME_TIME, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (state.mode === "paused") dt = 0;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// Início: ajusta a tela e começa o laço
resize();
requestAnimationFrame(loop);
