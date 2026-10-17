/** The general election at the end of each year: popularity becomes seats, then a new year begins. */
import { L } from '../../i18n';
import { runElection } from '../electoral';
import * as R from '../rules';
import { AXIS_INFO, AXIS_KEYS, type Player } from '../types';
import type { Engine } from './Engine';
import { coalitionVerdict, formGovernment } from './government';
import { and, pn, the } from './text';
import type { ElectionResult } from './view';

export async function election(game: Engine, trigger: Player): Promise<void> {
  game.onElection?.('parliamentary');
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
  await legislativeMvp(game);
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
  await game.view.podiumWin(yearWinner.id, 'parliamentary');
  for (const q of game.players) game.gainCapital(q, 3 + Math.floor(q.seats / 25));
  game.view.refresh();
  const summary = [...game.players]
    .sort((a, b) => b.seats - a.seats)
    .map((q) => `${pn(q)} <b>${q.seats}</b>`)
    .join(' · ');
  game.view.log(
    L(
      `Election results, Year ${game.electionsHeld}: ${summary}. ${pn(yearWinner)} wins the election (${R.points(yearWinner.stats)} points so far).`,
      `Resultado da eleição, Ano ${game.electionsHeld}: ${summary}. ${pn(yearWinner)} vence a eleição (${R.points(yearWinner.stats)} pontos até agora).`,
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
        'Five years have passed. The party with the most points (Congress and presidency) takes the game.',
        'Cinco anos se passaram. O partido com mais pontos (Congresso e presidência) leva o jogo.',
      ),
      'event',
    );
    return game.finish('prestige');
  }

  // The new government is formed on this election's results; only then does the new year start.
  await formGovernment(game);

  // A fresh year: popularity, ⭐ capital and hands reset so each election is decided by that year's politics.
  for (const k of AXIS_KEYS)
    game.mood[k] = Math.round(R.clamp(game.mood[k] + (Math.random() - 0.5) * 0.8, 1, 4) * 10) / 10;
  const swing = moodSwing(game);
  for (const q of game.players) {
    q.popularity = R.START_POPULARITY;
    q.capital = R.START_CAPITAL;
    game.vetoesUsed.delete(q.id);
    for (const c of [...q.hand]) game.removeCard(q, c);
  }
  game.view.refresh();
  await game.view.story({
    headline: L('Today, a new political year began.', 'Hoje começou um novo ano político.'),
    meaning: L(
      `Every party's popularity resets to <b>${R.START_POPULARITY}</b> and its ⭐ capital to <b>${R.START_CAPITAL}</b>. Old hands are discarded and everyone is dealt <b>${R.START_HAND}</b> new bills, so next year's election is decided by what happens from now on. Seats, laws passed and points carry over. The public mood has shifted too${swing ? `, drifting away from the new government's ideas (${swing})` : ''}.`,
      `A popularidade de todos os partidos volta para <b>${R.START_POPULARITY}</b> e o ⭐ capital para <b>${R.START_CAPITAL}</b>. As mãos antigas vão para o descarte e todos recebem <b>${R.START_HAND}</b> novos projetos, então a próxima eleição será decidida pelo que acontecer daqui em diante. Cadeiras, leis aprovadas e pontos continuam valendo. O humor do eleitorado também mudou${swing ? `, afastando-se das ideias do novo governo (${swing})` : ''}.`,
    ),
    tone: 'info',
  });
  await game.dealHands(game.year);
  yearStartPerks(game);
  await coalitionVerdict(game);
  game.view.log(L(`<b>Year ${game.year} begins.</b>`, `<b>Começa o Ano ${game.year}.</b>`), 'turn');
}

/**
 * Voters drift away from whoever governs: every axis of the Public Mood moves MOOD_SWING away from the Leader of
 * Congress's position (where it isn't already on it). Governing wears a party out by the next election.
 * Returns a short description of the shift ('' if nothing moved).
 */
export function moodSwing(game: Engine): string {
  const pm = game.pm();
  if (!pm) return '';
  const moved: string[] = [];
  for (const k of AXIS_KEYS) {
    const gap = pm.party.axes[k] - game.mood[k];
    if (Math.abs(gap) < 0.05) continue;
    const before = game.mood[k];
    game.mood[k] = Math.round(R.clamp(before - Math.sign(gap) * R.MOOD_SWING, 1, 4) * 10) / 10;
    if (game.mood[k] !== before) moved.push(`${AXIS_INFO[k].name} ${game.mood[k] < before ? '←' : '→'}`);
  }
  game.view.refresh();
  return moved.join(', ');
}

/**
 * Legislative MVP, before every parliamentary election: the party with the most new laws this year that match its
 * ideas (whoever introduced them) scores a point. Ties: the one those laws are worth most to; still tied, all.
 */
async function legislativeMvp(game: Engine): Promise<void> {
  const laws = game.lawsThisYear;
  game.lawsThisYear = [];
  if (!laws.length) return;
  const scores = game.players.map((q) => {
    const aligned = laws.filter((c) => R.axisDistance(q.party.axes, c.target!) <= 1);
    return { q, count: aligned.length, worth: aligned.reduce((s, c) => s + R.billDelta(q.party.axes, c.target!), 0) };
  });
  const top = Math.max(...scores.map((s) => s.count));
  if (top === 0) return;
  const contenders = scores.filter((s) => s.count === top);
  const bestWorth = Math.max(...contenders.map((s) => s.worth));
  const winners = contenders.filter((s) => s.worth === bestWorth).map((s) => s.q);
  for (const w of winners) w.stats.mvps++;
  game.view.refresh();
  const names = and(winners.map(the));
  game.view.log(
    L(
      `📜 Legislative MVP of Year ${game.electionsHeld}: ${winners.map(pn).join(', ')}.`,
      `📜 MVP legislativo do Ano ${game.electionsHeld}: ${winners.map(pn).join(', ')}.`,
    ),
    'gov',
  );
  await game.view.story({
    actorId: winners[0].id,
    headline: L(
      `Today, ${names} ${winners.length > 1 ? 'were' : 'was'} named Legislative MVP of the year.`,
      `Hoje, ${names} ${winners.length > 1 ? 'foram eleitos' : 'foi eleito'} MVP legislativo do ano.`,
    ),
    meaning: L(
      `<b>${top}</b> of the year's ${laws.length} new laws match ${winners.length > 1 ? 'their' : 'its'} ideas, more than any other party's, whoever introduced them. That is worth a <b>point</b>.`,
      `<b>${top}</b> das ${laws.length} leis novas do ano combinam com as ideias ${winners.length > 1 ? 'deles' : 'do partido'}, mais do que as de qualquer outro partido, não importa quem as apresentou. Isso vale um <b>ponto</b>.`,
    ),
    tone: 'good',
  });
  for (const w of winners) await game.view.podiumWin(w.id, 'legislative');
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
