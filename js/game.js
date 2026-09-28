// =====================================================================
//  CONFIG — acá se cambian nombres, habilidades y temas
// =====================================================================
const CHARS = [
  { id:'keys', name:'Agus',      inst:'Teclado',   skill:'Imán de púas', desc:'Las púas cercanas vuelan hacia vos.', color:'#3fd0c9' },
  { id:'bass', name:'Chanchi',   inst:'Bajo',      skill:'Vida extra',   desc:'Arrancás con 4 vidas.',               color:'#ffb627' },
  { id:'gtr1', name:'gaspi', inst:'Guitarra',  skill:'Salto largo',  desc:'Saltás más alto y flotás más.',       color:'#ff4f79' },
  { id:'gtr2', name:'Fran', inst:'Guitarra',  skill:'Púas dobles',  desc:'Cada púa suma el doble.',             color:'#a58bff' },
  { id:'voz',  name:'Mezita',      inst:'Micrófono', skill:'Doble salto',  desc:'Podés saltar otra vez en el aire.',   color:'#7ee081' },
];
const SONGS = [
  { id:'criticar', title:'Por criticar',          light:'#ff4f79' },
  { id:'talvez',   title:'Tal vez',               light:'#3fd0c9' },
  { id:'cuadra',   title:'La cuadra de mi casa',  light:'#ffb627' },
  { id:'lio',      title:'Buscando algún lío',    light:'#ff7a3d' },
  { id:'botella',  title:'Una botella',           light:'#7ee081' },
  { id:'hoy',      title:'Hoy es hoy',            light:'#a58bff' },
];

// =====================================================================
//  CONSTANTES DEL MUNDO (coordenadas lógicas 960x540)
// =====================================================================
const W = 960, H = 540, GROUND = 452, PX = 190;
const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d');
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

// Rutas a los archivos: cada cara y cada tema vive en /assets
const facePath = id => `assets/caras/${id}.png`;
const audioUrl = id => `assets/temas/${id}.mp3`;

// Caras: se cargan una vez como imágenes para dibujarlas en el canvas
const faces = {};
for (const c of CHARS){ const im = new Image(); im.src = facePath(c.id); faces[c.id] = im; }

// =====================================================================
//  PANTALLAS
// =====================================================================
let state = 'menu', char = null, song = null, audio = null, g = null;
const screens = [...document.querySelectorAll('.screen')];
function show(id){
  screens.forEach(s => s.hidden = s.id !== id);
  $('#b-pause').hidden = true;
  if (id === 's-songs') renderSongs();
  const first = id && $('#'+id+' button'); if (first) first.focus({preventScroll:true});
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { stopAudio(); state='menu'; show(b.dataset.go); });

$('#lineup').innerHTML = CHARS.map(c => `<img src="${facePath(c.id)}" alt="${c.name}">`).join('');
$('#b-start').onclick = () => show('s-chars');
$('#cards').innerHTML = CHARS.map(c => `
  <button class="card" style="--c:${c.color}" data-id="${c.id}">
    <img src="${facePath(c.id)}" alt="">
    <b>${c.name}</b><span>${c.inst}</span><em>${c.skill}</em><span>${c.desc}</span>
  </button>`).join('');
