// ---------------------------------------------------------
// Puno cerrado: el dibujo o video explota y queda flotando; al abrir la
// mano se vuelve a armar. La tecla Espacio hace lo mismo (para probar sin camara).
// ---------------------------------------------------------

const PUNO_ESPERA_MS = 150;   // el puno tiene que verse este tiempo seguido
const SOLTAR_ESPERA_MS = 350; // y la mano abierta este tiempo para rearmar
let punoDesde = 0, abiertaDesde = 0, espacio = false;

// puno = ningun dedo levantado (mismo conteo que la pagina de frases, ver codigo/comun/dedos.js)
function esPuno(puntos, mundo) {
  return contarDedos(puntos, mundo) === 0;
}

function verPuno(puno) {
  const ahora = performance.now();
  if (puno) {
    abiertaDesde = 0;
    if (!punoDesde) punoDesde = ahora;
    if (ahora - punoDesde >= PUNO_ESPERA_MS && !motor.explotado) {
      motor.explotar(puno.x, puno.y);
      stateLabel.textContent = "Boom! Abre la mano para armarlo otra vez";
    }
  } else {
    punoDesde = 0;
    if (!abiertaDesde) abiertaDesde = ahora;
    if (ahora - abiertaDesde >= SOLTAR_ESPERA_MS && motor.explotado && !espacio) rearmarDibujo();
  }
}

function rearmarDibujo() {
  motor.rearmar();
  stateLabel.textContent = esVideo(imagenActual) ? "Pasa tu dedo indice por el video" : "Pasa tu dedo indice por el dibujo";
}

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  e.preventDefault();
  espacio = true;
  const centro = mouse && performance.now() - mouseVistoEn < 1500 ? mouse : { x: motor.ancho / 2, y: motor.alto / 2 };
  motor.explotar(centro.x, centro.y);
  stateLabel.textContent = "Boom! Suelta Espacio para armarlo otra vez";
});
window.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  espacio = false;
  rearmarDibujo();
});
