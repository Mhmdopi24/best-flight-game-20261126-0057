// render3d.js — Hornbill Run's own little 3D engine, written for this
// game and nothing else: a Vec3, the handful of 4x4 matrices a chase
// camera needs, a set of low-poly primitive builders (box, cylinder,
// cone, sphere, torus) and a WebGL2 renderer that flat-shades every
// triangle from its screen-space derivatives, fades distance into fog
// and paints a gradient sky with a sun behind everything. No library
// code ships with the game; this file is the whole engine.

// ---------------------------------------------------------------- Vec3

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }

  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }

  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v, s) {
    this.x += v.x * s; this.y += v.y * s; this.z += v.z * s;
    return this;
  }

  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  distanceTo(v) {
    return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  normalize() {
    const len = this.length() || 1;
    this.x /= len; this.y /= len; this.z /= len;
    return this;
  }
}

export function crossOf(a, b, out) {
  out.set(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
  return out;
}

// ---------------------------------------------------------------- Mat4
// Column-major Float32Array(16), the layout WebGL wants: the element
// at column c, row r lives at index c * 4 + r.

export function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function mat4Multiply(a, b) {
  // Returns a * b: b's transform is applied to a vector first.
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

export function mat4Translation(x, y, z) {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function mat4Scale(x, y, z) {
  const m = new Float32Array(16);
  m[0] = x; m[5] = y; m[10] = z; m[15] = 1;
  return m;
}

export function mat4RotX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const m = mat4Identity();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}

export function mat4RotY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const m = mat4Identity();
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}

export function mat4RotZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const m = mat4Identity();
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}

// A model matrix from a position and a rotation matrix: the rotation
// with the translation column filled in.
export function mat4Place(rotation, pos) {
  const m = Float32Array.from(rotation);
  m[12] = pos.x; m[13] = pos.y; m[14] = pos.z;
  return m;
}

// The aircraft's attitude: yaw about Y, then pitch about the local X,
// then roll about the local Z with its sign flipped (a right bank drops
// the right wing). As one matrix: Ry * Rx * Rz(-roll).
export function mat4Attitude(yaw, pitch, roll) {
  return mat4Multiply(
    mat4RotY(yaw),
    mat4Multiply(mat4RotX(pitch), mat4RotZ(-roll)),
  );
}

// A rotation whose +Z axis points from eye toward target, the way a
// ring hung in the air faces along the course. Columns are the local
// X, Y and Z axes expressed in world space.
export function mat4Facing(eye, target, upHint) {
  const z = new Vec3(target.x - eye.x, target.y - eye.y, target.z - eye.z).normalize();
  const x = crossOf(upHint, z, new Vec3()).normalize();
  const y = crossOf(z, x, new Vec3());
  const m = mat4Identity();
  m[0] = x.x; m[1] = x.y; m[2] = x.z;
  m[4] = y.x; m[5] = y.y; m[6] = y.z;
  m[8] = z.x; m[9] = z.y; m[10] = z.z;
  return m;
}

// The camera's orthonormal basis: forward from eye toward target,
// right and up completing the frame.
export function cameraBasis(eye, target, upHint) {
  const fwd = new Vec3(target.x - eye.x, target.y - eye.y, target.z - eye.z).normalize();
  const right = crossOf(fwd, upHint, new Vec3()).normalize();
  const up = crossOf(right, fwd, new Vec3());
  return { fwd, right, up };
}

// The view matrix for a camera basis: rows are the basis axes and the
// translation is the eye dotted against each of them, negated.
export function mat4View(eye, basis) {
  const { right, up, fwd } = basis;
  const m = mat4Identity();
  m[0] = right.x; m[1] = up.x; m[2] = -fwd.x;
  m[4] = right.y; m[5] = up.y; m[6] = -fwd.y;
  m[8] = right.z; m[9] = up.z; m[10] = -fwd.z;
  m[12] = -right.dot(eye);
  m[13] = -up.dot(eye);
  m[14] = fwd.dot(eye);
  return m;
}

export function mat4Perspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function transformPoint(m, v, out) {
  const x = v.x, y = v.y, z = v.z;
  out.set(
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  );
  return out;
}

// ------------------------------------------------------- primitive soup
// Each builder returns a flat array of triangle vertices [x, y, z, ...]
// in its own local frame, centred on the origin. Winding is kept
// counter-clockwise seen from outside, though the renderer shades both
// faces so a slipped triangle can never punch a hole in a model.

