# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

MARISOL BAY — an original open-world driving game. Milo Kade came to Marisol Bay with a busted sedan and a debt. Six crews own six districts. Steal cars, run fares, dodge the MBPD, and take the turf — one street war at a time — until the whole Bay is yours. Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game runs fully offline, no network at runtime.

## How to play

- **WASD / Arrows** — walk and drive (Shift to run, Space to brake)
- **E** — enter / exit a car (stealing one in front of the MBPD raises your wanted level)
- **F** — punch · **Click / Space on foot** — shoot the pistol
- **P / Esc** — pause: pick a story mission, visit Rico's garage, call your car

## What's inside

- **A living city**: 1200×1200 grid of Downtown, Palm Row, Marina, Portside, Coral Hills and the Boardwalk — beach, marina docks, port containers, hills, palms, streetlights, day/dusk/night lighting.
- **Turf spine**: 6 story missions plus a finale, one district each. Taking turf raises HEAT, heat brings the MBPD, and police chases feed the driving loop. Turf pays income every minute.
- **Systems**: on-foot and driving movement, stealable cars (sedan, taxi, sports car, truck, coupe), traffic AI that stops for you, sidewalk pedestrians who flee gunfire, a 0–5 star wanted ladder with chasing cruisers and foot cops who can bust you, melee + pistol combat, enemy crews in turf wars, taxi fares, time trials, 30 hidden packages, a garage with buyable cars and engine/armor/grip upgrades, procedural WebAudio (engine, sirens, radio bassline), particles, minimap HUD, and localStorage saves.
- **Screenshots**: 4 real renders staged through `?shot=1..4` — a dusk police chase (cover), on-foot Downtown, a stolen taxi at speed, and a night turf war at the Marina.

## Tech

Three.js (vendored minified build under `game/vendor/`), plain ES modules, no build step, no network at runtime. Source is split one job per file under `game/src/` — world, player, vehicle, traffic, pedestrians, police, missions, combat, hud, camera, audio, save, effects, input, garage, shots — booted by `main.js`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=59gqp20q&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
