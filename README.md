# COALITION

*The Great Game about Political Machines and Democracy*: a turn-based 3D political strategy board game for 3–6 players (human hotseat and/or AI bots), built with Three.js, Vite and TypeScript.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173, pick 3–6 parties (prebuilt or custom), choose Human/AI for each seat and start the campaign.

| Script              | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Dev server with hot reload         |
| `npm run build`     | Typecheck and build to `dist/`     |
| `npm run preview`   | Serve the production build locally |
| `npm run typecheck` | Typecheck only                     |

## How it plays

- **Board**: a 50-square ring that climbs like a spiral staircase from square 1 up to the Parliamentary Election at the summit; one lap is one year, and the match lasts 5 years. A roulette wheel (1–10) moves your pawn.
- **Presentation**: a cinematic camera cuts between the wheel, the moving pawn, scandal targets and the parliament. Drag to look around; the director resumes after a few seconds, or switch to 🎥 Free cam. AI decisions appear in a bar showing their options and the one they pick. Popularity changes float above pawns, headlines slide in on the right, and parties are ranked #1… by popularity.
- **Squares**: 12 Legislature, 12 Media, 8 Crisis, 8 Lobby, 6 Committee, plus four anchors: Election (0), Government Formation (1), Midterm Convention (25) and National Debate (37).
- **Currencies**: Popularity (becomes seats) and ⭐ Political Capital, earned from lobbies, cabinet posts and passing laws, and spent on rallies, vetoes, whips, investigations and crisis fixes.
- **Elections**: parties stop at the Election square and wait; when the last one arrives, the election is held. The 150 seats are split in proportion to popularity (largest remainder). 76 seats alone wins the game outright.
- **Government formation**: the largest party gets the mandate and offers cabinet portfolios (Economy, Information, Environment, Interior) plus optional ⭐ capital to build a 76-seat coalition. If it fails, the mandate passes on. If nobody succeeds, the largest party forms a minority government.
- **Legislature**: playing a bill is mandatory. Aligned bills give +5 to +15 popularity; misaligned ones cause a −5 to −15 backlash. Parties vote by ideology, and coalition partners back the PM. Whip cards or ⭐ capital force votes. Opponents can spend ⭐ capital to veto.
- **Defense layers** against crises and scandals: ideological shield → reaction cards → spending ⭐ capital → cabinet privileges.
- **Victory**: 76+ seats alone in any election wins instantly; otherwise the party that won the most elections (most seats each year) after 5 years wins, with the Governance Score (PM years ×15, cabinet years ×6, laws passed ×8, plus final seats) as the tiebreak. Popularity resets to 30 after each election, and bills only win popularity if they become law.

Rules that the design doc left open, and how this build resolves them:

- Party MPs vote automatically by ideology.
- Popularity saturates: gains shrink and losses grow as approval rises.
- After each election, popularity cools 30% toward 35.
- A drifting **Public Mood** gives up to ±3 popularity at elections and decides National Debates.

## Code layout

```
src/core/      Pure game logic (no rendering)
  types.ts       Shared types: axes, parties, cards, players, prompts
  rules.ts       Constants and math: alignment, seat allocation, popularity scaling
  parties.ts     The five prebuilt parties
  board.ts       The 50-square layout and square descriptions
  cards.ts       Policy bills, scandals, rallies, whips, reactions
  events.ts      Global midterm crises, local crises, lobby groups
  engine.ts      Turn loop, square resolution, elections, coalitions, scoring
  ai.ts          Bot controller
src/render/    Three.js scene: board, roulette wheel, pawns, parliament hemicycle
src/ui/        HTML overlay (HUD, prompts, setup screen) and the human controller
```

The engine never touches the DOM. It asks a `Controller` to make every decision through a `Prompt`, where each option carries an `ai` score from the chooser's perspective, and it talks to the presentation layer only through the `GameView` interface. Bots pick the best-scoring option, and humans pick through the UI.

In dev builds, `window.__coalition` exposes `{ board, engine, hud }` for debugging.
