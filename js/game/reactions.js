"use strict";

/**
 * @file Reações elementais: aplica no mundo o que o sistema de efeitos (core/Effects.js) avisa.
 *
 * - Fogo (Chamas / Incineração): cada tick queima todos os asteroides.
 * - Evaporação: destrói todos os asteroides; bosses perdem uma parte da vida máxima.
 * - Tempestade: choques em cadeia saindo da nave para os asteroides próximos.
 * - Sobrecarga: quem morre queimando explode (dano em área + raios nos vizinhos). As explosões
 *   entram numa fila com um pequeno atraso, então uma explosão que mata outro asteroide em chamas
 *   gera uma reação em cadeia visível, sem recursão.
 *
 * O Effects só diz quanto e quando; quem atinge os asteroides é este arquivo.
 */

/** Cores dos raios (r, g, b) de cada origem. */
const BOLT_COLORS = {
  electric: "255, 230, 109",
  superconductor: "120, 235, 255",
  overload: "255, 150, 60",
  storm: "200, 170, 255",
};

const Reactions = {
  /** Explosões da Sobrecarga esperando para estourar: { x, y, radius, timer } */
  overloadQueue: [],
  /** Atraso (s) entre uma explosão e a próxima da cadeia. */
  OVERLOAD_DELAY: 0.12,
  /** Limite de explosões na fila (proteção contra excesso de partículas). */
  OVERLOAD_MAX: 24,

  /** Asteroides vivos e já dentro da arena (só esses podem ser atingidos por efeitos de área). */
  targets() {
    return asteroids.filter((a) => !a.dead && a.enteredArena && !(a.entryDelay > 0));
  },

  /** Limpa a fila (início de partida). */
  reset() {
    this.overloadQueue.length = 0;
  },

  /** Avança as explosões da Sobrecarga. Chamado a cada quadro da partida. */
  update(dt) {
    if (!this.overloadQueue.length) return;
    const ready = [];
    for (const blast of this.overloadQueue) {
      blast.timer -= dt;
      if (blast.timer <= 0) ready.push(blast);
    }
    if (!ready.length) return;
    this.overloadQueue = this.overloadQueue.filter((b) => b.timer > 0);
    ready.forEach((blast) => this.explode(blast));
  },

  /** Um asteroide morreu: se a Sobrecarga estava armada nele, agenda a explosão. */
  onAsteroidDestroyed(asteroid) {
    if (!effects.overloadArmed(asteroid) || this.overloadQueue.length >= this.OVERLOAD_MAX) return;
    this.overloadQueue.push({ x: asteroid.x, y: asteroid.y, radius: asteroid.radius, timer: this.OVERLOAD_DELAY });
  },

  /** Explosão da Sobrecarga: dano em área e raios nos vizinhos mais próximos. */
  explode({ x, y, radius }) {
    const config = Effect.CONFIG.overload;
    const reach = px(config.blastRange);
    const damage = effects.instantDamage(config.blastHpFraction);

    // Visual: anel de fogo + faíscas
    addShake(3);
    for (let i = 0; i < 16; i++) {
      const a = random(0, Math.PI * 2), v = random(80, 220), life = random(0.25, 0.5);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        size: random(2, 4), color: i % 3 ? "rgba(255, 150, 60, .9)" : "rgba(255, 240, 140, .95)", life, maxLife: life,
      });
    }
    blasts.push({ x, y, radius: reach, life: 0.35, maxLife: 0.35, color: BOLT_COLORS.overload });

    // Dano em todos no alcance; raios nos `bolts` mais próximos
    const near = this.targets()
      .map((a) => ({ a, d: Math.hypot(a.x - x, a.y - y) - a.radius }))
      .filter(({ d }) => d <= reach)
      .sort((p, q) => p.d - q.d);
    near.slice(0, config.bolts).forEach(({ a }) => spawnBolt(x, y, a.x, a.y, BOLT_COLORS.overload));
    near.forEach(({ a }) => a.hit(damage, "burn"));
    playTone(180, 0.12, 0.03, "sawtooth");
  },

  /** Choque da Tempestade: da nave até o asteroide mais próximo e, dali, em cadeia. */
  stormStrike({ damage, range, jumps }) {
    if (!player || player.dead) return;
    const reach = px(range);
    let target = null;
    let best = Infinity;
    for (const a of this.targets()) {
      const d = Math.hypot(a.x - player.x, a.y - player.y) - a.radius;
      if (d <= reach && d < best) { best = d; target = a; }
    }
    if (!target) return;
    spawnBolt(player.x, player.y, target.x, target.y, BOLT_COLORS.storm);
    target.hit(damage, "shot");
    const chain = effects.chainLightning() ?? { range: 170, falloff: 0.6, damageMultiplier: 1 };
    Asteroid.chainLightning(target, damage, { ...chain, jumps });
  },

  /** Evaporação: destrói todos os asteroides; bosses perdem uma fração da vida máxima. */
  evaporate({ bossHpFraction }) {
    addShake(10);
    state.flash = Math.max(state.flash ?? 0, 0.35);
    for (const a of asteroids) {
      if (a.dead) continue;
      a.flashEffect("evaporation");
      if (a.boss) a.hit(Math.ceil(a.maxHp * bossHpFraction), "burn");
      else a.hit(a.hp + (a.armor ?? 0), "burn");
    }
    // Quebra os espinhos do Espinhoso (e outros projéteis que sofrem efeitos) que estiverem na tela
    asteroids.forEach((a) => a.projectiles?.forEach((p) => p.affectedByEffects && p.shatter?.()));
  },
};

// ---------------- Ligações com os sinais do sistema de efeitos ----------------

effects.on("burnTick", ({ damage }) => Reactions.targets().forEach((a) => a.hit(damage, "burn")));
effects.on("evaporation", (payload) => Reactions.evaporate(payload));
effects.on("stormTick", (payload) => Reactions.stormStrike(payload));

// Avisos no HUD: efeitos instantâneos e as evoluções/combinações (Congelamento, Tempestade...)
effects.on("activated", ({ name, duration }) => {
  if (duration === 0) showEffectToast(name, `${Effect.CONFIG[name].label}!`);
});
effects.on("evolved", ({ to }) => {
  if (Effect.CONFIG[to]?.duration > 0) showEffectToast(to, `${Effect.CONFIG[to].label}!`);
});
