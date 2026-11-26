// missions.js — one job: what the player has to do, in what order.
// Three sorties in one flight. Each ring is a target the player flies
// through; the runway is the final test. Nothing here draws or moves the plane.

import { seededRandom } from "./physics.js";
import { RUNWAY } from "./terrain.js";

export const STAGES = [
  { id: "rings", name: "1 · Ring Run", brief: "Fly through all 5 rings. Gentle banks win — hard turns bleed speed." },
  { id: "river", name: "2 · River Run", brief: "Follow the river low. Rings are low and the mountains are tall. Stay above 400 ft." },
  { id: "landing", name: "3 · Final Approach", brief: "Line up on the runway, slow below 150 kt, descend under 200 ft, and touch down." },
];

// Rings: {distance, x, alt (feet), radius (feet of tolerance), passed, missed}
export function buildRings() {
  const rnd = seededRandom(777);
  const rings = [];
  // Stage 1 — five rings, mid-altitude, spread across the valley.
  const xs1 = [-70, 55, -30, 80, 0];
  const alts1 = [1300, 1000, 1500, 1100, 1250];
  xs1.forEach((x, i) => rings.push({
    distance: 900 + i * 750, x, alt: alts1[i], radius: 260, stage: 0, passed: false, missed: false,
  }));
  // Stage 2 — four rings low over the river.
  for (let i = 0; i < 4; i++) {
    rings.push({
      distance: 5100 + i * 700,
      x: Math.sin((5100 + i * 700) / 1400) * 70,
      alt: 550 + rnd() * 250, radius: 220, stage: 1, passed: false, missed: false,
    });
  }
  return rings;
}

export function stageForDistance(distance) {
  if (distance < 4800) return 0;
  if (distance < RUNWAY.distance - 1400) return 1;
  return 2;
}

export function ringsRemaining(rings, stage) {
  return rings.filter((r) => r.stage === stage && !r.passed && !r.missed).length;
}

// Check rings as the player passes their distance. Returns a list of events:
// {type: "ring", ring} or {type: "miss", ring}.
export function checkRings(rings, plane) {
  const events = [];
  for (const ring of rings) {
    if (ring.passed || ring.missed) continue;
    if (plane.distance < ring.distance) continue;
    // The player just passed this ring's distance: were they inside it?
    const dx = Math.abs(plane.x - ring.x);
    const da = Math.abs(plane.alt - ring.alt);
    const inside = dx < 55 && da < ring.radius;
    if (inside) {
      ring.passed = true;
      plane.ringsHit += 1;
      plane.score += 100;
      events.push({ type: "ring", ring });
    } else {
      ring.missed = true;
      plane.ringsMissed += 1;
      events.push({ type: "miss", ring });
    }
  }
  return events;
}

// Landing check: only meaningful on the final approach, near the runway.
export function landingVerdict(plane) {
  const toGo = RUNWAY.distance - plane.distance;
  if (toGo > 60 || toGo < -60) return null; // not at the runway yet
  const aligned = Math.abs(plane.x - RUNWAY.x) < 16 && Math.abs(plane.heading - 90) < 14;
  const slow = plane.speed < 150;
  const low = plane.alt < 200;
  if (aligned && slow && low) return { ok: true, reason: "Touchdown! Slow, low and lined up." };
  if (!aligned) return { ok: false, reason: "Off the centreline — you missed the runway." };
  if (!slow) return { ok: false, reason: "Too fast to land — you overshot the runway." };
  return { ok: false, reason: "Too high — you flew over the runway." };
}
