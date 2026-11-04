"use strict";

// Hitbox circular que acompanha automaticamente o objeto ao qual pertence.
// Uma hitbox emite os sinais "enter", "stay" e "exit".
class Hitbox {
  static #nextId = 0;
  #listeners = new Map([
    ["enter", new Set()],
    ["stay", new Set()],
    ["exit", new Set()],
  ]);

  constructor(owner, radius) {
    this.id = ++Hitbox.#nextId;
    this.owner = owner;
    this.radius = radius;
  }

  get x() { return this.owner.x; }
  get y() { return this.owner.y; }

  on(event, callback) {
    const listeners = this.#listeners.get(event);
    if (!listeners) throw new Error(`Evento desconhecido: ${event}`);
    if (typeof callback !== "function") throw new TypeError("Callback deve ser uma função");

    listeners.add(callback);
    // A função retornada permite cancelar a assinatura do sinal.
    return () => listeners.delete(callback);
  }

  emit(event, payload) {
    for (const callback of this.#listeners.get(event) ?? []) {
      callback({ self: this.owner, ...payload });
    }
  }
}

// Detecta os contatos entre grupos e dispara eventos nas hitboxes.
// Requer circlesTouch(a, b) de js/core/utils.js, que já existe no projeto.
class Collisions {
  #groups = new Map();
  #connections = [];
  #touching = new Map();

  group(name, getObjects) {
    if (typeof getObjects !== "function") {
      throw new TypeError("O grupo precisa de uma função que retorne os objetos atuais");
    }
    this.#groups.set(name, getObjects);
    return this;
  }

  connect(groupA, groupB) {
    if (!this.#groups.has(groupA) || !this.#groups.has(groupB)) {
      throw new Error(`Grupo inexistente na conexão: ${groupA} / ${groupB}`);
    }
    this.#connections.push([groupA, groupB]);
    return this;
  }

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
          const event = this.#touching.has(key) ? "stay" : "enter";

          a.emit(event, { other: b.owner, group: groupB });
          b.emit(event, { other: a.owner, group: groupA });
        }
      }
    }

    for (const [key, pair] of this.#touching) {
      if (nowTouching.has(key)) continue;
      const { a, b, groupA, groupB } = pair;
      // Objetos destruídos não recebem sinais adicionais.
      if (!a.owner.dead) a.emit("exit", { other: b.owner, group: groupB });
      if (!b.owner.dead) b.emit("exit", { other: a.owner, group: groupA });
    }

    this.#touching = nowTouching;
  }

  reset() {
    this.#touching.clear();
  }
}
