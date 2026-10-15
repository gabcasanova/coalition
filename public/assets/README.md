# Replaceable art

Every visual in the game has a placeholder drawn in code. To use real art instead:

1. Put the file in this folder (any sub-folder you like, e.g. `tiles/legislature.png`).
2. In `manifest.json`, replace the `null` next to the slot with the file's path, relative to this folder:

   ```json
   "tile.legislature": "tiles/legislature.png"
   ```

3. Reload the game. A slot left as `null`, or a file that fails to load, keeps the placeholder (a warning
   appears in the browser console).

The code that reads this file is `src/assets/index.ts`.

## Images

PNG, JPG or WebP. Sizes are the canvas sizes of the placeholders; other sizes are scaled to fit (covering the
area and cropping the overflow), so keep the same proportions.

| Slot                                                                   | What it is                                    | Size          | Notes                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `tile.election`, `tile.formation`, `tile.midterm`, `tile.debate`        | Top face of the four fixed squares            | 256 × 378     | The top edge of the image faces the centre of the table. The square's number is still drawn in the top-left corner. |
| `tile.legislature`, `tile.media`, `tile.crisis`, `tile.lobby`, `tile.committee` | Top face of the regular squares       | 256 × 378     | Same as above.                                                                                                     |
| `deck.law`, `deck.media`, `deck.strategy`, `deck.lobby`, `deck.crisis`, `deck.global` | Back of each deck of cards       | 360 × 504     | Also used for the cards flying out of the deck.                                                                    |
| `wheel`                                                                | Face of the roulette wheel                    | 1024 × 1024   | Keep the numbers where the placeholder has them: number *k* is centred at angle (k − 0.5) × 36°, clockwise from 3 o'clock. |
| `table.wood`                                                           | Wood of the table                             | any, tileable | Repeated 4 × 4 times.                                                                                              |
| `table.felt`                                                           | Green felt of the table top                   | any, tileable | Repeated 6 × 6 times.                                                                                              |
| `portrait.leader`                                                      | The Prime Minister's bust in the portrait     | 512 × 600     | Transparent PNG: it is drawn over the sunburst in the party's colour; the party badge goes in the bottom-left corner. |

## Party emblems

`emblems` maps a prebuilt party's `key` (see `src/data/parties.ts`) to a square image, ideally a transparent
PNG of 256 × 256. It replaces the party's emoji on the pawns, the podium and the portrait badge. Custom parties
made on the setup screen always use the emoji chosen there.

## 3D models

glTF binary files (`.glb`). Every model stands with its feet at y = 0 and faces +z.

| Slot     | What it is                          | Height (world units) | Notes                                                                                     |
| -------- | ----------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `pawn`   | A party's pawn on the board         | about 1.35           | Materials named `party` take the party colour; the emblem tag still floats above it.     |
| `mp`     | One MP on the benches (×150)        | about 0.73           | All meshes are merged into one shape and coloured per party (the model's materials are ignored). |
| `leader` | The Prime Minister and the Leader of the Opposition | about 1.6 | Materials named `party` take the party colour.                                            |

## Everything else

- **Colours and fonts of the 3D table**: `src/assets/theme.ts`.
- **Interface colours**: the CSS variables at the top of `src/styles/base.css`.
- **Names, icons and colours of squares, parties, cards and events**: the files in `src/data/` (Portuguese text in
  `src/i18n/pt-BR.ts`).
