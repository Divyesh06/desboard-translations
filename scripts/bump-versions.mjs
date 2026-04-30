#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = join(ROOT, "index.json");
const PACKS_PREFIX = "translations/";
const ZERO_SHA = "0000000000000000000000000000000000000000";

function getChangedPackFiles() {
  const before = process.env.BEFORE_SHA;
  const after = process.env.AFTER_SHA || "HEAD";
  const range = before && before !== ZERO_SHA ? `${before}..${after}` : "HEAD~1..HEAD";

  let out;
  try {
    out = execSync(`git diff --name-only ${range}`, { encoding: "utf8", cwd: ROOT });
  } catch (err) {
    console.warn(`Could not compute diff for ${range}: ${err.message}`);
    return [];
  }

  return out
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.startsWith(PACKS_PREFIX) && f.endsWith(".json"));
}

async function main() {
  const changed = getChangedPackFiles();
  if (changed.length === 0) {
    console.log("No translation pack changes.");
    return;
  }

  const index = JSON.parse(await readFile(INDEX_PATH, "utf8"));
  const unknown = [];
  let bumped = 0;

  for (const filePath of changed) {
    const entry = index.languages.find((l) => l.file === filePath);
    if (entry) {
      entry.version = (entry.version || 0) + 1;
      console.log(`Bumped ${filePath} to v${entry.version}`);
      bumped++;
    } else {
      unknown.push(filePath);
    }
  }

  if (unknown.length > 0) {
    console.warn(
      `\nChanged files with no entry in index.json (add them manually):\n  ${unknown.join("\n  ")}`
    );
  }

  if (bumped > 0) {
    await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");
    console.log(`\nUpdated ${INDEX_PATH} with ${bumped} version bump(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
