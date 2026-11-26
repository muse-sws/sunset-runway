// app.js — one job: run the game. Input, game loop, state and wiring.
// It owns no physics, terrain, mission, drawing or sound logic itself —
// it calls physics.js, terrain.js, missions.js, aircraft.js, hud.js and
// audio.js, each of which does one clear job.

import { createPlane, stepPlane, addDamage, clamp } from "./physics.js";
import { buildMountains, drawSky, drawMountains, drawGround, drawRunway, mountainAt, RUNWAY } from "./terrain.js";
import { STAGES, buildRings, stageForDistance, checkRings, landingVerdict } from "./missions.js";
import { drawAircraft, drawRing } from "./aircraft.js";
import { drawHud, drawEndScreen } from "./hud.js";
import { createAudio } from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const W = canvas.width, H = canvas.height;

const audio = createAudio();
let plane = createPlane();
let mountains = buildMountains();
let rings = buildRings();
let state = "menu"; // menu | playing | paused | over
let message = null; // {text, sub, color, until}
let endTitle = "", endLines = [];
let landingChecked = false;
let time = 0, lastTs = 0;

const keys = new Set();
let mouse = { x: W / 2, y: H / 2, active: false };

function showMessage(text, sub, color, seconds = 2.4) {
  message = { text, sub: sub || "", color: color || "#ffd98a", until: time + seconds };
}

function reset() {
  plane = createPlane();
  mountains = buildMountains();
  rings = buildRings();
  landingChecked = false;
  message = null;
  endTitle = ""; endLines = [];
}

function startGame() {
  reset();
  state = "playing";
  overlay.classList.add("hidden");
  audio.start();
  showMessage("Take off! Ring Run ahead.", "Fly through the rings — gentle banks save fuel.", "#57e389", 3);
}

// --- Input: keyboard + mouse, nothing else. ---
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyR" && state !== "menu") startGame();
  if (e.code === "KeyP" && state === "playing") state = "paused";
  else if (e.code === "KeyP" && state === "paused") state = "playing";
  if (e.code === "KeyM") audio.toggleMute();
  if (e.code === "Enter" && state === "menu") startGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
  mouse.active = true;
});
canvas.addEventListener("mousedown", () => { mouse.boost = true; });
window.addEventListener("mouseup", () => { mouse.boost = false; });
startBtn.addEventListener("click", startGame);

function readInput() {
  let turn = 0, pitch = 0, throttleDelta = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) turn -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) turn += 1;
  if (keys.has("ArrowUp")) pitch += 1;
  if (keys.has("ArrowDown")) pitch -= 1;
  if (keys.has("KeyW")) throttleDelta += 1;
  if (keys.has("KeyS")) throttleDelta -= 1;
  if (keys.has("Space")) { plane.roll = 0; turn = 0; } // level the wings
  // Mouse steering: position relative to centre steers, gently.
  if (mouse.active && state === "playing") {
    const mx = (mouse.x - W / 2) / (W / 2);
    const my = (mouse.y - H / 2) / (H / 2);
    if (Math.abs(mx) > 0.12) turn = clamp(turn + mx * 0.8, -1, 1);
    if (Math.abs(my) > 0.15) pitch = clamp(pitch - my * 0.8, -1, 1);
  }
  return { turn, pitch, throttleDelta, boost: !!mouse.boost };
}

function endGame(win, title, lines) {
  state = "over";
  endTitle = title; endLines = lines;
  if (win) audio.fanfare(); else audio.thud();
}

