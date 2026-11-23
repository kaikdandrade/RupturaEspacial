'use strict';

/**
 * Sistema de efeitos
 *   effects.reset()                -> limpa tudo
 *   effects.update(dt)             -> avança o relógio dos efeitos
 *   effects.activate("frozen")     -> ativa um efeito (cuida das evoluções sozinho)
 *   effects.isActive("quickShot")  -> consulta
 *   effects.on("bleve", fn)        -> eventos para o jogo reagir (dano em área, toasts, sons...)
 */
class Effect {
    /**
     * Configuração de cada efeito. Ajuste os números aqui.
     * - duration: segundos (0 = instantâneo)
     * - evolvesTo: se pegar este efeito com ele já ativo, vira o efeito indicado
     * - label: nome exibido no HUD
     */
    static CONFIG = {
        // Deixa lento os asteroids (excessão de gelo). Bosses ficam só um pouco lentos.
        // Os de fogo ficam AINDA mais lentos que os comuns e tomam dano do frio.
        frozen: {
            label: "Frozen", duration: 6, evolvesTo: "freeze",
            speedMultiplier: 0.5, volcanicSpeedMultiplier: 0.35, bossSpeedMultiplier: 0.75,
            frostTickInterval: 1, frostDamagePerTick: 1,
        },
        // Evolução de "frozen", congela os asteroids (os de fogo e os bosses ficam lentos em vez de congelar).
        // Os de fogo tomam um dano instantâneo ao ativar (burstDamage) e depois dano do frio.
        freeze: {
            label: "Freeze", duration: 4,
            speedMultiplier: 0, volcanicSpeedMultiplier: 0.35, bossSpeedMultiplier: 0.5,
            burstDamage: 8,
            frostTickInterval: 0.75, frostDamagePerTick: 1,
        },
        // Dano consecutivo de fogo nos asteroids (os de gelo tomam dano extra)
        flame: { label: "Flame", duration: 6, evolvesTo: "incinerate", tickInterval: 0.5, damagePerTick: 1 },
        // Evolução de "flame".  Dano explosivo instantâneo
        incinerate: { label: "Incinerate", duration: 0, damage: 8, consumesFlame: true },
        // Fogo encontra gelo (ou gelo encontra fogo). Explosão instantânea em todos os asteroides,
        // consome os efeitos de fogo e gelo ativos.
        bleve: { label: "BLEVE", duration: 0, damage: 12 },

        // Player
        scoreBonus: { label: "Pontos extras", duration: 8, scoreMultiplier: 1.5 },
        quickShot: { label: "Tiro rápido", duration: 8, fireIntervalMultiplier: 0.6 },
        speedBoost: { label: "Velocidade", duration: 8, moveSpeedMultiplier: 1.35 },
        damageBoost: { label: "Dano extra", duration: 8, damageMultiplier: 1.5 },
        piercingShot: { label: "Perfurante", duration: 8, pierceCount: 2 },
        invulnerability: { label: "Invulnerável", duration: 5 },
    };

    /** Asteroides de gelo levam este multiplicador de dano dos efeitos de fogo. */
    static ICE_FIRE_DAMAGE_MULTIPLIER = 2;

    #time = 0;
    #until = {}; // nome -> instante (no relógio interno) em que o efeito acaba
    #flameTickTimer = 0;
    #frostTickTimer = 0;
    #listeners = new Map();

    constructor() {
        this.reset();
    }

    // ------------------------------------------------------------------
    // Ciclo de vida
    // ------------------------------------------------------------------

    // Limpa todos os efeitos. Retorna a própria instância
    reset() {
        this.#time = 0;
        this.#flameTickTimer = 0;
        this.#frostTickTimer = 0;
        this.#until = Object.fromEntries(Object.keys(Effect.CONFIG).map((name) => [name, 0]));
        return this;
    }

