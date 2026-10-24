# Tetris

A single-page Tetris game built with vanilla HTML, CSS, and JavaScript. No build step, no dependencies — just open `index.html` and play.

## Features

- Classic 10×20 board with all 7 tetrominoes (I, O, T, S, Z, J, L)
- **7-bag randomizer** for fair, balanced piece distribution
- Ghost piece showing where the current piece will land
- Next-piece preview
- Scoring: singles, doubles, triples, and tetris (quads), scaled by level
- Soft drop and hard drop bonuses
- Levels speed up every 10 lines cleared
- Pause / resume and game over screen

## Controls

| Key | Action |
|-----|--------|
| ← / → | Move left / right |
| ↑ (or X) | Rotate |
| ↓ | Soft drop |
| Space | Hard drop |
| P | Pause / resume |

## Run it

Open `index.html` in any modern browser, or serve locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Enable GitHub Pages on this repo to play it live at `https://leodevnull.github.io/tetris/`.
