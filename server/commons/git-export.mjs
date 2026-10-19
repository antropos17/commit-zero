import { projectHistory } from "../../shared/commons-history.mjs";
import { httpError } from "../../services/base.mjs";

const block = (text) => `data ${Buffer.byteLength(text, "utf8")}\n${text}\n`;
export function gitStream(project, events) {
  const history = projectHistory(project, events);
  if (history.error) throw httpError(409, history.error);
  const versions = [...history.versions].reverse();
  let stream = "feature done\n";
  for (const [index, version] of versions.entries()) {
    const date = version.at || project.createdAt;
    const seconds = date ? Math.floor(Date.parse(date) / 1000) : 0;
    if (!Number.isSafeInteger(seconds) || seconds < 0)
      throw httpError(409, "Invalid version timestamp.");
    const message = `${version.title}\n\nCommit Zero project: ${project.id}\nWorkspace version: v${version.revision}\n${version.hash ? `Patch SHA-256: ${version.hash}\n` : "Initial snapshot; historical creation time may be unknown.\n"}Exported history; code execution is not implied.\n`;
    stream += `commit refs/heads/main\nmark :${index + 1}\ncommitter Commit Zero <workspace@commit-zero.local> ${seconds} +0000\n${block(message)}`;
    if (index) stream += `from :${index}\n`;
    stream += "deleteall\n";
    for (const [path, source] of Object.entries(version.files)) {
      if (
        !/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/.test(path) ||
        path
          .split("/")
          .some(
            (part) =>
              !part ||
              part === "." ||
              part === ".." ||
              part.toLowerCase() === ".git",
          )
      )
        throw httpError(
          409,
          "A retained filename cannot be exported safely to Git. Use the JSON export.",
        );
      stream += `M 100644 inline ${path}\n${block(source)}`;
    }
    stream += "\n";
  }
  return stream + "done\n";
}
