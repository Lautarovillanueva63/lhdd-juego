// =====================================================================
//  BUSCANDO ALGÚN LÍO — arcade con vista de arriba (estilo Pac-Man)
//  Todo el juego vive en este archivo. Está ordenado de arriba hacia abajo:
//  config → mapa (grilla) → movimiento → IA de enemigos → reglas → dibujo → loop
// =====================================================================

// ---------------------------------------------------------------------
//  CONFIG — acá se cambian nombres, habilidades, enemigos y niveles
// ---------------------------------------------------------------------
const CHARS = [
  { id:'keys', name:'Agus',    inst:'Teclado',   skill:'Imán de púas',  desc:'Juntás las púas que tenés cerca sin pasar por encima.', color:'#3fd0c9' },
  { id:'bass', name:'Chanchi', inst:'Bajo',      skill:'Vida extra',    desc:'Arrancás con 4 vidas.',                                 color:'#ffb627' },
  { id:'gtr1', name:'Gaspi',   inst:'Guitarra',  skill:'Patas rápidas', desc:'Corrés un 15% más rápido.',                             color:'#ff4f79' },
  { id:'gtr2', name:'Fran',    inst:'Guitarra',  skill:'Púas dobles',   desc:'Cada púa suma el doble.',                               color:'#a58bff' },
  { id:'voz',  name:'Mezita',  inst:'Micrófono', skill:'Grito',         desc:'Con espacio (o el botón) paralizás a los que tenés cerca.', color:'#7ee081' },
];

// Cada enemigo tiene una forma distinta de elegir a dónde ir (su "target").
// speed está en casillas por segundo. wait = segundos que tarda en salir.
const ENEMIES = {
  V: { name:'Doña Rosa', speed:3.6, wait:1, target:'directo',  says:'¡Silencio!'   },
  C: { name:'El cana',   speed:4.1, wait:4, target:'adelante', says:'¡Documentos!' },
  D: { name:'Firulais',  speed:4.6, wait:7, target:'olfato',   says:'¡Guau!'       },
};

// LOS MAPAS SON GRILLAS: un array de strings, donde cada letra es una casilla.
//   #  pared / edificio        T  árbol (también es pared)
//   .  calle con púa           o  calle con vinilo (power-up)
//   P  donde arranca el músico V C D  donde arranca cada enemigo
//   (espacio) calle vacía
// Todas las filas tienen que tener 24 letras y tiene que haber 12 filas.
const LEVELS = [
  { song:'cuadra', title:'La cuadra de mi casa', light:'#ffb627', scared:7,
    desc:'Arrancamos tranqui: la cuadra de siempre. Juntá todas las púas antes de que Doña Rosa llame a la cana.',
    map:[
      "########################",
      "#o.........##.........o#",
      "#.###.####.##.####.###.#",
      "#.###.####.##.####.###.#",
      "#..........V...........#",
      "#.###.##.######.##.###.#",
      "#.....##...CD...##.....#",
      "###.#.##.######.##.#.###",
      "#...#..............#...#",
      "#.#####.###.##.###.###.#",
      "#o.........P..........o#",
      "########################"] },
  { song:'lio', title:'Buscando algún lío', light:'#ff7a3d', scared:6,
    desc:'Te fuiste al centro. Más esquinas, más lío. El cana ya sabe para dónde vas.',
    map:[
      "########################",
      "#o.........##.........o#",
      "#.####.###.##.###.####.#",
      "#.####.###....###.####.#",
      "#......###.##.###......#",
      "###.##.....V......##.###",
      "###.##.###.CD.###.##.###",
      "#......###.##.###......#",
      "#.####.###.##.###.####.#",
      "#.####.....##.....####.#",
      "#o.........P..........o#",
      "########################"] },
  { song:'criticar', title:'Por criticar', light:'#ff4f79', scared:5,
    desc:'Última parada: la plaza. Todos te critican y están más rápidos que nunca.',
    map:[
      "########################",
      "#o.....#........#.....o#",
      "#.####.#.######.#.####.#",
      "#......................#",
      "#.##.###.T.TT.T.###.##.#",
      "#.##.....T.VC.T.....##.#",
      "#.##.###.T..D.T.###.##.#",
      "#..........TT..........#",
      "#.####.#.######.#.####.#",
      "#......#...P....#......#",
      "#o####...######...####o#",
      "########################"] },
];

// ---------------------------------------------------------------------
//  CONSTANTES DE PANTALLA (coordenadas lógicas 960x540)
// ---------------------------------------------------------------------
const W = 960, H = 540, HUD = 60;      // arriba hay 60px para puntaje y vidas
const COLS = 24, ROWS = 12, T = 40;    // 24x12 casillas de 40px = 960x480
const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d');
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const facePath = id => `../assets/caras/${id}.png`;
const audioUrl = id => `../assets/temas/${id}.mp3`;
const faces = {};
for (const c of CHARS){ const im = new Image(); im.src = facePath(c.id); faces[c.id] = im; }

