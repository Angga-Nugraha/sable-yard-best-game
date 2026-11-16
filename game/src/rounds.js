// SABLE YARD — rounds and economy. A match is a series of rounds: a
// 15-second buy phase, then up to 100 seconds of live play. Vanguard wins a
// round by eliminating the Wardens or by planting the beacon and letting its
// 35-second fuse run out. Wardens win by eliminating Vanguard, by defusing a
// planted beacon, or by surviving the timer. First to 4 round wins takes the
// match (at most 7 rounds). Money carries between rounds; kills and round
// wins pay.
import { START_MONEY, KILL_REWARD, ROUND_WIN_REWARD, ROUND_LOSS_REWARD } from './weapons.js';

export const BUY_TIME = 15;
export const ROUND_TIME = 100;
export const FUSE_TIME = 35;
export const PLANT_TIME = 3;
export const DEFUSE_TIME = 4;
export const END_TIME = 6;
export const WIN_ROUNDS = 4;
export const MAX_ROUNDS = 7;

export class Match {
  constructor() {
    this.state = {
      phase: 'title', // title | buy | live | end | matchEnd
      phaseTime: 0,
      round: 1,
      score: { vanguard: 0, warden: 0 },
      money: START_MONEY,
      kills: 0,
      beacon: { state: 'carried', site: null, fuse: 0, plantProgress: 0 },
      lastResult: null, // {winner, reason}
      matchWinner: null,
    };
    this.onRoundEnd = null;
    this.onMatchEnd = null;
  }
  newMatch() {
    this.state.score = { vanguard: 0, warden: 0 };
    this.state.round = 1;
    this.state.money = START_MONEY;
    this.state.kills = 0;
    this.state.matchWinner = null;
    this.state.lastResult = null;
    this.state.beacon = { state: 'carried', site: null, fuse: 0, plantProgress: 0 };
  }
  // The harness calls startRound() bare; the game binds its context once.
  attach(ctx) {
    this._ctx = ctx;
  }
  // Reset the board for a round: fresh buy phase, rig back to the pistol.
  startRound(ctx = this._ctx) {
    ctx.bots.reset();
    ctx.player.respawn(ctx.world.spawnVanguard.x, ctx.world.spawnVanguard.z, 0);
    ctx.rig.reset();
    for (const g of ctx.grenades) g.scene.remove(g.mesh);
    ctx.grenades.length = 0;
    this.state.beacon = { state: 'carried', site: null, fuse: 0, plantProgress: 0 };
    this.state.phase = 'buy';
    this.state.phaseTime = BUY_TIME;
    this.state.lastResult = null;
    ctx.hud.clearBanner();
    ctx.hud.hideOverlay();
    ctx.hud.showBuy(false);
  }
  startLive() {
    if (this.state.phase !== 'buy') return;
    this.state.phase = 'live';
    this.state.phaseTime = ROUND_TIME;
  }
  plantBeacon(site) {
    const b = this.state.beacon;
    b.state = 'planted';
    b.site = site;
    b.fuse = FUSE_TIME;
    b.plantProgress = 0;
  }
  defuseBeacon(bot) {
    const b = this.state.beacon;
    if (b.state !== 'planted') return;
    b.state = 'defused';
    b.fuse = 0;
    this.endRound('warden', `Beacon defused by a Warden`, bot);
  }
  endRound(winner, reason, byBot = null) {
    if (this.state.phase === 'end' || this.state.phase === 'matchEnd') return;
    this.state.score[winner] += 1;
    this.state.lastResult = { winner, reason, byBot: byBot ? byBot.tierName : null };
    this.state.phase = 'end';
    this.state.phaseTime = END_TIME;
    // Payday: winners take more.
    if (winner === 'vanguard') this.state.money += ROUND_WIN_REWARD;
    else this.state.money += ROUND_LOSS_REWARD;
    if (this.onRoundEnd) this.onRoundEnd(winner, reason);
    if (this.state.score[winner] >= WIN_ROUNDS || this.state.round >= MAX_ROUNDS) {
      this.state.matchWinner = this.state.score.vanguard > this.state.score.warden ? 'vanguard'
        : this.state.score.warden > this.state.score.vanguard ? 'warden' : 'draw';
    }
  }
  addKillReward() {
    this.state.kills += 1;
    this.state.money += KILL_REWARD;
  }
  update(dt, ctx) {
    const s = this.state;
    if (s.phase === 'buy') {
      s.phaseTime -= dt;
      if (s.phaseTime <= 0) this.startLive();
      return;
    }
    if (s.phase === 'live') {
      s.phaseTime -= dt;
      // Planted beacon fuse.
      if (s.beacon.state === 'planted') {
        s.beacon.fuse -= dt;
        if (s.beacon.fuse <= 0) {
          this.endRound('vanguard', 'Beacon detonated — Site destroyed');
          return;
        }
      }
      // Elimination checks.
      const vanguardAlive = ctx.bots.aliveCount('vanguard') + (ctx.player.alive ? 1 : 0);
      const wardenAlive = ctx.bots.aliveCount('warden');
      if (wardenAlive === 0) {
        this.endRound('vanguard', 'All Wardens eliminated');
        return;
      }
      if (vanguardAlive === 0) {
        this.endRound('warden', 'All Vanguard eliminated');
        return;
      }
      if (s.phaseTime <= 0) {
        this.endRound('warden', 'Time expired — Wardens hold the yard');
      }
      return;
    }
    if (s.phase === 'end') {
      s.phaseTime -= dt;
      if (s.phaseTime <= 0) {
        if (s.matchWinner) {
          s.phase = 'matchEnd';
          if (this.onMatchEnd) this.onMatchEnd(s.matchWinner);
        } else {
          s.round += 1;
          this.startRound(ctx);
        }
      }
    }
  }
}
