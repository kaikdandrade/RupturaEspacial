"use strict";

/**
 * @file Classe base de todos os asteroides (comuns, especiais e bosses).
 *
 * Cada tipo fica no seu arquivo (asteroids/, asteroids/special/, asteroids/bosses/),
 * herda daqui e sobrescreve só os "ganchos" que precisa (resolveSprite, updateBehavior,
 * onDestroyed, drawSpecialEffects...). Cada arquivo se registra com Asteroid.register(),
 * e o jogo cria qualquer tipo com Asteroid.create({ type, ... }).
 *
 * Sinais emitidos: "destroyed" (ao ser destruído) e "armorDamaged" (a armadura absorveu dano).
 */
class Asteroid extends Signals {
  /** Poeira da destruição: duração (s) de cada grão e máximo de partículas na tela. */
  static DUST_LIFE_MIN = 0.20;
  static DUST_LIFE_MAX = 0.42;
  static DUST_MAX_ACTIVE = 380;

  /** Classe de cada tipo ("frozen" -> FrozenAsteroid). Cada arquivo de asteroide se registra. */
  static #types = new Map();

  /** Registra a classe de um tipo (chamado no fim de cada arquivo de asteroide). */
  static register(type, AsteroidClass) {
    Asteroid.#types.set(type, AsteroidClass);
  }

  /**
   * Cria o asteroide do tipo pedido (config.type), usando a classe registrada.
   * @param {object} config mesmas opções do construtor
   * @returns {Asteroid}
   */
  static create(config) {
    const AsteroidClass = Asteroid.#types.get(config.type);
    if (!AsteroidClass) throw new Error(`Tipo de asteroide sem classe registrada: ${config.type}`);
    return new AsteroidClass(config);
  }

  /**
   * @param {object} config
   * @param {number} config.x posição inicial
   * @param {number} config.y posição inicial (negativa = acima da tela)
   * @param {number} config.hp vida
   * @param {number} config.speed velocidade (px/s, já na escala da tela)
   * @param {string} config.type tipo ("common", "frozen", "cyber"...)
   * @param {number} [config.size] diâmetro na tela (px)
   * @param {boolean} [config.boss] é um boss
   * @param {boolean} [config.helper] gerado pela arena de um boss (some quando o boss cai)
   * @param {boolean} [config.isPrimary] conta para o objetivo do setor
   * @param {number} [config.entryDelay] segundos esperando antes de começar a entrar
   */
  constructor({ x, y, hp, speed, type, size, boss = false, helper = false, isPrimary = true, entryDelay = 0 } = {}) {
    super();
    if (!Number.isFinite(x)) throw new Error("Asteroid requer uma posição x válida");

    this.x = x;
    this.y = y;
    this.type = type;
    this.boss = !!boss;
    this.helper = !!helper;
    this.isPrimary = !!isPrimary;
    this.maxHp = Math.max(1, Math.round(Number.isFinite(hp) ? hp : 3));
    this.hp = this.maxHp;
    this.speed = Math.max(1, Number.isFinite(speed) ? speed : 84);
    this.size = size ?? px(random(55, 79));
    this.radius = this.size * 0.37;
    this.rotation = random(0, Math.PI * 2);
    this.rotationSpeed = random(-0.75, 0.75);
    this.dead = false;
    this.age = 0;
    this.entryDelay = Math.max(0, entryDelay);
    // inArena: já passou da linha tracejada do topo.
    // enteredArena: já está ativo (toma dano, usa a mecânica). Só o boss espera chegar na arena.
    this.inArena = y >= ARENA_TOP + this.radius;
    this.enteredArena = this.boss ? this.inArena : true;
    this.armor = 0;
    this.maxArmor = 0;

    // Órbita em volta do Gravitacional (preenchido por ele ao capturar este asteroide)
    this.launched = false; // arremessado por ele contra a nave
    this.orbitHost = null;
    this.orbitAngle = 0;
    this.orbitRadius = 0;
    this.orbitSpeed = 0;

    const angle = random(Math.PI * 0.22, Math.PI * 0.78);
    this.vx = Math.cos(angle) * this.speed * random(0.68, 1.02);
    this.vy = Math.sin(angle) * this.speed * random(0.82, 1.08);

    this.image = loadImage(this.resolveSprite());
    this.hitbox = new Hitbox(this, (this.radius + 3));
    this.hitbox.on("enter", ({ other, group }) => {
      if (this.dead || this.entryDelay > 0 || !this.enteredArena) return;
      if (group === "bullets" && other && !other.dead) {
        // piercingShot: o tiro atravessa enquanto tiver "pierce"
        if (other.pierce > 0) other.pierce--;
        else other.dead = true;
        this.hit(other.damage ?? 1, "shot");
        // Tiro elétrico: o raio pula deste asteroide para os vizinhos
        if (other.electric) Asteroid.chainLightning(this, other.damage ?? 1, other.electric);
      }
      if (group === "player" && other && !other.dead) {
        this.emit("touchPlayer", { asteroid: this, player: other });
      }
    });
    // Se a nave continuar encostada, o jogo decide quando aplicar dano novamente.
    this.hitbox.on("stay", ({ other, group }) => {
      if (!this.dead && group === "player" && this.enteredArena && other && !other.dead) {
        this.emit("touchPlayer", { asteroid: this, player: other });
      }
    });
  }