document.querySelectorAll('.card').forEach(b => b.onclick = () => {
  char = CHARS.find(c => c.id === b.dataset.id); show('s-songs');
});
const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function renderSongs(){
  $('#who').innerHTML = `<img src="${facePath(char.id)}" alt=""> ${char.name} con ${char.inst.toLowerCase()}`;
  $('#songs').innerHTML = SONGS.map(s => {
    const c = CHARTS[s.id]; const best = store.get('lhdd-best-'+s.id) || 0;
    return `<button class="song" style="--c:${s.light}" data-id="${s.id}">
      <b>${s.title}</b><span>${fmt(c.dur)} · ${Math.round(c.bpm)} bpm${best ? ' · récord '+best.toLocaleString('es-AR') : ''}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('.song').forEach(b => b.onclick = () => {
    song = SONGS.find(s => s.id === b.dataset.id); startGame();
  });
}

// =====================================================================
//  NIVEL: se arma a partir de los beats reales del tema
// =====================================================================
function rng(seedStr){ let h=1779033703; for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
  return () => { h = Math.imul(h ^ h>>>16, 2246822507); h = Math.imul(h ^ h>>>13, 3266489909); return ((h ^= h>>>16) >>> 0) / 4294967296; }; }

function buildLevel(songId){
  const c = CHARTS[songId], r = rng(songId), objs = [];
  const period = 60 / c.bpm, minGap = 1.1;
  let lastObs = -9;
  c.beats.forEach((t, i) => {
    if (t < 3 || t > c.dur - 3) return;
    const e = c.e[i], s = c.s[i], bar = i % 4 === 0, half = i % 2 === 0;
    // más energía en el tema = más obstáculos
    let p = e > 0.62 ? (half ? 0.7 : 0.15) : e > 0.3 ? (bar ? 0.65 : half ? 0.25 : 0) : (bar ? 0.3 : 0);
    if (s > 1.1) p += 0.15;
    if (t - lastObs >= minGap && r() < p){
      const tall = e > 0.5 && s > 0.8 && r() < 0.35;
      objs.push(tall ? {type:'stack', t, w:64, h:104} : {type:'amp', t, w:56, h:52});
      if (r() < 0.55) objs.push({type:'pick', t, y: GROUND - (tall ? 205 : 175)});
      lastObs = t;
    } else if (t - lastObs > period * 0.9 && r() < 0.55){
      objs.push({type:'pick', t, y: GROUND - (r() < 0.3 ? 140 : 60)});
    }
  });
  // vinilos: devuelven una vida, cada ~50 segundos
  for (let vt = 45; vt < c.dur - 10; vt += 50){
    if (!objs.some(o => o.type !== 'pick' && Math.abs(o.t - vt) < 1)) objs.push({type:'vinyl', t:vt, y: GROUND - 150});
  }
  return objs.sort((a,b) => a.t - b.t);
}

// =====================================================================
//  JUEGO
// =====================================================================
function physics(){ return char.id === 'gtr1' ? {jv:-1000, grav:2350} : {jv:-900, grav:2600}; }

function startGame(){
  stopAudio();
  const c = CHARTS[song.id];
  const objs = buildLevel(song.id);
  const lives = char.id === 'bass' ? 4 : 3;
  g = { objs, oi:0, t:0, lastAt:0, lastPerf:performance.now(), score:0, combo:0, picks:0,
        totalPicks: objs.filter(o => o.type === 'pick').length, hits:0, lives, maxLives:lives,
        p:{y:GROUND, vy:0, ground:true, jumps:0, inv:0}, dist:0,
        speed: Math.max(360, Math.min(560, 360 + (c.bpm - 85) * 3.2)),
        beat:0, pulse:0, parts:[], shake:0, dur:c.dur, ...physics() };
  audio = new Audio(audioUrl(song.id));
  audio.addEventListener('ended', () => { if (state === 'playing') finish(true); });
  screens.forEach(s => s.hidden = true);
  $('#b-pause').hidden = false;
  state = 'playing';
  audio.play().catch(() => pause());
}
function stopAudio(){ if (audio){ audio.pause(); audio = null; } }

// El reloj del juego ES el tema: así los obstáculos caen a tiempo con la música
function songTime(){
  const now = performance.now(), at = audio ? audio.currentTime : 0;
  if (at !== g.lastAt){ g.lastAt = at; g.lastPerf = now; }
  const t = g.lastAt + (state === 'playing' ? (now - g.lastPerf) / 1000 : 0);
  return Math.max(t, g.t);
}

function jumpPress(){
  if (state !== 'playing') return;
  const p = g.p;
  if (p.ground){ p.vy = g.jv; p.ground = false; p.jumps = 1; }
  else if (char.id === 'voz' && p.jumps < 2){ p.vy = g.jv * 0.85; p.jumps = 2; burst(PX, p.y, '#7ee081', 8); }
}
function jumpRelease(){ if (g && g.p.vy < -450) g.p.vy = -450; }

function hit(){
  g.lives--; g.hits++; g.combo = 0; g.p.inv = 1.4; g.shake = 12;
  burst(PX, g.p.y - 60, '#ff4f79', 18);
  if (g.lives <= 0) finish(false);
}
function burst(x, y, color, n){
  for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = 80 + Math.random()*220;
    g.parts.push({x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v - 80, life:.6, color}); }
}
const mult = () => 1 + Math.min(3, Math.floor(g.combo / 8));

function update(dt){
  const t = songTime(); g.t = t;
  const p = g.p, c = CHARTS[song.id];
  g.dist += g.speed * dt;

  // salto
  p.vy += g.grav * dt; p.y += p.vy * dt;
  if (p.y >= GROUND){ p.y = GROUND; p.vy = 0; p.ground = true; p.jumps = 0; }
  p.inv = Math.max(0, p.inv - dt);

  // pulso visual en cada beat
  while (g.beat < c.beats.length - 1 && c.beats[g.beat + 1] <= t) g.beat++;
  g.pulse = t >= c.beats[g.beat] ? Math.exp(-(t - c.beats[g.beat]) * 7) : 0;

  // objetos
  const center = p.y - 60;
  for (let i = g.oi; i < g.objs.length; i++){
    const o = g.objs[i];
    o.x = PX + (o.t - t) * g.speed;
    if (o.x > W + 150) break;
    if (o.x < -150 && i === g.oi){ g.oi++; continue; }
    if (o.type === 'amp' || o.type === 'stack'){
      if (!o.hit && Math.abs(o.x - PX) < o.w/2 + 14 && p.y > GROUND - o.h + 10){
        o.hit = true; if (p.inv <= 0) hit();
      }
      if (!o.passed && o.x < PX - o.w/2 - 16){
        o.passed = true; if (!o.hit){ g.score += 25 * mult(); g.combo++; }
      }
    } else if (!o.got){
      if (char.id === 'keys' && Math.hypot(o.x - PX, o.y - center) < 190) o.mag = true;
      if (o.mag){ o.pull = Math.min(1, (o.pull || 0) + dt * 4); }
      o.dx = o.x + (PX - o.x) * (o.pull || 0);
      o.dy = o.y + (center - o.y) * (o.pull || 0);
      if (Math.hypot(o.dx - PX, o.dy - center) < 44){
        o.got = true;
        if (o.type === 'vinyl'){ g.lives = Math.min(g.maxLives, g.lives + 1); burst(o.dx, o.dy, '#fff4dc', 16); }
        else { g.picks++; g.combo++; g.score += 10 * mult() * (char.id === 'gtr2' ? 2 : 1); burst(o.dx, o.dy, '#ffb627', 8); }
      }
    }
  }

  for (const q of g.parts){ q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 600*dt; q.life -= dt; }
  g.parts = g.parts.filter(q => q.life > 0);
  g.shake = Math.max(0, g.shake - dt * 40);

  if (t >= g.dur - 0.15) finish(true);
}

function finish(won){
  if (state !== 'playing') return;
  state = 'end';
  if (!won && audio){ const a = audio; const fade = setInterval(() => { a.volume = Math.max(0, a.volume - .1); if (a.volume <= 0){ clearInterval(fade); a.pause(); } }, 60); }
  const key = 'lhdd-best-' + song.id, best = store.get(key) || 0, record = g.score > best;
  if (record) store.set(key, g.score);
  const ratio = g.totalPicks ? g.picks / g.totalPicks : 0;
  $('#end-title').textContent = won ? '¡Tema completo!' : 'Se cortó el tema';
  $('#end-rank').textContent = !won ? `Llegaste hasta el ${fmt(g.t)} de "${song.title}".`
    : g.hits === 0 && ratio > .8 ? 'Estrella de rock: ni un golpe y casi todas las púas.'
    : ratio > .5 ? 'Banda de estadio. Bien ahí.' : 'Banda telonera. Se puede más.';
  $('#end-stats').innerHTML = `
    <div><b>${g.score.toLocaleString('es-AR')}</b><span>${record ? 'Nuevo récord' : 'Puntos'}</span></div>
    <div><b>${g.picks}/${g.totalPicks}</b><span>Púas</span></div>
    <div><b>${g.hits}</b><span>Golpes</span></div>`;
  setTimeout(() => { if (state === 'end') show('s-end'); }, won ? 300 : 900);
}

function pause(){
  if (state !== 'playing') return;
  state = 'paused'; if (audio) audio.pause(); show('s-pause');
}
function resume(){
  if (state !== 'paused') return;
  screens.forEach(s => s.hidden = true); $('#b-pause').hidden = false;
  state = 'playing'; g.lastPerf = performance.now();
  if (audio) audio.play().catch(() => pause());
}
$('#b-pause').onclick = e => { e.stopPropagation(); pause(); };
$('#b-resume').onclick = resume;
$('#b-quit').onclick = () => { stopAudio(); state = 'menu'; show('s-songs'); };
$('#b-again').onclick = startGame;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// Controles
addEventListener('keydown', e => {
  if (['Space','ArrowUp','KeyW'].includes(e.code)){
    if (state === 'playing'){ e.preventDefault(); if (!e.repeat) jumpPress(); }
  } else if (e.code === 'KeyP' || e.code === 'Escape'){ state === 'playing' ? pause() : resume(); }
});
addEventListener('keyup', e => { if (['Space','ArrowUp','KeyW'].includes(e.code)) jumpRelease(); });
canvas.addEventListener('pointerdown', e => { e.preventDefault(); jumpPress(); });
addEventListener('pointerup', jumpRelease);
addEventListener('pointercancel', jumpRelease);

// =====================================================================
//  DIBUJO
// =====================================================================
function resize(){
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
addEventListener('resize', resize);

function faceCircle(id, x, y, r, stroke){
  const im = faces[id];
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.closePath();
  ctx.fillStyle = '#140b22'; ctx.fill(); ctx.clip();
  if (im.complete) ctx.drawImage(im, x - r, y - r, r*2, r*2);
  ctx.restore();
  if (stroke){ ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke(); }
}
function rrect(x, y, w, h, r){ ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Ciudad de fondo, generada una sola vez
const skyline = (() => { const r = rng('skyline'), b = []; let x = 0;
  while (x < 1600){ const w = 60 + r()*90, h = 90 + r()*170, win = [];
    for (let wy = 14; wy < h - 10; wy += 22) for (let wx = 10; wx < w - 12; wx += 18) if (r() < .35) win.push([wx, wy, r()]);
    b.push({x, w, h, win}); x += w + 4 + r()*20; }
  return {b, period: x}; })();

function drawWorld(d, pulse, light){
  // cielo
  const sky = ctx.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, '#120a20'); sky.addColorStop(1, '#3a1a4a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 320);
  ctx.fillStyle = '#fff4dc'; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.arc(820, 70, 26, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

  // edificios (se mueven lento = parallax)
  const off = (d * 0.12) % skyline.period;
  for (let k = 0; k < 2; k++) for (const b of skyline.b){
    const x = b.x - off + k * skyline.period; if (x > W || x + b.w < 0) continue;
    ctx.fillStyle = '#170d28'; ctx.fillRect(x, 300 - b.h, b.w, b.h);
    for (const [wx, wy, s] of b.win){
      ctx.fillStyle = s > .8 ? light : '#ffcf6b';
      ctx.globalAlpha = .35 + (s > .8 ? pulse * .6 : 0);
      ctx.fillRect(x + wx, 300 - b.h + wy, 8, 10);
    }
    ctx.globalAlpha = 1;
  }

  // paredón con afiches de la banda
  ctx.fillStyle = '#2a1636'; ctx.fillRect(0, 300, W, GROUND - 300);
  ctx.fillStyle = '#1d0f28'; ctx.fillRect(0, 296, W, 8);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
  const wd = d * 0.7;
  for (let row = 0; row < 7; row++){
    const y = 304 + row * 22; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    const sh = row % 2 ? 22 : 0;
    for (let x = -((wd + sh) % 44); x < W; x += 44){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
  }
  const PP = 300, first = Math.floor(wd / PP);
  for (let i = first; i < first + 5; i++){
    const x = i * PP - wd + 60, c = CHARS[((i % 5) + 5) % 5];
    ctx.save(); ctx.translate(x + 48, 380); ctx.rotate(((i * 37) % 7 - 3) * 0.012);
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(-48, -64, 96, 128);
    ctx.fillStyle = c.color; ctx.fillRect(-42, -58, 84, 116);
    ctx.restore();
    ctx.save(); ctx.translate(x + 48, 380); ctx.rotate(((i * 37) % 7 - 3) * 0.012);
    faceCircle(c.id, 0, -14, 28, '#140b22');
    ctx.fillStyle = '#140b22'; ctx.font = '20px Bungee, Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LHDD', 0, 38);
    ctx.font = '600 10px Archivo, sans-serif'; ctx.fillText('en vivo', 0, 52);
    ctx.restore();
  }

  // faroles: la luz late con el beat
  const LP = 560;
  for (let x = -(d % LP) + 420; x < W + LP; x += LP){
    const cone = ctx.createRadialGradient(x + 28, 214, 4, x + 28, 330, 220);
    cone.addColorStop(0, light); cone.addColorStop(1, 'transparent');
    ctx.globalAlpha = .16 + pulse * .22; ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(x + 18, 214); ctx.lineTo(x - 80, GROUND); ctx.lineTo(x + 140, GROUND); ctx.lineTo(x + 38, 214); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0e0818'; ctx.fillRect(x - 3, 200, 7, GROUND - 200);
    ctx.fillRect(x - 3, 200, 34, 6);
    ctx.fillStyle = light; ctx.beginPath(); ctx.arc(x + 28, 212, 7, 0, Math.PI*2); ctx.fill();
  }

  // vereda
  ctx.fillStyle = '#3b2a4f'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#6b5487'; ctx.fillRect(0, GROUND, W, 4);
  ctx.fillStyle = '#191026'; ctx.fillRect(0, H - 28, W, 28);
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
  for (let x = -(d % 90); x < W; x += 90){ ctx.beginPath(); ctx.moveTo(x, GROUND + 4); ctx.lineTo(x - 20, H - 28); ctx.stroke(); }
}

function drawAmp(x, w, h){
  const y = GROUND - h;
  ctx.fillStyle = '#0e0a14'; rrect(x - w/2, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = '#b9a6d6'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#2b2236'; rrect(x - w/2 + 3, y + 3, w - 6, h - 6, 3); ctx.fill();
  // rejilla
  ctx.save(); rrect(x - w/2 + 7, y + 14, w - 14, h - 21, 2); ctx.clip();
  ctx.fillStyle = '#1a1422'; ctx.fillRect(x - w/2, y, w, h);
  ctx.strokeStyle = '#3d3149'; ctx.lineWidth = 1.5;
  for (let k = -h; k < w; k += 6){ ctx.beginPath(); ctx.moveTo(x - w/2 + k, y + 14); ctx.lineTo(x - w/2 + k + h, y + h); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#ffb627';
  for (let k = 0; k < 3; k++){ ctx.beginPath(); ctx.arc(x - w/2 + 12 + k * 9, y + 8, 2.5, 0, Math.PI*2); ctx.fill(); }
}
function drawObstacle(o){
  if (o.type === 'amp') drawAmp(o.x, o.w, o.h);
  else {
    drawAmp(o.x, o.w, 64);
    const y = GROUND - o.h;
    ctx.fillStyle = '#0e0a14'; rrect(o.x - o.w/2, y, o.w, 40, 5); ctx.fill();
    ctx.strokeStyle = '#b9a6d6'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#2b2236'; rrect(o.x - o.w/2 + 3, y + 3, o.w - 6, 34, 3); ctx.fill();
    ctx.fillStyle = '#fff4dc'; ctx.font = '11px Bungee, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LHDD', o.x, y + 17);
    ctx.fillStyle = '#ffb627';
    for (let k = 0; k < 5; k++){ ctx.beginPath(); ctx.arc(o.x - 20 + k * 10, y + 28, 2.5, 0, Math.PI*2); ctx.fill(); }
    ctx.fillStyle = '#ff4f79'; ctx.beginPath(); ctx.arc(o.x + 24, y + 28, 2.5, 0, Math.PI*2); ctx.fill();
  }
}
function drawPick(x, y, t){
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(t * 4 + x * .01), 1);
  ctx.beginPath(); ctx.moveTo(0, 15);
  ctx.bezierCurveTo(-8, 8, -16, -4, -13, -11); ctx.bezierCurveTo(-8, -17, 8, -17, 13, -11);
  ctx.bezierCurveTo(16, -4, 8, 8, 0, 15);
  ctx.fillStyle = '#ffb627'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8a4b00'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-4, -8, 3, 5, -.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawVinyl(x, y, t){
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5);
  ctx.fillStyle = '#0e0818'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#3a2e48'; ctx.lineWidth = 1;
  for (const r of [9, 12, 15]){ ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke(); }
  ctx.fillStyle = '#ff4f79'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff4dc'; ctx.fillRect(-1, -1, 2, 2); ctx.fillRect(10, -3, 4, 2);
  ctx.restore();
  ctx.fillStyle = '#ff4f79'; ctx.font = '12px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+1', x, y - 24);
}

function line(x1, y1, x2, y2, w, c){ ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

// Cuerpo caricaturesco + instrumento + cara
function drawMusician(c, x, y, run, air){
  const bob = air ? 0 : Math.abs(Math.sin(run)) * -4;
  const hipY = y - 40;
  // piernas
  const a = air ? 0.9 : Math.sin(run) * 0.7, b = air ? -0.5 : -Math.sin(run) * 0.7;
  for (const [ang, shade] of [[b, '#1a1230'], [a, '#2b2440']]){
    const fx = x + Math.sin(ang) * 26, fy = hipY + Math.cos(ang) * (air ? 30 : 38);
    line(x, hipY, fx, fy, 10, shade);
    ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(fx + 5, fy + 2, 9, 5, 0, 0, Math.PI*2); ctx.fill();
  }
  // torso
  ctx.fillStyle = c.color; rrect(x - 17, y - 84 + bob, 34, 48, 10); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - 17, y - 50 + bob, 34, 6);
  const sy = y - 76 + bob;  // hombros
  const skin = '#e8b08a';

  if (c.id === 'keys'){
    // keytar cruzado
    ctx.save(); ctx.translate(x + 8, y - 54 + bob); ctx.rotate(-0.32);
    ctx.fillStyle = '#e9e4f2'; rrect(-40, -11, 70, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-34, -4, 52, 13);
    ctx.fillStyle = '#140b22'; for (let k = 0; k < 8; k++) ctx.fillRect(-34 + k * 6.5, -4, 1, 13);
    for (const k of [0,1,3,4,5]) ctx.fillRect(-30 + k * 6.5, -4, 3.5, 7);
    ctx.fillStyle = '#3fd0c9'; rrect(30, -7, 26, 10, 3); ctx.fill();
    ctx.restore();
    line(x - 4, sy, x - 18, y - 56 + bob, 7, skin);
    line(x + 8, sy, x + 34, y - 70 + bob, 7, skin);
  } else if (c.id === 'voz'){
    line(x - 6, sy, x - 22, y - 50 + bob, 7, skin);
    line(x + 6, sy, x + 26, y - 88 + bob, 7, skin);
  } else {
    const bass = c.id === 'bass';
    const body = bass ? '#b8552a' : c.id === 'gtr1' ? '#c21f3a' : '#f2efe6';
    // mástil
    line(x + 10, y - 54 + bob, x + (bass ? 66 : 52), y - (bass ? 96 : 86) + bob, 5, '#6b3b1d');
    ctx.fillStyle = '#140b22'; ctx.save(); ctx.translate(x + (bass ? 68 : 54), y - (bass ? 97 : 87) + bob); ctx.rotate(-0.6);
    ctx.fillRect(-2, -5, 12, 10); ctx.restore();
    // cuerpo
    ctx.fillStyle = body; ctx.strokeStyle = '#140b22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 2, y - 46 + bob, 17, 13, -0.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 13, y - 56 + bob, 11, 9, -0.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#140b22'; ctx.fillRect(x - 2, y - 52 + bob, 10, 4);
    line(x - 6, sy, x + 4, y - 48 + bob, 7, skin);
    line(x + 8, sy, x + (bass ? 46 : 38), y - (bass ? 82 : 76) + bob, 7, skin);
  }

  // cabeza grande con la foto
  const hx = x + 2, hy = y - 112 + bob;
  faceCircle(c.id, hx, hy, 32, '#fff4dc');

  if (c.id === 'voz'){  // micrófono delante de la boca
    line(x + 27, y - 88 + bob, x + 31, y - 102 + bob, 6, '#2b2440');
    ctx.fillStyle = '#9a93a8'; ctx.beginPath(); ctx.arc(x + 31, y - 106 + bob, 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#5c5568'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawHUD(){
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff4dc';
  ctx.font = '30px Bungee, Impact, sans-serif';
  ctx.shadowColor = '#140b22'; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
  ctx.fillText(g.score.toLocaleString('es-AR'), 22, 48);
  const m = mult();
  if (m > 1){ const w = ctx.measureText(g.score.toLocaleString('es-AR')).width;
    ctx.fillStyle = '#ffb627'; ctx.font = '20px Bungee, sans-serif'; ctx.fillText('x' + m, 34 + w, 46); }
  ctx.shadowColor = 'transparent';
  for (let i = 0; i < g.maxLives; i++) heart(34 + i * 30, 76, i < g.lives);
  // progreso del tema
  const bw = 320, bx = (W - bw) / 2, prog = Math.min(1, g.t / g.dur);
  ctx.fillStyle = 'rgba(255,244,220,.2)'; rrect(bx, 20, bw, 8, 4); ctx.fill();
  ctx.fillStyle = song.light; rrect(bx, 20, Math.max(8, bw * prog), 8, 4); ctx.fill();
  ctx.fillStyle = '#fff4dc'; ctx.font = '600 13px Archivo, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${song.title}  ${fmt(g.t)} / ${fmt(g.dur)}`, W/2, 46);
  if (g.t < 4){ ctx.globalAlpha = Math.min(1, 4 - g.t); ctx.font = '18px Bungee, sans-serif';
    ctx.fillText('Saltá con espacio o tocando la pantalla', W/2, 170); ctx.globalAlpha = 1; }
}
function heart(x, y, full){
  ctx.save(); ctx.translate(x, y); ctx.beginPath();
  ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8);
  ctx.fillStyle = full ? '#ff4f79' : 'rgba(255,244,220,.2)'; ctx.fill(); ctx.restore();
}

