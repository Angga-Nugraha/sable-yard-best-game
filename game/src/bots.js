// Bots: the other nine soldiers. Each has a skill tier, a route to walk, a
// hold to keep, eyes that need line of sight, ears that hear gunfire, and a
// trigger finger with burst discipline. They never see through walls and
// never know where the player is until they see, hear, or are shot by them.
import * as THREE from 'three';
import { createMover } from './player.js';
import { WEAPONS } from './weapons.js';
import { PALETTE } from './palette.js';
import { shuffle } from './rng.js';

const SKILLS = {
  // Tuned so a round breathes: wider aim error with stronger range falloff,
  // longer pauses between bursts, and a settle delay after first acquiring
  // a target. Tiers keep their order (veteran > regular > rookie); every
  // number below only slows the kill chain.
  veteran: { aimErr: 0.016, reaction: 0.3, burst: 3, pauseMin: 0.8, pauseMax: 1.4, speed: 5.0, hp: 100 },
  regular: { aimErr: 0.028, reaction: 0.5, burst: 3, pauseMin: 1.1, pauseMax: 1.9, speed: 4.6, hp: 100 },
  rookie: { aimErr: 0.05, reaction: 0.75, burst: 2, pauseMin: 1.4, pauseMax: 2.4, speed: 4.2, hp: 100 },
};

const VANGUARD_NAMES = ['Rook', 'Fable', 'Ivo', 'Mara'];
const WARDEN_NAMES = ['Sable', 'Kestrel', 'Onyx', 'Brine', 'Talon'];
const WARDEN_SKILLS = ['veteran', 'regular', 'regular', 'rookie', 'veteran'];
const VANGUARD_SKILLS = ['regular', 'veteran', 'regular', 'rookie'];
const WARDEN_WEAPONS = ['pike', 'pike', 'scatter', 'p9', 'pike'];
const VANGUARD_WEAPONS = ['pike', 'longshot', 'scatter', 'pike'];

const EYE = new THREE.Vector3();
const TARGET_POS = new THREE.Vector3();
const TO_TARGET = new THREE.Vector3();

// Shared geometries: 9 bots x ~20 meshes would allocate ~180 geometries; the
// boxes are identical sizes, so one geometry per size serves every bot.
const GEO = {};
function boxGeo(w, h, d) {
  const key = `b${w}x${h}x${d}`;
  if (!GEO[key]) GEO[key] = new THREE.BoxGeometry(w, h, d);
  return GEO[key];
}
function sphereGeo(r) {
  const key = `s${r}`;
  if (!GEO[key]) GEO[key] = new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  return GEO[key];
}
function sphereFull(r) {
  const key = `sf${r}`;
  if (!GEO[key]) GEO[key] = new THREE.SphereGeometry(r, 14, 10);
  return GEO[key];
}
function cylGeo(r, len) {
  const key = `c${r}x${len}`;
  if (!GEO[key]) GEO[key] = new THREE.CylinderGeometry(r, r, len, 8);
  return GEO[key];
}
// Tapered cylinder (top radius, bottom radius, height, 8 sides): the torso
// shell and limb segments. One geometry per size serves every bot.
function cylTaper(rTop, rBot, len) {
  const key = `ct${rTop}x${rBot}x${len}`;
  if (!GEO[key]) GEO[key] = new THREE.CylinderGeometry(rTop, rBot, len, 8);
  return GEO[key];
}

