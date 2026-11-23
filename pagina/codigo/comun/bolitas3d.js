// ---------------------------------------------------------
// Modo 3D: las particulas se dibujan como bolitas con volumen (luz,
// brillo y sombra) usando la tarjeta grafica (WebGL).
// ---------------------------------------------------------
//
// Con imagen o video, cada bolita muestra su pedacito de la imagen original
// (por eso se ve igual de nitida); con las frases, cada bolita tiene su color.
// El motor (motor.js) calcula donde va cada bolita y le pasa la lista; aqui
// solo se dibuja.
//
// Uso:
//   prepararBoton3D(motor, alCambiar);  // boton "3D" de la barra de abajo

const MODO3D_STORAGE_KEY = "senati_particulas_3d_v1";

function crearBolitas3D() {
  const lienzo = document.createElement("canvas");
  const gl = lienzo.getContext("webgl", { antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  function shader(tipo, codigo) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, codigo);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, `
    attribute vec4 aPos;   // x, y (pixeles), profundidad (-1 a 1), tamano (pixeles)
    attribute vec2 aUV;    // centro de su pedacito de imagen
    attribute vec4 aCol;   // color propio (frases)
    uniform vec2 uTam;
    uniform float uSombra;
    varying vec2 vUV;
    varying vec4 vCol;
    void main() {
      vUV = aUV;
      vCol = aCol;
      // la sombra va un poco abajo a la derecha y detras de todo
      vec2 p = aPos.xy + uSombra * aPos.w * vec2(0.22, 0.32);
      gl_Position = vec4(p.x / uTam.x * 2.0 - 1.0, 1.0 - p.y / uTam.y * 2.0, uSombra > 0.5 ? 0.999 : aPos.z, 1.0);
      gl_PointSize = aPos.w * (1.0 + uSombra * 0.25);
    }`));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec2 vUV;
    varying vec4 vCol;
    uniform sampler2D uTex;
    uniform vec2 uCelda;
    uniform float uConTextura;
    uniform float uSombraF;
    void main() {
      vec2 q = gl_PointCoord * 2.0 - 1.0;
      float r2 = dot(q, q);
      if (r2 > 1.0) discard;
      if (uSombraF > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - r2) * 0.6); return; }
      vec4 col = uConTextura > 0.5 ? texture2D(uTex, vUV + (gl_PointCoord - 0.5) * uCelda) : vCol;
      if (col.a < 0.15) discard;
      // luz desde arriba a la izquierda: claro arriba, borde mas oscuro y un brillito
      vec3 n = vec3(q.x, -q.y, sqrt(1.0 - r2));
      vec3 L = normalize(vec3(-0.5, 0.6, 0.8));
      float dif = 0.62 + 0.5 * max(dot(n, L), 0.0);
      float borde = smoothstep(1.0, 0.55, r2) * 0.35 + 0.65;
      float esp = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0) * 0.5;
      gl_FragColor = vec4(col.rgb * dif * borde + esp, 1.0);
    }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const bPos = gl.createBuffer(), bUV = gl.createBuffer(), bCol = gl.createBuffer();
  const aPos = gl.getAttribLocation(prog, "aPos");
  const aUV = gl.getAttribLocation(prog, "aUV");
  const aCol = gl.getAttribLocation(prog, "aCol");
  const u = (n) => gl.getUniformLocation(prog, n);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let fuente = null; // <img>, <video> o null (bolitas de color)

  const b = {
    lienzo,
    tamano: 8,              // diametro de cada bolita en pixeles reales
    relieve: 0.1,           // cuanto sale hacia adelante lo claro (parte del alto)
    celda: [0, 0],          // tamano del pedacito de imagen de cada bolita (0 a 1)
    get textura() { return fuente; },
    set textura(f) {
      fuente = f;
      if (f && !(f instanceof HTMLVideoElement)) subirTextura();
    },
  };

  function subirTextura() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
  }

  // datos: Float32Array con [x, y, profundidad, tamano] por bolita
  // uv: Float32Array con [u, v] por bolita (o null); colores: Uint32Array RGBA
  b.dibujar = (W, H, datos, n, uv, uvCambio, colores) => {
    if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
    const conTextura = !!fuente && !!uv;
    if (conTextura && fuente instanceof HTMLVideoElement && fuente.readyState >= 2) subirTextura();

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!n) return;
    gl.useProgram(prog);
    gl.uniform2f(u("uTam"), W, H);
    gl.uniform2f(u("uCelda"), b.celda[0], b.celda[1]);
    gl.uniform1f(u("uConTextura"), conTextura ? 1 : 0);
    gl.uniform1i(u("uTex"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
    gl.bufferData(gl.ARRAY_BUFFER, datos.subarray(0, n * 4), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bUV);
    if (uv && uvCambio) gl.bufferData(gl.ARRAY_BUFFER, uv.subarray(0, n * 2), gl.STATIC_DRAW);
    if (uv) { gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0); }
    else { gl.disableVertexAttribArray(aUV); gl.vertexAttrib2f(aUV, 0, 0); }

    gl.bindBuffer(gl.ARRAY_BUFFER, bCol);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colores.buffer, 0, n * 4), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    // 1) sombras suaves debajo de todo
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(u("uSombra"), 1);
    gl.uniform1f(u("uSombraF"), 1);
    gl.drawArrays(gl.POINTS, 0, n);
    // 2) bolitas encima: las de adelante tapan a las de atras
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.uniform1f(u("uSombra"), 0);
    gl.uniform1f(u("uSombraF"), 0);
    gl.drawArrays(gl.POINTS, 0, n);
  };

  return b;
}

// Boton "3D" de la barra de abajo: prende y apaga el modo 3D y recuerda
// la ultima eleccion. alCambiar() vuelve a armar la frase o el dibujo.
function prepararBoton3D(motor, alCambiar) {
  const boton = document.getElementById("boton3d");
  let bolitas;
  try { bolitas = crearBolitas3D(); } catch (e) { bolitas = null; }
  if (!bolitas) {
    boton.disabled = true;
    boton.title = "Este navegador no puede mostrar 3D (no tiene WebGL)";
    return;
  }

  function poner(encendido) {
    motor.bolitas = encendido ? bolitas : null;
    boton.classList.toggle("encendido", encendido);
    boton.setAttribute("aria-pressed", encendido ? "true" : "false");
    boton.title = encendido ? "Volver a las particulas planas" : "Ver en 3D (bolitas con volumen)";
    try { localStorage.setItem(MODO3D_STORAGE_KEY, encendido ? "1" : "0"); } catch (e) { /* sin guardar */ }
  }

  boton.addEventListener("click", () => {
    poner(!motor.bolitas);
    alCambiar();
  });

  let guardado = false;
  try { guardado = localStorage.getItem(MODO3D_STORAGE_KEY) === "1"; } catch (e) { /* sin guardar */ }
  poner(guardado);
  // si quedo guardado en 3D, se vuelve a armar lo que ya se estaba mostrando
  if (guardado) alCambiar();
}
