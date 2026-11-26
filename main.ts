// Hornbill Run — hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/: game/index.html and the ES
// modules under game/src/, flying over a three.js island vendored under
// game/vendor/, loading nothing from the network. This program delivers
// it: it copies game/ and screenshots/ from beside this file into the
// output directory and writes dossier.json there with buildDossier from
// the vendored make.fun library, so the judge reads exactly the
// screenshots and source outline the library produces.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps below are the scorer's own (reference/gate.json): they make
// this program refuse, here, an entry the scorer would refuse there —
// more than 4 screenshots or one over 256 KiB, more than 993 files in
// game/, 48 MiB of game files in all, or a path under game/ over
// 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
