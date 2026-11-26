# Hornbill Run

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Mhmdopi24/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Mhmdopi24/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original 3D flight game, entered in make.fun's
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
bounty. You fly the mail plane for Hornbill Ridge, a volcanic island in a
seeded 3D sea: thread **8 gold rings** hung around the volcano, the forest
and the fishing village, then put her down gently on the lit coastal strip.
Everything is geometry and colour — the island, the plane, the clouds —
and every sound is synthesized with WebAudio. No network requests: just
static files under `game/`, with three.js vendored alongside.

## How to play

- **W / S** — throttle up / down
- **↑ / ↓** — climb / dive
- **← / →** — bank (a banked wing turns the plane)
- **Q / E** — rudder
- **R** — restart the run

Only the next ring counts; it pulses gold. Too slow and she mushes and
sinks. The strip only takes a landing that is slow, gentle and lined up —
come in hot and you bounce with a warning, or worse. Score is 1,000 a
ring, plus a time bonus and a touchdown bonus for greasing it.

## Layout of the entry

- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `game/index.html` — the page and its instrument panel; `game/src/` holds
  the game, one job per file: `random.js` (the island's seeded height
  function and the runway), `world.js` (terrain, sea, forest, village,
  runway), `aircraft.js` (the plane and its flight model), `rings.js`
  (the ring course), `hud.js` (ALT/SPD/HDG readouts and the artificial
  horizon), `audio.js` (synthesized engine, chimes and thuds),
  `input.js` (the keyboard), `shots.js` (the staged screenshot scenes)
  and `main.js` (the mission loop and the landing judge).
- `game/vendor/three.module.js` — three.js, vendored; the game loads
  nothing from the network.
- `serve.ts` — a tiny static server: `node serve.ts` plays the game at
  http://localhost:8080.
- `screenshots/` — four real renders of the game, staged by its own
  `?shot=` hooks (see `shots.json`).
