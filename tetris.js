(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30; // board canvas is 300x600

  const boardCanvas = document.getElementById("board");
  const bctx = boardCanvas.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nctx = nextCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");

  // Tetromino definitions: shape matrix + color
  const PIECES = {
    I: { color: "#38c6ff", shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { color: "#ffd23a", shape: [[1, 1], [1, 1]] },
    T: { color: "#a24bff", shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { color: "#3aff7a", shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { color: "#ff4b6b", shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { color: "#4b7bff", shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { color: "#ff9f4b", shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  };
  const KEYS = Object.keys(PIECES);

  // ---- Game state ----
  let grid, current, nextPiece, bag;
  let score, lines, level;
  let dropInterval, dropCounter, lastTime;
  let running = false;
  let paused = false;
  let gameOver = false;
  let rafId = null;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // 7-bag randomizer for fair piece distribution
  function nextFromBag() {
    if (bag.length === 0) {
      bag = KEYS.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const key = bag.pop();
    return { key, color: PIECES[key].color, shape: PIECES[key].shape.map((r) => r.slice()) };
  }

  function spawn() {
    nextPiece = nextFromBag();
    current = {
      key: nextPiece.key,
      color: nextPiece.color,
      shape: nextPiece.shape,
      x: Math.floor((COLS - nextPiece.shape[0].length) / 2),
      y: 0,
    };
    if (collides(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function collides(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const gx = ox + c;
        const gy = oy + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function merge(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const gy = oy + r;
          const gx = ox + c;
          if (gy >= 0) grid[gy][gx] = current.color;
        }
      }
    }
  }

  function rotate(shape) {
    // 90° clockwise: transpose then reverse rows
    const n = shape.length;
    const res = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        res[c][n - 1 - r] = shape[r][c];
      }
    }
    return res;
  }

  function tryRotate() {
    const rotated = rotate(current.shape);
    // simple wall kicks: try offsets 0, -1, +1, -2, +2
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(rotated, current.x + dx, current.y)) {
        current.shape = rotated;
        current.x += dx;
        return;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((cell) => cell)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // re-check same index after shift
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(80, 1000 - (level - 1) * 90);
      }
      updateStats();
    }
  }

  function lockPiece() {
    merge(current.shape, current.x, current.y);
    clearLines();
    if (!gameOver) spawn();
    else draw();
  }

  function hardDrop() {
    while (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 2;
    }
    updateStats();
    lockPiece();
    dropCounter = 0;
  }

  function move(dir) {
    if (!collides(current.shape, current.x + dir, current.y)) {
      current.x += dir;
    }
  }

  function softDrop() {
    if (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  // ---- Rendering ----
  function drawCell(ctx, x, y, color, size) {
    const px = x * size;
    const py = y * size;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px, py, size, size * 0.18);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  function drawGridLines() {
    bctx.strokeStyle = "rgba(255,255,255,0.04)";
    bctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      bctx.beginPath();
      bctx.moveTo(c * CELL, 0);
      bctx.lineTo(c * CELL, ROWS * CELL);
      bctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      bctx.beginPath();
      bctx.moveTo(0, r * CELL);
      bctx.lineTo(COLS * CELL, r * CELL);
      bctx.stroke();
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collides(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function draw() {
    bctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGridLines();

    // settled blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawCell(bctx, c, r, grid[r][c], CELL);
      }
    }

    if (current) {
      // ghost piece
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++) {
        for (let c = 0; c < current.shape[r].length; c++) {
          if (current.shape[r][c]) {
            const py = gy + r;
            if (py >= 0) {
              bctx.fillStyle = "rgba(255,255,255,0.12)";
              bctx.fillRect((current.x + c) * CELL, py * CELL, CELL, CELL);
            }
          }
        }
      }
      // active piece
      for (let r = 0; r < current.shape.length; r++) {
        for (let c = 0; c < current.shape[r].length; c++) {
          if (current.shape[r][c]) {
            const py = current.y + r;
            if (py >= 0) drawCell(bctx, current.x + c, py, current.color, CELL);
          }
        }
      }
    }
  }

  function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const size = 24;
    const shape = nextPiece.shape;
    const off = (nextCanvas.width - shape[0].length * size) / 2;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(nctx, Math.floor((off + c * size) / size), r, nextPiece.color, size);
      }
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }

  // ---- Loop ----
  function loop(time) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (paused || gameOver) return;

    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
    draw();
  }

  function start() {
    grid = emptyGrid();
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = performance.now();
    running = true;
    paused = false;
    gameOver = false;
    overlay.classList.add("hidden");
    updateStats();
    spawn();
    draw();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    startBtn.textContent = "Restart";
    pauseBtn.textContent = "Pause";
  }

  function endGame() {
    gameOver = true;
    running = false;
    overlayTitle.textContent = "GAME OVER";
    overlaySub.textContent = "Score: " + score + " — press Start";
    overlay.classList.remove("hidden");
    draw();
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) {
      overlayTitle.textContent = "PAUSED";
      overlaySub.textContent = "Press P to resume";
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  // ---- Touch / pointer controls ----
  function doAction(action) {
    if (!running) return;
    if (action === "pause") {
      togglePause();
      return;
    }
    if (paused || gameOver) return;
    switch (action) {
      case "left":
        move(-1);
        break;
      case "right":
        move(1);
        break;
      case "down":
        softDrop();
        break;
      case "rotate":
        tryRotate();
        break;
      case "drop":
        hardDrop();
        break;
    }
    draw();
  }

  // ---- Input ----
  document.addEventListener("keydown", (e) => {
    if (!running) return;
    switch (e.key) {
      case "ArrowLeft":
        if (!paused && !gameOver) move(-1);
        e.preventDefault();
        break;
      case "ArrowRight":
        if (!paused && !gameOver) move(1);
        e.preventDefault();
        break;
      case "ArrowDown":
        if (!paused && !gameOver) softDrop();
        e.preventDefault();
        break;
      case "ArrowUp":
      case "x":
        if (!paused && !gameOver) tryRotate();
        e.preventDefault();
        break;
      case " ":
        if (!paused && !gameOver) hardDrop();
        e.preventDefault();
        break;
      case "p":
      case "P":
        togglePause();
        break;
    }
    if (running && !paused && !gameOver) draw();
  });

  // ---- Touch / pointer controls ----
  const tbtns = document.querySelectorAll("#touch-controls .tbtn");
  const repeatTimers = {};

  function holdRepeat(action) {
    doAction(action);
    repeatTimers[action] = setInterval(() => doAction(action), 130);
  }
  function stopRepeat(action) {
    if (repeatTimers[action]) {
      clearInterval(repeatTimers[action]);
      delete repeatTimers[action];
    }
  }

  tbtns.forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (action === "rotate" || action === "drop") {
        doAction(action);
      } else {
        holdRepeat(action);
      }
    });
    const end = (e) => {
      e.preventDefault();
      stopRepeat(action);
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("pointerleave", () => stopRepeat(action));
  });

  // Stop page scroll / zoom while interacting with the play area
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.target.closest(".game")) e.preventDefault();
    },
    { passive: false }
  );

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", togglePause);

  // initial idle render
  grid = emptyGrid();
  draw();
})();