export function hexColor(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function pushTri(arr, a, b, c) {
  arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function pushQuad(arr, a, b, c, d) {
  pushTri(arr, a, b, c);
  pushTri(arr, a, c, d);
}

export function boxSoup(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const arr = [];
  pushQuad(arr, [-x, -y, -z], [-x, y, -z], [x, y, -z], [x, -y, -z]); // nose (-z)
  pushQuad(arr, [x, -y, z], [x, y, z], [-x, y, z], [-x, -y, z]);     // tail (+z)
  pushQuad(arr, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]);     // top
  pushQuad(arr, [-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z]); // bottom
  pushQuad(arr, [x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]);     // right
  pushQuad(arr, [-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z]); // left
  return arr;
}

// A cylinder whose axis runs along Z: the front ring (radius rFront)
// sits at z = -len/2, the back ring (rBack) at z = +len/2.
export function cylinderZSoup(rFront, rBack, len, segs) {
  const arr = [];
  const ring = (r, z) => {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    }
    return pts;
  };
  const front = ring(rFront, -len / 2);
  const back = ring(rBack, len / 2);
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    pushQuad(arr, front[i], back[i], back[j], front[j]);
    pushTri(arr, [0, 0, -len / 2], front[j], front[i]);
    pushTri(arr, [0, 0, len / 2], back[i], back[j]);
  }
  return arr;
}

// A cylinder whose axis runs along Y (a tree trunk, a gear strut).
export function cylinderYSoup(rTop, rBottom, h, segs) {
  const arr = [];
  const ring = (r, y) => {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return pts;
  };
  const top = ring(rTop, h / 2);
  const bottom = ring(rBottom, -h / 2);
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    pushQuad(arr, bottom[i], top[i], top[j], bottom[j]);
    pushTri(arr, [0, h / 2, 0], top[i], top[j]);
    pushTri(arr, [0, -h / 2, 0], bottom[j], bottom[i]);
  }
  return arr;
}

// A cylinder whose axis runs along X (a wheel).
export function cylinderXSoup(r, len, segs) {
  const arr = [];
  const ring = (x) => {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([x, Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  };
  const left = ring(-len / 2);
  const right = ring(len / 2);
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    pushQuad(arr, left[i], right[i], right[j], left[j]);
    pushTri(arr, [-len / 2, 0, 0], left[i], left[j]);
    pushTri(arr, [len / 2, 0, 0], right[j], right[i]);
  }
  return arr;
}

// A cone standing on Y: base circle at y = -h/2, apex at y = +h/2.
export function coneSoup(r, h, segs) {
  const arr = [];
  const apex = [0, h / 2, 0];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const p0 = [Math.cos(a0) * r, -h / 2, Math.sin(a0) * r];
    const p1 = [Math.cos(a1) * r, -h / 2, Math.sin(a1) * r];
    pushTri(arr, p0, apex, p1);
    pushTri(arr, [0, -h / 2, 0], p1, p0);
  }
  return arr;
}

export function sphereSoup(r, wSegs, hSegs) {
  const arr = [];
  const point = (u, v) => {
    const phi = u * Math.PI * 2;
    const theta = v * Math.PI;
    return [
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi),
    ];
  };
  for (let i = 0; i < wSegs; i++) {
    for (let j = 0; j < hSegs; j++) {
      const a = point(i / wSegs, j / hSegs);
      const b = point((i + 1) / wSegs, j / hSegs);
      const c = point((i + 1) / wSegs, (j + 1) / hSegs);
      const d = point(i / wSegs, (j + 1) / hSegs);
      pushQuad(arr, a, b, c, d);
    }
  }
  return arr;
}

// A torus in the XY plane, its hole along Z — the shape of a course
// ring, facing down its own +Z.
export function torusSoup(radius, tube, radSegs, tubSegs) {
  const arr = [];
  const point = (i, j) => {
    const u = (i / tubSegs) * Math.PI * 2;
    const v = (j / radSegs) * Math.PI * 2;
    const ringR = radius + tube * Math.cos(v);
    return [ringR * Math.cos(u), ringR * Math.sin(u), tube * Math.sin(v)];
  };
  for (let i = 0; i < tubSegs; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = point(i, j);
      const b = point(i + 1, j);
      const c = point(i + 1, j + 1);
      const d = point(i, j + 1);
      pushQuad(arr, a, b, c, d);
    }
  }
  return arr;
}

// ------------------------------------------------------------ GeoBuilder
// Accumulates transformed, coloured triangles into one mesh's arrays.

export class GeoBuilder {
  constructor() {
    this.positions = [];
    this.colors = [];
  }

  // One triangle with its own colour at each corner (the terrain).
  tri(a, ca, b, cb, c, cc) {
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.colors.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }

  // A whole primitive soup under one transform and one flat colour.
  add(soup, matrix, color) {
    const v = new Vec3();
    for (let i = 0; i < soup.length; i += 3) {
      v.set(soup[i], soup[i + 1], soup[i + 2]);
      transformPoint(matrix, v, v);
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(color[0], color[1], color[2]);
    }
  }

  build() {
    return {
      positions: new Float32Array(this.positions),
      colors: new Float32Array(this.colors),
    };
  }
}

// -------------------------------------------------------------- Renderer

const SCENE_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vColor;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vColor = aColor;
  gl_Position = uViewProj * world;
}`;

// Flat shading from the derivatives of the world position: every
// triangle takes the light of its own face, which is what gives the
// island and the aircraft their low-poly facets.
const SCENE_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uTint;
uniform float uEmissive;
out vec4 fragColor;
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (!gl_FrontFacing) n = -n;
  float diff = max(dot(n, uSunDir), 0.0);
  vec3 base = vColor * uTint;
  vec3 col = base * (0.40 + 0.74 * diff) + base * uEmissive;
  float dist = distance(uCamPos, vWorld);
  float f = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, f);
  fragColor = vec4(col, 1.0);
}`;

