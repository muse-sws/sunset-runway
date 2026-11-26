// Pacific Strike — Atomic Bomb Run, 1945.
// A 3D flight game: B-29 Superfortress flies from the Pacific to Japan,
// fights off interceptors, then drops the atomic bomb on the target city.
// Static files only, no network at runtime, Three.js vendored locally.
// ---------------------------------------------------------------------------

(function () {
'use strict';

// ---------- utilities ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var rand = mulberry32(19450806);
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function $(id) { return document.getElementById(id); }

// ---------- screenshot / debug hooks ----------
var params = new URLSearchParams(location.search);
var SHOT = params.get('shot') || null;      // ocean | dogfight | bombrun | explosion
var frameCount = 0;
window.__shotReady = false;

// ---------- world constants ----------
var COAST_X = 800;          // ocean x < 800, land beyond
var CITY_X = 1900, CITY_Z = 0, CITY_R = 520;   // target city centre
var TARGET = { x: 1900, z: 0 };                // bomb target (factory district)
var WORLD = { minX: -2600, maxX: 4200, minZ: -2600, maxZ: 2600 };

// Terrain height: below sea level west of the coast, beach ramp, hills inland, flat city.
// The coastline itself wanders with z so it is not a straight line.
function coastX(z) { return 800 + 120 * Math.sin(z * 0.0012) + 60 * Math.sin(z * 0.0031 + 2); }
function groundHeight(x, z) {
  var d = x - coastX(z);           // <0: sea, 0..160: beach, >160: land
  if (d < -160) return -6;
  if (d < 0) return -6 + (d + 160) / 160 * 6;
  var beach = clamp(d / 160, 0, 1);   // 0..1 across the beach
  var h = beach * 10;
  if (d > 160) {
    var n = Math.sin(x * 0.004 + 1.7) * Math.cos(z * 0.005 + 0.6) +
            Math.sin((x + z) * 0.0016 + 4.2) * 0.7 +
            Math.sin(z * 0.011 + x * 0.002) * 0.4;
    h += beach * (14 + n * 12);
  }
  // flatten the city bowl
  var dx = (x - CITY_X) / CITY_R, dz = (z - CITY_Z) / CITY_R;
  var d2 = dx * dx + dz * dz;
  if (d2 < 1) {
    var f = 1 - d2;
    h = lerp(h, 8, f * 0.92);
  }
  return Math.max(0, h);
}

// ---------- renderer / scene ----------
var container = $('game-container');
var renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('webgl-error').classList.remove('hidden');
  $('menu').classList.add('hidden');
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbcd4e6, 900, 7000);
var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 20000);
camera.position.set(-1600, 400, 0);

var hemi = new THREE.HemisphereLight(0xcfe4ff, 0x3a5a3a, 0.85);
scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff2cf, 1.35);
sun.position.set(-1200, 1600, 900);
scene.add(sun);

// Sky dome: gradient shader (no fog on it).
var skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color(0x2f6fb4) },
    mid: { value: new THREE.Color(0x9cc8e8) },
    bot: { value: new THREE.Color(0xf2e3c2) }
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
    'void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));' +
    ' gl_FragColor = vec4(c, 1.0); }'
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(9500, 24, 16), skyMat));

// Sun disc + glow sprite (canvas texture, generated locally).
(function addSunDisc() {
  var c = document.createElement('canvas'); c.width = c.height = 256;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.25, 'rgba(255,236,170,0.9)');
  grad.addColorStop(0.6, 'rgba(255,210,120,0.25)');
  grad.addColorStop(1, 'rgba(255,210,120,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  var tex = new THREE.CanvasTexture(c);
  var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  spr.scale.set(2200, 2200, 1);
  spr.position.set(-5200, 1500, 2600);
  scene.add(spr);
})();

// ---------- ocean ----------
(function buildOcean() {
  var geo = new THREE.PlaneGeometry(14000, 9000, 72, 48);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.004 + z * 0.003) * 1.1 + Math.cos(x * 0.011 - z * 0.007) * 0.6);
  }
  geo.computeVertexNormals();
  var mat = new THREE.MeshPhongMaterial({ color: 0x1d5f8f, shininess: 90, specular: 0x88bbdd, flatShading: false });
  var ocean = new THREE.Mesh(geo, mat);
  ocean.position.set(-1600, -1, 0);
  scene.add(ocean);
  // lighter sparkle patches (thin transparent planes just above the water, open ocean only)
  var patchMat = new THREE.MeshBasicMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.08, depthWrite: false });
  for (var p = 0; p < 14; p++) {
    var pg = new THREE.PlaneGeometry(500 + rand() * 700, 180 + rand() * 260);
    pg.rotateX(-Math.PI / 2);
    var patch = new THREE.Mesh(pg, patchMat);
    patch.position.set(-2600 + rand() * 2200, 1.2, -2400 + rand() * 4800);
    scene.add(patch);
  }
})();

