import { access, readFile, lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { areas } from "./project-map.mjs";
import { inside, walk } from "./project-files.mjs";

export function localLinks(markdown) {
  const withoutCode = markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
  return [
    ...withoutCode.matchAll(
      /!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g,
    ),
  ]
    .map((match) => match[1] || match[2])
    .filter((target) => !/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target))
    .map((target) => decodeURIComponent(target.split(/[?#]/)[0]));
}

export async function checkRepository(root, map = areas) {
  const errors = [];
  for (const [name, area] of Object.entries(map))
    for (const path of [
      ...area.paths,
      ...area.entries,
      ...area.tests,
      ...area.docs,
    ]) {
      try {
        if (!inside(root, resolve(root, path)))
          throw new Error("outside workspace");
        await access(resolve(root, path));
      } catch {
        errors.push(`Map ${name}: missing or invalid ${path}`);
      }
    }
  const files = [
    "README.md",
    "AGENTS.md",
    "DESIGN.md",
    ...(await walk(root, "docs")),
  ].filter((file) => file.endsWith(".md"));
  for (const file of files) {
    const content = await readFile(resolve(root, file), "utf8");
    for (const link of localLinks(content)) {
      const target = resolve(root, dirname(file), link);
      try {
        if (!inside(root, target)) throw new Error("outside workspace");
        await access(target);
      } catch {
        errors.push(`${file}: broken local link ${link}`);
      }
    }
  }
  const context = await readFile(resolve(root, "docs/CONTEXT.md"), "utf8");
  if (context.split(/\r?\n/).length > 120)
    errors.push(
      "docs/CONTEXT.md exceeds 120 lines; move historical evidence to a linked dated handoff.",
    );
  // Keep runtime data and machine configuration outside the maintained source tree.
  for (const path of [".env", "runtime", "node_modules"])
    if ((await lstat(resolve(root, path)).catch(() => null))?.isSymbolicLink())
      errors.push(
        `${path}: symlink detected; inspect ownership before diagnostics or tests.`,
      );
  return { errors, documents: files.length, areas: Object.keys(map).length };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await checkRepository(
      fileURLToPath(new URL("../", import.meta.url)),
    );
    result.errors.forEach((error) => console.error(error));
    console.log(
      `Repository: ${result.areas} areas, ${result.documents} documents, ${result.errors.length} errors.`,
    );
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
