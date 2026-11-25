"use strict";

/**
 * @file Controles de toque (celular e tablet).
 *
 * - Movimento: joystick flutuante. Encostar o dedo em qualquer ponto da metade esquerda da arena
 *   cria o joystick ali mesmo; arrastar move a nave (quanto mais longe do centro, mais rápido).
 * - Tiro: botão redondo no canto inferior direito (segurar = atirar).
 * - AUTO: liga/desliga o tiro automático (fica salvo no save).
 *
 * Os controles só aparecem durante a partida em aparelhos com toque. A nave lê o estado por
 * touchControls.move ({ x, y } de -1 a 1) e touchControls.firing (Player.update).
 */
class TouchControls {
  /** Distância (px) do centro do joystick até a borda: arrastar além disso = velocidade máxima. */
  static STICK_RADIUS = 56;
  /** Abaixo dessa fração do raio o joystick é ignorado (evita a nave "escorregar" sozinha). */
  static DEAD_ZONE = 0.12;
  /** Fração da largura da tela, a partir da esquerda, que aceita o joystick. */
  static STICK_ZONE = 0.55;

  /** Direção do joystick: x e y de -1 a 1 (comprimento até 1). */
  move = { x: 0, y: 0 };

  #root = $("touchControls");
  #stick = $("touchStick");
  #knob = $("touchKnob");
  #fireButton = $("touchFire");
  #autoButton = $("touchAuto");

  #stickPointer = null;  // id do dedo que está no joystick
  #origin = { x: 0, y: 0 };
  #firePressed = false;
  #visible = false;
  /** true depois do primeiro toque na tela (ou se o aparelho for de toque desde o início). */
  #enabled = matchMedia("(pointer: coarse)").matches;

  constructor() {
    // Um toque em qualquer lugar liga os controles (notebook com tela de toque, por exemplo)
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" && !this.#enabled) {
        this.#enabled = true;
        this.sync();
      }
    }, { capture: true });

    this.#root.addEventListener("pointerdown", (e) => this.#onStickDown(e));
    this.#root.addEventListener("pointermove", (e) => this.#onStickMove(e));
    this.#root.addEventListener("pointerup", (e) => this.#onStickUp(e));
    this.#root.addEventListener("pointercancel", (e) => this.#onStickUp(e));

    const press = (pressed) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#firePressed = pressed;
      this.#fireButton.classList.toggle("is-pressed", pressed);
    };
    this.#fireButton.addEventListener("pointerdown", (e) => {
      this.#fireButton.setPointerCapture(e.pointerId);
      press(true)(e);
    });
    this.#fireButton.addEventListener("pointerup", press(false));
    this.#fireButton.addEventListener("pointercancel", press(false));

    this.#autoButton.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.#autoButton.addEventListener("click", () => {
      SAVE.autoFire = !SAVE.autoFire;
      DATA.save(SAVE);
      this.#renderAuto();
    });

    // Segurar o dedo não abre menu de contexto / seleção de texto
    this.#root.addEventListener("contextmenu", (e) => e.preventDefault());
    this.#renderAuto();
  }

  /** A nave deve atirar? (botão pressionado ou tiro automático ligado) */
  get firing() {
    return this.#visible && (this.#firePressed || SAVE.autoFire);
  }

  /** Mostra os controles só durante a partida, em aparelhos de toque. Chamado a cada quadro. */
  sync() {
    const visible = this.#enabled && (state.mode === "playing" || state.mode === "launching");
    if (visible === this.#visible) return;
    this.#visible = visible;
    this.#root.hidden = !visible;
    if (!visible) this.reset();
  }

  /** Solta tudo (fim de partida, pause, janela perdeu o foco). */
  reset() {
    this.#stickPointer = null;
    this.#firePressed = false;
    this.#fireButton.classList.remove("is-pressed");
    this.#setVector(0, 0);
    this.#stick.classList.remove("is-active");
    this.#stick.style.removeProperty("left");
    this.#stick.style.removeProperty("top");
  }

  #onStickDown(e) {
    if (this.#stickPointer !== null) return;
    const rect = this.#root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x > rect.width * TouchControls.STICK_ZONE) return; // lado direito: não é joystick
    e.preventDefault();
    this.#root.setPointerCapture(e.pointerId);
    this.#stickPointer = e.pointerId;
    this.#origin = { x, y };
    this.#stick.style.left = `${x}px`;
    this.#stick.style.top = `${y}px`;
    this.#stick.classList.add("is-active");
  }

  #onStickMove(e) {
    if (e.pointerId !== this.#stickPointer) return;
    const rect = this.#root.getBoundingClientRect();
    const R = TouchControls.STICK_RADIUS;
    let dx = (e.clientX - rect.left - this.#origin.x) / R;
    let dy = (e.clientY - rect.top - this.#origin.y) / R;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    this.#setVector(dx, dy);
  }

  #onStickUp(e) {
    if (e.pointerId !== this.#stickPointer) return;
    this.#stickPointer = null;
    this.#setVector(0, 0);
    this.#stick.classList.remove("is-active");
    this.#stick.style.removeProperty("left");
    this.#stick.style.removeProperty("top");
  }

  /** Atualiza a direção (com zona morta) e a bolinha do joystick. */
  #setVector(x, y) {
    this.#knob.style.translate = `${x * TouchControls.STICK_RADIUS}px ${y * TouchControls.STICK_RADIUS}px`;
    const dead = Math.hypot(x, y) < TouchControls.DEAD_ZONE;
    this.move.x = dead ? 0 : x;
    this.move.y = dead ? 0 : y;
  }

  #renderAuto() {
    this.#autoButton.classList.toggle("is-on", !!SAVE.autoFire);
    this.#autoButton.setAttribute("aria-pressed", String(!!SAVE.autoFire));
  }
}

const touchControls = new TouchControls();