// ---------- terrain (coast, hills, city bowl) ----------
(function buildTerrain() {
  var geo = new THREE.PlaneGeometry(6800, 5600, 150, 140);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position;
  var colors = new Float32Array(pos.count * 3);
  var sand = new THREE.Color(0xd9c48f), grass = new THREE.Color(0x5d7d43),
      hill = new THREE.Color(0x4a6b38), rock = new THREE.Color(0x8a7f72),
      city = new THREE.Color(0x8a8178);
  var tmp = new THREE.Color();
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i) + 1200, z = pos.getZ(i);   // plane centred at x=1200
    var h = groundHeight(x, z);
    pos.setY(i, h);
    var dx = (x - CITY_X) / CITY_R, dz = (z - CITY_Z) / CITY_R;
    var inCity = (dx * dx + dz * dz) < 1;
    if (x < coastX(z)) tmp.copy(sand);
    else if (inCity) tmp.copy(city);
    else if (h > 42) tmp.copy(rock);
    else tmp.copy(grass).lerp(hill, clamp(h / 45, 0, 1));
    // subtle variation
    var v = 0.92 + rand() * 0.16;
    colors[i * 3] = tmp.r * v; colors[i * 3 + 1] = tmp.g * v; colors[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var terrain = new THREE.Mesh(geo, mat);
  terrain.position.set(1200, 0, 0);
  scene.add(terrain);
})();

// ---------- city buildings ----------
var CITY_BUILDINGS = 150;
(function buildCity() {
  var box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  var mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var inst = new THREE.InstancedMesh(box, mat, CITY_BUILDINGS);
  var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  var col = new THREE.Color();
  var placed = 0, guard = 0;
  while (placed < CITY_BUILDINGS && guard++ < 4000) {
    var a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (CITY_R - 60);
    var x = CITY_X + Math.cos(a) * r, z = CITY_Z + Math.sin(a) * r;
    // keep the target plaza clear
    if (Math.hypot(x - TARGET.x, z - TARGET.z) < 150) continue;
    var w = 18 + rand() * 26, d = 18 + rand() * 26, h = 14 + rand() * rand() * 58;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.3 + (rand() < 0.5 ? 0 : Math.PI / 2));
    s.set(w, h, d); t.set(x, groundHeight(x, z), z);
    m.compose(t, q, s);
    inst.setMatrixAt(placed, m);
    col.setHSL(0.08 + rand() * 0.04, 0.12 + rand() * 0.15, 0.32 + rand() * 0.3);
    inst.setColorAt(placed, col);
    placed++;
  }
  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  // factory district: taller smokestacks at the target
  var stackMat = new THREE.MeshLambertMaterial({ color: 0x6e3a2e });
  for (var i = 0; i < 5; i++) {
    var st = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 55 + rand() * 25, 10), stackMat);
    var sx = TARGET.x + (rand() - 0.5) * 130, sz = TARGET.z + (rand() - 0.5) * 130;
    st.position.set(sx, groundHeight(sx, sz) + 30, sz);
    scene.add(st);
  }
})();

// Target ring on the ground (visible bomb aim point).
var targetRing = (function () {
  var g = new THREE.Group();
  var ring = new THREE.Mesh(new THREE.RingGeometry(52, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0xff3b2d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(TARGET.x, groundHeight(TARGET.x, TARGET.z) + 2, TARGET.z);
  g.add(ring);
  var dot = new THREE.Mesh(new THREE.CircleGeometry(10, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3b2d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(TARGET.x, groundHeight(TARGET.x, TARGET.z) + 2.2, TARGET.z);
  g.add(dot);
  g.visible = false;
  scene.add(g);
  return g;
})();

// ---------- clouds ----------
var clouds = [];
(function buildClouds() {
  var mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  var puff = new THREE.SphereGeometry(1, 10, 8);
  for (var i = 0; i < 30; i++) {
    var cl = new THREE.Group();
    var n = 4 + Math.floor(rand() * 3);
    for (var j = 0; j < n; j++) {
      var p = new THREE.Mesh(puff, mat);
      p.position.set((rand() - 0.5) * 160, (rand() - 0.5) * 26, (rand() - 0.5) * 70);
      var s = 26 + rand() * 42;
      p.scale.set(s, s * 0.45, s * 0.7);
      cl.add(p);
    }
    cl.position.set(-2600 + rand() * 6200, 320 + rand() * 380, -2400 + rand() * 4800);
    scene.add(cl);
    clouds.push(cl);
  }
})();

// ---------- aircraft models ----------
function buildBomber() {
  var g = new THREE.Group();
  var silver = new THREE.MeshPhongMaterial({ color: 0xb8bcc0, shininess: 70, specular: 0x666666 });
  var dark = new THREE.MeshPhongMaterial({ color: 0x3a3f45, shininess: 40 });
  var glass = new THREE.MeshPhongMaterial({ color: 0x1c2f45, shininess: 120, specular: 0x99ccff });

  var fus = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 16, 14), silver);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  var nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), glass);
  nose.scale.set(1, 1, 1.6); nose.position.set(0, 0, -9.2); g.add(nose);
  var tail = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.9, 6, 12), silver);
  tail.rotation.x = Math.PI / 2; tail.position.set(0, 0, 10.5); g.add(tail);
  // wings (tapered boxes)
  function wing(sign) {
    var w = new THREE.Mesh(new THREE.BoxGeometry(17, 0.55, 4.6), silver);
    w.position.set(sign * 9.6, -0.4, -1.2);
    w.rotation.z = sign * -0.06;
    g.add(w);
    var tip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.0), silver);
    tip.position.set(sign * 18.6, 0.1, -1.2); g.add(tip);
    return w;
  }
  wing(1); wing(-1);
  // tailplanes + fin
  var tp = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 2.6), silver);
  tp.position.set(0, 0.4, 11.5); g.add(tp);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 3.6), silver);
  fin.position.set(0, 2.6, 11.8); fin.rotation.x = 0.25; g.add(fin);
  // US star roundel on fuselage sides
  var starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  [-1, 1].forEach(function (s) {
    var disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide }));
    disc.position.set(s * 2.62, 0.4, -2); disc.rotation.y = s * Math.PI / 2; g.add(disc);
    var star = new THREE.Mesh(new THREE.CircleGeometry(1.0, 5), starMat);
    star.position.set(s * 2.64, 0.4, -2); star.rotation.y = s * Math.PI / 2; star.rotation.z = Math.PI / 2; g.add(star);
  });
  // 4 engines with spinning props
  var props = [];
  [[-13, -2.5], [-6, -2.5], [6, -2.5], [13, -2.5]].forEach(function (p) {
    var nac = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 10), dark);
    nac.rotation.x = Math.PI / 2; nac.position.set(p[0], -0.6, p[1]); g.add(nac);
    var prop = new THREE.Group();
    var bladeMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (var b = 0; b < 3; b++) {
      var blade = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4.6), bladeMat);
      blade.rotation.z = b * Math.PI * 2 / 3;
      prop.add(blade);
    }
    var disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    prop.add(disc);
    prop.position.set(p[0], -0.6, p[1] - 2.0);
    g.add(prop); props.push(prop);
  });
  // bomb-bay doors hint + tail gun
  var bay = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 7), dark);
  bay.position.set(0, -2.55, 0.5); g.add(bay);
  g.userData.props = props;
  return g;
}