// Generador de números al azar "con semilla": siempre da la misma secuencia
// para el mismo texto. Sirve para que los techos salgan iguales cada vez.
function rng(seedStr){ let h = 1779033703; for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
  return () => { h = Math.imul(h ^ h>>>16, 2246822507); h = Math.imul(h ^ h>>>13, 3266489909); return ((h ^= h>>>16) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------------
//  LA GRILLA
// ---------------------------------------------------------------------
let map = [];   // array de arrays: map[fila][columna] = letra
const isWall = (x, y) => { const r = map[y]; if (!r) return true; const c = r[x]; return c === undefined || c === '#' || c === 'T'; };
// Las 4 direcciones posibles. dx/dy dicen cuánto cambia la columna/fila.
const DIRS = [{dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1}];
// De casilla a píxel: el centro de la casilla (x, y)
const px = x => x * T + T/2;
const py = y => HUD + y * T + T/2;

// ---------------------------------------------------------------------
//  PANTALLAS
// ---------------------------------------------------------------------
let state = 'menu', char = null, audio = null, g = null;
const screens = [...document.querySelectorAll('.screen')];
function show(id){
  screens.forEach(s => s.hidden = s.id !== id);
  $('#b-pause').hidden = true; $('#b-skill').hidden = true;
  const first = id && $('#'+id+' button'); if (first) first.focus({preventScroll:true});
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { stopAudio(); state = 'menu'; show(b.dataset.go); });

$('#lineup').innerHTML = CHARS.map(c => `<img src="${facePath(c.id)}" alt="${c.name}">`).join('');
$('#b-start').onclick = () => show('s-chars');
$('#cards').innerHTML = CHARS.map(c => `
  <button class="card" style="--c:${c.color}" data-id="${c.id}">
    <img src="${facePath(c.id)}" alt="">
    <b>${c.name}</b><span>${c.inst}</span><em>${c.skill}</em><span>${c.desc}</span>
  </button>`).join('');
document.querySelectorAll('.card').forEach(b => b.onclick = () => {
  char = CHARS.find(c => c.id === b.dataset.id); newRun();
});

// ---------------------------------------------------------------------
//  PARTIDA → NIVEL
// ---------------------------------------------------------------------
// Una "partida" son los 3 niveles seguidos. El puntaje y las vidas se arrastran.
function newRun(){
  const lives = char.id === 'bass' ? 4 : 3;
  g = { lvl:0, score:0, lives, maxLives:lives, eaten:0, parts:[], texts:[], shake:0 };
  showLevelIntro();
}
function showLevelIntro(){
  const L = LEVELS[g.lvl];
  $('#lvl-num').textContent = `Nivel ${g.lvl + 1} de ${LEVELS.length}`;
  $('#lvl-title').textContent = L.title;
  $('#lvl-desc').textContent = L.desc;
  state = 'menu'; show('s-level');
}
$('#b-go').onclick = () => startLevel(g.lvl);

function startLevel(i){
  const L = LEVELS[i];
  // Copiamos el mapa a un array de arrays (los strings no se pueden modificar letra por letra)
  map = L.map.map(row => row.split(''));
  g.start = null; g.spawns = []; g.left = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    const c = map[y][x];
    if (c === 'P'){ g.start = {x, y}; map[y][x] = ' '; }
    else if (ENEMIES[c]){ g.spawns.push({x, y, kind:c}); map[y][x] = ' '; }
    else if (c === '.') g.left++;
  }
  const speedUp = 1 + 0.07 * i;  // cada nivel los enemigos van un 7% más rápido
  g.player = { x:g.start.x, y:g.start.y, dx:0, dy:0, want:null, face:1, walk:0, inv:0,
               speed: char.id === 'gtr1' ? 6.0 : 5.2 };
  g.enemies = g.spawns.map(s => ({ ...ENEMIES[s.kind], kind:s.kind, home:{x:s.x, y:s.y}, x:s.x, y:s.y,
               dx:0, dy:0, base:ENEMIES[s.kind].speed * speedUp, wait:ENEMIES[s.kind].wait,
               sc:false, stun:0, sayT:0, sayCd:2, wander:null }));
  g.scared = 0; g.chain = 0; g.skillCd = 0;
  g.phase = 'ready'; g.timer = 1.8;    // "¡Listos!" antes de arrancar
  g.light = L.light; g.song = L.song; g.beat = 0; g.pulse = 0;
  buildMapLayer();

  stopAudio();
  audio = new Audio(audioUrl(L.song)); audio.loop = true; audio.volume = .8;
  screens.forEach(s => s.hidden = true);
  $('#b-pause').hidden = false;
  if (char.id === 'voz') $('#b-skill').hidden = false;
  state = 'playing';
  audio.play().catch(() => pause());
}
function stopAudio(){ if (audio){ audio.pause(); audio = null; } }

// Vuelve a todos a su lugar (cuando te agarran). Las púas que juntaste quedan juntadas.
function resetPositions(){
  const p = g.player;
  Object.assign(p, { x:g.start.x, y:g.start.y, dx:0, dy:0, want:null, inv:1.5 });
  g.enemies.forEach((e, k) => Object.assign(e, { x:e.home.x, y:e.home.y, dx:0, dy:0, sc:false, stun:0, wait:1 + k * 1.5 }));
  g.scared = 0; g.phase = 'ready'; g.timer = 1.2;
}

// ---------------------------------------------------------------------
//  MOVIMIENTO POR CASILLAS
// ---------------------------------------------------------------------
// Los personajes viajan de centro de casilla a centro de casilla.
// Solo pueden doblar cuando están JUSTO en un centro: ahí se llama a `turn`,
// que decide la nueva dirección. Así nadie queda "a medio camino" metido en una pared.
function step(e, dist, turn){
  while (dist > 0){
    if (e.dx === 0 && e.dy === 0){ turn(e); if (e.dx === 0 && e.dy === 0) return; }
    // ¿Cuál es el próximo centro en la dirección en la que voy?
    const tx = e.dx > 0 ? Math.floor(e.x + 1e-6) + 1 : e.dx < 0 ? Math.ceil(e.x - 1e-6) - 1 : e.x;
    const ty = e.dy > 0 ? Math.floor(e.y + 1e-6) + 1 : e.dy < 0 ? Math.ceil(e.y - 1e-6) - 1 : e.y;
    const falta = Math.abs(tx - e.x) + Math.abs(ty - e.y);
    if (dist < falta){ e.x += e.dx * dist; e.y += e.dy * dist; return; }  // no llego: avanzo y listo
    e.x = tx; e.y = ty; dist -= falta;                                     // llego justo al centro
    turn(e);                                                               // decido para dónde sigo
  }
}

// El jugador "guarda" la última flecha que apretaste (want) y dobla apenas puede.
// Eso se llama input buffering: podés apretar la flecha un poquito antes de la esquina.
function playerTurn(p){
  if (p.want && !isWall(p.x + p.want.dx, p.y + p.want.dy)){ p.dx = p.want.dx; p.dy = p.want.dy; }
  else if (isWall(p.x + p.dx, p.y + p.dy)){ p.dx = 0; p.dy = 0; }  // pared adelante: frena
}
function setWant(dx, dy){
  if (!g || !g.player) return;
  const p = g.player; p.want = {dx, dy};
  // Darse vuelta se permite en cualquier momento, no hace falta esperar al centro
  if (p.dx === -dx && p.dy === -dy && (dx || dy)){ p.dx = dx; p.dy = dy; }
}

// ---------------------------------------------------------------------
//  IA DE LOS ENEMIGOS (la misma idea que los fantasmas de Pac-Man)
// ---------------------------------------------------------------------
// En cada esquina, el enemigo mira las casillas a las que puede ir (sin volver para atrás)
// y elige la que lo deja MÁS CERCA de su objetivo. Si está asustado, elige la que lo deja MÁS LEJOS.
// La gracia está en que cada uno tiene un objetivo distinto:
function targetOf(e){
  const p = g.player, px0 = Math.round(p.x), py0 = Math.round(p.y);
  if (e.target === 'adelante')        // el cana te intercepta: apunta 4 casillas delante tuyo
    return [px0 + p.dx * 4, py0 + p.dy * 4];
  if (e.target === 'olfato'){         // el perro pasea, pero si te huele (a menos de 6) te corre
    if (Math.hypot(p.x - e.x, p.y - e.y) < 6) return [px0, py0];
    if (!e.wander || (Math.round(e.x) === e.wander[0] && Math.round(e.y) === e.wander[1])) e.wander = randomStreet();
    return e.wander;
  }
  return [px0, py0];                  // Doña Rosa va derecho hacia vos
}
function randomStreet(){
  for (;;){ const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS); if (!isWall(x, y)) return [x, y]; }
}
function enemyTurn(e){
  const goingBack = d => (e.dx || e.dy) && d.dx === -e.dx && d.dy === -e.dy;
  let opts = DIRS.filter(d => !isWall(e.x + d.dx, e.y + d.dy) && !goingBack(d));
  if (!opts.length) opts = DIRS.filter(d => !isWall(e.x + d.dx, e.y + d.dy));   // callejón: no queda otra que volver
  if (!opts.length){ e.dx = e.dy = 0; return; }
  const [tx, ty] = targetOf(e);
  let best = opts[0], bestScore = Infinity;
  for (const d of opts){
    const dist = Math.hypot(e.x + d.dx - tx, e.y + d.dy - ty);
    const score = (e.sc ? -dist : dist) + Math.random() * 0.4;  // un poquito de azar para que no sean robots
    if (score < bestScore){ bestScore = score; best = d; }
  }
  e.dx = best.dx; e.dy = best.dy;
}

// ---------------------------------------------------------------------
//  REGLAS DEL JUEGO
// ---------------------------------------------------------------------
function collectAt(x, y){
  const c = map[y] && map[y][x];
  if (c === '.'){
    map[y][x] = ' '; g.left--;
    g.score += 10 * (char.id === 'gtr2' ? 2 : 1);
    burst(px(x), py(y), '#ffb627', 5);
  } else if (c === 'o'){
    map[y][x] = ' '; g.score += 50;
    // ¡VINILO! Se dan vuelta las cosas: los enemigos se asustan y se dan media vuelta
    g.scared = LEVELS[g.lvl].scared; g.chain = 0;
    for (const e of g.enemies){ e.sc = true; e.dx = -e.dx; e.dy = -e.dy; }
    burst(px(x), py(y), '#fff4dc', 16);
    popText(px(x), py(y) - 20, '¡A correrlos!', '#fff4dc');
  }
}

function skill(){
  if (state !== 'playing' || g.phase !== 'run' || char.id !== 'voz' || g.skillCd > 0) return;
  g.skillCd = 8; g.shake = 6;
  const p = g.player;
  burst(px(p.x), py(p.y), '#7ee081', 24);
  popText(px(p.x), py(p.y) - 34, '¡AAAAH!', '#7ee081');
  for (const e of g.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 4) e.stun = 2.5;
}

function eat(e){
  const pts = 200 * Math.pow(2, Math.min(g.chain, 3)); g.chain++; g.eaten++;
  g.score += pts;
  popText(px(e.x), py(e.y) - 20, '+' + pts, '#ffb627');
  burst(px(e.x), py(e.y), '#a58bff', 14);
  Object.assign(e, { x:e.home.x, y:e.home.y, dx:0, dy:0, sc:false, wait:3 });
}

function caught(){
  g.lives--; g.phase = 'dying'; g.timer = 1.3; g.shake = 14;
  const p = g.player;
  burst(px(p.x), py(p.y), '#ff4f79', 26);
  popText(px(p.x), py(p.y) - 30, '¡Te agarraron!', '#ff4f79');
}

function update(dt){
  updateBeat();
  for (const q of g.parts){ q.x += q.vx*dt; q.y += q.vy*dt; q.vx *= .94; q.vy *= .94; q.life -= dt; }
  g.parts = g.parts.filter(q => q.life > 0);
  for (const s of g.texts){ s.y -= 30*dt; s.life -= dt; }
  g.texts = g.texts.filter(s => s.life > 0);
  g.shake = Math.max(0, g.shake - dt * 40);

  // Fases: ready (cuenta inicial) → run (jugando) → dying / clear (animaciones)
  if (g.phase !== 'run'){
    g.timer -= dt;
    if (g.timer > 0) return;
    if (g.phase === 'ready'){ g.phase = 'run'; }
    else if (g.phase === 'dying'){ if (g.lives <= 0) return finish(false); resetPositions(); }
    else if (g.phase === 'clear'){
      // Ojo: primero preguntamos si era el último nivel, y RECIÉN DESPUÉS sumamos.
      // Si sumáramos antes, g.lvl valdría 3 y LEVELS[3] no existe → error.
      if (g.lvl + 1 >= LEVELS.length) return finish(true);
      g.lvl++; stopAudio(); showLevelIntro();
    }
    return;
  }

  const p = g.player;
  p.inv = Math.max(0, p.inv - dt);
  g.skillCd = Math.max(0, g.skillCd - dt);
  if (char.id === 'voz') $('#b-skill').disabled = g.skillCd > 0;

  // 1) mover al jugador
  step(p, p.speed * dt, playerTurn);
  if (p.dx) p.face = p.dx;
  if (p.dx || p.dy) p.walk += dt * 12;
  collectAt(Math.round(p.x), Math.round(p.y));
  if (char.id === 'keys'){   // imán: junta lo que hay alrededor
    const cx = Math.round(p.x), cy = Math.round(p.y);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++)
      if (Math.hypot(x - p.x, y - p.y) < 1.7) collectAt(x, y);
  }

  // 2) timer del susto
  if (g.scared > 0){ g.scared -= dt; if (g.scared <= 0) g.enemies.forEach(e => e.sc = false); }

  // 3) mover enemigos y ver si chocan con vos
  for (const e of g.enemies){
    e.sayT = Math.max(0, e.sayT - dt); e.sayCd = Math.max(0, e.sayCd - dt);
    if (e.wait > 0){ e.wait -= dt; continue; }
    if (e.stun > 0){ e.stun -= dt; }
    else step(e, e.base * (e.sc ? 0.55 : 1) * dt, enemyTurn);

    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (!e.sc && d < 3 && e.sayCd <= 0){ e.sayT = 1.2; e.sayCd = 6; }
    if (d < 0.7){
      if (e.sc) eat(e);
      else if (e.stun <= 0 && p.inv <= 0){ caught(); return; }
    }
  }

  // 4) ¿limpiaste la cuadra?
  if (g.left <= 0){
    g.phase = 'clear'; g.timer = 2;
    const bonus = 500 * (g.lvl + 1); g.score += bonus;
    popText(W/2, HUD + 200, `¡Cuadra limpia! +${bonus}`, '#ffb627');
    if (audio){ const a = audio; const f = setInterval(() => { a.volume = Math.max(0, a.volume - .08); if (a.volume <= 0) clearInterval(f); }, 80); }
  }
}

