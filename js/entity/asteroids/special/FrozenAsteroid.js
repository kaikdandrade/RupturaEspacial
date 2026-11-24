"use strict";

/**
 * @file Asteroide Glacial: ao ser destruído dropa o card de gelo (efeito "frozen":
 * deixa os asteroides lentos; pegando outro com ele ativo, congela tudo).
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
