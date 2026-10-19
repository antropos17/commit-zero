import React, { useEffect, useRef, useState } from "react";

// Trusted preview engines. Repository source is displayed, never evaluated here.
function createEngine(kind, canvas, update) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { action() {}, dispose() {}, theme() {} };
  let width = 0,
    height = 0,
    frame = 0,
    timer,
    previous = 0,
    running = false;
  let angle = -Math.PI / 2,
    score = 0,
    attempts = 0,
    phase = "idle",
    readyAt = 0;
  let blocks = [{ x: 0.32, w: 0.36 }],
    moving = { x: 0.02, w: 0.36 },
    direction = 1;
  const satellites = Array.from({ length: 3 }, (_, i) => ({
    angle: i * 1.9,
    radius: 34 + i * 8,
  }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let palette;
  function theme() {
    const style = getComputedStyle(document.documentElement);
    palette = {
      ink: style.getPropertyValue("--text"),
      muted: style.getPropertyValue("--muted"),
      line: style.getPropertyValue("--border"),
      blue: style.getPropertyValue("--blue"),
      green: style.getPropertyValue("--green"),
      ready: style.getPropertyValue("--success-action"),
      red: style.getPropertyValue("--red"),
      soft: style.getPropertyValue("--soft"),
    };
    draw();
  }
  function text(value, x, y, size = 18, color = palette.ink) {
    ctx.fillStyle = color;
    ctx.font = `400 ${size}px Arial,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(value, x, y);
  }
  function draw() {
    if (!palette) return;
    ctx.clearRect(0, 0, width, height);
    const x = width / 2,
      y = height / 2;
    if (kind === "reaction") {
      ctx.fillStyle = phase === "ready" ? palette.ready : palette.soft;
      ctx.fillRect(16, 16, width - 32, height - 32);
      text(
        phase === "ready"
          ? "NOW"
          : phase === "waiting"
            ? "Wait for green…"
            : "Ready when you are",
        x,
        y,
        24,
        phase === "ready" ? "#ffffff" : palette.ink,
      );
      return;
    }
    if (kind === "tower") {
      const blockHeight = 20,
        offset = Math.max(0, blocks.length - 9) * blockHeight;
      blocks.forEach((b, i) => {
        ctx.fillStyle = i % 2 ? palette.blue : palette.green;
        ctx.fillRect(
          b.x * width,
          height - 35 - i * blockHeight + offset,
          b.w * width,
          blockHeight - 2,
        );
      });
      ctx.fillStyle = palette.ink;
      ctx.fillRect(
        moving.x * width,
        height - 35 - blocks.length * blockHeight + offset,
        moving.w * width,
        blockHeight - 2,
      );
      return;
    }
    if (kind === "garden") {
      satellites.forEach((s, i) => {
        const radius = s.radius * Math.min(width / 390, 1);
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = i % 2 ? palette.green : palette.blue;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(s.angle) * radius,
          y + Math.sin(s.angle) * radius,
          4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
      ctx.fillStyle = palette.ink;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const r = Math.min(85, height * 0.32, width * 0.3);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = palette.blue;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, -0.95, -0.45);
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    text(score, x, y + 8, 28);
  }
  function resize() {
    const dpr = devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function tick(now) {
    const delta = Math.min(Math.max(now - previous, 0), 40) / 1000;
    previous = now;
    if (kind === "garden")
      satellites.forEach((s, i) => (s.angle += delta * (0.3 + i * 0.04)));
    else if (kind === "tower") {
      moving.x += delta * direction * (0.35 + score * 0.025);
      if (moving.x < 0.01 || moving.x + moving.w > 0.99) {
        moving.x = Math.max(0.01, Math.min(0.99 - moving.w, moving.x));
        direction *= -1;
      }
    } else angle += delta * (1.45 + score * 0.12);
    draw();
    if (running) frame = requestAnimationFrame(tick);
  }
  function start() {
    running = true;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }
  function action() {
    if (kind === "garden") {
      if (satellites.length < 12)
        satellites.push({
          angle: satellites.length * 1.9,
          radius: 34 + satellites.length * 8,
        });
      update({
        score: `${satellites.length} / 12 satellites`,
        button: "Plant a satellite",
        message: reduced
          ? "Motion reduced. Add a satellite to update the garden."
          : "Each satellite follows its own orbit.",
        disabled: satellites.length === 12,
      });
      draw();
      return;
    }
    if (kind === "reaction") {
      if (phase === "waiting") {
        clearTimeout(timer);
        phase = "result";
        update({
          score: "Too early",
          button: "Try again",
          message: "Wait until the field turns green.",
        });
      } else if (phase === "ready") {
        const ms = Math.round(performance.now() - readyAt);
        phase = "result";
        update({
          score: `${ms} ms`,
          button: "Try again",
          message: "Your reaction time. Ready for another round?",
        });
      } else {
        phase = "waiting";
        update({
          score: "Waiting",
          button: "Wait…",
          message: "Press when the field turns green.",
        });
        timer = setTimeout(
          () => {
            phase = "ready";
            readyAt = performance.now();
            update({ score: "Go", button: "Press now", message: "Green!" });
            draw();
          },
          1200 + Math.random() * 1600,
        );
      }
      draw();
      return;
    }
    if (kind === "tower") {
      if (!running) {
        blocks = [{ x: 0.32, w: 0.36 }];
        moving = { x: 0.02, w: 0.36 };
        score = 0;
        start();
        update({
          score: "0 floors",
          button: "Place block",
          message: "Line up the moving block with the tower.",
        });
        return;
      }
      const last = blocks.at(-1),
        left = Math.max(last.x, moving.x),
        right = Math.min(last.x + last.w, moving.x + moving.w);
      if (right - left <= 0.008) {
        stop();
        update({
          score: `${score} floors`,
          button: "Start again",
          message: "The block fell. Try building a taller tower.",
        });
        return;
      }
      blocks.push({ x: left, w: right - left });
      score++;
      moving = { x: score % 2 ? 0.01 : 0.99 - (right - left), w: right - left };
      direction = score % 2 ? 1 : -1;
      update({
        score: `${score} floors`,
        button: "Place block",
        message: "Placed. Line up the next block.",
      });
      draw();
      return;
    }
    if (!running) {
      start();
      update({
        score: `${score} / ${attempts} hits`,
        button: "Stop satellite",
        message: "Stop inside the blue sector.",
      });
    } else {
      stop();
      attempts++;
      const hit =
        Math.abs(Math.atan2(Math.sin(angle + 0.7), Math.cos(angle + 0.7))) <=
        0.25;
      if (hit) score++;
      update({
        score: `${score} / ${attempts} hits`,
        button: "Next attempt",
        message: hit ? "Hit! The next orbit is faster." : "Missed. Try again.",
      });
      draw();
    }
  }
  function visibility() {
    if (document.hidden) {
      stop();
      clearTimeout(timer);
      phase = "idle";
      update({
        score: kind === "tower" ? `${score} floors` : `${score} hits`,
        button: kind === "garden" ? "Plant a satellite" : "Start again",
        message: "Paused while the tab is hidden.",
      });
    }
  }
  theme();
  resize();
  if (kind === "garden" && !reduced) start();
  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", visibility);
  return {
    action,
    theme,
    dispose() {
      stop();
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
export function GamePreview({ project, theme, onClose }) {
  const dialog = useRef(null),
    canvas = useRef(null),
    engine = useRef(null),
    returnFocus = useRef(document.activeElement);
  const [ui, setUI] = useState({
    score: project.game === "garden" ? "3 / 12 satellites" : "Score: 0",
    button: project.game === "garden" ? "Plant a satellite" : "Start",
    message:
      project.game === "garden"
        ? "Plant satellites in your orbital garden."
        : "One button. Press to begin.",
  });
  useEffect(() => {
    dialog.current.showModal();
    engine.current = createEngine(project.game, canvas.current, setUI);
    return () => {
      engine.current.dispose();
      if (returnFocus.current?.isConnected)
        returnFocus.current.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    engine.current?.theme();
  }, [theme]);
  return (
    <dialog
      ref={dialog}
      id="preview-dialog"
      aria-labelledby="preview-title"
      onClose={onClose}
    >
      <div className="dialog-head">
        <div>
          <h2 id="preview-title">
            {
              {
                orbit: "Orbit",
                tower: "Tower",
                reaction: "Reaction",
                garden: "Orbital Garden",
              }[project.game]
            }
          </h2>
          <p>
            Playable demonstration · {project.owner}/{project.name}
          </p>
        </div>
        <button
          className="close"
          aria-label="Close preview"
          onClick={() => dialog.current.close()}
        >
          ×
        </button>
      </div>
      <div className="game-preview">
        <div className="game-score">{ui.score}</div>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${project.name} game field`}
        />
        <button
          className="btn green"
          disabled={ui.disabled}
          onClick={() => engine.current.action()}
        >
          {ui.button}
        </button>
        <p role="status">{ui.message}</p>
      </div>
    </dialog>
  );
}