function buildZero() {
  var g = new THREE.Group();
  var green = new THREE.MeshPhongMaterial({ color: 0x4a5d3a, shininess: 40 });
  var grey = new THREE.MeshPhongMaterial({ color: 0x8a8f7a, shininess: 40 });
  var fus = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 7.5, 10), green);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  var nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), grey);
  nose.scale.set(1, 1, 1.4); nose.position.set(0, 0, -4.2); g.add(nose);
  var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 120 }));
  canopy.scale.set(1, 0.8, 1.8); canopy.position.set(0, 0.8, -0.6); g.add(canopy);
  var w = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 2.2), green);
  w.position.set(0, -0.2, -0.6); g.add(w);
  var tp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 1.4), green);
  tp.position.set(0, 0.2, 3.6); g.add(tp);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 1.6), green);
  fin.position.set(0, 1.0, 3.7); g.add(fin);
  // red hinomaru on wings + fuselage
  var red = new THREE.MeshBasicMaterial({ color: 0xc8102e, side: THREE.DoubleSide });
  [1, -1].forEach(function (s) {
    var d = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), red);
    d.rotation.x = -Math.PI / 2; d.position.set(s * 4.2, 0.02, -0.6); g.add(d);
  });
  var prop = new THREE.Group();
  for (var b = 0; b < 2; b++) {
    var blade = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.4),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    blade.rotation.z = b * Math.PI / 2;
    prop.add(blade);
  }
  prop.position.set(0, 0, -4.9);
  g.add(prop);
  g.userData.prop = prop;
  return g;
}

var plane = buildBomber();
scene.add(plane);

// ---------- game state ----------
var S = {
  phase: 'menu',           // menu | fly | dogfight | bombrun | explosion | complete | failed
  running: false, paused: false,
  pos: new THREE.Vector3(-1800, 380, 0),
  yaw: -Math.PI / 2, pitch: 0, roll: 0,
  speed: 110, throttle: 0.62,
  fuel: 100, hull: 100,
  kills: 0, shotsFired: 0, shotsHit: 0,
  bombDropped: false, bombArmed: true,
  time: 0, missionTime: 0,
  mouseX: 0, mouseY: 0, firing: false,
  shake: 0, flashT: 0
};
var PHASES = {
  fly: { title: 'MISSION 1 — LONG FLIGHT', obj: 'Fly east across the Pacific to the Japanese coast' },
  dogfight: { title: 'MISSION 2 — DOGFIGHT', obj: 'Enemy fighters inbound — shoot them down!' },
  bombrun: { title: 'MISSION 3 — BOMB RUN', obj: 'Line up the bomb sight over the target city, press B to drop' },
  explosion: { title: 'MISSION 3 — BOMB RUN', obj: 'Bomb away…' },
  complete: { title: 'MISSION COMPLETE', obj: '' },
  failed: { title: 'MISSION FAILED', obj: '' }
};
var ENEMIES_TOTAL = 5;

// ---------- input ----------
var keys = {};
window.addEventListener('keydown', function (e) {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyB') dropBomb();
  if (e.code === 'KeyF') S.firing = true;
  if (e.code === 'Enter' && S.phase === 'menu') startGame();
  initAudio();
});
window.addEventListener('keyup', function (e) {
  keys[e.code] = false;
  if (e.code === 'KeyF') S.firing = false;
});
window.addEventListener('mousemove', function (e) {
  S.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  S.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});
