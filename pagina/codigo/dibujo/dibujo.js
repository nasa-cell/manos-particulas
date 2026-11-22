// ---------------------------------------------------------
// Pagina de dibujos: las particulas pintan una imagen con sus colores reales
// y la punta del dedo indice (frente a la camara) la destruye al pasar.
// ---------------------------------------------------------

const DIBUJO_STORAGE_KEY = "senati_particulas_dibujo_v1";
const DIBUJO_EJEMPLO = "imagenes/quintillizas.jpg";
const DIBUJO_LADO_MAX = 1000; // al guardar, la imagen se achica a este lado mayor (cabe en el navegador)
const MAX_PARTICULAS = 700000; // tope de seguridad: si se pasa, los puntos se agrandan

const stateLabel = document.getElementById("stateLabel");
const fingerCountLabel = document.getElementById("fingerCount");

const motor = crearMotor(document.getElementById("particles")); // ver codigo/comun/motor.js
motor.brillo = 0; // sin halo: el dibujo queda nitido
motor.efecto = EFECTO_DESARMA;

// ---------------------------------------------------------
// Imagen -> particulas (una por cada cuadrito de 2x2 px: mismos colores
// y mismo detalle que la imagen)
// ---------------------------------------------------------

// Tamano del dibujo: parte del alto de la pantalla que ocupa (botones "- +")
const TAMANO_STORAGE_KEY = "senati_particulas_tamano_dibujo_v1";
const TAMANO_MIN = 0.3, TAMANO_MAX = 0.9, TAMANO_PASO = 0.05;
let tamano = (() => {
  const v = Number(localStorage.getItem(TAMANO_STORAGE_KEY));
  return v >= TAMANO_MIN && v <= TAMANO_MAX ? v : 0.6;
})();

let imagenActual = null; // <img> o <video>
let marco = null; // donde queda el dibujo en pantalla (pixeles reales)

const esVideo = (f) => f instanceof HTMLVideoElement;
const anchoDe = (f) => (esVideo(f) ? f.videoWidth : f.width);
const altoDe = (f) => (esVideo(f) ? f.videoHeight : f.height);

// para video: cuadricula chica donde se copia cada cuadro y de donde salen los colores
let cuadricula = null; // { lienzo, lctx, columnas, filas, celdas, tabla }

function formarDibujo(img) {
  imagenActual = img;
  const W = motor.ancho, H = motor.alto;
  const proporcion = anchoDe(img) / altoDe(img);
  let punto = motor.punto;
  let filas, columnas;
  for (;;) {
    filas = Math.floor((H * tamano) / punto);
    columnas = Math.floor(filas * proporcion);
    if (columnas * punto > W * tamano) {
      columnas = Math.floor((W * tamano) / punto);
      filas = Math.floor(columnas / proporcion);
    }
    if (filas * columnas <= MAX_PARTICULAS) break;
    punto++;
  }

  const lienzo = document.createElement("canvas");
  lienzo.width = columnas;
  lienzo.height = filas;
  const lctx = lienzo.getContext("2d", { willReadFrequently: true });
  lctx.drawImage(img, 0, 0, columnas, filas);
  const datos = lctx.getImageData(0, 0, columnas, filas).data;

  // solo los cuadritos que no son transparentes
  const celdas = [];
  for (let k = 0; k < columnas * filas; k++) if (esVideo(img) || datos[k * 4 + 3] >= 40) celdas.push(k);
  cuadricula = esVideo(img) ? { lienzo, lctx, columnas, filas, celdas, tabla: new Uint32Array(celdas.length) } : null;

  const x0 = Math.round((W - columnas * punto) / 2);
  const y0 = Math.round((H - filas * punto) / 2);
  marco = { x: x0, y: y0, ancho: columnas * punto, alto: filas * punto };
  motor.fijarDestinos(celdas.length, (i) => {
    const k = celdas[i];
    const c = k % columnas, f = (k / columnas) | 0;
    return [x0 + c * punto, y0 + f * punto, colorRGBA(datos[k * 4], datos[k * 4 + 1], datos[k * 4 + 2])];
  });
  stateLabel.textContent = esVideo(img) ? "Pasa tu dedo indice por el video" : "Pasa tu dedo indice por el dibujo";
}

function cargarImagen(src) {
  return new Promise((ok, falla) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falla;
    img.src = src;
  });
}

// El ultimo dibujo o video subido queda guardado en este navegador; si no
// hay ninguno, se usa el de ejemplo.
function cargarGuardado() {
  return cargarImagen(localStorage.getItem(DIBUJO_STORAGE_KEY) || DIBUJO_EJEMPLO)
    .catch(() => cargarImagen(DIBUJO_EJEMPLO))
    .then(formarDibujo)
    .catch(() => { stateLabel.textContent = "No se pudo abrir el dibujo"; });
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  motor.medir();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (imagenActual) formarDibujo(imagenActual); }, 150);
});

// ---------------------------------------------------------
// Subir otro dibujo (boton o arrastrar y soltar)
// ---------------------------------------------------------

const archivoInput = document.getElementById("archivo");
const soltarAqui = document.getElementById("soltarAqui");

