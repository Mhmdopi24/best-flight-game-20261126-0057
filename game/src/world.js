// world.js — Hornbill Ridge itself, drawn by the game's own renderer:
// one volcanic island whose mesh comes from the seeded height function
// in random.js, so the ground you see is the ground the flight model
// collides with. Flat-shaded terrain with a colour band per altitude, a
// plain sea, a baked-in pine forest, a fishing village, drifting cloud
// puffs and the coastal runway the run ends on. Geometry and colour
// only — no textures, no network.

import {
  GeoBuilder, Vec3, hexColor,
  mat4Identity, mat4Multiply, mat4Translation, mat4RotY, mat4RotZ, mat4Scale,
  boxSoup, cylinderYSoup, coneSoup, sphereSoup,
} from './render3d.js';
import { mulberry32, terrainHeight, RUNWAY, VOLCANO } from './random.js';

const WORLD_SIZE = 4200;
const SEA_COLOR = [0.11, 0.44, 0.62];

// The island's paint, by altitude and steepness: sand at the water's
// edge, grass and forest up the slopes, bare rock, dark ash near the
// top and the pale rim of the crater above everything.
function terrainColor(h, slope) {
  let color;
  if (h < 1.5) color = [0.85, 0.76, 0.52];
  else if (h < 42) color = [0.35, 0.57, 0.26];
  else if (h < 95) color = [0.21, 0.44, 0.22];
  else if (h < 175) color = [0.42, 0.36, 0.30];
  else if (h < 238) color = [0.29, 0.23, 0.19];
  else color = [0.93, 0.94, 0.96];
  if (slope > 0.85 && h >= 1.5) {
    color = [color[0] * 0.82, color[1] * 0.82, color[2] * 0.82];
  }
  return color;
}

// The terrain as a grid of triangles, each corner carrying its band
// colour; the renderer's flat shading does the rest.
function buildTerrain(builder) {
  const segments = 140;
  const step = WORLD_SIZE / segments;
  const heights = [];
  const colors = [];
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const x = -WORLD_SIZE / 2 + i * step;
      const z = -WORLD_SIZE / 2 + j * step;
      const h = terrainHeight(x, z);
      const slope = Math.abs(terrainHeight(x + 14, z) - h)
        + Math.abs(terrainHeight(x, z + 14) - h);
      heights.push(h);
      colors.push(terrainColor(h, slope));
    }
  }
  const at = (i, j) => {
    const k = j * (segments + 1) + i;
    return {
      p: new Vec3(-WORLD_SIZE / 2 + i * step, heights[k], -WORLD_SIZE / 2 + j * step),
      c: colors[k],
    };
  };
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      builder.tri(a.p, a.c, c.p, c.c, b.p, b.c);
      builder.tri(a.p, a.c, d.p, d.c, c.p, c.c);
    }
  }
}

function buildSea(builder) {
  const s = WORLD_SIZE * 1.2;
  const a = new Vec3(-s, 0, -s), b = new Vec3(s, 0, -s);
  const c = new Vec3(s, 0, s), d = new Vec3(-s, 0, s);
  builder.tri(a, SEA_COLOR, b, SEA_COLOR, c, SEA_COLOR);
  builder.tri(a, SEA_COLOR, c, SEA_COLOR, d, SEA_COLOR);
}

// Seven hundred pines, each a trunk and a cone crown, baked into the
// one static mesh with the rest of the island's furniture. They keep
// off the strip, off the volcano's shoulders and out of the sea.
function buildForest(builder, rng) {
  const COUNT = 700;
  const trunkSoup = cylinderYSoup(0.7, 1.1, 5, 5);
  const crownSoup = coneSoup(4.6, 13, 6);
  const trunkColor = hexColor(0x6b4a2b);
  const crownColors = [hexColor(0x2e5d33), hexColor(0x35703a), hexColor(0x295431)];
  let placed = 0, guard = 0;
  while (placed < COUNT && guard++ < COUNT * 30) {
    const x = (rng() * 2 - 1) * 1750;
    const z = (rng() * 2 - 1) * 1750;
    const h = terrainHeight(x, z);
    if (h < 6 || h > 120) continue;
    if (Math.abs(x - RUNWAY.centerX) < 85 && z > RUNWAY.zMin - 60 && z < RUNWAY.zMax + 300) continue;
    if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 480) continue;
    const scale = 0.8 + rng() * 0.9;
    const spin = rng() * Math.PI * 2;
    const base = mat4Multiply(
      mat4Translation(x, h, z),
      mat4Multiply(mat4RotY(spin), mat4Scale(scale, scale, scale)),
    );
    builder.add(trunkSoup, mat4Multiply(base, mat4Translation(0, 2.2, 0)), trunkColor);
    builder.add(crownSoup, mat4Multiply(base, mat4Translation(0, 11, 0)), crownColors[placed % 3]);
    placed++;
  }
}

// Sixteen little houses with terracotta roofs on the south coast.
function buildVillage(builder, rng) {
  const wallColor = hexColor(0xe8dcc3);
  const roofColor = hexColor(0xb4502e);
  for (let i = 0; i < 16; i++) {
    const x = 430 + rng() * 150 + (i % 4) * 34;
    const z = 470 + Math.floor(i / 4) * 46 + rng() * 16;
    const h = terrainHeight(x, z);
    if (h < 2) continue;
    const w = 10 + rng() * 6, d = 8 + rng() * 5, wallH = 5 + rng() * 2;
    const facing = mat4Multiply(mat4Translation(x, h - 0.3, z), mat4RotY(rng() * 0.6 - 0.3));
    builder.add(boxSoup(w, wallH, d), mat4Multiply(facing, mat4Translation(0, wallH / 2, 0)), wallColor);
    const roofTurn = mat4Multiply(facing, mat4Multiply(mat4Translation(0, wallH + 2.2, 0), mat4RotY(Math.PI / 4)));
    builder.add(coneSoup(Math.max(w, d) * 0.78, 4.5, 4), roofTurn, roofColor);
  }
}

