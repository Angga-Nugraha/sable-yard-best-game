// SABLE YARD — boot, the 60 Hz fixed-step loop, round orchestration,
// shooting input, beacon logic and the staging modes the screenshots use.
// The game runs a fixed 1/60 s simulation step for movement, combat and
// rounds, decoupled from the render frame rate. Randomness comes from a
// seeded generator so a given seed replays the same way.
import * as THREE from 'three';
import { Rng } from './rng.js';
import { PAL } from './palette.js';
import { makeTextures } from './textures.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { WEAPONS, Rig } from './weapons.js';
import { Player, EYE_HEIGHT } from './player.js';
import { BotManager } from './bots.js';
import { Match, PLANT_TIME } from './rounds.js';
import { Hud } from './hud.js';
import { Effects, Grenade, shootHitscan, falloffDamage } from './combat.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // start | play | buy | end (screenshots)
const SEED = Number.parseInt(params.get('seed') || '7', 10) || 7;

const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 30, 120);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
scene.add(camera);

const rng = new Rng(SEED);
const textures = makeTextures();
const world = buildWorld(textures);
scene.add(world.group);

const audio = new AudioSys();
const input = new Input(renderer.domElement);
const effects = new Effects(scene, textures);
const rig = new Rig(camera);
const player = new Player(world);
const bots = new BotManager(scene, world, rng);
const match = new Match();
const grenades = [];
const shotRng = new Rng(4242);

// Callsigns for the kill feed.
const CALLSIGNS = {
  vanguard: ['Vex', 'Rook', 'Ivy', 'Ash'],
  warden: ['Bram', 'Kestrel', 'Moss', 'Flint', 'Sable'],
};
let vi = 0;
let wi = 0;
for (const b of bots.list) {
  b.callsign = b.team === 'vanguard' ? `Vanguard ${CALLSIGNS.vanguard[vi++]}` : `Warden ${CALLSIGNS.warden[wi++]}`;
}

function actorName(a) {
  if (a === player) return 'YOU';
  return a.callsign || a.team;
}

// Apply damage to the player or a bot. Returns true when the target died.
function damageActor(target, amount, killer, headshot) {
  if (target === player) {
    if (!player.alive) return false;
    player.takeDamage(amount);
    if (!player.alive) {
      hud.addKill(actorName(killer), 'YOU', headshot);
      hud.banner('YOU ARE DOWN', 'Your squad fights on — next round you redeploy');
      audio.hit(false);
      return true;
    }
    return false;
  }
  if (!target.alive) return false;
  target.hp -= amount;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.deathT = 0;
    hud.addKill(actorName(killer), target.callsign, headshot);
    if (killer === player) {
      match.addKillReward();
      audio.hit(true);
    }
    return true;
  }
  return false;
}

const ctx = {
  world, rng, time: 0, player, bots, match, effects, audio, camera, damageActor,
  hud: null, // set below (hud needs callbacks first)
  rig, grenades,
};

const hud = new Hud({
  onBuy: (id) => buyItem(id),
  onSelect: (id) => {
    if (rig.select(id)) {
      audio.click();
      hud.update(match, player, rig);
    }
  },
  onStart: () => startPlaying(),
  onRestart: () => startPlaying(),
});
ctx.hud = hud;
match.attach(ctx);

function buyItem(id) {
  if (match.state.phase !== 'buy') {
    audio.dryFire();
    return false;
  }
  const price = rig.buy(id, match.state.money);
  if (price === null) {
    audio.dryFire();
    hud.banner('NOT ENOUGH MONEY', `You have $${match.state.money}`);
    return false;
  }
  match.state.money -= price;
  if (id === 'vest') {
    player.armor = Math.min(100, player.armor + 50);
  } else {
    rig.select(id);
  }
  audio.buy();
  hud.setMoney(match.state.money);
  hud.update(match, player, rig);
  return true;
}

function startPlaying() {
  audio.unlock();
  match.newMatch();
  match.startRound(ctx);
  hud.hideOverlay();
  hud.banner('ROUND 1 — BUY PHASE', 'B opens the shop · E plants the beacon at a site');
  try {
    const p = renderer.domElement.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* pointer lock is best-effort */ }
}