window.addEventListener('mousedown', function () { S.firing = true; initAudio(); });
window.addEventListener('mouseup', function () { S.firing = false; });
$('start-btn').addEventListener('click', function () { initAudio(); startGame(); });
$('restart-btn').addEventListener('click', function () { restart(); });
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- audio (synthesised, no files) ----------
var AC = null, masterGain = null, engineNodes = null, muted = false;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination);
    var o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
    var o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 78;
    var g = AC.createGain(); g.gain.value = 0.05;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(masterGain);
    o1.start(); o2.start();
    engineNodes = { o1: o1, o2: o2, g: g };
  } catch (e) { AC = null; }
}
function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
  addMessage(muted ? 'Sound muted' : 'Sound on');
}
function noiseBurst(dur, freq, vol) {
  if (!AC || muted) return;
  var len = Math.floor(AC.sampleRate * dur);
  var buf = AC.createBuffer(1, len, AC.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = AC.createBufferSource(); src.buffer = buf;
  var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  var g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start();
}
function boomSound() {
  if (!AC || muted) return;
  noiseBurst(2.2, 220, 0.9);
  var o = AC.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(140, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(28, AC.currentTime + 2.0);
  var g = AC.createGain(); g.gain.setValueAtTime(0.8, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 2.2);
  o.connect(g); g.connect(masterGain); o.start(); o.stop(AC.currentTime + 2.2);
}
function gunSound() { noiseBurst(0.09, 2400, 0.22); }

// ---------- effects: tracers, bullets, particles ----------
var tracers = [];   // {mesh, life}
var bullets = [];   // {mesh, vel, life}
var particles = []; // {mesh, vel, life, maxLife, grow}
var tracerMat = new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 });
var enemyTracerMat = new THREE.LineBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.9 });

function spawnTracer(from, to, enemy) {
  var geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  var line = new THREE.Line(geo, enemy ? enemyTracerMat : tracerMat);
  scene.add(line);
  tracers.push({ mesh: line, life: 0.09 });
}
function spawnBullet() {
  var origin = S.pos.clone();
  var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
  var left = new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion);
  var gunPos = origin.clone().addScaledVector(left, (Math.random() < 0.5 ? -13 : 13))
    .addScaledVector(fwd, -2);
  var m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  m.position.copy(gunPos);
  scene.add(m);
  bullets.push({ mesh: m, vel: fwd.clone().multiplyScalar(620).add(new THREE.Vector3(0, 0, 0)), life: 1.6 });
  spawnTracer(gunPos, gunPos.clone().addScaledVector(fwd, 90), false);
  S.shotsFired++;
  gunSound();
}
function spawnBurst(pos, color, n, speed, size, life) {
  for (var i = 0; i < n; i++) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(size * (0.6 + rand() * 0.8), 6, 5),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.95 }));
    m.position.copy(pos);
    scene.add(m);
    var v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(speed);
    particles.push({ mesh: m, vel: v, life: life * (0.6 + rand() * 0.7), maxLife: life, grow: 1.6 });
  }
}
function spawnSmoke(pos, n) {
  for (var i = 0; i < n; i++) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(2.5 + rand() * 3, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.75 }));
    m.position.copy(pos).add(new THREE.Vector3((rand() - 0.5) * 4, (rand() - 0.5) * 4, (rand() - 0.5) * 4));
    scene.add(m);
    particles.push({ mesh: m, vel: new THREE.Vector3((rand() - 0.5) * 4, 2 + rand() * 4, (rand() - 0.5) * 4), life: 2.5 + rand() * 2, maxLife: 4, grow: 2.2 });
  }
}
function updateEffects(dt) {
  for (var i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) { scene.remove(tracers[i].mesh); tracers[i].mesh.geometry.dispose(); tracers.splice(i, 1); }
  }
  for (var j = bullets.length - 1; j >= 0; j--) {
    var b = bullets[j];
    b.life -= dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    var hit = false;
    for (var k = 0; k < enemies.length; k++) {
      var e = enemies[k];
      if (e.state === 'dead' || e.state === 'crashing') continue;
      if (b.mesh.position.distanceTo(e.mesh.position) < 11) {
        hit = true;
        S.shotsHit++;
        e.hp--;
        spawnBurst(b.mesh.position, 0xffc040, 6, 26, 1.2, 0.4);
        if (e.hp <= 0) killEnemy(e);
        else if (e.hp === 1) { e.smoking = true; addMessage('Hit! Enemy fighter smoking!'); }
        break;
      }
    }
    if (hit || b.life <= 0 || b.mesh.position.y < 0) {
      scene.remove(b.mesh); bullets.splice(j, 1);
    }
  }
  for (var p = particles.length - 1; p >= 0; p--) {
    var pt = particles[p];
    pt.life -= dt;
    pt.mesh.position.addScaledVector(pt.vel, dt);
    pt.mesh.scale.multiplyScalar(1 + pt.grow * dt);
    pt.mesh.material.opacity = Math.max(0, pt.life / pt.maxLife) * 0.95;
    if (pt.life <= 0) { scene.remove(pt.mesh); pt.mesh.material.dispose(); particles.splice(p, 1); }
  }
}