const SKY_VERT = `#version 300 es
layout(location = 0) in vec2 aXY;
out vec2 vXY;
void main() {
  vXY = aXY;
  gl_Position = vec4(aXY, 1.0, 1.0);
}`;

const SKY_FRAG = `#version 300 es
precision highp float;
in vec2 vXY;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec3 uSunDir;
out vec4 fragColor;
void main() {
  vec3 ray = normalize(uCamFwd
    + uCamRight * (vXY.x * uAspect * uTanHalfFov)
    + uCamUp * (vXY.y * uTanHalfFov));
  vec3 zen = vec3(0.34, 0.56, 0.82);
  vec3 hor = vec3(0.76, 0.85, 0.94);
  vec3 low = vec3(0.62, 0.74, 0.87);
  vec3 col = ray.y > 0.0
    ? mix(hor, zen, pow(clamp(ray.y, 0.0, 1.0), 0.6))
    : mix(hor, low, clamp(-ray.y * 3.0, 0.0, 1.0));
  float s = max(dot(ray, uSunDir), 0.0);
  col += vec3(1.0, 0.86, 0.58) * (pow(s, 240.0) * 0.9 + pow(s, 9.0) * 0.12);
  fragColor = vec4(col, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function compileProgram(gl, vertSource, fragSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.sceneProgram = compileProgram(gl, SCENE_VERT, SCENE_FRAG);
    this.skyProgram = compileProgram(gl, SKY_VERT, SKY_FRAG);
    this.u = {};
    for (const name of ['uViewProj', 'uModel', 'uSunDir', 'uCamPos', 'uFogColor', 'uFogNear', 'uFogFar', 'uTint', 'uEmissive']) {
      this.u[name] = gl.getUniformLocation(this.sceneProgram, name);
    }
    this.skyU = {};
    for (const name of ['uCamRight', 'uCamUp', 'uCamFwd', 'uTanHalfFov', 'uAspect', 'uSunDir']) {
      this.skyU[name] = gl.getUniformLocation(this.skyProgram, name);
    }
    // One fullscreen triangle for the sky pass.
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // The sun the world is lit by, and the fog its distance fades into.
    this.sunDir = new Vec3(900, 1300, 500).normalize();
    this.fogColor = [0.72, 0.83, 0.93];
    this.fogNear = 500;
    this.fogFar = 3600;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.aspect = window.innerWidth / window.innerHeight;
    this.gl.viewport(0, 0, w, h);
  }

  createMesh(geometry) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: geometry.positions.length / 3 };
  }

  // Draws the sky, then every item of the draw list:
  // { mesh, model, tint?, emissive? }.
  frame(camera, draws) {
    const gl = this.gl;
    const proj = mat4Perspective(camera.fovY, this.aspect, camera.near, camera.far);
    const basis = cameraBasis(camera.pos, camera.target, new Vec3(0, 1, 0));
    const view = mat4View(camera.pos, basis);
    const viewProj = mat4Multiply(proj, view);

    // Sky first, with the depth test off.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.skyProgram);
    gl.uniform3f(this.skyU.uCamRight, basis.right.x, basis.right.y, basis.right.z);
    gl.uniform3f(this.skyU.uCamUp, basis.up.x, basis.up.y, basis.up.z);
    gl.uniform3f(this.skyU.uCamFwd, basis.fwd.x, basis.fwd.y, basis.fwd.z);
    gl.uniform1f(this.skyU.uTanHalfFov, Math.tan(camera.fovY / 2));
    gl.uniform1f(this.skyU.uAspect, this.aspect);
    gl.uniform3f(this.skyU.uSunDir, this.sunDir.x, this.sunDir.y, this.sunDir.z);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Then the world, depth-tested.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.sceneProgram);
    gl.uniformMatrix4fv(this.u.uViewProj, false, viewProj);
    gl.uniform3f(this.u.uSunDir, this.sunDir.x, this.sunDir.y, this.sunDir.z);
    gl.uniform3f(this.u.uCamPos, camera.pos.x, camera.pos.y, camera.pos.z);
    gl.uniform3f(this.u.uFogColor, this.fogColor[0], this.fogColor[1], this.fogColor[2]);
    gl.uniform1f(this.u.uFogNear, this.fogNear);
    gl.uniform1f(this.u.uFogFar, this.fogFar);
    for (const item of draws) {
      const tint = item.tint || [1, 1, 1];
      gl.uniformMatrix4fv(this.u.uModel, false, item.model);
      gl.uniform3f(this.u.uTint, tint[0], tint[1], tint[2]);
      gl.uniform1f(this.u.uEmissive, item.emissive || 0);
      gl.bindVertexArray(item.mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, item.mesh.count);
    }
    gl.bindVertexArray(null);
  }
}
