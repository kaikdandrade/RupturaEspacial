"use strict";

/**
 * @file Trilha sonora chiptune: as músicas são partituras em texto tocadas por um sequenciador
 * que agenda as notas um pouco à frente do tempo (sem travar nem atrasar com o jogo).
 *
 * Músicas:
 * - hangar: calma e espacial (menu).
 * - battle: épica; ganha camadas (bateria cheia, arpejo, segunda voz) conforme a intensidade.
 * - boss: pesada e tensa; acelera as camadas conforme o boss perde vida.
 * Vinhetas: setor concluído, novo recorde e derrota.
 *
 * Notação das partituras: cada compasso tem 16 passos (semicolcheias) separados por espaço.
 *   "A4" = nota | "-" = segura a nota anterior | "." = silêncio
 *   Bateria: k = bumbo, s = caixa, h = chimbal, o = chimbal aberto, . = nada
 */

// ============================================================
// AJUDANTES DE PARTITURA
// ============================================================

const NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

/** "A4" → 440 Hz. Aceita sustenido (#) e bemol (b). */
function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const semi = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Arpejo de 16 passos: `order` são índices nas notas do acorde (null = pausa). */
function arp(chord, order) {
  return order.map((i) => (i === null ? "." : chord[i])).join(" ");
}

/** Baixo pulsante em colcheias: fundamental grave e oitava alternando. */
function octavePulse(root, octave = 2) {
  const low = `${root}${octave}`;
  const high = `${root}${octave + 1}`;
  return `${low} . ${high} . `.repeat(4).trim();
}

/** Baixo "chugado" de metal (boss): semicolcheias com respiros. */
function chug(root, octave = 2) {
  const n = `${root}${octave}`;
  return `${n} ${n} . ${n} ${n} . ${n} . ${n} ${n} . ${n} ${n} . ${n} .`;
}

/** Nota que dura o compasso inteiro. */
function whole(note) {
  return `${note} ${"- ".repeat(15).trim()}`;
}

