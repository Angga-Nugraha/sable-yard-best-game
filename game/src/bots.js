// SABLE YARD — the nine AI soldiers. Each is a humanoid built from simple
// shapes (about 1.8 m, head-to-body 1 to 7.5): helmet dome and brim, goggle
// band, face mask, tapered torso with belt, plate carrier and team stripe,
// pouch, shoulder pads, backpack, two-segment arms and legs with pivots,
// boots, and a gun. A walk cycle swings the limbs and bobs the body.
// Skill tiers (veteran / regular / rookie) set aim error, reaction time and
// burst pauses. Bots navigate the waypoint graph, acquire targets after a
// reaction delay, fire in bursts, take cover when hurt, and play the
// objective: Vanguard pushes the sites, Wardens hold them, and when the
// beacon is planted Wardens converge to defuse while Vanguard defends.
import * as THREE from 'three';
import { mergeColored } from './world.js';
import { PAL, teamDarkHex, teamStripeHex } from './palette.js';
import { shootHitscan, falloffDamage, TORSO, HEAD } from './combat.js';

export const TIERS = {
  veteran: { aimError: 0.016, reaction: 0.3, pauseMin: 0.8, pauseMax: 1.3, speed: 4.2 },
  regular: { aimError: 0.028, reaction: 0.5, pauseMin: 1.1, pauseMax: 1.8, speed: 3.8 },
  rookie: { aimError: 0.05, reaction: 0.75, pauseMin: 1.5, pauseMax: 2.4, speed: 3.4 },
};
const BOT_DAMAGE = 16;
const BURST = 3;

const matCache = new Map();
function matsFor(team) {
  if (!matCache.has(team)) {
    matCache.set(team, {
      cloth: new THREE.MeshStandardMaterial({ color: teamDarkHex(team), roughness: 0.9, metalness: 0 }),
      // One vertex-colour material per finish, shared by every soldier.
      vcSoft: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }),
      vcMetal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55 }),
    });
  }
  return matCache.get(team);
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
function m4(x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  return m;
}

