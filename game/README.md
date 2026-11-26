# Pacific Strike — Atomic Bomb Run, 1945

An original 3D flight game built with Three.js (vendored locally as `three.min.js` — no CDN, no network at runtime).

Fly a B-29 Superfortress from the Pacific to Japan:

1. **Long Flight** — cross the ocean, clouds and coastline to the Japanese coast.
2. **Dogfight** — enemy fighters intercept; shoot them down with your machine guns (click or F).
3. **Bomb Run** — line up the bomb sight over the red ring on the target city and press B to drop the atomic bomb. Watch the mushroom cloud rise.

## Controls

- Arrow keys / WASD — climb, descend, bank and turn; W/S throttle
- Mouse — steer; click-hold (or F) — fire machine guns
- B — drop the bomb (bomb run only)
- Space — level wings · P — pause · R — restart · M — mute

## Run it

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in desktop Chrome.

## Screenshots

`?shot=ocean`, `?shot=dogfight`, `?shot=bombrun`, `?shot=explosion` stage each mission moment for screenshots.
