// SABLE YARD — weapons and the buy shop. Six buy items plus a plate vest.
// The Rig is the player's weapon state: what is owned, what is selected,
// magazine and reserve ammo, reload timing and the first-person gun models.
import * as THREE from 'three';
import { PAL } from './palette.js';

export const WEAPONS = {
  p9: {
    id: 'p9', slot: 1, name: 'P9 Sidearm', kind: 'p9', price: 0,
    damage: 22, headMult: 2.5, mag: 12, reserve: 48, rof: 0.16,
    spread: 0.014, reload: 1.1, range: 30, auto: false, pellets: 1,
    blurb: 'Reliable sidearm. Free, always in your holster.',
  },
  hornet: {
    id: 'hornet', slot: 2, name: 'Hornet SMG', kind: 'smg', price: 900,
    damage: 15, headMult: 2.5, mag: 32, reserve: 96, rof: 0.075,
    spread: 0.022, reload: 1.5, range: 22, auto: true, pellets: 1,
    blurb: 'Fast hose. 32 rounds, short reach, close-quarters king.',
  },
  pike: {
    id: 'pike', slot: 3, name: 'Pike Rifle', kind: 'rifle', price: 1400,
    damage: 30, headMult: 2.5, mag: 30, reserve: 90, rof: 0.1,
    spread: 0.009, reload: 1.9, range: 42, auto: true, pellets: 1,
    blurb: 'Balanced workhorse. The rifle every Vanguard trusts.',
  },
  dmr: {
    id: 'dmr', slot: 4, name: 'Longshot DMR', kind: 'dmr', price: 2300,
    damage: 68, headMult: 2.5, mag: 8, reserve: 24, rof: 0.55,
    spread: 0.003, reload: 2.4, range: 60, auto: false, pellets: 1, zoom: true,
    blurb: 'Scoped marksman rifle. One shot, one down, at any range.',
  },
  shotgun: {
    id: 'shotgun', slot: 5, name: 'Breacher Shotgun', kind: 'shotgun', price: 1100,
    damage: 11, headMult: 2.5, mag: 6, reserve: 24, rof: 0.85,
    spread: 0.05, reload: 2.6, range: 14, auto: false, pellets: 8,
    blurb: 'Eight pellets of bad news. Devastating up close.',
  },
  grenade: {
    id: 'grenade', slot: 6, name: 'Spark Grenade', kind: 'grenade', price: 300,
    damage: 90, headMult: 1, mag: 1, reserve: 0, rof: 0.9,
    spread: 0, reload: 0, range: 0, auto: false, pellets: 1, throwable: true,
    blurb: 'Thrown spark charge. Arcs, fuses, clears a corner.',
  },
};

export const VEST = {
  id: 'vest', name: 'Plate Vest', price: 650, armor: 50,
  blurb: 'Steel plates. Soaks half of every hit until it breaks.',
};

export const SHOP = [
  WEAPONS.p9, WEAPONS.hornet, WEAPONS.pike, WEAPONS.dmr, WEAPONS.shotgun, WEAPONS.grenade, VEST,
];

export const START_MONEY = 800;
export const KILL_REWARD = 150;
export const ROUND_WIN_REWARD = 400;
export const ROUND_LOSS_REWARD = 150;

// Build a small first-person gun from boxes: barrel, muzzle, handguard,
// stock, magazine and sights. Different silhouette per weapon kind.
function buildGunModel(kind) {
  const metal = new THREE.MeshStandardMaterial({ color: PAL.gunMetal, roughness: 0.45, metalness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: PAL.gunGrip, roughness: 0.85, metalness: 0.05 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.5, metalness: 0.4 });
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, mat = metal) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (kind === 'p9') {
    add(0.05, 0.07, 0.22, 0, 0, -0.1); // slide
    add(0.045, 0.05, 0.1, 0, -0.05, 0.02, grip); // grip
    add(0.02, 0.03, 0.02, 0, 0.05, -0.18); // front sight
    add(0.04, 0.02, 0.05, 0, 0.045, 0.06); // rear sight
  } else if (kind === 'smg') {
    add(0.06, 0.08, 0.34, 0, 0, -0.12); // body
    add(0.03, 0.03, 0.16, 0, 0.01, -0.36); // barrel
    add(0.05, 0.09, 0.1, 0, -0.02, -0.2, grip); // foregrip
    add(0.05, 0.12, 0.06, 0, -0.09, 0.04, grip); // grip
    add(0.04, 0.1, 0.04, 0, -0.1, -0.05, grip); // magazine
    add(0.02, 0.03, 0.02, 0, 0.055, -0.28); // sight
  } else if (kind === 'dmr') {
    add(0.06, 0.09, 0.5, 0, 0, -0.16); // long body
    add(0.025, 0.025, 0.3, 0, 0.01, -0.52); // barrel
    add(0.05, 0.05, 0.08, 0, 0.01, -0.66, accent); // muzzle brake
    add(0.05, 0.07, 0.14, 0, 0.07, -0.12, accent); // scope
    add(0.05, 0.1, 0.05, 0, -0.1, 0.02, grip); // magazine
    add(0.05, 0.08, 0.12, 0, -0.01, 0.14, grip); // stock
  } else if (kind === 'shotgun') {
    add(0.07, 0.09, 0.42, 0, 0, -0.12); // receiver
    add(0.05, 0.05, 0.34, 0, 0.02, -0.44); // barrel
    add(0.045, 0.045, 0.3, 0, -0.03, -0.4); // pump tube
    add(0.06, 0.07, 0.08, 0, -0.02, -0.3, grip); // pump
    add(0.05, 0.12, 0.06, 0, -0.1, 0.06, grip); // grip
    add(0.05, 0.09, 0.14, 0, -0.01, 0.16, grip); // stock
  } else { // rifle
    add(0.06, 0.08, 0.4, 0, 0, -0.14); // receiver + handguard
    add(0.03, 0.03, 0.22, 0, 0.01, -0.44); // barrel
    add(0.04, 0.04, 0.06, 0, 0.01, -0.56); // muzzle
    add(0.045, 0.11, 0.05, 0, -0.1, -0.04, grip); // magazine
    add(0.05, 0.11, 0.06, 0, -0.09, 0.08, grip); // grip
    add(0.05, 0.08, 0.14, 0, -0.01, 0.16, grip); // stock
    add(0.02, 0.035, 0.02, 0, 0.055, -0.32); // front sight
    add(0.04, 0.02, 0.06, 0, 0.05, 0.02); // rear sight
  }
  return g;
}