    /** Avança o relógio, dispara os ticks de fogo e encerra efeitos vencidos. */
    update(dt) {
        if (!(dt > 0)) return;
        this.#time += dt;

        // Ticks do "flame"
        if (this.isActive("flame")) {
            const { tickInterval, damagePerTick } = Effect.CONFIG.flame;
            this.#flameTickTimer += dt;
            while (this.#flameTickTimer >= tickInterval) {
                this.#flameTickTimer -= tickInterval;
                this.#emit("flameTick", { damage: damagePerTick });
            }
        } else {
            this.#flameTickTimer = 0;
        }

        // Ticks do frio (frozen/freeze) nos asteroides de fogo
        const frost = this.isActive("freeze") ? Effect.CONFIG.freeze
            : this.isActive("frozen") ? Effect.CONFIG.frozen : null;
        if (frost) {
            this.#frostTickTimer += dt;
            while (this.#frostTickTimer >= frost.frostTickInterval) {
                this.#frostTickTimer -= frost.frostTickInterval;
                this.#emit("frostTick", { damage: frost.frostDamagePerTick });
            }
        } else {
            this.#frostTickTimer = 0;
        }

        // Expiração
        for (const name of Object.keys(this.#until)) {
            const until = this.#until[name];
            if (until > 0 && until <= this.#time) {
                this.#until[name] = 0;
                this.#emit("expired", { name });
            }
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
            this.#emit("evolved", { from: name, to: config.evolvesTo });
            return this.activate(config.evolvesTo);
        }

        // Com "freeze" ativo, um novo "frozen" só renova o congelamento
        if (name === "frozen" && this.isActive("freeze")) return this.activate("freeze");

        // BLEVE: fogo encontra gelo (ou gelo encontra fogo)
        const iceActive = this.isActive("frozen") || this.isActive("freeze");
        if ((name === "flame" && iceActive) || (name === "frozen" && this.isActive("flame"))) {
            this.#emit("evolved", { from: name, to: "bleve" });
            return this.activate("bleve");
        }

        // Efeitos instantâneos
        if (config.duration <= 0) {
            if (name === "incinerate") {
                if (config.consumesFlame) this.#until.flame = 0;
                this.#emit("incinerate", { damage: config.damage });
            }
            if (name === "bleve") {
                this.#until.flame = 0;
                this.#until.frozen = 0;
                this.#until.freeze = 0;
                this.#emit("bleve", { damage: config.damage });
            }
            this.#emit("activated", { name, duration: 0 });
            return name;
        }

        const refreshed = this.isActive(name);
        this.#until[name] = Math.max(this.#until[name], this.#time + config.duration);
        if (name === "flame" && !refreshed) this.#flameTickTimer = 0;
        // Choque de congelamento nos asteroides de fogo (só quando o freeze começa, não ao renovar)
        if (name === "freeze" && !refreshed) this.#emit("freezeBurst", { damage: config.burstDamage });
        this.#emit(refreshed ? "refreshed" : "activated", { name, duration: config.duration });
        return name;
    }

    /** Encerra um efeito na hora. */
    clear(name) {
        if (!this.isActive(name)) return;
        this.#until[name] = 0;
        this.#emit("expired", { name });
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

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

    /** Lista dos efeitos ativos, para desenhar no HUD. */
    activeList() {
        return Object.keys(this.#until)
            .filter((name) => this.isActive(name))
            .map((name) => ({
                name,
                label: Effect.CONFIG[name].label ?? name,
                remaining: this.remaining(name),
                progress: this.progress(name),
            }));
    }

    // ------------------------------------------------------------------
    // Modificadores prontos para o jogo usar
    // ------------------------------------------------------------------

    /** Multiplicador de velocidade de um asteroide, considerando as exceções de cada efeito. */
    asteroidSpeedMultiplier(asteroid) {
        if (!asteroid) return 1;
        const { frozen, freeze } = Effect.CONFIG;

        if (this.isActive("freeze")) {
            if (asteroid.boss) return freeze.bossSpeedMultiplier;
            if (asteroid.type === "volcanic") return freeze.volcanicSpeedMultiplier;
            return freeze.speedMultiplier;
        }

        if (this.isActive("frozen")) {
            if (asteroid.boss) return frozen.bossSpeedMultiplier;
            if (asteroid.type === "volcanic") return frozen.volcanicSpeedMultiplier;
            if (asteroid.type === "frozen") return 1;
            return frozen.speedMultiplier;
        }

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

    moveSpeedMultiplier() {
        return this.isActive("speedBoost") ? Effect.CONFIG.speedBoost.moveSpeedMultiplier : 1;
    }

    /** Dano final de um tiro. */
    damage(baseDamage) {
        if (!this.isActive("damageBoost")) return baseDamage;
        return Math.ceil(baseDamage * Effect.CONFIG.damageBoost.damageMultiplier);
    }

    scoreMultiplier() {
        return this.isActive("scoreBonus") ? Effect.CONFIG.scoreBonus.scoreMultiplier : 1;
    }

    /** Quantos asteroides extras um tiro atravessa (0 = para no primeiro). */
    pierceCount() {
        return this.isActive("piercingShot") ? Effect.CONFIG.piercingShot.pierceCount : 0;
    }

    isInvulnerable() {
        return this.isActive("invulnerability");
    }

    // ------------------------------------------------------------------
    // Eventos: activated, refreshed, evolved, expired, flameTick, frostTick, freezeBurst, incinerate, bleve
    // ------------------------------------------------------------------

    on(event, callback) {
        if (typeof callback !== "function") throw new TypeError("O listener deve ser uma função");
        if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
        this.#listeners.get(event).add(callback);
        return () => this.#listeners.get(event)?.delete(callback);
    }

    #emit(event, payload = {}) {
        for (const callback of [...(this.#listeners.get(event) ?? [])]) callback(payload);
    }
}

const effects = new Effect();