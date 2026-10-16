/** The general election at the end of each year: popularity becomes seats, then a new year begins. */
import { L } from '../../i18n';
import { runElection } from '../electoral';
import * as R from '../rules';
import { AXIS_KEYS, type Player } from '../types';
import type { Engine } from './Engine';
import { formGovernment } from './government';
import { pn } from './text';
import type { ElectionResult } from './view';

export async function election(game: Engine, trigger: Player): Promise<void> {
  for (const q of game.players) {
    if (q.isPM) q.stats.pmYears++;
    else if (q.inGov) q.stats.cabinetYears++;
  }
  game.electionsHeld++;
  game.view.log(
    L(
      `<b>🗳️ General Election — end of Year ${game.electionsHeld}</b>, triggered by ${pn(trigger)}.`,
      `<b>🗳️ Eleição Geral — fim do Ano ${game.electionsHeld}</b>, convocada por ${pn(trigger)}.`,
    ),
    'event',
  );
  await game.view.banner(
    L(`🗳️ General Election — Year ${game.electionsHeld}`, `🗳️ Eleição Geral — Ano ${game.electionsHeld}`),
    L(
      `${trigger.party.name} completes the year. The nation goes to the polls!`,
      `${trigger.party.name} completa o ano. O país vai às urnas!`,
    ),
    'event',
  );

  // Last-minute swing toward parties close to the public mood.
  const mood = new Map<Player, number>();
  for (const q of game.players) {
    const b = R.clamp(Math.round(3 - 2 * R.partyDistance(q.party.axes, game.mood)), -3, 3);
    mood.set(q, b ? game.gainPop(q, b) : 0);
  }

  // Seats are won district by district (see core/electoral.ts).
  const before = game.players.map((q) => q.seats);
  const vote = runElection(game.players.map((q) => ({ axes: q.party.axes, popularity: q.popularity })));
  game.players.forEach((q, i) => (q.seats = vote.seats[i]));
  const yearWinner = [...game.players].sort(
    (a, b) => b.seats - a.seats || b.popularity - a.popularity || a.id - b.id,
  )[0];
  yearWinner.stats.electionWins++;
  const result: ElectionResult = {
    year: game.electionsHeld,
    final: game.electionsHeld >= R.YEARS,
    winnerId: yearWinner.id,
    districts: vote.districts,
    rows: game.players.map((q, i) => ({
      playerId: q.id,
      popularity: q.popularity,
      share: vote.voteShare[i],
      seatsBefore: before[i],
      seatsAfter: q.seats,
      moodBonus: mood.get(q) ?? 0,
    })),
  };
  await game.view.electionNight(result);
  game.view.seatsChanged();
  for (const q of game.players) game.gainCapital(q, 3 + Math.floor(q.seats / 25));
  game.view.refresh();
  const summary = [...game.players]
    .sort((a, b) => b.seats - a.seats)
    .map((q) => `${pn(q)} <b>${q.seats}</b>`)
    .join(' · ');
  game.view.log(
    L(
      `Election results, Year ${game.electionsHeld}: ${summary}. ${pn(yearWinner)} wins the election (${yearWinner.stats.electionWins} so far).`,
      `Resultado da eleição, Ano ${game.electionsHeld}: ${summary}. ${pn(yearWinner)} vence a eleição (${yearWinner.stats.electionWins} até agora).`,
    ),
    'event',
  );

  const winner = game.players.find((q) => q.seats >= R.MAJORITY);
  if (winner) {
    await game.view.banner(
      L('ABSOLUTE MAJORITY!', 'MAIORIA ABSOLUTA!'),
      L(
        `${winner.party.name} wins ${winner.seats} seats and governs alone.`,
        `${winner.party.name} conquista ${winner.seats} cadeiras e governa sozinho.`,
      ),
      'good',
    );
    return game.finish('majority', winner);
  }
  if (game.electionsHeld >= R.YEARS) {
    await game.view.banner(
      L('The Final Election', 'A Eleição Final'),
      L(
        'Five years have passed. The party that won the most elections takes the game.',
        'Cinco anos se passaram. O partido que venceu mais eleições leva o jogo.',
      ),
      'event',
    );
    return game.finish('prestige');
  }

  // The new government is formed on this election's results; only then does the new year start.
  await formGovernment(game);

  // A fresh year: everyone's popularity resets so each election is decided by that year's politics.
  for (const k of AXIS_KEYS)
    game.mood[k] = Math.round(R.clamp(game.mood[k] + (Math.random() - 0.5) * 0.8, 1, 4) * 10) / 10;
  for (const q of game.players) q.popularity = R.START_POPULARITY;
  game.view.refresh();
  await game.view.story({
    headline: L('Today, a new political year began.', 'Hoje começou um novo ano político.'),
    meaning: L(
      `Every party's popularity resets to <b>${R.START_POPULARITY}</b>, so next year's election is decided by what happens from now on. Seats, laws passed, ⭐ capital and election wins carry over. The public mood has shifted too.`,
      `A popularidade de todos os partidos volta para <b>${R.START_POPULARITY}</b>, então a próxima eleição será decidida pelo que acontecer daqui em diante. Cadeiras, leis aprovadas, ⭐ capital e vitórias eleitorais continuam valendo. O humor do eleitorado também mudou.`,
    ),
    tone: 'info',
  });
  yearStartPerks(game);
  game.view.log(L(`<b>Year ${game.year} begins.</b>`, `<b>Começa o Ano ${game.year}.</b>`), 'turn');
}

export function yearStartPerks(game: Engine): void {
  for (const q of game.players) {
    if (q.portfolios.includes('information') && game.draw(q, 1).length) {
      game.view.log(
        L(
          `${pn(q)} draws an extra card (Minister of Information).`,
          `${pn(q)} compra uma carta extra (Ministério da Comunicação).`,
        ),
        'gov',
      );
    }
    if (q.portfolios.includes('economy')) {
      const g = game.gainCapital(q, 2);
      game.view.log(
        L(
          `${pn(q)} receives a ${g} ⭐ ministry budget (Minister of Economy).`,
          `${pn(q)} recebe um orçamento de ${g} ⭐ (Ministério da Economia).`,
        ),
        'gov',
      );
    }
  }
  game.view.refresh();
}
