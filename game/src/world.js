// SABLE YARD — the freight yard. A 40 x 28 m rectangle at dusk: stained
// concrete, coloured shipping containers forming lanes and cover, two painted
// bomb sites, crates, barrels, sandbags, fences, a silo, pipes, lamp posts,
// tower cranes, a skyline silhouette and a gradient dusk sky.
// Also owns the collision model (axis-aligned boxes) and the waypoint graph
// the bots navigate on, plus a small geometry merger that keeps the scene's
// draw-call count low.
import * as THREE from 'three';
import { Rng } from './rng.js';
import { PAL } from './palette.js';

export const YARD = { x: 20, z: 14 };

// Merge several transformed geometries into one, keeping a material index
// per part (groups). All parts must carry position/normal/uv.
export function mergeParts(parts) {
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  const groups = [];
  let vBase = 0;
  for (const part of parts) {
    const g = part.geo.clone();
    if (part.matrix) g.applyMatrix4(part.matrix);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    const index = g.index;
    const start = idx.length;
    if (index) {
      for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + vBase);
    } else {
      for (let i = 0; i < p.count; i++) idx.push(vBase + i);
    }
    groups.push({ start, count: idx.length - start, mat: part.mat || 0 });
    vBase += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  for (const grp of groups) out.addGroup(grp.start, grp.count, grp.mat);
  return out;
}

function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

// Merge parts into one mesh with a baked vertex colour per part, so a whole
// multi-coloured assembly renders in a single draw call with a vertex-colour
// material. Parts: {geo, matrix?, color}.
export function mergeColored(parts) {
  const pos = [];
  const norm = [];
  const uv = [];
  const col = [];
  const idx = [];
  let vBase = 0;
  for (const part of parts) {
    const g = part.geo.clone();
    if (part.matrix) g.applyMatrix4(part.matrix);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    const c = new THREE.Color(part.color);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
      col.push(c.r, c.g, c.b);
    }
    const index = g.index;
    if (index) {
      for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + vBase);
    } else {
      for (let i = 0; i < p.count; i++) idx.push(vBase + i);
    }
    vBase += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

