# COALITION

_The Great Game about Political Machines and Democracy_: a turn-based 3D political strategy board game for 3–6 players (human hotseat and/or AI bots), built with Three.js, Vite and TypeScript. English and Brazilian Portuguese.

Created by Gabriel Casanova.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173, pick the number of players, then a party (prebuilt or custom) and Human/Computer for each seat, and start the campaign.

| Script                 | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Dev server with hot reload                  |
| `npm run build`        | Typecheck and build to `dist/`              |
| `npm run preview`      | Serve the production build locally          |
| `npm run typecheck`    | Typecheck only                              |
| `npm run format`       | Format the code with Prettier               |
| `npm run format:check` | Check the formatting without changing files |

During a game, **Ctrl+Q** opens a debug menu that fast-forwards the game: bots play every party (yours too), with no pauses and turbo animations, for 1 or 5 rounds or until the next presidential or parliamentary election (it stops as the election begins, so you watch it at normal speed). It can also simulate 100 bot-only games in the background with the current parties and report wins, presidencies, governments formed, elections won, seats, laws, vetoes and more ([src/core/simulate.ts](src/core/simulate.ts)).

## Publishing

Every push to `main` builds the game and publishes it to GitHub Pages at https://gabcasanova.github.io/coalition/ (workflow: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)). The site is served from `/coalition/`, which is set as `base` in `vite.config.ts`; `npm run preview` serves the build the same way, at http://localhost:4173/coalition/.

One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## How it plays

