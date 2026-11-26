// rings.js — the course: eight gold rings hung around the island in a
// loop that ends lined up with the runway. Only the next ring counts;
// fly through its disc and it turns green and the next one lights up.
// Each ring is the renderer's own torus, turned to face along the
// course, and the pass test is a plane crossing against that facing.

import {
  GeoBuilder, Vec3, mat4Identity, mat4Facing, mat4Place, torusSoup,
} from './render3d.js';

export const RING_POSITIONS = [
  { x: 150, y: 118, z: -350 },
  { x: -350, y: 168, z: -640 },
  { x: -760, y: 235, z: -430 },
  { x: -1020, y: 205, z: 140 },
  { x: -430, y: 148, z: 540 },
  { x: 170, y: 128, z: 740 },
  { x: 640, y: 104, z: 610 },
  { x: 650, y: 56, z: 385 },
];

export const RING_RADIUS = 25;

const UP = new Vec3(0, 1, 0);
const GOLD = [1.0, 0.79, 0.24];
const GOLD_DIM = [0.85, 0.65, 0.15];
const PASSED_GREEN = [0.18, 0.68, 0.37];

export class RingCourse {
  constructor(renderer) {
    const builder = new GeoBuilder();
    builder.add(torusSoup(RING_RADIUS, 1.7, 10, 36), mat4Identity(), [1, 1, 1]);
    this.mesh = renderer.createMesh(builder.build());
    this.rings = RING_POSITIONS.map((p, i) => {
      const center = new Vec3(p.x, p.y, p.z);
      const next = RING_POSITIONS[i + 1] || { x: 650, y: 20, z: 300 };
      const facing = mat4Facing(center, new Vec3(next.x, next.y, next.z), UP);
      // The ring's normal is its facing matrix's Z column.
      const normal = new Vec3(facing[8], facing[9], facing[10]);
      return { center, facing, normal, passed: false };
    });
    this.nextIndex = 0;
    this.flashTimer = 0;
    this.elapsed = 0;
  }

  get total() { return this.rings.length; }
  get done() { return this.nextIndex >= this.rings.length; }
  get current() { return this.done ? null : this.rings[this.nextIndex]; }

  // A pass is crossing the ring's plane within its radius. The previous
  // and current positions straddle the plane; the crossing point must
  // land inside the disc.
  checkPass(prevPos, pos) {
    const ring = this.current;
    if (!ring) return false;
    const dPrev = (prevPos.x - ring.center.x) * ring.normal.x
      + (prevPos.y - ring.center.y) * ring.normal.y
      + (prevPos.z - ring.center.z) * ring.normal.z;
    const dNow = (pos.x - ring.center.x) * ring.normal.x
      + (pos.y - ring.center.y) * ring.normal.y
      + (pos.z - ring.center.z) * ring.normal.z;
    if (dPrev === 0 || dPrev * dNow > 0) return false; // never crossed
    const t = dPrev / (dPrev - dNow);
    const cx = prevPos.x + (pos.x - prevPos.x) * t;
    const cy = prevPos.y + (pos.y - prevPos.y) * t;
    const cz = prevPos.z + (pos.z - prevPos.z) * t;
    const radial = Math.hypot(cx - ring.center.x, cy - ring.center.y, cz - ring.center.z);
    if (radial > RING_RADIUS) return false;
    ring.passed = true;
    this.nextIndex++;
    this.flashTimer = 0.9;
    return true;
  }

  update(dt, elapsed) {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.elapsed = elapsed;
  }

  addDraws(draws) {
    this.rings.forEach((ring, i) => {
      // A gentle bob keeps the course alive in the chase view.
      const bobbed = new Vec3(
        ring.center.x,
        ring.center.y + Math.sin(this.elapsed * 0.9 + i * 1.3) * 1.6,
        ring.center.z,
      );
      let tint = GOLD_DIM, emissive = 0.15;
      if (ring.passed) {
        tint = PASSED_GREEN; emissive = 0.3;
      } else if (i === this.nextIndex) {
        tint = GOLD;
        emissive = 0.85 + 0.35 * Math.sin(this.elapsed * 4);
      }
      draws.push({ mesh: this.mesh, model: mat4Place(ring.facing, bobbed), tint, emissive });
    });
  }
}
