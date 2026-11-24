"use strict";

/**
 * @file Colisões entre círculos.
 * - Hitbox: círculo que acompanha um objeto (owner) e emite "enter", "stay" e "exit".
 * - Collisions: liga grupos de objetos (ex.: tiros x asteroides) e dispara os sinais
 *   das hitboxes quando elas se tocam.
 */

/** Hitbox circular que acompanha automaticamente o objeto ao qual pertence. */
class Hitbox extends Signals {
  static #nextId = 0;

  /**
   * @param {{ x: number, y: number }} owner objeto que a hitbox acompanha
   * @param {number} radius raio em pixels
   */
  constructor(owner, radius) {
    super();
    this.id = ++Hitbox.#nextId;
    this.owner = owner;
    this.radius = radius;
  }

  get x() { return this.owner.x; }

  get y() { return this.owner.y; }

  /** Os sinais da hitbox sempre levam junto o dono (self). */
  emit(signal, payload = {}) {
    super.emit(signal, { self: this.owner, ...payload });
  }
}

/**
 * Detecta contatos entre grupos e dispara os sinais nas hitboxes:
 * "enter" no primeiro quadro de contato, "stay" enquanto continuam encostadas e "exit" ao separar.
 * Os sinais recebem { self, other, group } (group = nome do grupo do outro objeto).
 */
class Collisions {
  #groups = new Map();
  #connections = [];
  #touching = new Map();

  /**
   * Registra um grupo.
   * @param {string} name nome do grupo
   * @param {() => Array<{ dead?: boolean, hitbox?: Hitbox }>} getObjects devolve os objetos atuais
   */
  group(name, getObjects) {
    if (typeof getObjects !== "function") throw new TypeError("O grupo precisa de uma função");
    this.#groups.set(name, getObjects);
    return this;
  }

  /** Verifica colisões entre os dois grupos a cada update(). */
  connect(groupA, groupB) {
    if (!this.#groups.has(groupA) || !this.#groups.has(groupB)) {
      throw new Error(`Grupo inexistente na conexão: ${groupA} / ${groupB}`);
    }
    this.#connections.push([groupA, groupB]);
    return this;
  }

  /** Testa todos os pares conectados e dispara os sinais. Chamado uma vez por quadro. */
  update() {
    const nowTouching = new Map();

    for (const [groupA, groupB] of this.#connections) {
      const objectsA = this.#groups.get(groupA)() ?? [];
      const objectsB = this.#groups.get(groupB)() ?? [];

      for (const objectA of objectsA) {
        if (objectA?.dead || !objectA?.hitbox) continue;
        for (const objectB of objectsB) {
          if (objectB === objectA || objectA.dead || objectB?.dead || !objectB?.hitbox) continue;
          const a = objectA.hitbox;
          const b = objectB.hitbox;
          if (!circlesTouch(a, b)) continue;

          const key = `${a.id}:${b.id}`;
          if (nowTouching.has(key)) continue;
          nowTouching.set(key, { a, b, groupA, groupB });

          const signal = this.#touching.has(key) ? "stay" : "enter";
          a.emit(signal, { other: b.owner, group: groupB });
          b.emit(signal, { other: a.owner, group: groupA });
        }
      }
    }

    // Quem estava encostado e soltou recebe "exit" (objetos destruídos não recebem mais nada)
    for (const [key, { a, b, groupA, groupB }] of this.#touching) {
      if (nowTouching.has(key)) continue;
      if (!a.owner.dead) a.emit("exit", { other: b.owner, group: groupB });
      if (!b.owner.dead) b.emit("exit", { other: a.owner, group: groupA });
    }
    this.#touching = nowTouching;
  }
}