// Build one soldier. Front faces -z (face, vest stripe), backpack on +z.
function buildSoldier(team) {
  const M = matsFor(team);
  const group = new THREE.Group();

  // Head: rounded skin sphere, helmet dome + brim, goggle band, mask band.
  // One vertex-coloured mesh: a single draw call.
  const headParts = [
    { geo: new THREE.SphereGeometry(0.13, 12, 10), matrix: m4(0, 1.56, 0), color: PAL.skin },
    { geo: new THREE.SphereGeometry(0.148, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), matrix: m4(0, 1.58, 0), color: PAL.helmet },
    { geo: new THREE.CylinderGeometry(0.175, 0.175, 0.025, 14), matrix: m4(0, 1.60, 0), color: PAL.helmet },
    { geo: box(0.2, 0.055, 0.06), matrix: m4(0, 1.58, -0.11), color: PAL.goggles },
    { geo: box(0.17, 0.1, 0.05), matrix: m4(0, 1.47, -0.115), color: PAL.mask },
  ];
  const head = new THREE.Mesh(mergeColored(headParts), M.vcSoft);
  group.add(head);

  // Torso: tapered shell, belt, plate carrier + team stripe, pouch, pads, pack.
  const torsoParts = [
    { geo: box(0.42, 0.62, 0.26), matrix: m4(0, 1.09, 0), color: teamDarkHex(team) },
    { geo: box(0.44, 0.09, 0.28), matrix: m4(0, 0.82, 0), color: PAL.vest },
    { geo: box(0.36, 0.42, 0.07), matrix: m4(0, 1.12, -0.15), color: PAL.vest },
    { geo: box(0.36, 0.07, 0.02), matrix: m4(0, 1.29, -0.19), color: teamStripeHex(team) },
    { geo: box(0.12, 0.16, 0.08), matrix: m4(0.19, 0.95, -0.15), color: PAL.vest },
    { geo: box(0.14, 0.06, 0.28), matrix: m4(-0.26, 1.39, 0), color: PAL.vest },
    { geo: box(0.14, 0.06, 0.28), matrix: m4(0.26, 1.39, 0), color: PAL.vest },
    { geo: box(0.34, 0.44, 0.14), matrix: m4(0, 1.12, 0.19), color: PAL.vest },
  ];
  const torso = new THREE.Mesh(mergeColored(torsoParts), M.vcSoft);
  group.add(torso);

  // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand
  // (forearm and hand merged into one vertex-coloured mesh).
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.27 * side, 1.37, 0);
    const upper = new THREE.Mesh(box(0.1, 0.34, 0.1), M.cloth);
    upper.position.set(0, -0.15, 0);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.32, 0);
    const fore = new THREE.Mesh(mergeColored([
      { geo: box(0.09, 0.3, 0.09), matrix: m4(0, -0.13, 0), color: teamDarkHex(team) },
      { geo: box(0.08, 0.09, 0.1), matrix: m4(0, -0.3, 0), color: PAL.skin },
    ]), M.vcSoft);
    elbow.add(fore);
    shoulder.add(elbow);
    group.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Legs: hip pivot -> thigh -> knee pivot -> shin + boot.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, 0.8, 0);
    const thigh = new THREE.Mesh(box(0.13, 0.4, 0.13), M.cloth);
    thigh.position.set(0, -0.18, 0);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    const shin = new THREE.Mesh(mergeColored([
      { geo: box(0.11, 0.36, 0.11), matrix: m4(0, -0.16, 0), color: teamDarkHex(team) },
      { geo: box(0.13, 0.09, 0.27), matrix: m4(0, -0.36, -0.045), color: PAL.boots },
    ]), M.vcSoft);
    knee.add(shin);
    hip.add(knee);
    group.add(hip);
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Gun: barrel, muzzle, handguard, stock, magazine, sights — merged into
  // one vertex-coloured mesh.
  const gunParts = [
    { geo: box(0.055, 0.075, 0.34), matrix: m4(0, 0, -0.08), color: PAL.gunMetal },
    { geo: box(0.03, 0.03, 0.22), matrix: m4(0, 0.008, -0.34), color: PAL.gunMetal },
    { geo: box(0.04, 0.04, 0.06), matrix: m4(0, 0.008, -0.46), color: PAL.gunMetal },
    { geo: box(0.05, 0.07, 0.12), matrix: m4(0, -0.01, -0.2), color: PAL.gunGrip },
    { geo: box(0.045, 0.11, 0.05), matrix: m4(0, -0.09, -0.06), color: PAL.gunGrip },
    { geo: box(0.05, 0.08, 0.13), matrix: m4(0, -0.01, 0.14), color: PAL.gunGrip },
    { geo: box(0.018, 0.03, 0.018), matrix: m4(0, 0.05, -0.26), color: PAL.gunMetal },
  ];
  const gun = new THREE.Mesh(mergeColored(gunParts), M.vcMetal);
  const gunMount = new THREE.Group();
  gunMount.position.set(0.1, 1.32, -0.2);
  gunMount.add(gun);
  group.add(gunMount);

  return { group, head, torso, armL, armR, legL, legR, gunMount };
}