// El pulso de las luces sale de los beats reales del tema (los calculó analizar_temas.py).
// Para encontrar el último beat usamos BÚSQUEDA BINARIA: en vez de recorrer los ~400 beats,
// partimos el array a la mitad una y otra vez. Con 400 elementos son ~9 pasos.
function lastBeatBefore(beats, t){
  let lo = 0, hi = beats.length - 1, ans = -1;
  while (lo <= hi){ const mid = (lo + hi) >> 1; if (beats[mid] <= t){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
function updateBeat(){
  const c = CHARTS[g.song]; if (!c || !audio) { g.pulse = 0; return; }
  const t = audio.currentTime, i = lastBeatBefore(c.beats, t);
  g.pulse = i >= 0 ? Math.exp(-(t - c.beats[i]) * 7) : 0;
}

function finish(won){
  if (state !== 'playing') return;
  state = 'end';
  if (audio){ const a = audio; const f = setInterval(() => { a.volume = Math.max(0, a.volume - .1); if (a.volume <= 0){ clearInterval(f); a.pause(); } }, 60); }
  const best = store.get('lhdd-lio-best') || 0, record = g.score > best;
  if (record) store.set('lhdd-lio-best', g.score);
  $('#end-title').textContent = won ? '¡Recorriste todo el barrio!' : 'Te llevaron a tu casa';
  $('#end-rank').textContent = won
    ? (g.eaten >= 10 ? 'El terror del barrio. Nadie te para.' : 'Lío encontrado y resuelto. Bien ahí.')
    : `Llegaste hasta "${LEVELS[g.lvl].title}". Mañana se sale de nuevo.`;
  $('#end-stats').innerHTML = `
    <div><b>${g.score.toLocaleString('es-AR')}</b><span>${record ? 'Nuevo récord' : 'Puntos'}</span></div>
    <div><b>${Math.min(g.lvl + 1, LEVELS.length)}/${LEVELS.length}</b><span>Nivel</span></div>
    <div><b>${g.eaten}</b><span>Corridas</span></div>`;
  setTimeout(() => { if (state === 'end') show('s-end'); }, 700);
}

function pause(){
  if (state !== 'playing') return;
  state = 'paused'; if (audio) audio.pause(); show('s-pause');
}
function resume(){
  if (state !== 'paused') return;
  screens.forEach(s => s.hidden = true); $('#b-pause').hidden = false;
  if (char.id === 'voz') $('#b-skill').hidden = false;
  state = 'playing'; if (audio) audio.play().catch(() => pause());
}
$('#b-pause').onclick = e => { e.stopPropagation(); pause(); };
$('#b-resume').onclick = resume;
$('#b-quit').onclick = () => { stopAudio(); state = 'menu'; show('s-title'); };
$('#b-again').onclick = newRun;
$('#b-skill').onclick = e => { e.stopPropagation(); skill(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------------
//  CONTROLES: teclado y deslizar el dedo
// ---------------------------------------------------------------------
const KEYS = { ArrowUp:[0,-1], KeyW:[0,-1], ArrowDown:[0,1], KeyS:[0,1], ArrowLeft:[-1,0], KeyA:[-1,0], ArrowRight:[1,0], KeyD:[1,0] };
addEventListener('keydown', e => {
  if (KEYS[e.code] && state === 'playing'){ e.preventDefault(); setWant(...KEYS[e.code]); }
  else if ((e.code === 'Space' || e.code === 'KeyX') && state === 'playing'){ e.preventDefault(); skill(); }
  else if (e.code === 'KeyP' || e.code === 'Escape'){ state === 'playing' ? pause() : resume(); }
});
// Swipe: guardamos dónde apoyaste el dedo; si lo moviste más de 22px, vemos para qué lado fue más
let touch = null;
canvas.addEventListener('pointerdown', e => { e.preventDefault(); touch = {x:e.clientX, y:e.clientY}; });
addEventListener('pointermove', e => {
  if (!touch || state !== 'playing') return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  if (Math.hypot(dx, dy) < 22) return;
  if (Math.abs(dx) > Math.abs(dy)) setWant(Math.sign(dx), 0); else setWant(0, Math.sign(dy));
  touch = {x:e.clientX, y:e.clientY};
});
addEventListener('pointerup', () => touch = null);
addEventListener('pointercancel', () => touch = null);

// ---------------------------------------------------------------------
//  EFECTOS
// ---------------------------------------------------------------------
function burst(x, y, color, n){
  for (let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 200;
    g.parts.push({x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:.5 + Math.random()*.3, color}); }
}
function popText(x, y, txt, color){ g.texts.push({x: Math.max(110, Math.min(W - 110, x)), y, txt, color, life:1.4}); }

// ---------------------------------------------------------------------
//  DIBUJO
// ---------------------------------------------------------------------
function resize(){
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
addEventListener('resize', resize);
function rrect(c, x, y, w, h, r){ c.beginPath(); c.roundRect(x, y, w, h, r); }

// El mapa (calles, techos, árboles) no cambia durante el nivel, así que lo dibujamos
// UNA sola vez en un canvas aparte y después lo "pegamos" en cada frame. Es mucho más rápido
// que redibujar 288 casillas 60 veces por segundo.
let mapLayer = null;
const ROOFS = ['#3a2550', '#2f3a5a', '#4a2a45', '#2d4048', '#43314f', '#3b3048'];
function buildMapLayer(){
  mapLayer = document.createElement('canvas');
  mapLayer.width = W * 2; mapLayer.height = (H - HUD) * 2;
  const c = mapLayer.getContext('2d'); c.scale(2, 2);
  const r = rng(LEVELS[g.lvl].title);

  // asfalto
  c.fillStyle = '#231a31'; c.fillRect(0, 0, W, H - HUD);

  // Cada manzana (grupo de '#' pegados) lleva un color de techo. Para saber qué '#' van juntos
  // hacemos un "flood fill" (como el balde de pintura del Paint).
  const block = map.map(row => row.map(() => -1)); let nb = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    if (map[y][x] !== '#' || block[y][x] >= 0) continue;
    const pila = [[x, y]]; block[y][x] = nb;
    while (pila.length){ const [a, b] = pila.pop();
      for (const d of DIRS){ const nx = a + d.dx, ny = b + d.dy;
        if (map[ny] && map[ny][nx] === '#' && block[ny][nx] < 0){ block[ny][nx] = nb; pila.push([nx, ny]); } } }
    nb++;
  }
  const border = block[0][0];  // el borde del mapa es un paredón, no un techo

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    const X = x * T, Y = y * T, ch = map[y][x];
    if (ch === '#'){
      c.fillStyle = block[y][x] === border ? '#170e24' : ROOFS[block[y][x] % ROOFS.length];
      c.fillRect(X, Y, T, T);
      // vereda: una franja clarita del lado que da a la calle
      c.fillStyle = '#4b3c60';
      if (!isWall(x, y - 1)) c.fillRect(X, Y, T, 6);
      if (!isWall(x, y + 1)) c.fillRect(X, Y + T - 6, T, 6);
      if (!isWall(x - 1, y)) c.fillRect(X, Y, 6, T);
      if (!isWall(x + 1, y)) c.fillRect(X + T - 6, Y, 6, T);
      // tanques de agua y aires acondicionados en los techos
      if (block[y][x] !== border){
        const k = r();
        if (k < .12){ c.fillStyle = '#5b5070'; c.beginPath(); c.arc(X + T/2, Y + T/2, 8, 0, Math.PI*2); c.fill();
          c.fillStyle = '#6e6385'; c.beginPath(); c.arc(X + T/2 - 2, Y + T/2 - 2, 4, 0, Math.PI*2); c.fill(); }
        else if (k < .22){ c.fillStyle = '#6a6080'; c.fillRect(X + 12, Y + 13, 16, 12); c.fillStyle = '#2a2236'; c.fillRect(X + 15, Y + 16, 10, 6); }
      }
    } else if (ch === 'T'){
      c.fillStyle = '#21402d'; c.fillRect(X, Y, T, T);
      c.fillStyle = '#2e6b3f'; c.beginPath(); c.arc(X + T/2, Y + T/2, 16, 0, Math.PI*2); c.fill();
      c.fillStyle = '#3f8a52'; c.beginPath(); c.arc(X + T/2 - 4, Y + T/2 - 4, 9, 0, Math.PI*2); c.fill();
    } else {
      // líneas punteadas en el medio de las calles largas
      c.fillStyle = 'rgba(255,244,220,.13)';
      if (isWall(x, y - 1) && isWall(x, y + 1) && !isWall(x - 1, y) && !isWall(x + 1, y)) c.fillRect(X + 10, Y + T/2 - 1, 20, 2);
      if (isWall(x - 1, y) && isWall(x + 1, y) && !isWall(x, y - 1) && !isWall(x, y + 1)) c.fillRect(X + T/2 - 1, Y + 10, 2, 20);
    }
  }
}

function drawStreetLights(){
  // Un farol en cada esquina (casilla de calle con 3 o más salidas). Late con el beat.
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    if (isWall(x, y)) continue;
    const salidas = DIRS.filter(d => !isWall(x + d.dx, y + d.dy)).length;
    if (salidas < 3 || (x + y) % 2) continue;
    const gr = ctx.createRadialGradient(px(x), py(y), 2, px(x), py(y), 54);
    gr.addColorStop(0, g.light); gr.addColorStop(1, 'transparent');
    ctx.globalAlpha = .1 + g.pulse * .22; ctx.fillStyle = gr;
    ctx.fillRect(px(x) - 54, py(y) - 54, 108, 108);
  }
  ctx.globalAlpha = 1;
}

function drawPick(x, y, s, t){
  ctx.save(); ctx.translate(x, y); ctx.scale(s * Math.cos(t * 3 + x * .05), s);
  ctx.beginPath(); ctx.moveTo(0, 15);
  ctx.bezierCurveTo(-8, 8, -16, -4, -13, -11); ctx.bezierCurveTo(-8, -17, 8, -17, 13, -11);
  ctx.bezierCurveTo(16, -4, 8, 8, 0, 15);
  ctx.fillStyle = '#ffb627'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#8a4b00'; ctx.stroke();
  ctx.restore();
}
function drawVinyl(x, y, t){
  const s = 1 + g.pulse * .15;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(t * 4);
  ctx.fillStyle = '#0e0818'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#4a3e5a'; ctx.lineWidth = 1;
  for (const rr of [7, 10, 12]){ ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI*2); ctx.stroke(); }
  ctx.fillStyle = '#ff4f79'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff4dc'; ctx.fillRect(8, -2, 4, 2);
  ctx.restore();
}
function drawItems(t){
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    const c = map[y][x];
    if (c === '.') drawPick(px(x), py(y), .38, t);
    else if (c === 'o') drawVinyl(px(x), py(y), t);
  }
}

// El músico: la cara recortada, con una sombra del color de su personaje
function drawPlayer(t){
  const p = g.player, x = px(p.x), y = py(p.y);
  if (p.inv > 0 && Math.floor(p.inv * 10) % 2) return;  // parpadeo cuando sos invencible
  const moving = p.dx || p.dy, bob = moving ? Math.sin(p.walk) * 2.5 : Math.sin(t * 3) * 1;
  ctx.fillStyle = CHARS.find(c => c.id === char.id).color; ctx.globalAlpha = .45;
  ctx.beginPath(); ctx.ellipse(x, y + 20, 18, 6, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x, y - 4 + bob); ctx.rotate(moving ? Math.sin(p.walk) * .08 : 0); ctx.scale(p.face < 0 ? -1 : 1, 1);
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  const im = faces[char.id]; if (im.complete) ctx.drawImage(im, -27, -27, 54, 54);
  ctx.restore();
  if (g.phase === 'dying'){ ctx.fillStyle = '#fff4dc'; ctx.font = '22px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✶ ✶', x, y - 32); }
}

