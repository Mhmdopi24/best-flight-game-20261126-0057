// world.js — Hornbill Ridge itself: one volcanic island built from the
// seeded height function in random.js. Vertex-coloured terrain, a flat
// sea, instanced pine forest, a fishing village, drifting clouds and the
// coastal runway the run ends on. Everything is geometry and colour —
// no textures, no network.

import * as THREE from 'three';
import { mulberry32, terrainHeight, RUNWAY, VOLCANO } from './random.js';

const WORLD_SIZE = 4200;

function terrainColor(h, slope, out) {
  if (h < 1.5) out.setRGB(0.85, 0.76, 0.52);            // beach sand
  else if (h < 42) out.setRGB(0.36, 0.58, 0.27);       // lowland grass
  else if (h < 95) out.setRGB(0.22, 0.45, 0.22);       // forest green
  else if (h < 175) out.setRGB(0.42, 0.36, 0.30);      // rock
  else if (h < 238) out.setRGB(0.30, 0.24, 0.20);      // volcanic ash
  else out.setRGB(0.94, 0.95, 0.97);                    // the pale crater rim
  if (slope > 0.85 && h >= 1.5) out.multiplyScalar(0.82);
  return out;
}

function buildTerrain() {
  const segments = 150;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Cheap slope estimate from two neighbours, for shading variety.
    a.set(x + 14, terrainHeight(x + 14, z), z);
    b.set(x, terrainHeight(x, z + 14), z + 14);
    c.set(x, h, z);
    const slope = Math.abs(a.y - h) + Math.abs(b.y - h);
    terrainColor(h, slope, color);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  return new THREE.Mesh(geo, mat);
}

function buildSea() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({ color: 0x1d6f9f, shininess: 90, specular: 0x99d4ff, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = 0;
  return sea;
}

function buildForest(rng) {
  const COUNT = 700;
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 5, 5);
  const crownGeo = new THREE.ConeGeometry(4.6, 13, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, flatShading: true });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e5d33, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < COUNT && guard++ < COUNT * 30) {
    const x = (rng() * 2 - 1) * 1750;
    const z = (rng() * 2 - 1) * 1750;
    const h = terrainHeight(x, z);
    if (h < 6 || h > 120) continue;
    if (Math.abs(x - RUNWAY.centerX) < 85 && z > RUNWAY.zMin - 60 && z < RUNWAY.zMax + 300) continue;
    if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 480) continue;
    const scale = 0.8 + rng() * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
    s.set(scale, scale, scale);
    p.set(x, h + 2.2 * scale, z);
    m.compose(p, q, s);
    trunks.setMatrixAt(placed, m);
    p.y = h + (5 + 6) * scale;
    m.compose(p, q, s);
    crowns.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed; crowns.count = placed;
  return [trunks, crowns];
}

function buildVillage(rng) {
  const village = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc3, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb4502e, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const x = 430 + rng() * 150 + (i % 4) * 34;
    const z = 470 + Math.floor(i / 4) * 46 + rng() * 16;
    const h = terrainHeight(x, z);
    if (h < 2) continue;
    const house = new THREE.Group();
    const w = 10 + rng() * 6, d = 8 + rng() * 5, wallH = 5 + rng() * 2;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    walls.position.y = wallH / 2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 4.5, 4), roofMat);
    roof.position.y = wallH + 2.2;
    roof.rotation.y = Math.PI / 4;
    house.add(walls, roof);
    house.position.set(x, h - 0.3, z);
    house.rotation.y = rng() * 0.6 - 0.3;
    village.add(house);
  }
  return village;
}

function buildClouds(rng) {
  const clouds = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xf6faff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = 16 + rng() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
      puff.position.set(j * 20 - puffs * 9 + rng() * 8, rng() * 6, rng() * 14 - 7);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((rng() * 2 - 1) * 1900, 300 + rng() * 130, (rng() * 2 - 1) * 1900);
    clouds.add(cloud);
  }
  return clouds;
}

function buildRunway() {
  const strip = new THREE.Group();
  const length = RUNWAY.zMax - RUNWAY.zMin;
  const midZ = (RUNWAY.zMin + RUNWAY.zMax) / 2;
  const y = RUNWAY.surfaceY;
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.halfWidth * 2, 0.5, length),
    new THREE.MeshStandardMaterial({ color: 0x33383e, flatShading: true }),
  );
  asphalt.position.set(RUNWAY.centerX, y + 0.05, midZ);
  strip.add(asphalt);
  const paintMat = new THREE.MeshBasicMaterial({ color: 0xf5f7f2 });
  // Centreline dashes.
  for (let z = RUNWAY.zMin + 18; z < RUNWAY.zMax - 10; z += 34) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 16), paintMat);
    dash.position.set(RUNWAY.centerX, y + 0.36, z);
    strip.add(dash);
  }
  // Threshold bars at both ends.
  for (const endZ of [RUNWAY.zMin + 6, RUNWAY.zMax - 6]) {
    for (let k = -1.5; k <= 1.5; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 9), paintMat);
      bar.position.set(RUNWAY.centerX + k * 9, y + 0.36, endZ);
      strip.add(bar);
    }
  }
  // Edge lights, lit amber — the strip reads from the air at a glance.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  const lightGeo = new THREE.SphereGeometry(0.9, 6, 5);
  for (let z = RUNWAY.zMin; z <= RUNWAY.zMax; z += 42) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(RUNWAY.centerX + side * (RUNWAY.halfWidth + 3), y + 1, z);
      strip.add(lamp);
    }
  }
  // A hangar and a little tower beside the strip.
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 26),
    new THREE.MeshStandardMaterial({ color: 0x7d8a94, flatShading: true }));
  hangar.position.set(RUNWAY.centerX + 52, y + 6, RUNWAY.zMin + 60);
  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 7),
    new THREE.MeshStandardMaterial({ color: 0xd8d3c3, flatShading: true }));
  towerBase.position.set(RUNWAY.centerX - 48, y + 11, RUNWAY.zMin + 40);
  const towerCab = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b4a5e, flatShading: true, emissive: 0x1c4258 }));
  towerCab.position.set(RUNWAY.centerX - 48, y + 24.5, RUNWAY.zMin + 40);
  strip.add(hangar, towerBase, towerCab);
  // Windsock: pole and a bright cone.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 11, 5),
    new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  pole.position.set(RUNWAY.centerX - 30, y + 5.5, RUNWAY.zMax - 30);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0xff7b24, flatShading: true }));
  sock.rotation.z = Math.PI / 2.3;
  sock.position.set(RUNWAY.centerX - 26.5, y + 10.4, RUNWAY.zMax - 30);
  strip.add(pole, sock);
  return strip;
}

export class World {
  constructor(scene) {
    const rng = mulberry32(20261126);
    scene.background = new THREE.Color(0x9fc9e8);
    scene.fog = new THREE.Fog(0xa8cdea, 500, 3600);
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    sun.position.set(900, 1300, 500);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5f7350, 0.95));
    this.sea = buildSea();
    this.clouds = buildClouds(rng);
    scene.add(buildTerrain(), this.sea, buildVillage(rng), buildRunway(), this.clouds);
    scene.add(...buildForest(rng));
  }

  update(dt, elapsed) {
    this.sea.position.y = Math.sin(elapsed * 0.5) * 0.25;
    for (const cloud of this.clouds.children) {
      cloud.position.x += dt * 3.2;
      if (cloud.position.x > 2100) cloud.position.x = -2100;
    }
  }
}
