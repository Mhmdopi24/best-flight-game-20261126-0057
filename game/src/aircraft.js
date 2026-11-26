// aircraft.js — the little mail plane: a low-poly high-wing prop built
// from the renderer's own primitives, and a forgiving arcade flight
// model. Bank to turn, keep your speed up or she mushes and sinks, and
// mind the ground — the terrain height comes from the same function
// that draws the island.

import {
  GeoBuilder, Vec3, hexColor,
  mat4Multiply, mat4Translation, mat4RotZ, mat4Scale, mat4Place, mat4Attitude,
  boxSoup, cylinderZSoup, cylinderYSoup, cylinderXSoup, sphereSoup,
} from './render3d.js';
import { terrainHeight, RUNWAY } from './random.js';

const MAX_SPEED = 66;

// The airframe in its own frame, nose toward -z: a tapered fuselage
// with an orange cowling, a glasshouse canopy, the high wing, tail
// feathers, fixed gear and the two lit wingtip lamps. The lamps go to
// their own mesh so the renderer can keep them glowing.
function buildPlaneMeshes(renderer) {
  const body = new GeoBuilder();
  const white = hexColor(0xf2f0e9);
  const orange = hexColor(0xe8641e);
  const dark = hexColor(0x22282e);
  const glass = hexColor(0x1d3d52);
  body.add(cylinderZSoup(1.0, 0.45, 8.6, 8), mat4Translation(0, 0, 0), white);
  body.add(cylinderZSoup(1.06, 1.12, 1.1, 8), mat4Translation(0, 0, -4.55), orange);
  const canopy = mat4Multiply(mat4Translation(0, 0.82, -0.7), mat4Scale(0.92, 0.72, 1.7));
  body.add(sphereSoup(1.02, 8, 6), canopy, glass);
  body.add(boxSoup(13.5, 0.28, 2.1), mat4Translation(0, 1.15, -0.9), orange);
  body.add(boxSoup(4.6, 0.22, 1.3), mat4Translation(0, 0.55, 4.1), orange);
  body.add(boxSoup(0.22, 2.2, 1.5), mat4Translation(0, 1.35, 4.1), orange);
  for (const side of [-1, 1]) {
    body.add(cylinderYSoup(0.14, 0.14, 1.5, 5), mat4Translation(side * 1.25, -1.25, -1.1), dark);
    body.add(cylinderXSoup(0.62, 0.4, 8), mat4Translation(side * 1.25, -2.05, -1.1), dark);
  }
  body.add(cylinderXSoup(0.34, 0.3, 8), mat4Translation(0, -0.85, 4.2), dark);

  const lamps = new GeoBuilder();
  lamps.add(sphereSoup(0.24, 6, 5), mat4Translation(-6.8, 1.15, -0.9), hexColor(0xff3b30));
  lamps.add(sphereSoup(0.24, 6, 5), mat4Translation(6.8, 1.15, -0.9), hexColor(0x35e065));

  const prop = new GeoBuilder();
  const blade = hexColor(0x2c2c30);
  prop.add(boxSoup(0.34, 4.6, 0.1), mat4Translation(0, 0, 0), blade);
  prop.add(boxSoup(4.6, 0.34, 0.1), mat4Translation(0, 0, 0), blade);
  prop.add(sphereSoup(0.42, 6, 5), mat4Translation(0, 0, 0), orange);

  return {
    body: renderer.createMesh(body.build()),
    lamps: renderer.createMesh(lamps.build()),
    prop: renderer.createMesh(prop.build()),
  };
}

export class Aircraft {
  constructor(renderer) {
    this.meshes = buildPlaneMeshes(renderer);
    this.propAngle = 0;
    this.model = null;
    this.propModel = null;
    this.reset();
  }

  // Airborne south of the island, facing north (-z) toward the first ring.
  reset() {
    this.position = new Vec3(RUNWAY.centerX, 96, 1180);
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
    this.speed = Math.max(0, Math.min(MAX_SPEED + 12, this.speed));
    // Move along the nose.
    const fwd = this.forwardVector(new Vec3());
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

  // Works out the two model matrices the renderer needs: the airframe
  // at its position and attitude, and the propeller spun on the nose.
  syncMesh(dt) {
    if (dt > 0 && !this.crashed) this.propAngle += dt * (6 + this.throttle * 46);
    this.model = mat4Place(mat4Attitude(this.yaw, this.pitch, this.roll), this.position);
    this.propModel = mat4Multiply(
      this.model,
      mat4Multiply(mat4Translation(0, 0, -5.35), mat4RotZ(this.propAngle)),
    );
  }

  addDraws(draws) {
    draws.push({ mesh: this.meshes.body, model: this.model });
    draws.push({ mesh: this.meshes.lamps, model: this.model, emissive: 0.9 });
    draws.push({ mesh: this.meshes.prop, model: this.propModel });
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
