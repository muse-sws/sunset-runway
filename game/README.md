# Pacific Strike — Atomic Bomb Run, 1945

An original 3D flight game built with Three.js, vendored locally as `three.min.js` — no CDN, no network needed at runtime. You pilot a B-29 Superfortress on a 1945 mission across the Pacific to Japan.

## The mission

1. **Long Flight** — Cross the ocean, through clouds and past the coastline, all the way to the Japanese coast.
2. **Dogfight** — Enemy fighters intercept you on the way in. Shoot them down with your machine guns (click or F).
3. **Bomb Run** — Line up the bomb sight over the red ring on the target city and press B to drop the atomic bomb, then watch the mushroom cloud rise.

## Controls

- Arrow keys / WASD — climb, descend, bank, and turn
- W / S — throttle
- Mouse — steer
- Click-hold or F — fire machine guns
- B — drop the bomb (bomb run only)
- Space — level wings
- P — pause
- R — restart
- M — mute

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in desktop Chrome.

## Screenshots

Each mission moment can be staged for a screenshot with a query parameter:

- `?shot=ocean` — the long flight over the ocean
- `?shot=dogfight` — the dogfight
- `?shot=bombrun` — the bomb run
- `?shot=explosion` — the mushroom cloud
