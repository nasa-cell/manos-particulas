# Manos partículas

**Pruébalo en vivo:** https://manos-particulas.onrender.com

Página web que usa la cámara para ver tus manos y mueve miles de partículas de colores:

- **Frases:** muestra de 1 a 10 dedos (con una o dos manos) y las partículas forman la frase de ese número, con letras de neón.
- **Dibujos y videos:** las partículas pintan una imagen o un video (por ejemplo un TikTok) con sus colores reales. Pasa el dedo índice por encima y se rompe; después se vuelve a armar solo.
- **Puño:** cierra la mano y todo explota. Al abrirla se vuelve a armar. La tecla **Espacio** hace lo mismo sin cámara.

La detección de manos corre en el navegador con MediaPipe. La cámara no se graba ni se envía a ningún lado.

## Cómo se usa

| Página | Qué hacer |
|---|---|
| Frases (inicio) | Muestra dedos. Abajo están los botones de tamaño de letra, brillo, cantidad de líneas, colores (☰) y editar frases (✎). |
| Dibujos (botón 🖼) | Pasa el dedo índice por la imagen. Con 🖼 subes otra imagen o video, o lo arrastras a la pantalla. ⏸ pausa el video y 🔊 activa el sonido. |

Lo que eliges (frases, colores, tamaño, el último dibujo o video) queda guardado en tu navegador.

## Abrirlo en tu PC

Haz doble clic en `Abrir particulas.bat`. Necesita Python instalado. Abre la página en `http://localhost:8000`.

No funciona abriendo `index.html` con doble clic, porque el navegador no permite usar la cámara desde un archivo suelto.

## Carpetas

```
pagina/                      todo lo que se publica
├─ index.html                página de frases
├─ dibujo.html               página de dibujos y videos
├─ estilos/estilos.css       colores, botones y paneles
├─ codigo/
│  ├─ comun/
│  │  ├─ motor.js            mueve y dibuja las partículas (sirve a las dos páginas)
│  │  ├─ camara.js           cámara, esqueleto de la mano y botones de cámara
│  │  ├─ dedos.js            cuenta los dedos por el ángulo de cada dedo en 3D
│  │  └─ detector.js         detector de manos en un hilo aparte
│  ├─ frases/
│  │  ├─ frases.js           frases, colores y frase → partículas
│  │  ├─ texto.js            letra, tamaño y reparto en líneas
│  │  ├─ gestos.js           dedos → frase, puño → explosión
│  │  └─ paneles.js          botones y paneles de la página
│  └─ dibujo/
│     ├─ dibujo.js           imagen → partículas, dedo que rompe, tamaño
│     ├─ video.js            video → partículas, pausa, sonido, guardado
│     └─ puno.js             puño y tecla Espacio → explosión
├─ librerias/mediapipe/      librería de detección de manos (copia local)
└─ imagenes/                 imagen de ejemplo
Abrir particulas.bat         abre la página en tu PC
```

La imagen de ejemplo es fan art de *Gotoubun no Hanayome* y pertenece a sus autores.