// ---------- enemies ----------
var enemies = [];
function spawnEnemies(n) {
  for (var i = 0; i < n; i++) {
    var mesh = buildZero();
    var ang = (i / n) * Math.PI * 2;
    mesh.position.set(
      S.pos.x + 420 + Math.cos(ang) * 260,
      clamp(S.pos.y + (rand() - 0.5) * 220, 150, 700),
      S.pos.z + Math.sin(ang) * 320
    );
    scene.add(mesh);
    enemies.push({
      mesh: mesh, hp: 3, state: 'hunt', speed: 150 + rand() * 30,
      fireT: 1 + rand() * 2, smoking: false, smokeT: 0, spin: 0,
      vel: new THREE.Vector3()
    });
  }
  addMessage(n + ' enemy fighters inbound!');
}
function killEnemy(e) {
  e.state = 'crashing';
  e.spin = (rand() - 0.5) * 6;
  spawnBurst(e.mesh.position, 0xff8020, 16, 60, 2.5, 0.9);
  spawnSmoke(e.mesh.position, 8);
  noiseBurst(0.5, 900, 0.5);
  S.kills++;
  addKillFeed('Enemy fighter destroyed! (' + S.kills + '/' + ENEMIES_TOTAL + ')');
  if (S.kills >= ENEMIES_TOTAL && S.phase === 'dogfight') {
    setPhase('bombrun');
    targetRing.visible = true;
    addMessage('Skies clear! Proceed to the target city — bomb run.');
  }
}
function updateEnemies(dt) {
  for (var i = enemies.length - 1; i >= 0; i--) {
    var e = enemies[i];
    var m = e.mesh;
    if (e.state === 'dead') continue;
    if (e.state === 'crashing') {
      m.rotation.z += e.spin * dt;
      m.rotation.x += 1.4 * dt;
      m.position.y -= 130 * dt;
      m.position.x += Math.cos(S.yaw) * 20 * dt;
      if (Math.random() < dt * 8) spawnSmoke(m.position, 1);
      if (m.position.y <= groundHeight(m.position.x, m.position.z) + 2 || m.position.y <= 1) {
        spawnBurst(m.position, 0xff6010, 22, 70, 3, 1.1);
        spawnSmoke(m.position, 10);
        noiseBurst(0.7, 500, 0.6);
        scene.remove(m);
        e.state = 'dead';
      }
      continue;
    }
    // hunt: steer toward a point ahead of the player, weave
    var target = S.pos.clone();
    var toPlayer = target.clone().sub(m.position);
    var dist = toPlayer.length();
    // Use lookAt-style steering: compute yaw from direction
    var dir = toPlayer.clone().normalize();
    var yawT = Math.atan2(dir.x, dir.z) + Math.PI; // model faces -z; yaw that points -z along dir
    // smooth turn
    var cur = m.rotation.y;
    var diff = ((yawT - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    m.rotation.y = cur + clamp(diff, -1.6 * dt, 1.6 * dt);
    m.rotation.z = clamp(-diff * 0.5, -0.8, 0.8);
    m.rotation.x = clamp((target.y - m.position.y) * 0.001, -0.3, 0.3);
    var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(m.quaternion);
    m.position.addScaledVector(fwd, e.speed * dt);
    m.position.y = clamp(m.position.y, 120, 800);
    if (m.userData.prop) m.userData.prop.rotation.z += dt * 40;
    if (e.smoking) {
      e.smokeT -= dt;
      if (e.smokeT <= 0) { spawnSmoke(m.position, 1); e.smokeT = 0.12; }
    }
    // enemy fire
    e.fireT -= dt;
    if (e.fireT <= 0 && dist < 700 && S.phase !== 'menu') {
      e.fireT = 1.1 + rand() * 1.6;
      var from = m.position.clone();
      var aim = S.pos.clone();
      aim.x += (rand() - 0.5) * 60; aim.y += (rand() - 0.5) * 40; aim.z += (rand() - 0.5) * 60;
      spawnTracer(from, aim, true);
      noiseBurst(0.07, 1800, 0.12);
      if (dist < 480 && rand() < 0.45) {
        S.hull -= 3 + rand() * 5;
        S.shake = Math.max(S.shake, 0.5);
        flashDamage();
        addMessage('Taking fire! Hull ' + Math.max(0, Math.round(S.hull)) + '%');
        if (S.hull <= 0) failMission('Shot down by enemy fighters.');
      }
    }
  }
}

// ---------- bomb & mushroom cloud ----------
var bomb = null;      // {mesh, vel}
var explosion = null; // {group, t, pos}
function dropBomb() {
  if (!S.running || S.paused) return;
  if (S.phase !== 'bombrun' && !SHOT) { addMessage('Bomb is for the target city — finish the dogfight first.'); return; }
  if (!S.bombArmed || S.bombDropped) return;
  S.bombDropped = true; S.bombArmed = false;
  var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
  var mesh = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.2, 10),
    new THREE.MeshPhongMaterial({ color: 0x2e4d2e, shininess: 30 }));
  body.rotation.x = Math.PI / 2; mesh.add(body);
  var tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 10),
    new THREE.MeshPhongMaterial({ color: 0x8a8f7a }));
  tip.rotation.x = -Math.PI / 2; tip.position.z = -3.4; mesh.add(tip);
  var tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 1.6),
    new THREE.MeshPhongMaterial({ color: 0x8a8f7a }));
  tail.position.z = 3.2; mesh.add(tail);
  mesh.position.copy(S.pos).addScaledVector(fwd, -6);
  mesh.position.y -= 4;
  scene.add(mesh);
  bomb = { mesh: mesh, vel: fwd.clone().multiplyScalar(S.speed * 0.35) };
  addMessage('BOMB AWAY!');
  setPhase('explosion');
}
function triggerExplosion(pos) {
  var g = new THREE.Group();
  // fireball
  var fire = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.95 }));
  fire.position.set(pos.x, 30, pos.z);
  g.add(fire);
  // mushroom stem + cap (grey-orange puffs)
  var cloudMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a, transparent: true, opacity: 0.92 });
  var stem = new THREE.Mesh(new THREE.CylinderGeometry(26, 60, 260, 12), cloudMat);
  stem.position.set(pos.x, 160, pos.z);
  g.add(stem);
  var capPuffs = [];
  for (var i = 0; i < 9; i++) {
    var p = new THREE.Mesh(new THREE.SphereGeometry(46 + rand() * 30, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0x9a8a7a, transparent: true, opacity: 0.92 }));
    var a = (i / 9) * Math.PI * 2;
    p.position.set(pos.x + Math.cos(a) * (30 + rand() * 60), 300 + (rand() - 0.5) * 60, pos.z + Math.sin(a) * (30 + rand() * 60));
    g.add(p); capPuffs.push(p);
  }
  // shockwave ring on the ground
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, groundHeight(pos.x, pos.z) + 4, pos.z);
  g.add(ring);
  scene.add(g);
  explosion = { group: g, fire: fire, stem: stem, capPuffs: capPuffs, ring: ring, t: 0, pos: pos };
  S.flashT = 1;
  S.shake = 1.2;
  boomSound();
  // city damage: flatten/scorch buildings near ground zero (visual: darken a disc)
  var scorch = new THREE.Mesh(new THREE.CircleGeometry(300, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.45, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(pos.x, groundHeight(pos.x, pos.z) + 3, pos.z);
  scene.add(scorch);
  explosion.scorch = scorch;
}
function updateExplosion(dt) {
  if (!explosion) return;
  if (SHOT === 'explosion') explosion.t = Math.min(explosion.t + dt, 4.2);
  else explosion.t += dt;
  var t = explosion.t;
  var k = Math.min(1, t / 7);
  explosion.fire.scale.setScalar(20 + k * 130);
  explosion.fire.material.opacity = Math.max(0, 0.95 - t * 0.12);
  explosion.fire.material.color.setHSL(0.08, 0.9, Math.max(0.25, 0.6 - t * 0.05));
  explosion.stem.scale.set(0.4 + k * 1.4, 0.3 + k * 1.6, 0.4 + k * 1.4);
  explosion.capPuffs.forEach(function (p, i) {
    p.scale.setScalar(0.5 + k * (1.6 + (i % 3) * 0.4));
    p.position.y += dt * 22;
  });
  explosion.ring.scale.setScalar(30 + t * 260);
  explosion.ring.material.opacity = Math.max(0, 0.85 - t * 0.14);
  if (t > 7 && S.phase === 'explosion' && !SHOT) {
    var acc = S.shotsFired ? Math.round(100 * S.shotsHit / S.shotsFired) : 0;
    endMission(true, 'Target destroyed. The city is gone — the war will end soon.', [
      'Time: ' + fmtTime(S.missionTime),
      'Fighters shot down: ' + S.kills + ' / ' + ENEMIES_TOTAL,
      'Gun accuracy: ' + acc + '%',
      'Hull remaining: ' + Math.max(0, Math.round(S.hull)) + '%'
    ]);
  }
}

// ---------- HUD ----------
function fmtTime(s) {
  var m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}
function addMessage(text) {
  var box = $('messages');
  var div = document.createElement('div');
  div.textContent = '> ' + text;
  box.appendChild(div);
  while (box.children.length > 5) box.removeChild(box.firstChild);
}
function addKillFeed(text) {
  var box = $('kill-feed');
  var div = document.createElement('div');
  div.textContent = text;
  box.appendChild(div);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 6000);
}
function flashDamage() {
  var el = $('damage-flash');
  el.style.opacity = '1';
  setTimeout(function () { el.style.opacity = '0'; }, 220);
}
function setPhase(p) {
  S.phase = p;
  var info = PHASES[p];
  if (info) {
    $('mission-title').textContent = info.title;
    $('mission-objective').textContent = info.obj;
  }
  if (p === 'dogfight') {
    $('mission-progress').textContent = 'Fighters destroyed: 0 / ' + ENEMIES_TOTAL;
  } else if (p === 'bombrun') {
    $('mission-progress').textContent = 'Target: factory district — follow the red ring';
    $('bombsight').classList.remove('hidden');
  } else if (p === 'explosion') {
    $('mission-progress').textContent = '';
  }
}
function updateHUD() {
  var altFt = Math.round(S.pos.y * 3.28084);
  var mph = Math.round(S.speed * 2.23694);
  var hdg = Math.round(((-S.yaw * 180 / Math.PI) % 360 + 360) % 360);
  $('hud-alt').textContent = altFt.toLocaleString('en-US');
  $('hud-spd').textContent = mph;
  $('hud-hdg').textContent = ('00' + hdg).slice(-3);
  $('hud-thr').textContent = Math.round(S.throttle * 100);
  var fuelEl = $('hud-fuel');
  fuelEl.textContent = Math.max(0, Math.round(S.fuel));
  fuelEl.classList.toggle('low', S.fuel < 25);
  var hullEl = $('hud-hull');
  hullEl.textContent = Math.max(0, Math.round(S.hull));
  hullEl.classList.toggle('low', S.hull < 35);
  $('hud-ammo').textContent = S.firing ? 'FIRING' : 'READY';
  $('hud-bomb').textContent = S.bombArmed ? '1 ARMED' : (S.bombDropped ? 'DROPPED' : '—');
  if (S.phase === 'fly') {
    var d = Math.max(0, Math.round((COAST_X - S.pos.x) / 100) / 10);
    $('mission-progress').textContent = 'Distance to coast: ' + d.toFixed(1) + ' km';
  } else if (S.phase === 'dogfight') {
    $('mission-progress').textContent = 'Fighters destroyed: ' + S.kills + ' / ' + ENEMIES_TOTAL;
  } else if (S.phase === 'bombrun') {
    var td = Math.hypot(TARGET.x - S.pos.x, TARGET.z - S.pos.z);
    $('mission-progress').textContent = 'Distance to target: ' + (td / 1000).toFixed(2) + ' km';
    var locked = td < 420 && S.pos.y < 900;
    $('bombsight').classList.toggle('locked', locked);
    $('bombsight-label').textContent = locked ? 'ON TARGET — PRESS B TO DROP' : 'BOMB SIGHT — LINE UP OVER THE RED RING';
  }
  // compass strip
  var points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var strip = '';
  for (var i = -2; i <= 2; i++) {
    var idx = (((Math.round(hdg / 45) + i) % 8) + 8) % 8;
    strip += (i === 0 ? '[' : ' ') + points[idx] + (i === 0 ? ']' : ' ');
  }
  $('compass-strip').textContent = strip;
  // artificial horizon
  $('horizon-line').style.transform = 'rotate(' + (-S.roll * 57.3) + 'deg) translateY(' + (-S.pitch * 60) + 'px)';
}

