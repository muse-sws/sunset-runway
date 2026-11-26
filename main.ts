// main.ts — Sunset Runway entry program (Node 22, standard library only).
//
// It copies this repository's game/ into the output directory, decodes
// the base64 screenshots in screenshots-b64/ back to real PNG files in
// the output screenshots/ folder, then writes dossier.json with
// buildDossier from the vendor library. The screenshots are stored as
// base64 text in the repository (so every repo file is UTF-8 text);
// the program restores the exact original PNG bytes at build time.
//
// It runs twice and writes the same bytes both times: the output
// directory is cleaned first, the copy is a plain recursive copy in
// sorted order, and the dossier is deterministic for a given input.
//
// Run locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Start from a clean output directory so a second run writes exactly
// the same bytes as the first, even if files were removed since.
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });

// Decode each screenshots-b64/<name>.png.b64 (one base64 string per
// file) back to the original PNG bytes and write them as
// screenshots/<name>.png in the output.
const shotsDir = join(outDir, "screenshots");
mkdirSync(shotsDir, { recursive: true });
const encoded = readdirSync(join(repoRoot, "screenshots-b64")).sort();
for (const file of encoded) {
  if (!file.endsWith(".png.b64")) continue;
  const name = file.slice(0, -".b64".length);
  const text = readFileSync(join(repoRoot, "screenshots-b64", file), "utf8").trim();
  const bytes = Buffer.from(text, "base64");
  writeFileSync(join(shotsDir, name), bytes);
  console.log("decoded " + name + " (" + bytes.length + " bytes)");
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, "dossier.json"), dossier);
console.log("wrote " + join(outDir, "dossier.json") + " (" + dossier.length + " bytes)");
