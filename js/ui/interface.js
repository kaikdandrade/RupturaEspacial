"use strict";

/**
 * @file Interface em HTML: telas, modais, HUD, hangar, efeitos ativos e o glossário.
 *
 * Desempenho: o HUD e o hangar são atualizados a cada quadro, mas setText/setWidth só mexem
 * no DOM quando o valor muda (escrever no DOM a cada quadro faz o navegador recalcular o layout).
 */

// ============================================================
// AJUDANTES
// ============================================================

/** Troca o texto do elemento só se ele mudou. */
function setText(el, value) {
  const text = String(value);
  if (el.__text === text) return;
  el.__text = text;
  el.textContent = text;
}

/** Troca a largura (0..1 -> %) do elemento só se ela mudou. */
function setWidth(el, ratio) {
  const width = `${(clamp(ratio, 0, 1) * 100).toFixed(1)}%`;
  if (el.__width === width) return;
  el.__width = width;
  el.style.width = width;
}

/** Enche uma barra com animação: zera e, no próximo quadro, vai até `ratio`. */
function animateBar(el, ratio) {
  el.__width = null;
  el.style.width = "0";
  requestAnimationFrame(() => setWidth(el, ratio));
}

// ============================================================
// TELAS E MODAIS
// ============================================================

/** Mostra a tela com esse id (e esconde as outras). Sem id, esconde todas. */
function showScreen(id = null) {
  screens.forEach((screen) => screen.classList.toggle("active", !!id && screen.id === id));
}

/** Abre o modal com esse id (e fecha os outros). */
function showModal(id) {
  modals.forEach((modal) => (modal.id === id ? modal.showModal() : modal.close()));
}

/** Fecha todos os modais. */
function closeModals() {
  modals.forEach((modal) => modal.close());
}

/** Aviso grande e rápido no HUD (ex.: "BLEVE!"), na cor do efeito. */
function showEffectToast(name, text) {
  const toast = document.createElement("div");
  toast.className = "effect-toast";
  toast.dataset.effect = name;
  toast.textContent = text;
  toast.addEventListener("animationend", () => toast.remove());
  $("hud").append(toast);
}

// ============================================================
// HANGAR
// ============================================================

/** Atualiza o hangar: saldo, recordes, seletor de setor, nave e upgrades. Roda a cada quadro no menu. */
function updateMenuUI() {
  setText(bestScore, SAVE.bestScore);
  setText(highestLevel, SAVE.highestLevel);
  setText(moneyLabel, money(SAVE.coins));

  // Seletor de setor: tudo até o maior vencido está concluído
  const selected = SAVE.selectedLevel;
  const status = selected <= SAVE.highestLevel ? "completed" : selected % 5 === 0 ? "boss" : "available";
  setText(levelLabel, selected);
  levelLabelStatus.dataset.status = status; // cor definida no CSS (.level [data-status])
  setText(levelLabelStatus, { completed: ' "CONCLUÍDO"', boss: ' "BOSS"', available: ' "Disponível"' }[status]);
  prevLevelButton.disabled = selected <= 1;
  nextLevelButton.disabled = selected >= unlockedLevel();

  // Nave
  const ship = SHIPS[SAVE.selectedShip];
  const owned = SAVE.ownedShips[SAVE.selectedShip];
  if (shipPreview.getAttribute("src") !== ship.src) shipPreview.src = ship.src;
  shipPreview.alt = ship.name;
  shipButton.classList.toggle("ship-lock", !owned);
  const shipButtonHTML = owned ? "Jogar" : `<img src="assets/icons/sparks.png" alt="" /> ${money(ship.value)}`;
  if (shipButton.__html !== shipButtonHTML) {
    shipButton.__html = shipButtonHTML;
    shipButton.innerHTML = shipButtonHTML;
  }
  prevShipButton.disabled = SAVE.selectedShip <= 0;
  nextShipButton.disabled = SAVE.selectedShip >= SHIPS.length - 1;

  // Upgrades da nave selecionada (cada nave tem os seus; nave não comprada fica bloqueada)
  const levels = shipUpgrades();
  setText(workshopShip, ship.name.toUpperCase());
  workshopLock.hidden = owned;
  setText(workshopLockShip, ship.name);
  upgradeStrip.classList.toggle("is-locked", !owned);
  damageButton.disabled = !owned || SAVE.coins < getCostUpgrade("damage");
  setText(damageValue, playerBaseDamage());
  setText(damageLevel, levels.damage);
  setText(damageCost, money(getCostUpgrade("damage")));

  const maxed = fireRateMaxed();
  fireRateButton.disabled = !owned || maxed || SAVE.coins < getCostUpgrade("fireRate");
  fireRateButton.classList.toggle("max", maxed);
  fireRateCost.parentElement.hidden = maxed;
  setText(fireRateLevel, maxed ? "MAX" : levels.fireRate);
  setText(fireRateCost, money(getCostUpgrade("fireRate")));
  setText(fireRateValue, `${fireIntervalFor(levels.fireRate)} ms`);

  resistanceButton.disabled = !owned || SAVE.coins < getCostUpgrade("resistance");
  setText(resistanceValue, BALANCE.resistancePerLevel * levels.resistance);
  setText(resistanceLevel, levels.resistance);
  setText(resistanceCost, money(getCostUpgrade("resistance")));
}