/** Transpõe uma partitura inteira por oitavas (ex.: -1 = uma oitava abaixo). */
function octaveShift(bar, shift) {
  return bar.replace(/([A-G][#b]?)(-?\d)/g, (_, n, o) => `${n}${Number(o) + shift}`);
}

// ============================================================
// INSTRUMENTOS (parâmetros de audio.voice)
// ============================================================

const INSTRUMENTS = {
  softLead: { wave: "square", vol: 0.075, attack: 0.02, release: 0.25, sustain: 0.6, cutoff: 1900, vibrato: 5, echo: 0.55 },
  heroLead: { wave: "square", vol: 0.085, attack: 0.008, release: 0.12, sustain: 0.65, cutoff: 3400, vibrato: 6, echo: 0.3, detune: 7 },
  darkLead: { wave: "sawtooth", vol: 0.07, attack: 0.01, release: 0.12, sustain: 0.7, cutoff: 2500, vibrato: 8, echo: 0.25, detune: 12 },
  lowLead: { wave: "triangle", vol: 0.12, attack: 0.01, release: 0.1, sustain: 0.7, echo: 0.15 },
  glassArp: { wave: "triangle", vol: 0.07, attack: 0.004, release: 0.2, sustain: 0.25, echo: 0.5 },
  pulseArp: { wave: "square", vol: 0.04, attack: 0.002, release: 0.05, sustain: 0.2, cutoff: 3000, echo: 0.2 },
  padBass: { wave: "triangle", vol: 0.16, attack: 0.08, release: 0.4, sustain: 0.8 },
  punchBass: { wave: "square", vol: 0.1, attack: 0.003, release: 0.05, sustain: 0.55, cutoff: 900 },
  sawBass: { wave: "sawtooth", vol: 0.1, attack: 0.002, release: 0.04, sustain: 0.6, cutoff: 650, detune: -10 },
};

// ============================================================
// MÚSICAS
// ============================================================

/**
 * Cada faixa: bpm, número de compassos do loop e as vozes. Uma voz com `min` só toca quando a
 * intensidade (0..1) passa desse valor; `max` = só abaixo dele (bateria leve x cheia).
 * Partituras mais curtas que o loop se repetem.
 */
const TRACKS = {
  hangar: {
    bpm: 84,
    bars: 8,
    voices: [
      {
        inst: "glassArp",
        bars: [
          arp(["A3", "C4", "E4", "A4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["F3", "A3", "C4", "F4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["C4", "E4", "G4", "C5"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["G3", "B3", "D4", "G4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["A3", "C4", "E4", "A4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["F3", "A3", "C4", "F4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["C4", "E4", "G4", "C5"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
          arp(["E3", "G#3", "B3", "E4"], [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null]),
        ],
      },
      { inst: "padBass", bars: ["A2", "F2", "C3", "G2", "A2", "F2", "C3", "E2"].map(whole) },
      {
        inst: "softLead",
        bars: [
          "E5 - - - - - - - D5 - C5 - - - - -",
          "A4 - - - - - - - C5 - - - - - - -",
          "G4 - - - E4 - - - G4 - C5 - - - - -",
          "B4 - - - - - - - - - - - . . . .",
          "E5 - - - - - - - G5 - E5 - - - D5 -",
          "C5 - - - - - - - A4 - - - C5 - - -",
          "G4 - - - - - - - E5 - D5 - C5 - - -",
          "B4 - - - - - - - G#4 - - - - - - -",
        ],
      },
    ],
    drums: [{ vol: 0.5, bars: [". . . . . . h . . . . . . . h ."] }],
  },

  battle: {
    bpm: 138,
    bars: 8,
    voices: [
      { inst: "punchBass", bars: ["D", "A#", "C", "A", "D", "A#", "C", "A"].map((r) => octavePulse(r)) },
      {
        inst: "heroLead",
        min: 0.25,
        bars: [
          "D5 - - - A4 - - - D5 - E5 - F5 - - -",
          "F5 - - - E5 - D5 - C5 - - - D5 - - -",
          "E5 - - - C5 - - - G4 - - - C5 - E5 -",
          "A5 - - - - - - - G5 - F5 - E5 - - -",
          "D5 - - - A4 - - - D5 - E5 - F5 - G5 -",
          "A5 - - - - - G5 - F5 - - - D5 - - -",
          "G5 - - - F5 - E5 - C5 - - - E5 - G5 -",
          "C#5 - - - E5 - - - A5 - - - - - - -",
        ],
      },
      {
        inst: "pulseArp",
        min: 0.55,
        bars: [
          arp(["D4", "F4", "A4", "D5"], [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1]),
          arp(["A#3", "D4", "F4", "A#4"], [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1]),
          arp(["C4", "E4", "G4", "C5"], [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1]),
          arp(["A3", "C#4", "E4", "A4"], [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1]),
        ],
      },
      // Segunda voz (oitava abaixo) só no auge
      {
        inst: "lowLead",
        min: 0.8,
        bars: [
          "D5 - - - A4 - - - D5 - E5 - F5 - - -",
          "F5 - - - E5 - D5 - C5 - - - D5 - - -",
          "E5 - - - C5 - - - G4 - - - C5 - E5 -",
          "A5 - - - - - - - G5 - F5 - E5 - - -",
        ].map((bar) => octaveShift(bar, -1)),
      },
    ],
    drums: [
      { max: 0.45, vol: 0.8, bars: ["k . h . . . h . k . h . . . h ."] },
      { min: 0.45, vol: 1, bars: ["k . h . s . h . k k h . s . h h", "k . h . s . h . k . h k s . o ."] },
    ],
  },

  boss: {
    bpm: 152,
    bars: 8,
    voices: [
      { inst: "sawBass", bars: ["E", "F", "E", "D", "E", "F", "G", "F"].map((r) => chug(r)) },
      {
        inst: "darkLead",
        bars: [
          "E5 - - - - - F5 - E5 - - - B4 - - -",
          "C5 - - - - - B4 - A4 - - - F4 - - -",
          "G4 - - - B4 - - - E5 - - - G5 - - -",
          "F#5 - - - - - E5 - D5 - - - A4 - - -",
          "B5 - - - - - C6 - B5 - - - G5 - - -",
          "A5 - - - - - G5 - F5 - - - C5 - - -",
          "D5 - - - G5 - - - B5 - - - D6 - - -",
          "C6 - - - - - - - B5 - - - - - - -",
        ],
      },
      {
        inst: "pulseArp",
        min: 0.75,
        bars: [
          arp(["E3", "B3", "E4"], [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1]),
          arp(["F3", "C4", "F4"], [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1]),
        ],
      },
    ],
    drums: [
      { vol: 1, bars: ["k . h k s . h . k k h . s . h k", "k . h k s . h . k k h . s s o ."] },
      { min: 0.7, vol: 0.5, bars: [". h . h . h . h . h . h . h . h"] },
    ],
  },
};

/** Vinhetas curtas: [nota, início em passos, duração em passos], tocadas uma vez. */
const JINGLES = {
  win: {
    bpm: 170, inst: "heroLead",
    notes: [["C5", 0, 1], ["E5", 1, 1], ["G5", 2, 1], ["C6", 3, 6], ["G5", 3, 6], ["E5", 3, 6]],
    bass: [["C3", 3, 6]],
  },
  record: {
    bpm: 190, inst: "heroLead",
    notes: [["E5", 0, 1], ["G5", 1, 1], ["B5", 2, 1], ["E6", 3, 1], ["G6", 4, 1], ["B6", 5, 8], ["E6", 5, 8], ["G#5", 5, 8]],
    bass: [["E3", 5, 8]],
  },
  lose: {
    bpm: 110, inst: "darkLead",
    notes: [["G4", 0, 2], ["D#4", 2, 2], ["C4", 4, 8]],
    bass: [["C2", 4, 8]],
  },
};

// ============================================================
// SEQUENCIADOR
// ============================================================

class MusicPlayer {
  /** Quanto tempo à frente as notas são agendadas (s) e de quanto em quanto se olha (ms). */
  static LOOKAHEAD = 0.15;
  static TICK_MS = 25;

  /** Intensidade atual (0..1): liga/desliga as camadas das vozes com min/max. */
  intensity = 0.3;

  #track = null;   // nome da faixa tocando
  #gain = null;    // volume desta faixa (para o fade na troca)
  #step = 0;
  #nextTime = 0;
  #timer = null;
  #ducked = false;
  #wanted = null;  // faixa pedida antes de o áudio ser liberado

  constructor() {
    audio.onReady(() => {
      if (this.#wanted) this.play(this.#wanted);
    });
  }

  /** Troca para a faixa `name` (com fade); a mesma faixa não recomeça. */
  play(name) {
    this.#wanted = name;
    if (!audio.ready || name === this.#track) return;
    this.#fadeOut();
    const ctx = audio.ctx;
    this.#track = name;
    this.#gain = ctx.createGain();
    this.#gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.#gain.gain.exponentialRampToValueAtTime(this.#ducked ? 0.3 : 1, ctx.currentTime + 0.8);
    this.#gain.connect(audio.music);
    this.#step = 0;
    this.#nextTime = ctx.currentTime + 0.08;
    this.#timer ??= setInterval(() => this.#schedule(), MusicPlayer.TICK_MS);
  }

  /** Para a música (fade curto). */
  stop() {
    this.#wanted = null;
    this.#fadeOut();
    this.#track = null;
  }

  /** Abaixa a música (pausa) ou volta ao volume normal. */
  duck(on) {
    if (on === this.#ducked) return;
    this.#ducked = on;
    if (this.#gain && audio.ctx) this.#gain.gain.setTargetAtTime(on ? 0.3 : 1, audio.ctx.currentTime, 0.15);
  }

  /** Toca uma vinheta (win, record, lose) por cima de tudo. */
  jingle(name) {
    const j = JINGLES[name];
    if (!j || !audio.ready) return;
    const t0 = audio.ctx.currentTime + 0.05;
    const step = 60 / j.bpm / 4;
    const lead = INSTRUMENTS[j.inst];
    for (const [note, at, len] of j.notes) {
      audio.voice({ ...lead, vol: lead.vol * 1.4, out: audio.music, time: t0 + at * step, freq: noteFreq(note), dur: len * step });
    }
    for (const [note, at, len] of j.bass ?? []) {
      audio.voice({ ...INSTRUMENTS.padBass, attack: 0.01, out: audio.music, time: t0 + at * step, freq: noteFreq(note), dur: len * step });
    }
  }

  #fadeOut() {
    if (!this.#gain || !audio.ctx) return;
    const old = this.#gain;
    const now = audio.ctx.currentTime;
    old.gain.cancelScheduledValues(now);
    old.gain.setTargetAtTime(0.0001, now, 0.25);
    setTimeout(() => old.disconnect(), 2000);
    this.#gain = null;
  }

  /** Agenda tudo que cai dentro da janela de antecedência. */
  #schedule() {
    const track = TRACKS[this.#track];
    if (!track || !this.#gain || !audio.ready) return;
    const stepTime = 60 / track.bpm / 4;
    const horizon = audio.ctx.currentTime + MusicPlayer.LOOKAHEAD;
    // Se o jogo ficou parado (aba escondida), não tenta tocar o atraso inteiro de uma vez
    if (this.#nextTime < audio.ctx.currentTime - 0.5) this.#nextTime = audio.ctx.currentTime + 0.05;
    while (this.#nextTime < horizon) {
      this.#playStep(track, this.#step, this.#nextTime, stepTime);
      this.#nextTime += stepTime;
      this.#step = (this.#step + 1) % (track.bars * 16);
    }
  }

  /** Toca o passo `step` de todas as vozes e da bateria ativas. */
  #playStep(track, step, time, stepTime) {
    const bar = Math.floor(step / 16);
    const pos = step % 16;
    const on = (layer) => (layer.min === undefined || this.intensity >= layer.min)
      && (layer.max === undefined || this.intensity < layer.max);

    for (const voice of track.voices) {
      if (!on(voice)) continue;
      const tokens = MusicPlayer.#tokens(voice.bars[bar % voice.bars.length]);
      const token = tokens[pos];
      if (!token || token === "." || token === "-") continue;
      // Duração = a própria nota + os "-" que vêm depois dela
      let length = 1;
      while (tokens[pos + length] === "-") length++;
      audio.voice({
        ...INSTRUMENTS[voice.inst], out: this.#gain, time,
        freq: noteFreq(token), dur: length * stepTime * 0.92,
      });
    }

    for (const kit of track.drums) {
      if (!on(kit)) continue;
      const hit = MusicPlayer.#tokens(kit.bars[bar % kit.bars.length])[pos];
      if (hit && hit !== ".") this.#drum(hit, time, kit.vol ?? 1);
    }
  }

  #drum(hit, time, vol) {
    const out = this.#gain;
    if (hit === "k") {
      audio.voice({ out, time, freq: 150, slideTo: 42, dur: 0.12, wave: "sine", vol: 0.5 * vol, attack: 0.001, release: 0.05, sustain: 0.6 });
    } else if (hit === "s") {
      audio.noise({ out, time, dur: 0.14, vol: 0.18 * vol, filter: "highpass", freq: 1400, decay: 0.13 });
      audio.voice({ out, time, freq: 200, slideTo: 140, dur: 0.06, wave: "triangle", vol: 0.16 * vol, attack: 0.001, release: 0.03, sustain: 0.3 });
    } else if (hit === "h") {
      audio.noise({ out, time, dur: 0.035, vol: 0.06 * vol, filter: "highpass", freq: 7500 });
    } else if (hit === "o") {
      audio.noise({ out, time, dur: 0.18, vol: 0.06 * vol, filter: "highpass", freq: 6500, decay: 0.17 });
    }
  }

  /** Cache das partituras já quebradas em passos. */
  static #cache = new Map();
  static #tokens(bar) {
    let tokens = MusicPlayer.#cache.get(bar);
    if (!tokens) {
      tokens = bar.trim().split(/\s+/);
      MusicPlayer.#cache.set(bar, tokens);
    }
    return tokens;
  }
}

const music = new MusicPlayer();

/** De quanto em quanto tempo (s) a intensidade da música é recalculada. */
const MUSIC_INTENSITY_INTERVAL = 0.5;
let musicIntensityTimer = 0;

/**
 * Escolhe a música pelo modo do jogo (chamado a cada quadro em game_loop.js):
 * hangar no menu, batalha/boss na partida (abafada na pausa), silêncio nos modais de fim
 * (as vinhetas tocam no lugar, ver winLevel e a morte da nave em main.js).
 */
function syncMusic(dt) {
  const mode = state.mode;
  if (mode === "menu") {
    music.duck(false);
    music.play("hangar");
    return;
  }
  if (mode === "complete" || mode === "gameover") {
    music.stop();
    return;
  }
  const boss = !!state.levelConfig?.isLevelBoss;
  music.play(boss ? "boss" : "battle");
  music.duck(mode === "paused");

  musicIntensityTimer -= dt;
  if (musicIntensityTimer > 0) return;
  musicIntensityTimer = MUSIC_INTENSITY_INTERVAL;
  const progress = levelProgress().ratio;
  // Batalha: sobe com o avanço do setor e com o número do setor; boss: sobe conforme ele perde vida
  music.intensity = boss
    ? 0.55 + 0.45 * progress
    : clamp(0.2 + 0.45 * progress + 0.35 * Math.min(1, (state.levelConfig?.number ?? 1) / 30), 0, 1);
}