  /** Caminho da imagem deste asteroide (cada tipo define o seu). */
  resolveSprite() { return ASSETS.common[0]; }

  /** Muda o tamanho (e o raio da hitbox junto). Usado pela Hidra ao se dividir. */
  setSize(size, radiusFactor = 0.37) {
    this.size = size;
    this.radius = size * radiusFactor;
    this.hitbox.radius = this.radius;
    return this;
  }

  /** Converte a vida retirada em score (só dano causado pelo jogador: tiro ou efeitos). */
  scoreDamage(removed, source) {
    if (removed <= 0 || (source !== "shot" && source !== "burn")) return;
    state.playing.score += removed * BALANCE.score.perDamage * effects.scoreMultiplier();
  }

  /** Janela do combo para o nível atual: encolhe conforme o total de asteroides do nível cresce. */
  static comboWindow() {
    const { window, minWindow, windowFromTotal, windowToTotal } = BALANCE.combo;
    const total = state.spawnPlan?.total ?? windowFromTotal;
    const t = clamp((total - windowFromTotal) / (windowToTotal - windowFromTotal), 0, 1);
    return window + (minWindow - window) * t;
  }

  /**
   * Raio em cascata (tiro elétrico): a partir do asteroide atingido, pula para o vizinho mais
   * próximo ainda não atingido, até `jumps` vezes. Cada pulo causa `falloff` do dano anterior
   * e o raio para quando o dano fica abaixo de 1. Bosses também levam o choque.
   * @param {Asteroid} origin asteroide atingido pelo tiro
   * @param {number} damage dano do tiro
   * @param {{ jumps: number, range: number, falloff: number }} chain ver Effect.chainLightning()
   */
  static chainLightning(origin, damage, { jumps, range, falloff }) {
    const reach = px(range);
    const struck = new Set([origin]);
    let from = origin;
    let current = damage;
    for (let i = 0; i < jumps; i++) {
      current *= falloff;
      const jumpDamage = Math.round(current);
      if (jumpDamage < 1) break; // o raio perdeu força
      let next = null;
      let best = Infinity;
      for (const a of asteroids) {
        if (a.dead || struck.has(a) || !a.enteredArena || a.entryDelay > 0) continue;
        const d = Math.hypot(a.x - from.x, a.y - from.y) - a.radius;
        if (d <= reach && d < best) { best = d; next = a; }
      }
      if (!next) break;
      struck.add(next);
      spawnBolt(from.x, from.y, next.x, next.y);
      next.hit(jumpDamage, "shot");
      from = next;
    }
    if (struck.size > 1) playTone(1320, 0.05, 0.015, "sawtooth");
  }

  /** Abates em sequência: cada abate dentro da janela aumenta a sequência e dá bônus. */
  scoreCombo() {
    const combo = state.playing.combo;
    if (!combo) return;
    const { bonusPerStep, maxSteps } = BALANCE.combo;
    const comboWindow = Asteroid.comboWindow();

    combo.count = combo.timer > 0 ? combo.count + 1 : 1;
    combo.timer = comboWindow;
    if (combo.count < 2) return;

    // Proporcional à vida média do setor (mínimo 1 ponto por passo da sequência)
    const steps = Math.min(combo.count - 1, maxSteps);
    const perStep = Math.max(1, bonusPerStep * Asteroid.levelHp());
    const bonus = Math.round(steps * perStep * effects.scoreMultiplier());
    state.playing.score += bonus;
    spawnFloatingText(this.x, this.y - this.radius, `COMBO x${combo.count}  +${bonus}`, "#ffd267");
  }

  /** Solta o card do tipo deste asteroide (só quando foi o jogador que o destruiu). */
  tryDrop(reason) {
    if (reason !== "shot" && reason !== "burn") return;
    pickups.push(new PickupCard(this.x, this.y, this.type));
  }

