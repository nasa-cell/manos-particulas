// ---------------------------------------------------------
// Texto -> puntos: tipo de letra, tamano, reparto en lineas y
// los puntos de contorno y relleno de cada letra.
// ---------------------------------------------------------

// Bahnschrift seminegrita (viene con Windows): letras limpias y rectas que
// se leen nitidas con puntos. Si no esta, usa Segoe UI.
const TEXT_FONT_STACK = "Bahnschrift, 'Segoe UI', Arial, sans-serif";
const TEXT_FONT_WEIGHT = "600";
const LETTER_SPACING_PX = 6;

// Escala manual del tamano de letra, elegida con los botones "- 100% +" del
// HUD. Multiplica el tamano de fuente de partida; si aun asi no entra en el
// ancho o alto disponible, el ajuste automatico de getTextPoints la sigue
// achicando igual (nunca se desborda de pantalla).
const FONT_SCALE_STORAGE_KEY = "senati_particulas_escala_v1";
const DEFAULT_FONT_SCALE = 1;
const FONT_SCALE_MIN = 0.6;
const FONT_SCALE_MAX = 1.6;
const FONT_SCALE_STEP = 0.1;

function loadFontScale() {
  const saved = Number(localStorage.getItem(FONT_SCALE_STORAGE_KEY));
  if (saved >= FONT_SCALE_MIN && saved <= FONT_SCALE_MAX) return saved;
  return DEFAULT_FONT_SCALE;
}

let fontScale = loadFontScale();

// Cantidad de lineas en la que se reparte cada frase, elegida a mano con
// los 3 botones "1 / 2 / 3" del HUD (ver mas abajo). A mas lineas, la letra
// puede ser mas grande porque cada linea tiene menos texto que cubrir a lo
// ancho.
const LINES_STORAGE_KEY = "senati_particulas_lineas_v1";
const DEFAULT_LINE_COUNT = 2;

function loadLineCount() {
  const saved = Number(localStorage.getItem(LINES_STORAGE_KEY));
  if (saved === 1 || saved === 2 || saved === 3) return saved;
  return DEFAULT_LINE_COUNT;
}

let lineCount = loadLineCount();

// Reparte el texto en como mucho `lineCount` lineas (menos si hay pocas
// palabras), llenando cada linea hasta acercarse al largo objetivo
// (total de caracteres / cantidad de lineas) antes de pasar a la siguiente,
// para que las lineas queden lo mas parejas posible.
function wrapTextLines(text) {
  const words = text.split(" ");
  const n = Math.min(lineCount, words.length);
  if (n <= 1) return [text];

  const targetLen = text.length / n;
  const remaining = words.slice();
  const lines = [];

  for (let li = 0; li < n; li++) {
    if (li === n - 1) {
      lines.push(remaining.join(" "));
      break;
    }
    const current = [];
    let currentLen = 0;
    while (remaining.length > 0) {
      const linesLeftAfter = n - li - 1;
      // palabras que quedarian para las lineas siguientes si se corta aqui
      const wordsLeftAfter = remaining.length;
      const wLen = remaining[0].length + (current.length > 0 ? 1 : 0);
      // no seguir agregando si ya hay algo en la linea, se pasaria del
      // largo objetivo, y todavia quedan suficientes palabras para llenar
      // las lineas restantes
      if (current.length > 0 && currentLen + wLen > targetLen && wordsLeftAfter >= linesLeftAfter) {
        break;
      }
      current.push(remaining.shift());
      currentLen += wLen;
    }
    lines.push(current.join(" "));
  }
  return lines;
}

// Las letras se dibujan en una imagen a la mitad del tamano de la pantalla:
// recorrerla cuesta 4 veces menos y evita el tiron al cambiar de frase. Cada
// punto encontrado se vuelve a llevar al tamano real con un pequeno azar
// para que no se note la grilla.
const TEXT_SAMPLE_SCALE = 0.5;

function getTextPoints(text, width, height) {
  const S = TEXT_SAMPLE_SCALE;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(width * S));
  off.height = Math.max(1, Math.round(height * S));
  const octx = off.getContext("2d", { willReadFrequently: true });
  // todo se sigue calculando en medidas de pantalla real; la escala la aplica el canvas
  octx.setTransform(S, 0, 0, S, 0, 0);

  octx.fillStyle = "#000";
  octx.fillRect(0, 0, width, height);
  octx.fillStyle = "#fff";
  octx.textAlign = "center";
  octx.textBaseline = "middle";

  const lines = wrapTextLines(text).filter((line) => line.length > 0);
  const lineGapRatio = 0.3; // espacio entre lineas, como fraccion del tamano de fuente

  function setFont(size) {
    octx.font = `${TEXT_FONT_WEIGHT} ${size}px ${TEXT_FONT_STACK}`;
    if (octx.letterSpacing !== undefined) octx.letterSpacing = `${LETTER_SPACING_PX * motor.escala}px`;
  }

  function maxLineWidth() {
    return Math.max(...lines.map((line) => octx.measureText(line).width));
  }

  function blockHeight(size) {
    return lines.length * size + (lines.length - 1) * size * lineGapRatio;
  }

  // Reduce el tamano de fuente hasta que quepa a lo ancho y a lo alto.
  const margin = width * 0.1;
  let fontSize = Math.floor(height * (0.15 + 0.045 * (lines.length - 1)) * fontScale);
  const minFontSize = 12;
  setFont(fontSize);
  while (
    (maxLineWidth() > width - margin || blockHeight(fontSize) > height * 0.75) &&
    fontSize > minFontSize
  ) {
    fontSize -= 2;
    setFont(fontSize);
  }

  // engrosado leve: ayuda a que las curvas (S, C, O) no se vean quebradas al
  // representarse con puntos, sin llegar a tapar huecos como el de la A o la O
  const dilate = 1;
  const lineHeight = fontSize * (1 + lineGapRatio);
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    for (let dy = -dilate; dy <= dilate; dy++) {
      for (let dx = -dilate; dx <= dilate; dx++) {
        octx.fillText(line, width / 2 + dx, y + dy);
      }
    }
  });

  const ow = off.width;
  const oh = off.height;
  const { data } = octx.getImageData(0, 0, ow, oh);
  // el fondo es negro opaco y el texto blanco opaco: el canal alfa es
  // siempre 255 en ambos casos, hay que mirar el brillo (canal rojo) en su lugar
  const on = (x, y) => data[(y * ow + x) * 4] > 128;

  // se separan los puntos del contorno de la letra (tocan el fondo) de los
  // de adentro: el contorno se dibuja mas firme para que la letra se vea nitida
  const borde = [];
  const relleno = [];
  for (let y = 1; y < oh - 1; y++) {
    for (let x = 1; x < ow - 1; x++) {
      if (!on(x, y)) continue;
      const p = [(x + Math.random()) / S, (y + Math.random()) / S];
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) borde.push(p);
      else relleno.push(p);
    }
  }
  return { borde, relleno };
}