// --- Player shooting (hitscan, per pellet).
function shootPlayer() {
  if (!rig.spendShot()) return;
  const w = rig.weapon();
  const eye = player.eyePos();
  camera.getWorldDirection(_dir);
  if (w.throwable) {
    const vel = _dir.clone().multiplyScalar(15);
    vel.y += 2.5;
    grenades.push(new Grenade(scene, eye, vel));
    audio.shot('smg');
    return;
  }
  const muzzle = rig.modelPos().addScaledVector(_dir, 0.4);
  effects.muzzleAt(muzzle, camera);
  audio.shot(w.kind);
  // Recoil kicks the view up a touch.
  player.state.pitch += w.kind === 'dmr' || w.kind === 'shotgun' ? 0.028 : 0.011;
  player.state.pitch = Math.min(1.5, player.state.pitch);
  for (let p = 0; p < w.pellets; p++) {
    const dir = _dir.clone();
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, shotRng.gauss() * w.spread);
    dir.addScaledVector(up, shotRng.gauss() * w.spread);
    dir.normalize();
    const hit = shootHitscan(world, eye, dir, w.range + 30, bots.list, player);
    effects.tracer(muzzle, hit.point);
    if (hit.target) {
      const base = falloffDamage(w.damage, hit.dist);
      const dmg = hit.part === 'head' ? base * w.headMult : base;
      const died = damageActor(hit.target, dmg, player, hit.part === 'head');
      hud.flashHitmarker(died);
      if (!died) audio.hit(false);
    } else if (hit.part === 'world') {
      effects.sparksAt(hit.point);
      if (hit.point.y < 0.12) effects.scorchAt(hit.point);
    }
  }
}
const _dir = new THREE.Vector3();

function explodeGrenade(pos) {
  audio.explosion();
  effects.sparksAt(pos);
  effects.scorchAt(pos);
  const R = 5;
  const actors = [player, ...bots.list];
  for (const a of actors) {
    if (!a.alive) continue;
    const d = Math.hypot(a.state.position.x - pos.x, a.state.position.z - pos.z);
    if (d > R) continue;
    const dmg = 90 * (1 - d / R) * (a === player ? 0.5 : 1);
    damageActor(a, dmg, player, false);
  }
}

// --- Beacon planting (player holds E near a site).
let plantTickTimer = 0;
function plantStep(dt) {
  const b = match.state.beacon;
  if (match.state.phase !== 'live' || !player.alive || b.state !== 'carried' || !player.hasBeacon) {
    if (player.plantProgress > 0) {
      player.plantProgress = 0;
      hud.setPlant(null);
    }
    return;
  }
  let near = null;
  for (const key of ['A', 'B']) {
    const s = world.sites[key];
    if (Math.hypot(s.x - player.state.position.x, s.z - player.state.position.z) < 2.6) near = key;
  }
  if (near && input.has('KeyE')) {
    player.plantProgress += dt;
    hud.setPlant(`PLANTING BEACON — SITE ${near}`, player.plantProgress / PLANT_TIME);
    plantTickTimer -= dt;
    if (plantTickTimer <= 0) {
      plantTickTimer = 0.5;
      audio.plantTick();
    }
    if (player.plantProgress >= PLANT_TIME) {
      player.plantProgress = 0;
      player.hasBeacon = false;
      hud.setPlant(null);
      match.plantBeacon(near);
      hud.banner(`BEACON PLANTED — SITE ${near}`, 'Wardens are converging · 35 seconds on the fuse');
      audio.buy();
    }
  } else {
    if (player.plantProgress > 0) {
      player.plantProgress = Math.max(0, player.plantProgress - dt * 2);
      if (player.plantProgress <= 0) hud.setPlant(null);
    }
  }
}

// --- One fixed 1/60 s simulation step.
function simStep(dt) {
  ctx.time += dt;
  const phase = match.state.phase;
  if (phase === 'buy' || phase === 'live') {
    const look = input.consumeLook();
    if (look.dx !== 0 || look.dy !== 0) player.look(look.dx, look.dy);
    player.step(dt, input.keys);
    if (phase === 'live' && player.alive && input.firing && !hud.isBuyOpen()) {
      if (rig.ready()) shootPlayer();
      else if (rig.weapon().mag !== undefined && rig.state.ammo[rig.state.current].mag === 0) rig.reload();
    }
  }
  rig.step(dt);
  if (phase === 'live') {
    bots.update(dt, ctx);
    plantStep(dt);
  }
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.step(dt, world, [player, ...bots.list], (pos) => explodeGrenade(pos));
    if (!g.alive) grenades.splice(i, 1);
  }
  effects.step(dt);
  world.update(dt);
  match.update(dt, ctx);
}

function syncCamera() {
  player.syncCamera(camera);
}

// --- Input wiring: single-press actions.
input.onKey = (code, down) => {
  if (!down) return;
  if (code === 'KeyR') {
    if (rig.reload()) audio.reload();
  } else if (code === 'KeyB') {
    if (match.state.phase === 'buy' || match.state.phase === 'live') {
      hud.showBuy(!hud.isBuyOpen());
      audio.click();
    }
  } else if (code === 'KeyG') {
    if (rig.state.owned.has('grenade')) {
      rig.select('grenade');
      if (rig.ready()) shootPlayer();
    }
  } else if (code.startsWith('Digit')) {
    const n = Number.parseInt(code.slice(5), 10);
    const w = Object.values(WEAPONS).find((x) => x.slot === n);
    if (w && rig.select(w.id)) {
      audio.click();
      hud.update(match, player, rig);
    }
  }
};
input.onMouseDown = (button) => {
  if (button === 2 && rig.weapon().zoom) zoomTarget = 34;
};
input.onMouseUp = (button) => {
  if (button === 2) zoomTarget = 75;
};

