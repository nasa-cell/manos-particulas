// Detector de manos en un hilo aparte (Web Worker), para que la deteccion
// no frene la animacion de las particulas, que corre en el hilo principal.
// Recibe cuadros de la camara (ImageBitmap) y devuelve los 21 puntos de
// cada mano, con el mismo formato que usaba MediaPipe Hands.

const VERSION = "0.10.14";
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELO =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// La libreria (vision_bundle.cjs de la version indicada arriba) esta
// guardada en librerias/mediapipe/vision_bundle.js: el CDN la entrega con un tipo de
// archivo que el navegador no acepta en importScripts. Esta escrita como
// modulo CommonJS, por eso se le prepara "exports" antes de cargarla.
self.exports = {};
self.module = { exports: self.exports };
importScripts("../../librerias/mediapipe/vision_bundle.js");
const { FilesetResolver, HandLandmarker } = self.module.exports;

let detector = null;
let archivosVision = null;
let usa = "";
let medidos = 0, msTotal = 0;
let ultimoTiempo = 0;
let lienzo = null;
let lctx = null;

const opciones = (delegate) => ({
  baseOptions: { modelAssetPath: MODELO, delegate },
  runningMode: "VIDEO",
  numHands: 2,
  minHandDetectionConfidence: 0.35,
  minHandPresenceConfidence: 0.35,
  minTrackingConfidence: 0.35,
});

// Primero intenta con la tarjeta de video (GPU): detecta mas rapido y sigue
// mejor la mano. Si esta PC no puede, usa el procesador (CPU).
async function crearDetector() {
  archivosVision = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const archivos = archivosVision;
  usa = "GPU";
  try {
    detector = await HandLandmarker.createFromOptions(archivos, opciones("GPU"));
  } catch (err) {
    usa = "CPU";
    detector = await HandLandmarker.createFromOptions(archivos, opciones("CPU"));
  }
  self.postMessage({ tipo: "listo", usa });
}

crearDetector().catch((err) => {
  self.postMessage({ tipo: "error", mensaje: String(err && err.message ? err.message : err) });
});

// Con la GPU, las primeras 15 detecciones se miden: si tarda mas de 30 ms
// en promedio (tarjeta de video lenta), se cambia al procesador.
function revisarVelocidad(ms) {
  if (usa !== "GPU" || medidos >= 15) return;
  medidos++;
  if (medidos > 3) msTotal += ms; // las primeras son lentas siempre (se esta preparando)
  if (medidos === 15 && msTotal / 12 > 30) {
    usa = "CPU";
    const viejo = detector;
    HandLandmarker.createFromOptions(archivosVision, opciones("CPU")).then((d) => { detector = d; viejo.close(); self.postMessage({ tipo: "listo", usa }); });
  }
}

self.onmessage = (e) => {
  const { cuadro, tiempo } = e.data;
  if (!detector) {
    cuadro.close();
    self.postMessage({ tipo: "resultado", manos: [], lados: [], mundos: [] });
    return;
  }
  // el detector exige tiempos siempre crecientes
  const t = Math.max(tiempo, ultimoTiempo + 1);
  ultimoTiempo = t;
  // sube brillo y contraste antes de detectar: ayuda con sombras o poca luz
  if (!lienzo || lienzo.width !== cuadro.width || lienzo.height !== cuadro.height) {
    lienzo = new OffscreenCanvas(cuadro.width, cuadro.height);
    lctx = lienzo.getContext("2d");
  }
  lctx.filter = "brightness(1.2) contrast(1.15)";
  lctx.drawImage(cuadro, 0, 0);
  cuadro.close();
  const inicio = performance.now();
  const res = detector.detectForVideo(lienzo, t);
  revisarVelocidad(performance.now() - inicio);
  self.postMessage({
    tipo: "resultado",
    // solo x, y, z: el campo "visibility" viene en 0 y drawing_utils no
    // dibujaria el esqueleto
    manos: (res.landmarks || []).map((mano) => mano.map((p) => ({ x: p.x, y: p.y, z: p.z }))),
    lados: (res.handedness || []).map((h) => ({ label: h[0] ? h[0].categoryName : "Right" })),
    // los mismos 21 puntos en metros y en 3D (centro en la mano): sirven para
    // medir el angulo de cada dedo sin importar como este girada la mano
    mundos: (res.worldLandmarks || []).map((mano) => mano.map((p) => ({ x: p.x, y: p.y, z: p.z }))),
  });
};
