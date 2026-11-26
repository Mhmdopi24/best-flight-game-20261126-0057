// shots.js — the screenshot scenes. Open the game with ?shot=<name> and
// it stages a real, frozen moment of the run with the game's own state
// and renderer: rings already flown are marked passed, the aircraft is
// placed mid-flight exactly where a player's hands would put it, and
// the clock stops. The maker's screenshots are renders of these scenes.

import { RUNWAY } from './random.js';

export function readShotRequest() {
  return new URLSearchParams(window.location.search).get('shot');
}

// Point the aircraft's nose at a target: yaw from the forward frame the
// flight model uses (forward = (-sin yaw, ·, -cos yaw)).
function aimAt(plane, tx, tz) {
  const dx = tx - plane.position.x;
  const dz = tz - plane.position.z;
  plane.yaw = Math.atan2(-dx, -dz);
}

function flyRings(game, count) {
  for (let i = 0; i < count; i++) {
    game.course.rings[i].passed = true;
  }
  game.course.nextIndex = count;
  game.score = count * 1000;
}

const SCENES = {
  // The cover: two rings down, banking toward the third with the
  // volcano filling the background and the whole island below.
  cover(game) {
    flyRings(game, 2);
    game.elapsed = 74;
    game.plane.position.set(-520, 216, -520);
    aimAt(game.plane, -760, -430);
    game.plane.pitch = 0.04;
    game.plane.roll = 0.26;
    game.plane.speed = 44;
    game.plane.throttle = 0.7;
  },
  // Mid-course: lining up the fifth ring over the green south coast,
  // the village below and the sea beyond.
  ring(game) {
    flyRings(game, 4);
    game.elapsed = 138;
    game.plane.position.set(-540, 158, 290);
    aimAt(game.plane, -430, 540);
    game.plane.pitch = -0.02;
    game.plane.roll = 0.16;
    game.plane.speed = 47;
    game.plane.throttle = 0.72;
  },
  // Final approach: every ring flown, throttled back, the lit strip
  // dead ahead and the last ring just behind.
  approach(game) {
    flyRings(game, 8);
    game.elapsed = 196;
    game.plane.position.set(RUNWAY.centerX, 36, 520);
    game.plane.yaw = 0;
    game.plane.pitch = -0.06;
    game.plane.roll = 0;
    game.plane.speed = 26;
    game.plane.throttle = 0.3;
  },
  // Touchdown: stopped on the strip, tower alongside, delivery made.
  landed(game) {
    flyRings(game, 8);
    game.elapsed = 214;
    game.plane.position.set(RUNWAY.centerX, RUNWAY.surfaceY + 0.3 + 2.67, 40);
    game.plane.yaw = 0;
    game.plane.pitch = 0;
    game.plane.roll = 0;
    game.plane.speed = 0;
    game.plane.throttle = 0;
    game.plane.landed = true;
    game.showEnd(true, -2.1, 214);
  },
};

export function stageShot(game, name) {
  const scene = SCENES[name] || SCENES.cover;
  game.phase = 'shot';
  scene(game);
  game.plane.syncMesh(0);
  game.course.update(0, 2.2);
}
