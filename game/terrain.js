// terrain.js — one job: the world the player flies over.
// Deterministic terrain: the same seed always builds the same valley,
// so a flight can be learned and the game stays fair on replay.
// No drawing of the aircraft or HUD here — terrain only.

import { seededRandom } from "./physics.js";

// Mountains the player must clear or fly around. Each has a distance
// along the route, a lateral centre, a width and a height in feet.
export function buildMountains() {
  const rnd = seededRandom(20261126);
  const list = [];
  for (let i = 0; i < 14; i++) {
    const d = 900 + i * 620 + rnd() * 260;
    list.push({
      distance: d,
      x: (rnd() - 0.5) * 260,
      width: 34 + rnd() * 42,
      height: 500 + rnd() * 900, // feet — low ones are passable, tall ones are not
    });
  }
  return list;
}

// River centreline as a function of distance: a slow, readable S-curve.
export function riverX(distance) {
  return Math.sin(distance / 1400) * 70 + Math.sin(distance / 520) * 22;
}

// The runway: a single strip at the end of the route.
export const RUNWAY = {
  distance: 9200,
  x: 0,
  width: 26, // metres
  label: "SUNSET FIELD — RWY 09",
};

export function mountainAt(mountains, distance, x) {
  for (const m of mountains) {
    if (Math.abs(distance - m.distance) < 26 && Math.abs(x - m.x) < m.width / 2) return m;
  }
  return null;
}

// --- Drawing helpers (canvas 2D, palette chosen once, used everywhere) ---
export const PALETTE = {
  skyTop: "#16324f",
  skyMid: "#3d6f8e",
  skyLow: "#f2a65a",
  sun: "#ffd98a",
  mountainFar: "#5b7a94",
  mountainNear: "#33506a",
  fieldA: "#4a7c3a",
  fieldB: "#6a9a44",
  fieldC: "#8a7a3a",
  river: "#3f8fb5",
  runway: "#2b2f36",
  runwayMark: "#f4ead8",
};

export function drawSky(ctx, w, horizonY, time) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY + 40);
  // Low sun, fixed in the sky so the scene always reads as dusk.
  const sx = w * 0.72, sy = horizonY - 118;
  const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 90);
  sg.addColorStop(0, PALETTE.sun);
  sg.addColorStop(1, "rgba(255,217,138,0)");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
  // Slow clouds.
  ctx.fillStyle = "rgba(244,234,216,0.55)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 271 + time * 6) % (w + 240)) - 120;
    const cy = 54 + i * 34;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 38, cy + 6, 44, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMountains(ctx, w, horizonY, distance, planeX) {
  const layers = [
    { color: PALETTE.mountainFar, amp: 74, speed: 0.12, base: 0 },
    { color: PALETTE.mountainNear, amp: 108, speed: 0.3, base: 26 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= w; x += 32) {
      const n = Math.sin((x + distance * layer.speed - planeX * 2) / 210) * 0.6
        + Math.sin((x * 1.7 + distance * 0.07) / 160) * 0.4;
      ctx.lineTo(x, horizonY - layer.base - Math.abs(n) * layer.amp - 8);
    }
    ctx.lineTo(w, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawGround(ctx, w, h, horizonY, distance, planeX) {
  // Patchwork fields in perspective: bands that scroll with distance.
  const groundH = h - horizonY;
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands, t1 = (i + 1) / bands;
    const y0 = horizonY + t0 * t0 * groundH;
    const y1 = horizonY + t1 * t1 * groundH;
    const row = Math.floor((distance / 180 + i) % 3);
    ctx.fillStyle = [PALETTE.fieldA, PALETTE.fieldB, PALETTE.fieldC][row];
    ctx.fillRect(0, y0, w, Math.max(2, y1 - y0));
    // Field boundaries, converging slightly toward the centre.
    ctx.strokeStyle = "rgba(16,32,46,0.25)";
    ctx.lineWidth = 1;
    for (let f = -3; f <= 3; f++) {
      const cx = w / 2 - planeX * (0.4 + t1);
      ctx.beginPath();
      ctx.moveTo(cx + f * 190 * (0.3 + t1), y0);
      ctx.lineTo(cx + f * 190 * (0.3 + t1), y1);
      ctx.stroke();
    }
  }
  // The river, winding down the valley toward the viewer.
  ctx.strokeStyle = PALETTE.river;
  ctx.lineCap = "round";
  for (let i = 0; i < bands; i++) {
    const t = (i + 0.5) / bands;
    const y = horizonY + t * t * groundH;
    const rx = w / 2 + (riverX(distance - (1 - t) * 900) - planeX) * (0.35 + t * 1.1);
    ctx.lineWidth = 4 + t * 16;
    ctx.beginPath(); ctx.moveTo(rx, y - 6); ctx.lineTo(rx, y + 10); ctx.stroke();
  }
}

export function drawRunway(ctx, w, h, horizonY, distance, planeX) {
  // Runway ahead: a trapezoid that grows as you approach it.
  const toGo = RUNWAY.distance - distance;
  if (toGo < -120 || toGo > 5200) return;
  const closeness = 1 - Math.max(0, toGo) / 5200; // 0 far, 1 on top of it
  const topW = 6 + closeness * 26;
  const botW = 26 + closeness * 260;
  const topY = horizonY + 8;
  const botY = h - 8;
  const cx = w / 2 - planeX * (0.5 + closeness);
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(cx - topW, topY); ctx.lineTo(cx + topW, topY);
  ctx.lineTo(cx + botW, botY); ctx.lineTo(cx - botW, botY);
  ctx.closePath(); ctx.fill();
  // Centreline dashes and threshold bars.
  ctx.fillStyle = PALETTE.runwayMark;
  const dashes = 6;
  for (let i = 0; i < dashes; i++) {
    const t = i / dashes;
    const y = topY + (botY - topY) * t;
    const dw = 2 + t * 8;
    ctx.fillRect(cx - dw / 2, y, dw, 10 + t * 16);
  }
  ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4ead8";
  if (toGo > 0) ctx.fillText(RUNWAY.label + "  —  " + Math.round(toGo) + " m", cx, topY - 10);
}
