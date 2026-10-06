class CyberOrbProjectile {
  constructor(x, y, angle, boss = false) {
    this.x = x;
    this.y = y;
    this.radius = boss ? 10 : 9;
    this.speed = boss ? 188 : 118;
    this.angle = angle;
    this.dead = false;
    this.life = boss ? 7.2 : 6.2;
    this.damage = boss ? 11 : 8;
    this.turnRate = boss ? 1.72 : 1.35;
    this.kind = "cyber";
    this.bossShot = boss;
  }

  update(dt) {
    if (player) {
      const desired = Math.atan2(player.y - this.y, player.x - this.x);
      let diff =
        ((desired - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const maxTurn = this.turnRate * dt;
      diff = clamp(diff, -maxTurn, maxTurn);
      this.angle += diff;
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    const { w, h } = viewport();
    if (
      this.life <= 0 ||
      this.x < -90 ||
      this.x > w + 90 ||
      this.y < -90 ||
      this.y > h + 90
    )
      this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    const glowRadius = this.bossShot ? 23 : 18;
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, glowRadius);
    glow.addColorStop(0, "rgba(230,250,255,1)");
    glow.addColorStop(0.25, "rgba(82,214,255,.95)");
    glow.addColorStop(0.55, "rgba(42,115,255,.62)");
    glow.addColorStop(1, "rgba(38,102,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9eeeff";
    ctx.shadowColor = "#45c8ff";
    ctx.shadowBlur = this.bossShot ? 22 : 16;
    ctx.beginPath();
    ctx.arc(0, 0, this.bossShot ? 8 : 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
