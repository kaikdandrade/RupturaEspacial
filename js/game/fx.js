"use strict";

/**
 * @file Efeitos visuais simples da partida: partículas, textos flutuantes, raios do tiro
 * elétrico e tremor da tela. Só visual: nada aqui afeta a jogabilidade.
 */

/** Máximo de textos flutuantes ao mesmo tempo (os mais antigos saem primeiro). */
const MAX_FLOATING_TEXTS = 24;
/** Máximo de raios na tela. */
const MAX_BOLTS = 40;
/** Tremor máximo da tela (px). */
const MAX_SHAKE = 12;

/** Faz a tela tremer (soma ao tremor atual, até MAX_SHAKE). */
function addShake(amount) {
  state.shake = Math.min(MAX_SHAKE, state.shake + amount);
}

/** Texto que sobe e some (combo, nome do especial, "REVIVEU!"...). */
function spawnFloatingText(x, y, text, color = "#ffffff") {
  floatingTexts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  if (floatingTexts.length > MAX_FLOATING_TEXTS) floatingTexts.shift();
}

/** Raio do tiro elétrico entre dois pontos: zigue-zague que pisca e some rápido, com faíscas na ponta. */
function spawnBolt(x1, y1, x2, y2) {
  const segments = 7;
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / length, ny = (x2 - x1) / length; // perpendicular
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jitter = i === 0 || i === segments ? 0 : random(-1, 1) * Math.min(px(16), length * 0.18);
    points.push({ x: x1 + (x2 - x1) * t + nx * jitter, y: y1 + (y2 - y1) * t + ny * jitter });
  }
  bolts.push({ points, life: 0.2, maxLife: 0.2 });
  if (bolts.length > MAX_BOLTS) bolts.shift();
  for (let i = 0; i < 5; i++) {
    const a = random(0, Math.PI * 2), v = random(40, 140), life = random(0.15, 0.3);
    particles.push({
      x: x2, y: y2, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      size: random(1.4, 2.6), color: i % 2 ? "#fff6b0" : "#9ff3ff", life, maxLife: life,
    });
  }
}

/** Move, desacelera e envelhece partículas, textos e raios. */
function updateFx(dt) {
  const drag = Math.pow(0.96, dt * 60);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const t of floatingTexts) {
    t.y -= 38 * dt;
    t.life -= dt;
  }
  floatingTexts = floatingTexts.filter((t) => t.life > 0);

  for (const b of bolts) b.life -= dt;
  bolts = bolts.filter((b) => b.life > 0);
}

/** Partículas: quadradinhos que desbotam com a vida. */
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/** Raios: faixa amarela larga + núcleo branco (sem shadowBlur, que era caro). */
function drawBolts() {
  if (!bolts.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const bolt of bolts) {
    ctx.globalAlpha = clamp(bolt.life / bolt.maxLife, 0, 1);
    ctx.beginPath();
    bolt.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    glowStroke("rgba(255, 230, 109, .85)", Math.max(2, px(4)), { glow: Math.max(6, px(12)), glowAlpha: 0.3 });
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, px(1.6));
    ctx.stroke();
  }
  ctx.restore();
}

/** Textos flutuantes com contorno escuro (legíveis sobre qualquer fundo) e um "pulo" ao surgir. */
function drawFloatingTexts() {
  if (!floatingTexts.length) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(15 * clamp(SCALE, 0.85, 1.2))}px Orbitron, sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(5, 8, 23, .85)";
  for (const t of floatingTexts) {
    const k = clamp(t.life / t.maxLife, 0, 1);
    const pop = 1 + Math.max(0, k - 0.8) * 1.5;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pop, pop);
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
