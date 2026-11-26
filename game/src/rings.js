// rings.js — the course: eight gold rings hung around the island in a
// loop that ends lined up with the runway. Only the next ring counts;
// fly through its disc and it flashes green and the next one lights up.

import * as THREE from 'three';

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

export class RingCourse {
  constructor(scene) {
    this.group = new THREE.Group();
    this.rings = RING_POSITIONS.map((p, i) => {
      const geo = new THREE.TorusGeometry(RING_RADIUS, 1.7, 10, 36);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd9a527, emissive: 0x694d05, flatShading: true,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(p.x, p.y, p.z);
      // Each ring faces along the course: look toward the next point (or
      // the runway threshold for the last one).
      const next = RING_POSITIONS[i + 1] || { x: 650, y: 20, z: 300 };
      ring.lookAt(next.x, next.y, next.z);
      this.group.add(ring);
      return { mesh: ring, center: new THREE.Vector3(p.x, p.y, p.z), passed: false };
    });
    scene.add(this.group);
    this.nextIndex = 0;
    this.flashTimer = 0;
    this.refreshMaterials(0);
  }

  get total() { return this.rings.length; }
  get done() { return this.nextIndex >= this.rings.length; }
  get current() { return this.done ? null : this.rings[this.nextIndex]; }

  refreshMaterials(elapsed) {
    this.rings.forEach((ring, i) => {
      const mat = ring.mesh.material;
      if (ring.passed) {
        mat.color.setHex(0x2fae5f); mat.emissive.setHex(0x0d5c2a);
      } else if (i === this.nextIndex) {
        const pulse = 0.55 + 0.35 * Math.sin(elapsed * 4);
        mat.color.setHex(0xffc93c); mat.emissive.setHex(0xa86f06);
        mat.emissiveIntensity = pulse + 0.6;
      } else {
        mat.color.setHex(0xd9a527); mat.emissive.setHex(0x694d05); mat.emissiveIntensity = 1;
      }
    });
  }

  // A pass is crossing the ring's plane within its radius. The previous
  // and current positions straddle the plane; the crossing point must
  // land inside the disc.
  checkPass(prevPos, pos) {
    const ring = this.current;
    if (!ring) return false;
    const normal = new THREE.Vector3();
    ring.mesh.getWorldDirection(normal); // torus faces its local +z
    const toPrev = prevPos.clone().sub(ring.center);
    const toNow = pos.clone().sub(ring.center);
    const dPrev = toPrev.dot(normal);
    const dNow = toNow.dot(normal);
    if (dPrev === 0 || dPrev * dNow > 0) return false; // never crossed
    const t = dPrev / (dPrev - dNow);
    const crossing = prevPos.clone().lerp(pos, t);
    const radial = crossing.distanceTo(ring.center);
    if (radial > RING_RADIUS) return false;
    ring.passed = true;
    this.nextIndex++;
    this.flashTimer = 0.9;
    return true;
  }

  update(dt, elapsed) {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.refreshMaterials(elapsed);
    // A gentle bob keeps the course alive in the chase view.
    this.rings.forEach((ring, i) => {
      ring.mesh.position.y = RING_POSITIONS[i].y + Math.sin(elapsed * 0.9 + i * 1.3) * 1.6;
    });
  }
}