export class Rig {
  constructor(camera) {
    this.camera = camera;
    this.state = {
      current: 'p9',
      owned: new Set(['p9']),
      ammo: {},
    };
    this.cooldown = 0;
    this.reloading = 0; // seconds left, 0 when not reloading
    this.reloadTarget = null;
    this.recoil = 0;
    this.viewGroup = new THREE.Group();
    this.models = {};
    for (const id of ['p9', 'hornet', 'pike', 'dmr', 'shotgun']) {
      const m = buildGunModel(WEAPONS[id].kind);
      m.visible = id === 'p9';
      this.models[id] = m;
      this.viewGroup.add(m);
    }
    // The view group rides on the camera, low and to the right.
    this.viewGroup.position.set(0.26, -0.24, -0.55);
    this.viewGroup.rotation.y = 0.06;
    camera.add(this.viewGroup);
    this.reset();
  }
  reset() {
    this.state.current = 'p9';
    this.state.owned = new Set(['p9']);
    this.state.ammo = {};
    for (const id of Object.keys(WEAPONS)) {
      const w = WEAPONS[id];
      this.state.ammo[id] = { mag: w.mag, reserve: w.reserve };
    }
    this.cooldown = 0;
    this.reloading = 0;
    this.reloadTarget = null;
    this.recoil = 0;
    this._syncModels();
  }
  weapon() {
    return WEAPONS[this.state.current];
  }
  // Buy a weapon (or vest/grenade) with the money offered. Returns the price
  // when the purchase lands, null when it cannot be afforded. Buying a
  // weapon you already own costs nothing and just re-arms it.
  buy(id, money) {
    if (id === 'vest') {
      return money >= VEST.price ? VEST.price : null;
    }
    const w = WEAPONS[id];
    if (!w) return null;
    if (id === 'grenade') {
      if (money < w.price) return null;
      this.state.ammo.grenade.mag += 1;
      this.state.owned.add('grenade');
      return w.price;
    }
    if (this.state.owned.has(id)) return 0;
    if (money < w.price) return null;
    this.state.owned.add(id);
    this.state.ammo[id] = { mag: w.mag, reserve: w.reserve };
    return w.price;
  }
  select(id) {
    if (!this.state.owned.has(id)) return false;
    if (this.state.current === id) return true;
    this.state.current = id;
    this.reloading = 0;
    this.reloadTarget = null;
    this.cooldown = Math.max(this.cooldown, 0.15);
    this._syncModels();
    return true;
  }
  _syncModels() {
    for (const [id, m] of Object.entries(this.models)) {
      m.visible = id === this.state.current;
    }
  }
  ready() {
    const w = this.weapon();
    if (this.reloading > 0) return false;
    if (this.cooldown > 0) return false;
    if (w.throwable) return this.state.ammo.grenade.mag > 0;
    return this.state.ammo[w.id].mag > 0;
  }
  // Spend one shot's ammo and start the fire-rate cooldown. Returns true
  // when a shot actually left the barrel.
  spendShot() {
    const w = this.weapon();
    if (!this.ready()) return false;
    if (w.throwable) {
      this.state.ammo.grenade.mag -= 1;
      this.cooldown = w.rof;
      return true;
    }
    this.state.ammo[w.id].mag -= 1;
    this.cooldown = w.rof;
    this.recoil = Math.min(1, this.recoil + (w.kind === 'dmr' || w.kind === 'shotgun' ? 0.9 : 0.35));
    return true;
  }
  reload() {
    const w = this.weapon();
    if (w.throwable) return false;
    const a = this.state.ammo[w.id];
    if (this.reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return false;
    this.reloading = w.reload;
    this.reloadTarget = w.id;
    return true;
  }
  step(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 3.2);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const w = WEAPONS[this.reloadTarget];
        if (w) {
          const a = this.state.ammo[w.id];
          const need = w.mag - a.mag;
          const take = Math.min(need, a.reserve);
          a.mag += take;
          a.reserve -= take;
        }
        this.reloadTarget = null;
      }
    }
    // View-model sway: recoil kicks the gun up, then it settles.
    this.viewGroup.rotation.x = this.recoil * 0.14;
    this.viewGroup.position.y = -0.24 + this.recoil * 0.03;
  }
  modelPos() {
    const v = new THREE.Vector3();
    this.viewGroup.getWorldPosition(v);
    return v;
  }
}