// The strip itself: asphalt, paint, a hangar, a tower and a windsock.
// The lamp spheres and the tower cab go into the glow builder instead,
// so the renderer can light them up.
function buildRunway(builder, glow) {
  const y = RUNWAY.surfaceY;
  const length = RUNWAY.zMax - RUNWAY.zMin;
  const midZ = (RUNWAY.zMin + RUNWAY.zMax) / 2;
  const asphalt = hexColor(0x33383e);
  const paint = hexColor(0xf5f7f2);
  builder.add(
    boxSoup(RUNWAY.halfWidth * 2, 0.5, length),
    mat4Translation(RUNWAY.centerX, y + 0.05, midZ),
    asphalt,
  );
  for (let z = RUNWAY.zMin + 18; z < RUNWAY.zMax - 10; z += 34) {
    builder.add(boxSoup(1.4, 0.12, 16), mat4Translation(RUNWAY.centerX, y + 0.33, z), paint);
  }
  for (const endZ of [RUNWAY.zMin + 6, RUNWAY.zMax - 6]) {
    for (let k = -1.5; k <= 1.5; k++) {
      builder.add(boxSoup(3.4, 0.12, 9), mat4Translation(RUNWAY.centerX + k * 9, y + 0.33, endZ), paint);
    }
  }
  const lampSoup = sphereSoup(0.9, 6, 5);
  const lampColor = hexColor(0xffc861);
  for (let z = RUNWAY.zMin; z <= RUNWAY.zMax; z += 42) {
    for (const side of [-1, 1]) {
      glow.add(lampSoup, mat4Translation(RUNWAY.centerX + side * (RUNWAY.halfWidth + 3), y + 1, z), lampColor);
    }
  }
  builder.add(boxSoup(34, 12, 26), mat4Translation(RUNWAY.centerX + 52, y + 6, RUNWAY.zMin + 60), hexColor(0x7d8a94));
  builder.add(boxSoup(7, 22, 7), mat4Translation(RUNWAY.centerX - 48, y + 11, RUNWAY.zMin + 40), hexColor(0xd8d3c3));
  glow.add(boxSoup(10, 5, 10), mat4Translation(RUNWAY.centerX - 48, y + 24.5, RUNWAY.zMin + 40), hexColor(0x2b4a5e));
  builder.add(cylinderYSoup(0.3, 0.3, 11, 5), mat4Translation(RUNWAY.centerX - 30, y + 5.5, RUNWAY.zMax - 30), hexColor(0xcccccc));
  const sockTurn = mat4Multiply(
    mat4Translation(RUNWAY.centerX - 26.5, y + 10.4, RUNWAY.zMax - 30),
    mat4RotZ(Math.PI / 2.3),
  );
  builder.add(coneSoup(1.8, 7, 6), sockTurn, hexColor(0xff7b24));
}

// One cloud: a few squashed spheres merged into a single mesh, white.
function buildCloud(renderer, rng) {
  const builder = new GeoBuilder();
  const puffs = 3 + Math.floor(rng() * 3);
  const white = hexColor(0xf6faff);
  for (let j = 0; j < puffs; j++) {
    const r = 16 + rng() * 22;
    const m = mat4Multiply(
      mat4Translation(j * 20 - puffs * 9 + rng() * 8, rng() * 6, rng() * 14 - 7),
      mat4Scale(1, 0.45, 1),
    );
    builder.add(sphereSoup(r, 7, 5), m, white);
  }
  return {
    mesh: renderer.createMesh(builder.build()),
    pos: new Vec3((rng() * 2 - 1) * 1900, 300 + rng() * 130, (rng() * 2 - 1) * 1900),
  };
}

export class World {
  constructor(renderer) {
    const rng = mulberry32(20261126);
    const terrain = new GeoBuilder();
    buildTerrain(terrain);
    this.terrainMesh = renderer.createMesh(terrain.build());

    const sea = new GeoBuilder();
    buildSea(sea);
    this.seaMesh = renderer.createMesh(sea.build());

    const statics = new GeoBuilder();
    const glow = new GeoBuilder();
    buildForest(statics, rng);
    buildVillage(statics, rng);
    buildRunway(statics, glow);
    this.staticMesh = renderer.createMesh(statics.build());
    this.glowMesh = renderer.createMesh(glow.build());

    this.clouds = [];
    for (let i = 0; i < 22; i++) this.clouds.push(buildCloud(renderer, rng));

    this.identity = mat4Identity();
    this.seaY = 0;
  }

  update(dt, elapsed) {
    this.seaY = Math.sin(elapsed * 0.5) * 0.25;
    for (const cloud of this.clouds) {
      cloud.pos.x += dt * 3.2;
      if (cloud.pos.x > 2100) cloud.pos.x = -2100;
    }
  }

  addDraws(draws) {
    draws.push({ mesh: this.seaMesh, model: mat4Translation(0, this.seaY, 0), emissive: 0.06 });
    draws.push({ mesh: this.terrainMesh, model: this.identity });
    draws.push({ mesh: this.staticMesh, model: this.identity });
    draws.push({ mesh: this.glowMesh, model: this.identity, emissive: 0.75 });
    for (const cloud of this.clouds) {
      draws.push({
        mesh: cloud.mesh,
        model: mat4Translation(cloud.pos.x, cloud.pos.y, cloud.pos.z),
        emissive: 0.25,
      });
    }
  }
}