// Los enemigos son "cabezones" dibujados con formas simples del canvas
function eyes(x, y, e, sep, scared){
  const lx = e.dx * 2, ly = e.dy * 2;
  for (const s of [-1, 1]){
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * sep, y, scared ? 5 : 4.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#140b22'; ctx.beginPath(); ctx.arc(x + s * sep + (scared ? 0 : lx), y + (scared ? 0 : ly), scared ? 1.6 : 2.3, 0, Math.PI*2); ctx.fill();
  }
}
function drawEnemy(e, t){
  const x = px(e.x), y = py(e.y) + Math.sin(t * 8 + e.home.x) * (e.dx || e.dy ? 1.5 : .5);
  const scared = e.sc, blink = scared && g.scared < 2 && Math.floor(t * 6) % 2;
  const skin = scared ? (blink ? '#fff4dc' : '#7d8cff') : null;
  ctx.globalAlpha = e.wait > 0 ? .5 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 18, 15, 5, 0, 0, Math.PI*2); ctx.fill();

  if (e.kind === 'D'){        // Firulais
    ctx.fillStyle = skin || '#5a3a22';
    ctx.beginPath(); ctx.ellipse(x - 15, y - 2, 6, 12, .3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 15, y - 2, 6, 12, -.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = skin || '#a8743f'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = scared ? '#c7cdff' : '#f2dcc0'; ctx.beginPath(); ctx.ellipse(x, y + 7, 9, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#140b22'; ctx.beginPath(); ctx.ellipse(x, y + 3, 4, 3, 0, 0, Math.PI*2); ctx.fill();
    if (!scared && (e.dx || e.dy)){ ctx.fillStyle = '#ff6f91'; rrect(ctx, x - 2.5, y + 10, 5, 7 + Math.sin(t*14)*1.5, 2.5); ctx.fill(); }
    eyes(x, y - 5, e, 6, scared);
  } else {
    ctx.fillStyle = skin || '#f0c09a'; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI*2); ctx.fill();
    if (e.kind === 'V'){      // Doña Rosa: pelo gris con ruleros
      ctx.fillStyle = scared ? '#5560c8' : '#b9b2c4';
      ctx.beginPath(); ctx.arc(x, y - 4, 16, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = '#ff7eb3';
      for (const k of [-10, 0, 10]){ rrect(ctx, x + k - 4, y - 21, 8, 7, 3); ctx.fill(); }
      eyes(x, y - 1, e, 6, scared);
      ctx.strokeStyle = '#140b22'; ctx.lineWidth = 2;
      if (!scared){ ctx.beginPath(); ctx.moveTo(x - 10, y - 9); ctx.lineTo(x - 3, y - 6); ctx.moveTo(x + 10, y - 9); ctx.lineTo(x + 3, y - 6); ctx.stroke(); }
      ctx.fillStyle = '#7a1f35'; ctx.beginPath(); ctx.ellipse(x, y + 8, 4, scared ? 2 : 3.5, 0, 0, Math.PI*2); ctx.fill();
    } else {                  // El cana: gorra azul con chapita y bigote
      ctx.fillStyle = scared ? '#3a43a0' : '#1f3b8c';
      rrect(ctx, x - 16, y - 20, 32, 12, 5); ctx.fill();
      ctx.fillStyle = '#152a66'; ctx.beginPath(); ctx.ellipse(x, y - 8, 17, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x, y - 15, 3, 0, Math.PI*2); ctx.fill();
      eyes(x, y - 1, e, 6, scared);
      ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(x - 5, y + 7, 6, 3, .2, 0, Math.PI*2); ctx.ellipse(x + 5, y + 7, 6, 3, -.2, 0, Math.PI*2); ctx.fill();
    }
  }
  if (scared){  // boca temblorosa
    ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k <= 4; k++) ctx.lineTo(x - 8 + k * 4, y + 11 + (k % 2 ? -2 : 2));
    ctx.stroke();
  }
  if (e.stun > 0){   // estrellitas de mareo
    ctx.fillStyle = '#ffd34d'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++){ const a = t * 5 + k * 2.1; ctx.fillText('★', x + Math.cos(a) * 16, y - 24 + Math.sin(a) * 4); }
  }
  if (e.wait > 0){ ctx.fillStyle = '#c9b8e0'; ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('zzz', x + 14, y - 18); }
  ctx.globalAlpha = 1;
  if (e.sayT > 0) bubble(x, y - 34, e.says);
}
function bubble(x, y, txt){
  ctx.font = '700 12px Archivo, sans-serif'; ctx.textAlign = 'center';
  const w = ctx.measureText(txt).width + 14;
  const bx = Math.max(4, Math.min(W - w - 4, x - w/2));
  ctx.fillStyle = '#fff4dc'; rrect(ctx, bx, y - 18, w, 22, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y + 3); ctx.lineTo(x + 5, y + 3); ctx.lineTo(x, y + 9); ctx.fill();
  ctx.fillStyle = '#140b22'; ctx.fillText(txt, bx + w/2, y - 3);
}