  /** Avança um quadro: entrada, órbita, arremesso ou movimento livre + comportamento do tipo. */
  update(dt) {
    if (this.dead) return;
    this.age += dt;
    // A rotação desacelera junto com o asteroide (congelado = para de girar)
    this.rotation += this.rotationSpeed * dt * effects.asteroidSpeedMultiplier(this);
    this.updateEffectFx(dt);
    if (this.entryDelay > 0) {
      this.entryDelay = Math.max(0, this.entryDelay - dt);
      return;
    }

    if (this.orbitHost) {
      if (!this.orbitHost.dead) {
        if (this.orbitTargetRadius) {
          this.orbitRadius += (this.orbitTargetRadius - this.orbitRadius) * Math.min(1, dt * 2.5);
        }
        this.orbitAngle += this.orbitSpeed * dt;
        this.x = this.orbitHost.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = this.orbitHost.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.updateBehavior(dt);
        return;
      }
      this.orbitHost = null;
    }

    // Arremessado pelo Gravitacional: voa reto e rápido até sair da tela
    if (this.launched) {
      const slowLaunch = effects.asteroidSpeedMultiplier(this);
      const prevLX = this.x, prevLY = this.y;
      this.x += this.vx * dt * slowLaunch;
      this.y += this.vy * dt * slowLaunch;
      this.trackMotion(this.x - prevLX, this.y - prevLY, dt);
      const { w, h } = viewport();
      const m = this.radius + 40;
      if (this.x < -m || this.x > w + m || this.y < -m || this.y > h + m) this.dead = true;
      return;
    }

    // frozen / freeze (já considera gelo, fogo e bosses)
    const slow = effects.asteroidSpeedMultiplier(this);
    const prevX = this.x, prevY = this.y;
    this.updateMovement(dt * slow);
    this.trackMotion(this.x - prevX, this.y - prevY, dt);
    if (this.enteredArena) this.updateBehavior(dt);
  }

