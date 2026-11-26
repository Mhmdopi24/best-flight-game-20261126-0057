// main.js — Hornbill Run: boot, the chase camera, the mission loop and
// the landing judge. Fly the eight rings in order, then land on the
// strip: slow, gentle and lined up, or she bounces — or worse. The
// scene is drawn by the game's own renderer (render3d.js).

import { Renderer, Vec3 } from './render3d.js';
import { World } from './world.js';
import { Aircraft } from './aircraft.js';
import { RingCourse } from './rings.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { readShotRequest, stageShot } from './shots.js';
import { RUNWAY } from './random.js';

const canvas = document.getElementById('scene');
const renderer = new Renderer(canvas);

const camera = {
  pos: new Vec3(650, 110, 1250),
  target: new Vec3(650, 96, 1100),
  fovY: (62 * Math.PI) / 180,
  near: 0.5,
  far: 9000,
};

const world = new World(renderer);
const input = new Input();
const hud = new Hud();
const audio = new GameAudio();

const game = {
  phase: 'title', // title | fly | won | crashed | shot
  elapsed: 0,
  score: 0,
  plane: new Aircraft(renderer),
  course: new RingCourse(renderer),
  showEnd: null, // wired below, shots.js calls it for the landed scene
};

const titleScreen = document.getElementById('titleScreen');
window.__hornbill = game; // a handle for the maker's own play-tests
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const endStory = document.getElementById('endStory');
const endScore = document.getElementById('endScore');

function timeBonus() {
  return Math.max(0, 3000 - Math.floor(game.elapsed) * 12);
}

function showEnd(delivered, verticalSpeed) {
  endScreen.classList.remove('hidden');
  if (delivered) {
    const softBonus = verticalSpeed > -3.5 ? 500 : 200;
    const total = game.score + timeBonus() + softBonus;
    endTitle.textContent = 'DELIVERY COMPLETE';
    endStory.textContent = verticalSpeed > -3.5
      ? 'Greased it. The tower barely looked up from its tea — the mail is in, the plane is whole, and the island has its letters.'
      : 'Down in one piece, if not exactly gently. The mail is delivered and the strip crew is already telling the story.';
    endScore.innerHTML =
      `RINGS ${game.score} &nbsp;·&nbsp; TIME BONUS ${timeBonus()} &nbsp;·&nbsp; TOUCHDOWN ${softBonus}<br>FINAL SCORE ${total}`;
    game.finalScore = total;
  } else {
    endTitle.textContent = 'THE RUN ENDS EARLY';
    endStory.textContent = game.crashReason || 'The island keeps the mail this time.';
    endScore.innerHTML = `SCORE ${game.score} &nbsp;·&nbsp; RINGS ${game.course.nextIndex} / ${game.course.total}`;
    game.finalScore = game.score;
  }
}
game.showEnd = showEnd;

function resetRun() {
  game.plane.reset();
  game.course = new RingCourse(renderer);
  game.elapsed = 0;
  game.score = 0;
  game.finalScore = 0;
  game.crashReason = '';
  endScreen.classList.add('hidden');
}

function beginFlight() {
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  game.phase = 'fly';
  audio.ensureStarted();
}

function crash(reason) {
  game.phase = 'crashed';
  game.crashReason = reason;
  game.plane.crashed = true;
  game.plane.pitch = -0.5;
  game.plane.syncMesh(0);
  audio.crashThud();
  showEnd(false, 0);
}

function judgeTouchdown() {
  const plane = game.plane;
  const heading = plane.headingDeg;
  const aligned = heading <= 30 || heading >= 330 || (heading >= 150 && heading <= 210);
  const gentle = plane.verticalSpeed > -7.5;
  const slow = plane.speed <= 31;
  const level = Math.abs(plane.roll) < 0.4;
  if (gentle && slow && aligned && level) {
    plane.landed = true;
    plane.position.y = RUNWAY.surfaceY + 0.3 + 2.67;
    plane.pitch = 0;
    plane.roll = 0;
    plane.throttle = 0.1;
    plane.syncMesh(0);
    game.phase = 'won';
    audio.deliveryJingle();
    showEnd(true, plane.verticalSpeed);
    return;
  }
  if (plane.verticalSpeed <= -11 || plane.speed > 42) {
    crash('You came in far too hot and the strip ran out. Speed is for the sky, not the last fifty feet.');
    return;
  }
  // A bounce: firm word from the tower and one more circuit.
  plane.position.y += 4;
  plane.pitch = 0.1;
  hud.showMessage('TOO FAST — GO AROUND!', 2);
  audio.bounceWarn();
}