// ---------- mission flow ----------
function startGame() {
  $('menu').classList.add('hidden');
  $('end-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.running = true;
  setPhase('fly');
  addMessage('B-29 airborne from Tinian. Course 090, climb to 10,000 ft.');
}
function restart() {
  location.reload();
}
function togglePause() {
  if (!S.running) return;
  S.paused = !S.paused;
  $('paused').classList.toggle('hidden', !S.paused);
}
function failMission(reason) {
  if (S.phase === 'failed' || S.phase === 'complete') return;
  S.running = false;
  setPhase('failed');
  endMission(false, reason, [
    'Time: ' + fmtTime(S.missionTime),
    'Fighters shot down: ' + S.kills + ' / ' + ENEMIES_TOTAL,
    'Distance flown: ' + (Math.max(0, (S.pos.x + 1800)) / 1000).toFixed(1) + ' km'
  ]);
}
function endMission(win, body, stats) {
  S.running = false;
  $('hud').classList.add('hidden');
  $('end-title').textContent = win ? 'MISSION COMPLETE' : 'MISSION FAILED';
  $('end-body').textContent = body;
  $('end-stats').innerHTML = stats.map(function (s) { return '<div>' + s + '</div>'; }).join('');
  $('end-screen').classList.remove('hidden');
}

// ---------- flight model ----------
var fireT = 0;
function updateFlight(dt) {
  // throttle
  if (keys['KeyW']) S.throttle += 0.25 * dt;
  if (keys['KeyS']) S.throttle -= 0.25 * dt;
  S.throttle = clamp(S.throttle, 0.25, 1);
  // pitch / roll targets from keyboard + mouse
  var pitchIn = 0, rollIn = 0;
  if (keys['ArrowUp']) pitchIn += 1;
  if (keys['ArrowDown']) pitchIn -= 1;
  if (keys['ArrowLeft'] || keys['KeyA']) rollIn -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) rollIn += 1;
  var pitchTarget = clamp(pitchIn * 0.32 - S.mouseY * 0.22, -0.5, 0.5);
  var rollTarget = clamp(rollIn * 0.85 - S.mouseX * 0.55, -1.1, 1.1);
  if (keys['Space']) { pitchTarget = 0; rollTarget = 0; }
  S.pitch = lerp(S.pitch, pitchTarget, 1 - Math.exp(-dt * 2.2));
  S.roll = lerp(S.roll, rollTarget, 1 - Math.exp(-dt * 2.6));
  // turning follows bank
  S.yaw -= S.roll * 0.55 * dt * (0.6 + S.speed / 220);
  // speed follows throttle
  var targetSpeed = 60 + S.throttle * 130;
  S.speed = lerp(S.speed, targetSpeed, 1 - Math.exp(-dt * 0.5));
  // climb / descend follows pitch
  var fwd = new THREE.Vector3();
  fwd.set(
    -Math.sin(S.yaw) * Math.cos(S.pitch),
    Math.sin(S.pitch),
    -Math.cos(S.yaw) * Math.cos(S.pitch)
  );
  S.pos.addScaledVector(fwd, S.speed * dt);
  // stall: too slow + nose up sinks
  if (S.speed < 75 && S.pitch > 0.1) S.pos.y -= (75 - S.speed) * 0.35 * dt;
  // world bounds: gentle turn-back at the edges
  if (S.pos.x > WORLD.maxX || S.pos.x < WORLD.minX || Math.abs(S.pos.z) > WORLD.maxZ) {
    addMessage('Turn back — leaving the combat zone!');
    S.yaw += Math.PI * dt * 0.25;
  }
  S.pos.y = clamp(S.pos.y, 25, 1400);
  // terrain / water collision
  var gh = groundHeight(S.pos.x, S.pos.z);
  if (S.pos.y <= gh + 6) {
    if (S.phase === 'explosion' || S.phase === 'complete') { S.pos.y = gh + 6; }
    else failMission(S.pos.x < COAST_X ? 'Ditched in the Pacific.' : 'Crashed into the terrain.');
  }
  // fuel burn
  S.fuel -= dt * 0.12;
  if (S.fuel <= 0) { S.fuel = 0; S.throttle = Math.max(0.25, S.throttle - dt * 0.2); }
  // apply to the mesh
  plane.position.copy(S.pos);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = S.yaw;
  plane.rotation.x = S.pitch;
  plane.rotation.z = S.roll;
  plane.userData.props.forEach(function (p) { p.rotation.z += dt * (18 + S.throttle * 30); });
  // guns
  fireT -= dt;
  if (S.firing && fireT <= 0 && S.running) {
    fireT = 0.11;
    spawnBullet();
  }
  // phase triggers
  if (S.phase === 'fly' && S.pos.x > COAST_X - 60) {
    setPhase('dogfight');
    spawnEnemies(ENEMIES_TOTAL);
  }
  // bomb physics
  if (bomb) {
    bomb.vel.y -= 29.4 * dt;
    bomb.mesh.position.addScaledVector(bomb.vel, dt);
    bomb.mesh.rotation.x += dt * 0.6;
    var bgh = groundHeight(bomb.mesh.position.x, bomb.mesh.position.z);
    if (bomb.mesh.position.y <= bgh + 2) {
      var bp = bomb.mesh.position.clone();
      scene.remove(bomb.mesh);
      bomb = null;
      triggerExplosion(bp);
    }
  }
  S.missionTime += dt;
}

