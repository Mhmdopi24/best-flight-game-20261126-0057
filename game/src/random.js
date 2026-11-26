// random.js — the island's deterministic shape. One seeded height function
// is the single truth for the terrain mesh, the tree scatter and the
// aircraft's ground collision, so what you see is exactly what you can hit.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The runway: a flat coastal strip running north–south. Its rectangle is
// exported because the landing judge and the world builder both need it.
export const RUNWAY = {
  centerX: 650,
  halfWidth: 20,
  zMin: -160,
  zMax: 340,
  surfaceY: 14,
};

export const VOLCANO = { x: -950, z: -800, peak: 300 };

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Distance from a point to the runway rectangle (0 when inside it).
function runwayDistance(x, z) {
  const dx = Math.max(Math.abs(x - RUNWAY.centerX) - RUNWAY.halfWidth, 0);
  const dz = Math.max(z < RUNWAY.zMin ? RUNWAY.zMin - z : 0, z > RUNWAY.zMax ? z - RUNWAY.zMax : 0);
  return Math.hypot(dx, dz);
}

// Terrain height in metres at world (x, z). Sea level is 0; the island
// rises out of it, a volcano cone stands in the north-west, and the ground
// is pressed flat where the runway lies.
export function terrainHeight(x, z) {
  const distCenter = Math.hypot(x, z);
  const islandMask = Math.max(0, 1 - Math.pow(distCenter / 1950, 2));
  let h = -16 + islandMask * 44;
  h += islandMask * (
    30 * Math.sin(x * 0.008) * Math.cos(z * 0.006)
    + 18 * Math.sin(x * 0.021 + 1.7) * Math.sin(z * 0.017 + 0.6)
    + 8 * Math.sin(x * 0.05) * Math.cos(z * 0.043)
  );
  const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (vd < 560) {
    h += Math.max(0, VOLCANO.peak - vd * 0.55);
    if (vd < 60) h -= (60 - vd) * 0.9; // the crater bowl
  }
  const flat = smoothstep(95, 25, runwayDistance(x, z));
  h = h * (1 - flat) + RUNWAY.surfaceY * flat;
  // The southern approach: a glide-path wedge pressed into the coastal
  // hill, so final is a clean descent along a ramp to the threshold
  // instead of a wall of green at the strip's end.
  if (z > RUNWAY.zMax && z < 780) {
    const glide = RUNWAY.surfaceY + (z - RUNWAY.zMax) * 0.055;
    const latF = smoothstep(120, 45, Math.abs(x - RUNWAY.centerX));
    const endF = smoothstep(780, 580, z);
    const f = latF * endF * 0.9;
    h = h * (1 - f) + glide * f;
  }
  return h;
}
