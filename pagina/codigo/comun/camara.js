// ---------------------------------------------------------
// Camara + detector de manos, comun a las dos paginas.
//
//   const camara = crearCamara({
//     alVerManos(manos, lados, mundos) { ... },  // cada resultado del detector
//     alApagar() { ... },                // al apagar la camara con su boton
//     alPrender() { ... },               // cuando la camara ya esta funcionando
//     alFallar(mensaje) { ... },         // sin camara o sin detector
//   });
//   camara.encendida  // true / false
//
// Usa los elementos #inputVideo, #skeleton, #camWrap, #camOffOverlay,
// #camToggleBtn y #camMoveBtn de la pagina.
// ---------------------------------------------------------

// Lineas que unen los 21 puntos de la mano para dibujar el esqueleto
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

// El detector de MediaPipe reduce cada cuadro a uno chico (~192px) antes de
// analizarlo: si la mano ocupa poco en la imagen, sigue ocupando poco. Por
// eso se recorta el centro del cuadro y se agranda ("zoom digital") para que
// la mano se vea mas grande cuando esta lejos. A mas zoom, la mano tiene que
// mantenerse mas centrada en el recuadro de camara.
const DIGITAL_ZOOM = 1.6;

const CAM_CORNER_STORAGE_KEY = "senati_particulas_esquina_cam_v1";
const CAM_CORNERS = ["top-right", "bottom-right", "bottom-left", "top-left"];

function crearCamara(opciones) {
  const videoEl = document.getElementById("inputVideo");
  const skeletonCanvas = document.getElementById("skeleton");
  const sctx = skeletonCanvas.getContext("2d");
  const camWrap = document.getElementById("camWrap");
  const camOffOverlay = document.getElementById("camOffOverlay");
  const camToggleBtn = document.getElementById("camToggleBtn");

  let encendida = false;
  let detectorOcupado = false;

  // La deteccion de manos corre en un hilo aparte (detector.js) para que no
  // frene la animacion de las particulas.
  const detector = new Worker("codigo/comun/detector.js");

  const fallar = (mensaje, err) => {
    if (opciones.alFallar) opciones.alFallar(mensaje);
    console.error(err);
  };

  detector.onmessage = (e) => {
    const msg = e.data;
    if (msg.tipo === "resultado") {
      detectorOcupado = false;
      verResultado(msg.manos, msg.lados, msg.mundos || []);
    } else if (msg.tipo === "listo") {
      camara.detectaCon = msg.usa;
    } else if (msg.tipo === "error") {
      fallar("No se pudo cargar el detector de manos (revisa el internet)", msg.mensaje);
    }
  };
  detector.onerror = (e) => {
    detectorOcupado = false;
    fallar("No se pudo cargar el detector de manos (revisa el internet)", e.message);
  };

  // Los puntos que devuelve el modelo (0-1) son relativos al recorte con
  // zoom que se le mando, no al video completo, y el video en pantalla se
  // muestra con object-fit: cover (recorta lados o arriba/abajo). Esta
  // funcion junta ambos recortes en una transformacion del lienzo para que
  // el esqueleto quede encima de la mano real.
  function ajustarEsqueleto(ctx, videoW, videoH, boxW, boxH) {
    if (!videoW || !videoH) return;
    const coverScale = Math.max(boxW / videoW, boxH / videoH);
    const cropW = videoW / DIGITAL_ZOOM;
    const cropH = videoH / DIGITAL_ZOOM;
    ctx.translate((boxW - videoW * coverScale) / 2 + ((videoW - cropW) / 2) * coverScale,
                  (boxH - videoH * coverScale) / 2 + ((videoH - cropH) / 2) * coverScale);
    ctx.scale((cropW * coverScale) / boxW, (cropH * coverScale) / boxH);
  }

  function verResultado(manos, lados, mundos) {
    if (!encendida) return; // llego tarde un resultado de cuando la camara estaba prendida
    skeletonCanvas.width = skeletonCanvas.clientWidth;
    skeletonCanvas.height = skeletonCanvas.clientHeight;
    sctx.save();
    ajustarEsqueleto(sctx, videoEl.videoWidth, videoEl.videoHeight, skeletonCanvas.width, skeletonCanvas.height);
    for (const puntos of manos) {
      drawConnectors(sctx, puntos, HAND_CONNECTIONS, { color: "#00e5ff", lineWidth: 2 });
      drawLandmarks(sctx, puntos, { color: "#ff2fd6", lineWidth: 1, radius: 3 });
    }
    sctx.restore();
    opciones.alVerManos(manos, lados, mundos);
  }

  async function prender() {
    const stream = await navigator.mediaDevices.getUserMedia({
      // resolucion alta: la mano ocupa mas pixeles cuando esta lejos de la camara
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    encendida = true;
    if (opciones.alPrender) opciones.alPrender();
  }

  function apagar() {
    encendida = false;
    if (videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
    }
    sctx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    if (opciones.alApagar) opciones.alApagar();
  }

  // Manda un cuadro al detector solo cuando termino el anterior: nunca se
  // acumulan cuadros pendientes y la animacion sigue a su ritmo. El brillo y
  // contraste se aplican en el detector, fuera de este hilo.
  async function mandarCuadros() {
    if (encendida && !detectorOcupado && videoEl.readyState >= 2) {
      detectorOcupado = true;
      try {
        const w = videoEl.videoWidth, h = videoEl.videoHeight;
        const cropW = w / DIGITAL_ZOOM, cropH = h / DIGITAL_ZOOM;
        const cuadro = await createImageBitmap(videoEl, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH);
        detector.postMessage({ cuadro, tiempo: performance.now() }, [cuadro]);
      } catch (err) {
        detectorOcupado = false;
        console.error(err);
      }
    }
    requestAnimationFrame(mandarCuadros);
  }
  requestAnimationFrame(mandarCuadros);

  prender().catch((err) => fallar("No se pudo acceder a la camara", err));

  // boton para apagar / prender la camara
  camToggleBtn.addEventListener("click", async () => {
    if (encendida) {
      apagar();
      camOffOverlay.hidden = false;
      camToggleBtn.title = "Prender camara";
      camToggleBtn.classList.add("cam-off");
      camWrap.classList.add("cam-off");
    } else {
      try {
        await prender();
        camOffOverlay.hidden = true;
        camToggleBtn.title = "Apagar camara";
        camToggleBtn.classList.remove("cam-off");
        camWrap.classList.remove("cam-off");
      } catch (err) {
        fallar("No se pudo acceder a la camara", err);
      }
    }
  });

  // boton para mover la caja de camara a otra esquina (queda guardada)
  const guardada = localStorage.getItem(CAM_CORNER_STORAGE_KEY);
  camWrap.dataset.corner = CAM_CORNERS.includes(guardada) ? guardada : CAM_CORNERS[0];
  document.getElementById("camMoveBtn").addEventListener("click", () => {
    const sig = (CAM_CORNERS.indexOf(camWrap.dataset.corner) + 1) % CAM_CORNERS.length;
    camWrap.dataset.corner = CAM_CORNERS[sig];
    localStorage.setItem(CAM_CORNER_STORAGE_KEY, camWrap.dataset.corner);
  });

  const camara = {
    detectaCon: "", // "GPU" o "CPU", cuando el detector ya cargo
    get encendida() { return encendida; },
  };
  return camara;
}
