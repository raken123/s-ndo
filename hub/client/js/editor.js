// Tile map editor for custom games: paint walls with mouse or touch.
window.Editor = (function () {
  let canvas, ctx, game, tool = 'wall', painting = false, onChange = null;
  const T = 24;

  function mount(cv, g, changed) {
    canvas = cv; ctx = cv.getContext('2d'); game = g; onChange = changed;
    addBorder();
    cv.onpointerdown = (e) => { painting = true; cv.setPointerCapture(e.pointerId); paint(e); };
    cv.onpointermove = (e) => { if (painting) paint(e); };
    cv.onpointerup = cv.onpointercancel = () => { painting = false; };
    draw();
  }
  function setTool(t) { tool = t; }
  function tileAt(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const x = Math.floor((e.clientX - r.left) * sx / T), y = Math.floor((e.clientY - r.top) * sy / T);
    if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return -1;
    return y * game.cols + x;
  }
  function isBorder(i) { const x = i % game.cols, y = Math.floor(i / game.cols); return x === 0 || y === 0 || x === game.cols - 1 || y === game.rows - 1; }
  function paint(e) {
    const i = tileAt(e); if (i < 0 || isBorder(i)) return;
    const set = new Set(game.walls);
    if (tool === 'wall') set.add(i); else set.delete(i);
    game.walls = [...set];
    draw(); onChange && onChange();
  }
  function resize(cols, rows) {
    // keep walls by coordinate when the grid changes
    const old = new Set(game.walls), oc = game.cols;
    const walls = [];
    for (const i of old) { const x = i % oc, y = Math.floor(i / oc); if (x < cols && y < rows) walls.push(y * cols + x); }
    game.cols = cols; game.rows = rows; game.walls = walls;
    addBorder(); draw();
  }
  function addBorder() {
    const set = new Set(game.walls);
    for (let x = 0; x < game.cols; x++) { set.add(x); set.add((game.rows - 1) * game.cols + x); }
    for (let y = 0; y < game.rows; y++) { set.add(y * game.cols); set.add(y * game.cols + game.cols - 1); }
    game.walls = [...set];
  }
  function clear() { game.walls = []; addBorder(); draw(); onChange && onChange(); }
  function random() {
    clear();
    const set = new Set(game.walls);
    const n = Math.floor(game.cols * game.rows * 0.12);
    for (let k = 0; k < n; k++) {
      const x = 2 + Math.floor(Math.random() * (game.cols - 4)), y = 2 + Math.floor(Math.random() * (game.rows - 4));
      const len = 1 + Math.floor(Math.random() * 3), horiz = Math.random() < 0.5;
      for (let j = 0; j < len; j++) { const xx = horiz ? x + j : x, yy = horiz ? y : y + j; if (xx < game.cols - 1 && yy < game.rows - 1) set.add(yy * game.cols + xx); }
    }
    game.walls = [...set]; draw(); onChange && onChange();
  }
  function draw() {
    if (!canvas) return;
    canvas.width = game.cols * T; canvas.height = game.rows * T;
    ctx.fillStyle = game.theme.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath();
    for (let x = 0; x <= game.cols; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, canvas.height); }
    for (let y = 0; y <= game.rows; y++) { ctx.moveTo(0, y * T); ctx.lineTo(canvas.width, y * T); }
    ctx.stroke();
    ctx.fillStyle = game.theme.wall;
    for (const i of game.walls) ctx.fillRect((i % game.cols) * T + 1, Math.floor(i / game.cols) * T + 1, T - 2, T - 2);
    if (game.mode === 'koth') {
      ctx.fillStyle = game.theme.accent + '55';
      ctx.beginPath(); ctx.arc(game.cols * T / 2, game.rows * T / 2, T * 2.2, 0, 7); ctx.fill();
    }
  }
  return { mount, setTool, resize, clear, random, draw, addBorder };
})();
