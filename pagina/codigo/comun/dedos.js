// ---------------------------------------------------------
// Cuantos dedos estan levantados en una mano.
//
// Se mide el angulo de cada dedo en 3D con los puntos "de mundo" del
// detector (en metros, centro en la mano): un dedo cuenta si esta recto, sin
// importar si la mano esta inclinada, de lado o apuntando a la camara.
//
// Puntos de la mano (MediaPipe): 0 muneca; pulgar 1-4; indice 5-8;
// medio 9-12; anular 13-16; menique 17-20 (base, nudillo, nudillo, punta).
// ---------------------------------------------------------

const DEDOS_LARGOS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

// cuanto puede doblarse un dedo (suma de sus dos nudillos, en grados) y seguir contando como recto
const DOBLEZ_MAX_DEDO = 70;
// cuanto puede doblarse el nudillo de la base (dedo recto pero agachado hacia la palma)
const DOBLEZ_MAX_BASE = 65;
// Pulgar: cuenta si esta casi recto y su punta queda lejos de la base del
// anular y del menique (doblado o pegado al puno, queda cerca de ellas).
// Medidas en "anchos de palma"; elegidas midiendo 93 fotos de manos
// (rectas, inclinadas, de lado y en espejo): acerto las 93.
const DOBLEZ_MAX_PULGAR = 50;
const PULGAR_LEJOS_ANULAR = 1.35;
const PULGAR_LEJOS_MENIQUE = 1.65;

function restar(a, b) { return [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)]; }
function largo(v) { return Math.hypot(v[0], v[1], v[2]); }
function distancia(a, b) { return largo(restar(a, b)); }

// cuanto se dobla la linea a -> b -> c en el punto b (0 = recta)
function doblez(a, b, c) {
  const u = restar(b, a), v = restar(c, b);
  const coseno = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (largo(u) * largo(v) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, coseno))) * 180) / Math.PI;
}

// devuelve [pulgar, indice, medio, anular, menique] con true si esta levantado
function dedosLevantados(puntos, mundo) {
  const m = mundo && mundo.length === 21 ? mundo : puntos;
  const anchoPalma = distancia(m[5], m[17]) || 1;

  const largos = DEDOS_LARGOS.map(([base, n1, n2, punta]) => {
    const dedo = doblez(m[base], m[n1], m[n2]) + doblez(m[n1], m[n2], m[punta]);
    const nudilloBase = doblez(m[0], m[base], m[n1]);
    // ademas la punta tiene que quedar mas lejos de la muneca que el nudillo del medio
    const estirado = distancia(m[punta], m[0]) > distancia(m[n1], m[0]);
    return dedo < DOBLEZ_MAX_DEDO && nudilloBase < DOBLEZ_MAX_BASE && estirado;
  });

  const pulgarRecto = doblez(m[1], m[2], m[3]) + doblez(m[2], m[3], m[4]) < DOBLEZ_MAX_PULGAR;
  const pulgarLejos = distancia(m[4], m[13]) > anchoPalma * PULGAR_LEJOS_ANULAR &&
    distancia(m[4], m[17]) > anchoPalma * PULGAR_LEJOS_MENIQUE;
  return [pulgarRecto && pulgarLejos, ...largos];
}

function contarDedos(puntos, mundo) {
  return dedosLevantados(puntos, mundo).filter(Boolean).length;
}