export class Bot {
  constructor(team, tierName, index, scene, world, rng) {
    this.team = team;
    this.tierName = tierName;
    this.tier = TIERS[tierName];
    this.index = index;
    this.world = world;
    this.rng = rng;
    this.model = buildSoldier(team);
    this.group = this.model.group;
    scene.add(this.group);
    this.state = { position: new THREE.Vector3(0, 0, 0), yaw: 0 };
    this.mover = this; // clip/test hook: mover.teleport / mover.state.position
    this.hp = 100;
    this.alive = true;
    this.walkPhase = rng.range(0, Math.PI * 2);
    this.moveSpeed = 0;
    this.target = null;
    this.acquireAt = 0;
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.nextBurstAt = 0;
    this.scanTimer = rng.range(0, 0.15);
    this.repathTimer = 0;
    this.path = [];
    this.pathIdx = 0;
    this.objective = null;
    this.objectiveKey = '';
    this.defuseProgress = 0;
    this.site = index % 2 === 0 ? 'A' : 'B';
    this.fallback = false;
    this.deathT = 0;
  }
  teleport(x, z, yaw = 0) {
    this.state.position.set(x, 0, z);
    this.state.yaw = yaw;
    this.group.position.copy(this.state.position);
    this.group.rotation.set(0, yaw, 0);
    this.path = [];
    this.pathIdx = 0;
  }
  respawn(x, z, yaw) {
    this.hp = 100;
    this.alive = true;
    this.target = null;
    this.burstLeft = 0;
    this.defuseProgress = 0;
    this.fallback = false;
    this.deathT = 0;
    this.group.rotation.set(0, yaw, 0);
    this.group.position.y = 0;
    this.teleport(x, z, yaw);
    this._poseIdle();
  }
  forward() {
    return new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
  }
  eyePos() {
    const p = this.state.position;
    return new THREE.Vector3(p.x, p.y + 1.5, p.z);
  }
  muzzlePos() {
    const f = this.forward();
    const p = this.state.position;
    return new THREE.Vector3(p.x + f.x * 0.45, p.y + 1.35, p.z + f.z * 0.45);
  }
  _poseIdle() {
    const m = this.model;
    m.armL.shoulder.rotation.x = 0;
    m.armR.shoulder.rotation.x = 0;
    m.armL.elbow.rotation.x = -0.25;
    m.armR.elbow.rotation.x = -0.25;
    m.legL.hip.rotation.x = 0;
    m.legR.hip.rotation.x = 0;
    m.legL.knee.rotation.x = 0;
    m.legR.knee.rotation.x = 0;
    m.torso.rotation.x = 0;
    m.head.rotation.x = 0;
  }
  _poseAim(pitch) {
    const m = this.model;
    m.armL.shoulder.rotation.x = -1.15;
    m.armR.shoulder.rotation.x = -1.15;
    m.armL.elbow.rotation.x = -0.35;
    m.armR.elbow.rotation.x = -0.35;
    m.gunMount.rotation.x = pitch;
    m.torso.rotation.x = 0.08;
  }
  _poseWalk(dt) {
    const m = this.model;
    const s = this.moveSpeed / 4;
    this.walkPhase += dt * (4 + this.moveSpeed * 1.6);
    const ph = this.walkPhase;
    const swing = 0.55 * Math.min(1, s + 0.25);
    m.legL.hip.rotation.x = Math.sin(ph) * swing;
    m.legR.hip.rotation.x = -Math.sin(ph) * swing;
    m.legL.knee.rotation.x = Math.max(0, -Math.sin(ph + 0.7)) * 0.85;
    m.legR.knee.rotation.x = Math.max(0, Math.sin(ph + 0.7)) * 0.85;
    m.armL.shoulder.rotation.x = -Math.sin(ph) * swing * 0.7;
    m.armR.shoulder.rotation.x = Math.sin(ph) * swing * 0.7;
    m.armL.elbow.rotation.x = -0.3 - Math.max(0, Math.sin(ph)) * 0.3;
    m.armR.elbow.rotation.x = -0.3 - Math.max(0, -Math.sin(ph)) * 0.3;
    m.torso.rotation.x = 0.07;
    m.head.rotation.x = -0.04;
    this.group.position.y = Math.abs(Math.sin(ph)) * 0.035;
  }
  // Choose where this bot wants to be right now.
  _objectiveFor(match) {
    const beacon = match.state.beacon;
    if (beacon.state === 'planted') {
      const site = this.world.sites[beacon.site];
      if (this.team === 'warden') return { kind: 'defuse', x: site.x, z: site.z, key: `defuse-${beacon.site}` };
      return { kind: 'defend', x: site.x + (this.index % 2 === 0 ? -3.5 : 3.5), z: site.z + 3.5, key: `defend-${beacon.site}` };
    }
    if (this.team === 'vanguard') {
      const site = this.world.sites[this.site];
      return { kind: 'attack', x: site.x, z: site.z, key: `attack-${this.site}` };
    }
    // Wardens hold near their site, drifting between guard posts.
    const site = this.world.sites[this.site];
    const gx = site.x + (this.index % 3 - 1) * 3;
    const gz = site.z + 4 + (this.index % 2) * 2;
    return { kind: 'guard', x: gx, z: gz, key: `guard-${this.site}-${this.index}` };
  }
  _repathIfNeeded(match) {
    const obj = this._objectiveFor(match);
    if (!this.objective || this.objective.key !== obj.key || this.repathTimer <= 0) {
      this.objective = obj;
      this.objectiveKey = obj.key;
      const p = this.state.position;
      this.path = this.world.findPath(p.x, p.z, obj.x, obj.z);
      this.pathIdx = 0;
      this.repathTimer = 2.5;
    }
  }
  _turnToward(targetYaw, dt, rate = 6) {
    let d = targetYaw - this.state.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = Math.max(-rate * dt, Math.min(rate * dt, d));
    this.state.yaw += step;
  }
  _canSee(actor, ctx) {
    const p = this.state.position;
    const q = actor.state.position;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 40) return null;
    // Field of view: 115 degrees, or point-blank.
    if (dist > 6) {
      const f = this.forward();
      const dot = (f.x * dx + f.z * dz) / dist;
      if (dot < 0.35) return null;
    }
    const eye = this.eyePos();
    if (!this.world.losClear(eye.x, eye.y, eye.z, q.x, q.y + 1.0, q.z)) return null;
    return dist;
  }
  // Fire one burst shot at the current target.
  _fireAtTarget(ctx) {
    const t = this.target;
    if (!t || !t.alive) return;
    const tp = t.state.position;
    const headshot = this.rng.chance(0.12);
    const aimY = tp.y + (headshot ? HEAD.y : TORSO.y);
    const muzzle = this.muzzlePos();
    const dx = tp.x - muzzle.x;
    const dy = aimY - muzzle.y;
    const dz = tp.z - muzzle.z;
    const dist = Math.hypot(dx, dy, dz);
    const dir = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
    // Aim error: an angular error, so the lateral offset grows with range.
    const err = this.tier.aimError * this.rng.gauss() * dist;
    const err2 = this.tier.aimError * this.rng.gauss() * dist;
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, err);
    dir.addScaledVector(up, err2);
    dir.normalize();
    const actors = [ctx.player, ...ctx.bots.list];
    const hit = shootHitscan(this.world, muzzle, dir, 60, actors, this);
    ctx.effects.tracer(muzzle, hit.point);
    ctx.effects.muzzleAt(muzzle, ctx.camera);
    const toPlayer = ctx.player.state.position;
    if (Math.hypot(toPlayer.x - muzzle.x, toPlayer.z - muzzle.z) < 28) ctx.audio.shot('rifle');
    if (hit.target) {
      const base = falloffDamage(BOT_DAMAGE, hit.dist);
      const scaled = hit.target === ctx.player ? base : base * 0.7;
      const dmg = hit.part === 'head' ? scaled * 2.5 : scaled;
      ctx.damageActor(hit.target, dmg, this, hit.part === 'head');
    } else if (hit.part === 'world') {
      ctx.effects.sparksAt(hit.point);
      if (hit.point.y < 0.1) ctx.effects.scorchAt(hit.point);
    }
  }
  update(dt, ctx) {
    if (!this.alive) {
      // Fallen soldiers stay down.
      if (this.deathT < 1) {
        this.deathT += dt;
        this.group.rotation.x = -Math.min(1, this.deathT * 2.2) * Math.PI * 0.5;
      }
      return;
    }
    const match = ctx.match;
    const time = ctx.time;
    // Low health: fall back toward the home side instead of pushing.
    if (this.hp < 35 && !this.fallback) {
      this.fallback = true;
      this.objective = null;
    }
    if (this.hp > 60) this.fallback = false;

    // --- Perception, staggered per bot.
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = 0.14;
      const enemies = [];
      if (ctx.player.alive) enemies.push(ctx.player);
      for (const b of ctx.bots.list) if (b.team !== this.team && b.alive) enemies.push(b);
      let best = null;
      let bestDist = Infinity;
      for (const e of enemies) {
        const d = this._canSee(e, ctx);
        if (d !== null && d < bestDist) { bestDist = d; best = e; }
      }
      if (best && best !== this.target) {
        this.target = best;
        this.acquireAt = time + this.tier.reaction + 0.35 + this.rng.next() * 0.3;
        this.burstLeft = 0;
      } else if (!best) {
        this.target = null;
        this.burstLeft = 0;
      }
    }

    const engaging = this.target && this.target.alive;
    let moving = false;

    // --- Defuse: Wardens channel on a planted beacon.
    if (match.state.beacon.state === 'planted' && this.team === 'warden') {
      const site = this.world.sites[match.state.beacon.site];
      const d = Math.hypot(site.x - this.state.position.x, site.z - this.state.position.z);
      if (d < 2.4 && !engaging) {
        this.defuseProgress += dt;
        this.moveSpeed = 0;
        this._poseAim(0);
        if (this.defuseProgress >= 4) {
          this.defuseProgress = 0;
          match.defuseBeacon(this);
        }
        this._syncTransform();
        return;
      }
    }

    if (engaging) {
      const tp = this.target.state.position;
      const dx = tp.x - this.state.position.x;
      const dz = tp.z - this.state.position.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz);
      this._turnToward(wantYaw, dt);
      const pitch = Math.atan2((tp.y + 1.1) - (this.state.position.y + 1.35), dist);
      // Hold ground and shoot when close enough; close in when far.
      if (dist > 26) {
        moving = this._advance(dt, tp.x, tp.z);
      } else {
        this.moveSpeed = 0;
        this._poseAim(-pitch);
      }
      // Fire bursts once the reaction delay has passed.
      if (time >= this.acquireAt) {
        if (this.burstLeft > 0) {
          this.burstTimer -= dt;
          if (this.burstTimer <= 0) {
            this.burstTimer = 0.13;
            this.burstLeft -= 1;
            this._fireAtTarget(ctx);
          }
        } else if (time >= this.nextBurstAt) {
          this.burstLeft = BURST;
          this.burstTimer = 0;
          this.nextBurstAt = time + this.rng.range(this.tier.pauseMin, this.tier.pauseMax) + 0.35;
        }
      }
    } else {
      // --- Move toward the objective along the waypoint path.
      this._repathIfNeeded(match);
      if (this.fallback) {
        const home = this.team === 'vanguard' ? { x: 0, z: 11 } : { x: 0, z: -11 };
        moving = this._advance(dt, home.x, home.z);
      } else if (this.path.length > 0) {
        const node = this.path[this.pathIdx];
        const d = Math.hypot(node.x - this.state.position.x, node.z - this.state.position.z);
        if (d < 0.6) {
          this.pathIdx += 1;
          if (this.pathIdx >= this.path.length) this.path = [];
        } else {
          moving = this._advance(dt, node.x, node.z);
        }
      }
      if (moving) this._poseWalk(dt);
      else { this.moveSpeed = 0; this._poseIdle(); }
    }
    this._syncTransform();
  }
  _advance(dt, tx, tz) {
    const p = this.state.position;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) return false;
    const wantYaw = Math.atan2(-dx, -dz);
    this._turnToward(wantYaw, dt, 8);
    const speed = this.tier.speed;
    const stepLen = Math.min(dist, speed * dt);
    const nx = p.x + (-Math.sin(this.state.yaw)) * stepLen;
    const nz = p.z + (-Math.cos(this.state.yaw)) * stepLen;
    if (!this.world.blocked(nx, nz, 0.42)) {
      p.x = nx;
      p.z = nz;
    } else {
      // Nudged into cover: sidestep along the wall.
      const sx = p.x + Math.cos(this.state.yaw) * stepLen * 0.5;
      const sz = p.z - Math.sin(this.state.yaw) * stepLen * 0.5;
      if (!this.world.blocked(sx, sz, 0.42)) { p.x = sx; p.z = sz; }
      else { this.path = []; this.repathTimer = 0; }
    }
    this.moveSpeed = speed;
    return true;
  }
  _syncTransform() {
    this.group.position.set(this.state.position.x, this.group.position.y, this.state.position.z);
    this.group.rotation.y = this.state.yaw;
  }
}

