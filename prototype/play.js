const kind = new URLSearchParams(location.search).get("game") || "orbit",
  c = document.getElementById("canvas"),
  ctx = c.getContext("2d"),
  button = document.getElementById("action"),
  message = document.getElementById("message"),
  scoreLabel = document.getElementById("score");
let width = 0,
  height = 0,
  raf = 0,
  last = 0,
  playing = false,
  score = 0,
  angle = -Math.PI / 2,
  attempts = 0,
  blocks = [],
  moving = { x: 0, w: 100 },
  direction = 1,
  ended = false,
  phase = "idle",
  signalTimer = null,
  readyAt = 0;
function resize() {
  const dpr = devicePixelRatio || 1;
  width = c.clientWidth;
  height = c.clientHeight;
  c.width = width * dpr;
  c.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!playing) draw();
}
const canvasPalettes = {
  light: {
    ink: "#1f2328",
    muted: "#59636e",
    line: "#c4cbd3",
    ready: "#dafbe1",
    waiting: "#fff1e5",
    idle: "#ddf4ff",
  },
  dark: {
    ink: "#f0f6fc",
    muted: "#9198a1",
    line: "#6e7681",
    ready: "#12261e",
    waiting: "#33271b",
    idle: "#152b41",
  },
};
const canvasPalette = () =>
  canvasPalettes[
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  ];
function text(t, x, y, size = 20, color) {
  ctx.fillStyle = color || canvasPalette().ink;
  ctx.font = `400 ${size}px Arial,sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(t, x, y);
}
function draw() {
  ctx.clearRect(0, 0, width, height);
  if (kind === "orbit") {
    const x = width / 2,
      y = height / 2,
      r = Math.min(85, height * 0.31);
    ctx.lineWidth = 2;
    ctx.strokeStyle = canvasPalette().line;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#5e8ab7";
    ctx.beginPath();
    ctx.arc(x, y, r, -0.95, -0.45);
    ctx.stroke();
    ctx.fillStyle = canvasPalette().ink;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    text(String(score), x, y + 6, 34);
    text("попаданий", x, y + 29, 11, canvasPalette().muted);
  } else if (kind === "tower") {
    ctx.fillStyle = canvasPalette().line;
    ctx.fillRect(20, height - 21, width - 40, 1);
    const visible = blocks.slice(-8);
    visible.forEach((b, i) => {
      ctx.fillStyle = i % 2 ? "#c89577" : "#b47b5d";
      ctx.fillRect(b.x * width, height - 40 - i * 24, b.w * width, 20);
    });
    if (!ended) {
      ctx.fillStyle = "#e1aa88";
      ctx.fillRect(
        moving.x * width,
        height - 40 - visible.length * 24,
        moving.w * width,
        20,
      );
    }
    if (ended) text("Башня: " + score + " этажей", width / 2, 38, 22);
  } else {
    const x = width / 2,
      y = height / 2;
    ctx.fillStyle =
      phase === "ready"
        ? canvasPalette().ready
        : phase === "waiting"
          ? canvasPalette().waiting
          : canvasPalette().idle;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle =
      phase === "ready"
        ? "#388460"
        : phase === "waiting"
          ? "#b88a66"
          : "#8f9bb1";
    ctx.beginPath();
    ctx.arc(x, y - 18, 27, 0, Math.PI * 2);
    ctx.fill();
    text(
      phase === "ready"
        ? "Нажимай!"
        : phase === "waiting"
          ? "Жди зелёного"
          : phase === "result"
            ? message.textContent
            : "Проверь реакцию",
      x,
      y + 47,
      phase === "result" ? 18 : 22,
    );
  }
}
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  if (kind === "orbit") angle += dt * (1.7 + score * 0.2);
  if (kind === "tower") {
    moving.x += direction * dt * (0.34 + score * 0.025);
    if (moving.x < 0.02) {
      moving.x = 0.02;
      direction = 1;
    }
    if (moving.x + moving.w > 0.98) {
      moving.x = 0.98 - moving.w;
      direction = -1;
    }
  }
  draw();
  if (playing) raf = requestAnimationFrame(loop);
}
function startLoop() {
  cancelAnimationFrame(raf);
  playing = true;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}
function stopLoop() {
  playing = false;
  cancelAnimationFrame(raf);
}
function startTower() {
  score = 0;
  ended = false;
  blocks = [{ x: 0.32, w: 0.36 }];
  moving = { x: 0.02, w: 0.36 };
  direction = 1;
  scoreLabel.textContent = "Этажей: 0";
  button.textContent = "Поставить блок";
  message.textContent = "Нажми, когда блок будет над башней.";
  startLoop();
}
function react() {
  if (phase === "idle" || phase === "result") {
    phase = "waiting";
    button.textContent = "Жду сигнал";
    message.textContent = "Дождись зелёного круга. Раньше нажимать нельзя.";
    draw();
    signalTimer = setTimeout(
      () => {
        phase = "ready";
        readyAt = performance.now();
        button.textContent = "Нажать!";
        message.textContent = "Зелёный — нажимай!";
        draw();
      },
      1500 + Math.random() * 2200,
    );
  } else if (phase === "waiting") {
    clearTimeout(signalTimer);
    phase = "result";
    message.textContent = "Слишком рано! Попробуй ещё раз.";
    button.textContent = "Попробовать снова";
    draw();
  } else if (phase === "ready") {
    const ms = Math.round(performance.now() - readyAt);
    phase = "result";
    message.textContent = ms + " мс — твоё время реакции";
    scoreLabel.textContent = "Последний результат: " + ms + " мс";
    button.textContent = "Попробовать снова";
    draw();
  }
}
button.onclick = () => {
  if (kind === "reaction") {
    react();
    return;
  }
  if (kind === "tower") {
    if (!playing) {
      startTower();
      return;
    }
    const prev = blocks[blocks.length - 1],
      left = Math.max(prev.x, moving.x),
      right = Math.min(prev.x + prev.w, moving.x + moving.w);
    if (right - left <= 0.008) {
      stopLoop();
      ended = true;
      button.textContent = "Начать заново";
      message.textContent = "Блок упал. Твоя башня: " + score + " этажей.";
      draw();
      return;
    }
    blocks.push({ x: left, w: right - left });
    score++;
    scoreLabel.textContent = "Этажей: " + score;
    moving = { x: score % 2 ? 0.02 : 0.98 - (right - left), w: right - left };
    direction = score % 2 ? 1 : -1;
    message.textContent = "Есть! Поставь следующий блок.";
    draw();
    return;
  }
  if (!playing) {
    startLoop();
    button.textContent = "Остановить";
    message.textContent = "Попади спутником в синий сектор.";
  } else {
    stopLoop();
    attempts++;
    const diff = Math.atan2(Math.sin(angle + 0.7), Math.cos(angle + 0.7));
    const hit = Math.abs(diff) <= 0.25;
    if (hit) score++;
    scoreLabel.textContent = "Попаданий: " + score + " / " + attempts;
    message.textContent = hit
      ? "Попадание! Скорость увеличилась."
      : "Мимо. Попробуй ещё раз.";
    button.textContent = "Следующая попытка";
    draw();
  }
};
document.getElementById("label").textContent =
  { orbit: "Орбита", tower: "Башня", reaction: "Реакция" }[kind] || "Орбита";
if (kind === "tower") {
  blocks = [{ x: 0.32, w: 0.36 }];
  moving = { x: 0.05, w: 0.36 };
}
window.addEventListener("resize", resize);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target !== button) {
    e.preventDefault();
    if (!e.repeat) button.click();
  }
  if (e.code === "Escape")
    window.parent.postMessage({ type: "commit-zero-close" }, "*");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(signalTimer);
    if (kind === "reaction" && (phase === "waiting" || phase === "ready")) {
      phase = "idle";
      button.textContent = "Начать";
      message.textContent = "Игра приостановлена.";
      draw();
    }
    if (playing) {
      stopLoop();
      button.textContent =
        kind === "tower" ? "Начать заново" : "Следующая попытка";
      message.textContent = "Игра приостановлена.";
    }
  }
});
resize();

window.addEventListener("preview-theme-change", () => {
  if (!playing) draw();
});
