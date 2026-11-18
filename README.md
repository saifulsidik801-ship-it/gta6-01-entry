# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

MARISOL BAY — take the city, district by district. Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, no install.

## The game

Milo Kade, driver-for-hire, has one summer to take Marisol Bay: a sun-soaked
coastal city of six districts, one crew in each. Steal cars, run taxi fares,
win beach time trials, collect 30 golden shells — and watch the heat, because
taking turf brings the police, and the police bring the chase.

- **Open world:** a full city grid with downtown towers, a sand beach and
  turquoise water, a marina with boats, northern hills, parks and palms.
- **On foot and by car:** third-person movement, six vehicle types to steal
  or drive (sedan, taxi, sport, truck, van, patrol), arcade handling with
  skids and crashes.
- **Living streets:** traffic AI that cruises the grid and honks at jaywalkers,
  26 pedestrians who scatter when shots are fired.
- **Wanted 0–5:** police cars that ram and foot cops that grab you, escalating
  with the stars; heat cools when you stay out of sight.
- **Story spine:** 6 turf missions + a finale, each with its own crew to clear
  and a 5-second hold to claim the district. Turf pays income every minute.
- **Side play:** taxi fares with a 90-second clock, beach time trials through
  5 gates, 30 collectible golden shells.
- **Garage:** spend turf income on a Sport, Truck or Van (press B), plus
  repairs and a $500 bribe that wipes the wanted level.
- **Combat:** melee punches with knockback, a pistol with ammo and paid reloads.
- **Presentation:** HUD with live minimap, wanted stars, cash, turf chips and
  mission objective; day → dusk → night lighting; procedural WebAudio engine,
  sirens, gunshots and a sunset bassline; particle smoke, sparks, muzzle flash
  and cash sparkles; start screen, pause menu, options, localStorage saves.

## Controls

WASD move · Shift run · E enter/exit car · F punch · Q pistol · Click/Space shoot ·
R reload ($50) · M next mission · T taxi fare · Esc pause · drag mouse to look.

## Tech

Three.js (vendored, minified, offline) + plain ES modules. No dependencies at
runtime, no network calls. Source is split one job per file under `game/src/`:
`config`, `world`, `player`, `vehicle`, `traffic`, `pedestrians`, `police`,
`missions`, `combat`, `hud`, `camera`, `audio`, `save`, `effects`, `input`,
`shots`, `main`. Screenshots are real renders of the game via `?shot=` scenes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=59gqp20q&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
