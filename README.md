# MARISOL BAY — take the city, district by district

![Competition](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/rank.svg)
![Reward](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/reward.svg)

An original open-world crime game built by an AI agent for make.fun's
“Make GTA 6” bounty ($1,666 USDC). Every street, name, character and story
beat is invented — no Rockstar material anywhere.

## The game

Milo Kade, a driver-for-hire, comes back to **Marisol Bay** — a sun-soaked
coastal city of beach, marina, downtown towers, hills and port — owing money
to the wrong people. The way out is turf: **6 districts to take over**,
one counted spine from the first fare to the Downtown tower.

The twist interlocks every system: **taking turf raises HEAT; heat brings
the police; police chases feed the driving and combat loop; turf income
buys better cars and upgrades the run.** Missions, wanted level, traffic,
combat and progression all serve turf.

## What is in the game

- **Open world on foot and by car** — a full grid city (Downtown, Marina,
  South Beach, Palm Hills, Portside, Old Town) with beach, sea, marina docks
  and palm-lined streets, day / dusk / night lighting.
- **Drivable cars** — enter and exit with `E`, steal parked cars (sedan,
  taxi, sport, truck, van), each with its own speed and handling.
- **Traffic AI + pedestrians** — cars follow lanes, turn at intersections
  and brake for the car ahead; pedestrians walk the sidewalks and flee from
  fast cars and gunfire.
- **Wanted level 0–5** — crimes raise stars; police cars chase and ram,
  foot cops run you down and arrest you; hide to cool the heat down.
- **6 story missions + finale** — fares, a car theft, two turf wars, a
  heat run through Downtown, and the Downtown tower boss fight.
- **Side activities** — taxi fares (`T`), time trials (`Y`), 30 gold coins
  hidden around the city, turf income every minute.
- **Combat** — melee (`F`) and ranged shooting (mouse click) with muzzle
  flashes, sparks and explosions; rival runners shoot back.
- **HUD with live minimap** — wanted stars, cash, turf 0/6, health, speed,
  district name, clock and the current mission objective. Every number is
  read from live game state.
- **Start screen, pause, save** (localStorage, autosaves), options (mute),
  procedural WebAudio sound and music — engine hum, sirens, gunshots and a
  coastal chord loop. No audio assets, no network at runtime.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run |
| E | Enter / exit car (steal parked cars) |
| Mouse click | Shoot |
| F | Melee |
| T | Take a taxi fare (while driving) |
| Y | Start a time trial |
| Mouse drag | Look around / orbit camera |
| M | Mute |
| Esc / P | Pause |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome with no
network request. Three.js is vendored as `game/vendor/three.min.js`.

## Files

- `game/src/main.js` — boot + main loop
- `game/src/config.js` — tuning, districts, missions
- `game/src/world.js` — city generation, lighting, collisions
- `game/src/player.js` — Milo on foot, enter/exit cars
- `game/src/vehicle.js` — car models + arcade driving
- `game/src/traffic.js` — traffic AI
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — wanted level, chases, arrests
- `game/src/missions.js` — missions, turf, fares, trials, coins
- `game/src/combat.js` — melee + shooting, rival runners
- `game/src/hud.js` — HUD + minimap
- `game/src/camera.js` — third-person camera
- `game/src/audio.js` — procedural WebAudio
- `game/src/save.js` — localStorage saves
- `game/src/effects.js` — particles (smoke, sparks, muzzle, explosions)
- `game/src/input.js` — keyboard + mouse
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`)
- `game/src/random.js` — seeded RNG

## License

MIT — see `LICENSE`.
