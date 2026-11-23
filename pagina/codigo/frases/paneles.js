// ---------------------------------------------------------
// Botones y paneles de la pagina de frases: brillo, editar frases,
// colores, tamano de letra y cantidad de lineas.
// ---------------------------------------------------------

// Brillo del halo, con los botones "- ☀ +" (queda guardado). 100% = BRILLO_NEON.
const BRILLO_STORAGE_KEY = "senati_particulas_brillo_v1";
const BRILLO_PASO = 0.1;   // cada toque sube o baja 10 %
const BRILLO_MAX = 1.5;    // hasta 150 %

function loadBrillo() {
  const saved = Number(localStorage.getItem(BRILLO_STORAGE_KEY));
  return localStorage.getItem(BRILLO_STORAGE_KEY) !== null && saved >= 0 && saved <= BRILLO_MAX ? saved : 1;
}

let brilloNivel = loadBrillo();
motor.brillo = BRILLO_NEON * brilloNivel;

const brilloDownBtn = document.getElementById("brilloDownBtn");
const brilloUpBtn = document.getElementById("brilloUpBtn");
const brilloLabel = document.getElementById("brilloLabel");

function setBrillo(nivel) {
  brilloNivel = Math.min(BRILLO_MAX, Math.max(0, Math.round(nivel * 10) / 10));
  motor.brillo = BRILLO_NEON * brilloNivel;
  localStorage.setItem(BRILLO_STORAGE_KEY, String(brilloNivel));
  brilloLabel.textContent = `☀ ${Math.round(brilloNivel * 100)}%`;
  brilloDownBtn.disabled = brilloNivel <= 0;
  brilloUpBtn.disabled = brilloNivel >= BRILLO_MAX;
}

brilloDownBtn.addEventListener("click", () => setBrillo(brilloNivel - BRILLO_PASO));
brilloUpBtn.addEventListener("click", () => setBrillo(brilloNivel + BRILLO_PASO));
setBrillo(brilloNivel);

// ---------------------------------------------------------
// Panel para editar las frases
// ---------------------------------------------------------

const editBtn = document.getElementById("editBtn");
const editPanel = document.getElementById("editPanel");
const editFields = document.getElementById("editFields");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

for (let i = 0; i < 10; i++) {
  const row = document.createElement("div");
  row.className = "editRow";

  const label = document.createElement("label");
  label.textContent = `${i + 1} dedo${i === 0 ? "" : "s"}`;

  const input = document.createElement("input");
  input.type = "text";
  input.id = `phraseInput${i}`;
  input.maxLength = 60;

  row.appendChild(label);
  row.appendChild(input);
  editFields.appendChild(row);
}

function openEditPanel() {
  for (let i = 0; i < 10; i++) {
    document.getElementById(`phraseInput${i}`).value = PHRASES[i];
  }
  editPanel.hidden = false;
}

function closeEditPanel() {
  editPanel.hidden = true;
}

function savePhrases() {
  for (let i = 0; i < 10; i++) {
    const value = document.getElementById(`phraseInput${i}`).value.trim().toUpperCase();
    PHRASES[i] = value || DEFAULT_PHRASES[i];
  }
  localStorage.setItem(PHRASES_STORAGE_KEY, JSON.stringify(PHRASES));
  closeEditPanel();

  // si justo se esta mostrando una frase editada, se redibuja con el texto nuevo
  redibujarFrase();
}

editBtn.addEventListener("click", openEditPanel);
saveBtn.addEventListener("click", savePhrases);
cancelBtn.addEventListener("click", closeEditPanel);
editPanel.addEventListener("click", (e) => {
  if (e.target === editPanel) closeEditPanel(); // click fuera de la caja cierra el panel
});

// ---------------------------------------------------------
// Menu hamburguesa para cambiar los 2 colores de las particulas
// ---------------------------------------------------------

const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const colorInput0 = document.getElementById("colorInput0");
const colorInput1 = document.getElementById("colorInput1");
const colorSaveBtn = document.getElementById("colorSaveBtn");
const colorCancelBtn = document.getElementById("colorCancelBtn");

function openMenuPanel() {
  colorInput0.value = COLOR_PALETTE[0];
  colorInput1.value = COLOR_PALETTE[1];
  menuPanel.hidden = false;
}

// el panel permanece abierto hasta que se confirme (Guardar) o se cancele:
// no se cierra solo ni cambia nada mientras el usuario sigue eligiendo color
function closeMenuPanel() {
  menuPanel.hidden = true;
}

function saveColors() {
  COLOR_PALETTE[0] = colorInput0.value;
  COLOR_PALETTE[1] = colorInput1.value;
  localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(COLOR_PALETTE));

  // vuelve a formar la frase actual con los colores nuevos; el color elegido
  // queda fijo (guardado en localStorage) hasta que se vuelva a cambiar aqui
  redibujarFrase();

  closeMenuPanel();
}

menuBtn.addEventListener("click", openMenuPanel);
colorSaveBtn.addEventListener("click", saveColors);
colorCancelBtn.addEventListener("click", closeMenuPanel);
menuPanel.addEventListener("click", (e) => {
  if (e.target === menuPanel) closeMenuPanel(); // click fuera de la caja cierra el panel sin guardar
});

// ---------------------------------------------------------
// Control de tamano de letra ("- 100% +")
// ---------------------------------------------------------

const fontSizeDownBtn = document.getElementById("fontSizeDownBtn");
const fontSizeUpBtn = document.getElementById("fontSizeUpBtn");
const fontSizeLabel = document.getElementById("fontSizeLabel");

function updateFontSizeUI() {
  fontSizeLabel.textContent = `${Math.round(fontScale * 100)}%`;
  fontSizeDownBtn.disabled = fontScale <= FONT_SCALE_MIN + 1e-9;
  fontSizeUpBtn.disabled = fontScale >= FONT_SCALE_MAX - 1e-9;
}

function setFontScale(newScale) {
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(newScale.toFixed(2))));
  if (clamped === fontScale) return;
  fontScale = clamped;
  localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
  updateFontSizeUI();

  redibujarFrase();
}

fontSizeDownBtn.addEventListener("click", () => setFontScale(fontScale - FONT_SCALE_STEP));
fontSizeUpBtn.addEventListener("click", () => setFontScale(fontScale + FONT_SCALE_STEP));
updateFontSizeUI();

// ---------------------------------------------------------
// Control de "en cuantas lineas" se reparte la frase (1 / 2 / 3)
// ---------------------------------------------------------

const linesButtons = document.querySelectorAll(".linesBtn");

function updateLinesButtonsUI() {
  linesButtons.forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.lines) === lineCount);
  });
}

function setLineCount(n) {
  if (n === lineCount) return;
  lineCount = n;
  localStorage.setItem(LINES_STORAGE_KEY, String(n));
  updateLinesButtonsUI();

  // redibuja el texto que se este mostrando ahora con la nueva cantidad de lineas
  redibujarFrase();
}

linesButtons.forEach((btn) => {
  btn.addEventListener("click", () => setLineCount(Number(btn.dataset.lines)));
});

updateLinesButtonsUI();

// ---------------------------------------------------------
// Boton "3D" (ver codigo/comun/bolitas3d.js): letras de bolitas infladas
// ---------------------------------------------------------

prepararBoton3D(motor, () => {
  calidad3d = 1;
  redibujarFrase();
});

// si la PC va lenta en 3D: bolitas mas grandes (menos cantidad), hasta el doble
motor.alLento = () => {
  if (calidad3d >= 2) return;
  calidad3d = Math.min(2, calidad3d * 1.25);
  redibujarFrase();
};
