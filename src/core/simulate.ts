/**
 * Headless simulations: whole games played by instant bots with no screen at all, to see how the rules play
 * out over many games (who wins, who gets the presidency, who forms governments…). Used by the debug menu.
 * Each game shuffles the turn order; the game yields to the browser between games so the page stays responsive.
 */
import { AIController } from './ai';
import { Engine, type GameView } from './engine';
import * as R from './rules';
import type { PartyDef, Player } from './types';

/** Totals for one party over all the simulated games. */
export interface PartyStats {
  party: PartyDef;
  /** Games won, and how many of them with an outright majority. */
  wins: number;
  majorityWins: number;
  /** Parliamentary elections won (most seats that year). */
  electionWins: number;
  presidencies: number;
  /** Years as Legislative MVP. */
  mvps: number;
  /** Governments formed as Leader of Congress, and how many of those were minority governments. */
  governments: number;
  minorityGovernments: number;
  yearsLeadingCongress: number;
  yearsInCabinet: number;
  timesLeadingOpposition: number;
  timesInOpposition: number;
  /** Sums over every parliamentary election, for averages. */
  seatsSum: number;
  shareSum: number;
  popularitySum: number;
  elections: number;
  billsPassed: number;
  billsIntroduced: number;
  vetoesUsed: number;
  superCrises: number;
  /** MPs lost to and won from floor crossings. */
  seatsLostToDefections: number;
  seatsWonFromDefections: number;
}

export interface SimulationReport {
  games: number;
  parties: PartyStats[];
  /** Games that ended with an outright majority (the rest went the full five years). */
  majorityEndings: number;
  parliamentaryElections: number;
  presidentialElections: number;
  /** Parliamentary elections won by the party that held the presidency at the time. */
  presidentAlsoWonParliament: number;
  governmentsFormed: number;
  minorityGovernments: number;
  /** Governments brought down mid-year (votes of no confidence). */
  governmentsFallen: number;
  /** Biggest party seen at any point, in seats. */
  largestParty: number;
  /** Real time the simulation took, in ms. */
  ms: number;
}

/** Waits for the next task, so the page can redraw (unlike setTimeout, not slowed down in background tabs). */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

const emptyStats = (party: PartyDef): PartyStats => ({
  party,
  wins: 0,
  majorityWins: 0,
  electionWins: 0,
  presidencies: 0,
  mvps: 0,
  governments: 0,
  minorityGovernments: 0,
  yearsLeadingCongress: 0,
  yearsInCabinet: 0,
  timesLeadingOpposition: 0,
  timesInOpposition: 0,
  seatsSum: 0,
  shareSum: 0,
  popularitySum: 0,
  elections: 0,
  billsPassed: 0,
  billsIntroduced: 0,
  vetoesUsed: 0,
  superCrises: 0,
  seatsLostToDefections: 0,
  seatsWonFromDefections: 0,
});

/**
 * Plays `games` games between `parties`, all bots. `onProgress(done)` is called after each game; return true
 * from `cancelled()` to stop early (the report then covers the games played so far).
 */
export async function simulate(
  parties: PartyDef[],
  games: number,
  onProgress: (done: number) => void = () => {},
  cancelled: () => boolean = () => false,
): Promise<SimulationReport> {
  const start = performance.now();
  const stats = new Map(parties.map((party) => [party, emptyStats(party)]));
  const report: SimulationReport = {
    games: 0,
    parties: [...stats.values()],
    majorityEndings: 0,
    parliamentaryElections: 0,
    presidentialElections: 0,
    presidentAlsoWonParliament: 0,
    governmentsFormed: 0,
    minorityGovernments: 0,
    governmentsFallen: 0,
    largestParty: 0,
    ms: 0,
  };

  for (let g = 0; g < games && !cancelled(); g++) {
    await playOne(R.shuffle([...parties]), stats, report);
    report.games++;
    onProgress(report.games);
    await nextTask(); // let the page breathe between games
  }
  report.ms = performance.now() - start;
  return report;
}

async function playOne(lineup: PartyDef[], stats: Map<PartyDef, PartyStats>, report: SimulationReport) {
  const of = (p: Player) => stats.get(p.party)!;
  let engine: Engine;
  let formations = 0;
  const players = () => engine.players;
  const noop = async () => {};
  const view: GameView = {
    refresh() {},
    log(html) {
      // Super crises are announced in the log ("☢️ Super crisis for <party>").
      if (!html.includes('☢️')) return;
      const hit = players().find((p) => html.includes(p.party.name));
      if (hit) of(hit).superCrises++;
    },
    story: noop,
    dealHands: noop,
    turnStart: noop,
    setActive() {},
    spin: noop,
    drawCard: noop,
    movePawn: noop,
    flashTile() {},
    banner: noop,
    seatsChanged() {
      report.largestParty = Math.max(report.largestParty, ...players().map((p) => p.seats));
    },
    seatsGrow: noop,
    async presidentialNight(result) {
      report.presidentialElections++;
      of(players()[result.winnerId]).presidencies++;
    },
    presidentTakesOffice: noop,
    podiumWin: noop,
    async pmTakesSeat(id) {
      const pm = players()[id];
      const seats = players()
        .filter((p) => p.inGov)
        .reduce((s, p) => s + p.seats, 0);
      formations++;
      report.governmentsFormed++;
      of(pm).governments++;
      if (seats < R.MAJORITY) {
        report.minorityGovernments++;
        of(pm).minorityGovernments++;
      }
    },
    async oppositionForms(leaderId, memberIds) {
      of(players()[leaderId]).timesLeadingOpposition++;
      for (const id of memberIds) of(players()[id]).timesInOpposition++;
    },
    popChanged() {},
    spotlight() {},
    voteReaction: noop,
    async floorCross(fromId, toId, n) {
      of(players()[fromId]).seatsLostToDefections += n;
      of(players()[toId]).seatsWonFromDefections += n;
    },
    async electionNight(result) {
      report.parliamentaryElections++;
      const president = players().find((p) => p.isPresident);
      if (president && president.id === result.winnerId) report.presidentAlsoWonParliament++;
      for (const row of result.rows) {
        const s = of(players()[row.playerId]);
        s.elections++;
        s.seatsSum += row.seatsAfter;
        s.shareSum += row.share;
        s.popularitySum += row.popularity;
      }
      // The year's vetoes, counted before they reset for the new year.
      for (const p of players()) of(p).vetoesUsed += engine.vetoesUsed.get(p.id) ?? 0;
      report.largestParty = Math.max(report.largestParty, ...result.rows.map((r) => r.seatsAfter));
    },
    gameOver() {},
  };
  const setups = lineup.map((party) => ({ party, isAI: true }));
  engine = new Engine(
    setups,
    setups.map(() => new AIController(0)),
    view,
  );
  await engine.run();

  const result = engine.result!;
  if (result.kind === 'majority') report.majorityEndings++;
  const winner = of(result.winner);
  winner.wins++;
  if (result.kind === 'majority') winner.majorityWins++;
  // Every year's government is formed once (the first one at the start, then after each election but the last);
  // any more were formed after a government fell.
  report.governmentsFallen += Math.max(0, formations - engine.electionsHeld);
  for (const p of engine.players) {
    const s = of(p);
    s.electionWins += p.stats.electionWins;
    s.yearsLeadingCongress += p.stats.pmYears;
    s.yearsInCabinet += p.stats.cabinetYears;
    s.billsPassed += p.stats.billsPassed;
    s.mvps += p.stats.mvps;
    s.billsIntroduced += p.stats.billsIntroduced;
  }
}
