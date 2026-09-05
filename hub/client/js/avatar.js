// Draws a player avatar (body, face, hat) on a 2D context. Shared by the game, shop and profile.
window.Avatar = (function () {
  function hat(ctx, kind, r) {
    ctx.save();
    ctx.lineWidth = Math.max(1, r * 0.12);
    if (kind === 'cap') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.75, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r * 0.2, -r * 0.62, r * 1.3, r * 0.22);
    } else if (kind === 'crown') {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.7, -r * 1.3); ctx.lineTo(-r * 0.3, -r * 0.85);
      ctx.lineTo(0, -r * 1.4); ctx.lineTo(r * 0.3, -r * 0.85); ctx.lineTo(r * 0.7, -r * 1.3); ctx.lineTo(r * 0.7, -r * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.14, 0, 7); ctx.fill();
    } else if (kind === 'halo') {
      ctx.strokeStyle = '#fff3a0'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = r * 0.6;
      ctx.beginPath(); ctx.ellipse(0, -r * 1.25, r * 0.7, r * 0.22, 0, 0, 7); ctx.stroke();
    } else if (kind === 'horns') {
      ctx.fillStyle = '#d64545';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.45, -r * 0.7); ctx.quadraticCurveTo(s * r * 0.9, -r * 1.1, s * r * 0.55, -r * 1.45); ctx.quadraticCurveTo(s * r * 0.75, -r * 0.95, s * r * 0.2, -r * 0.85); ctx.closePath(); ctx.fill(); }
    } else if (kind === 'top') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(-r * 0.8, -r * 0.95, r * 1.6, r * 0.18);
      ctx.fillRect(-r * 0.5, -r * 1.7, r * 1.0, r * 0.85);
      ctx.fillStyle = '#7c3aed'; ctx.fillRect(-r * 0.5, -r * 1.05, r * 1.0, r * 0.16);
    }
    ctx.restore();
  }
  /** Draw at (x,y) with radius r. opts: {color, hat, it, vip, name, score, dx, dy} */
  function draw(ctx, x, y, r, o) {
    ctx.save(); ctx.translate(x, y);
    if (o.vip) { ctx.shadowColor = '#ffd166'; ctx.shadowBlur = r * 1.2; }
    if (o.it) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = r * 1.6; }
    ctx.fillStyle = o.color || '#4cc2ff';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
    // eyes look toward movement
    const dx = o.dx || 0, dy = o.dy || 0, l = Math.hypot(dx, dy) || 1;
    const ex = (dx / l) * r * 0.25, ey = (dy / l) * r * 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.3 + ex, -r * 0.15 + ey, r * 0.24, 0, 7); ctx.arc(r * 0.3 + ex, -r * 0.15 + ey, r * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-r * 0.3 + ex * 1.4, -r * 0.15 + ey * 1.4, r * 0.11, 0, 7); ctx.arc(r * 0.3 + ex * 1.4, -r * 0.15 + ey * 1.4, r * 0.11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (o.hat && o.hat !== 'none') hat(ctx, o.hat, r);
    ctx.restore();
  }
  function trailColor(kind, i) {
    if (kind === 'fire') return ['#ff9f1c', '#ff4d00', '#ffd166'][i % 3];
    if (kind === 'rainbow') return 'hsl(' + ((i * 47) % 360) + ',95%,60%)';
    if (kind === 'spark') return ['#ffffff', '#cfe9ff', '#9ad0ff'][i % 3];
    return null;
  }
  return { draw, trailColor };
})();
