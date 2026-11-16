# SABLE YARD

![best-game-01](https://make.fun/badge/best-game-01.svg)
![rank](https://make.fun/badge/best-game-01/Angga-Nugraha/sable-yard-best-game/rank.svg)
![reward](https://make.fun/badge/best-game-01/Angga-Nugraha/sable-yard-best-game/reward.svg)

A round-based tactical first-person shooter for one human player plus nine AI soldiers, played in a desktop browser. Entered in the [best-game-01 bounty](https://make.fun/bounty/best-game-01) on make.fun.

## The game

Two teams of five fight over a freight yard at dusk. **Vanguard** (blue — your team) attacks; **Wardens** (teal) defend. A match is a series of rounds on a 40 × 28 m yard of shipping containers, crates, barrels, sandbags, cranes and lamp light under a purple-orange sky.

**Win a round** by eliminating the other team — or, as Vanguard, by planting the beacon at Site A or Site B and letting its 35-second fuse run out. Wardens win by eliminating Vanguard, by defusing a planted beacon, or by surviving the 100-second round timer. **First team to 4 round wins takes the match** (at most 7 rounds).

Between rounds there is a **buy phase**: spend money earned from kills ($150) and round wins ($400) on weapons and gear.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim (click the game to lock the pointer) |
| Left click | Shoot (hitscan, headshots ×2.5) |
| R | Reload |
| 1–6 | Switch weapon (pistol / SMG / rifle / DMR / shotgun / grenade) |
| B | Buy menu |
| E (hold) | Plant the beacon at a site / defuse as a Warden |
| G | Throw a spark grenade |
| Right click | Scope the DMR |

## The arsenal

- **P9 Sidearm** — free, always in your holster (12 rounds)
- **Hornet SMG** — $900, 32 rounds, fast fire, short reach
- **Pike Rifle** — $1,400, 30 rounds, the balanced workhorse
- **Longshot DMR** — $2,300, scoped, 8 rounds, one shot at any range
- **Breacher Shotgun** — $1,100, 8 pellets, devastating up close
- **Spark Grenade** — $300, thrown, area damage
- **Plate Vest** — $650, soaks half of every hit

## The soldiers

Nine AI soldiers in three skill tiers — veteran, regular, rookie — with different aim error, reaction time and burst discipline. They navigate a waypoint graph through the yard, acquire targets after a reaction delay, fire in bursts, fall back when hurt, push the sites as Vanguard and hold them as Wardens. When the beacon is planted, Wardens converge to defuse while Vanguard defends. Bot-vs-bot damage is scaled so rounds last; damage to and from the player is unscaled.

Every soldier is built from simple 3D shapes — helmet dome and brim, goggle band, face mask, plate carrier with a team stripe, pouch, shoulder pads, backpack, jointed limbs with a walk cycle, and a gun assembled from barrel, muzzle, handguard, stock, magazine and sights.

## Presentation

- All textures are generated procedurally on canvas at load: corrugated container steel with rust streaks and stencil labels, stained and cracked concrete, wooden crates, labelled barrels, hazard striping, painted site letters and a gradient dusk sky. No image files.
- All sound is synthesized with WebAudio: a distinct shot voice per weapon plus hits, kills, reload, dry fire, buying, interface clicks, beacon ticks, explosions and round-end stingers. No audio files.
- Lighting is a warm low sun, hemisphere fill and a cool rim from the north, with warm lamp pools, filmic tone mapping and dusk fog. Muzzle flashes, tracers, impact sparks and scorch decals answer every shot.
- The simulation runs a fixed 60 Hz step, decoupled from rendering, driven by a seeded generator so a given seed replays the same way.

## Running it

Serve `game/` with any static file server and open `index.html` in desktop Chrome — no build step, no network requests, three.js vendored locally under `game/vendor/three/`.

## Files

- `game/index.html` — page, HUD DOM, buy menu, import map
- `game/src/main.js` — boot, 60 Hz loop, rounds, shooting, beacon, staging modes
- `game/src/world.js` — the yard, colliders, waypoint graph
- `game/src/bots.js` — soldier models, walk cycle, AI
- `game/src/combat.js` — hitscan, tracers, sparks, grenades, damage
- `game/src/weapons.js` — weapon definitions, shop, player rig
- `game/src/player.js` — movement, camera, health, beacon carrying
- `game/src/rounds.js` — round phases, timer, score, economy
- `game/src/hud.js` — HUD, kill feed, buy menu, overlays
- `game/src/textures.js` — procedural canvas textures
- `game/src/audio.js` — WebAudio synth voices
- `game/src/palette.js` — colours and materials
- `game/src/rng.js` — seeded random generator
- `game/src/input.js` — keyboard, mouse, pointer lock
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to the output dir and writes `dossier.json`

Original game, names, art and sounds — SABLE YARD, Vanguard, Wardens — made for this bounty.
