/** The debug menu's simulation report: a window with what happened over many bot-only games. */
import type { PartyStats, SimulationReport } from '../core/simulate';
import { L } from '../i18n';
import { css, emblem } from './hud/html';

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
const avg = (n: number, of: number, digits = 1) => (of ? (n / of).toFixed(digits) : '—');

/** One column of the table: its heading, the number to compare (higher = better) and how to show it. */
interface Column {
  title: string;
  tip: string;
  value: (s: PartyStats) => number;
  show: (s: PartyStats) => string;
  /** Highlight the lowest instead of the highest. */
  lowestIsBest?: boolean;
  /** Not a contest (nothing highlighted). */
  plain?: boolean;
}

export function simReportHTML(r: SimulationReport): string {
  const g = r.games;
  const columns: Column[] = [
    {
      title: L('Wins', 'Vitórias'),
      tip: L('Games won (with an outright majority)', 'Partidas vencidas (com maioria absoluta)'),
      value: (s) => s.wins,
      show: (s) =>
        `<b>${pct(s.wins, g)}</b> <small>${s.wins}${s.majorityWins ? ` · ${s.majorityWins} ${L('maj.', 'maior.')}` : ''}</small>`,
    },
    {
      title: L('Elections won', 'Eleições vencidas'),
      tip: L(
        'Parliamentary elections won (most seats that year), per game',
        'Eleições parlamentares vencidas (mais cadeiras no ano), por partida',
      ),
      value: (s) => s.electionWins,
      show: (s) => `${avg(s.electionWins, g, 2)} <small>${s.electionWins}</small>`,
    },
    {
      title: L('Presidencies', 'Presidências'),
      tip: L('Presidential elections won', 'Eleições presidenciais vencidas'),
      value: (s) => s.presidencies,
      show: (s) => `${s.presidencies} <small>${pct(s.presidencies, r.presidentialElections)}</small>`,
    },
    {
      title: L('Legislative MVP', 'MVP legislativo'),
      tip: L(
        'Years as Legislative MVP (most new laws matching its ideas)',
        'Anos como MVP legislativo (mais leis novas que combinam com suas ideias)',
      ),
      value: (s) => s.mvps,
      show: (s) => String(s.mvps),
    },
    {
      title: L('Governments', 'Governos'),
      tip: L(
        'Governments formed as Leader of Congress (minority governments)',
        'Governos formados como Líder do Congresso (governos de minoria)',
      ),
      value: (s) => s.governments,
      show: (s) =>
        `${s.governments}${s.minorityGovernments ? ` <small>${s.minorityGovernments} ${L('min.', 'min.')}</small>` : ''}`,
    },
    {
      title: L('Years leading', 'Anos liderando'),
      tip: L('Years as Leader of Congress, per game', 'Anos como Líder do Congresso, por partida'),
      value: (s) => s.yearsLeadingCongress,
      show: (s) => avg(s.yearsLeadingCongress, g, 2),
    },
    {
      title: L('Cabinet years', 'Anos no gabinete'),
      tip: L('Years as a coalition partner, per game', 'Anos como parceiro de coalizão, por partida'),
      value: (s) => s.yearsInCabinet,
      show: (s) => avg(s.yearsInCabinet, g, 2),
    },
    {
      title: L('Opposition leader', 'Líder da oposição'),
      tip: L(
        'Times leading the opposition (times on the opposition bench)',
        'Vezes liderando a oposição (vezes na bancada da oposição)',
      ),
      value: (s) => s.timesLeadingOpposition,
      show: (s) => `${s.timesLeadingOpposition} <small>${s.timesInOpposition}</small>`,
    },
    {
      title: L('Avg seats', 'Cadeiras médias'),
      tip: L('Average seats after each parliamentary election', 'Média de cadeiras depois de cada eleição parlamentar'),
      value: (s) => (s.elections ? s.seatsSum / s.elections : 0),
      show: (s) => avg(s.seatsSum, s.elections),
    },
    {
      title: L('Avg vote', 'Votos médios'),
      tip: L(
        'Average national vote share, and average popularity on election day',
        'Percentual médio de votos, e popularidade média no dia da eleição',
      ),
      value: (s) => (s.elections ? s.shareSum / s.elections : 0),
      show: (s) =>
        `${avg(s.shareSum, s.elections)}% <small>${L('pop', 'pop')} ${avg(s.popularitySum, s.elections, 0)}</small>`,
    },
    {
      title: L('Laws passed', 'Leis aprovadas'),
      tip: L(
        'Laws passed per game (share of its bills that passed)',
        'Leis aprovadas por partida (parcela dos seus projetos aprovados)',
      ),
      value: (s) => s.billsPassed,
      show: (s) => `${avg(s.billsPassed, g)} <small>${pct(s.billsPassed, s.billsIntroduced)}</small>`,
    },
    {
      title: L('Vetoes', 'Vetos'),
      tip: L('Vetoes used per game', 'Vetos usados por partida'),
      value: (s) => s.vetoesUsed,
      show: (s) => avg(s.vetoesUsed, g, 2),
    },
    {
      title: L('Super crises', 'Supercrises'),
      tip: L('Super crises suffered', 'Supercrises sofridas'),
      value: (s) => s.superCrises,
      show: (s) => String(s.superCrises),
      plain: true,
    },
    {
      title: L('Defections', 'Deserções'),
      tip: L('MPs won (+) and lost (−) to floor crossings', 'Deputados ganhos (+) e perdidos (−) em trocas de partido'),
      value: (s) => s.seatsWonFromDefections - s.seatsLostToDefections,
      show: (s) => `<small>+${s.seatsWonFromDefections} −${s.seatsLostToDefections}</small>`,
      plain: true,
    },
  ];

  const rows = [...r.parties].sort((a, b) => b.wins - a.wins || b.electionWins - a.electionWins);
  const best = columns.map((c) => {
    if (c.plain) return NaN;
    const values = rows.map(c.value);
    return c.lowestIsBest ? Math.min(...values) : Math.max(...values);
  });
  const name = (s: PartyStats) =>
    `<span class="srparty" style="--pc:${css(s.party.color)}">${emblem(s.party)} ${s.party.name}</span>`;
  const table = `<table class="srtable">
    <thead><tr><th>${L('Party', 'Partido')}</th>${columns.map((c) => `<th title="${c.tip}">${c.title}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (s) =>
          `<tr><td>${name(s)}</td>${columns
            .map(
              (c, i) =>
                `<td class="${c.value(s) === best[i] && c.value(s) > 0 ? 'best' : ''}" title="${c.tip}">${c.show(s)}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('')}</tbody>
  </table>`;

  // The headline facts: who came top in what.
  const top = (value: (s: PartyStats) => number) => [...r.parties].sort((a, b) => value(b) - value(a))[0];
  const highlight = (icon: string, label: string, s: PartyStats, detail: string) =>
    `<div class="srhl" style="--pc:${css(s.party.color)}"><span class="srhlicon">${icon}</span><span class="srhllabel">${label}</span><span class="srhlname">${emblem(s.party)} ${s.party.name}</span><span class="srhldetail">${detail}</span></div>`;
  const mostWins = top((s) => s.wins);
  const mostPres = top((s) => s.presidencies);
  const mostGov = top((s) => s.governments);
  const mostElections = top((s) => s.electionWins);
  const mostLaws = top((s) => s.billsPassed);
  const mostOpp = top((s) => s.timesLeadingOpposition);
  const highlights = [
    highlight(
      '🏆',
      L('Most wins', 'Mais vitórias'),
      mostWins,
      `${mostWins.wins} ${L('of', 'de')} ${g} (${pct(mostWins.wins, g)})`,
    ),
    highlight(
      '🎖️',
      L('Most presidencies', 'Mais presidências'),
      mostPres,
      `${mostPres.presidencies} ${L('of', 'de')} ${r.presidentialElections}`,
    ),
    highlight(
      '🏛️',
      L('Most governments formed', 'Mais governos formados'),
      mostGov,
      `${mostGov.governments} ${L('of', 'de')} ${r.governmentsFormed}`,
    ),
    highlight(
      '🗳️',
      L('Most elections won', 'Mais eleições vencidas'),
      mostElections,
      `${mostElections.electionWins} ${L('of', 'de')} ${r.parliamentaryElections}`,
    ),
    highlight(
      '📜',
      L('Most laws passed', 'Mais leis aprovadas'),
      mostLaws,
      `${mostLaws.billsPassed} ${L('laws', 'leis')}`,
    ),
    highlight(
      '📣',
      L('Led the opposition most', 'Mais vezes líder da oposição'),
      mostOpp,
      `${mostOpp.timesLeadingOpposition}×`,
    ),
  ].join('');

  const facts = [
    L(
      `<b>${pct(r.majorityEndings, g)}</b> of games ended with an outright majority (${r.majorityEndings}); the rest went the full five years.`,
      `<b>${pct(r.majorityEndings, g)}</b> das partidas terminaram com maioria absoluta (${r.majorityEndings}); as demais foram até o fim dos cinco anos.`,
    ),
    L(
      `The President's party also won that year's parliamentary election <b>${pct(r.presidentAlsoWonParliament, r.parliamentaryElections)}</b> of the time.`,
      `O partido do Presidente também venceu a eleição parlamentar daquele ano em <b>${pct(r.presidentAlsoWonParliament, r.parliamentaryElections)}</b> das vezes.`,
    ),
    L(
      `<b>${r.governmentsFormed}</b> governments were formed (${avg(r.governmentsFormed, g)} per game); <b>${pct(r.minorityGovernments, r.governmentsFormed)}</b> were minority governments, and <b>${r.governmentsFallen}</b> fell to a vote of no confidence.`,
      `<b>${r.governmentsFormed}</b> governos foram formados (${avg(r.governmentsFormed, g)} por partida); <b>${pct(r.minorityGovernments, r.governmentsFormed)}</b> foram de minoria, e <b>${r.governmentsFallen}</b> caíram numa moção de desconfiança.`,
    ),
    L(
      `The biggest party ever had <b>${r.largestParty}</b> seats (a majority is 76).`,
      `O maior partido de todos teve <b>${r.largestParty}</b> cadeiras (a maioria é 76).`,
    ),
  ]
    .map((f) => `<li>${f}</li>`)
    .join('');

  return `<div class="srhead">
      <div class="srtitle">📊 ${L(`${g} simulated games`, `${g} partidas simuladas`)}</div>
      <div class="srsub">${L('All bots, random turn order', 'Só bots, ordem dos turnos sorteada')} · ${(r.ms / 1000).toFixed(1)} s</div>
    </div>
    <div class="srhls">${highlights}</div>
    <div class="srtablewrap">${table}</div>
    <ul class="srfacts">${facts}</ul>
    <p class="srnote">${L('The best value in each column is highlighted. Hover a column for what it means.', 'O melhor valor de cada coluna fica destacado. Passe o mouse numa coluna para ver o que ela significa.')}</p>`;
}
