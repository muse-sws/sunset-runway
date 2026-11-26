// physics.js — one job: how the aircraft moves. No drawing, no input here.
// Units: speed in knots, altitude in feet, heading in degrees (90 = east),
// lateral offset x in metres from the centreline, distance in metres along the route.

export function createPlane() {
  return {
    alt: 1200,          // feet
    speed: 170,         // knots
    heading: 90,        // degrees
    throttle: 62,       // percent
    pitch: 0,           // degrees, + = climbing
    roll: 0,            // degrees of bank, + = right
    x: 0,               // lateral offset, metres
    fuel: 100,          // percent
    damage: 0,          // percent, 100 = destroyed
    distance: 0,        // metres flown
    score: 0,
    ringsHit: 0,
    ringsMissed: 0,
  };
}

// Deterministic pseudo-random helper, so terrain and missions are stable
// for a given seed and never depend on Math.random() at run time.
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

// input: {turn (-1..1), pitch (-1..1), throttleDelta (-1..1), boost}
// dt in seconds. Returns nothing; mutates plane in place.
export function stepPlane(plane, input, dt) {
  // Throttle: gentle, deliberate changes — slamming it wastes fuel.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * 28 * dt, 0, 100);

  // Bank follows the turn input; heading follows the bank.
  // A hard bank at low speed bleeds speed; a gentle bank holds it.
  const targetRoll = input.turn * 42;
  plane.roll = lerp(plane.roll, targetRoll, clamp(dt * 3.2, 0, 1));
  plane.heading = (plane.heading + plane.roll * 0.55 * dt + 360) % 360;

  // Pitch follows the pitch input, limited by speed: too slow and you sink.
  const targetPitch = input.pitch * 14;
  plane.pitch = lerp(plane.pitch, targetPitch, clamp(dt * 2.6, 0, 1));

  // Speed chases the throttle setting, with drag at high pitch / bank.
  const targetSpeed = 60 + plane.throttle * 2.4;
  const drag = Math.abs(plane.pitch) * 0.9 + Math.abs(plane.roll) * 0.35;
  plane.speed = lerp(plane.speed, Math.max(55, targetSpeed - drag), clamp(dt * 0.55, 0, 1));
  if (input.boost) plane.speed = Math.min(340, plane.speed + 26 * dt);

  // Altitude: pitch is what climbs and descends. Level flight (pitch 0)
  // holds altitude; below 95 knots you sink even with the nose up.
  const climbRate = plane.pitch * 12 + (plane.speed < 95 ? (plane.speed - 95) * 1.2 : 0);
  plane.alt += clamp(climbRate, -220, 220) * dt;
  plane.alt = Math.max(0, Math.min(3200, plane.alt));

  // Lateral movement follows heading: heading 90 is straight ahead.
  // Turning away from 90 drifts you off the centreline; turning back recovers.
  const headingRad = ((plane.heading - 90) * Math.PI) / 180;
  plane.x += Math.sin(headingRad) * plane.speed * 0.514 * dt * 1.4;
  plane.x = clamp(plane.x, -220, 220);

  // Distance flown, and fuel: high throttle burns more, gliding burns little.
  plane.distance += plane.speed * 0.514 * dt;
  const burn = (0.10 + plane.throttle * 0.005 + (input.boost ? 0.5 : 0)) * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);
  if (plane.fuel <= 0) {
    plane.throttle = 0; // out of fuel: you are gliding now, speed will decay
  }
}

export function addDamage(plane, amount) {
  plane.damage = clamp(plane.damage + amount, 0, 100);
  return plane.damage >= 100;
}

export function isCrashed(plane) {
  return plane.damage >= 100 || (plane.alt <= 0 && plane.speed > 40);
}
