"use strict";

/**
 * @file Sistema de efeitos dos cards (fogo, gelo, eletricidade e bônus do Místico).
 *
 *   effects.reset()                -> limpa tudo (início de cada partida)
 *   effects.update(dt)             -> avança o relógio e os ticks de dano
 *   effects.activate("flame")      -> ativa o efeito de um card (cuida das combinações sozinho)
 *   effects.isActive("storm")      -> consulta
 *   effects.on("evaporation", fn)  -> sinais para o jogo reagir (game/reactions.js aplica o dano)
 *
 * Elementos e combinações (o card pego + o que já está ativo):
 *
 *   Card    | nada ativo     | mesmo elemento | combina com
 *   --------+----------------+----------------+------------------------------------------------
 *   Fogo    | Chamas         | Incineração    | Gelo -> Evaporação · Elétrico -> Sobrecarga
 *   Gelo    | Lentidão       | Congelamento   | Fogo -> Evaporação · Elétrico -> Supercondutor
 *   Raio    | Tiro elétrico  | Tempestade     | Gelo -> Supercondutor · Fogo -> Sobrecarga
 *
 * Os efeitos valem igual para TODOS os asteroides (comuns e especiais); só os bosses têm exceções
 * (desaceleram menos, não congelam e a Evaporação só tira uma parte da vida deles).
 *
 * Sinais: activated, evolved, burnTick, evaporation, stormTick.
 */
class Effect extends Signals {
  /** Durações padrão (s): básicos, avançados e bônus do jogador. */
  static BASIC = 10;
  static ADVANCED = 6;
  static PLAYER = 8;

  /**
   * Configuração de cada efeito. Ajuste os números aqui.
   * - duration: segundos (0 = instantâneo)
   * - label: nome exibido no HUD e no glossário
   * - Danos: FRAÇÃO da vida média dos asteroides do setor (setDifficulty), para o efeito ter o
   *   mesmo peso em qualquer setor. Ex.: 0.6 = 60% da vida de um asteroide médio.
   */
  static CONFIG = {
    // ---------------- Básicos (um card) ----------------
    // Gelo: todos os asteroides na metade da velocidade (bosses só um pouco)
    frozen: { label: "Lentidão", tier: "basic", duration: Effect.BASIC, speedMultiplier: 0.5, bossSpeedMultiplier: 0.75 },
    // Fogo: todos os asteroides queimam (60% da vida média ao longo dos 10 s)
    flame: { label: "Chamas", tier: "basic", duration: Effect.BASIC, tickInterval: 0.5, totalHpFraction: 0.6 },
    // Raio: cada tiro que acerta solta um raio que pula para os vizinhos (falloff = força a cada pulo)
    electricShot: {
      label: "Tiro elétrico", tier: "basic", duration: Effect.BASIC,
      chainJumps: 3, chainRange: 170, chainFalloff: 0.6,
    },

    // ---------------- Avançados (dois cards) ----------------
    // Gelo + gelo: tudo congela (bosses ficam na metade da velocidade)
    freeze: { label: "Congelamento", tier: "advanced", duration: Effect.ADVANCED, speedMultiplier: 0, bossSpeedMultiplier: 0.5 },
    // Fogo + fogo: o fogo vira um dano contínuo e rápido (ticks curtos), bem mais forte que Chamas
    incinerate: { label: "Incineração", tier: "advanced", duration: Effect.ADVANCED, tickInterval: 0.1, totalHpFraction: 1.1 },
    // Raio + raio: além dos tiros elétricos, a nave dá choques em cadeia nos asteroides próximos
    storm: {
      label: "Tempestade", tier: "advanced", duration: Effect.ADVANCED,
      range: 230, interval: 0.4, hpFraction: 0.22, jumps: 3,
    },
    // Raio + gelo: os asteroides gelados conduzem o raio (mais dano, mais alcance e mais pulos)
    superconductor: {
      label: "Supercondutor", tier: "advanced", duration: Effect.ADVANCED,
      damageMultiplier: 1.8, rangeMultiplier: 1.7, bonusJumps: 3,
    },
    // Raio + fogo: quem morre em chamas explode e solta raios nos vizinhos
    overload: {
      label: "Sobrecarga", tier: "advanced", duration: Effect.ADVANCED,
      blastRange: 150, blastHpFraction: 0.8, bolts: 3,
    },
    // Fogo + gelo: instantâneo. Destrói todos os asteroides; bosses perdem bossHpFraction da vida máxima.
    evaporation: { label: "Evaporação", tier: "advanced", duration: 0, bossHpFraction: 0.12 },

    // ---------------- Bônus do jogador (card do Místico) ----------------
    scoreBonus: { label: "Pontos extras", tier: "player", duration: Effect.PLAYER, scoreMultiplier: 1.5 },
    quickShot: { label: "Tiro rápido", tier: "player", duration: Effect.PLAYER, fireIntervalMultiplier: 0.6 },
    speedBoost: { label: "Velocidade", tier: "player", duration: Effect.PLAYER, moveSpeedMultiplier: 1.35 },
    damageBoost: { label: "Dano extra", tier: "player", duration: Effect.PLAYER, damageMultiplier: 1.5 },
    piercingShot: { label: "Perfurante", tier: "player", duration: Effect.PLAYER, pierceCount: 2 },
    invulnerability: { label: "Invulnerável", tier: "player", duration: Effect.PLAYER },
  };