function heart(x, y, full){
  ctx.save(); ctx.translate(x, y); ctx.beginPath();
  ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8);
  ctx.fillStyle = full ? '#ff4f79' : 'rgba(255,244,220,.2)'; ctx.fill(); ctx.restore();
}
function drawHUD(){
  ctx.fillStyle = '#140b22'; ctx.fillRect(0, 0, W, HUD);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff4dc'; ctx.font = '26px Bungee, Impact, sans-serif';
  ctx.fillText(g.score.toLocaleString('es-AR'), 20, 40);
  const sw = ctx.measureText(g.score.toLocaleString('es-AR')).width;
  for (let i = 0; i < g.maxLives; i++) heart(sw + 50 + i * 28, 30, i < g.lives);
  ctx.textAlign = 'center'; ctx.font = '600 13px Archivo, sans-serif'; ctx.fillStyle = '#c9b8e0';
  ctx.fillText(`Nivel ${g.lvl + 1} · ${LEVELS[g.lvl].title}`, W/2, 24);
  ctx.fillStyle = '#ffb627'; ctx.font = '16px Bungee, sans-serif';
  ctx.fillText(`${g.left} púas`, W/2, 46);
  // barra del susto
  if (g.scared > 0){
    const bw = 140, bx = W - 230, prog = g.scared / LEVELS[g.lvl].scared;
    ctx.fillStyle = 'rgba(255,244,220,.2)'; rrect(ctx, bx, 26, bw, 8, 4); ctx.fill();
    ctx.fillStyle = '#7d8cff'; rrect(ctx, bx, 26, Math.max(8, bw * prog), 8, 4); ctx.fill();
    ctx.fillStyle = '#fff4dc'; ctx.font = '600 11px Archivo, sans-serif'; ctx.fillText('¡Corrélos!', bx + bw/2, 20);
  } else if (char.id === 'voz'){
    ctx.fillStyle = g.skillCd > 0 ? '#c9b8e0' : '#7ee081'; ctx.font = '600 13px Archivo, sans-serif';
    ctx.fillText(g.skillCd > 0 ? `Grito en ${Math.ceil(g.skillCd)}` : 'Grito listo (espacio)', W - 160, 36);
  }
}

