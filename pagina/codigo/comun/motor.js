// ---------------------------------------------------------
// Motor de particulas (lo usan la pagina de frases y la de dibujos)
// ---------------------------------------------------------
//
// Cada particula es un punto firme de 2x2 px. En vez de dibujarlas una por
// una, se escriben todas en un solo bufer de pixeles y se pasa a pantalla de
// una vez: asi se pueden mover decenas de miles sin que la PC se ponga lenta.
// El halo de neon es una copia achicada y difuminada de los puntos que se
// suma encima.
//
// Uso:
//   const motor = crearMotor(canvas);
//   motor.fijarDestinos(n, (i) => [x, y, colorRGBA]);  // forma una figura
//   motor.dispersar();                                   // puntos sueltos
//   motor.brillo = 1.6;                                  // halo (0 = sin halo)
//   motor.efecto = EFECTO_DESARMA;                       // reaccion a la mano
//   motor.punteros = [{ x, y }, ...];                    // donde esta la mano
//   motor.bolitas = crearBolitas3D();                    // modo 3D (ver bolitas3d.js)
//
// En modo 3D, destino(i) puede devolver tambien [x, y, color, u, v, relieve]:
// u, v = centro de su pedacito de imagen; relieve = -1 adelante ... 1 atras.

const VIAJE_S = 1.4;       // segundos que tarda cada particula en llegar
const DEMORA_MAX_S = 0.6;  // no salen todas juntas: cada una espera un poco
const PUNTO_PX = 2;

// Explosion con el puno: velocidad de salida (proporcion del alto de
// pantalla por segundo) y cuanto frenan despues, ya sueltas.
const EXPLOSION = { velocidad: 2.2, freno: 2.2, deriva: 0.03 };

// Se rompe en pedazos donde pasa la mano y se vuelve a armar solo.
// radio: proporcion del alto de pantalla; fuerza: empuje; rigidez y freno:
// como vuelve cada particula a su lugar.
const EFECTO_DESARMA = { radio: 0.18, fuerza: 40000, rigidez: 30, freno: 8, azar: 0.4 };

// Modo 3D: cuanto gira la figura siguiendo la mano (radianes) y el
// balanceo suave cuando no hay mano.
const GIRO_3D = { maxY: 0.45, maxX: 0.3, balanceoY: 0.25, balanceoX: 0.12 };
// Si en 3D la PC no llega a esta cantidad de cuadros por segundo, se avisa
// a la pagina (motor.alLento) para que use menos bolitas.
const CUADROS_MINIMOS_3D = 25;

