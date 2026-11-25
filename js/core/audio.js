"use strict";

/**
 * @file Motor de áudio: tudo é sintetizado na hora com a Web Audio API (sem arquivos de som).
 *
 * Caminho do som:
 *   instrumentos/efeitos → canal de música ou de efeitos → master → compressor → alto-falante
 *                                  └→ eco (só a música, para o clima "espacial")
 *
 * - audio.unlock(): o navegador só libera som depois de um clique/toque/tecla. Chamado sozinho
 *   no primeiro gesto do jogador (ver o fim deste arquivo).
 * - audio.music / audio.sfx: canais com o volume salvo em SAVE.audio.
 * - audio.voice(...): toca uma nota de instrumento (usado pelo sequenciador de music.js).
 * - playTone(...): bipe simples para os efeitos curtos de interface e de jogo.
 * - Sfx.shoot(): som do tiro da nave.
 */
class AudioEngine {
  /** @type {AudioContext | null} criado só depois do primeiro gesto do jogador */
  ctx = null;
  /** Canal da música (volume = SAVE.audio.music). */
  music = null;
  /** Canal dos efeitos (volume = SAVE.audio.sfx). */
  sfx = null;
  /** Entrada do eco (a música manda uma parte do som para cá). */
  echo = null;

  #master = null;
  #noise = null;
  #listeners = [];

  /** Cria o contexto de áudio (uma vez) e retoma se estiver suspenso. */
  unlock() {
    try {
      if (!this.ctx) this.#build();
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch {
      this.ctx = null; // navegador sem Web Audio: o jogo segue mudo
    }
  }

  /** O áudio está pronto para tocar? */
  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Avisa quando o áudio ficar pronto (o sequenciador espera por isso). */
  onReady(callback) {
    this.#listeners.push(callback);
  }

  /** Aplica os volumes salvos (sliders e botão de mudo chamam isto). */
  applyVolumes() {
    if (!this.ctx) return;
    const { music, sfx, muted } = SAVE.audio;
    const now = this.ctx.currentTime;
    this.#master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
    this.music.gain.setTargetAtTime(music * 0.55, now, 0.05);
    this.sfx.gain.setTargetAtTime(sfx * 0.9, now, 0.05);
  }

  /** Pausa todo o áudio (aba escondida) ou retoma. */
  setSuspended(suspended) {
    if (!this.ctx) return;
    if (suspended) this.ctx.suspend();
    else this.ctx.resume();
  }

  #build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    // Compressor no fim: segura picos quando muitos sons tocam juntos
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    this.#master = ctx.createGain();
    this.#master.connect(comp);

    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.#master);
    this.sfx.connect(this.#master);

    // Eco: atraso de 3/16 de compasso a ~136 BPM, com realimentação filtrada (som "distante")
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.28;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.33;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    this.echo.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(this.music);

    // Ruído branco (2 s) reaproveitado por bateria e efeitos
    const length = ctx.sampleRate * 2;
    this.#noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.#noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    const notify = () => {
      if (ctx.state !== "running") return;
      const callbacks = this.#listeners;
      this.#listeners = [];
      callbacks.forEach((cb) => cb());
    };
    ctx.addEventListener("statechange", notify);
    notify();
  }

