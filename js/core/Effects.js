"use strict";

/**
 * @file Sistema de efeitos dos cards (fogo, gelo, raio, buffs do Místico).
 *
 *   effects.reset()                -> limpa tudo (início de cada partida)
 *   effects.update(dt)             -> avança o relógio dos efeitos
 *   effects.activate("frozen")     -> ativa um efeito (cuida das evoluções sozinho)
 *   effects.isActive("quickShot")  -> consulta
 *   effects.on("bleve", fn)        -> sinais para o jogo reagir (dano em área, toasts, sons...)
 *
 * Sinais: activated, evolved, flameTick, frostTick, freezeBurst, incinerate, bleve.
 * O dano em si é aplicado em main.js (o sistema só avisa quanto e quando).
 */
class Effect extends Signals {
  /**
   * Configuração de cada efeito. Ajuste os números aqui.
   * - duration: segundos (0 = instantâneo)
   * - evolvesTo: se pegar este efeito com ele já ativo, vira o efeito indicado
   * - label: nome exibido no HUD
   * - Danos: sempre uma FRAÇÃO da vida média dos asteroides do setor (setDifficulty), para o
   *   efeito ter o mesmo peso em qualquer setor. Ex.: 0.45 = tira 45% da vida de um asteroide médio.
   *   Nenhum efeito sozinho limpa a arena: eles enfraquecem tudo e acabam com os já feridos.
   */
  static CONFIG = {
    // Deixa lento os asteroids (excessão de gelo). Bosses ficam só um pouco lentos.
    // Os de fogo ficam AINDA mais lentos que os comuns e tomam dano do frio (6% por segundo).
    frozen: {
      label: "Lentidão", duration: 6, evolvesTo: "freeze",
      speedMultiplier: 0.5, volcanicSpeedMultiplier: 0.35, bossSpeedMultiplier: 0.75,
      frostTickInterval: 1, frostHpFraction: 0.06,
    },
    // Evolução de "frozen", congela os asteroids (os de fogo e os bosses ficam lentos em vez de congelar).
    // Os de fogo tomam um choque ao ativar (35%) e depois dano do frio.
    freeze: {
      label: "Congelamento", duration: 4,
      speedMultiplier: 0, volcanicSpeedMultiplier: 0.35, bossSpeedMultiplier: 0.5,
      burstHpFraction: 0.35,
      frostTickInterval: 0.75, frostHpFraction: 0.06,
    },
    // Queima todos os asteroides: 45% da vida média ao longo dos 6s (os de gelo tomam o dobro)
    flame: { label: "Chamas", duration: 6, evolvesTo: "incinerate", tickInterval: 0.5, totalHpFraction: 0.45 },
    // Evolução de "flame" (pegar fogo com fogo ativo): explosão de 60% e consome o fogo
    incinerate: { label: "Incinerar", duration: 0, hpFraction: 0.6, consumesFlame: true },
    // Fogo encontra gelo (ou gelo encontra fogo): explosão de 85% em todos os asteroides,
    // consome os efeitos de fogo e gelo ativos. Asteroides de vida cheia ainda sobrevivem.
    bleve: { label: "BLEVE", duration: 0, hpFraction: 0.85 },

    // Player
    scoreBonus: { label: "Pontos extras", duration: 8, scoreMultiplier: 1.5 },
    quickShot: { label: "Tiro rápido", duration: 8, fireIntervalMultiplier: 0.6 },
    speedBoost: { label: "Velocidade", duration: 8, moveSpeedMultiplier: 1.35 },
    damageBoost: { label: "Dano extra", duration: 8, damageMultiplier: 1.5 },
    piercingShot: { label: "Perfurante", duration: 8, pierceCount: 2 },
    invulnerability: { label: "Invulnerável", duration: 5 },
    // Card do asteroide Elétrico: cada tiro que acerta solta um raio que pula de asteroide
    // em asteroide (dano em cascata). Cada pulo causa chainFalloff do dano do pulo anterior.
    // Com frio ativo (frozen/freeze) o gelo conduz melhor: +iceBonusJumps pulos.
    electricShot: {
      label: "Tiro elétrico", duration: 8,
      chainJumps: 3, chainRange: 170, chainFalloff: 0.6, iceBonusJumps: 2,
    },
  };