const _fwd = new Vec3();
const _desired = new Vec3();
const _look = new Vec3();

function chaseCamera(dt, snap = false) {
  const plane = game.plane;
  plane.forwardVector(_fwd);
  _desired.copy(plane.position).addScaledVector(_fwd, -23);
  _desired.y += 4.4;
  if (snap || dt === 0) camera.pos.copy(_desired);
  else camera.pos.lerp(_desired, 1 - Math.exp(-dt * 4.5));
  _look.copy(plane.position).addScaledVector(_fwd, 34);
  _look.y += 1.0;
  camera.target.copy(_look);
}

function titleCamera(elapsed) {
  const plane = game.plane;
  const a = elapsed * 0.12;
  camera.pos.set(
    plane.position.x + Math.sin(a) * 30,
    plane.position.y + 9,
    plane.position.z + Math.cos(a) * 30,
  );
  camera.target.set(plane.position.x, plane.position.y + 1, plane.position.z);
}

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pointerdown', () => {
  if (game.phase === 'title') beginFlight();
  else audio.ensureStarted();
});

// Screenshot staging: freeze a real moment of the run and render it.
const shotName = readShotRequest();
let shotFrames = 0;
if (shotName) {
  titleScreen.classList.add('hidden');
  stageShot(game, shotName);
  chaseCamera(0, true);
}

function render() {
  const draws = [];
  world.addDraws(draws);
  game.plane.addDraws(draws);
  game.course.addDraws(draws);
  renderer.frame(camera, draws);
}

const startMs = performance.now();
let lastMs = startMs;

function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastMs) / 1000, 0.05);
  lastMs = nowMs;
  const elapsedTotal = (nowMs - startMs) / 1000;

  if (game.phase === 'title') {
    world.update(dt, elapsedTotal);
    game.plane.syncMesh(dt);
    titleCamera(elapsedTotal);
    if (input.tapped('Enter')) beginFlight();
  } else if (game.phase === 'fly') {
    game.elapsed += dt;
    const prevPos = game.plane.position.clone();
    game.plane.update(dt, input);
    world.update(dt, elapsedTotal);
    game.course.update(dt, elapsedTotal);
    if (game.course.checkPass(prevPos, game.plane.position)) {
      game.score += 1000;
      hud.showMessage(game.course.done ? 'ALL RINGS — LAND ON THE STRIP!' : `RING ${game.course.nextIndex} — +1000`);
      audio.ringChime();
    }
    const contact = game.plane.groundContact();
    if (contact === 'runway' && game.course.done) judgeTouchdown();
    else if (contact === 'runway') {
      hud.showMessage('THE STRIP IS FOR AFTER THE RINGS', 1.2);
      game.plane.position.y += 4;
    } else if (contact === 'water') {
      crash('Down in the bay. The fish get the letters today — finish the rings, then land on the strip, wheels first.');
    } else if (contact === 'ground') {
      crash('The island rose up to meet you. Keep her over the coast and mind the volcano\'s shoulders.');
    }
    chaseCamera(dt);
    if (input.tapped('KeyR')) { resetRun(); game.phase = 'fly'; }
  } else if (game.phase === 'won' || game.phase === 'crashed') {
    world.update(dt, elapsedTotal);
    if (game.phase === 'won') game.plane.syncMesh(dt);
    chaseCamera(dt);
    if (input.tapped('Enter')) { resetRun(); beginFlight(); }
  } else if (game.phase === 'shot') {
    world.update(0, 2.2);
    hud.update(0, game.plane, game.course, game.elapsed, game.score);
    render();
    shotFrames++;
    if (shotFrames === 12) window.__shotReady = true;
    input.endFrame();
    return;
  }

  hud.update(dt, game.plane, game.course, game.elapsed, game.score);
  audio.setEngine(game.plane.throttle, game.phase === 'fly');
  render();
  input.endFrame();
}

frame();