  /**
   * Movimento livre dentro da arena: forças nas bordas empurram para dentro e a velocidade
   * tende a `speed`. Asteroides que ainda estão acima da arena descem até entrar.
   */
  updateMovement(dt) {
    // Entrada dramática (só o boss): desce reto e invencível até a linha do topo
    if (!this.enteredArena) {
      this.y += this.speed * 1.12 * dt;
      this.x += this.vx * 0.16 * dt;
      if (this.y >= ARENA_TOP + this.radius) this.enteredArena = this.inArena = true;
      return;
    }

    const { w, h } = viewport();
    const top = ARENA_TOP + this.radius;
    const bottom = Math.max(top, this.arenaBottom(h));
    const left = 10 + this.radius;
    const right = Math.max(left, w - 10 - this.radius);
    const band = Math.min(125, Math.max(72, Math.min(w, h) * 0.14));
    const force = px(this.boss ? 310 : 255);
    // Vindo de cima da tela: a força do topo empurra para dentro, sem prender na linha ainda
    if (!this.inArena && this.y >= top - 12) this.inArena = true;
    if (!this.inArena) this.vy = Math.max(this.vy, this.speed * 0.55);
    let ax = 0, ay = 0;

    if (this.x - left < band) ax += (1 - (this.x - left) / band) * force;
    if (right - this.x < band) ax -= (1 - (right - this.x) / band) * force;
    if (this.y - top < band) ay += (1 - (this.y - top) / band) * force;
    if (bottom - this.y < band) ay -= (1 - (bottom - this.y) / band) * force;
    this.vx += ax * dt;
    this.vy += ay * dt;

    const current = Math.hypot(this.vx, this.vy) || 1;
    const target = this.speed * (this.boss ? this.speedFactor : 1);
    const adjustment = clamp((target - current) * dt * 1.8, -px(24), px(24));
    this.vx += (this.vx / current) * adjustment;
    this.vy += (this.vy / current) * adjustment;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < left - 12) { this.x = left - 12; this.vx = Math.abs(this.vx) * 0.55; }
    if (this.x > right + 12) { this.x = right + 12; this.vx = -Math.abs(this.vx) * 0.55; }
    if (this.inArena && this.y < top - 12) { this.y = top - 12; this.vy = Math.abs(this.vy) * 0.55; }
    if (this.y > bottom + 12) { this.y = bottom + 12; this.vy = -Math.abs(this.vy) * 0.55; }
  }

  // ------------------------------------------------------------------
  // Ganchos: cada tipo de asteroide sobrescreve o que precisar
  // ------------------------------------------------------------------

  /** Limite de baixo do movimento (centro do asteroide). Bosses ficam mais acima. */
  arenaBottom(h) { return h - 14 - this.radius; }

  /** Comportamento próprio a cada quadro (ataques dos bosses...). Só roda dentro da arena. */
  updateBehavior(dt) { }

  /** Tomou dano (depois de descontar a armadura). */
  onDamaged(amount, source) { }

  /** Acabou de ser destruído. reason: "shot" | "burn" | "player" | "bossDown". */
  onDestroyed(reason) { }

  /** Desenho atrás do sprite (auras...). Origem no centro, sem rotação. */
  drawSpecialEffects() { }

  /** Desenho por cima do sprite (ex.: clarões). Origem no centro, sem rotação. */
  drawOverSprite() { }

  /** Indicador de armadura (o Resistente tem a versão elaborada). */
  drawArmor() { }

  /**
   * Aplica dano. A armadura absorve primeiro; o que passar vira pontos e tira vida.
   * @param {number} damage
   * @param {"shot" | "burn"} source "shot" = tiro/raio, "burn" = efeitos (fogo, gelo, explosões)
   */
  hit(damage, source = "shot") {
    if (this.dead) return;
    let amount = Math.max(0, Math.round(Number(damage) || 0));
    if (!amount) return;
    if (this.armor > 0) {
      const blocked = Math.min(amount, this.armor);
      this.armor -= blocked;
      amount -= blocked;
      this.emit("armorDamaged", { asteroid: this, amount: blocked, armor: this.armor });
    }
    if (amount <= 0) return;
    const removed = Math.min(amount, this.hp); // vida realmente retirada
    this.hp = Math.max(0, this.hp - amount);
    this.scoreDamage(removed, source);
    this.onDamaged(amount, source);
    if (this.hp === 0) this.destroy(source);
  }

  /** Nuvem curta de poeira na cor do tipo (ASTEROID_INFO[type].dust) ao ser destruído. */
  spawnDust() {
    const base = ASTEROID_INFO[this.type]?.dust ?? ASTEROID_INFO.common.dust;
    const count = this.boss ? 46 : Math.round(clamp(this.size * 0.28, 15, 24));
    const available = Math.min(count, Math.max(0, Asteroid.DUST_MAX_ACTIVE - particles.length));

    for (let i = 0; i < available; i++) {
      const angle = random(0, Math.PI * 2);
      // Começa distribuída dentro do corpo do asteroide para parecer poeira soltando.
      const origin = Math.sqrt(Math.random()) * this.radius * 0.72;
      const speed = random(28, this.boss ? 145 : 105);
      const isCloud = Math.random() < 0.72;
      const lifetime = random(Asteroid.DUST_LIFE_MIN, Asteroid.DUST_LIFE_MAX)
        * (this.boss ? 1.22 : 1);
      const shade = random(0.77, 1.15);
      const r = Math.min(255, Math.round(base[0] * shade));
      const g = Math.min(255, Math.round(base[1] * shade));
      const b = Math.min(255, Math.round(base[2] * shade));
      const opacity = isCloud ? random(0.34, 0.59) : random(0.65, 0.9);
      const size = (isCloud ? random(2.3, 4.3) : random(1, 2.3))
        * (this.boss ? 1.25 : 1);

      particles.push({
        x: this.x + Math.cos(angle) * origin,
        y: this.y + Math.sin(angle) * origin,
        vx: Math.cos(angle) * speed + this.vx * 0.12,
        vy: Math.sin(angle) * speed + this.vy * 0.12,
        size,
        color: `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`,
        life: lifetime,
        maxLife: lifetime,
      });
    }
  }

  /** Vida média dos asteroides do setor atual (base de pontos e danos proporcionais). */
  static levelHp() {
    return state.levelConfig?.enemies?.averageHp ?? 2;
  }

  /**
   * Dano da batida deste asteroide no escudo da nave (BALANCE.levels.contact).
   * Depende do setor e de quantos asteroides ficam ao mesmo tempo na arena; um asteroide
   * já ferido bate mais fraco (até minFraction do dano com a vida no fim).
   */
  contactDamage() {
    const base = state.levelConfig?.enemies?.contact ?? this.hp;
    const { minFraction } = BALANCE.levels.contact;
    const life = this.maxHp > 0 ? clamp(this.hp / this.maxHp, 0, 1) : 1;
    let damage = base * (minFraction + (1 - minFraction) * life);
    if (this.launched) damage *= BALANCE.launchedContactMultiplier; // arremessado pelo Gravitacional
    return Math.max(1, Math.round(damage));
  }

  /**
   * Destrói o asteroide: conta para o objetivo, dá pontos e combo (se foi o jogador),
   * solta poeira e avisa o tipo (onDestroyed) e quem estiver ouvindo ("destroyed").
   * @param {"shot" | "burn" | "player" | "bossDown"} reason
   *   shot/burn = abate do jogador; player = bateu na nave; bossDown = o boss da arena caiu
   */
  destroy(reason = "shot") {
    if (this.dead) return;
    this.dead = true;
    const playerKill = reason === "shot" || reason === "burn";
    if (this.isPrimary && !this.boss) state.playing.kills.total += 1; // objetivo do setor

    if (playerKill) {
      // A vida já virou pontos em hit(); aqui entram o bônus do tipo e o da sequência.
      // Especiais e bosses valem uma fração da vida média do setor (BALANCE.score).
      const { specialKill, bossKill } = BALANCE.score;
      const bonus = this.type === "common" ? 0 : Asteroid.levelHp() * (this.boss ? bossKill : specialKill);
      const bonusPoints = Math.round(bonus * effects.scoreMultiplier());
      state.playing.score += bonusPoints;
      this.scoreCombo();

      // Abates por tipo (vão para o save no fim da partida). Bosses contam ao vencer o setor.
      if (!this.boss) state.playing.kills[this.type] = (state.playing.kills[this.type] ?? 0) + 1;

      // Especiais mostram o nome ao serem derrotados (o Dourado mostra o próprio bônus)
      const info = ASTEROID_INFO[this.type];
      if (info?.category === "special" && this.type !== "golden") {
        spawnFloatingText(this.x, this.y - this.radius * 0.4, `${info.name.toUpperCase()} +${bonusPoints}`, info.color);
      }
      addShake(this.boss ? 7 : 2);
    }
    if (this.boss && state.boss === this) state.boss = null;

    this.spawnDust();
    this.onDestroyed(reason);
    this.emit("destroyed", { asteroid: this, reason, playerKill });
  }

  // ==================================================================
  // VISUAL DOS EFEITOS (fogo / frio) NESTE ASTEROIDE
  // ==================================================================

  /** Estado visual atual: quais efeitos globais estão de fato afetando este asteroide. */
  effectVisualState() {
    const speed = effects.asteroidSpeedMultiplier(this);
    return {
      burning: effects.isActive("flame") && effects.burnAffects(this),
      frozenSolid: effects.isActive("freeze") && speed === 0,        // congelado (parado)
      chilled: speed < 1 && !(effects.isActive("freeze") && speed === 0), // só lento (frio)
      deepChill: effects.isActive("freeze") && speed > 0 && speed < 1, // lento pelo freeze (fogo / boss)
    };
  }

  /** Guarda a direção real do movimento (suavizada) para orientar o rastro das chamas. */
  trackMotion(dx, dy, dt) {
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return; // parado (ex.: congelado): mantém a última direção
    this.motionX ??= 0;
    this.motionY ??= 1;
    const k = 1 - Math.exp(-dt * 8);
    this.motionX += (dx / len - this.motionX) * k;
    this.motionY += (dy / len - this.motionY) * k;
  }

  /** Ângulo oposto ao movimento: para onde as chamas e brasas "escorrem". */
  trailAngle() {
    return Math.atan2(-(this.motionY ?? 1), -(this.motionX ?? 0));
  }

  /** Timers dos flashes instantâneos + partículas contínuas (brasas e cristais de gelo). */
  updateEffectFx(dt) {
    const fx = this.fx ??= { incinerate: 0, freezeBurst: 0, bleve: 0, emberTimer: 0 };
    fx.incinerate = Math.max(0, fx.incinerate - dt);
    fx.freezeBurst = Math.max(0, fx.freezeBurst - dt);
    fx.bleve = Math.max(0, fx.bleve - dt);

    if (!this.enteredArena) return;
    const { burning, frozenSolid, chilled } = this.effectVisualState();
    fx.emberTimer -= dt;
    if (fx.emberTimer > 0) return;

    if (burning) {
      fx.emberTimer = random(0.05, 0.11);
      this.spawnFxParticles(1, () => [random(0, 1) < 0.5 ? "255, 196, 92" : "255, 120, 60"], {
        speed: [20, 55], direction: this.trailAngle(), life: [0.35, 0.7], size: [1.6, 3.2],
      });
    } else if (frozenSolid || chilled) {
      fx.emberTimer = frozenSolid ? random(0.12, 0.2) : random(0.2, 0.35);
      this.spawnFxParticles(1, () => ["200, 245, 255"], {
        speed: [6, 22], upward: false, life: [0.5, 0.9], size: [1.2, 2.4],
      });
    }
  }

  /** Partículas usando o array global `particles` (o game_loop move, desenha e apaga). */
  spawnFxParticles(count, colorFn, { speed = [20, 60], upward = false, direction = null, life = [0.3, 0.6], size = [1.5, 3], spread = 1 } = {}) {
    if (particles.length > Asteroid.DUST_MAX_ACTIVE) return;
    for (let i = 0; i < count; i++) {
      const angle = direction !== null ? direction + random(-0.5, 0.5)
        : upward ? random(-Math.PI * 0.85, -Math.PI * 0.15)
        : random(0, Math.PI * 2);
      const from = random(0.5, 1) * this.radius * spread;
      const v = random(speed[0], speed[1]);
      const lifetime = random(life[0], life[1]);
      const [rgb] = colorFn();
      particles.push({
        x: this.x + Math.cos(angle) * from,
        y: this.y + Math.sin(angle) * from,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        size: random(size[0], size[1]),
        color: `rgba(${rgb}, ${random(0.65, 0.95).toFixed(2)})`,
        life: lifetime,
        maxLife: lifetime,
      });
    }
  }

  /** Disparado pelos eventos de efeitos instantâneos (ver listeners no fim do arquivo). */
  flashEffect(kind) {
    if (this.dead) return;
    const fx = this.fx ??= { incinerate: 0, freezeBurst: 0, bleve: 0, emberTimer: 0 };
    fx[kind] = kind === "bleve" ? 0.7 : 0.5;
    if (kind === "incinerate") {
      this.spawnFxParticles(14, () => [random(0, 1) < 0.5 ? "255, 214, 120" : "255, 110, 50"], { speed: [60, 170], life: [0.25, 0.5], size: [2, 3.6] });
    } else if (kind === "freezeBurst") {
      this.spawnFxParticles(12, () => ["210, 248, 255"], { speed: [50, 140], life: [0.3, 0.6], size: [1.6, 3] });
    } else if (kind === "bleve") {
      this.spawnFxParticles(10, () => ["255, 190, 90"], { speed: [80, 200], life: [0.25, 0.5], size: [2, 3.8] });
      this.spawnFxParticles(10, () => ["225, 235, 245"], { speed: [20, 70], life: [0.6, 1], size: [3, 5.5] }); // vapor
    }
  }

  /** Gradientes da língua de fogo, criados uma vez (desenhados num espaço unitário). */
  static #flameGradients = null;
  /** Gradientes da língua de fogo (criados na primeira vez e reaproveitados). */
  static flameGradients() {
    if (Asteroid.#flameGradients) return Asteroid.#flameGradients;
    const outer = ctx.createLinearGradient(0, 0, 0, -1);
    outer.addColorStop(0, "rgba(255, 150, 60, .85)");
    outer.addColorStop(0.55, "rgba(255, 90, 35, .55)");
    outer.addColorStop(1, "rgba(255, 50, 20, 0)");
    const inner = ctx.createLinearGradient(0, 0, 0, -1);
    inner.addColorStop(0, "rgba(255, 245, 190, .9)");
    inner.addColorStop(1, "rgba(255, 200, 90, 0)");
    return (Asteroid.#flameGradients = { outer, inner });
  }

  /** Língua de fogo da base (bx, by) até a ponta (tx, ty), com largura w e o gradiente dado. */
  static drawFlameTongue(bx, by, tx, ty, w, gradient) {
    const len = Math.hypot(tx - bx, ty - by);
    if (len < 0.5) return;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.atan2(tx - bx, -(ty - by))); // ponta apontando para (tx, ty)
    ctx.scale(w, len);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.quadraticCurveTo(-0.5, -0.5, 0, -1);
    ctx.quadraticCurveTo(0.5, -0.5, 1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Aura redonda (gradiente radial) em cache, por cor e tamanho. */
  static drawAura(radius, inner, rgb, alpha) {
    const r = Math.max(4, Math.round(radius));
    const aura = SpriteCache.shape(`aura|${rgb}|${r}|${inner}`, r * 2, r * 2, (c) => {
      const g = c.createRadialGradient(0, 0, r * inner, 0, 0, r);
      g.addColorStop(0, `rgba(${rgb}, 1)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
    });
    ctx.save();
    ctx.globalAlpha *= alpha;
    SpriteCache.drawCentered(aura, radius / r);
    ctx.restore();
  }

  /** Camada ATRÁS do sprite: aura de fogo, línguas de chama, auras frias. */
  drawActiveEffects() {
    const { burning, frozenSolid, chilled, deepChill } = this.effectVisualState();
    const r = this.radius;

    if (burning) {
      const flicker = 0.75 + Math.sin(this.age * 21) * 0.12 + Math.sin(this.age * 13.7) * 0.08;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      Asteroid.drawAura(r * 1.6, 0.375, "255, 120, 40", 0.32 * flicker);
      // Línguas de fogo no sentido CONTRÁRIO ao movimento (o rastro da chama), em duas
      // camadas: externa laranja e núcleo amarelo, com o comprimento tremulando.
      ctx.rotate(this.trailAngle() + Math.PI / 2);
      const { outer, inner } = Asteroid.flameGradients();
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const angle = -Math.PI * (0.06 + t * 0.88);
        const wave = Math.abs(Math.sin(this.age * (8 + i * 1.9) + i * 1.3));
        const len = r * (0.75 + 0.5 * wave) * (1 - Math.abs(t - 0.5) * 0.6);
        const bx = Math.cos(angle) * r * 0.72;
        const by = Math.sin(angle) * r * 0.72;
        const sway = Math.sin(this.age * 6 + i) * r * 0.12;
        const tx = bx + Math.cos(angle) * len * 0.35 + sway;
        const ty = by - len;
        Asteroid.drawFlameTongue(bx, by, tx, ty, r * 0.3, outer);
        Asteroid.drawFlameTongue(bx, by, bx + (tx - bx) * 0.6, by + (ty - by) * 0.6, r * 0.14, inner);
      }
      ctx.restore();
    }

    if (chilled || deepChill || frozenSolid) {
      const strong = deepChill || frozenSolid;
      Asteroid.drawAura(r * 1.45, 0.48, "150, 230, 255", strong ? 0.3 : 0.18);
    }
  }

  /** Camada NA FRENTE do sprite: tinta de cor, casca de gelo, cristais e flashes. */
  drawEffectOverlay() {
    const { burning, frozenSolid, chilled, deepChill } = this.effectVisualState();
    const fx = this.fx ?? {};
    const r = this.radius;

    // Tinta sobre o próprio sprite (só pinta onde há asteroide)
    ctx.save();
    ctx.rotate(this.rotation);
    if (frozenSolid) this.drawTint("#bfefff", 0.5);
    else if (deepChill) this.drawTint("#9fe6ff", 0.38);
    else if (chilled) this.drawTint("#8fdcff", 0.24);
    if (burning) this.drawTint("#ff7a2e", 0.16 + Math.abs(Math.sin(this.age * 11)) * 0.12);
    if (fx.incinerate > 0) this.drawTint("#fff1c2", (fx.incinerate / 0.5) * 0.85);
    if (fx.freezeBurst > 0) this.drawTint("#ffffff", (fx.freezeBurst / 0.5) * 0.7);
    if (fx.bleve > 0) this.drawTint("#ffe0a8", (fx.bleve / 0.7) * 0.8);
    ctx.restore();

    // Frio: cristais pequenos orbitando
    if (chilled || deepChill) {
      ctx.save();
      ctx.fillStyle = "rgba(225, 250, 255, .9)";
      for (let i = 0; i < 4; i++) {
        const a = this.age * 0.9 + (i * Math.PI) / 2;
        Asteroid.drawSparkle(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18, 3 + Math.sin(this.age * 4 + i) * 1);
      }
      ctx.restore();
    }

    // Congelado: casca de gelo cristalina em volta
    if (frozenSolid) {
      ctx.save();
      const shards = 9;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(235, 252, 255, .85)";
      ctx.fillStyle = "rgba(170, 235, 255, .22)";
      ctx.beginPath();
      for (let i = 0; i <= shards; i++) {
        const a = (i / shards) * Math.PI * 2 + 0.3;
        const rr = r * (i % 2 ? 1.18 : 1.32);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      glowStroke("rgba(235, 252, 255, .85)", 1.5, { glow: 6, glowAlpha: 0.35 });
      // Reflexo
      ctx.strokeStyle = "rgba(255, 255, 255, .55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, -Math.PI * 0.85, -Math.PI * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    // Flashes de efeitos instantâneos: onda de choque
    const wave = (t, total, color, maxScale) => {
      const k = 1 - t / total; // 0 -> 1
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 + k * maxScale), 0, Math.PI * 2);
      glowStroke(color, 4 * (1 - k) + 1, { glow: 14, glowAlpha: 0.3 });
      ctx.restore();
    };
    if (fx.incinerate > 0) wave(fx.incinerate, 0.5, "#ff8a3d", 1.2);
    if (fx.freezeBurst > 0) wave(fx.freezeBurst, 0.5, "#c8f6ff", 1.1);
    if (fx.bleve > 0) {
      wave(fx.bleve, 0.7, "#ffb347", 1.8);
      if (fx.bleve > 0.35) wave(fx.bleve - 0.35, 0.35, "#ffffff", 1.2);
    }
  }

  /** Pinta o sprite com uma cor (só onde há pixels do asteroide), com a opacidade dada. */
  drawTint(color, alpha) {
    if (alpha <= 0) return;
    const tinted = SpriteCache.image(this.image, this.size, { tint: color });
    if (!tinted) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    SpriteCache.drawCentered(tinted, this.size / tinted.size);
    ctx.restore();
  }

  /** Tamanho do sprite na tela: cabe em size × size mantendo a proporção da imagem. */
  spriteBox() {
    const img = this.image;
    if (!imageReady(img)) return { w: this.size, h: this.size };
    const k = this.size / Math.max(img.naturalWidth, img.naturalHeight);
    return { w: img.naturalWidth * k, h: img.naturalHeight * k };
  }

  /** Brilho em forma de estrela de 4 pontas. */
  static drawSparkle(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.28, y - size * 0.28);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.28, y + size * 0.28);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.28, y + size * 0.28);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.28, y - size * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  /** Sombra (asteroides) ou brilho dourado (bosses) em volta do sprite, pré-renderizado. */
  spriteGlow() {
    return this.boss ? { glow: "rgba(255, 213, 118, .45)", blur: px(18) } : { glow: "rgba(0, 0, 0, .25)", blur: px(8) };
  }

  /**
   * Desenha o asteroide: efeitos atrás, sprite (do cache, já com brilho), efeitos na frente,
   * armadura e a vida (bosses: barra + número acima).
   */
  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.drawSpecialEffects();
    this.drawActiveEffects();

    ctx.save();
    ctx.rotate(this.rotation);
    const sprite = SpriteCache.image(this.image, this.size, this.spriteGlow());
    if (sprite) {
      SpriteCache.drawCentered(sprite, this.size / sprite.size);
    } else {
      // Imagem ainda carregando: círculo provisório
      ctx.fillStyle = "#8b92a6";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    this.drawOverSprite();
    this.drawEffectOverlay();
    this.drawArmor();
    this.drawHealth();
    ctx.restore();
  }

  /**
   * Vida: número no centro (asteroides) ou barra + "NOME  vida" acima (bosses, para não cobrir
   * o sprite). O nome fica à esquerda do número, na cor do boss, e o conjunto é centralizado.
   * Os bosses que patrulham ficam baixo o bastante para isso caber (BossAsteroid.patrolTop).
   */
  drawHealth() {
    const textScale = clamp(SCALE, 0.85, 1.2);
    ctx.font = `700 ${Math.round(14 * textScale)}px Orbitron, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    if (!this.boss) {
      ctx.fillText(this.hp, 0, 5);
      return;
    }

    const textY = -this.radius - px(28);
    const barY = -this.radius - px(20);
    const hpText = String(this.hp);
    const name = (this.displayName ?? "").toUpperCase();
    if (name) {
      const hpWidth = ctx.measureText(hpText).width;
      const nameFont = `700 ${Math.round(11 * textScale)}px Orbitron, sans-serif`;
      ctx.font = nameFont;
      const nameWidth = ctx.measureText(name).width;
      const gap = 8 * textScale;
      const left = -(nameWidth + gap + hpWidth) / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = this.nameColor ?? "#fff";
      ctx.fillText(name, left, textY);
      ctx.font = `700 ${Math.round(14 * textScale)}px Orbitron, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(hpText, left + nameWidth + gap, textY);
      ctx.textAlign = "center";
    } else {
      ctx.fillText(hpText, 0, textY);
    }
    const width = this.size * 0.95;
    const barH = Math.max(3, px(5));
    ctx.fillStyle = "#252a44";
    ctx.fillRect(-width / 2, barY, width, barH);
    ctx.fillStyle = "#ffbf66";
    ctx.fillRect(-width / 2, barY, width * (this.hp / this.maxHp), barH);
  }
}

