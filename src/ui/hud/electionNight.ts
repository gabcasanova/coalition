/**
 * Election night, TV style: votes are counted live (ranked bars plus a line chart of each party's share as the
 * count progresses), then a table shows the new seats and who gained or lost. Resolves when the viewer continues.
 */
import { sound } from '../../audio';
import type { ElectionResult } from '../../core/engine';
import * as R from '../../core/rules';
import { paced } from '../../core/settings';
import type { Player } from '../../core/types';
import { L } from '../../i18n';
import { css, emblem } from './html';

/** Size of the line chart (SVG units) and height of one bar row (px). */
const CHART_W = 600;
const CHART_H = 260;
const ROW_H = 46;
/** How long the live count takes, in ms at normal speed. */
const COUNT_MS = 7000;

export function showElectionNight(host: HTMLElement, result: ElectionResult, players: Player[]): Promise<void> {
  const rows = result.rows.map((row) => ({ ...row, p: players[row.playerId] }));
  const winner = players[result.winnerId];
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
        `<b>How seats are calculated:</b> each party's vote share is its popularity ÷ the total popularity of all parties (${Math.round(result.totalPopularity)}). Seats = vote share × ${R.TOTAL_SEATS}, rounded so they add up to exactly ${R.TOTAL_SEATS}. ${R.MAJORITY} seats is a majority.`,
        `<b>Como as cadeiras são calculadas:</b> o percentual de votos de cada partido é sua popularidade ÷ a popularidade total de todos os partidos (${Math.round(result.totalPopularity)}). Cadeiras = percentual × ${R.TOTAL_SEATS}, arredondado para somar exatamente ${R.TOTAL_SEATS}. ${R.MAJORITY} cadeiras formam maioria.`,
      )}</div>
      <button class="opt primary" id="tvgo"><span class="ol">${L('Continue ▶', 'Continuar ▶')}</span></button>
    </div>
    <div class="tvticker"><div class="tvtrack">${ticker}   ◆   ${ticker}   ◆   </div></div>
  </div>`;
  host.classList.remove('hidden');
  const $ = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;

  // During the count each party's share wobbles, then settles on the final result.
  const wobble = rows.map(() => (Math.random() - 0.5) * 2);
  const sharesAt = (t: number) => {
    const raw = rows.map((x, i) =>
      Math.max(0.5, x.share + wobble[i] * 9 * Math.pow(1 - t, 1.3) + Math.sin(t * 14 + i * 2) * 2 * (1 - t)),
    );
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => (v / sum) * 100);
  };
  const points: string[][] = rows.map(() => []);
  const lines = rows.map((x) => host.querySelector<SVGPolylineElement>(`polyline[data-id="${x.playerId}"]`)!);
  const rowEls = rows.map((x) => host.querySelector<HTMLElement>(`.tvrow[data-id="${x.playerId}"]`)!);
  const duration = paced(COUNT_MS);
  sound.play('drumroll', duration / 1000);
  const start = performance.now();
  let lastSample = -1;

  return new Promise((resolve) => {
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const shares = t >= 1 ? rows.map((x) => x.share) : sharesAt(t);
      $('tvpct').textContent = `${Math.round(t * 100)}%`;
      // Re-rank the bars every frame.
      const order = shares.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      order.forEach(({ v, i }, rank) => {
        const el = rowEls[i];
        el.style.top = `${rank * ROW_H}px`;
        el.querySelector<HTMLElement>('i')!.style.width = `${(v / yMax) * 100}%`;
        el.querySelector<HTMLElement>('.tvval')!.textContent = `${v.toFixed(1)}%`;
      });
      // Extend the chart 40 times over the count.
      const sample = Math.floor(t * 40);
      if (sample !== lastSample) {
        lastSample = sample;
        shares.forEach((v, i) => {
          points[i].push(`${(t * CHART_W).toFixed(1)},${(CHART_H - (v / yMax) * CHART_H).toFixed(1)}`);
          lines[i].setAttribute('points', points[i].join(' '));
        });
        const lead = rows[order[0].i].p;
        const leadName = `${emblem(lead.party)} <b style="color:${css(lead.party.color)}">${lead.party.name}</b>`;
        $('tvhead').innerHTML =
          t < 1
            ? L(
                `${leadName} leads with ${order[0].v.toFixed(1)}% of the votes counted so far`,
                `${leadName} lidera com ${order[0].v.toFixed(1)}% dos votos apurados até agora`,
              )
            : '';
      }
      if (t < 1) requestAnimationFrame(frame);
      else showResults();
    };

    const showResults = () => {
      sound.play('electionResult');
      const wins = winner.stats.electionWins;
      const winnerName = `<b style="color:${css(winner.party.color)}">${winner.party.name}</b>`;
      const majority =
        winner.seats >= R.MAJORITY ? L(' — <b>ABSOLUTE MAJORITY!</b>', ' — <b>MAIORIA ABSOLUTA!</b>') : '';
      $('tvhead').innerHTML = L(
        `🏆 ${winnerName} wins the Year ${result.year} election — ${wins} election win${wins === 1 ? '' : 's'} so far${majority}`,
        `🏆 ${winnerName} vence a eleição do Ano ${result.year} — ${wins} ${wins === 1 ? 'vitória' : 'vitórias'} até agora${majority}`,
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
          const exactSeats = (x.share / 100) * R.TOTAL_SEATS;
          const mood = x.moodBonus ? ` (${R.fmt(x.moodBonus)} ${L('mood', 'humor')})` : '';
          return `<div class="tvsr" style="--pc:${css(x.p.party.color)}">
            <span class="tvsname">${emblem(x.p.party)} ${x.p.party.name}</span>
            <span class="tvscalc">${Math.round(x.popularity)} pop${mood} → ${x.share.toFixed(1)}% → ${exactSeats.toFixed(1)}</span>
            <span class="tvsseats"><b>${x.seatsAfter}</b> ${L('seats', 'cadeiras')} <small>(${L('was', 'eram')} ${x.seatsBefore})</small></span>
            ${change}
          </div>`;
        })
        .join('');
      $('tvseats').innerHTML =
        `<div class="tvlabel">${L('SEATS IN PARLIAMENT', 'CADEIRAS NO PARLAMENTO')}</div>${seatRows}`;
      setTimeout(() => {
        $('tvseats').classList.remove('hidden');
        $('tvfoot').classList.remove('hidden');
      }, paced(500));

      const done = () => {
        window.removeEventListener('keydown', onKey);
        host.classList.add('hidden');
        host.innerHTML = '';
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !$('tvfoot').classList.contains('hidden')) {
          e.preventDefault();
          done();
        }
      };
      window.addEventListener('keydown', onKey);
      $('tvgo').addEventListener('click', done);
    };

    requestAnimationFrame(frame);
  });
}
