// ---------------------------------------------------------
// Pagina de frases: configuracion, frases y colores guardados,
// motor de particulas y frase -> destinos de las particulas.
// ---------------------------------------------------------

const IDLE_TEXT = "SENATI PROYECTO";
const PHRASES_STORAGE_KEY = "senati_particulas_frases_v1";

const DEFAULT_PHRASES = [
  "NUNCA ME RENDIRE",
  "SI CAIGO, ME LEVANTO",
  "EL DOLOR ES PARTE DEL CAMINO",
  "MI FUERZA ES NO RENDIRME",
  "CREO EN MI MISMO",
  "CADA CAIDA ES UN PASO MAS",
  "LA VOLUNTAD VENCE AL DESTINO",
  "AVANZAR ES MI UNICA OPCION",
  "NUNCA ES TARDE PARA EMPEZAR",
  "MI HISTORIA AUN NO TERMINA",
];

function loadPhrases() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHRASES_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === 10) return saved;
  } catch (e) {
    // localStorage vacio o con datos invalidos: usa las frases por defecto
  }
  return DEFAULT_PHRASES.slice();
}

const PHRASES = loadPhrases();

// Neon B+: 20 000 puntos firmes; la mitad dibuja el contorno de cada letra
// con un centro blanco caliente (como un tubo de neon) y el resto la rellena
const PARTICLE_COUNT = 20000;
const BORDE_PROPORCION = 0.5;
const BORDE_BLANCO = 0.5;   // cuanto se acerca al blanco el color del contorno
const BRILLO_NEON = 1.6;    // fuerza del halo de luz
const COLORS_STORAGE_KEY = "senati_particulas_colores_v1";
const DEFAULT_COLOR_PALETTE = ["#ff2fd6", "#00e5ff"]; // magenta, cian

function loadColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLORS_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === 2) return saved;
  } catch (e) {
    // localStorage vacio o con datos invalidos: usa los colores por defecto
  }
  return DEFAULT_COLOR_PALETTE.slice();
}

// se mantiene como el mismo arreglo (no se reasigna) para que el resto del
// codigo pueda seguir leyendolo por referencia despues de guardar colores nuevos
const COLOR_PALETTE = loadColors();

const NO_HANDS_RESET_MS = 3000;     // tiempo sin manos para volver al reposo
const GESTURE_HOLD_MS = 350;        // tiempo que debe sostenerse un conteo antes de cambiar de frase

// ---------------------------------------------------------
// Canvas de particulas
// ---------------------------------------------------------

const particleCanvas = document.getElementById("particles");
const motor = crearMotor(particleCanvas); // ver codigo/comun/motor.js

// Al cambiar el tamano de la ventana (pantalla completa, girar el celular)
// la frase se vuelve a calcular para que quede centrada en el tamano nuevo.
// Se espera un momento porque el navegador dispara muchos "resize" seguidos.
let resizeTimer = null;
window.addEventListener("resize", () => {
  motor.medir();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const text = getCurrentDisplayText();
    if (text) applyTextTarget(text);
  }, 150);
});

// ---------------------------------------------------------
// Frase -> destinos de las particulas
// ---------------------------------------------------------

function applyTextTarget(text) {
  const { borde, relleno } = getTextPoints(text, motor.ancho, motor.alto);
  if (borde.length === 0) { motor.dispersar(); return; }
  const lista2 = relleno.length ? relleno : borde;
  // con mas pixeles reales (escala de Windows) se usan mas puntos para que la letra siga igual de llena
  const total = Math.round(PARTICLE_COUNT * motor.escala * motor.escala);
  const nBorde = Math.round(total * BORDE_PROPORCION);
  const colores = COLOR_PALETTE.map(hexAColor);

  motor.fijarDestinos(total, (i) => {
    const esBorde = i < nBorde;
    // recorre cada lista a pasos iguales: la letra queda cubierta pareja
    const p = esBorde
      ? borde[Math.floor((i * borde.length) / nBorde)]
      : lista2[Math.floor(((i - nBorde) * lista2.length) / (total - nBorde))];
    let [r, g, b] = colores[i % colores.length];
    if (esBorde) {
      r += (255 - r) * BORDE_BLANCO; g += (255 - g) * BORDE_BLANCO; b += (255 - b) * BORDE_BLANCO;
    }
    return [p[0], p[1], colorRGBA(r | 0, g | 0, b | 0)];
  });
}

// texto que corresponde a lo que se esta mostrando ahora, o null si son
// particulas dispersas (no hay texto que redibujar)
function getCurrentDisplayText() {
  if (currentDisplay === "idle") return IDLE_TEXT;
  const idx = Number(currentDisplay) - 1;
  if (idx >= 0 && idx < 10) return PHRASES[idx];
  return null;
}

// vuelve a formar lo que se esta mostrando (despues de cambiar letra, colores, lineas...)
function redibujarFrase() {
  const text = getCurrentDisplayText();
  if (text) applyTextTarget(text);
}
