// Pacific Strike — entry program.
//
// Assembles the submission bundle in the output directory: it copies the
// playable game in, decodes the base64 screenshots back into PNG files,
// and asks the vendored make.fun helper to write the dossier that
// describes the whole bundle. Everything here is deterministic on purpose:
// entries are always handled in sorted order, and nothing in the output
// depends on the clock, on randomness, or on the order the filesystem
// happens to hand entries back.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the finished bundle goes. The grader points this at its own
// mounted directory; anywhere else, /output is the conventional spot.
const outDir: string = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The folder this file lives in is the repository root of the entry, so
// game/ and screenshots-b64/ sit beside it no matter where the command
// was launched from.
const repoDir: string = import.meta.dirname;

// Remove every entry inside a directory, leaving the directory itself
// standing. The grader mounts the output directory on a read-only
// filesystem, so deleting the directory itself would fail; clearing
// only its contents is always safe.
function clearContents(dir: string): void {
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

// Copy one tree into another, visiting entries in sorted order so the
// result does not depend on readdir order.
function copyTreeSorted(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  const names = readdirSync(from).sort();
  for (const name of names) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) {
      copyTreeSorted(src, dst);
    } else {
      cpSync(src, dst);
    }
  }
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  clearContents(outDir);

  // 1. The playable game, copied wholesale.
  copyTreeSorted(join(repoDir, 'game'), join(outDir, 'game'));

  // 2. Screenshots: each *.png.b64 file holds one base64 string. Decode
  // it and store the real PNG under screenshots/, keeping the same
  // stem name. Files with any other suffix are ignored, and the
  // sorted order keeps repeated runs identical.
  const shotsDir = join(outDir, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });
  const encodedDir = join(repoDir, 'screenshots-b64');
  if (existsSync(encodedDir)) {
    const encoded = readdirSync(encodedDir)
      .filter((name) => name.endsWith('.png.b64'))
      .sort();
    for (const name of encoded) {
      const raw = readFileSync(join(encodedDir, name), 'utf8').trim();
      const png = Buffer.from(raw, 'base64');
      const stem = basename(name, '.png.b64');
      writeFileSync(join(shotsDir, `${stem}.png`), png);
      console.log(`screenshot ${stem}.png: ${png.length} bytes`);
    }
  }

  // 3. The dossier: a canonical description of game/ and screenshots/,
  // built by the vendored make.fun helper under the bounty's caps.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
}

main();
