const canvas = document.querySelector("#garden");
const ctx = canvas.getContext("2d");
const satellites = [];
const colors = ["#0969da", "#1a7f37", "#8250df", "#bf8700"];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function plant() {
  if (satellites.length === 12) return;
  satellites.push({
    angle: satellites.length * 1.9,
    radius: 34 + satellites.length * 8,
  });
  document.querySelector("#count").textContent =
    `Спутников: ${satellites.length} из 12`;
  if (satellites.length === 12)
    document.querySelector("#plant").disabled = true;
  draw(0);
}
function draw(delta) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(2, 2);
  ctx.translate(195, 145);
  satellites.forEach((s, i) => {
    s.angle += (delta / 1000) * (0.3 + i * 0.04);
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.strokeStyle =
      document.documentElement.dataset.theme === "dark" ? "#6e7681" : "#d1d9e0";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
      Math.cos(s.angle) * s.radius,
      Math.sin(s.angle) * s.radius,
      3.5,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle =
    document.documentElement.dataset.theme === "dark" ? "#f0f6fc" : "#1f2328";
  ctx.fill();
  ctx.restore();
}
plant();
plant();
plant();
let previous = performance.now();
function animate(now) {
  const delta = Math.min(Math.max(now - previous, 0), 40);
  previous = now;
  draw(delta);
  requestAnimationFrame(animate);
}
if (!reducedMotion) requestAnimationFrame(animate);
document.querySelector("#plant").addEventListener("click", plant);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    parent.postMessage({ type: "commit-zero-close" }, "*");
});

window.addEventListener("preview-theme-change", () => draw(0));
