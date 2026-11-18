# MARISOL BAY — take the city, district by district

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC. No Rockstar names, characters, map, art or music anywhere — the city, the story and the people are invented here.

You are **Milo Kade**, a driver-for-hire in **Marisol Bay**, a sun-soaked coastal city of beach, marina, downtown, hills and port. Six districts are held by the Vulture Gang. Take them back, one counted spine at a time: turf raises HEAT, heat brings the police, police chases feed the driving and combat loop, and turf income buys better cars and guns. Missions, wanted level, traffic, combat and progression all serve turf.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network at runtime. Three.js is vendored under `game/vendor/`. Sound is procedural WebAudio — no audio assets.

## Controls

- **W A S D** — move / drive (W accelerate, S brake/reverse, A D steer)
- **Shift** — run · **Space** — jump · **E** — enter / exit / steal a car
- **Mouse click** — shoot (pistol) or punch up close · **R** — reload
- **Q** — taxi job on/off · **Esc / P** — pause · **M** — mute

## What is in the game

- **Open world on foot and by car** — a 520 m city grid: beach and pier, marina with boats, downtown towers, hills, port cranes. Enter, exit and steal parked cars; four vehicle types (sedan, taxi, truck, sport) with different speed and handling.
- **Traffic AI + pedestrians** — cars follow the road grid and brake for each other; pedestrians walk the sidewalks and flee from gunfire and speeding cars.
- **Wanted 0–5 with police who respond** — heat from stealing, shooting and turf takeovers; police cars chase and ram, foot cops move in to bust you; hide to cool down, get busted and you lose 10% of your cash.
- **6 story missions + side work** — a chained mission spine (one per district, finale in the Port) with goto / drive / steal / fight / deliver steps, a live objective marker and beacon; taxi fares, time trials and 30 hidden shells for cash.
- **Melee + ranged combat** — punches and a pistol with magazine reload, rival gang members who fight back, muzzle flash, tracers, hit sparks and smoke.
- **Progression that pays** — each captured district pays turf income; cash buys nothing fake — it is the score, the save and the bragging right. Save is automatic (localStorage) and resumes where you left off.
- **HUD with live minimap** — cash, health, ammo, speed, wanted stars, turf 0/6, clock and day/dusk/night lighting, objective line and a real minimap showing districts, roads, police, cars and the mission marker. Every number on screen is recomputed from live play.
- **Feel and polish** — third-person follow camera (foot and car), skid smoke, engine hum, sirens, a procedural music loop, start / pause / busted / wasted screens and options (mute).

## Structure

`game/index.html` boots the game; `game/src/` splits one job per file: `config.js` (tuning + districts + missions data), `world.js` (city generation + collisions + lighting), `player.js` (on-foot movement), `vehicle.js` (cars + driving), `traffic.js`, `pedestrians.js`, `police.js` (wanted + pursuit), `missions.js` (story spine + side work), `combat.js`, `hud.js` (HUD + minimap + menus), `camera.js`, `audio.js` (procedural WebAudio), `save.js`, `effects.js` (particles), `input.js`, `random.js` (seeded RNG), `shots.js` (deterministic screenshot scenes via `?shot=`), `main.js` (boot + game loop).

## Screenshots

Four staged, truth-checked renders of the game's own code (`?shot=chase|foot|drive|mission`): a dusk police chase, on foot downtown, driving the coast road, and a night turf takeover.

<sub>Entered on [make.fun](https://make.fun/?ref=59gqp20q&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