function update(dt) {
  const input = readInput();
  stepPlane(plane, input, dt);
  audio.engine(plane.throttle, plane.speed);

  // Rings.
  for (const ev of checkRings(rings, plane)) {
    if (ev.type === "ring") {
      showMessage("Ring! +100", "Clean flying — " + plane.ringsHit + " rings so far.", "#57e389");
      audio.chime();
    } else {
      showMessage("Ring missed", "Keep the next one in sight.", "#f2a65a");
    }
  }

  // Mountains: hitting one costs damage and throws you up and slow.
  const m = mountainAt(mountains, plane.distance, plane.x);
  if (m && !m.hit && plane.alt < m.height) {
    m.hit = true;
    plane.alt = Math.min(3200, plane.alt + 220);
    plane.speed = Math.max(70, plane.speed - 45);
    const destroyed = addDamage(plane, 35);
    showMessage(destroyed ? "Mountain strike!" : "Mountain strike! −35 hull", "Climb higher or fly around the peaks.", "#ff5a4e");
    audio.thud();
    if (destroyed) return endGame(false, "Aircraft lost", [
      "Your hull gave out after the mountain strikes.",
      "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit,
    ]);
  }

  // Stage changes.
  const stage = stageForDistance(plane.distance);
  if (stage === 1 && !update._s1) { update._s1 = true; showMessage("River Run", "Follow the river low — rings are low, mountains are tall.", "#ffd98a", 3); }
  if (stage === 2 && !update._s2) { update._s2 = true; showMessage("Final Approach", "Runway ahead. Slow below 150 kt, descend under 200 ft.", "#ffd98a", 3); }
  if (stage === 0) { update._s1 = false; update._s2 = false; }

  // Out of fuel: you are gliding. Land it or go down.
  if (plane.fuel <= 0 && plane.alt <= 0) {
    return endGame(false, "Out of fuel", ["You glided down short of the runway.", "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit]);
  }

  // Ground contact outside the runway.
  if (plane.alt <= 0 && plane.distance < RUNWAY.distance - 60) {
    return endGame(false, "Crashed", [
      "You hit the ground short of the runway.",
      "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit,
    ]);
  }

  // Landing, at the runway.
  if (!landingChecked && plane.distance >= RUNWAY.distance - 60) {
    landingChecked = true;
    const verdict = landingVerdict(plane);
    if (verdict && verdict.ok) {
      plane.score += 500 + Math.round(plane.fuel) * 2;
      return endGame(true, "Landed!", [
        verdict.reason,
        "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit + " / " + (plane.ringsHit + plane.ringsMissed),
        "Fuel left: " + Math.round(plane.fuel) + "%  ·  Damage: " + Math.round(plane.damage) + "%",
      ]);
    }
    if (verdict) {
      return endGame(false, "Landing failed", [
        verdict.reason,
        "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit,
      ]);
    }
  }
  if (plane.distance > RUNWAY.distance + 200) {
    return endGame(false, "Overshot", ["You flew past the runway.", "Score: " + plane.score + "  ·  Rings: " + plane.ringsHit]);
  }
}

function render() {
  const horizonY = clamp(320 - plane.pitch * 4 - (plane.alt - 1200) * 0.015, 220, 420);
  drawSky(ctx, W, horizonY, time);
  drawMountains(ctx, W, horizonY, plane.distance, plane.x);
  drawGround(ctx, W, H, horizonY, plane.distance, plane.x);
  drawRunway(ctx, W, H, horizonY, plane.distance, plane.x);
  // Next two rings ahead, nearest first.
  const upcoming = rings.filter((r) => !r.passed && !r.missed && r.distance >= plane.distance).slice(0, 2);
  for (const ring of upcoming) drawRing(ctx, W, horizonY, plane, ring);
  drawAircraft(ctx, W, H, plane, time);
  const stage = STAGES[stageForDistance(plane.distance)];
  drawHud(ctx, W, H, plane, stage, message, time);
  if (state === "paused") {
    ctx.fillStyle = "rgba(10,28,46,0.7)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f2a65a";
    ctx.font = "bold 40px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused — press P to fly on", W / 2, H / 2);
  }
  if (state === "over") drawEndScreen(ctx, W, H, endTitle, endLines);
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  time += dt;
  if (state === "playing") update(dt);
  render();
  requestAnimationFrame(loop);
}

// Menu backdrop: render a parked scene behind the overlay.
render();
requestAnimationFrame(loop);
