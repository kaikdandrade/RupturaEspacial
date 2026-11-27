"use strict";

/**
 * @file Save do jogo no localStorage. Esta classe SÓ lê e grava os dados;
 * o que fazer com eles (somar centelhas, liberar setores...) fica em game/progress.js.
 */
class Data {
  /** Chave do save no localStorage. */
  static STORAGE_KEY = "RUPTURA_ESPACIAL_SAVE";

  /** Save de um jogador novo. */
  static DEFAULT_SAVE = {
    coins: 0,                                      // centelhas
    selectedShip: 0,                               // índice em SHIPS
    ownedShips: [true, false, false, false],       // naves compradas
    bestScore: 0,                                  // recorde de pontuação
    highestLevel: 0,                               // maior setor VENCIDO (0 = nenhum)
    selectedLevel: 1,                              // setor escolhido no hangar
    // Melhorias de CADA nave (índice = SHIPS): nave nova começa do zero
    shipUpgrades: [0, 1, 2, 3].map(() => ({ damage: 0, fireRate: 0, resistance: 0 })),
    kills: {},                                     // total derrotado por tipo: { common: 12, frozen: 3, ... }
    autoFire: false,                               // tiro automático (controles de toque)
    // Controles de toque: tamanho (0,6 a 1,5), lado do joystick e modo (flutuante ou fixo)
    touch: { scale: 1, side: "left", mode: "floating" },
    audio: { music: 0.7, sfx: 0.8, muted: false }, // volumes (0..1) e mudo
  };

  /**
   * Lê o save do localStorage. Sem save (ou com save ilegível), começa do zero.
   * Campos que faltarem no save gravado recebem o valor padrão.
   * @returns {typeof Data.DEFAULT_SAVE}
   */
  load() {
    // Cópia profunda dos padrões (JSON em vez de structuredClone, que só existe no Chrome 98+)
    const fresh = JSON.parse(JSON.stringify(Data.DEFAULT_SAVE));
    try {
      const raw = localStorage.getItem(Data.STORAGE_KEY);
      return raw ? { ...fresh, ...JSON.parse(raw) } : fresh;
    } catch {
      return fresh;
    }
  }

  /** Grava o save no localStorage. */
  save(save) {
    localStorage.setItem(Data.STORAGE_KEY, JSON.stringify(save));
  }
}

const DATA = new Data();
/** Save do jogador, carregado ao abrir o jogo. Altere e chame DATA.save(SAVE) para gravar. */
const SAVE = DATA.load();