  #time = 0;              // relógio interno (s): só anda durante a partida
  #until = {};            // nome -> instante do relógio em que o efeito acaba (0 = inativo)
  #burnTimer = 0;
  #burnCarry = 0;         // dano fracionário acumulado dos ticks (vira inteiro ao passar de 1)
  #stormTimer = 0;
  #levelHp = 2;           // vida média dos asteroides do setor atual (base dos danos)
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
    this.#burnTimer = 0;
    this.#burnCarry = 0;
    this.#stormTimer = 0;
    this.#until = Object.fromEntries(Object.keys(Effect.CONFIG).map((name) => [name, 0]));
  }

  /** Avança o relógio e dispara os ticks de fogo e os choques da Tempestade. */
  update(dt) {
    if (!(dt > 0)) return;
    this.#time += dt;

    // Na presença do Gravitacional nada congela: o congelamento vira, no máximo, lentidão
    this.#freezeBlocked = typeof asteroids !== "undefined"
      && asteroids.some((a) => a.type === "gravity" && a.boss && !a.dead);

    // Fogo: a Incineração (ticks curtos) tem prioridade sobre as Chamas
    const fire = this.isActive("incinerate") ? Effect.CONFIG.incinerate
      : this.isActive("flame") ? Effect.CONFIG.flame : null;
    if (fire) {
      const perTick = this.levelDamage(fire.totalHpFraction * fire.tickInterval / fire.duration);
      this.#burnTimer += dt;
      while (this.#burnTimer >= fire.tickInterval) {
        this.#burnTimer -= fire.tickInterval;
        this.#burnCarry += perTick;
        const damage = Math.floor(this.#burnCarry);
        this.#burnCarry -= damage;
        if (damage > 0) this.emit("burnTick", { damage });
      }
    } else {
      this.#burnTimer = 0;
      this.#burnCarry = 0;
    }

    // Tempestade: um choque em cadeia a partir da nave a cada `interval`
    if (this.isActive("storm")) {
      const storm = Effect.CONFIG.storm;
      this.#stormTimer += dt;
      if (this.#stormTimer >= storm.interval) {
        this.#stormTimer -= storm.interval;
        this.emit("stormTick", { damage: this.instantDamage(storm.hpFraction), range: storm.range, jumps: storm.jumps });
      }
    } else {
      this.#stormTimer = 0;
    }
  }

  // ------------------------------------------------------------------
  // Ativação
  // ------------------------------------------------------------------

  /** Elementos ativos agora (básico ou avançado). */
  get fireActive() { return this.isActive("flame") || this.isActive("incinerate"); }
  get iceActive() { return this.isActive("frozen") || this.isActive("freeze"); }
  get electricActive() { return this.isActive("electricShot") || this.isActive("storm"); }

  /**
   * Ativa o efeito de um card. Os cards elementais (flame, frozen, electricShot) combinam com o
   * que já estiver ativo (ver a tabela no topo do arquivo); os do Místico só ligam/renovam.
   * Retorna o nome do efeito principal que foi aplicado.
   */
  activate(name) {
    const config = Effect.CONFIG[name];
    if (!config) throw new Error(`Efeito desconhecido: ${name}`);

    if (name === "flame") return this.#pickElement("fire");
    if (name === "frozen") return this.#pickElement("ice");
    if (name === "electricShot") return this.#pickElement("electric");
    return this.#start(name);
  }

  /** Regras de combinação ao pegar um card elemental. */
  #pickElement(element) {
    const fire = this.fireActive;
    const ice = this.iceActive;
    const electric = this.electricActive;

    // Fogo + gelo (em qualquer ordem): Evaporação, que consome o fogo e o gelo
    if ((element === "fire" && ice) || (element === "ice" && fire)) {
      for (const n of ["flame", "incinerate", "frozen", "freeze", "superconductor", "overload"]) this.#until[n] = 0;
      this.emit("evolved", { to: "evaporation" });
      this.emit("evaporation", { bossHpFraction: Effect.CONFIG.evaporation.bossHpFraction });
      this.emit("activated", { name: "evaporation", duration: 0 });
      return "evaporation";
    }

    // O mesmo elemento de novo: vira (ou renova) a versão avançada, que substitui a básica
    const ladder = { fire: ["flame", "incinerate"], ice: ["frozen", "freeze"], electric: ["electricShot", "storm"] };
    const [basic, advanced] = ladder[element];
    let applied;
    if (this.isActive(basic) || this.isActive(advanced)) {
      this.#until[basic] = 0;
      if (!this.isActive(advanced)) this.emit("evolved", { to: advanced });
      applied = this.#start(advanced);
    } else {
      applied = this.#start(basic);
    }

    // Combinações com a eletricidade (o efeito pego continua valendo junto)
    if ((element === "electric" && ice) || (element === "ice" && electric)) this.#combo("superconductor");
    if ((element === "electric" && fire) || (element === "fire" && electric)) this.#combo("overload");
    return applied;
  }

  /** Liga (ou renova) uma combinação e avisa o HUD na primeira vez. */
  #combo(name) {
    if (!this.isActive(name)) this.emit("evolved", { to: name });
    this.#start(name);
  }

  /** Liga um efeito com duração (ou renova, se já estiver ativo). */
  #start(name) {
    const config = Effect.CONFIG[name];
    const refreshed = this.isActive(name);
    this.#until[name] = Math.max(this.#until[name], this.#time + config.duration);
    if (!refreshed) {
      if (name === "storm") this.#stormTimer = Effect.CONFIG.storm.interval; // primeiro choque já
      this.emit("activated", { name, duration: config.duration });
    }
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

  /** Multiplicador de velocidade de um asteroide (igual para todos; bosses sofrem menos). */
  asteroidSpeedMultiplier(asteroid) {
    if (!asteroid) return 1;
    const { frozen, freeze } = Effect.CONFIG;
    if (this.isActive("freeze")) return asteroid.boss ? freeze.bossSpeedMultiplier : this.#noFreeze(freeze.speedMultiplier);
    if (this.isActive("frozen")) return asteroid.boss ? frozen.bossSpeedMultiplier : frozen.speedMultiplier;
    return 1;
  }

  /** Velocidade dos projéteis que sofrem efeitos: Lentidão deixa lento, Congelamento para. */
  projectileSpeedMultiplier() {
    if (this.isActive("freeze")) return this.#noFreeze(0);
    if (this.isActive("frozen")) return 0.5;
    return 1;
  }

  /** O fogo (Chamas / Incineração) está queimando este asteroide? Vale para todos. */
  burnAffects(asteroid) {
    return !!asteroid && !asteroid.dead && this.fireActive;
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
   * Raio em cascata do tiro elétrico (Tiro elétrico ou Tempestade). null se não houver.
   * Com o Supercondutor, o raio alcança mais longe, pula mais vezes e causa mais dano.
   * range está em pixels da tela de referência (o jogo multiplica pela escala).
   * @returns {{ jumps: number, range: number, falloff: number, damageMultiplier: number } | null}
   */
  chainLightning() {
    if (!this.electricActive) return null;
    const c = Effect.CONFIG.electricShot;
    const sc = this.isActive("superconductor") ? Effect.CONFIG.superconductor : null;
    return {
      jumps: c.chainJumps + (sc ? sc.bonusJumps : 0),
      range: c.chainRange * (sc ? sc.rangeMultiplier : 1),
      falloff: c.chainFalloff,
      damageMultiplier: sc ? sc.damageMultiplier : 1,
    };
  }

  /** A Sobrecarga está armada neste asteroide? (está queimando e não é boss) */
  overloadArmed(asteroid) {
    return this.isActive("overload") && this.fireActive && !!asteroid && !asteroid.boss;
  }

}

/** Instância única do sistema de efeitos. */
const effects = new Effect();