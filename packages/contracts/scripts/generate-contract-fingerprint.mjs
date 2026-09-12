import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const sourceDirectory = join(packageDirectory, "src");
const outputPath = join(sourceDirectory, "contract-fingerprint.ts");

async function listContractSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listContractSources(entryPath);
    if (entry.isFile() && entryPath.endsWith(".ts") && entryPath !== outputPath) return [entryPath];
    return [];
  }));

  return nestedFiles.flat();
}

const sourcePaths = (await listContractSources(sourceDirectory)).sort();
const hash = createHash("sha256");

for (const sourcePath of sourcePaths) {
  const relativePath = relative(sourceDirectory, sourcePath).split(sep).join("/");
  hash.update(relativePath);
  hash.update("\0");
  hash.update(await readFile(sourcePath));
  hash.update("\0");
}

const fingerprint = hash.digest("hex");
const generatedSource = `export const CONTRACT_FINGERPRINT = "${fingerprint}" as const;\n`;

let currentSource = "";
try {
  currentSource = await readFile(outputPath, "utf8");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

if (currentSource !== generatedSource) await writeFile(outputPath, generatedSource);