/** Glossário, aba Ameaças: quantos de cada tipo já foram derrotados, por categoria e no total. */
function updateThreatArchive() {
  const kills = SAVE.kills;
  const byCategory = { common: 0, special: 0, boss: 0 };
  for (const [type, info] of Object.entries(ASTEROID_INFO)) byCategory[info.category] += kills[type] ?? 0;

  for (const el of $$("[data-kills-for]")) {
    const n = kills[el.dataset.killsFor] ?? 0;
    el.textContent = `${money(n)} ${n === 1 ? "derrotado" : "derrotados"}`;
    el.classList.toggle("is-zero", n === 0);
  }
  for (const el of $$("[data-kills-category]")) el.textContent = money(byCategory[el.dataset.killsCategory]);
  archiveTotal.textContent = money(byCategory.common + byCategory.special + byCategory.boss);
}

// ============================================================
// DURANTE A PARTIDA
// ============================================================

/** HUD: setor, objetivo, pontuação, tempo e efeitos ativos. Roda a cada quadro. */
function updateHud() {
  const progress = levelProgress();
  setText(hubObjectiveLabel, progress.label);
  setText(hubKills, progress.boss ? money(progress.done) : progress.done);
  setText(hubTarget, progress.boss ? money(progress.total) : progress.total);
  setText(hubLevel, String(level.number).padStart(2, "0"));
  setText(hubScore, Math.floor(state.playing.score));
  setText(hubTime, formatTime(state.playing.time));
  setWidth(levelProgressBar, progress.ratio);
  updateEffectsHud();
}

/** Ícones dos efeitos ativos no HUD: nome do efeito -> { badge, time } (elementos). */
const effectChips = new Map();

/** Cria/atualiza/remove os ícones dos efeitos ativos (com anel de tempo restante). */
function updateEffectsHud() {
  const active = effects.activeList();
  const activeNames = new Set(active.map((e) => e.name));

  for (const [name, chip] of effectChips) {
    if (activeNames.has(name)) continue;
    chip.badge.remove();
    effectChips.delete(name);
  }

  for (const { name, label, remaining, progress } of active) {
    let chip = effectChips.get(name);
    if (!chip) {
      const badge = document.createElement("div");
      badge.className = "effect-badge";
      badge.dataset.effect = name;
      badge.title = label;
      badge.innerHTML = `
        <span class="effect-badge__ring"><span class="effect-badge__icon"></span></span>
        <b class="effect-badge__time"></b>`;
      effectsBar.append(badge);
      chip = { badge, time: badge.querySelector(".effect-badge__time") };
      effectChips.set(name, chip);
    }
    chip.badge.style.setProperty("--progress", progress.toFixed(3));
    setText(chip.time, `${Math.ceil(remaining)}s`);
    chip.badge.classList.toggle("is-ending", remaining <= 2);
  }
}

/** Remove todos os ícones de efeito (nova partida). */
function clearEffectsHud() {
  effectsBar.replaceChildren();
  effectChips.clear();
}

/** Modal de pausa: pontuação, progresso, tempo e escudo. */
function updatePauseUI() {
  const progress = levelProgress();
  pauseScore.textContent = money(Math.floor(state.playing.score));
  pauseKillsLabel.textContent = progress.detail;
  pauseKills.textContent = progress.boss
    ? `${money(progress.done)} / ${money(progress.total)} (${Math.round(progress.ratio * 100)}%)`
    : `${progress.done} / ${progress.total}`;
  pauseTime.textContent = formatTime(state.playing.time);
  pauseResistance.textContent = `${Math.ceil(player.resistance)} / ${player.maxResistance}`;
}

