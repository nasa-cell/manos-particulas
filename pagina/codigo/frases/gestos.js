// ---------------------------------------------------------
// Gestos: cuantos dedos se muestran -> que frase se forma.
// Puno cerrado (o tecla Espacio) -> la frase explota.
// ---------------------------------------------------------

const stateLabel = document.getElementById("stateLabel");
const fingerCountLabel = document.getElementById("fingerCount");

let hasEverMoved = false;
let lastHandsSeenAt = 0;

let currentDisplay = "idle"; // "idle" | "scatter" | number de frase (1-10) como string
let stableSum = null;
let stableSince = 0;
applyTextTarget(IDLE_TEXT);

function setDisplay(newDisplay) {
  if (newDisplay === currentDisplay) return;
  currentDisplay = newDisplay;

  if (newDisplay === "idle") {
    stateLabel.textContent = "En reposo";
    applyTextTarget(IDLE_TEXT);
  } else if (newDisplay === "scatter") {
    if (puntoPuno) {
      // puno cerrado: la frase explota desde la mano
      stateLabel.textContent = "Boom! Muestra tus dedos para formar otra frase";
      motor.explotar(puntoPuno.x, puntoPuno.y);
    } else {
      stateLabel.textContent = "Particulas dispersas - muestra tus dedos";
      motor.dispersar();
    }
  } else {
    const idx = Number(newDisplay) - 1;
    stateLabel.textContent = `Frase ${newDisplay}: "${PHRASES[idx]}"`;
    applyTextTarget(PHRASES[idx]);
  }
}

function handleGesture(sum, handsPresent) {
  const now = performance.now();

  if (handsPresent) {
    lastHandsSeenAt = now;
    hasEverMoved = true; // que la mano aparezca en camara ya cuenta como "moverse"
  }

  // sin actividad reciente de manos: vuelve al reposo inicial
  if (now - lastHandsSeenAt > NO_HANDS_RESET_MS) {
    hasEverMoved = false;
    setDisplay("idle", true);
    stableSum = null;
    return;
  }

  if (!hasEverMoved) {
    setDisplay("idle", true);
    return;
  }

  // debounce: exige que el conteo se mantenga estable antes de cambiar de frase
  if (sum !== stableSum) {
    stableSum = sum;
    stableSince = now;
  }
  const stableFor = now - stableSince;

  if (stableFor < GESTURE_HOLD_MS) return; // aun no esta estable, mantiene el display actual

  if (sum >= 1 && sum <= 10) {
    setDisplay(String(sum), true);
  } else {
    setDisplay("scatter", false);
  }
}

// ---------------------------------------------------------
// Conteo de dedos con MediaPipe Hands
// ---------------------------------------------------------

function countFingers(landmarks, handednessLabel) {
  let count = 0;

  // margen de "dedo extendido" relativo al tamano de la mano en la imagen
  // (muneca -> nudillo del medio, un tamano de referencia estable), en vez
  // de un valor fijo: con un margen fijo, una mano lejos (chica en la
  // imagen) tiene distancias dedo-nudillo mas chicas tambien, y deja de
  // superar el margen aunque el dedo este bien extendido (se pierden dedos,
  // sobre todo pulgar y menique, al alejarse de la camara)
  const wrist = landmarks[0];
  const midMcp = landmarks[9];
  const handScale = Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y);
  const margin = handScale * 0.15;

  // dedos indice, medio, anular, menique: extendido si la punta esta
  // por encima (menor y) que su articulacion media
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  for (let i = 0; i < 4; i++) {
    if (landmarks[tips[i]].y < landmarks[pips[i]].y - margin) count++;
  }

  // pulgar: se compara contra la base del menique (nudillo 17) en vez de
  // la muneca. Al doblar el pulgar, este cruza por delante de la palma (se
  // acerca al lado del menique) en vez de acercarse a la muneca, asi que
  // comparar contra la muneca casi siempre daba "extendido" aunque
  // estuviera doblado. Extendido = la punta queda mas lejos de esa base
  // que su propio nudillo (2), sin importar la orientacion de la mano.
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const pinkyMcp = landmarks[17];
  const tipDist = Math.hypot(thumbTip.x - pinkyMcp.x, thumbTip.y - pinkyMcp.y);
  const mcpDist = Math.hypot(thumbMcp.x - pinkyMcp.x, thumbMcp.y - pinkyMcp.y);
  if (tipDist > mcpDist + margin) count++;

  return count;
}

// ---------------------------------------------------------
// Camara (ver codigo/comun/camara.js)
// ---------------------------------------------------------

let puntoPuno = null; // centro de la mano cerrada en puno (pixeles reales), o null

const camara = crearCamara({
  alVerManos(manos, lados) {
    let sum = 0;
    puntoPuno = null;
    manos.forEach((landmarks, i) => {
      const dedosMano = countFingers(landmarks, lados[i]?.label || "Right");
      sum += dedosMano;
      if (dedosMano === 0 && !puntoPuno) {
        // centro de la palma (punto 9); la camara se ve como espejo
        puntoPuno = { x: (1 - landmarks[9].x) * motor.ancho, y: landmarks[9].y * motor.alto };
      }
    });
    fingerCountLabel.textContent =
      manos.length === 0 ? "Manos: no detectadas"
        : manos.length === 2 ? `Manos: suma = ${sum} / 10`
          : `Manos: 1 mano = ${sum}`;
    handleGesture(sum, manos.length > 0);
  },
  alPrender() { if (currentDisplay === "idle") stateLabel.textContent = "En reposo"; },
  alApagar() { fingerCountLabel.textContent = "Manos: camara apagada"; },
  alFallar(mensaje) { stateLabel.textContent = mensaje; },
});

// ---------------------------------------------------------
// Tecla Espacio: hace explotar la frase como el puno (para probar sin
// camara). Al soltarla, la frase se vuelve a armar.
// ---------------------------------------------------------

const escribiendo = (e) => e.target.closest && e.target.closest("input, textarea, [contenteditable]");

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || escribiendo(e)) return;
  e.preventDefault();
  motor.explotar(motor.ancho / 2, motor.alto / 2);
  stateLabel.textContent = "Boom! Suelta Espacio para armarla otra vez";
});

window.addEventListener("keyup", (e) => {
  if (e.code !== "Space" || escribiendo(e)) return;
  const actual = currentDisplay;
  currentDisplay = null; // fuerza a que setDisplay vuelva a armar lo que habia
  setDisplay(actual === "scatter" ? "idle" : actual);
});