// =====================================================================
//  LOOP PRINCIPAL
// =====================================================================
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const inGame = g && (state === 'playing' || state === 'paused' || state === 'end');
  if (state === 'playing') update(dt);
  else if (state === 'end' && g){ for (const q of g.parts){ q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 600*dt; q.life -= dt; } }

  ctx.save();
  if (inGame && g.shake) ctx.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake);
  const d = inGame ? g.dist : now * 0.15;
  const light = inGame ? song.light : '#ffb627';
  const pulse = inGame ? g.pulse : Math.exp(-((now / 1000) % 0.6) * 7);
  drawWorld(d, pulse, light);

  if (inGame){
    const t = g.t;
    for (let i = g.oi; i < g.objs.length; i++){
      const o = g.objs[i]; if (o.x === undefined) continue; if (o.x > W + 150) break;
      if (o.type === 'amp' || o.type === 'stack') drawObstacle(o);
      else if (!o.got) (o.type === 'pick' ? drawPick : drawVinyl)(o.dx ?? o.x, o.dy ?? o.y, t);
    }
    const p = g.p;
    if (!(p.inv > 0 && Math.floor(p.inv * 12) % 2)) drawMusician(char, PX, p.y, g.dist / 38, !p.ground);
    for (const q of g.parts){ ctx.globalAlpha = Math.max(0, q.life / .6); ctx.fillStyle = q.color; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
    ctx.globalAlpha = 1;
    drawHUD();
  }
  ctx.restore();
  requestAnimationFrame(frame);
}

resize();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(resize);
requestAnimationFrame(frame);
