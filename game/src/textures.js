// SABLE YARD — procedural textures. Every texture is painted on a canvas at
// load: no image files, no network. Corrugated container steel, stained
// concrete, wood crates, labelled barrels, hazard stripes, site letters,
// chain-link fence, a dusk sky gradient and lit skyline windows.
import * as THREE from 'three';
import { Rng } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(ctx, w, h, rng, n, colors, sizeMax = 3) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rng.next() * colors.length)];
    ctx.globalAlpha = rng.range(0.05, 0.22);
    const s = rng.range(1, sizeMax);
    ctx.fillRect(rng.next() * w, rng.next() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function paintConcrete(rng) {
  const c = canvas(512, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#6f6a61';
  x.fillRect(0, 0, 512, 512);
  // Large stains.
  for (let i = 0; i < 26; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    const px = rng.next() * 512;
    const py = rng.next() * 512;
    const r = rng.range(30, 130);
    const dark = rng.chance(0.5);
    const grad = x.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, dark ? 'rgba(40,36,32,0.28)' : 'rgba(150,140,125,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grad;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // Expansion joints.
  x.strokeStyle = 'rgba(30,28,26,0.55)';
  x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke();
  }
  // Cracks.
  x.strokeStyle = 'rgba(25,22,20,0.5)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    let px = rng.next() * 512;
    let py = rng.next() * 512;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      px += rng.range(-28, 28);
      py += rng.range(-28, 28);
      x.lineTo(px, py);
    }
    x.stroke();
  }
  speckle(x, 512, 512, rng, 5200, ['#55504a', '#7d776c', '#8a8478', '#3f3b36'], 3);
  return tex(c, 6, 4);
}

function paintContainer(base, label, rng) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  // Corrugated ribs: vertical light/shadow pairs.
  for (let px = 0; px < 256; px += 16) {
    x.fillStyle = 'rgba(255,255,255,0.10)';
    x.fillRect(px, 0, 3, 256);
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.fillRect(px + 8, 0, 5, 256);
  }
  // Rust streaks running down from the top edge.
  for (let i = 0; i < 22; i++) {
    const px = rng.next() * 256;
    const len = rng.range(30, 200);
    const w = rng.range(2, 7);
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(122,58,24,0.55)');
    g.addColorStop(1, 'rgba(122,58,24,0)');
    x.fillStyle = g;
    x.fillRect(px, 0, w, len);
  }
  // Bottom grime.
  const g2 = x.createLinearGradient(0, 200, 0, 256);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(20,12,8,0.5)');
  x.fillStyle = g2;
  x.fillRect(0, 200, 256, 56);
  // Stencil label.
  x.fillStyle = 'rgba(240,235,220,0.85)';
  x.font = 'bold 26px monospace';
  x.textAlign = 'center';
  x.fillText(label, 128, 128);
  x.font = '16px monospace';
  x.fillText('SABLE LINE', 128, 152);
  speckle(x, 256, 256, rng, 900, ['#000000', '#ffffff'], 2);
  return tex(c, 2, 1);
}

