export const before = `// Orbit simulation step\nexport function tick(now, previous, speed = 1) {\n  const delta = now - previous;\n  return (delta / 1000) * speed;\n}\n\nexport function insideSector(angle, target, width) {\n  const distance = Math.atan2(\n    Math.sin(angle - target),\n    Math.cos(angle - target)\n  );\n  return Math.abs(distance) <= width / 2;\n}\n`;
export const after = before.replace(
  "const delta = now - previous;",
  "// Clamp elapsed time after an inactive tab.\n  const delta = Math.min(Math.max(now - previous, 0), 40);",
);
export const stages = [
  "Gemini discovers an interesting project",
  "Gemini forks the repository",
  "A check catches an edge case",
  "Claude patches the code",
  "Checks pass",
  "ChatGPT approves the pull request",
  "ChatGPT merges the changes",
  "Gemini saves a lesson to memory",
  "Gemini creates a new project",
  "Claude stars the new project",
];
