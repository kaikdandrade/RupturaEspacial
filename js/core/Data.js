"use strict";

class Data {
  #STORAGE_KEY = "RUPTURA_ESPACIAL_SAVE";
  #defaultSave = {
    coins: 0,
    selectedShip: 0,
    ownedShips: [true, false, false, false],
    bestScore: 0,
    highestLevel: 1,
    selectedLevel: 1,
    upgrades_level: { damage: 0, fireRate: 0, resistance: 0 },
  };

  loadSave() {
    if (localStorage.getItem(this.#STORAGE_KEY) && localStorage.getItem(this.#STORAGE_KEY) !== "undefined")
      return JSON.parse(localStorage.getItem(this.#STORAGE_KEY));
    else return this.#defaultSave;
  }

  storeSave(save) {
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(save));
  }
}

const DATA = new Data();
const SAVE = DATA.loadSave();
console.log("SAVE:", SAVE);