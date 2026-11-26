// hud.js — one job: the instruments and on-screen text.
// Everything the player needs to fly is here: altitude, speed, heading,
// throttle, fuel, damage, mission, and messages. Nothing here moves the plane.
//
// Layout fix: the top bar is two rows tall. Row 1 (y 20 / 48) holds the
// four instruments and the fuel / damage bars. Row 2 (y 76) holds the
// compass strip alone, centred, with its caret below it. The throttle
// value and the compass labels can never overlap now, because they live
// on different rows. The mission line sits below the bar at y 112.

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = "rgba(16,32,46,0.75)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * frac), h - 4);
  ctx.strokeStyle = "#f4ead8";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#f4ead8";
  ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y - 6);
}

export function drawHud(ctx, w, h, plane, stage, message, time) {
  ctx.save();
  // Top bar, two rows tall.
  ctx.fillStyle = "rgba(16,32,46,0.78)";
  ctx.fillRect(0, 0, w, 88);
  ctx.fillStyle = "#f4ead8";
  ctx.textAlign = "left";
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
  ctx.fillText("ALTITUDE", 18, 20);
  ctx.fillText("SPEED", 178, 20);
  ctx.fillText("HEADING", 338, 20);
  ctx.fillText("THROTTLE", 498, 20);
  ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
  ctx.fillText(Math.round(plane.alt) + " ft", 18, 48);
  ctx.fillText(Math.round(plane.speed) + " kt", 178, 48);
  ctx.fillText(String(Math.round(plane.heading)).padStart(3, "0") + "°", 338, 48);
  ctx.fillText(Math.round(plane.throttle) + "%", 498, 48);

  // Compass strip, alone on row 2, centred. No instrument value shares
  // this row, so no label can ever sit on top of a number.
  ctx.textAlign = "center";
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
  const dirs = ["N 000", "NE 045", "E 090", "SE 135", "S 180", "SW 225", "W 270", "NW 315"];
  dirs.forEach((d, i) => {
    const deg = i * 45;
    let diff = ((deg - plane.heading + 540) % 360) - 180;
    const x = w / 2 + diff * 2.1;
    if (Math.abs(diff) < 80) {
      ctx.fillStyle = Math.abs(diff) < 8 ? "#f2a65a" : "rgba(244,234,216,0.65)";
      ctx.fillText(d, x, 76);
    }
  });
  ctx.fillStyle = "#f2a65a";
  ctx.beginPath(); ctx.moveTo(w / 2, 84); ctx.lineTo(w / 2 - 6, 76); ctx.lineTo(w / 2 + 6, 76); ctx.closePath(); ctx.fill();

  // Fuel and damage, top right, on row 1.
  const fuelColor = plane.fuel < 25 ? "#ff5a4e" : "#57e389";
  bar(ctx, w - 250, 22, 110, 12, plane.fuel / 100, fuelColor, "FUEL " + Math.round(plane.fuel) + "%");
  const dmgColor = plane.damage > 60 ? "#ff5a4e" : plane.damage > 25 ? "#f2a65a" : "#57e389";
  bar(ctx, w - 120, 22, 100, 12, plane.damage / 100, dmgColor, "DMG " + Math.round(plane.damage) + "%");

  // Mission line, below the top bar.
  ctx.textAlign = "left";
  ctx.fillStyle = "#f2a65a";
  ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
  ctx.fillText(stage.name + "  ·  " + stage.brief, 18, 112);
  ctx.fillStyle = "#f4ead8";
  ctx.font = "14px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("SCORE " + plane.score + "   ·   RINGS " + plane.ringsHit + " / " + (plane.ringsHit + plane.ringsMissed), w - 18, 112);

  // Artificial horizon: a small lit instrument, bottom left.
  const ix = 78, iy = h - 78, ir = 52;
  ctx.save();
  ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#3d6f8e"; ctx.fillRect(ix - ir, iy - ir, ir * 2, ir * 2);
  ctx.save();
  ctx.translate(ix, iy);
  ctx.rotate((-plane.roll * Math.PI) / 180);
  ctx.translate(0, plane.pitch * 2);
  ctx.fillStyle = "#6a9a44"; ctx.fillRect(-ir, 0, ir * 2, ir);
  ctx.restore();
  ctx.strokeStyle = "#f4ead8"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ix - 26, iy); ctx.lineTo(ix + 26, iy); ctx.stroke();
  ctx.fillStyle = "#f2a65a";
  ctx.beginPath(); ctx.moveTo(ix, iy - 8); ctx.lineTo(ix - 6, iy + 2); ctx.lineTo(ix + 6, iy + 2); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Centre message (ring hit, warning, landing result), fading with time.
  if (message && message.until > time) {
    const alpha = Math.min(1, (message.until - time) / 0.8);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = message.color || "#ffd98a";
    ctx.strokeStyle = "rgba(16,32,46,0.8)";
    ctx.lineWidth = 5;
    ctx.strokeText(message.text, w / 2, 190);
    ctx.fillText(message.text, w / 2, 190);
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "#f4ead8";
    if (message.sub) ctx.fillText(message.sub, w / 2, 218);
    ctx.globalAlpha = 1;
  }

  // Low fuel / low altitude warnings, bottom centre.
  if (plane.fuel < 25 || plane.alt < 300) {
    const blink = Math.floor(time * 3) % 2 === 0;
    if (blink) {
      ctx.textAlign = "center";
      ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#ff5a4e";
      const warn = plane.fuel < 25 ? "LOW FUEL — throttle back and land soon" : "LOW ALTITUDE — pull up";
      ctx.fillText(warn, w / 2, h - 24);
    }
  }
  ctx.restore();
}

export function drawEndScreen(ctx, w, h, title, lines) {
  ctx.fillStyle = "rgba(10,28,46,0.82)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2a65a";
  ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, w / 2, h / 2 - 70);
  ctx.fillStyle = "#f4ead8";
  ctx.font = "18px 'Trebuchet MS', sans-serif";
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 20 + i * 30));
  ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#ffd98a";
  ctx.fillText("Press R to fly again", w / 2, h / 2 + 110);
}