  /**
   * Toca uma nota de instrumento.
   * @param {object} o
   * @param {AudioNode} o.out destino (audio.music ou audio.sfx)
   * @param {number} o.time quando começa (ctx.currentTime + ...)
   * @param {number} o.freq frequência em Hz
   * @param {number} o.dur duração em segundos (antes do release)
   * @param {OscillatorType} [o.wave] forma de onda
   * @param {number} [o.vol] volume de pico
   * @param {number} [o.attack] subida (s)
   * @param {number} [o.release] descida depois do fim (s)
   * @param {number} [o.sustain] fração do volume mantida depois do ataque (0..1)
   * @param {number} [o.cutoff] filtro passa-baixa (Hz); 0 = sem filtro
   * @param {number} [o.slideTo] desliza a frequência até este valor durante a nota
   * @param {number} [o.vibrato] profundidade do vibrato em Hz (começa no meio da nota)
   * @param {number} [o.echo] quanto vai para o eco (0..1)
   * @param {number} [o.detune] segunda onda desafinada (cents) para engrossar o som; 0 = não
   */
  voice({ out, time, freq, dur, wave = "square", vol = 0.2, attack = 0.005, release = 0.05,
          sustain = 0.7, cutoff = 0, slideTo = 0, vibrato = 0, echo = 0, detune = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const end = time + dur;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(vol, time + attack);
    env.gain.setTargetAtTime(vol * sustain, time + attack, dur * 0.35 + 0.01);
    env.gain.setTargetAtTime(0.0001, end, release / 3);

    let input = env;
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.7;
      filter.connect(env);
      input = filter;
    }

    const oscs = [];
    const makeOsc = (cents) => {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, time);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, end);
      osc.detune.value = cents;
      osc.connect(input);
      oscs.push(osc);
      return osc;
    };
    makeOsc(0);
    if (detune) makeOsc(detune);

    if (vibrato && dur > 0.18) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(vibrato, time + dur * 0.6);
      lfo.connect(depth);
      oscs.forEach((osc) => depth.connect(osc.frequency));
      lfo.start(time);
      lfo.stop(end + release);
    }

    env.connect(out);
    if (echo) {
      const send = ctx.createGain();
      send.gain.value = echo;
      env.connect(send).connect(this.echo);
    }
    oscs.forEach((osc) => {
      osc.start(time);
      osc.stop(end + release + 0.02);
    });
  }

  /**
   * Toca um trecho de ruído filtrado (bateria, chiado do tiro elétrico...).
   * @param {object} o
   * @param {"highpass"|"lowpass"|"bandpass"} [o.filter]
   */
  noise({ out, time, dur, vol = 0.2, filter = "highpass", freq = 6000, q = 0.7, decay = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.#noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + (decay || dur));
    src.connect(f).connect(env).connect(out);
    src.start(time, Math.random() * 1.5);
    src.stop(time + dur + 0.02);
  }
}

const audio = new AudioEngine();

/**
 * Bipe simples nos efeitos (compra, erro, card, ouro...).
 * @param {number} freq frequência em Hz
 * @param {number} duration duração em segundos
 * @param {number} volume 0..1
 * @param {OscillatorType} type forma de onda
 */
function playTone(freq = 440, duration = 0.04, volume = 0.03, type = "sine") {
  if (!audio.ready) return;
  audio.voice({
    out: audio.sfx, time: audio.ctx.currentTime, freq, dur: duration, wave: type,
    vol: volume * 4, attack: 0.003, release: 0.03, sustain: 0.5,
  });
}

/** Efeitos sonoros com desenho próprio (mais do que um bipe). */
const Sfx = {
  /** Timbre do tiro de cada nave (índice de SHIPS): tom inicial e onda. */
  SHIP_TONES: [
    { from: 1500, to: 420, wave: "square" },
    { from: 1250, to: 340, wave: "square" },
    { from: 1700, to: 520, wave: "sawtooth" },
    { from: 1050, to: 260, wave: "sawtooth" },
  ],

  /**
   * Tiro da nave: "pew" curto com queda de tom, um estalo de ruído no começo e uma pequena
   * variação aleatória de tom (para a rajada não soar como uma metralhadora repetitiva).
   * O tiro elétrico ganha um zumbido chiado por cima.
   */
  shoot(shipIndex = 0, electric = false) {
    if (!audio.ready) return;
    const t = audio.ctx.currentTime;
    const tone = Sfx.SHIP_TONES[shipIndex] ?? Sfx.SHIP_TONES[0];
    const vary = random(0.94, 1.06);
    audio.voice({
      out: audio.sfx, time: t, freq: tone.from * vary, slideTo: tone.to * vary, dur: 0.075,
      wave: tone.wave, vol: 0.085, attack: 0.002, release: 0.035, sustain: 0.45, cutoff: 3800,
    });
    // Corpo grave curto: dá "peso" ao disparo
    audio.voice({
      out: audio.sfx, time: t, freq: 220 * vary, slideTo: 90, dur: 0.05,
      wave: "triangle", vol: 0.09, attack: 0.001, release: 0.02, sustain: 0.3,
    });
    audio.noise({ out: audio.sfx, time: t, dur: 0.03, vol: 0.05, filter: "highpass", freq: 5000 });
    if (electric) {
      audio.noise({ out: audio.sfx, time: t, dur: 0.11, vol: 0.06, filter: "bandpass", freq: 3200, q: 4, decay: 0.1 });
      audio.voice({
        out: audio.sfx, time: t, freq: 95, dur: 0.09, wave: "sawtooth",
        vol: 0.05, attack: 0.002, release: 0.03, sustain: 0.8, cutoff: 1800,
      });
    }
  },
};

// O navegador só libera áudio depois de um gesto do jogador: liga no primeiro clique/toque/tecla
for (const type of ["pointerdown", "keydown", "touchend"]) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}
// Aba escondida (trocar de app no celular, minimizar): silencia tudo
document.addEventListener("visibilitychange", () => audio.setSuspended(document.hidden));