  /** Asteroides de gelo levam este multiplicador de dano dos efeitos de fogo. */
  static ICE_FIRE_DAMAGE_MULTIPLIER = 2;

  #time = 0;              // relógio interno (s): só anda durante a partida
  #until = {};            // nome -> instante do relógio em que o efeito acaba (0 = inativo)
  #flameTickTimer = 0;
  #frostTickTimer = 0;
  #levelHp = 2;           // vida média dos asteroides do setor atual (base dos danos)
  #flameCarry = 0;        // dano fracionário acumulado dos ticks (vira inteiro ao passar de 1)
  #frostCarry = 0;
  #freezeBlocked = false; // true enquanto houver um boss Gravitacional vivo

  constructor() {
    super();
    this.reset();
  }

  // ------------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------------

  /** Desliga todos os efeitos (início de cada partida). */
  reset() {
    this.#time = 0;
    this.#flameTickTimer = 0;
    this.#frostTickTimer = 0;
    this.#flameCarry = 0;
    this.#frostCarry = 0;
    this.#until = Object.fromEntries(Object.keys(Effect.CONFIG).map((name) => [name, 0]));
  }

  /** Avança o relógio e dispara os ticks de dano do fogo e do frio. */
  update(dt) {
    if (!(dt > 0)) return;
    this.#time += dt;

    // Na presença do Gravitacional nada congela: o freeze vira, no máximo, lentidão
    this.#freezeBlocked = typeof asteroids !== "undefined"
      && asteroids.some((a) => a.type === "gravity" && a.boss && !a.dead);

    // Ticks do "flame"
    if (this.isActive("flame")) {
      const { tickInterval, totalHpFraction, duration } = Effect.CONFIG.flame;
      const perTick = this.levelDamage(totalHpFraction * tickInterval / duration);
      this.#flameTickTimer += dt;
      while (this.#flameTickTimer >= tickInterval) {
        this.#flameTickTimer -= tickInterval;
        this.#flameCarry += perTick;
        const damage = Math.floor(this.#flameCarry);
        this.#flameCarry -= damage;
        if (damage > 0) this.emit("flameTick", { damage });
      }
    } else {
      this.#flameTickTimer = 0;
      this.#flameCarry = 0;
    }

    // Ticks do frio (frozen/freeze) nos asteroides de fogo
    const frost = this.isActive("freeze") ? Effect.CONFIG.freeze
      : this.isActive("frozen") ? Effect.CONFIG.frozen : null;
    if (frost) {
      this.#frostTickTimer += dt;
      while (this.#frostTickTimer >= frost.frostTickInterval) {
        this.#frostTickTimer -= frost.frostTickInterval;
        this.#frostCarry += this.levelDamage(frost.frostHpFraction);
        const damage = Math.floor(this.#frostCarry);
        this.#frostCarry -= damage;
        if (damage > 0) this.emit("frostTick", { damage });
      }
    } else {
      this.#frostTickTimer = 0;
      this.#frostCarry = 0;
    }

  }

  // ------------------------------------------------------------------
  // Ativação
  // ------------------------------------------------------------------

  /**
   * Ativa um efeito. Se ele já estiver ativo e tiver evolução, evolui.
   * Pegar o mesmo efeito de novo (sem evolução) renova a duração.
   * Retorna o nome do efeito que de fato foi aplicado.
   */
  activate(name) {
    const config = Effect.CONFIG[name];
    if (!config) throw new Error(`Efeito desconhecido: ${name}`);

    // Evolução (frozen -> freeze, flame -> incinerate)
    if (config.evolvesTo && this.isActive(name)) {
      this.#until[name] = 0; // o efeito base é substituído pela evolução
      this.emit("evolved", { from: name, to: config.evolvesTo });
      return this.activate(config.evolvesTo);
    }

    // Com "freeze" ativo, um novo "frozen" só renova o congelamento
    if (name === "frozen" && this.isActive("freeze")) return this.activate("freeze");

    // BLEVE: fogo encontra gelo (ou gelo encontra fogo)
    const iceActive = this.isActive("frozen") || this.isActive("freeze");
    if ((name === "flame" && iceActive) || (name === "frozen" && this.isActive("flame"))) {
      this.emit("evolved", { from: name, to: "bleve" });
      return this.activate("bleve");
    }

    // Efeitos instantâneos
    if (config.duration <= 0) {
      if (name === "incinerate") {
        if (config.consumesFlame) this.#until.flame = 0;
        this.emit("incinerate", { damage: this.instantDamage(config.hpFraction) });
      }
      if (name === "bleve") {
        this.#until.flame = 0;
        this.#until.frozen = 0;
        this.#until.freeze = 0;
        this.emit("bleve", { damage: this.instantDamage(config.hpFraction) });
      }
      this.emit("activated", { name, duration: 0 });
      return name;
    }

    const refreshed = this.isActive(name);
    this.#until[name] = Math.max(this.#until[name], this.#time + config.duration);
    if (name === "flame" && !refreshed) this.#flameTickTimer = 0;
    // Choque de congelamento nos asteroides de fogo (só quando o freeze começa, não ao renovar)
    if (name === "freeze" && !refreshed) this.emit("freezeBurst", { damage: this.instantDamage(config.burstHpFraction) });
    if (!refreshed) this.emit("activated", { name, duration: config.duration });
    return name;
  }

  // ------------------------------------------------------------------
  // Dificuldade (dano proporcional ao nível)
  // ------------------------------------------------------------------

  /** Chamado ao iniciar um setor, com a vida média dos asteroides dele. */
  setDifficulty(averageHp) {
    this.#levelHp = Math.max(1, Number(averageHp) || 1);
  }

  /** Fração da vida média do setor, sem arredondar (usado nos ticks). */
  levelDamage(fraction) {
    return fraction * this.#levelHp;
  }

  /** Dano instantâneo (explosões): fração da vida média, arredondado, mínimo 1. */
  instantDamage(fraction) {
    return Math.max(1, Math.round(this.levelDamage(fraction)));
  }

  // ------------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------------

  /** O efeito está ativo agora? */
  isActive(name) {
    return (this.#until[name] ?? 0) > this.#time;
  }

  /** Segundos restantes (0 se inativo). */
  remaining(name) {
    return Math.max(0, (this.#until[name] ?? 0) - this.#time);
  }

  /** De 1 (acabou de ativar) a 0 (acabou). Útil para barras/ícones no HUD. */
  progress(name) {
    const duration = Effect.CONFIG[name]?.duration ?? 0;
    return duration > 0 ? Math.min(1, this.remaining(name) / duration) : 0;
  }

  /**
   * Efeitos ativos, para o HUD.
   * @returns {{ name: string, label: string, remaining: number, progress: number }[]}
   */
  activeList() {
    const list = [];
    for (const name in this.#until) {
      if (!this.isActive(name)) continue;
      list.push({ name, label: Effect.CONFIG[name].label, remaining: this.remaining(name), progress: this.progress(name) });
    }
    return list;
  }

  // ------------------------------------------------------------------
  // Modificadores prontos para o jogo usar
  // ------------------------------------------------------------------

  /** Com o Gravitacional vivo, "parado" (0) vira a lentidão do frozen. */
  #noFreeze(multiplier) {
    return this.#freezeBlocked && multiplier <= 0 ? Effect.CONFIG.frozen.speedMultiplier : multiplier;
  }

  /**
   * Multiplicador de velocidade de um asteroide, com as exceções de cada efeito
   * (gelo não desacelera Glaciais, Vulcânicos sofrem mais, bosses sofrem menos).
   */
  asteroidSpeedMultiplier(asteroid) {
    if (!asteroid) return 1;
    const { frozen, freeze } = Effect.CONFIG;

    if (this.isActive("freeze")) {
      if (asteroid.boss) return freeze.bossSpeedMultiplier;
      if (asteroid.type === "volcanic") return freeze.volcanicSpeedMultiplier;
      return this.#noFreeze(freeze.speedMultiplier);
    }

    if (this.isActive("frozen")) {
      if (asteroid.boss) return frozen.bossSpeedMultiplier;
      if (asteroid.type === "volcanic") return frozen.volcanicSpeedMultiplier;
      if (asteroid.type === "frozen") return 1;
      return frozen.speedMultiplier;
    }

    return 1;
  }

  /** Velocidade dos espinhos do Espinhoso: frozen deixa lento, freeze congela no lugar. */
  projectileSpeedMultiplier() {
    if (this.isActive("freeze")) return this.#noFreeze(0);
    if (this.isActive("frozen")) return 0.5;
    return 1;
  }

  /** Se o fogo (flame / incinerate) afeta este asteroide. Asteroides de fogo são imunes. */
  burnAffects(asteroid) {
    return !!asteroid && !asteroid.dead && asteroid.type !== "volcanic";
  }

  /** Dano final de um efeito de fogo (flameTick / incinerate) num asteroide. Gelo leva extra. */
  fireDamage(baseDamage, asteroid) {
    if (!this.burnAffects(asteroid)) return 0;
    return asteroid.type === "frozen"
      ? Math.ceil(baseDamage * Effect.ICE_FIRE_DAMAGE_MULTIPLIER)
      : baseDamage;
  }

  /** Se o frio (frostTick / freezeBurst) afeta este asteroide: só os de fogo. */
  frostAffects(asteroid) {
    return !!asteroid && !asteroid.dead && asteroid.type === "volcanic";
  }

  /** Multiplicador do intervalo entre tiros (< 1 = atira mais rápido). */
  fireIntervalMultiplier() {
    return this.isActive("quickShot") ? Effect.CONFIG.quickShot.fireIntervalMultiplier : 1;
  }

  /** Multiplicador da velocidade da nave (speedBoost). */
  moveSpeedMultiplier() {
    return this.isActive("speedBoost") ? Effect.CONFIG.speedBoost.moveSpeedMultiplier : 1;
  }

  /** Dano final de um tiro. */
  damage(baseDamage) {
    if (!this.isActive("damageBoost")) return baseDamage;
    return Math.ceil(baseDamage * Effect.CONFIG.damageBoost.damageMultiplier);
  }

  /** Multiplicador da pontuação (scoreBonus). */
  scoreMultiplier() {
    return this.isActive("scoreBonus") ? Effect.CONFIG.scoreBonus.scoreMultiplier : 1;
  }

  /** Quantos asteroides extras um tiro atravessa (0 = para no primeiro). */
  pierceCount() {
    return this.isActive("piercingShot") ? Effect.CONFIG.piercingShot.pierceCount : 0;
  }

  /** A nave está invulnerável (card do Místico)? */
  isInvulnerable() {
    return this.isActive("invulnerability");
  }

  /**
   * Raio em cascata do tiro elétrico. null se o efeito não estiver ativo.
   * range está em pixels da tela de referência (o jogo multiplica pela escala).
   */
  chainLightning() {
    if (!this.isActive("electricShot")) return null;
    const c = Effect.CONFIG.electricShot;
    const ice = this.isActive("frozen") || this.isActive("freeze");
    return { jumps: c.chainJumps + (ice ? c.iceBonusJumps : 0), range: c.chainRange, falloff: c.chainFalloff };
  }
}

/** Instância única do sistema de efeitos. */
const effects = new Effect();