# SABLE YARD

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Angga-Nugraha/sable-yard-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Angga-Nugraha/sable-yard-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A round-based tactical FPS in the browser, built on three.js 0.187.0. Vanguard
attacks two sites in a dusk freight yard; the Wardens hold them. Plant the beacon
or eliminate the other team, earn money, buy better guns, and do it again.

## The game

- **First-person combat** — mouse look, WASD movement with acceleration, crouch,
  jump, collision with the map. Hitscan guns with recoil and spread that punish
  firing on the move; headshots deal 2.5x damage.
- **Two teams, short rounds** — you plus four Vanguard bots against five Warden
  bots. A round ends on elimination, a beacon detonation, a defuse, or the timer.
  First to 4 rounds takes the match (max 7).
- **An objective beyond killing** — hold E inside Site A (Foundry) or Site B
  (Silos) for 3 seconds to plant the beacon; it detonates 35 seconds later unless
  a Warden channels a 4-second defuse.
- **Money and a buy menu** — $800 to start, +$300 per kill, +$325 for a round
  win, +$150 for a loss, +$300 for a plant. Press B during the buy phase: a
  shotgun, an SMG, a full-auto rifle, a DMR, a spark grenade and a plated vest.
- **Bots that play** — they walk waypoint routes to the sites, hold angles,
  react to what they see and hear, strafe and burst-fire with per-bot skill,
  lob grenades at positions they lost sight of, and go for the defuse.
- **HUD** — health, ammunition, round timer, score, money, alive counts, kill
  feed, hitmarkers, a spread-reactive crosshair, and plant/defuse progress.

## Play it

Serve `game/` with any static file server and open `index.html` in desktop
Chrome. No build step, no network requests: every script, texture and sound
is generated or vendored locally (three.js 0.187.0 under `game/vendor/`).

```
node serve.ts   # serves game/ at http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look (click to lock the pointer) |
| Click / Right-click | Fire / Aim down sights |
| R | Reload |
| 1–6 | Weapons & grenade |
| Ctrl / Space | Crouch / Jump |
| E (hold, inside a site) | Plant the beacon |
| B | Buy menu (buy phase) |

## Layout

- `game/index.html` — page, HUD markup and styles, import map for three.js
- `game/src/main.js` — boot, fixed 60 Hz loop, shooting, beacon, round flow
- `game/src/world.js` — the 40×28 m freight yard, sky, lights, waypoint graph
- `game/src/bots.js` — the nine soldiers: AI, skill tiers, character models
- `game/src/combat.js` — hitscan shooting, tracers, impacts, grenades
- `game/src/weapons.js` — five guns, grenade, vest; view models and economy
- `game/src/player.js` — movement: acceleration, friction, jump, crouch
- `game/src/rounds.js` — match state: phases, money, beacon, score
- `game/src/hud.js` — HUD, kill feed, buy menu, banners, overlays
- `game/src/textures.js` — procedural canvas textures (steel, concrete, sky)
- `game/src/audio.js` — synthesised WebAudio sound effects (11 voices)
- `game/src/palette.js` — the dusk palette
- `game/src/rng.js` — seeded deterministic random numbers
- `game/src/input.js` — keyboard and mouse, pointer lock
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json` with `vendor/makefun-game.ts`

## License

MIT — see [LICENSE](LICENSE).
