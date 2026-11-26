// hud.js — the instrument panel: big ALT / SPD / HDG readouts, the
// mission line (ring, clock, score), a centre message banner, and a
// canvas artificial horizon with speed and altitude tapes — the lit
// instruments the chase view carries.

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.alt = document.getElementById('altValue');
    this.spd = document.getElementById('spdValue');
    this.hdg = document.getElementById('hdgValue');
    this.thr = document.getElementById('thrValue');
    this.ring = document.getElementById('ringValue');
    this.clock = document.getElementById('clockValue');
    this.messageEl = document.getElementById('message');
    this.horizon = document.getElementById('horizon').getContext('2d');
    this.messageTimer = 0;
  }

  showMessage(text, seconds = 1.6) {
    this.messageEl.textContent = text;
    this.messageEl.style.opacity = '1';
    this.messageTimer = seconds;
  }

  update(dt, plane, course, elapsed, score) {
    this.alt.textContent = String(Math.max(0, Math.round(plane.position.y * 3.281)));
    this.spd.textContent = String(Math.round(plane.speed * 1.944));
    this.hdg.textContent = String(Math.round(plane.headingDeg)).padStart(3, '0');
    this.thr.textContent = `${Math.round(plane.throttle * 100)}%`;
    this.ring.textContent = course.done
      ? 'ALL RINGS — LAND ON THE STRIP'
      : `RING ${course.nextIndex + 1} / ${course.total}`;
    this.clock.textContent = `TIME ${formatClock(elapsed)} · SCORE ${score}`;
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageEl.style.opacity = '0';
    }
    this.drawHorizon(plane);
  }

  // Artificial horizon: the ball rolls and pitches with the aircraft,
  // flanked by a speed tape (left) and an altitude tape (right).
  drawHorizon(plane) {
    const ctx = this.horizon;
    const W = 212, H = 118;
    ctx.clearRect(0, 0, W, H);
    // Ball.
    const cx = 106, cy = 59, r = 46;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(plane.roll);
    const pitchPx = Math.max(-r, Math.min(r, plane.pitch * 90));
    ctx.fillStyle = '#2e7fc2';
    ctx.fillRect(-r - 4, -r - 4 + pitchPx, (r + 4) * 2, r + 4);
    ctx.fillStyle = '#8a6b42';
    ctx.fillRect(-r - 4, pitchPx, (r + 4) * 2, r + 4);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r - 4, pitchPx); ctx.lineTo(r + 4, pitchPx); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,240,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx + 26, cy);
    ctx.stroke();
    // Tapes.
    this.drawTape(ctx, 8, plane.speed * 1.944, 'KT');
    this.drawTape(ctx, 176, Math.max(0, plane.position.y * 3.281), 'FT');
  }

  drawTape(ctx, x, value, unit) {
    const y0 = 14, y1 = 104;
    ctx.fillStyle = 'rgba(10, 26, 42, 0.85)';
    ctx.fillRect(x, y0, 28, y1 - y0);
    ctx.strokeStyle = 'rgba(160, 210, 255, 0.6)';
    ctx.strokeRect(x, y0, 28, y1 - y0);
    ctx.fillStyle = '#cfe6ff';
    ctx.font = '9px Verdana';
    ctx.textAlign = 'center';
    const step = unit === 'KT' ? 20 : 100;
    const base = Math.round(value / step) * step;
    for (let k = -2; k <= 2; k++) {
      const v = base + k * step;
      if (v < 0) continue;
      const y = 59 - (v - value) * (unit === 'KT' ? 1.1 : 0.22);
      if (y < y0 + 8 || y > y1 - 8) continue;
      if (Math.abs(y - 59) < 11) continue; // the current-value readout owns the centre
      ctx.fillText(String(v), x + 14, y + 3);
    }
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 10px Verdana';
    ctx.fillText(String(Math.round(value)), x + 14, 59 + 3);
    ctx.fillStyle = '#9fc6e8';
    ctx.font = '8px Verdana';
    ctx.fillText(unit, x + 14, y1 - 2 + 8);
  }
}