/** Modal de game over: progresso alcançado, pontuação e centelhas ganhas. */
function updateGameOverUI() {
  const progress = levelProgress();
  resultLevel.textContent = String(level.number).padStart(2, "0");
  resultProgressLabel.textContent = progress.detail;
  resultKills.textContent = money(progress.done);
  resultTotal.textContent = money(progress.total);
  resultBest.textContent = money(Math.floor(state.playing.score));
  animateBar(resultProgressBar, progress.ratio);
}

/** Modal de setor concluído (o resultado já foi gravado por finishRun). */
function updateCompletedUI(result) {
  const progress = levelProgress();
  completeLevel.textContent = level.number;
  completeSector.textContent = String(level.number).padStart(2, "0");
  completeTime.textContent = formatTime(state.playing.time);
  completeProgressLabel.textContent = progress.boss ? "Boss derrotado" : "Asteroides destruídos";
  completeDestroyed.textContent = money(progress.done);
  completeTotal.textContent = money(progress.total);
  completeScore.textContent = money(Math.floor(state.playing.score));
  completeRecord.hidden = !result.newRecord;
  completeBonus.textContent = `+${money(result.coins)}`;
  animateBar(completeProgressBar, 1);
}

// ============================================================
// GLOSSÁRIO (abas: ameaças, efeitos, controles e áudio)
// ============================================================

const glossary = $("help");
const glossaryTabs = [...glossary.querySelectorAll(".glossary-tab")];
const glossaryPanels = [...glossary.querySelectorAll(".glossary-panel")];

/** Mostra a aba `name` do glossário. */
function showGlossaryTab(name) {
  for (const tab of glossaryTabs) tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  for (const panel of glossaryPanels) {
    const active = panel.dataset.panel === name;
    panel.hidden = !active;
    if (active) panel.scrollTop = 0;
  }
}

/**
 * Abre o glossário numa aba. Aberto pela pausa, ao fechar volta para a pausa
 * (ver o evento "close" abaixo); aberto pelo hangar, só fecha.
 */
function openGlossary(tab = "threats") {
  updateThreatArchive();
  showGlossaryTab(tab);
  showModal("help");
}

glossaryTabs.forEach((tab) => tab.addEventListener("click", () => showGlossaryTab(tab.dataset.tab)));
glossary.addEventListener("close", () => {
  if (state.mode === "paused") showModal("pause");
});

// ============================================================
// ÁUDIO (glossário, aba "Controles e áudio")
// ============================================================

const soundIcon = $("soundIcon");
const musicVolumeInput = $("musicVolume");
const sfxVolumeInput = $("sfxVolume");
const muteToggle = $("muteToggle");

/** Pinta a parte cheia do slider (--value) e escreve a % ao lado. */
function renderRange(input, value) {
  const percent = Math.round(value * 100);
  input.value = percent;
  input.style.setProperty("--value", `${percent}%`);
  const output = input.parentElement?.querySelector("output");
  if (output) output.textContent = `${percent}%`;
}

/** Mostra nos sliders, no interruptor e no ícone do som o que está salvo em SAVE.audio. */
function renderAudioSettings() {
  const { music: m, sfx, muted } = SAVE.audio;
  soundIcon.classList.toggle("is-muted", muted);
  muteToggle.setAttribute("aria-checked", String(!muted));
  soundIcon.setAttribute("aria-label", muted ? "Som desligado" : "Som ligado");
  renderRange(musicVolumeInput, m);
  renderRange(sfxVolumeInput, sfx);
}

/** Salva uma mudança de áudio e aplica na hora. */
function changeAudio(patch) {
  Object.assign(SAVE.audio, patch);
  DATA.save(SAVE);
  audio.applyVolumes();
  renderAudioSettings();
}

muteToggle.addEventListener("click", () => changeAudio({ muted: !SAVE.audio.muted }));
musicVolumeInput.addEventListener("input", () => changeAudio({ music: musicVolumeInput.value / 100, muted: false }));
sfxVolumeInput.addEventListener("input", () => changeAudio({ sfx: sfxVolumeInput.value / 100, muted: false }));
sfxVolumeInput.addEventListener("change", () => Sfx.shoot(SAVE.selectedShip)); // amostra ao soltar
renderAudioSettings();