// ---------- camera ----------
var camPos = new THREE.Vector3(-1900, 420, 0);
var CAM_BACK = SHOT ? 30 : 42, CAM_UP = SHOT ? 8 : 11;
function updateCamera(dt) {
  var back = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
  var up = new THREE.Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
  var desired = S.pos.clone().addScaledVector(back, CAM_BACK).addScaledVector(up, CAM_UP);
  var k = 1 - Math.exp(-dt * 4.5);
  camPos.lerp(desired, k);
  if (S.shake > 0) {
    camPos.x += (Math.random() - 0.5) * S.shake * 6;
    camPos.y += (Math.random() - 0.5) * S.shake * 6;
    camPos.z += (Math.random() - 0.5) * S.shake * 6;
    S.shake = Math.max(0, S.shake - dt * 0.9);
  }
  camera.position.copy(camPos);
  var look = S.pos.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion), 90);
  look.y += 4;
  if (explosion && S.phase === 'explosion') {
    // frame both the plane and the mushroom cloud
    look.lerp(explosion.pos.clone().setY(220), 0.25);
  }
  camera.lookAt(look);
}

// ---------- screenshot modes (deterministic staged scenes) ----------
function applyShotMode() {
  if (!SHOT) return;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.running = true;
  if (SHOT === 'ocean') {
    S.pos.set(-350, 330, -60); S.yaw = -Math.PI / 2; S.pitch = 0.02; S.throttle = 0.7;
    setPhase('fly');
    addMessage('B-29 airborne from Tinian. Course 090.');
  } else if (SHOT === 'dogfight') {
    S.pos.set(950, 400, 0); S.yaw = -Math.PI / 2; S.pitch = 0; S.throttle = 0.75;
    setPhase('dogfight');
    spawnEnemies(4);
    enemies.forEach(function (e, i) {
      e.mesh.position.set(S.pos.x + 260 + i * 60, 380 + (i % 2) * 60, -260 + i * 150);
    });
    S.firing = true;
  } else if (SHOT === 'bombrun') {
    S.pos.set(1300, 320, 60); S.yaw = -Math.PI / 2; S.pitch = -0.02; S.throttle = 0.7;
    setPhase('bombrun');
    targetRing.visible = true;
    addMessage('Bomb run — line up over the red ring.');
  } else if (SHOT === 'explosion') {
    S.pos.set(950, 520, 520); S.yaw = -1.08; S.pitch = -0.05; S.throttle = 0.6;
    S.bombArmed = false; S.bombDropped = true;
    setPhase('explosion');
    triggerExplosion(new THREE.Vector3(TARGET.x, 0, TARGET.z));
    explosion.t = 3.2; // pre-grown mushroom cloud
    updateExplosion(0);
    addMessage('BOMB AWAY!');
  }
}