function colorRGBA(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function hexAColor(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function crearMotor(canvas) {
  const ctx = canvas.getContext("2d");
  const capa = document.createElement("canvas");
  const cctx = capa.getContext("2d");
  const halo = document.createElement("canvas");
  const hctx = halo.getContext("2d");
  const halo2 = document.createElement("canvas");
  const h2ctx = halo2.getContext("2d");

  let W = 0, H = 0, escala = 1, imgData = null, pix = null;
  let N = 0, px, py, sx, sy, tx, ty, col, dl, ox, oy, vx, vy, ref;
  // solo modo 3D: pedacito de imagen (u, v), relieve, profundidad extra al
  // explotar (zl, vz) y donde se vio cada bolita en pantalla (qx, qy)
  let uu, vv, z0, zl, vz, qx, qy, datos3d, uv3d, uvCambio = true;
  let centroX = 0, centroY = 0, giroX = 0, giroY = 0;
  let lentoDesde = 0, cuadrosLentos = 0, cuadrosMedidos = 0;
  let tViaje = 0, disperso = false, proximaDispersion = 0, quieto = false, libre = false;

  const motor = {
    brillo: 0,
    efecto: null,
    punteros: [],   // en pixeles reales de la pantalla (ver "escala")
    punto: PUNTO_PX, // lado de cada particula en pixeles reales: 1 o 2
    bolitas: null,   // modo 3D: lo que devuelve crearBolitas3D() (null = plano)
    mirar: null,     // { x, y }: hacia donde gira en 3D (si no, el primer puntero)
    alLento: null,   // funcion: la PC va lenta en 3D (conviene usar menos bolitas)
    escalaForzada: null,
    alDibujar: null, // funcion opcional para dibujar algo encima (por ejemplo, el cursor del dedo)
    get ancho() { return W; },
    get alto() { return H; },
    get escala() { return escala; },
    get cantidad() { return N; },
    // true cuando todas las particulas llegaron y ninguna esta empujada
    get quieto() { return quieto; },
    get explotado() { return libre; },
    explosion: EXPLOSION,
  };

  // El lienzo usa los pixeles REALES de la pantalla: con la escala de
  // Windows al 125 %, una pantalla 1920x1080 le dice al navegador que mide
  // 1536x864; si se dibujara a ese tamano, Windows lo estiraria y se veria
  // borroso. Por eso se multiplica por devicePixelRatio.
  function medir() {
    escala = motor.escalaForzada || window.devicePixelRatio || 1;
    W = canvas.width = capa.width = Math.round(window.innerWidth * escala);
    H = canvas.height = capa.height = Math.round(window.innerHeight * escala);
    halo.width = halo2.width = Math.max(1, W >> 2);
    halo.height = halo2.height = Math.max(1, H >> 2);
    imgData = cctx.createImageData(W, H);
    pix = new Uint32Array(imgData.data.buffer);
  }
  medir();
  motor.medir = medir;

  // cambia la cantidad de particulas conservando donde estan las que ya habia
  function reservar(n) {
    if (n === N) return;
    const viejoX = px, viejoY = py, viejoN = N;
    N = n;
    px = new Float32Array(n); py = new Float32Array(n);
    sx = new Float32Array(n); sy = new Float32Array(n);
    tx = new Float32Array(n); ty = new Float32Array(n);
    dl = new Float32Array(n); col = new Uint32Array(n); ref = new Int32Array(n);
    ox = new Float32Array(n); oy = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    uu = new Float32Array(n); vv = new Float32Array(n); z0 = new Float32Array(n);
    zl = new Float32Array(n); vz = new Float32Array(n);
    qx = new Float32Array(n); qy = new Float32Array(n);
    datos3d = new Float32Array(n * 4); uv3d = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      if (i < viejoN) { px[i] = viejoX[i]; py[i] = viejoY[i]; }
      else { px[i] = Math.random() * W; py[i] = Math.random() * H; }
    }
  }

  function iniciarViaje() {
    for (let i = 0; i < N; i++) {
      sx[i] = px[i] + ox[i]; sy[i] = py[i] + oy[i];
      ox[i] = oy[i] = vx[i] = vy[i] = 0;
      dl[i] = Math.random() * DEMORA_MAX_S;
    }
    tViaje = performance.now();
  }

  // destino(i) devuelve [x, y, color] para la particula i
  motor.fijarDestinos = (n, destino) => {
    reservar(n);
    libre = false;
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (let i = 0; i < N; i++) {
      const d = destino(i);
      tx[i] = d[0]; ty[i] = d[1]; col[i] = d[2]; ref[i] = i;
      uu[i] = d[3] || 0; vv[i] = d[4] || 0; z0[i] = d[5] || 0;
      if (i === 0 || tx[i] < minX) minX = tx[i];
      if (i === 0 || tx[i] > maxX) maxX = tx[i];
      if (i === 0 || ty[i] < minY) minY = ty[i];
      if (i === 0 || ty[i] > maxY) maxY = ty[i];
    }
    centroX = (minX + maxX) / 2; centroY = (minY + maxY) / 2;
    // baraja quien va a cada lugar, para que la llegada no se vea en barrido
    for (let i = N - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      let t = tx[i]; tx[i] = tx[j]; tx[j] = t;
      t = ty[i]; ty[i] = ty[j]; ty[j] = t;
      const c = col[i]; col[i] = col[j]; col[j] = c;
      const r = ref[i]; ref[i] = ref[j]; ref[j] = r;
      t = uu[i]; uu[i] = uu[j]; uu[j] = t;
      t = vv[i]; vv[i] = vv[j]; vv[j] = t;
      t = z0[i]; z0[i] = z0[j]; z0[j] = t;
    }
    for (let i = 0; i < N; i++) { uv3d[i * 2] = uu[i]; uv3d[i * 2 + 1] = vv[i]; qx[i] = tx[i]; qy[i] = ty[i]; }
    uvCambio = true;
    disperso = false;
    iniciarViaje();
  };

  // Cambia los colores sin mover nada (para video): colores[i] es el nuevo
  // color de la particula que fijarDestinos recibio como numero i.
  motor.recolorear = (colores) => {
    for (let i = 0; i < N; i++) col[i] = colores[ref[i]];
  };

  // Cambia el relieve sin mover nada (video en 3D): valores[i] es el relieve
  // nuevo de la particula numero i; cambia de a poco para que no tiemble.
  motor.cambiarRelieve = (valores) => {
    for (let i = 0; i < N; i++) z0[i] += (valores[ref[i]] - z0[i]) * 0.35;
  };

  function nuevosLugaresAlAzar() {
    for (let i = 0; i < N; i++) { tx[i] = Math.random() * W; ty[i] = Math.random() * H; }
    iniciarViaje();
    proximaDispersion = performance.now() + 3500;
  }

  // Explota desde (cx, cy): cada particula sale disparada hacia afuera y
  // queda flotando suelta hasta motor.rearmar().
  motor.explotar = (cx, cy) => {
    if (libre) return;
    libre = true;
    disperso = false;
    const vel = EXPLOSION.velocidad * H;
    for (let i = 0; i < N; i++) {
      px[i] += ox[i]; py[i] += oy[i];
      ox[i] = oy[i] = 0;
      let dx = px[i] - cx, dy = py[i] - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= d; dy /= d;
      // un poco de desorden en la direccion y en la fuerza
      const a = (Math.random() - 0.5) * 0.9, c = Math.cos(a), s = Math.sin(a);
      const v = vel * (0.35 + Math.random() * 0.9);
      vx[i] = (dx * c - dy * s) * v;
      vy[i] = (dx * s + dy * c) * v;
      // en 3D tambien salen hacia adelante y hacia atras
      vz[i] = motor.bolitas ? (Math.random() - 0.65) * v : 0;
    }
  };

  // vuelve a armar la figura desde donde quedo cada particula
  motor.rearmar = () => {
    if (!libre) return;
    libre = false;
    for (let i = 0; i < N; i++) vx[i] = vy[i] = vz[i] = 0;
    iniciarViaje();
  };

  motor.dispersar = () => {
    libre = false;
    if (disperso) return;
    disperso = true;
    nuevosLugaresAlAzar();
  };

  // cuantas particulas siguen fuera de su lugar (sirve para revisar que el dibujo se rearmo)
  motor.sinVolver = () => {
    let n = 0;
    for (let i = 0; i < N; i++) if (ox[i] !== 0 || oy[i] !== 0) n++;
    return n;
  };

  // ---- modo 3D: giro, perspectiva y lista para la tarjeta grafica ----
  let giroCos = [1, 0, 1, 0], foco = 1, relieve = 0, tamano3d = 0;

  function prepararGiro(t, dts) {
    const b = motor.bolitas;
    const mira = motor.mirar || motor.punteros[0];
    let objY, objX;
    if (mira) {
      objY = Math.max(-1, Math.min(1, (mira.x - centroX) / (W / 2))) * GIRO_3D.maxY;
      objX = -Math.max(-1, Math.min(1, (mira.y - centroY) / (H / 2))) * GIRO_3D.maxX;
    } else {
      objY = Math.sin(t / 1600) * GIRO_3D.balanceoY;
      objX = Math.sin(t / 2100) * GIRO_3D.balanceoX;
    }
    const suave = Math.min(1, dts * 4);
    giroY += (objY - giroY) * suave;
    giroX += (objX - giroX) * suave;
    giroCos = [Math.cos(giroY), Math.sin(giroY), Math.cos(giroX), Math.sin(giroX)];
    foco = H * 1.6;
    relieve = b.relieve * H;
    tamano3d = b.tamano;
  }

  // x, y: donde va la bolita en el plano; zExtra: lo que salio hacia adelante (negativo)
  function guardar3d(i, x, y, zExtra) {
    const cY = giroCos[0], sY = giroCos[1], cX = giroCos[2], sX = giroCos[3];
    x -= centroX; y -= centroY;
    const z = z0[i] * relieve + zExtra;
    const x2 = x * cY + z * sY, z2 = -x * sY + z * cY;
    const y2 = y * cX - z2 * sX, z3 = y * sX + z2 * cX;
    const k = foco / (foco + z3);
    const o = i * 4;
    qx[i] = datos3d[o] = centroX + x2 * k;
    qy[i] = datos3d[o + 1] = centroY + y2 * k;
    datos3d[o + 2] = Math.max(-0.99, Math.min(0.99, z3 / H));
    datos3d[o + 3] = Math.max(1, tamano3d * k);
  }

  // Mide si la PC llega a CUADROS_MINIMOS_3D en 3D; si no, avisa a la pagina
  // (como mucho una vez cada 3 segundos).
  function medirLentitud(t, dt) {
    if (!motor.bolitas || !motor.alLento) { cuadrosMedidos = cuadrosLentos = 0; return; }
    cuadrosMedidos++;
    if (dt > 1000 / CUADROS_MINIMOS_3D) cuadrosLentos++;
    if (cuadrosMedidos < 90) return;
    if (cuadrosLentos > 45 && t - lentoDesde > 3000) { lentoDesde = t; motor.alLento(); }
    cuadrosMedidos = cuadrosLentos = 0;
  }

  let anterior = performance.now();
  function cuadro(t) {
    const dt = Math.min(t - anterior, 100);
    anterior = t;
    if (disperso && t > proximaDispersion) nuevosLugaresAlAzar();
    const b3 = motor.bolitas;
    medirLentitud(t, dt);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (b3) {
      // en 3D el fondo se limpia entero: sin estela, las bolitas quedan nitidas
      ctx.fillStyle = "#000";
    } else {
      // fondo negro semitransparente: deja una estela corta al moverse
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      pix.fill(0);
    }
    ctx.fillRect(0, 0, W, H);

    const ef = motor.efecto;
    const dts = dt / 1000;
    const R = ef ? ef.radio * H : 0;
    const R2 = R * R;
    const freno = ef ? Math.exp(-ef.freno * dts) : 1;
    const punteros = motor.punteros;
    const ahoraS = (t - tViaje) / 1000;
    const uno = motor.punto === 1;
    let moviendose = 0;
    if (b3) prepararGiro(t, dts);

    if (libre) {
      // sueltas despues de explotar: frenan, flotan despacio y rebotan en los bordes
      const fr = Math.exp(-EXPLOSION.freno * dts), der = EXPLOSION.deriva * H;
      for (let i = 0; i < N; i++) {
        vx[i] = vx[i] * fr + (Math.random() - 0.5) * der;
        vy[i] = vy[i] * fr + (Math.random() - 0.5) * der;
        px[i] += vx[i] * dts; py[i] += vy[i] * dts;
        if (px[i] < 0) { px[i] = 0; vx[i] = Math.abs(vx[i]); } else if (px[i] > W - 2) { px[i] = W - 2; vx[i] = -Math.abs(vx[i]); }
        if (py[i] < 0) { py[i] = 0; vy[i] = Math.abs(vy[i]); } else if (py[i] > H - 2) { py[i] = H - 2; vy[i] = -Math.abs(vy[i]); }
        if (b3) {
          vz[i] *= fr;
          zl[i] = Math.max(-H * 0.6, Math.min(H * 1.5, zl[i] + vz[i] * dts));
          guardar3d(i, px[i], py[i], zl[i]);
          continue;
        }
        const o = ((py[i] + 0.5) | 0) * W + ((px[i] + 0.5) | 0), c = col[i];
        if (uno) pix[o] = c;
        else { pix[o] = c; pix[o + 1] = c; pix[o + W] = c; pix[o + W + 1] = c; }
      }
      moviendose = 1;
    }

    const vuelveZ = Math.exp(-4 * dts);
    for (let i = 0; i < (libre ? 0 : N); i++) {
      // viaje con llegada exacta (curva suave que frena al final)
      let u = (ahoraS - dl[i]) / VIAJE_S;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (u < 1) moviendose++;
      const e = 1 - (1 - u) * (1 - u) * (1 - u);
      px[i] = sx[i] + (tx[i] - sx[i]) * e;
      py[i] = sy[i] + (ty[i] - sy[i]) * e;
      let fx = px[i], fy = py[i];

      if (ef) {
        // empuje de cada dedo + resorte que devuelve la particula a su lugar
        // (en 3D se mide desde donde se ve la bolita, ya girada)
        const vistaX = b3 ? qx[i] : fx + ox[i], vistaY = b3 ? qy[i] : fy + oy[i];
        for (let k = 0; k < punteros.length; k++) {
          const ddx = vistaX - punteros[k].x, ddy = vistaY - punteros[k].y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2), f = (ef.fuerza * (1 - d / R) * dts) / d;
            vx[i] += ddx * f + (Math.random() - 0.5) * ef.fuerza * ef.azar * dts;
            vy[i] += ddy * f + (Math.random() - 0.5) * ef.fuerza * ef.azar * dts;
          }
        }
        if (vx[i] !== 0 || vy[i] !== 0 || ox[i] !== 0 || oy[i] !== 0) {
          vx[i] = (vx[i] - ox[i] * ef.rigidez * dts) * freno;
          vy[i] = (vy[i] - oy[i] * ef.rigidez * dts) * freno;
          ox[i] += vx[i] * dts; oy[i] += vy[i] * dts;
          // ya volvio: se deja quieta para que quede nitida
          if (Math.abs(ox[i]) < 0.7 && Math.abs(oy[i]) < 0.7 && Math.abs(vx[i]) < 10 && Math.abs(vy[i]) < 10) {
            ox[i] = oy[i] = vx[i] = vy[i] = 0;
          }
          fx += ox[i]; fy += oy[i];
          moviendose++;
        }
      }

      if (b3) {
        // al rearmarse, lo que salio hacia adelante o atras vuelve de a poco
        if (zl[i] !== 0) { zl[i] *= vuelveZ; if (Math.abs(zl[i]) < 0.5) zl[i] = 0; else moviendose++; }
        // lo que empuja el dedo salta hacia adelante
        const empuje = ox[i] !== 0 || oy[i] !== 0 ? Math.sqrt(ox[i] * ox[i] + oy[i] * oy[i]) * 0.8 : 0;
        guardar3d(i, fx, fy, zl[i] - empuje);
        continue;
      }

      const X = (fx + 0.5) | 0, Y = (fy + 0.5) | 0;
      if (X < 0 || Y < 0 || X >= W - 1 || Y >= H - 1) continue;
      const o = Y * W + X, c = col[i];
      if (uno) pix[o] = c;
      else { pix[o] = c; pix[o + 1] = c; pix[o + W] = c; pix[o + W + 1] = c; }
    }
    quieto = !disperso && moviendose === 0;

    // lo que se dibujo (puntos planos o bolitas 3D) queda en "fuente"
    let fuente = capa;
    if (b3) {
      b3.dibujar(W, H, datos3d || new Float32Array(0), N, b3.textura ? uv3d : null, uvCambio, col || new Uint32Array(0));
      uvCambio = false;
      fuente = b3.lienzo;
    } else {
      cctx.putImageData(imgData, 0, 0);
    }
    ctx.drawImage(fuente, 0, 0);

    if (motor.brillo > 0) {
      // halo: lo mismo achicado y difuminado, sumado encima
      hctx.clearRect(0, 0, halo.width, halo.height);
      hctx.drawImage(fuente, 0, 0, halo.width, halo.height);
      h2ctx.clearRect(0, 0, halo2.width, halo2.height);
      h2ctx.filter = "blur(2px)";
      h2ctx.drawImage(halo, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      // en 3D el halo va a la mitad para que se sigan viendo la luz y la sombra de cada bolita
      for (let b = motor.brillo * (b3 ? 0.5 : 1); b > 0; b -= 1) {
        ctx.globalAlpha = Math.min(1, b);
        ctx.drawImage(halo2, 0, 0, W, H);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    if (motor.alDibujar) motor.alDibujar(ctx);
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  return motor;
}