// ---------------------------------------------------------------------
//  LOOP PRINCIPAL: actualizar → dibujar, 60 veces por segundo
// ---------------------------------------------------------------------
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  const inGame = g && g.player && (state === 'playing' || state === 'paused' || state === 'end');
  if (state === 'playing') update(dt);

  ctx.save();
  ctx.fillStyle = '#140b22'; ctx.fillRect(0, 0, W, H);
  if (inGame){
    if (g.shake) ctx.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake);
    ctx.drawImage(mapLayer, 0, HUD, W, H - HUD);
    drawStreetLights();
    drawItems(t);
    for (const e of g.enemies) drawEnemy(e, t);
    drawPlayer(t);
    for (const q of g.parts){ ctx.globalAlpha = Math.max(0, q.life / .8); ctx.fillStyle = q.color; ctx.fillRect(q.x - 2.5, q.y - 2.5, 5, 5); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const s of g.texts){ ctx.globalAlpha = Math.min(1, s.life); ctx.font = '20px Bungee, sans-serif';
      ctx.fillStyle = '#140b22'; ctx.fillText(s.txt, s.x + 2, s.y + 2); ctx.fillStyle = s.color; ctx.fillText(s.txt, s.x, s.y); }
    ctx.globalAlpha = 1;
    if (g.phase === 'ready'){
      ctx.font = '40px Bungee, sans-serif'; ctx.fillStyle = '#140b22'; ctx.fillText('¡Listos!', W/2 + 3, HUD + 243);
      ctx.fillStyle = '#ffb627'; ctx.fillText('¡Listos!', W/2, HUD + 240);
    }
    drawHUD();
  } else {
    // Fondo de los menús: una grilla de calles que se mueve despacito
    const off = (now * 0.02) % T;
    ctx.strokeStyle = '#2a1636'; ctx.lineWidth = 14;
    for (let x = -T + off; x < W + T; x += T * 3){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = -T + off; y < H + T; y += T * 3){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  ctx.restore();
  requestAnimationFrame(frame);
}

resize();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(resize);
requestAnimationFrame(frame);
