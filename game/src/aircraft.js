// aircraft.js — the little mail plane: a low-poly high-wing prop built
// from primitives, and a forgiving arcade flight model. Bank to turn,
// keep your speed up or she mushes and sinks, and mind the ground — the
// terrain height comes from the same function that draws the island.

import * as THREE from 'three';
import { terrainHeight, RUNWAY } from './random.js';

const MIN_SPEED = 0;
const MAX_SPEED = 66;
const CRUISE_THRUST = 15;

function buildPlaneMesh() {
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f0e9, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8641e, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x22282e, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d3d52, flatShading: true, emissive: 0x0d2436, roughness: 0.25 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 8.6, 8), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.05, 1.1, 8), trimMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -4.6;
  plane.add(nose);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.02, 8, 6), glassMat);
  cockpit.scale.set(0.92, 0.72, 1.7);
  cockpit.position.set(0, 0.82, -0.7);
  plane.add(cockpit);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 2.1), trimMat);
  wing.position.set(0, 1.15, -0.9);
  plane.add(wing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.3), trimMat);
  tailWing.position.set(0, 0.55, 4.1);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.5), trimMat);
  fin.position.set(0, 1.35, 4.1);
  plane.add(fin);
  // Fixed gear: two mains and a tail wheel, always down.
  const gearMat = darkMat;
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 5), gearMat);
    strut.position.set(side * 1.25, -1.25, -1.1);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 8), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.25, -2.05, -1.1);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 8), gearMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 4.2);
  plane.add(tailWheel);
  // Navigation lights: port red, starboard green, both lit.
  const portLamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  portLamp.position.set(-6.8, 1.15, -0.9);
  const starLamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), new THREE.MeshBasicMaterial({ color: 0x35e065 }));
  starLamp.position.set(6.8, 1.15, -0.9);
  plane.add(portLamp, starLamp);
  // The propeller, spun by the game loop.
  const prop = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, flatShading: true });
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.6, 0.1), bladeMat);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.34, 0.1), bladeMat);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), trimMat);
  prop.add(bladeA, bladeB, hub);
  prop.position.z = -5.35;
  plane.add(prop);
  return { group: plane, prop };
}

export class Aircraft {
  constructor(scene) {
    const { group, prop } = buildPlaneMesh();
    this.mesh = group;
    this.prop = prop;
    scene.add(group);
    this.reset();
  }

  // Airborne south of the island, facing north (-z) toward the first ring.
  reset() {
    this.position = new THREE.Vector3(RUNWAY.centerX, 96, 1180);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 40;
    this.throttle = 0.62;
    this.verticalSpeed = 0;
    this.crashed = false;
    this.landed = false;
    this.syncMesh(0);
  }

  // Heading in degrees, 0 = north (-z), 90 = east (+x).
  get headingDeg() {
    const deg = ((-this.yaw) * 180 / Math.PI) % 360;
    return (deg + 360) % 360;
  }

  forwardVector(out) {
    const cp = Math.cos(this.pitch);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    return out;
  }

  update(dt, input) {
    if (this.crashed || this.landed) return;
    // Throttle.
    if (input.held('KeyW')) this.throttle = Math.min(1, this.throttle + dt * 0.55);
    if (input.held('KeyS')) this.throttle = Math.max(0, this.throttle - dt * 0.55);
    // Elevator and ailerons ease toward their targets so she feels weighty.
    const pitchInput = (input.held('ArrowUp') ? 1 : 0) - (input.held('ArrowDown') ? 1 : 0);
    const rollInput = (input.held('ArrowRight') ? 1 : 0) - (input.held('ArrowLeft') ? 1 : 0);
    const targetPitch = pitchInput * 0.42;
    const targetRoll = rollInput * 0.95;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 4.2);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 4.6);
    // A banked wing turns the nose; the rudder nudges it too.
    this.yaw -= Math.sin(this.roll) * dt * 0.85;
    if (input.held('KeyQ')) this.yaw += dt * 0.35;
    if (input.held('KeyE')) this.yaw -= dt * 0.35;
    // Speed chases the throttle, with drag and a gravity tug in a dive.
    const targetSpeed = this.throttle * MAX_SPEED;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.55);
    this.speed += -Math.sin(this.pitch) * dt * 9;
    this.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED + 12, this.speed));
    // Move along the nose.
    const fwd = this.forwardVector(new THREE.Vector3());
    const prevY = this.position.y;
    this.position.addScaledVector(fwd, this.speed * dt);
    // Too slow and she mushes: lift fades below 21 and the nose drops.
    if (this.speed < 21) {
      this.position.y -= (21 - this.speed) * dt * 0.85;
      this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 1.4);
    }
    this.verticalSpeed = dt > 0 ? (this.position.y - prevY) / dt : 0;
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    this.mesh.position.copy(this.position);
    // The mesh is built nose-first down -z, the same frame forwardVector
    // uses: yaw about Y, then pitch about the local X (nose up is
    // positive), then roll about the local Z (right bank drops the
    // right wing, so the sign flips).
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateY(this.yaw);
    this.mesh.rotateX(this.pitch);
    this.mesh.rotateZ(-this.roll);
    if (dt > 0 && !this.crashed) this.prop.rotation.z += dt * (6 + this.throttle * 46);
  }

  // Ground contact: returns 'runway' | 'ground' | 'water' | null. The
  // wheels hang 2.67 below the fuselage centre; the runway's asphalt top
  // sits 0.3 above the flattened terrain.
  groundContact() {
    const groundY = terrainHeight(this.position.x, this.position.z);
    const onRunway = Math.abs(this.position.x - RUNWAY.centerX) <= RUNWAY.halfWidth
      && this.position.z >= RUNWAY.zMin && this.position.z <= RUNWAY.zMax;
    const surfaceY = onRunway ? RUNWAY.surfaceY + 0.3 : groundY;
    if (this.position.y - 2.67 > surfaceY) return null;
    if (onRunway) return 'runway';
    return groundY <= 0.4 ? 'water' : 'ground';
  }
}
