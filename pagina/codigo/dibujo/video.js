// ---------------------------------------------------------
// Video: subir un video (TikTok, etc.) y que las particulas tomen
// los colores de cada cuadro. Se guarda en el navegador (IndexedDB).
// ---------------------------------------------------------

const FUENTE_STORAGE_KEY = "senati_particulas_fuente_v1"; // "imagen" o "video"
const VIDEO_MAX_BYTES = 300 * 1024 * 1024;
const pausaBtn = document.getElementById("pausaBtn");
const sonidoBtn = document.getElementById("sonidoBtn");
let videoUrl = null;
let ultimoTiempoVideo = -1;

function colorearConVideo() {
  const v = imagenActual;
  if (!cuadricula || !esVideo(v) || v.readyState < 2) return;
  // con el video nitido encima no hace falta (las particulas no se ven)
  if (opacidadReal >= 1) { ultimoTiempoVideo = -1; return; }
  if (v.currentTime === ultimoTiempoVideo) return;
  ultimoTiempoVideo = v.currentTime;
  const { lienzo, lctx, columnas, filas, celdas, tabla } = cuadricula;
  lctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
  const px32 = new Uint32Array(lctx.getImageData(0, 0, columnas, filas).data.buffer);
  for (let i = 0; i < celdas.length; i++) tabla[i] = px32[celdas[i]] | 0xff000000;
  motor.recolorear(tabla);
}

function quitarVideo() {
  if (esVideo(imagenActual)) imagenActual.pause();
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = null;
  pausaBtn.hidden = sonidoBtn.hidden = true;
}

function mostrarSonido(v) {
  sonidoBtn.innerHTML = v.muted ? "&#128263;" : "&#128266;";
  sonidoBtn.title = v.muted ? "Activar sonido" : "Silenciar";
}

async function usarVideo(blob, guardar) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.loop = true;
  v.playsInline = true;
  v.src = url;
  try {
    await new Promise((ok, falla) => { v.onloadeddata = ok; v.onerror = falla; });
  } catch (e) {
    URL.revokeObjectURL(url);
    stateLabel.textContent = "No se pudo abrir ese video";
    return;
  }
  quitarVideo();
  videoUrl = url;
  // con sonido; si el navegador no deja (al abrir la pagina), empieza en silencio
  try { await v.play(); } catch (e) { v.muted = true; await v.play().catch(() => {}); }
  ultimoTiempoVideo = -1;
  formarDibujo(v);
  pausaBtn.hidden = sonidoBtn.hidden = false;
  pausaBtn.innerHTML = "&#9208;";
  pausaBtn.title = "Pausar";
  mostrarSonido(v);
  if (guardar) {
    if (blob.size <= VIDEO_MAX_BYTES) {
      localStorage.setItem(FUENTE_STORAGE_KEY, "video");
      guardarVideo(blob).catch(() => { stateLabel.textContent = "Video listo (no se pudo guardar para la proxima vez)"; });
    } else {
      stateLabel.textContent = "Video listo (pesa mas de 300 MB: no queda guardado para la proxima vez)";
    }
  }
}

pausaBtn.addEventListener("click", () => {
  const v = imagenActual;
  if (!esVideo(v)) return;
  if (v.paused) { v.play(); pausaBtn.innerHTML = "&#9208;"; pausaBtn.title = "Pausar"; }
  else { v.pause(); pausaBtn.innerHTML = "&#9654;"; pausaBtn.title = "Seguir"; }
});

sonidoBtn.addEventListener("click", () => {
  const v = imagenActual;
  if (!esVideo(v)) return;
  v.muted = !v.muted;
  mostrarSonido(v);
});

// el video se guarda en IndexedDB (localStorage es muy chico para videos)
function abrirBase() {
  return new Promise((ok, falla) => {
    const pedido = indexedDB.open("senati_particulas", 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore("archivos");
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falla(pedido.error);
  });
}

async function usarBase(modo, accion) {
  const base = await abrirBase();
  return new Promise((ok, falla) => {
    const tx = base.transaction("archivos", modo);
    const pedido = accion(tx.objectStore("archivos"));
    tx.oncomplete = () => { base.close(); ok(pedido.result); };
    tx.onerror = () => { base.close(); falla(tx.error); };
  });
}

const guardarVideo = (blob) => usarBase("readwrite", (s) => s.put(blob, "video"));
const leerVideoGuardado = () => usarBase("readonly", (s) => s.get("video"));
const borrarVideoGuardado = () => usarBase("readwrite", (s) => s.delete("video")).catch(() => {});