async function usarArchivo(archivo) {
  if (archivo && archivo.type.startsWith("video/")) {
    usarVideo(archivo, true);
    return;
  }
  if (!archivo || !archivo.type.startsWith("image/")) {
    stateLabel.textContent = "Ese archivo no es una imagen ni un video";
    return;
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url);
    quitarVideo();
    localStorage.setItem(FUENTE_STORAGE_KEY, "imagen");
    borrarVideoGuardado();
    formarDibujo(img);
    // se guarda una copia achicada para que la proxima vez siga aqui
    const escala = Math.min(1, DIBUJO_LADO_MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    try {
      localStorage.setItem(DIBUJO_STORAGE_KEY, c.toDataURL("image/webp", 0.9));
    } catch (e) {
      stateLabel.textContent = "Dibujo listo (es muy pesado para guardarlo para la proxima vez)";
    }
  } catch (e) {
    stateLabel.textContent = "No se pudo abrir esa imagen";
  } finally {
    URL.revokeObjectURL(url);
  }
}

document.getElementById("subirBtn").addEventListener("click", () => archivoInput.click());
archivoInput.addEventListener("change", () => { usarArchivo(archivoInput.files[0]); archivoInput.value = ""; });

window.addEventListener("dragover", (e) => { e.preventDefault(); soltarAqui.hidden = false; });
soltarAqui.addEventListener("dragleave", () => { soltarAqui.hidden = true; });
window.addEventListener("drop", (e) => {
  e.preventDefault();
  soltarAqui.hidden = true;
  usarArchivo(e.dataTransfer.files[0]);
});

// ---------------------------------------------------------
// Punteros: punta del dedo indice de cada mano (y el mouse)
// ---------------------------------------------------------

let dedos = [];            // posiciones suavizadas en pantalla, una por mano
let mouse = null;
let mouseVistoEn = 0;

window.addEventListener("pointermove", (e) => { mouse = { x: e.clientX * motor.escala, y: e.clientY * motor.escala }; mouseVistoEn = performance.now(); });

function actualizarPunteros() {
  const lista = dedos.slice();
  if (mouse && performance.now() - mouseVistoEn < 1500) lista.push(mouse);
  motor.punteros = lista;
}

// circulo que muestra donde esta cada dedo
motor.alDibujar = (ctx) => {
  actualizarPunteros();
  colorearConVideo();
  dibujarImagenReal(ctx);
  ctx.lineWidth = 2 * motor.escala;
  ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
  for (const p of dedos) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 * motor.escala, 0, Math.PI * 2);
    ctx.stroke();
  }
};

// ---------------------------------------------------------
// Camara (ver codigo/comun/camara.js): la punta del indice de cada mano
// ---------------------------------------------------------

const camara = crearCamara({
  alVerManos(manos) {
    const nuevos = [];
    let puno = null;
    manos.forEach((puntos, i) => {
      if (!puno && esPuno(puntos)) puno = { x: (1 - puntos[9].x) * motor.ancho, y: puntos[9].y * motor.alto };
      // punta del indice (punto 8). La camara se ve como espejo, por eso x se invierte.
      const x = (1 - puntos[8].x) * motor.ancho;
      const y = puntos[8].y * motor.alto;
      const antes = dedos[i];
      // suavizado: quita el temblor sin que el circulo se quede atras
      nuevos.push(antes ? { x: antes.x + (x - antes.x) * 0.6, y: antes.y + (y - antes.y) * 0.6 } : { x, y });
    });
    dedos = nuevos;
    verPuno(puno);
    fingerCountLabel.textContent = manos.length === 0 ? "Dedo: no se ve la mano" : manos.length === 1 ? "Dedo: 1 mano" : "Dedos: 2 manos";
  },
  alApagar() {
    dedos = [];
    fingerCountLabel.textContent = "Dedo: camara apagada";
  },
  alFallar(mensaje) { stateLabel.textContent = mensaje + " (igual funciona con el mouse)"; },
});

// ---------------------------------------------------------
// Imagen real encima cuando el dibujo esta quieto: se ve con toda la
// nitidez de la imagen original. Apenas el dedo lo toca, la imagen se
// desvanece y quedan las particulas.
// ---------------------------------------------------------

let imagenReal = true;
let opacidadReal = 0;

function dibujarImagenReal(ctx) {
  const objetivo = imagenReal && motor.quieto && marco ? 1 : 0;
  // aparece suave (0,4 s) y se va al instante cuando algo se mueve
  opacidadReal = objetivo ? Math.min(1, opacidadReal + 0.04) : 0;
  if (opacidadReal <= 0 || !imagenActual) return;
  ctx.globalAlpha = opacidadReal;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagenActual, marco.x, marco.y, marco.ancho, marco.alto);
  ctx.globalAlpha = 1;
}

// botones de tamano del dibujo
const tamanoLabel = document.getElementById("tamanoLabel");
function setTamano(v) {
  tamano = Math.min(TAMANO_MAX, Math.max(TAMANO_MIN, Math.round(v * 100) / 100));
  localStorage.setItem(TAMANO_STORAGE_KEY, String(tamano));
  tamanoLabel.textContent = `${Math.round(tamano * 100)}%`;
  document.getElementById("tamanoDownBtn").disabled = tamano <= TAMANO_MIN;
  document.getElementById("tamanoUpBtn").disabled = tamano >= TAMANO_MAX;
  if (imagenActual) formarDibujo(imagenActual);
}
document.getElementById("tamanoDownBtn").addEventListener("click", () => setTamano(tamano - TAMANO_PASO));
document.getElementById("tamanoUpBtn").addEventListener("click", () => setTamano(tamano + TAMANO_PASO));
tamanoLabel.textContent = `${Math.round(tamano * 100)}%`;

// al abrir: el ultimo video guardado, o si no, el ultimo dibujo
if (localStorage.getItem(FUENTE_STORAGE_KEY) === "video") {
  leerVideoGuardado()
    .then((blob) => (blob ? usarVideo(blob, false) : cargarGuardado()))
    .catch(cargarGuardado);
} else {
  cargarGuardado();
}
