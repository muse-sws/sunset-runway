// aircraft.js — one job: drawing the aircraft and the rings / target ahead.
// The chase view: the aircraft sits low-centre in frame, the world moves
// around it. The aircraft banks with the roll, so turns read instantly.
//
// Rings fix: the old rings grew to a 320 px diameter with a fat black
// centre and filled the sky. Rings are now smaller and thinner — at most
// about 225 px across, with a small dark hub and a crisp amber rim — so
// they still read clearly as rings ahead without hiding the terrain,
// the runway or the next ring.

export function drawAircraft(ctx, w, h, plane, time) {
  const cx = w / 2;
  const cy = h * 0.72;
  const bank = (plane.roll * Math.PI) / 180;
  const scale = 1 + plane.speed / 900; // a little larger as you go faster
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank * 0.55);
  ctx.scale(scale, scale);

  // Engine glow, stronger with throttle.
  const glow = ctx.createRadialGradient(0, 26, 2, 0, 26, 34 + plane.throttle * 0.3);
  glow.addColorStop(0, "rgba(255,190,90,0.85)");
  glow.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 26, 34 + plane.throttle * 0.3, 0, Math.PI * 2); ctx.fill();

  // Wings.
  ctx.fillStyle = "#d97b2f";
  ctx.beginPath();
  ctx.moveTo(-118, 18); ctx.lineTo(-18, 2); ctx.lineTo(-14, 16); ctx.lineTo(-112, 34); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(118, 18); ctx.lineTo(18, 2); ctx.lineTo(14, 16); ctx.lineTo(112, 34); ctx.closePath(); ctx.fill();
  // Wing tips, lit.
  ctx.fillStyle = "#ffd98a";
  ctx.fillRect(-120, 20, 8, 10);
  ctx.fillRect(112, 20, 8, 10);

  // Fuselage, seen from behind and slightly above.
  ctx.fillStyle = "#e8e2d2";
  ctx.beginPath(); ctx.ellipse(0, 6, 22, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2b4a63";
  ctx.beginPath(); ctx.ellipse(0, -6, 15, 20, 0, 0, Math.PI * 2); ctx.fill(); // canopy
  ctx.fillStyle = "#f2a65a";
  ctx.fillRect(-22, 2, 44, 6); // cheatline

  // Tail fin and stabilisers.
  ctx.fillStyle = "#1f6f6b";
  ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(4, -34); ctx.lineTo(10, -8); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d97b2f";
  ctx.fillRect(-34, -12, 68, 7);

  // Navigation lights: left red, right green, blinking tail strobe.
  ctx.fillStyle = "#ff5a4e"; ctx.beginPath(); ctx.arc(-118, 25, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#57e389"; ctx.beginPath(); ctx.arc(118, 25, 4, 0, Math.PI * 2); ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, -36, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// A target ring ahead, projected onto the screen. The closer it is, the
// larger it reads — but never so large it hides the sky. distanceTo is
// ring.distance - plane.distance; closeness runs 0 (far) to 1 (on top).
export function drawRing(ctx, w, horizonY, plane, ring) {
  const toGo = ring.distance - plane.distance;
  if (toGo < -80 || toGo > 3600) return;
  const closeness = 1 - Math.max(0, toGo) / 3600;
  const sx = w / 2 + (ring.x - plane.x) * (0.6 + closeness * 2.2);
  const sy = horizonY - 40 - (ring.alt - plane.alt) * (0.02 + closeness * 0.22);
  const r = 18 + closeness * closeness * 95; // 18 far, ~113 close
  ctx.save();
  ctx.strokeStyle = ring.passed ? "#57e389" : "#ffd98a";
  ctx.lineWidth = 4 + closeness * 4;
  ctx.shadowColor = "#ffd98a";
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // Small dark hub, so the ring reads as a ring, not a solid disc.
  ctx.fillStyle = "#10202e";
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(8, r * 0.20), 0, Math.PI * 2); ctx.fill();
  // Distance label, clear of the rim.
  ctx.fillStyle = "#f4ead8";
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(Math.round(toGo) + " m", sx, sy - r - 8);
  ctx.restore();
}
