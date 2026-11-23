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
// Suavizado: se usa el numero de dedos que mas se repitio en los ultimos
// cuadros, asi un cuadro mal detectado no cambia la frase
// ---------------------------------------------------------

const SUAVIZADO_CUADROS = 5;
const ultimasSumas = [];

function sumaSuavizada(sum) {
  ultimasSumas.push(sum);
  if (ultimasSumas.length > SUAVIZADO_CUADROS) ultimasSumas.shift();
  const veces = new Map();
  let mejor = sum, mejorVeces = 0;
  for (const n of ultimasSumas) {
    const v = (veces.get(n) || 0) + 1;
    veces.set(n, v);
    if (v > mejorVeces || (v === mejorVeces && n === sum)) { mejor = n; mejorVeces = v; }
  }
  return mejor;
}

// ---------------------------------------------------------
// Camara (ver codigo/comun/camara.js)
// ---------------------------------------------------------

let puntoPuno = null; // centro de la mano cerrada en puno (pixeles reales), o null

const camara = crearCamara({
  alVerManos(manos, lados, mundos) {
    let sum = 0;
    puntoPuno = null;
    // en 3D la frase gira hacia la mano (centro de la palma de la primera mano)
    motor.mirar = manos.length ? { x: (1 - manos[0][9].x) * motor.ancho, y: manos[0][9].y * motor.alto } : null;
    manos.forEach((landmarks, i) => {
      const dedosMano = contarDedos(landmarks, mundos[i]); // ver codigo/comun/dedos.js
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
    sum = manos.length ? sumaSuavizada(sum) : 0;
    if (!manos.length) ultimasSumas.length = 0;
    handleGesture(sum, manos.length > 0);
  },
  alPrender() { if (currentDisplay === "idle") stateLabel.textContent = "En reposo"; },
  alApagar() { motor.mirar = null; fingerCountLabel.textContent = "Manos: camara apagada"; },
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