// ---------- main loop ----------
var last = performance.now();
var hudT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;
  frameCount++;
  if (S.running && !S.paused) {
    updateFlight(dt);
    updateEnemies(dt);
    // dogfight screenshot tableau: keep the enemy fighters staged in view ahead of the plane
    if (SHOT === 'dogfight') {
      var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
      var right = new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion);
      enemies.forEach(function (e, i) {
        if (e.state === 'dead' || e.state === 'crashing') return;
        e.mesh.position.copy(S.pos)
          .addScaledVector(fwd, 250 + i * 55)
          .addScaledVector(right, -190 + i * 135);
        e.mesh.position.y = S.pos.y + (i % 2 ? 45 : -25) + Math.sin(S.time * 1.4 + i) * 8;
        e.mesh.rotation.y = Math.PI / 2; // head-on, flying at the player
      });
    }
    updateExplosion(dt);
    hudT -= dt;
    if (hudT <= 0) { updateHUD(); hudT = 0.12; }
  }
  updateEffects(dt);
  updateCamera(dt);
  // clouds drift slowly
  clouds.forEach(function (c, i) { c.position.x += dt * (2 + (i % 3)); if (c.position.x > 4200) c.position.x = -2800; });
  // flash overlay decay
  if (S.flashT > 0) {
    S.flashT = Math.max(0, S.flashT - dt * 0.55);
    $('flash').style.opacity = String(S.flashT * 0.9);
  }
  // target ring pulse
  if (targetRing.visible) {
    var s = 1 + Math.sin(S.time * 3) * 0.06;
    targetRing.scale.set(s, s, 1);
  }
  renderer.render(scene, camera);
  if (frameCount === 45) window.__shotReady = true;
}

applyShotMode();
if (!SHOT) updateHUD();
requestAnimationFrame(loop);

// debug / verification hook
window.__game = S;
window.__enemies = enemies;

})();