// --- Match callbacks.
match.onRoundEnd = (winner, reason) => {
  audio.roundEnd(winner === 'vanguard');
  hud.showRoundEnd(match.state.lastResult, match.state.score);
  hud.banner(winner === 'vanguard' ? 'VANGUARD TAKES THE ROUND' : 'WARDENS TAKE THE ROUND', reason);
};
match.onMatchEnd = (winner) => {
  audio.roundEnd(winner === 'vanguard');
  hud.showMatchEnd(winner, match.state.score);
};

// --- Render loop: fixed-step sim, decoupled from frame rate.
let zoomTarget = 75;
let acc = 0;
let lastT = performance.now();
let framesRendered = 0;
let staged = false;
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  acc += frameDt;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 5) {
    simStep(1 / 60);
    acc -= 1 / 60;
    steps += 1;
  }
  if (acc > 0.1) acc = 0;
  // Zoom ease (DMR scope on right mouse).
  if (Math.abs(camera.fov - zoomTarget) > 0.1) {
    camera.fov += (zoomTarget - camera.fov) * 0.25;
    camera.updateProjectionMatrix();
  }
  syncCamera();
  renderer.render(scene, camera);
  hud.update(match, player, rig);
  framesRendered += 1;
  if (SHOT && staged && framesRendered >= 4) window.__shotReady = true;
  if (!SHOT && framesRendered === 4) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Staging modes for the screenshots (?shot=start|play|buy|end).
function stage() {
  bots.reset();
  player.respawn(world.spawnVanguard.x, world.spawnVanguard.z, 0);
  if (SHOT === 'start') {
    match.state.phase = 'title';
    hud.showTitle();
    player.teleport(0, 11.5, 0);
    syncCamera();
  } else if (SHOT === 'play') {
    hud.hideOverlay();
    match.newMatch();
    match.startRound(ctx);
    match.state.phase = 'live';
    match.state.phaseTime = 100;
    rig.buy('pike', 100000);
    rig.select('pike');
    const wardens = bots.list.filter((b) => b.team === 'warden');
    const spots = [[-3, -7], [2.5, -6], [0, -8], [5, -9], [-5, -10]];
    wardens.forEach((w, i) => w.teleport(spots[i][0], spots[i][1], Math.PI));
    const vans = bots.list.filter((b) => b.team === 'vanguard');
    vans[0].teleport(-4, 9, Math.PI);
    vans[1].teleport(3, 10, 0);
    // Let the firefight develop first, then drop the player into the lane.
    for (let i = 0; i < 240; i++) simStep(1 / 60);
    player.teleport(0, -4.5, 0);
    if (!player.alive) { player.alive = true; player.hp = 100; }
    hud.clearBanner();
    hud.clearFeed();
    const alive = wardens.filter((w) => w.alive);
    if (alive.length) {
      const t = alive[0];
      player.aimAt({ x: t.state.position.x, y: 1.3, z: t.state.position.z });
      syncCamera();
      for (let i = 0; i < 3; i++) {
        if (rig.ready()) shootPlayer();
        simStep(1 / 60);
      }
    }
    hud.update(match, player, rig);
  } else if (SHOT === 'buy') {
    hud.hideOverlay();
    match.newMatch();
    match.startRound(ctx);
    player.teleport(0, 11.5, 0);
    syncCamera();
    hud.showBuy(true);
  } else if (SHOT === 'end') {
    match.state.phase = 'matchEnd';
    match.state.score = { vanguard: 4, warden: 2 };
    match.state.round = 6;
    match.state.money = 1250;
    match.state.kills = 7;
    player.teleport(0, 11.5, 0);
    syncCamera();
    hud.showMatchEnd('vanguard', match.state.score);
    hud.update(match, player, rig);
  }
  staged = true;
}

// --- Debug / test hook: the headless harness drives the game through this.
window.__sable = {
  match, player, playerActor: player, bots, rig, hud, audio,
  scene, renderer, camera, world,
  step: (dt) => simStep(dt),
  syncCamera,
  aimAt: (p) => { player.aimAt(p); syncCamera(); },
  shootPlayer,
  project: (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: v.x, y: v.y, z: v.z };
  },
};

// Boot.
if (SHOT) {
  stage();
} else {
  bots.reset();
  player.respawn(world.spawnVanguard.x, world.spawnVanguard.z, 0);
  hud.showTitle();
}
syncCamera();
requestAnimationFrame(frame);
