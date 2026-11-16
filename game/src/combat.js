// SABLE YARD — combat: hitscan shooting, tracers, impact sparks, scorch
// decals, thrown grenades and damage. Hitboxes are simple boxes: a torso
// 0.56 x 0.72 x 0.34 centred at 1.0 m and a 0.3 m head cube at 1.56 m.
import * as THREE from 'three';
import { PAL } from './palette.js';

export const TORSO = { w: 0.56, h: 0.72, d: 0.34, y: 1.0 };
export const HEAD = { w: 0.3, h: 0.3, d: 0.3, y: 1.56 };

// Ray vs an axis-aligned box centred on (cx, cy, cz). Returns distance or -1.
export function rayBox(origin, dir, cx, cy, cz, w, h, d) {
  let tmin = 0;
  let tmax = Infinity;
  const o = [origin.x, origin.y, origin.z];
  const dd = [dir.x, dir.y, dir.z];
  const lo = [cx - w / 2, cy - h / 2, cz - d / 2];
  const hi = [cx + w / 2, cy + h / 2, cz + d / 2];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return -1;
    } else {
      let t1 = (lo[i] - o[i]) / dd[i];
      let t2 = (hi[i] - o[i]) / dd[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// Ray vs the world's solid boxes. Returns distance or -1.
export function rayWorld(world, origin, dir, maxDist) {
  let best = -1;
  for (const b of world.colliders) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const t = rayBox(origin, dir, cx, b.h / 2, cz, b.x1 - b.x0, b.h, b.z1 - b.z0);
    if (t >= 0 && t <= maxDist && (best < 0 || t < best)) best = t;
  }
  // The ground plane.
  if (dir.y < -1e-6) {
    const t = -origin.y / dir.y;
    if (t >= 0 && t <= maxDist && (best < 0 || t < best)) best = t;
  }
  return best;
}

// Ray vs one soldier's hitboxes. Returns {part, dist} or null.
export function rayActor(origin, dir, actor, maxDist) {
  const p = actor.state.position;
  const th = rayBox(origin, dir, p.x, TORSO.y, p.z, TORSO.w, TORSO.h, TORSO.d);
  const hh = rayBox(origin, dir, p.x, HEAD.y, p.z, HEAD.w, HEAD.h, HEAD.d);
  let best = null;
  if (th >= 0 && th <= maxDist) best = { part: 'torso', dist: th };
  if (hh >= 0 && hh <= maxDist && (!best || hh < best.dist)) best = { part: 'head', dist: hh };
  return best;
}

// One hitscan shot. Checks actors first, then the world, so a body always
// shields what stands behind it. Returns a hit record.
export function shootHitscan(world, origin, dir, maxDist, actors, exclude) {
  let bestActor = null;
  let bestHit = null;
  for (const a of actors) {
    if (a === exclude || !a.alive) continue;
    const hit = rayActor(origin, dir, a, maxDist);
    if (hit && (!bestHit || hit.dist < bestHit.dist)) {
      bestHit = hit;
      bestActor = a;
    }
  }
  const wallDist = rayWorld(world, origin, dir, maxDist);
  if (bestHit && (wallDist < 0 || bestHit.dist < wallDist)) {
    return { target: bestActor, part: bestHit.part, dist: bestHit.dist, point: pointAt(origin, dir, bestHit.dist) };
  }
  if (wallDist >= 0) {
    return { target: null, part: 'world', dist: wallDist, point: pointAt(origin, dir, wallDist) };
  }
  return { target: null, part: null, dist: maxDist, point: pointAt(origin, dir, maxDist) };
}
function pointAt(origin, dir, dist) {
  return new THREE.Vector3(origin.x + dir.x * dist, origin.y + dir.y * dist, origin.z + dir.z * dist);
}

// Damage with distance falloff: factor 1 + distance / 28.
export function falloffDamage(base, dist) {
  return base / (1 + dist / 28);
}

// --- Visual feedback: pooled tracers, sparks, scorch decals, muzzle flash.
export class Effects {
  constructor(scene, textures) {
    this.scene = scene;
    this.tracers = [];
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: PAL.tracer, transparent: true, opacity: 0 }));
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.sparks = [];
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12 * 3), 3));
    this.sparkMat = new THREE.PointsMaterial({ color: PAL.spark, size: 0.09, transparent: true, opacity: 0 });
    for (let i = 0; i < 6; i++) {
      const pts = new THREE.Points(sparkGeo.clone(), this.sparkMat.clone());
      pts.visible = false;
      pts.frustumCulled = false;
      scene.add(pts);
      this.sparks.push({ pts, life: 0, vel: [] });
    }
    this.scorchMat = new THREE.MeshBasicMaterial({ map: textures.scorch, transparent: true, opacity: 0.9, depthWrite: false });
    this.scorches = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), this.scorchMat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.scorches.push(m);
    }
    this.scorchIdx = 0;
    // Muzzle flash: a small glowing quad that lives on the gun for a blink.
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: PAL.muzzle, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashLife = 0;
  }
  tracer(from, to) {
    const slot = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const pos = slot.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    slot.line.visible = true;
    slot.line.material.opacity = 0.9;
    slot.life = 0.07;
  }
  sparksAt(point, normalY = 1) {
    const slot = this.sparks.find((s) => s.life <= 0) || this.sparks[0];
    const pos = slot.pts.geometry.attributes.position;
    slot.vel = [];
    for (let i = 0; i < 12; i++) {
      pos.setXYZ(i, point.x, point.y, point.z);
      slot.vel.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5 + 0.5, (Math.random() - 0.5) * 3));
    }
    pos.needsUpdate = true;
    slot.pts.visible = true;
    slot.pts.material.opacity = 1;
    slot.life = 0.35;
    void normalY;
  }
  scorchAt(point) {
    const m = this.scorches[this.scorchIdx];
    this.scorchIdx = (this.scorchIdx + 1) % this.scorches.length;
    m.position.set(point.x, Math.max(0.02, point.y + 0.01), point.z);
    m.rotation.z = Math.random() * Math.PI;
    m.visible = true;
  }
  muzzleAt(point, camera) {
    this.flash.position.copy(point);
    this.flash.lookAt(camera.position);
    this.flash.visible = true;
    this.flash.material.opacity = 0.95;
    this.flashLife = 0.05;
  }
  step(dt) {
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    }
    for (const s of this.sparks) {
      if (s.life > 0) {
        s.life -= dt;
        const pos = s.pts.geometry.attributes.position;
        for (let i = 0; i < 12; i++) {
          const v = s.vel[i];
          v.y -= 9 * dt;
          pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt);
        }
        pos.needsUpdate = true;
        s.pts.material.opacity = Math.max(0, s.life / 0.35);
        if (s.life <= 0) s.pts.visible = false;
      }
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.material.opacity = Math.max(0, this.flashLife / 0.05) * 0.95;
      if (this.flashLife <= 0) this.flash.visible = false;
    }
  }
}

// --- Grenades: arc under gravity, fuse, then area damage.
export class Grenade {
  constructor(scene, pos, vel) {
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.fuse = 2.2;
    this.alive = true;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.5, metalness: 0.5, emissive: 0x442200, emissiveIntensity: 0.6 }),
    );
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.scene = scene;
  }
  step(dt, world, actors, onExplode) {
    if (!this.alive) return;
    this.vel.y -= 9.8 * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < 0.09) {
      this.pos.y = 0.09;
      this.vel.y = Math.abs(this.vel.y) * 0.35;
      this.vel.x *= 0.7;
      this.vel.z *= 0.7;
    }
    // Bounce off cover.
    if (world.blocked(this.pos.x, this.pos.z, 0.1)) {
      this.vel.x *= -0.4;
      this.vel.z *= -0.4;
      this.pos.x -= this.vel.x * dt * 2;
      this.pos.z -= this.vel.z * dt * 2;
    }
    this.mesh.position.copy(this.pos);
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.alive = false;
      this.scene.remove(this.mesh);
      onExplode(this.pos, actors);
    }
  }
}
