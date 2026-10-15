/**
 * Startup: load the art, build the 3D table, run the title screen, then play.
 * The engine (src/core) knows nothing about the screen; `gameView` below connects it to the 3D table and the HUD.
 */
import { loadAssets } from './assets';
import { THEME } from './assets/theme';
import { AIController } from './core/ai';
import { Engine, type GameView } from './core/engine';
import { allocateSeats, fmt } from './core/rules';
import type { Player } from './core/types';
import { PREBUILT_PARTIES } from './data/parties';
import { L } from './i18n';
import { BoardScene } from './render/BoardScene';
import './styles/main.css';
import { freeLook } from './ui/freeLook';
import { Hud } from './ui/hud/Hud';
import { HumanController } from './ui/HumanController';
import { runSetup } from './ui/setup';

async function main() {
  await loadAssets(); // replacement art from public/assets, if any
  const board = new BoardScene(document.getElementById('scene')!);
  board.controls.autoRotate = true; // attract mode behind the title screen
  board.start();
  if (import.meta.env.DEV) Object.assign(window, { __board: board });

  showDemoParliament(board);
  const setups = await runSetup({ freeLook: () => freeLook(board) });

  const hud = new Hud();
  board.onHover = (i, x, y) => hud.tooltip(i, x, y);
  hud.onToggleCamera = () => (board.cinematic = !board.cinematic);
  hud.armWheel = () => board.armWheel();
  hud.disarmWheel = () => board.disarmWheel();

  const controllers = setups.map((s) => (s.isAI ? new AIController(1300) : new HumanController(hud)));
  // The view reads the engine lazily: the engine is created with the view.
  const engine: Engine = new Engine(
    setups,
    controllers,
    gameView(board, hud, () => engine),
  );
  board.setPlayers(engine.players);
  hud.attach(engine);
  if (import.meta.env.DEV) Object.assign(window, { __coalition: { board, engine, hud } });
  await engine.run();
}

/** How each engine event is shown: on the 3D table, in the HUD, or both. */
function gameView(board: BoardScene, hud: Hud, engine: () => Engine): GameView {
  const players = () => engine().players;
  return {
    refresh: () => hud.refresh(),
    log: (html, tone) => hud.log(html, tone),
    setActive: (id) => {
      // The camera holds still while "NOW PLAYING" shows; it moves when the wheel or the pawn does.
      board.setActive(id);
      hud.setNow(id);
      hud.refresh();
    },
    spin: (result) => board.spin(result),
    drawCard: (deck, id, face) => board.drawCard(deck, id, face),
    dealOpening: async (perPlayer) => {
      await board.dealCards(
        'law',
        players().map((p) => p.id),
        perPlayer,
      );
      for (const p of players()) if (!p.isAI) await hud.showOpeningHand(p.id);
    },
    movePawn: (id, from, steps) => board.movePawn(id, from, steps),
    flashTile: (i) => board.flashTile(i),
    banner: (title, text, tone) => hud.banner(title, text, tone),
    story: (s) => hud.story(s),
    turnStart: (id) => hud.turnStart(id),
    seatsChanged: () => {
      board.updateSeats(players());
      board.updatePodium(
        engine()
          .standings()
          .map((p) => ({ party: p.party, wins: p.stats.electionWins })),
      );
      board.focusParliament();
      hud.refresh();
    },
    pmTakesSeat: (id) => board.pmTakesSeat(id, players()),
    oppositionForms: (leaderId, ids) => board.oppositionForms(leaderId, ids, players()),
    spotlight: (id) => board.focusPawn(id, 'medium'),
    popChanged: (id, delta) => board.floatText(id, fmt(delta), delta > 0 ? THEME.good : THEME.bad),
    electionNight: (result) => hud.electionNight(result),
    voteReaction: (r) =>
      board.reactVote(
        r.happy,
        r.sad,
        r.outcome === 'passed' ? L('✔ BILL PASSED', '✔ PROJETO APROVADO') : L('✖ BILL VETOED', '✖ PROJETO VETADO'),
        r.outcome === 'passed' ? THEME.good : THEME.bad,
      ),
    floorCross: (from, to, n) => board.floorCross(from, to, n, players()[to].party.color),
    gameOver: (result) => {
      board.celebrate();
      hud.gameOver(result);
    },
  };
}

/** Behind the title screen: a parliament of the prebuilt parties, so the chamber isn't empty. */
function showDemoParliament(board: BoardScene): void {
  const seats = allocateSeats(PREBUILT_PARTIES.map((_, i) => 6 - i * 0.6));
  const demo: Player[] = PREBUILT_PARTIES.map((party, id) => ({
    id,
    party,
    isAI: true,
    position: 0,
    waiting: false,
    popularity: 30,
    capital: 0,
    seats: seats[id],
    hand: [],
    portfolios: [],
    isPM: id === 0,
    inGov: id <= 2,
    stats: { pmYears: 0, cabinetYears: 0, billsPassed: 0, billsIntroduced: 0, electionWins: 0 },
  }));
  board.updateSeats(demo);
  board.seatLeaders(demo);
  board.updatePodium(demo.map((p) => ({ party: p.party, wins: 0 })));
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${String(err?.stack ?? err)}</pre>`);
});