export class BotManager {
  constructor(scene, world, rng) {
    this.list = [];
    const specs = [
      ['vanguard', 'veteran'], ['vanguard', 'regular'], ['vanguard', 'regular'], ['vanguard', 'rookie'],
      ['warden', 'veteran'], ['warden', 'veteran'], ['warden', 'regular'], ['warden', 'regular'], ['warden', 'rookie'],
    ];
    specs.forEach(([team, tier], i) => {
      this.list.push(new Bot(team, tier, i, scene, world, rng));
    });
    this.spawnSlots = {
      vanguard: [[-3, 11.5, 0], [-1.5, 12.5, 0], [1.5, 12.5, 0], [3, 11.5, 0]],
      warden: [[-4, -12, Math.PI], [-2, -12.5, Math.PI], [0, -12.5, Math.PI], [2, -12.5, Math.PI], [4, -12, Math.PI]],
    };
  }
  reset() {
    let vi = 0;
    let wi = 0;
    for (const b of this.list) {
      const slot = b.team === 'vanguard' ? this.spawnSlots.vanguard[vi++] : this.spawnSlots.warden[wi++];
      b.respawn(slot[0], slot[1], slot[2]);
    }
  }
  update(dt, ctx) {
    for (const b of this.list) b.update(dt, ctx);
  }
  aliveCount(team) {
    return this.list.filter((b) => b.alive && (!team || b.team === team)).length;
  }
}