function paintCrate(rng) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#8a6a42';
  x.fillRect(0, 0, 256, 256);
  // Horizontal planks.
  for (let py = 0; py < 256; py += 42) {
    x.fillStyle = py % 84 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)';
    x.fillRect(0, py, 256, 4);
    x.strokeStyle = 'rgba(40,26,12,0.5)';
    x.lineWidth = 2;
    x.strokeRect(2, py + 2, 252, 40);
  }
  // Grain.
  x.strokeStyle = 'rgba(60,40,18,0.35)';
  x.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const py = rng.next() * 256;
    x.beginPath();
    x.moveTo(0, py);
    x.bezierCurveTo(80, py + rng.range(-4, 4), 170, py + rng.range(-4, 4), 256, py);
    x.stroke();
  }
  // Corner nails.
  x.fillStyle = '#2a2a2a';
  for (const [px, py] of [[14, 14], [242, 14], [14, 242], [242, 242]]) {
    x.beginPath(); x.arc(px, py, 4, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = 'rgba(240,235,220,0.8)';
  x.font = 'bold 22px monospace';
  x.textAlign = 'center';
  x.fillText('FRAGILE', 128, 134);
  return tex(c);
}

function paintBarrel(base, label, rng) {
  const c = canvas(128, 256);
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 128, 256);
  // Rolled hoops.
  x.fillStyle = 'rgba(0,0,0,0.3)';
  x.fillRect(0, 52, 128, 8);
  x.fillRect(0, 196, 128, 8);
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.fillRect(0, 48, 128, 4);
  x.fillRect(0, 192, 128, 4);
  // Rust drips.
  for (let i = 0; i < 10; i++) {
    const px = rng.next() * 128;
    x.fillStyle = 'rgba(110,52,20,0.5)';
    x.fillRect(px, rng.next() * 60, rng.range(2, 5), rng.range(20, 90));
  }
  // Label band.
  x.fillStyle = 'rgba(240,235,220,0.9)';
  x.fillRect(14, 96, 100, 56);
  x.fillStyle = '#222';
  x.font = 'bold 15px monospace';
  x.textAlign = 'center';
  x.fillText(label, 64, 118);
  x.font = '11px monospace';
  x.fillText('SABLE YARD', 64, 138);
  return tex(c);
}

function paintHazard() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#e8b81e';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#161616';
  for (let i = -128; i < 256; i += 32) {
    x.beginPath();
    x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 + 128, 128); x.lineTo(i + 128, 128);
    x.closePath(); x.fill();
  }
  return tex(c);
}

function paintSiteLetter(letter, color) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  // Hazard ring.
  x.strokeStyle = color;
  x.lineWidth = 10;
  x.setLineDash([26, 14]);
  x.strokeRect(14, 14, 228, 228);
  x.setLineDash([]);
  // Big painted letter, slightly worn.
  x.fillStyle = color;
  x.font = 'bold 170px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(letter, 128, 138);
  x.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 260; i++) {
    x.fillRect(40 + Math.random() * 176, 40 + Math.random() * 176, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function paintFence() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(200,208,216,0.85)';
  x.lineWidth = 2;
  for (let i = -128; i < 256; i += 16) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke();
    x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}

function paintSky() {
  const c = canvas(16, 512);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#241a44');
  g.addColorStop(0.42, '#5e2f56');
  g.addColorStop(0.68, '#b34a3a');
  g.addColorStop(0.85, '#e07b39');
  g.addColorStop(1, '#f2a45a');
  x.fillStyle = g;
  x.fillRect(0, 0, 16, 512);
  // A few early stars high up.
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 12; i++) {
    x.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 120), 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function paintWindows(rng) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#241a33';
  x.fillRect(0, 0, 256, 256);
  for (let gy = 0; gy < 16; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      if (rng.chance(0.42)) {
        x.fillStyle = rng.chance(0.75) ? '#ffd27a' : '#9fd8ff';
        x.globalAlpha = rng.range(0.5, 1);
        x.fillRect(gx * 16 + 4, gy * 16 + 4, 8, 10);
      }
    }
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function paintScorch() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(12,10,8,0.85)');
  g.addColorStop(0.6, 'rgba(20,14,10,0.45)');
  g.addColorStop(1, 'rgba(20,14,10,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Build every texture once and hand the set back.
export function makeTextures() {
  const rng = new Rng(77);
  return {
    concrete: paintConcrete(rng),
    containerRed: paintContainer('#9e3b2e', 'SBL-01', rng),
    containerOlive: paintContainer('#6b6f3a', 'SBL-02', rng),
    containerBlue: paintContainer('#3d5a78', 'SBL-03', rng),
    containerTeal: paintContainer('#2e7a72', 'SBL-04', rng),
    crate: paintCrate(rng),
    barrelYellow: paintBarrel('#c79a2e', 'FUEL', rng),
    barrelGrey: paintBarrel('#5a6068', 'OIL', rng),
    hazard: paintHazard(),
    siteA: paintSiteLetter('A', '#ffc94a'),
    siteB: paintSiteLetter('B', '#59d8ff'),
    fence: paintFence(),
    sky: paintSky(),
    windows: paintWindows(rng),
    scorch: paintScorch(),
  };
}
