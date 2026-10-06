class PickupCard {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = 54;
    this.height = 70;
    this.radius = 23;
    this.dead = false;
    this.life = BALANCE.cards.lifetime;
    this.age = 0;
    this.speed = 48;
    this.image = loadImage(ASSETS.special[type]);
  }

  update(dt) {
    this.age += dt;
    this.life -= dt;
    this.y += this.speed * dt;
    this.x += Math.sin(this.age * 3) * 9 * dt;
    if (this.life <= 0 || this.y > viewport().h + 80) this.dead = true;
  }

  collect() {
    if (this.dead) return;
    this.dead = true;
    burst(
      this.x,
      this.y,
      this.type === "volcanic"
        ? "#ff9968"
        : this.type === "frozen"
          ? "#8eeeff"
          : "#c58cff",
      18,
      120,
    );
    if (this.type === "frozen") resolveFrozenCard();
    if (this.type === "mystic") resolveMysticCard();
    if (this.type === "volcanic") resolveVolcanicCard();
    playTone(760, 0.09, 0.035, "triangle");
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.age * 4) * 4);
    const pulse = 0.86 + Math.sin(this.age * 5) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.shadowColor =
      this.type === "frozen"
        ? "#73ddff"
        : this.type === "volcanic"
          ? "#ff7c4f"
          : "#b873ff";
    ctx.shadowBlur = 20;
    roundedRectPath(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      10,
    );
    const gradient = ctx.createLinearGradient(
      0,
      -this.height / 2,
      0,
      this.height / 2,
    );
    gradient.addColorStop(0, "rgba(34,48,91,.98)");
    gradient.addColorStop(1, "rgba(9,14,35,.98)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle =
      this.type === "frozen"
        ? "#78e7ff"
        : this.type === "volcanic"
          ? "#ff8c5c"
          : "#bd86ff";
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawSprite(this.image, -20, -27, 40, 40);
    ctx.fillStyle = "#f7f8ff";
    ctx.textAlign = "center";
    ctx.font = "900 8px system-ui, sans-serif";
    ctx.fillText(
      this.type === "frozen"
        ? "FROZEN"
        : this.type === "volcanic"
          ? "VOLCANIC"
          : "MYSTIC",
      0,
      20,
    );
    ctx.fillStyle = "#aeb9db";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.fillText(this.type === "mystic" ? "✦" : "?", 0, 31);
    ctx.restore();
  }
}