export function createBots(scene, world, random) {
  const list = [];
  const hitMeshes = [];
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#54483c'), roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a37e'), roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#211a15'), roughness: 0.6, metalness: 0.25 });
  const teamMats = {
    // A touch of emissive so the team colour reads at dusk, from across the yard.
    vanguard: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.vanguard), roughness: 0.6, emissive: new THREE.Color(PALETTE.vanguard), emissiveIntensity: 0.5 }),
    warden: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.warden), roughness: 0.6, emissive: new THREE.Color(PALETTE.warden), emissiveIntensity: 0.5 }),
  };
  // Uniform fabric per team: olive drab vs slate. The torso shell, limbs and
  // helmet base wear this; the team colour survives only as gear accents
  // (helmet, pads, vest stripe), so the silhouette reads as a soldier in
  // uniform, not a solid block of team colour.
  const uniformMats = {
    vanguard: new THREE.MeshStandardMaterial({ color: new THREE.Color('#57523a'), roughness: 0.95 }),
    warden: new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f4c57'), roughness: 0.95 }),
  };
  const vestMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e2b22'), roughness: 0.9 });
  // Gunmetal: the gun must read against the dark vest (a dark gun vanishes
  // on dark fabric).
  const gunmetalMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a4f55'), roughness: 0.35, metalness: 0.6 });

  function buildMesh(bot) {
    const group = new THREE.Group();
    const teamMat = teamMats[bot.team];
    const uniformMat = uniformMats[bot.team];

    // Human soldier, procedurally. Facing is local -z (gun side: the barrel,
    // the arms and the shooting direction all agree on -z), so the FACE and
    // the chest gear live on -z and the backpack on +z.
    // Hitboxes: torso 0.56x0.72x0.34 at y 1.0 and head 0.3^3 at y 1.56 are
    // the only meshes the shooter can hit. They stay visible boxes with the
    // same sizes, positions and userData; the human shells are sized to
    // enclose them, so the raycast geometry is fixed and the boxes are
    // simply never seen. All visuals hang off bot.visual (bob/lean) and the
    // limb pivots (walk cycle); the hit meshes stay direct children of the
    // group so a visual bob never moves a hitbox.
    const torso = new THREE.Mesh(boxGeo(0.56, 0.72, 0.34), teamMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    const head = new THREE.Mesh(boxGeo(0.3, 0.3, 0.3), headMat);
    head.position.y = 1.56;
    head.castShadow = true;
    torso.userData = { actor: bot, part: 'body' };
    head.userData = { actor: bot, part: 'head' };
    group.add(torso, head);

    // --- Visual body.
    const visual = new THREE.Group();
    group.add(visual);
    // Tapered torso shell, 8-sided, flat face forward (rotation.y = PI/8).
    // Radius 0.33 top / 0.30 bottom encloses the 0.56x0.34 hitbox.
    const torsoShell = new THREE.Mesh(cylTaper(0.33, 0.30, 0.72), uniformMat);
    torsoShell.position.y = 1.0;
    torsoShell.rotation.y = Math.PI / 8;
    torsoShell.castShadow = true;
    // Belt/webbing across the waist: hides the shell's bottom corners.
    const belt = new THREE.Mesh(boxGeo(0.58, 0.09, 0.40), darkMat);
    belt.position.y = 0.67;
    // Plate carrier on the chest (-z), proud of the shell; stripe + pouch on it.
    const vest = new THREE.Mesh(boxGeo(0.5, 0.55, 0.06), vestMat);
    vest.position.set(0, 1.02, -0.285);
    const stripe = new THREE.Mesh(boxGeo(0.5, 0.11, 0.02), teamMat);
    stripe.position.set(0, 1.24, -0.335);
    const pouch = new THREE.Mesh(boxGeo(0.34, 0.16, 0.07), vestMat);
    pouch.position.set(0, 0.86, -0.30);
    // Shoulder pads, rounded, team-tinted so the team reads from any angle.
    const padL = new THREE.Mesh(sphereFull(0.10), teamMat);
    padL.scale.set(1, 0.65, 1.4);
    padL.position.set(-0.33, 1.33, 0);
    const padR = new THREE.Mesh(sphereFull(0.10), teamMat);
    padR.scale.set(1, 0.65, 1.4);
    padR.position.set(0.33, 1.33, 0);
    // Backpack on the back (+z).
    const pack = new THREE.Mesh(boxGeo(0.38, 0.48, 0.16), darkMat);
    pack.position.set(0, 1.05, 0.30);
    // Neck gaiter, then the head: skin sphere, dark face mask over the lower
    // face, curved goggle band across the eyes, helmet dome + brim on top.
    const neck = new THREE.Mesh(cylGeo(0.085, 0.14), darkMat);
    neck.position.y = 1.37;
    const skull = new THREE.Mesh(sphereFull(0.23), headMat);
    skull.position.y = 1.56;
    skull.castShadow = true;
    // The old 0.30 box was narrower than the r0.23 skull, so the skull
    // swallowed it whole — this band wraps AROUND the lower face.
    const maskGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.12, 12, 1, true, Math.PI - 1.1, 2.2);
    const mask = new THREE.Mesh(maskGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color('#211a15'), roughness: 0.9, side: THREE.DoubleSide }));
    mask.position.y = 1.45;
    const visorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.10, 12, 1, true, Math.PI - 0.65, 1.3);
    const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color('#14100d'), roughness: 0.25, metalness: 0.4, side: THREE.DoubleSide }));
    visor.position.y = 1.58;
    const helmet = new THREE.Mesh(sphereGeo(0.245), teamMat);
    helmet.position.y = 1.63;
    helmet.scale.set(1, 0.85, 1);
    const brim = new THREE.Mesh(cylGeo(0.25, 0.035), darkMat);
    brim.position.y = 1.66;
    visual.add(torsoShell, belt, vest, stripe, pouch, padL, padR, pack, neck, skull, mask, visor, helmet, brim);

    // --- Arms: shoulder pivots, upper arm + elbow pivot + forearm, posed
    // forward-down toward the gun. The gun itself stays fixed to the group;
    // the arms sway only a little so the hands stay on it.
    function buildArm(side) {
      const sh = new THREE.Group();
      sh.position.set(0.335 * side, 1.30, 0);
      const upper = new THREE.Mesh(cylTaper(0.055, 0.05, 0.26), uniformMat);
      upper.position.y = -0.13;
      sh.add(upper);
      const el = new THREE.Group();
      el.position.y = -0.26;
      const fore = new THREE.Mesh(cylTaper(0.05, 0.045, 0.24), uniformMat);
      fore.position.y = -0.12;
      el.add(fore);
      // Team armband on the left forearm: the second colour cue.
      if (side < 0) {
        const band = new THREE.Mesh(boxGeo(0.12, 0.05, 0.12), teamMat);
        band.position.y = -0.12;
        el.add(band);
      }
      sh.add(el);
      visual.add(sh);
      return { sh, el };
    }
    const armL = buildArm(-1);
    const armR = buildArm(1);

    // --- Gun held across the chest, pointing forward (-z).
    const gun = new THREE.Mesh(boxGeo(0.07, 0.09, 0.55), gunmetalMat);
    gun.position.set(0.1, 1.15, -0.32);
    const gunBarrel = new THREE.Mesh(cylGeo(0.02, 0.3), gunmetalMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.1, 1.17, -0.68);
    visual.add(gun, gunBarrel);

    // --- Legs: hip pivots, thigh + knee pivot + shin + boot (toe forward).
    function buildLeg(side) {
      const hip = new THREE.Group();
      hip.position.set(0.11 * side, 0.64, 0);
      const thigh = new THREE.Mesh(cylTaper(0.075, 0.065, 0.30), uniformMat);
      thigh.position.y = -0.15;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.30;
      const shin = new THREE.Mesh(cylTaper(0.06, 0.055, 0.28), uniformMat);
      shin.position.y = -0.14;
      knee.add(shin);
      const boot = new THREE.Mesh(boxGeo(0.13, 0.08, 0.27), darkMat);
      boot.position.set(0, -0.30, -0.05);
      knee.add(boot);
      hip.add(knee);
      visual.add(hip);
      return { hip, knee };
    }
    const legL = buildLeg(-1);
    const legR = buildLeg(1);

    bot.visual = visual;
    bot.limbs = { armL, armR, legL, legR };
    bot.hitMeshes = [torso, head];
    bot.mesh = group;
    scene.add(group);
  }

  function makeBot(team, index, spawn) {
    const skillName = team === 'warden' ? WARDEN_SKILLS[index] : VANGUARD_SKILLS[index];
    const bot = {
      id: `${team}-${index}`,
      name: team === 'warden' ? WARDEN_NAMES[index] : VANGUARD_NAMES[index],
      team,
      skillName,
      skill: SKILLS[skillName],
      weaponId: team === 'warden' ? WARDEN_WEAPONS[index] : VANGUARD_WEAPONS[index],
      mover: createMover(world.colliders, spawn),
      hp: 100,
      maxHp: 100,
      alive: true,
      state: 'route',
      route: [],
      routeIdx: 0,
      holdNode: null,
      target: null,
      lastSeen: new THREE.Vector3(),
      lastSeenTime: -99,
      burstLeft: 0,
      burstTimer: 0,
      pauseTimer: 0,
      acquireTimer: 0,
      thinkTimer: random() * 0.12,
      strafeDir: 1,
      strafeTimer: 0,
      investigatePos: new THREE.Vector3(),
      stuckTimer: 0,
      lastX: spawn.x,
      lastZ: spawn.z,
      channel: 0,
      channelKind: null,
      grenades: 1,
      noLosTimer: 0,
      fallT: 0,
      yawSweep: 0,
      // Cosmetic walk phase: from a fixed per-bot offset, NOT the seeded
      // random stream — the animation must never shift the gameplay RNG.
      walkPhase: ((team === 'warden' ? 4 : 0) + index) * 1.7,
      moveFactor: 0,
    };
    buildMesh(bot);
    return bot;
  }

  for (let i = 0; i < 4; i += 1) {
    const bot = makeBot('vanguard', i, world.spawns.vanguard[i]);
    list.push(bot);
    hitMeshes.push(...bot.hitMeshes);
  }
  for (let i = 0; i < 5; i += 1) {
    const bot = makeBot('warden', i, world.spawns.warden[i]);
    list.push(bot);
    hitMeshes.push(...bot.hitMeshes);
  }

  function eyeOf(bot) {
    EYE.set(bot.mover.state.position.x, bot.mover.state.position.y + bot.mover.state.eye, bot.mover.state.position.z);
    return EYE;
  }

  function visibleEnemy(bot, ctx) {
    const eye = eyeOf(bot);
    let best = null;
    let bestDist = Infinity;
    for (const enemy of ctx.enemies) {
      if (!enemy.alive || enemy.team === bot.team) continue;
      const ep = enemy.eyePos;
      const dx = ep.x - eye.x;
      const dy = ep.y - eye.y;
      const dz = ep.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 48 || dist >= bestDist) continue;
      // Vision cone, unless the enemy is close or just fired.
      const fx = -Math.sin(bot.mover.state.yaw);
      const fz = -Math.cos(bot.mover.state.yaw);
      const facing = (dx * fx + dz * fz) / Math.max(dist, 0.001);
      const heard = ctx.recentShot && ctx.recentShot.time > ctx.time - 1.5
        && Math.hypot(ctx.recentShot.x - eye.x, ctx.recentShot.z - eye.z) < 25;
      if (facing < 0.3 && dist > 7 && !heard) continue;
      if (!world.hasLineOfSight(eye, ep)) continue;
      best = enemy;
      bestDist = dist;
    }
    return best ? { enemy: best, dist: bestDist } : null;
  }

  function reset(roundPlan) {
    for (let i = 0; i < list.length; i += 1) {
      const bot = list[i];
      const idx = bot.team === 'vanguard' ? i : i - 4;
      const sp = world.spawns[bot.team][idx];
      bot.mover.teleport(sp.x, sp.z, bot.team === 'vanguard' ? Math.PI : 0);
      bot.hp = bot.skill.hp;
      bot.maxHp = bot.skill.hp;
      bot.alive = true;
      bot.state = bot.team === 'vanguard' ? 'route' : 'hold';
      bot.route = (roundPlan[bot.id] || []).slice();
      bot.routeIdx = 0;
      bot.holdNode = bot.team === 'warden' ? (roundPlan[bot.id] ? roundPlan[bot.id][0] : null) : null;
      bot.target = null;
      bot.burstLeft = 0;
      bot.burstTimer = 0;
      bot.pauseTimer = 0;
      bot.acquireTimer = 0;
      bot.channel = 0;
      bot.channelKind = null;
      bot.grenades = 1;
      bot.noLosTimer = 0;
      bot.fallT = 0;
      bot.moveFactor = 0;
      bot.visual.rotation.set(0, 0, 0);
      bot.visual.position.y = 0;
      bot.mesh.rotation.set(0, 0, 0);
      bot.mesh.visible = true;
      for (const m of bot.hitMeshes) {
        m.visible = true;
        if (!hitMeshes.includes(m)) hitMeshes.push(m);
      }
      bot.mesh.position.set(sp.x, 0, sp.z);
    }
  }

  function die(bot, ctx) {
    bot.alive = false;
    bot.state = 'dead';
    bot.fallT = 0.0001;
    for (const m of bot.hitMeshes) {
      const i = hitMeshes.indexOf(m);
      if (i >= 0) hitMeshes.splice(i, 1);
    }
    if (ctx.onDeath) ctx.onDeath(bot);
  }

  function damage(bot, dmg, part, attacker, ctx) {
    if (!bot.alive) return null;
    bot.hp -= dmg;
    if (bot.hp <= 0) {
      bot.hp = 0;
      die(bot, ctx);
      return 'kill';
    }
    // Being shot reveals the shooter: turn and look.
    if (attacker && attacker.eyePos) {
      bot.lastSeen.set(attacker.eyePos.x, attacker.eyePos.y, attacker.eyePos.z);
      bot.lastSeenTime = ctx.time;
      bot.target = attacker;
      bot.state = 'combat';
    }
    return 'hit';
  }

  function step(dt, ctx) {
    for (const bot of list) {
      const body = bot.mover.state;
      if (!bot.alive) {
        if (bot.fallT > 0 && bot.fallT < 1) {
          bot.fallT = Math.min(1, bot.fallT + dt * 2.8);
          bot.mesh.rotation.x = -Math.PI / 2 * bot.fallT;
          bot.mesh.position.y = 0.15 * bot.fallT;
        }
        continue;
      }
      bot.thinkTimer -= dt;
      bot.strafeTimer -= dt;
      bot.burstTimer -= dt;
      bot.pauseTimer -= dt;
      bot.acquireTimer -= dt;

      // --- Perception, staggered by skill so veterans react first.
      if (bot.thinkTimer <= 0) {
        bot.thinkTimer = 0.12 + bot.skill.reaction * 0.4;
        const seen = visibleEnemy(bot, ctx);
        if (seen) {
          // New target: the bot needs a beat to settle its aim before the
          // first shot — no more instant bursts the moment a lane opens.
          if (!bot.target || bot.target !== seen.enemy) {
            bot.acquireTimer = bot.skill.reaction + 0.35 + random() * 0.3;
            bot.burstLeft = 0;
          }
          bot.target = seen.enemy;
          bot.lastSeen.set(seen.enemy.eyePos.x, seen.enemy.eyePos.y, seen.enemy.eyePos.z);
          bot.lastSeenTime = ctx.time;
          // No fighting during the buy phase: bots hold their routes until the round goes live.
          if (ctx.live && bot.state !== 'defuse') bot.state = 'combat';
        } else if (bot.state === 'combat' && ctx.time - bot.lastSeenTime > 2.5) {
          bot.state = 'investigate';
          bot.investigatePos.copy(bot.lastSeen);
        }
        // Defuse duty: the nearest living Warden to a planted beacon goes for it.
        if (ctx.beacon && ctx.beacon.planted && bot.team === 'warden' && bot.state !== 'combat') {
          const d = Math.hypot(ctx.beacon.x - body.position.x, ctx.beacon.z - body.position.z);
          let nearest = true;
          for (const other of list) {
            if (other === bot || other.team !== 'warden' || !other.alive) continue;
            const od = Math.hypot(ctx.beacon.x - other.mover.state.position.x, ctx.beacon.z - other.mover.state.position.z);
            if (od < d - 0.5) { nearest = false; break; }
          }
          if (nearest) {
            bot.state = 'defuse-route';
            bot.channelKind = 'defuse';
          }
        }
        // Gunfire noise pulls idle bots toward it.
        if (bot.state === 'hold' || bot.state === 'route') {
          const n = ctx.noise && ctx.noise.length > 0 ? ctx.noise[ctx.noise.length - 1] : null;
          if (n && ctx.time - n.time < 1.2) {
            const nd = Math.hypot(n.x - body.position.x, n.z - body.position.z);
            if (nd < 25 && nd > 4) {
              bot.state = 'investigate';
              bot.investigatePos.set(n.x, 0, n.z);
            }
          }
        }
      }

      // --- Movement and facing by state.
      let wishX = 0;
      let wishZ = 0;
      let speedMul = 1;
      if (bot.state === 'route' && bot.route.length > 0) {
        const node = world.nodes[bot.route[Math.min(bot.routeIdx, bot.route.length - 1)]];
        const dx = node.x - body.position.x;
        const dz = node.z - body.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.7) {
          bot.routeIdx += 1;
          if (bot.routeIdx >= bot.route.length) {
            bot.state = 'hold';
            bot.holdNode = bot.route[bot.route.length - 1];
          }
        } else {
          wishX = dx / dist;
          wishZ = dz / dist;
          body.yaw = Math.atan2(-wishX, -wishZ);
        }
      } else if (bot.state === 'hold') {
        bot.yawSweep += dt * 0.5;
        const base = bot.team === 'warden' ? 0 : Math.PI;
        body.yaw = base + Math.sin(bot.yawSweep) * 1.1;
      } else if (bot.state === 'investigate') {
        const dx = bot.investigatePos.x - body.position.x;
        const dz = bot.investigatePos.z - body.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.8) {
          bot.state = bot.team === 'warden' ? 'hold' : 'route';
        } else {
          wishX = dx / dist;
          wishZ = dz / dist;
          body.yaw = Math.atan2(-wishX, -wishZ);
        }
      } else if (bot.state === 'defuse-route' && ctx.beacon) {
        const dx = ctx.beacon.x - body.position.x;
        const dz = ctx.beacon.z - body.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.8) {
          bot.state = 'defuse';
          bot.channel = 0;
        } else {
          wishX = dx / dist;
          wishZ = dz / dist;
          body.yaw = Math.atan2(-wishX, -wishZ);
        }
      } else if (bot.state === 'defuse') {
        bot.channel += dt / 4;
        if (bot.channel >= 1 && ctx.onDefused) ctx.onDefused(bot);
      } else if (bot.state === 'combat' && bot.target && bot.target.alive) {
        const tp = bot.target.eyePos;
        TARGET_POS.set(tp.x, tp.y, tp.z);
        const dx = TARGET_POS.x - body.position.x;
        const dz = TARGET_POS.z - body.position.z;
        const dist = Math.hypot(dx, dz);
        body.yaw = Math.atan2(-dx, -dz);
        body.pitch = Math.atan2(TARGET_POS.y - (body.position.y + body.eye), dist);
        if (bot.strafeTimer <= 0) {
          bot.strafeDir = random() < 0.5 ? -1 : 1;
          bot.strafeTimer = 0.8 + random() * 0.7;
        }
        if (dist > 22) {
          wishX = dx / dist;
          wishZ = dz / dist;
        } else if (dist < 6) {
          wishX = -dx / dist;
          wishZ = -dz / dist;
          speedMul = 0.8;
        } else {
          // Strafe perpendicular to the target.
          wishX = -dz / dist * bot.strafeDir;
          wishZ = dx / dist * bot.strafeDir;
          speedMul = 0.7;
        }
      }

      // Stuck detection: walking but not moving means a wall; give up the route leg.
      const moved = Math.hypot(body.position.x - bot.lastX, body.position.z - bot.lastZ);
      if ((wishX !== 0 || wishZ !== 0) && moved < 0.02) {
        bot.stuckTimer += dt;
        if (bot.stuckTimer > 1.4) {
          bot.stuckTimer = 0;
          if (bot.state === 'route') bot.routeIdx += 1;
          else if (bot.state === 'investigate') bot.state = bot.team === 'warden' ? 'hold' : 'route';
        }
      } else {
        bot.stuckTimer = 0;
      }
      bot.lastX = body.position.x;
      bot.lastZ = body.position.z;

      bot.mover.step(dt, wishX, wishZ, { speed: bot.skill.speed * speedMul });

      // --- Shooting: bursts with pauses, aim error by skill and range.
      // Only while the round is live; the buy phase is for walking, not fighting.
      // Gated on acquireTimer: a bot that just spotted a target holds fire
      // until it has settled its aim.
      if (ctx.live && bot.state === 'combat' && bot.target && bot.target.alive && bot.burstTimer <= 0 && bot.acquireTimer <= 0) {
        const tp = bot.target.eyePos;
        const dx = tp.x - body.position.x;
        const dz = tp.z - body.position.z;
        const dist = Math.hypot(dx, dz);
        const eye = eyeOf(bot);
        if (world.hasLineOfSight(eye, tp)) {
          bot.noLosTimer = 0;
          if (bot.burstLeft <= 0) {
            if (bot.pauseTimer <= 0) {
              bot.burstLeft = bot.skill.burst;
              bot.pauseTimer = bot.skill.pauseMin + random() * (bot.skill.pauseMax - bot.skill.pauseMin);
            }
          } else {
            bot.burstLeft -= 1;
            bot.burstTimer = WEAPONS[bot.weaponId].gap;
            const aimAtHead = random() < 0.12;
            TARGET_POS.set(tp.x, tp.y + (aimAtHead ? 0.45 : -0.15), tp.z);
            TO_TARGET.set(TARGET_POS.x - eye.x, TARGET_POS.y - eye.y, TARGET_POS.z - eye.z).normalize();
            const err = bot.skill.aimErr * (1 + dist / 28) * (bot.target.crouching ? 1.25 : 1);
            ctx.shootBot(bot, eye, TO_TARGET, err);
          }
        } else {
          // No line of sight for a while: lob a grenade at the last seen spot.
          bot.noLosTimer += dt;
          if (bot.noLosTimer > 3 && bot.grenades > 0 && ctx.throwGrenade) {
            const ld = Math.hypot(bot.lastSeen.x - body.position.x, bot.lastSeen.z - body.position.z);
            if (ld > 8 && ld < 26) {
              bot.grenades -= 1;
              bot.noLosTimer = 0;
              ctx.throwGrenade(bot, bot.lastSeen);
            }
          }
        }
      }

      // --- Walk cycle: legs swing, knees bend, arms stay on the gun with a
      // small counter-sway, torso leans forward and bobs twice per stride.
      // `moved` is the previous step's displacement, so speed lags one frame
      // — fine for animation. Idle eases the limbs back to the rest pose.
      const speed = Math.min(6, moved / Math.max(dt, 0.001));
      const targetMf = Math.min(1, speed / 4.5);
      bot.moveFactor += (targetMf - bot.moveFactor) * Math.min(1, dt * 6);
      const mf = bot.moveFactor;
      bot.walkPhase += dt * (2.5 + speed * 1.9) * (mf > 0.03 ? 1 : 0);
      const s = Math.sin(bot.walkPhase);
      const L = bot.limbs;
      L.legL.hip.rotation.x = s * 0.5 * mf;
      L.legR.hip.rotation.x = -s * 0.5 * mf;
      L.legL.knee.rotation.x = -Math.max(0, s) * 0.8 * mf;
      L.legR.knee.rotation.x = -Math.max(0, -s) * 0.8 * mf;
      const aiming = bot.state === 'combat';
      const shX = aiming ? 1.05 : 0.95;
      const elX = aiming ? -0.35 : -0.55;
      L.armL.sh.rotation.x = shX + s * 0.06 * mf;
      L.armR.sh.rotation.x = shX - s * 0.06 * mf;
      L.armL.el.rotation.x = elX;
      L.armR.el.rotation.x = elX;
      bot.visual.rotation.x = 0.05 * mf;
      bot.visual.position.y = Math.abs(Math.cos(bot.walkPhase)) * 0.025 * mf;

      // Sync the visible mesh to the body.
      bot.mesh.position.set(body.position.x, body.position.y, body.position.z);
      bot.mesh.rotation.y = body.yaw;
    }
  }

  return {
    list,
    hitMeshes,
    reset,
    step,
    damage,
    aliveCount(team) {
      let n = 0;
      for (const bot of list) if (bot.team === team && bot.alive) n += 1;
      return n;
    },
  };
}
