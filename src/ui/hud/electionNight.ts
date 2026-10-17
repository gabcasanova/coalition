/**
 * Election night, TV style. Districts declare their results one by one: the map fills in with each district's
 * winner, the bars and the line chart follow the votes counted so far, and the headline announces each
 * declaration. Then a table shows the seats each party won against its share of the vote (the system's
 * distortion) and who gained or lost. Resolves when the viewer continues.
 */
import { sound } from '../../audio';
import type { ElectionResult } from '../../core/engine';
import * as R from '../../core/rules';
import { paced } from '../../core/settings';
import type { Player } from '../../core/types';
import { L } from '../../i18n';
import { DistrictMap } from './districtMap';
import { css, emblem } from './html';

/** Size of the line chart (SVG units) and height of one bar row (px). */
const CHART_W = 600;
const CHART_H = 260;
const ROW_H = 46;
/** How long the count takes, in ms at normal speed. */
const COUNT_MS = 9000;

export function showElectionNight(
  host: HTMLElement,
  result: ElectionResult,
  players: Player[],
  signal?: AbortSignal,
): Promise<void> {
  const rows = result.rows.map((row) => ({ ...row, p: players[row.playerId] }));
  const winner = players[result.winnerId];
  const districts = result.districts;
  // Top of the chart: a little above the winning share, in steps of 10%.
  const yMax = Math.min(100, Math.ceil((Math.max(...rows.map((x) => x.share)) + 12) / 10) * 10);
  const ticker = rows
    .slice()
    .sort((a, b) => b.share - a.share)
    .map((x) => `${emblem(x.p.party)} ${x.p.party.short} ${x.share.toFixed(1)}%`)
    .join('   ◆   ');

  host.innerHTML = `<div class="tv">
    <div class="tvtop">
      <span class="tvbreak">${L('BREAKING NEWS', 'PLANTÃO')}</span><span class="tvlive">● ${L('LIVE', 'AO VIVO')}</span>
      <span class="tvtitle">${L('ELECTION NIGHT', 'NOITE DA ELEIÇÃO')} · ${L('YEAR', 'ANO')} ${result.year}${result.final ? L(' · FINAL ELECTION', ' · ELEIÇÃO FINAL') : ''}</span>
      <span class="tvcount">${L('VOTES COUNTED', 'URNAS APURADAS')} <b id="tvpct">0%</b></span>
    </div>
    <div class="tvheadline" id="tvhead">${L('The polls have closed. The count is under way…', 'As urnas fecharam. A apuração começou…')}</div>
    <div class="tvmain">
      <div class="tvpanel">
        <div class="tvlabel">${L('VOTE SHARE', 'PERCENTUAL DE VOTOS')}</div>
        <div class="tvbars" style="height:${rows.length * ROW_H}px">
          ${rows
            .map(
              (x) => `<div class="tvrow" data-id="${x.playerId}" style="--pc:${css(x.p.party.color)}">
                <span class="tvname">${emblem(x.p.party)} ${x.p.party.short}</span>
                <span class="tvbar"><i></i></span><span class="tvval">0.0%</span>
              </div>`,
            )
            .join('')}
        </div>
      </div>
      <div class="tvpanel tvmappanel">
        <div class="tvlabel">${L('DISTRICTS DECLARED', 'DISTRITOS APURADOS')} <b id="tvdeclared">0/${districts.length}</b></div>
        <div class="tvmapwrap" id="tvmapwrap"><div class="tvmaptip hidden" id="tvmaptip"></div></div>
      </div>
      <div class="tvpanel">
        <div class="tvlabel">${L('THE COUNT, AS IT HAPPENED', 'A APURAÇÃO, MINUTO A MINUTO')}</div>
        <svg class="tvchart" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none">
          ${[0, 0.25, 0.5, 0.75, 1]
            .map((f) => {
              const y = CHART_H - f * CHART_H;
              return `<line x1="0" x2="${CHART_W}" y1="${y}" y2="${y}" class="grid"/><text x="4" y="${f === 1 ? 14 : y - 4}" class="gl">${Math.round(f * yMax)}%</text>`;
            })
            .join('')}
          ${rows.map((x) => `<polyline data-id="${x.playerId}" fill="none" stroke="${css(x.p.party.color)}" stroke-width="3.5" points=""/>`).join('')}
        </svg>
      </div>
    </div>
    <div class="tvseats hidden" id="tvseats"></div>
    <div class="tvfoot hidden" id="tvfoot">
      <div class="tvformula">${L(
        `<b>How seats are won:</b> the country has ${districts.length} districts, each electing between 2 and 20 MPs. In each district the seats are shared out by the D'Hondt method, which rounds in favour of the biggest parties, most of all in small districts. A party does better where voters share its views and worse elsewhere, and rural districts have fewer voters per seat. So seats don't follow the national vote exactly. ${R.MAJORITY} of ${R.TOTAL_SEATS} seats is a majority.`,
        `<b>Como as cadeiras são conquistadas:</b> o país tem ${districts.length} distritos, cada um elegendo de 2 a 20 deputados. Em cada distrito, as cadeiras são divididas pelo método D'Hondt, que arredonda a favor dos maiores partidos, principalmente nos distritos pequenos. Um partido vai melhor onde os eleitores pensam como ele e pior no resto, e os distritos rurais têm menos eleitores por cadeira. Por isso as cadeiras não seguem exatamente o voto nacional. ${R.MAJORITY} de ${R.TOTAL_SEATS} cadeiras formam maioria.`,
      )}</div>
      <button class="opt primary" id="tvgo"><span class="ol">${L('Continue ▶', 'Continuar ▶')}</span></button>
    </div>
    <div class="tvticker"><div class="tvtrack">${ticker}   ◆   ${ticker}   ◆   </div></div>
  </div>`;
  host.classList.remove('hidden');
  const $ = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;

  // ───── the map ─────
  const map = new DistrictMap();
  $('tvmapwrap').prepend(map.canvas);
  const declared = districts.map(() => false);
  let hovered = -1;
  const redrawMap = () =>
    map.draw(
      districts.map((d, i) => (declared[i] ? players[d.winnerId].party.color : null)),
      hovered,
      districts.map((d, i) => (declared[i] && d.seats >= 5 ? String(d.seats) : null)),
    );
  redrawMap();
  map.canvas.addEventListener('mousemove', (e) => {
    const i = map.districtAt(e.clientX, e.clientY);
    if (i !== hovered) {
      hovered = i;
      redrawMap();
    }
    const tip = $('tvmaptip');
    if (i < 0) return tip.classList.add('hidden');
    tip.innerHTML = districtTipHTML(i);
    const wrap = $('tvmapwrap').getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - wrap.left + 12, wrap.width - 200)}px`;
    tip.style.top = `${e.clientY - wrap.top + 12}px`;
    tip.classList.remove('hidden');
  });
  map.canvas.addEventListener('mouseleave', () => {
    hovered = -1;
    $('tvmaptip').classList.add('hidden');
    redrawMap();
  });

  /** Tooltip for a district: its result if declared, otherwise "counting". */
  function districtTipHTML(i: number): string {
    const d = districts[i];
    const head = `<b>${d.name}</b> · ${d.seats} ${L('seats', 'cadeiras')}`;
    if (!declared[i]) return `${head}<div class="muted">${L('Still counting…', 'Ainda apurando…')}</div>`;
    const total = d.votes.reduce((a, b) => a + b, 0);
    const lines = d.votes
      .map((v, id) => ({ v, id }))
      .sort((a, b) => d.seatsWon[b.id] - d.seatsWon[a.id] || b.v - a.v)
      .map(({ v, id }) => {
        const party = players[id].party;
        return `<div><span style="color:${css(party.color)}">${emblem(party)} ${party.short}</span> ${((v / total) * 100).toFixed(0)}% → <b>${d.seatsWon[id]}</b></div>`;
      })
      .join('');
    return head + lines;
  }

  // ───── the count ─────
  // Districts declare in a random order, spread over the count.
  const order = districts.map((_, i) => i).sort(() => Math.random() - 0.5);
  const declareAt = order.map((_, k) => (k + 1) / (order.length + 1));
  const totalVoters = districts.reduce((sum, d) => sum + d.votes.reduce((a, b) => a + b, 0), 0);
  const counted = rows.map(() => 0);
  let countedVoters = 0;
  let next = 0;

  const points: string[][] = rows.map(() => []);
  const lines = rows.map((x) => host.querySelector<SVGPolylineElement>(`polyline[data-id="${x.playerId}"]`)!);
  const rowEls = rows.map((x) => host.querySelector<HTMLElement>(`.tvrow[data-id="${x.playerId}"]`)!);
  const duration = paced(COUNT_MS);
  sound.play('drumroll', duration / 1000);
  const start = performance.now();

  /** Shares of the votes counted so far (all zero before the first district declares). */
  const shares = () => {
    const sum = counted.reduce((a, b) => a + b, 0);
    return counted.map((v) => (sum ? (v / sum) * 100 : 0));
  };

  /** `progress`: the share of districts declared so far (0..1), the chart's x axis. */
  const updateBarsAndChart = (progress: number) => {
    const current = shares();
    const ranking = current.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    ranking.forEach(({ v, i }, rank) => {
      const el = rowEls[i];
      el.style.top = `${rank * ROW_H}px`;
      el.querySelector<HTMLElement>('i')!.style.width = `${(v / yMax) * 100}%`;
      el.querySelector<HTMLElement>('.tvval')!.textContent = `${v.toFixed(1)}%`;
    });
    current.forEach((v, i) => {
      points[i].push(`${(progress * CHART_W).toFixed(1)},${(CHART_H - (v / yMax) * CHART_H).toFixed(1)}`);
      lines[i].setAttribute('points', points[i].join(' '));
    });
  };

  /** A district declares: add its votes, paint it on the map, announce it. */
  const declare = (i: number) => {
    const d = districts[i];
    declared[i] = true;
    d.votes.forEach((v, id) => (counted[id] += v));
    countedVoters += d.votes.reduce((a, b) => a + b, 0);
    $('tvpct').textContent = `${Math.round((countedVoters / totalVoters) * 100)}%`;
    $('tvdeclared').textContent = `${declared.filter(Boolean).length}/${districts.length}`;
    updateBarsAndChart(declared.filter(Boolean).length / districts.length);
    redrawMap();
    const party = players[d.winnerId].party;
    const won = d.seatsWon[d.winnerId];
    sound.play('tick');
    $('tvhead').innerHTML = L(
      `📍 <b>${d.name}</b> declares: ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> wins ${won} of ${d.seats} seats`,
      `📍 <b>${d.name}</b> apurado: ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> fica com ${won} de ${d.seats} cadeiras`,
    );
  };

  return new Promise((resolve) => {
    // Closes the window: Continue, Space/Enter once the results are up, or a fast-forward starting (`signal`).
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey);
      signal?.removeEventListener('abort', close);
      host.classList.add('hidden');
      host.innerHTML = '';
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && host.querySelector('#tvfoot:not(.hidden)')) {
        e.preventDefault();
        close();
      }
    };
    signal?.addEventListener('abort', close, { once: true });

    const frame = (now: number) => {
      if (closed) return;
      const t = Math.min(1, (now - start) / duration);
      while (next < order.length && declareAt[next] <= t) declare(order[next++]);
      if (t < 1) requestAnimationFrame(frame);
      else {
        while (next < order.length) declare(order[next++]);
        showResults();
      }
    };

    const showResults = () => {
      sound.play('electionResult');
      const points = R.points(winner.stats);
      const winnerName = `<b style="color:${css(winner.party.color)}">${winner.party.name}</b>`;
      const majority =
        winner.seats >= R.MAJORITY ? L(' — <b>ABSOLUTE MAJORITY!</b>', ' — <b>MAIORIA ABSOLUTA!</b>') : '';
      $('tvhead').innerHTML = L(
        `🏆 ${winnerName} wins the Year ${result.year} election — ${points} point${points === 1 ? '' : 's'} so far${majority}`,
        `🏆 ${winnerName} vence a eleição do Ano ${result.year} — ${points} ${points === 1 ? 'ponto' : 'pontos'} até agora${majority}`,
      );
      const seatRows = rows
        .slice()
        .sort((a, b) => b.seatsAfter - a.seatsAfter)
        .map((x) => {
          const d = x.seatsAfter - x.seatsBefore;
          const change =
            d > 0
              ? `<span class="chg up">▲ +${d} ${L('GAINED', 'GANHOU')}</span>`
              : d < 0
                ? `<span class="chg down">▼ ${d} ${L('LOST', 'PERDEU')}</span>`
                : `<span class="chg same">= ${L('NO CHANGE', 'SEM MUDANÇA')}</span>`;
          // The distortion: seat share minus vote share.
          const seatShare = (x.seatsAfter / R.TOTAL_SEATS) * 100;
          const bonus = seatShare - x.share;
          const bonusText = `<span class="${bonus >= 0 ? 'bonus up' : 'bonus down'}">${bonus >= 0 ? '+' : '−'}${Math.abs(bonus).toFixed(1)} ${L('pts', 'pts')}</span>`;
          const mood = x.moodBonus ? ` (${R.fmt(x.moodBonus)} ${L('mood', 'humor')})` : '';
          const districtsWon = districts.filter((dd) => dd.winnerId === x.playerId).length;
          return `<div class="tvsr" style="--pc:${css(x.p.party.color)}">
            <span class="tvsname">${emblem(x.p.party)} ${x.p.party.name}</span>
            <span class="tvscalc">${Math.round(x.popularity)} pop${mood} → ${x.share.toFixed(1)}% ${L('of votes', 'dos votos')} → ${seatShare.toFixed(1)}% ${L('of seats', 'das cadeiras')} ${bonusText} · ${districtsWon} ${L(districtsWon === 1 ? 'district' : 'districts', districtsWon === 1 ? 'distrito' : 'distritos')}</span>
            <span class="tvsseats"><b>${x.seatsAfter}</b> ${L('seats', 'cadeiras')} <small>(${L('was', 'eram')} ${x.seatsBefore})</small></span>
            ${change}
          </div>`;
        })
        .join('');
      $('tvseats').innerHTML =
        `<div class="tvlabel">${L('SEATS IN PARLIAMENT', 'CADEIRAS NO PARLAMENTO')}</div>${seatRows}`;
      setTimeout(() => {
        if (closed) return;
        $('tvseats').classList.remove('hidden');
        $('tvfoot').classList.remove('hidden');
      }, paced(500));

      window.addEventListener('keydown', onKey);
      $('tvgo').addEventListener('click', close);
    };

    requestAnimationFrame(frame);
  });
}
