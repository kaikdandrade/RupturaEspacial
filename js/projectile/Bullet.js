class Bullet {
  constructor(x, y, vx = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = -770;
    this.radius = 3.5;
    this.dead = false;
    this.damage = Math.max(
      0,
      1 + SAVE.upgrades_level.damage //+ effectDamageBonus() - effectDamagePenalty(),
    );
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const { w } = viewport();
    if (this.y < -20 || this.x < -25 || this.x > w + 25) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = "#86f6ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#5eeaff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + 15);
    ctx.lineTo(this.x - this.vx * 0.008, this.y - 7);
    ctx.stroke();
    ctx.restore();
  }
}
