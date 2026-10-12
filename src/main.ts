import './style.css';
import { AIController } from './core/ai';
import { BOARD, SQUARE_META } from './core/board';
import { Engine, type GameView } from './core/engine';
import { L } from './core/i18n';
import { PREBUILT_PARTIES } from './core/parties';
import { allocateSeats, fmt } from './core/rules';
import type { Player } from './core/types';
import { BoardScene } from './render/BoardScene';
import { Hud } from './ui/hud';
import { HumanController } from './ui/HumanController';
import { runSetup } from './ui/setup';

async function main() {
  const board = new BoardScene(document.getElementById('scene')!);
  board.controls.autoRotate = true; // attract mode behind the setup screen
  board.start();
  if (import.meta.env.DEV) Object.assign(window, { __board: board });

  showDemoParliament(board);
  const setups = await runSetup({ freeLook: () => freeLook(board) });
  const hud = new Hud();
  board.onHover = (i, x, y) => hud.tooltip(i, x, y);
  hud.onToggleCamera = () => (board.cinematic = !board.cinematic);
  hud.armWheel = () => board.armWheel();
  hud.disarmWheel = () => board.disarmWheel();

  let engine: Engine;
  const view: GameView = {
    refresh: () => hud.refresh(),
    log: (html, tone) => hud.log(html, tone),
    setActive: (id) => {
      // The camera holds still while "NOW PLAYING" shows; it moves when the wheel or the pawn does.
      board.setActive(id);
      hud.setNow(id);
      hud.refresh();
    },
    spin: (r) => board.spin(r),
    drawCard: (deck, id, face) => board.drawCard(deck, id, face),
    dealOpening: async (n) => {
      await board.dealCards('law', engine.players.map((p) => p.id), n);
      for (const p of engine.players) if (!p.isAI) await hud.showOpeningHand(p.id);
    },
    movePawn: (id, from, steps) => board.movePawn(id, from, steps),
    flashTile: (i) => board.flashTile(i),
    banner: (title, text, tone) => hud.banner(title, text, tone),
    story: (s) => hud.story(s),
    turnStart: (id) => hud.turnStart(id),
    seatsChanged: () => {
      board.updateSeats(engine.players);
      board.updatePodium(engine.standings().map((p) => ({ party: p.party, wins: p.stats.electionWins })));
      board.focusParliament();
      hud.refresh();
    },
    pmTakesSeat: (id) => board.pmTakesSeat(id, engine.players),
    oppositionForms: (leaderId, ids) => board.oppositionForms(leaderId, ids, engine.players),
    spotlight: (id) => board.focusPawn(id, 'medium'),
    popChanged: (id, delta) => board.floatText(id, fmt(delta), delta > 0 ? 0x4cd185 : 0xff6b6b),
    electionNight: (r) => hud.electionNight(r),
    voteReaction: (r) => board.reactVote(r.happy, r.sad, r.outcome === 'passed' ? L('✔ BILL PASSED', '✔ PROJETO APROVADO') : L('✖ BILL VETOED', '✖ PROJETO VETADO'), r.outcome === 'passed' ? 0x4cd185 : 0xff6b6b),
    floorCross: (from, to, n) => board.floorCross(from, to, n, engine.players[to].party.color),
    gameOver: (r) => {
      board.celebrate();
      hud.gameOver(r);
    },
  };

  const controllers = setups.map((s) => (s.isAI ? new AIController(1300) : new HumanController(hud)));
  engine = new Engine(setups, controllers, view);
  board.setPlayers(engine.players);
  hud.attach(engine);
  if (import.meta.env.DEV) Object.assign(window, { __coalition: { board, engine, hud } });
  await engine.run();
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${String(err?.stack ?? err)}</pre>`);
});

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

/** Free look from the main menu: orbit the board freely; hover squares for details. Resolves on "Back". */
function freeLook(board: BoardScene): Promise<void> {
  const host = document.getElementById('freelook')!;
  host.innerHTML = `<div class="flbar">
      <button id="flback">◀ ${L('Back to menu', 'Voltar ao menu')}</button>
      <span class="fltitle">👁️ ${L('Free Look', 'Explorar o Tabuleiro')}</span>
      <span class="flhint">${L('Drag to rotate · right-drag to pan · scroll to zoom · hover a square for details', 'Arraste para girar · botão direito para mover · role para zoom · passe o mouse numa casa para detalhes')}</span>
      <label class="flspin"><input type="checkbox" id="flrot" /> ${L('Auto-rotate', 'Girar sozinho')}</label>
    </div>
    <div id="fltip" class="hidden"></div>`;
  host.classList.remove('hidden');
  board.controls.autoRotate = false;
  const tip = document.getElementById('fltip')!;
  board.onHover = (i, x, y) => {
    if (i === null) return tip.classList.add('hidden');
    const meta = SQUARE_META[BOARD[i]];
    tip.innerHTML = `<div class="tt">${meta.icon} ${i} · ${meta.name}</div><div>${meta.desc}</div>`;
    tip.style.left = `${Math.min(x + 16, window.innerWidth - 300)}px`;
    tip.style.top = `${Math.min(y + 16, window.innerHeight - 140)}px`;
    tip.classList.remove('hidden');
  };
  (document.getElementById('flrot') as HTMLInputElement).addEventListener('change', (e) => {
    board.controls.autoRotate = (e.target as HTMLInputElement).checked;
  });
  return new Promise((resolve) => {
    document.getElementById('flback')!.addEventListener('click', () => {
      board.onHover = undefined;
      board.controls.autoRotate = true;
      host.classList.add('hidden');
      host.innerHTML = '';
      resolve();
    });
  });
}
