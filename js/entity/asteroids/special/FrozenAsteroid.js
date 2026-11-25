"use strict";

/**
 * @file Asteroide Glacial: ao ser destruído dropa o card de gelo (efeito "frozen": deixa todos
 * os asteroides lentos). Combinações do gelo (Congelamento, Evaporação, Supercondutor): Effects.js.
 */
class FrozenAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, type: "frozen" });
  }

  resolveSprite() {
    return ASSETS.special.frozen;
  }

  onDestroyed(reason) {
    this.tryDrop(reason);
  }
}

Asteroid.register("frozen", FrozenAsteroid);
