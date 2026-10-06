class ThornSpikeProjectile {
  constructor(x, y, angle, speed = 175) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 8;
    this.size = 23;
    this.rotation = angle + Math.PI / 2;
    this.dead = false;
    this.life = 7;
    this.damage = 5;
    this.image = loadImage(ASSETS.special.thornySpike);
    this.kind = "thorn";
  }

  update(dt) {
    const slow = asteroidSpeedFactor();
    this.x += this.vx * dt * slow;
    this.y += this.vy * dt * slow;
    this.rotation += dt * 2.5;
    this.life -= dt;
    const { w, h } = viewport();
    if (
      this.life <= 0 ||
      this.x < -55 ||
      this.x > w + 55 ||
      this.y < -55 ||
      this.y > h + 55
    )
      this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (
      !drawSprite(
        this.image,
        -this.size / 2,
        -this.size / 2,
        this.size,
        this.size,
      )
    ) {
      ctx.fillStyle = "#a5ff9e";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
