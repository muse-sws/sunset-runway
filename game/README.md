# Sunset Runway — an original 2D flight game

A complete, original flight game that runs in a desktop browser from
static files only. No network requests, no external libraries, no copied
art, names or sounds — everything is drawn on a canvas and synthesised
with the Web Audio API at run time.

## How to play

Open `index.html` from any static file server, for example:

```
python3 -m http.server 8080
```

then open the served page in a desktop browser and click **Take Off**.

## Controls

| Input | Action |
| --- | --- |
| Up / Down arrows | Climb / descend (pitch) |
| Left / Right arrows or A / D | Bank and turn |
| W / S | Throttle up / down |
| Mouse move | Steer (left/right = turn, up/down = pitch) |
| Mouse click (hold) | Boost |
| Space | Level the wings |
| P | Pause |
| R | Restart |
| M | Sound on / off |

## Missions — three sorties in one flight

1. **Ring Run** — fly through 5 rings at mid-altitude. Gentle banks
   win: hard turns bleed speed and burn fuel.
2. **River Run** — follow the river low, through 4 low rings. The
   mountains are tall here; stay above 400 ft or climb around them.
3. **Final Approach** — line up on Sunset Field runway 09, slow below
   150 kt, descend under 200 ft, and touch down on the centreline.

## Fuel and damage

Fuel drains faster at high throttle and while boosting; gliding burns
almost nothing. Hitting a mountain costs 35% hull and throws you up
and slow. At 100% damage the aircraft is lost. Landing slow, low and
lined up scores 500 plus a fuel bonus; a missed ring costs no hull,
only points.

## What changed in this version

- **HUD layout:** the top bar is now two rows tall. Instruments sit on
  row 1; the compass strip sits alone on row 2, so the throttle value
  can no longer overlap a compass label. The mission line moved below
  the bar.
- **Rings:** smaller and thinner (about 225 px across at closest,
  down from about 320 px), with a smaller dark hub, so they read as
  rings ahead without hiding the terrain or the next ring.

## Files — one clear job each

- `index.html` — page shell and the start overlay
- `app.css` — page shell styling only
- `app.js` — game loop, input, state and wiring
- `physics.js` — how the aircraft moves (throttle, bank, pitch, fuel)
- `terrain.js` — the valley: sky, mountains, fields, river, runway
- `missions.js` — the three stages, the rings and the landing verdict
- `aircraft.js` — drawing the aircraft and the target rings
- `hud.js` — instruments, messages and end screens
- `audio.js` — original synthesised sound (engine, chime, thud, fanfare)
