// SABLE YARD — the HUD: health, armour, ammo, money, round score, timer,
// phase, kill feed, crosshair with hitmarker, weapon slots, the buy menu and
// the title / round-end / match-end overlays. All DOM, updated every frame.
import { WEAPONS, SHOP, VEST } from './weapons.js';
import { css, PAL } from './palette.js';

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {};
    for (const id of ['health', 'armor', 'ammo-mag', 'ammo-reserve', 'money', 'score',
      'timer', 'phase', 'killfeed', 'crosshair', 'hitmarker', 'slots', 'buy-menu',
      'buy-rows', 'buy-money', 'overlay', 'banner', 'banner-sub', 'plant-wrap',
      'plant-fill', 'plant-label', 'beacon', 'hint']) {
      this.el[id] = document.getElementById(id);
    }
    this._buildSlots();
    this._buildBuyRows();
    this._hitTimer = null;
    this._bannerTimer = null;
  }
  _buildSlots() {
    const wrap = this.el.slots;
    wrap.innerHTML = '';
    for (const w of Object.values(WEAPONS)) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.id = `slot-${w.id}`;
      d.dataset.id = w.id;
      d.innerHTML = `<span class="slot-key">${w.slot}</span><span class="slot-name">${w.name}</span><span class="slot-ammo"></span>`;
      d.addEventListener('click', () => this.cb.onSelect(w.id));
      wrap.appendChild(d);
    }
  }
  _buildBuyRows() {
    const wrap = this.el['buy-rows'];
    wrap.innerHTML = '';
    for (const item of SHOP) {
      const d = document.createElement('div');
      d.className = 'buy-row';
      d.dataset.id = item.id;
      const price = item.price === 0 ? 'OWNED' : `$${item.price}`;
      d.innerHTML = `<span class="buy-name">${item.name}</span><span class="buy-blurb">${item.blurb}</span><span class="buy-price">${price}</span>`;
      d.addEventListener('click', () => this.cb.onBuy(item.id));
      wrap.appendChild(d);
    }
  }
  showBuy(show) {
    this.el['buy-menu'].classList.toggle('hidden', !show);
    if (show) this.refreshBuy();
  }
  isBuyOpen() {
    return !this.el['buy-menu'].classList.contains('hidden');
  }
  setMoney(n) {
    this.el.money.textContent = `$${n}`;
    this.el['buy-money'].textContent = `$${n}`;
  }
  refreshBuy() {
    // Mark rows the player cannot afford or already owns.
    const money = parseInt(this.el.money.textContent.replace(/[^0-9]/g, '') || '0', 10);
    for (const row of this.el['buy-rows'].querySelectorAll('.buy-row')) {
      const id = row.dataset.id;
      const item = SHOP.find((s) => s.id === id);
      row.classList.toggle('poor', item.price > money && item.price > 0);
    }
    void money;
  }
  addKill(killer, victim, headshot) {
    const feed = this.el.killfeed;
    const d = document.createElement('div');
    d.className = 'feed-line';
    d.innerHTML = `<span class="feed-killer">${killer}</span> <span class="feed-mid">${headshot ? '◎' : '—'}</span> <span class="feed-victim">${victim}</span>`;
    feed.prepend(d);
    while (feed.children.length > 5) feed.removeChild(feed.lastChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 6000);
  }
  flashHitmarker(kill) {
    const h = this.el.hitmarker;
    h.classList.add('pop');
    h.classList.toggle('kill', !!kill);
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => h.classList.remove('pop', 'kill'), 160);
  }
  banner(text, sub = '') {
    this.el.banner.textContent = text;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.remove('hidden');
    this.el['banner-sub'].classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.clearBanner(), 4200);
  }
  clearBanner() {
    this.el.banner.classList.add('hidden');
    this.el['banner-sub'].classList.add('hidden');
  }
  clearFeed() {
    this.el.killfeed.innerHTML = '';
  }
  setPlant(label, frac) {
    if (label === null) {
      this.el['plant-wrap'].classList.add('hidden');
      return;
    }
    this.el['plant-wrap'].classList.remove('hidden');
    this.el['plant-label'].textContent = label;
    this.el['plant-fill'].style.width = `${Math.round(frac * 100)}%`;
  }
  hideOverlay() {
    this.el.overlay.classList.add('hidden');
  }
  showTitle() {
    const o = this.el.overlay;
    o.classList.remove('hidden');
    o.innerHTML = `
      <div class="panel title-panel">
        <div class="title-kicker">TACTICAL ROUND FPS — FIRST TO 4</div>
        <h1>SABLE YARD</h1>
        <p class="title-sub">Vanguard vs Wardens in a dusk freight yard. Plant the beacon, or wipe the other team out.</p>
        <div class="controls-grid">
          <div><b>WASD</b> move</div><div><b>Mouse</b> aim</div>
          <div><b>Click</b> shoot</div><div><b>R</b> reload</div>
          <div><b>1–6</b> weapons</div><div><b>B</b> buy menu</div>
          <div><b>E</b> plant / defuse</div><div><b>G</b> throw grenade</div>
        </div>
        <button id="start-btn" class="big-btn">▶ &nbsp;DEPLOY — CLICK TO PLAY</button>
        <p class="title-foot">Buy phase 15 s · Round 100 s · Beacon fuse 35 s · Headshots ×2.5</p>
      </div>`;
    document.getElementById('start-btn').addEventListener('click', () => this.cb.onStart());
  }
  showRoundEnd(result, score) {
    const o = this.el.overlay;
    o.classList.remove('hidden');
    const win = result.winner === 'vanguard';
    o.innerHTML = `
      <div class="panel end-panel">
        <div class="end-kicker ${win ? 'good' : 'bad'}">${win ? 'VANGUARD TAKES THE ROUND' : 'WARDENS TAKE THE ROUND'}</div>
        <div class="end-reason">${result.reason}</div>
        <div class="end-score">VANGUARD <b>${score.vanguard}</b> — <b>${score.warden}</b> WARDENS</div>
        <p class="title-foot">Next round starting…</p>
      </div>`;
  }
  showMatchEnd(winner, score) {
    const o = this.el.overlay;
    o.classList.remove('hidden');
    const text = winner === 'vanguard' ? 'VANGUARD WINS THE MATCH'
      : winner === 'warden' ? 'WARDENS WIN THE MATCH' : 'DRAW — THE YARD KEEPS ITS SECRETS';
    o.innerHTML = `
      <div class="panel end-panel">
        <div class="end-kicker ${winner === 'vanguard' ? 'good' : 'bad'}">${text}</div>
        <div class="end-score big">VANGUARD <b>${score.vanguard}</b> — <b>${score.warden}</b> WARDENS</div>
        <p class="title-sub">First to 4 rounds. The yard resets — same dusk, same stakes.</p>
        <button id="restart-btn" class="big-btn">↻ &nbsp;PLAY AGAIN</button>
      </div>`;
    document.getElementById('restart-btn').addEventListener('click', () => this.cb.onRestart());
  }
  // Full refresh from live game state; called every rendered frame and
  // synchronously after buys and selects so the HUD never lags a click.
  update(match, player, rig) {
    const s = match.state;
    this.el.health.textContent = `${Math.max(0, Math.ceil(player.hp))}`;
    this.el.health.classList.toggle('low', player.hp <= 30);
    this.el.armor.textContent = `${Math.max(0, Math.ceil(player.armor))}`;
    const w = rig.weapon();
    const a = rig.state.ammo[w.id];
    this.el['ammo-mag'].textContent = w.throwable ? `${a.mag}` : `${a.mag}`;
    this.el['ammo-reserve'].textContent = w.throwable ? '—' : `${a.reserve}`;
    this.setMoney(s.money);
    this.el.score.textContent = `VANGUARD ${s.score.vanguard} — ${s.score.warden} WARDENS`;
    const t = Math.max(0, Math.ceil(s.phaseTime));
    this.el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const phaseName = { title: 'STANDBY', buy: 'BUY PHASE', live: 'LIVE', end: 'ROUND OVER', matchEnd: 'MATCH OVER' }[s.phase] || s.phase.toUpperCase();
    this.el.phase.textContent = `ROUND ${s.round} · ${phaseName}`;
    const beacon = s.beacon;
    if (s.phase === 'title' || s.phase === 'matchEnd') {
      this.el.beacon.classList.add('hidden');
    } else if (beacon.state === 'planted') {
      this.el.beacon.classList.remove('hidden');
      this.el.beacon.textContent = `◉ BEACON LIVE — ${Math.max(0, Math.ceil(beacon.fuse))}s · SITE ${beacon.site}`;
      this.el.beacon.style.color = css(PAL.hudBad);
    } else if (beacon.state === 'carried') {
      this.el.beacon.classList.remove('hidden');
      this.el.beacon.textContent = '◆ YOU CARRY THE BEACON — HOLD E AT A SITE TO PLANT';
      this.el.beacon.style.color = css(PAL.hudGold);
    } else {
      this.el.beacon.classList.add('hidden');
    }
    // Weapon slots: current weapon active, unowned dimmed.
    for (const slot of this.el.slots.querySelectorAll('.slot')) {
      const id = slot.dataset.id;
      slot.classList.toggle('active', id === rig.state.current);
      slot.classList.toggle('unowned', !rig.state.owned.has(id));
      const ammoEl = slot.querySelector('.slot-ammo');
      if (ammoEl) {
        const wa = rig.state.ammo[id];
        ammoEl.textContent = id === 'grenade' ? `×${wa.mag}` : `${wa.mag} / ${wa.reserve}`;
      }
    }
    // Crosshair hidden while an overlay or the buy menu is up.
    const overlayUp = !this.el.overlay.classList.contains('hidden');
    this.el.crosshair.classList.toggle('hidden', overlayUp);
    this.el.hint.classList.toggle('hidden', overlayUp || s.phase === 'title');
    if (this.isBuyOpen()) this.refreshBuy();
  }
}