// 3D slab test: does the segment p0->p1 hit the box (x0..x1, 0..h, z0..z1)?
function segmentHitsBox(p0, p1, b) {
  let tmin = 0;
  let tmax = 1;
  const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
  const o = [p0.x, p0.y, p0.z];
  const lo = [b.x0, 0, b.z0];
  const hi = [b.x1, b.h, b.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return false;
    } else {
      let t1 = (lo[i] - o[i]) / d[i];
      let t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}
// 2D slab test for a path segment at ground level, box inflated by r.
function segmentHitsBox2D(ax, az, bx, bz, b, r) {
  let tmin = 0;
  let tmax = 1;
  const d = [bx - ax, bz - az];
  const o = [ax, az];
  const lo = [b.x0 - r, b.z0 - r];
  const hi = [b.x1 + r, b.z1 + r];
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return false;
    } else {
      let t1 = (lo[i] - o[i]) / d[i];
      let t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function buildWorld(textures) {
  const group = new THREE.Group();
  const colliders = [];
  const addCollider = (cx, cz, w, d, h) => {
    colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h });
  };

  // --- Ground: stained concrete slab.
  const groundMat = new THREE.MeshStandardMaterial({ map: textures.concrete, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 28), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // --- Sky dome: gradient dusk sky, unlit.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(140, 24, 12),
    new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // --- City skyline silhouette with lit windows, ringing the yard.
  {
    const rng = new Rng(41);
    const parts = [];
    const winMat = new THREE.MeshBasicMaterial({ map: textures.windows, fog: false });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const r = rng.range(52, 78);
      const w = rng.range(6, 14);
      const h = rng.range(8, 30);
      const d = rng.range(6, 10);
      parts.push({ geo: box(w, h, d), matrix: mat4(Math.sin(a) * r, h / 2 - 1, Math.cos(a) * r, rng.range(0, Math.PI)) });
    }
    const skyline = new THREE.Mesh(mergeParts(parts), winMat);
    group.add(skyline);
  }

  // --- Drifting clouds: soft translucent slabs high above.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xc98a9a, transparent: true, opacity: 0.32, fog: false, depthWrite: false });
  const cloudParts = [];
  {
    const rng = new Rng(99);
    for (let i = 0; i < 7; i++) {
      cloudParts.push({
        geo: box(rng.range(10, 22), 0.4, rng.range(4, 8)),
        matrix: mat4(rng.range(-55, 55), rng.range(26, 38), rng.range(-55, 55), rng.range(0, Math.PI)),
      });
    }
  }
  const clouds = new THREE.Mesh(mergeParts(cloudParts), cloudMat);
  group.add(clouds);

  // --- Shipping containers. Long axis along x or z; two stacked doubles.
  const containerDefs = [
    { x: -12, z: -6, w: 6, d: 2.4, tex: textures.containerRed, stack: true },
    { x: 12, z: -6, w: 6, d: 2.4, tex: textures.containerOlive, stack: false },
    { x: -12, z: 6, w: 6, d: 2.4, tex: textures.containerBlue, stack: false },
    { x: 12, z: 6, w: 6, d: 2.4, tex: textures.containerTeal, stack: true },
    { x: 0, z: -10.5, w: 6, d: 2.4, tex: textures.containerTeal, stack: false },
    { x: -6, z: 1, w: 2.4, d: 6, tex: textures.containerRed, stack: false },
    { x: 6, z: -1, w: 2.4, d: 6, tex: textures.containerOlive, stack: false },
  ];
  for (const c of containerDefs) {
    const m = new THREE.MeshStandardMaterial({ map: c.tex, roughness: 0.75, metalness: 0.25 });
    const mesh = new THREE.Mesh(box(c.w, 2.6, c.d), m);
    mesh.position.set(c.x, 1.3, c.z);
    group.add(mesh);
    addCollider(c.x, c.z, c.w, c.d, 2.6);
    if (c.stack) {
      const top = new THREE.Mesh(box(c.w, 2.6, c.d), m);
      top.position.set(c.x, 3.9, c.z);
      group.add(top);
    }
  }

  // --- Wooden crates (merged into one mesh).
  {
    const rng = new Rng(7);
    const crateSpots = [
      [3, 8], [-3, 8], [8, 10], [-8, -3], [9, -9], [-9, 9], [14, 0], [-14, -3], [2, -4], [-2, 4],
      [15.5, 3], [-15.5, 3.5], [4, -7.5], [-4, -7.5],
    ];
    const parts = [];
    for (const [cx, cz] of crateSpots) {
      const s = rng.chance(0.3) ? 1.4 : 1.0;
      parts.push({ geo: box(s, s, s), matrix: mat4(cx, s / 2, cz, rng.range(0, Math.PI / 2)) });
      addCollider(cx, cz, s, s, s);
    }
    const mesh = new THREE.Mesh(
      mergeParts(parts),
      new THREE.MeshStandardMaterial({ map: textures.crate, roughness: 0.9, metalness: 0 }),
    );
    group.add(mesh);
  }

  // --- Labelled barrels (merged, two materials by group).
  {
    const barrelSpots = [
      [16, 10, 0], [16.9, 10.4, 1], [16.2, 11.2, 1],
      [-16, 10, 1], [-16.8, 10.5, 0],
      [16, -11, 1], [-16, -11, 0], [-15.2, -11.3, 1],
      [18, 0, 0], [-18, -6, 1],
    ];
    const parts = [];
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12);
    for (const [cx, cz, matIdx] of barrelSpots) {
      parts.push({ geo, matrix: mat4(cx, 0.45, cz), mat: matIdx });
      addCollider(cx, cz, 0.64, 0.64, 0.9);
    }
    const mesh = new THREE.Mesh(mergeParts(parts), [
      new THREE.MeshStandardMaterial({ map: textures.barrelYellow, roughness: 0.6, metalness: 0.35 }),
      new THREE.MeshStandardMaterial({ map: textures.barrelGrey, roughness: 0.6, metalness: 0.35 }),
    ]);
    group.add(mesh);
  }

  // --- Sandbag lines guarding both sites (merged).
  {
    const bagSpots = [];
    for (const sx of [-14, 14]) {
      for (let i = -2; i <= 2; i++) bagSpots.push([sx + i * 0.9, -6.6, 0]);
      for (let i = -1; i <= 1; i++) bagSpots.push([sx - 3.4, -9 + i * 0.9, 1]);
      for (let i = -1; i <= 1; i++) bagSpots.push([sx + 3.4, -9 + i * 0.9, 1]);
    }
    const parts = bagSpots.map(([x, z, ry]) => ({
      geo: box(0.85, 0.45, 0.5), matrix: mat4(x, 0.22, z, ry * Math.PI / 2),
    }));
    const mesh = new THREE.Mesh(
      mergeParts(parts),
      new THREE.MeshStandardMaterial({ color: PAL.sandbag, roughness: 1, metalness: 0 }),
    );
    group.add(mesh);
    for (const sx of [-14, 14]) {
      addCollider(sx, -6.6, 4.4, 0.6, 0.5);
      addCollider(sx - 3.4, -9, 0.6, 2.6, 0.5);
      addCollider(sx + 3.4, -9, 0.6, 2.6, 0.5);
    }
  }

  // --- Bomb sites: painted letters + hazard striping on the ground.
  const sites = {
    A: { x: -14, z: -9, letter: 'A' },
    B: { x: 14, z: -9, letter: 'B' },
  };
  for (const key of ['A', 'B']) {
    const s = sites[key];
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: key === 'A' ? textures.siteA : textures.siteB, transparent: true, opacity: 0.92, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = 0;
    decal.position.set(s.x, 0.02, s.z);
    group.add(decal);
  }

  // --- Chain-link fences along the west and east edges (merged, see-through).
  {
    const fenceMat = new THREE.MeshBasicMaterial({ map: textures.fence, transparent: true, side: THREE.DoubleSide, opacity: 0.75, depthWrite: false });
    const parts = [];
    for (const fx of [-19.4, 19.4]) {
      parts.push({ geo: new THREE.PlaneGeometry(12, 2.4), matrix: mat4(fx, 1.2, 0, Math.PI / 2) });
    }
    const mesh = new THREE.Mesh(mergeParts(parts), fenceMat);
    group.add(mesh);
  }

  // --- Lamp posts: warm pools of light.
  const lampPositions = [[-8, -5], [8, -5], [-8, 5], [8, 5]];
  {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
    const poleParts = [];
    const headParts = [];
    const poolParts = [];
    for (const [lx, lz] of lampPositions) {
      poleParts.push({ geo: new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8), matrix: mat4(lx, 2.3, lz) });
      poleParts.push({ geo: box(0.7, 0.08, 0.08), matrix: mat4(lx, 4.55, lz) });
      headParts.push({ geo: new THREE.SphereGeometry(0.22, 10, 8), matrix: mat4(lx, 4.5, lz) });
      poolParts.push({ geo: new THREE.CircleGeometry(2.6, 20), matrix: new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(lx, 0.015, lz) });
      addCollider(lx, lz, 0.3, 0.3, 4.6);
    }
    group.add(new THREE.Mesh(mergeParts(poleParts), poleMat));
    group.add(new THREE.Mesh(
      mergeParts(headParts),
      new THREE.MeshBasicMaterial({ color: PAL.lamp, fog: false }),
    ));
    group.add(new THREE.Mesh(
      mergeParts(poolParts),
      new THREE.MeshBasicMaterial({ color: PAL.lamp, transparent: true, opacity: 0.14, depthWrite: false }),
    ));
  }

  // --- Tower cranes against the dusk sky (north edge).
  for (const [cx, cz, ry] of [[-18, -12.5, 0.4], [16, -13, -0.5]]) {
    const craneMat = new THREE.MeshStandardMaterial({ color: PAL.crane, roughness: 0.6, metalness: 0.4 });
    const parts = [
      { geo: box(1.2, 16, 1.2), matrix: mat4(cx, 8, cz) },
      { geo: box(11, 0.8, 0.8), matrix: mat4(cx + Math.cos(ry) * 3, 15.6, cz - Math.sin(ry) * 3, ry) },
      { geo: box(3.5, 0.8, 0.8), matrix: mat4(cx - Math.cos(ry) * 2.4, 15.6, cz + Math.sin(ry) * 2.4, ry) },
      { geo: box(1.6, 1.4, 1.4), matrix: mat4(cx, 14.6, cz) },
    ];
    group.add(new THREE.Mesh(mergeParts(parts), craneMat));
    addCollider(cx, cz, 1.4, 1.4, 16);
  }

  // --- Silo and pipes in the south-east corner.
  {
    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 7, 16),
      new THREE.MeshStandardMaterial({ color: PAL.silo, roughness: 0.55, metalness: 0.5 }),
    );
    silo.position.set(18.2, 3.5, 12);
    group.add(silo);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x5a5f68, roughness: 0.55, metalness: 0.5 }),
    );
    cap.position.set(18.2, 7, 12);
    group.add(cap);
    addCollider(18.2, 12, 3, 3, 7);
    const pipes = new THREE.Mesh(
      mergeParts([
        { geo: box(0.56, 0.56, 12), matrix: mat4(19.2, 0.55, 0) },
        { geo: box(0.4, 0.4, 12), matrix: mat4(18.6, 0.35, -2) },
      ]),
      new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.7, metalness: 0.4 }),
    );
    group.add(pipes);
    addCollider(19.2, 0, 0.7, 12, 1);
  }

  // --- Low concrete barriers around the yard edge.
  {
    const barMat = new THREE.MeshStandardMaterial({ color: PAL.concreteDark, roughness: 0.95 });
    const parts = [
      { geo: box(40, 0.9, 0.5), matrix: mat4(0, 0.45, -13.8) },
      { geo: box(40, 0.9, 0.5), matrix: mat4(0, 0.45, 13.8) },
      { geo: box(0.5, 0.9, 28), matrix: mat4(-19.8, 0.45, 0) },
      { geo: box(0.5, 0.9, 28), matrix: mat4(19.8, 0.45, 0) },
    ];
    group.add(new THREE.Mesh(mergeParts(parts), barMat));
  }

  // --- Lighting: warm low sun, hemisphere, cool rim from the north.
  const sun = new THREE.DirectionalLight(PAL.sun, PAL.sunIntensity);
  sun.position.set(-14, 10, 18);
  group.add(sun);
  group.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 0.85));
  const rim = new THREE.DirectionalLight(PAL.rim, 0.5);
  rim.position.set(0, 8, -20);
  group.add(rim);
  for (const [lx, lz] of lampPositions) {
    const p = new THREE.PointLight(PAL.lamp, 14, 11, 1.8);
    p.position.set(lx, 4.3, lz);
    group.add(p);
  }

  // --- Collision queries.
  function blocked(x, z, r) {
    if (x < -YARD.x + 0.6 + r || x > YARD.x - 0.6 - r) return true;
    if (z < -YARD.z + 0.6 + r || z > YARD.z - 0.6 - r) return true;
    for (const b of colliders) {
      if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
    }
    return false;
  }
  // Slide a circle out of every box it overlaps; returns the corrected pos.
  function resolveCircle(pos, r) {
    for (const b of colliders) {
      const nx = Math.max(b.x0, Math.min(pos.x, b.x1));
      const nz = Math.max(b.z0, Math.min(pos.z, b.z1));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-8) {
          // Centre inside the box: push out along the smallest penetration.
          const pl = Math.min(pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z);
          if (pl === pos.x - b.x0) pos.x = b.x0 - r;
          else if (pl === b.x1 - pos.x) pos.x = b.x1 + r;
          else if (pl === pos.z - b.z0) pos.z = b.z0 - r;
          else pos.z = b.z1 + r;
        } else {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        }
      }
    }
    pos.x = Math.max(-YARD.x + 0.6 + r, Math.min(YARD.x - 0.6 - r, pos.x));
    pos.z = Math.max(-YARD.z + 0.6 + r, Math.min(YARD.z - 0.6 - r, pos.z));
    return pos;
  }
  function losClear(ax, ay, az, bx, by, bz) {
    const p0 = { x: ax, y: ay, z: az };
    const p1 = { x: bx, y: by, z: bz };
    for (const b of colliders) {
      if (segmentHitsBox(p0, p1, b)) return false;
    }
    return true;
  }
  function pathClear(ax, az, bx, bz) {
    for (const b of colliders) {
      if (b.h < 0.6) continue; // sandbags and low cover do not block a path
      if (segmentHitsBox2D(ax, az, bx, bz, b, 0.55)) return false;
    }
    return true;
  }

  // --- Waypoint graph: grid nodes kept clear of cover, linked along lanes.
  const waypoints = [];
  for (let gx = -18; gx <= 18; gx += 4) {
    for (let gz = -12; gz <= 12; gz += 4) {
      if (!blocked(gx, gz, 0.7)) waypoints.push({ x: gx, z: gz, links: [] });
    }
  }
  for (let i = 0; i < waypoints.length; i++) {
    for (let j = 0; j < waypoints.length; j++) {
      if (i === j) continue;
      const a = waypoints[i];
      const b = waypoints[j];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > 5.7 || d < 0.1) continue;
      if (pathClear(a.x, a.z, b.x, b.z)) a.links.push(j);
    }
  }
  function nearestNode(x, z) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < waypoints.length; i++) {
      const d = (waypoints[i].x - x) ** 2 + (waypoints[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // Breadth-first path over the graph; returns world points, start excluded.
  function findPath(fx, fz, tx, tz) {
    const start = nearestNode(fx, fz);
    const goal = nearestNode(tx, tz);
    if (start === goal) return [{ x: tx, z: tz }];
    const prev = new Array(waypoints.length).fill(-1);
    const queue = [start];
    prev[start] = start;
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      for (const n of waypoints[cur].links) {
        if (prev[n] === -1) { prev[n] = cur; queue.push(n); }
      }
    }
    if (prev[goal] === -1) return [{ x: tx, z: tz }];
    const nodes = [];
    let cur = goal;
    while (cur !== start) { nodes.unshift(waypoints[cur]); cur = prev[cur]; }
    nodes.push({ x: tx, z: tz });
    return nodes;
  }

  return {
    group, colliders, waypoints, sites,
    spawnVanguard: { x: 0, z: 11.5 },
    spawnWarden: { x: 0, z: -12.5 },
    blocked, resolveCircle, losClear, pathClear, nearestNode, findPath,
    update(dt) {
      clouds.rotation.y += dt * 0.004;
    },
  };
}
