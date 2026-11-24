"use strict";

/**
 * @file Asteroide comum: a ameaça mais frequente. Sem efeitos; cada um destruído
 * conta para o objetivo do setor. Usa uma das 9 artes sorteada.
 */
class CommonAsteroid extends Asteroid {
  constructor(config) {
    super({ ...config, type: "common" });
  }

  resolveSprite() {
    return ASSETS.common[randomInt(0, ASSETS.common.length - 1)];
  }
}

Asteroid.register("common", CommonAsteroid);
