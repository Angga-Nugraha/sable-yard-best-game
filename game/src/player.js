// SABLE YARD — the human player: Vanguard soldier, first person. WASD
// movement with collision, mouse look, health and armour, the beacon on
// their back, and the camera that rides their head.
import * as THREE from 'three';

export const EYE_HEIGHT = 1.62;
export const PLAYER_SPEED = 4.5;
export const PLAYER_RADIUS = 0.4;

export class Player {
  constructor(world) {
    this.world = world;
    this.state = {
      position: new THREE.Vector3(0, 0, 11.5),
      yaw: 0,
      pitch: 0,
    };
    this.hp = 100;
    this.armor = 0;
    this.alive = true;
    this.hasBeacon = true;
    this.plantProgress = 0;
    this.deathYaw = 0;
  }
  teleport(x, z, yaw = 0) {
    this.state.position.set(x, 0, z);
    this.state.yaw = yaw;
    this.state.pitch = 0;
  }
  respawn(x, z, yaw = 0) {
    this.hp = 100;
    this.armor = 0;
    this.alive = true;
    this.hasBeacon = true;
    this.plantProgress = 0;
    this.teleport(x, z, yaw);
  }
  forward() {
    return new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
  }
  eyePos() {
    const p = this.state.position;
    return new THREE.Vector3(p.x, p.y + EYE_HEIGHT, p.z);
  }
  // Turn the view to look at a world point (used by the clip driver).
  aimAt(point) {
    const eye = this.eyePos();
    const dx = point.x - eye.x;
    const dy = point.y - eye.y;
    const dz = point.z - eye.z;
    this.state.yaw = Math.atan2(-dx, -dz);
    this.state.pitch = Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.hypot(dx, dz))));
  }
  look(dx, dy) {
    this.state.yaw -= dx * 0.0023;
    this.state.pitch = Math.max(-1.5, Math.min(1.5, this.state.pitch - dy * 0.0023));
  }
  // One fixed step of movement. keys is a Set of KeyboardEvent codes.
  step(dt, keys) {
    if (!this.alive) return;
    let f = 0;
    let s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    if (f === 0 && s === 0) return;
    const len = Math.hypot(f, s);
    f /= len;
    s /= len;
    const sin = Math.sin(this.state.yaw);
    const cos = Math.cos(this.state.yaw);
    // Forward is (-sin, -cos); right is (cos, -sin).
    const mx = -sin * f + cos * s;
    const mz = -cos * f - sin * s;
    const p = this.state.position;
    const nx = p.x + mx * PLAYER_SPEED * dt;
    const nz = p.z + mz * PLAYER_SPEED * dt;
    p.x = nx;
    p.z = nz;
    this.world.resolveCircle(p, PLAYER_RADIUS);
  }
  // Armour soaks half the damage until it breaks.
  takeDamage(amount) {
    if (!this.alive) return 0;
    let rest = amount;
    if (this.armor > 0) {
      const soaked = Math.min(this.armor, rest * 0.5);
      this.armor -= soaked;
      rest -= soaked;
    }
    this.hp -= rest;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return rest;
  }
  healToFull() {
    this.hp = 100;
  }
  syncCamera(camera) {
    const p = this.state.position;
    camera.position.set(p.x, p.y + EYE_HEIGHT, p.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.state.pitch, this.state.yaw, 0);
  }
}
