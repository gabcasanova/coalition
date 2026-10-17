/**
 * The presidential election, held once a year when the first party passes the Presidential Election square in
 * the middle of the board. The most popular party at that moment wins the presidency (ties: the one with more
 * seats, then chance) and with it PRESIDENT_VETOES extra vetoes a year, until the next presidential election.
 * Until the first one, the office is held by a Provisional President who belongs to no party.
 */
import { L } from '../../i18n';
import * as R from '../rules';
import type { Player } from '../types';
import type { Engine } from './Engine';
import { pn, the, The } from './text';
import type { PresidentialResult } from './view';

export async function presidentialElection(game: Engine, trigger: Player): Promise<void> {
  game.onElection?.('presidential');
  const previous = game.players.find((q) => q.isPresident);
  game.view.log(
    L(
      `<b>🎖️ Presidential Election — Year ${game.year}</b>, set off by ${pn(trigger)}.`,
      `<b>🎖️ Eleição Presidencial — Ano ${game.year}</b>, disparada por ${pn(trigger)}.`,
    ),
    'event',
  );
  await game.view.banner(
    L(`🎖️ Presidential Election — Year ${game.year}`, `🎖️ Eleição Presidencial — Ano ${game.year}`),
    L(
      `${trigger.party.name} reaches the middle of the year. The nation chooses its President!`,
      `${trigger.party.name} chega ao meio do ano. O país escolhe seu Presidente!`,
    ),
    'event',
  );

  // The vote follows popularity; the most popular party wins.
  const total = game.players.reduce((s, q) => s + Math.max(q.popularity, 0.5), 0);
  const rows = game.players.map((q) => ({
    playerId: q.id,
    popularity: q.popularity,
    share: (Math.max(q.popularity, 0.5) / total) * 100,
  }));
  const tiebreak = new Map(game.players.map((q) => [q, Math.random()]));
  const winner = [...game.players].sort(
    (a, b) => b.popularity - a.popularity || b.seats - a.seats || tiebreak.get(b)! - tiebreak.get(a)!,
  )[0];
  const result: PresidentialResult = { year: game.year, winnerId: winner.id, previousId: previous?.id ?? -1, rows };
  await game.view.presidentialNight(result);

  for (const q of game.players) q.isPresident = q === winner;
  winner.stats.presidencies++; // a win, like a parliamentary election
  game.view.refresh();
  const share = rows[winner.id].share.toFixed(1);
  const vetoes = game.vetoesLeft(winner);
  if (previous === winner) {
    await game.tell(
      winner,
      L('was re-elected to the presidency', 'foi reeleito para a presidência'),
      L(
        `Still the most popular party in the country, ${the(winner)} keeps the presidency with ${share}% of the vote, and its ${R.PRESIDENT_VETOES} extra vetoes a year: <b>${vetoes}</b> left this year.`,
        `Ainda o partido mais popular do país, ${the(winner)} mantém a presidência com ${share}% dos votos, e seus ${R.PRESIDENT_VETOES} vetos extras por ano: restam <b>${vetoes}</b> neste ano.`,
      ),
      'gov',
    );
    await game.view.podiumWin(winner.id, 'presidential');
    return;
  }
  game.view.log(
    L(`${pn(winner)} wins the presidency (${share}%).`, `${pn(winner)} conquista a presidência (${share}%).`),
    'gov',
  );
  await game.view.presidentTakesOffice(winner.id);
  const before = previous
    ? L(
        ` ${The(previous)} leaves the palace and loses its presidential vetoes.`,
        ` ${The(previous)} deixa o palácio e perde seus vetos presidenciais.`,
      )
    : L(' The Provisional President hands over the office.', ' O Presidente Provisório entrega o cargo.');
  await game.tell(
    winner,
    L('won the presidency', 'conquistou a presidência'),
    L(
      `As the most popular party in the country, ${the(winner)} wins the presidential election with ${share}% of the vote.${before} The new President brings <b>${R.PRESIDENT_VETOES} extra vetoes</b> a year: ${the(winner)} has <b>${vetoes}</b> left this year. The presidency is also worth a <b>point</b>: ${R.points(winner.stats)} so far.`,
      `Como partido mais popular do país, ${the(winner)} vence a eleição presidencial com ${share}% dos votos.${before} O novo Presidente traz <b>${R.PRESIDENT_VETOES} vetos extras</b> por ano: ${the(winner)} tem <b>${vetoes}</b> neste ano. A presidência também vale um <b>ponto</b>: ${R.points(winner.stats)} até agora.`,
    ),
    'gov',
  );
  await game.view.podiumWin(winner.id, 'presidential');
}