- **Board**: a 50-square ring that climbs like a spiral staircase from square 1 up to the Parliamentary Election at the summit; one lap is one year, and the match lasts 5 years. A roulette wheel (1–10) moves your pawn, and an escalator carries it back down from the Election square at the start of each year.
- **Presentation**: a cinematic camera cuts between the wheel, the moving pawn, the decks and the parliament. Drag to look around; the director resumes after a few seconds, or switch to 🎥 Free cam. Everything that happens is told as a news story in the middle of the screen.
- **Squares**: 16 Legislature, 8 Media, 6 Crisis, 6 Lobby, 5 Committee, 2 Fast Track (move forward 3) and 2 Red Tape (move back 3), plus five anchors: Election (0), Government Formation (1), Midterm Convention (25), Presidential Election (26) and National Debate (37).
- **Currencies**: Popularity (becomes seats) and ⭐ Political Capital, earned from lobbies, cabinet posts and passing laws, and spent on rallies, vetoes, whips, investigations and crisis fixes.
- **Elections**: parties stop at the Election square and wait; when the last one arrives, the election is held. The country has 24 districts electing 2 to 20 MPs each (150 in all), shared out by the D'Hondt method. A party's vote in a district depends on its national popularity and on how well it fits the district's leaning, so seats follow votes only roughly: big parties get a bonus, strongholds pay off and rural votes weigh more. Election night shows the count live on a map of the districts. 76 seats alone wins the game outright.
- **Government formation**: the largest party gets the mandate and offers cabinet portfolios (Economy, Information, Environment, Interior) plus optional ⭐ capital to build a 76-seat coalition. If it fails, the mandate passes on. If nobody succeeds, the largest party forms a minority government. In Year 1 there is no election yet: every party spins the wheel and the first parliament's seats are shared out in proportion to the spins.
- **Ideology counts**: coalition partners back the Leader of Congress's bills further from their own views the closer they are to the Leader (`coalitionLoyalty` in rules.ts), and distant partners pay more popularity to stay loyal (`loyaltyCost`), so they rebel more. At the start of each year (and when a government forms mid-year) voters judge it: each partner gains popularity if close to the Leader and loses it if far (+4 to −6, `coherenceBonus`), and the Leader gets their average.
- **Drafted hands**: every year each party is offered 12 bills (`DRAFT_OFFER`) and keeps 7; the rest go back to the LAW deck.
- **Voters tire of the government**: every year the Public Mood moves `MOOD_SWING` (0.35) away from the Leader of Congress's views on every axis.
- **Leader scrutiny**: the party alone at the top of the popularity ranking gets 25% less from every popularity gain (`LEADER_GAIN_MULT`; a tie for first doesn't count).
- **Opposition and independents**: the largest party outside the government becomes Leader of the Opposition and may invite one more party onto the opposition bench; the rest sit as independents. The opposition draws STRATEGY cards on Cabinet squares, hits the government 3 harder with leaks and can call a vote of no confidence (backed by the independents closer to it than to the Leader of Congress). Independents gain +2 popularity on Cabinet squares instead.
- **Super crises**: a Crisis square draws a super crisis instead of a regular one 8% of the time, or 22% for the two most popular parties. Super crises hit for 9–16 popularity and can't be bought off: no ⭐ capital options, no Bailout card, and reaction cards and ministries can only halve them.
- **Vetoes**: one per party per year; the Leader of Congress and the Leader of the Opposition get two, and the President's party two more. The party panels show each party's vetoes left (🛑).
- **Presidential Election**: the first party to pass square 26 each year sets off the presidential vote. The most popular party at that moment wins the presidency (ties: more seats, then chance), which brings 2 extra vetoes a year until the next presidential election, shown on presidential election night in graphs. The new President flies in by helicopter, climbs down onto the red carpet and takes the throne; their portrait hangs to the right of the Leader of Congress's. Until the first presidential election, the office is held by a Provisional President from no party.
- **Legislature**: playing a bill is mandatory. Bills that become law win their party +5 to +15 popularity if they match its ideology; misaligned bills cause a −5 to −15 backlash either way. Parties vote by ideology, and coalition partners back the Leader of Congress. Whip cards or ⭐ capital force votes. Opponents can spend ⭐ capital to veto.
- **Defense layers** against crises and scandals: ideological shield → reaction cards → spending ⭐ capital → cabinet privileges.
- **Victory**: 76+ seats alone in any election wins instantly; otherwise the party with the most points after 5 years wins (one point per parliamentary election won, i.e. most seats that year, one per presidential election won, and one per year as Legislative MVP: the party with the most new laws matching its ideas that year, whoever introduced them); after each one, the winner celebrates on the standings podium, with the Governance Score (years as Leader of Congress ×15, cabinet years ×6, laws passed ×8, plus final seats) as the tiebreak.

Rules that the design doc left open, and how this build resolves them:

- Party MPs vote automatically by ideology.
- Popularity saturates: gains shrink and losses grow as approval rises.
- Once the new government has formed after each election, every party starts the year afresh: popularity resets to 30, ⭐ capital to 15, and old hands are discarded for a new hand of 7 bills.
- A drifting **Public Mood** gives up to ±3 popularity at elections and decides National Debates.

## Code layout

```
src/
  main.ts            Startup, and the GameView that connects the engine to the 3D table and the HUD
  i18n/              Language: L(english, portuguese), Portuguese articles, and pt-BR.ts with all translated content
  data/              Game content — edit these to change the game's cards, parties and board
    parties.ts         The prebuilt parties
    districts.ts       The 24 electoral districts: seats, political leaning, map position
    squares.ts         Square kinds (names, colours, descriptions) and how many of each the board has
    bills.ts           The LAW deck (policy bills)
    strategyCards.ts   The STRATEGY deck (scandals, rallies, whips, reactions, no confidence)
    crises.ts          Global midterm crises, local crises and super crises
    mediaEvents.ts     The MEDIA deck
    lobbies.ts         The LOBBY deck
  core/              Game rules — no DOM, no 3D
    types.ts           Shared types: axes, parties, cards, players, prompts
    rules.ts           Constants and maths: alignment, seat allocation, popularity scaling
    board.ts           Builds the 50-square board from data/squares.ts
    electoral.ts       Elections: votes per district and D'Hondt seats
    decks.ts           Shuffled decks
    ai.ts              Bot controller
    engine/            The game engine
      Engine.ts          Players, decks, the turn loop and the helpers the rule modules use
      legislature.ts     One module per square or phase of the game: the Legislature square,
      media.ts           the Media square,
      crisis.ts          crises (local, floor crossing, global midterm),
      lobby.ts           the Lobby square,
      committee.ts       the Committee square (leaks, investigations, no confidence),
      debate.ts          the National Debate,
      shortcut.ts        the Fast Track and Red Tape squares,
      defense.ts         absorbing popularity hits,
      election.ts        elections,
      presidency.ts      presidential elections,
      government.ts      forming governments and the opposition
      text.ts            Text of the news stories (party names with articles, card descriptions)
      view.ts            The GameView interface and what the engine sends to it
  assets/            Replaceable art: the loader (index.ts) and the 3D table's colours and fonts (theme.ts)
  render/            The 3D table (Three.js)
    BoardScene.ts      Builds the parts below and runs the frame loop; the only entry point for the rest of the game
    CameraDirector.ts  The cinematic camera
    animation.ts       Tweens and easing
    layout.ts          Sizes and positions of everything on the table
    models.ts          Pawns, MPs and leaders
    parts/             Table, Track (squares + Escalator), Wheel, Decks, Pawns, Chamber, Leaders, Presidency (throne + helicopter), BackWall (portraits + scoreboards), Podium
    textures/          Textures painted in code: board, cards, labels, LED scoreboards, the portraits
  ui/                HTML on top of the 3D table
    setup.ts           Title screen and new-game wizard
    freeLook.ts        Free Look mode
    HumanController.ts Sends human decisions to the HUD
    hud/               The in-game HUD: Hud.ts plus panels, news, prompts, election nights (parliamentary and presidential), game over, rules, history
  styles/            CSS, one file per screen (main.css imports them in order)
public/assets/       Replacement art (see "Replacing the art")
```

The engine never touches the DOM. It asks a `Controller` to make every decision through a `Prompt`, where each option carries an `ai` score from the chooser's perspective, and it talks to the presentation layer only through the `GameView` interface. Bots pick the best-scoring option, and humans pick through the UI. Each rule module is a set of functions that receive the `Engine` (e.g. `legislature(game, player)`), so a square's rules can be read in one place.

In dev builds, `window.__coalition` exposes `{ board, engine, hud }` for debugging.

## Replacing the art

Every visual has a placeholder drawn in code. To use real art, put the files in `public/assets/` and list them in `public/assets/manifest.json`; anything left as `null` keeps its placeholder. Replaceable: the square faces, the deck backs, the roulette wheel, the table's wood and felt, the leaders' portraits, the party emblems, and the 3D models of the pawns, MPs and leaders. Sizes and conventions are in [public/assets/README.md](public/assets/README.md).
