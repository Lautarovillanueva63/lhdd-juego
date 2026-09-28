# La gira de LHDD

Jueguito runner de Los Hijos del Dueño. HTML, CSS y JavaScript puro: no necesita instalar nada.

## Correrlo en VS Code
1. Abrí la carpeta `lhdd-juego` en VS Code.
2. Instalá la extensión **Live Server** (de Ritwick Dey).
3. Click derecho en `index.html` → **Open with Live Server**.

## Estructura
- `index.html` — las pantallas (título, elegir músico, elegir tema, pausa, final).
- `css/style.css` — estilos de los menús.
- `js/game.js` — todo el juego: config de músicos y temas arriba, después física, niveles, dibujo y loop.
- `js/charts.js` — beats y energía de cada tema (lo genera el script de `herramientas`).
- `assets/caras` y `assets/temas` — fotos recortadas y MP3.
- `herramientas/analizar_temas.py` — analiza los MP3 y regenera `charts.js`.

## Publicarlo en GitHub Pages
    git init
    git add .
    git commit -m "Primer versión del juego"
    git branch -M main
    git remote add origin https://github.com/lautarovillanueva63/lhdd-juego.git
    git push -u origin main

Después, en el repo: Settings → Pages → Branch `main`, carpeta `/ (root)` → Save.
En un par de minutos queda en https://lautarovillanueva63.github.io/lhdd-juego/
