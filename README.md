# Juegos de LHDD

Dos jueguitos de Los Hijos del Dueño: **La gira de LHDD** (runner) y **Buscando algún lío** (arcade estilo Pac-Man, en la carpeta `lio/`). HTML, CSS y JavaScript puro: no necesita instalar nada.

## Correrlo en VS Code
1. Abrí la carpeta `lhdd-juego` en VS Code.
2. Instalá la extensión **Live Server** (de Ritwick Dey).
3. Click derecho en `index.html` → **Open with Live Server**.

## Estructura
- `index.html` — las pantallas (título, elegir músico, elegir tema, pausa, final).
- `css/style.css` — estilos de los menús.
- `js/game.js` — todo el juego: config de músicos y temas arriba, después física, niveles, dibujo y loop.
- `js/charts.js` — beats y energía de cada tema (lo genera el script de `herramientas`).
- `lio/` — el juego "Buscando algún lío": `index.html` (pantallas), `lio.css` (estilos extra) y `lio.js` (todo el juego: mapas, IA de enemigos, dibujo).
- `assets/caras` — caras recortadas sin fondo (las genera `herramientas/recortar_caras.py`).
- `assets/caras_originales` — las fotos de antes, con el círculo. El script lee de acá.
- `assets/temas` — los MP3.
- `herramientas/analizar_temas.py` — analiza los MP3 y regenera `charts.js`.
- `herramientas/recortar_caras.py` — saca el fondo de las fotos y deja solo la cara.

## Cambiar o agregar un nivel de "Buscando algún lío"
En `lio/lio.js`, buscá `LEVELS`. Cada mapa es una grilla de 24x12 letras:
`#` pared, `T` árbol, `.` púa, `o` vinilo, `P` jugador, `V` Doña Rosa, `C` el cana, `D` Firulais.

## Publicarlo en GitHub Pages
    git init
    git add .
    git commit -m "Primera versión del juego"
    git branch -M main
    git remote add origin https://github.com/lautarovillanueva63/lhdd-juego.git
    git push -u origin main

Después, en el repo: Settings → Pages → Branch `main`, carpeta `/ (root)` → Save.
En un par de minutos queda en https://lautarovillanueva63.github.io/lhdd-juego/

El juego nuevo queda en https://lautarovillanueva63.github.io/lhdd-juego/lio/
