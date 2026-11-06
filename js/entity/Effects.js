'use strict';

class Effect {
    // effectDamageBonus() - effectDamagePenalty(),


    reset() {
        return {
            slowness: 0,
            flame: 0,
            quickShot: 0,
            speedBoost: 0,
            damageBoost: 0,
            piercingShot: 0,
            freeze: 0,
            invulnerability: 0
        };
    }
}

const effects = new Effect();