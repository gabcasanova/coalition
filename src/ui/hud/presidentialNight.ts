/**
 * Presidential election night, TV style. There are no districts here: the whole nation votes as one, so it is
 * all graphs. Ballots are counted in batches; the bars race, a donut fills up with the votes counted so far and
 * the line chart traces the lead as it changes hands. Early batches swing about, but the count always ends on
 * the real result, which follows popularity. Then the President-elect is announced. Resolves when the viewer
 * continues.
 */
import { sound } from '../../audio';
import type { PresidentialResult } from '../../core/engine';
import * as R from '../../core/rules';
import { paced } from '../../core/settings';
import type { Player } from '../../core/types';
import { deArt, L } from '../../i18n';
import { css, emblem } from './html';

/** Size of the line chart (SVG units) and height of one bar row (px). */
const CHART_W = 600;
const CHART_H = 260;
const ROW_H = 46;
/** How long the count takes, in ms at normal speed, and in how many batches of ballots. */
const COUNT_MS = 7000;
const BATCHES = 36;
/** Radius and thickness of the donut (SVG units, in a 200×200 box). */
const DONUT_R = 70;
const DONUT_W = 30;

export function showPresidentialNight(
  host: HTMLElement,
  result: PresidentialResult,
  players: Player[],
  signal?: AbortSignal,
): Promise<void> {
  const rows = result.rows.map((row) => ({ ...row, p: players[row.playerId] }));
  const winner = players[result.winnerId];
  const yMax = Math.min(100, Math.ceil((Math.max(...rows.map((x) => x.share)) + 12) / 10) * 10);
  const batches = countBatches(rows.map((x) => x.share));
  const ticker = rows
    .map(
      (x) => `${emblem(x.p.party)} ${x.p.party.short} · ${L('popularity', 'popularidade')} ${Math.round(x.popularity)}`,
    )
    .join('   ◆   ');

  host.innerHTML = `<div class="tv pres">
    <div class="tvtop">
      <span class="tvbreak">${L('BREAKING NEWS', 'PLANTÃO')}</span><span class="tvlive">● ${L('LIVE', 'AO VIVO')}</span>
      <span class="tvtitle">🎖️ ${L('PRESIDENTIAL ELECTION', 'ELEIÇÃO PRESIDENCIAL')} · ${L('YEAR', 'ANO')} ${result.year}</span>
      <span class="tvcount">${L('BALLOTS COUNTED', 'VOTOS APURADOS')} <b id="tvpct">0%</b></span>
    </div>
    <div class="tvheadline" id="tvhead">${L('The polls have closed. The nation waits for its new President…', 'As urnas fecharam. O país espera seu novo Presidente…')}</div>
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
      <div class="tvpanel tvdonutpanel">
        <div class="tvlabel">${L("THE NATION'S VOTE", 'O VOTO DO PAÍS')}</div>
        <svg class="tvdonut" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="${DONUT_R}" fill="none" stroke="#132648" stroke-width="${DONUT_W}"/>
          <g id="tvarcs" transform="rotate(-90 100 100)"></g>
          <text x="100" y="96" class="dbig" id="tvdlead">—</text>
          <text x="100" y="118" class="dsmall" id="tvdsub">${L('counting', 'apurando')}</text>
        </svg>
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
        `<b>How the President is chosen:</b> the whole country votes as one, so the vote follows each party's popularity and the most popular party wins. The President's party gets <b>${R.PRESIDENT_VETOES} extra vetoes</b> a year until the next presidential election.`,
        `<b>Como o Presidente é escolhido:</b> o país inteiro vota junto, então o voto segue a popularidade de cada partido e o mais popular vence. O partido do Presidente ganha <b>${R.PRESIDENT_VETOES} vetos extras</b> por ano até a próxima eleição presidencial.`,
      )}</div>
      <button class="opt primary" id="tvgo"><span class="ol">${L('Continue ▶', 'Continuar ▶')}</span></button>
    </div>
    <div class="tvticker"><div class="tvtrack">${ticker}   ◆   ${ticker}   ◆   </div></div>
  </div>`;
  host.classList.remove('hidden');
  const $ = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;

  const counted = rows.map(() => 0);
  const points: string[][] = rows.map(() => []);
  const lines = rows.map((x) => host.querySelector<SVGPolylineElement>(`polyline[data-id="${x.playerId}"]`)!);
  const rowEls = rows.map((x) => host.querySelector<HTMLElement>(`.tvrow[data-id="${x.playerId}"]`)!);
  let leader = -1;
  let next = 0;

  /** Adds a batch of ballots and redraws everything. */
  const countBatch = (b: number) => {
    batches[b].forEach((v, i) => (counted[i] += v));
    const progress = (b + 1) / BATCHES;
    const sum = counted.reduce((a, c) => a + c, 0);
    const shares = counted.map((v) => (v / sum) * 100);
    $('tvpct').textContent = `${Math.round(progress * 100)}%`;

    // Bars, ranked.
    shares
      .map((v, i) => ({ v, i }))
      .sort((a, c) => c.v - a.v)
      .forEach(({ v, i }, rank) => {
        const el = rowEls[i];
        el.style.top = `${rank * ROW_H}px`;
        el.querySelector<HTMLElement>('i')!.style.width = `${(v / yMax) * 100}%`;
        el.querySelector<HTMLElement>('.tvval')!.textContent = `${v.toFixed(1)}%`;
      });

    // Line chart.
    shares.forEach((v, i) => {
      points[i].push(`${(progress * CHART_W).toFixed(1)},${(CHART_H - (v / yMax) * CHART_H).toFixed(1)}`);
      lines[i].setAttribute('points', points[i].join(' '));
    });

    // Donut: each party's arc, as a share of all the ballots (the uncounted part stays empty).
    const circumference = 2 * Math.PI * DONUT_R;
    let offset = 0;
    $('tvarcs').innerHTML = rows
      .map((x, i) => {
        const length = (shares[i] / 100) * progress * circumference;
        const arc = `<circle cx="100" cy="100" r="${DONUT_R}" fill="none" stroke="${css(x.p.party.color)}" stroke-width="${DONUT_W}" stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"/>`;
        offset += length;
        return arc;
      })
      .join('');

    // The lead.
    const top = shares.indexOf(Math.max(...shares));
    const party = rows[top].p.party;
    $('tvdlead').textContent = `${shares[top].toFixed(1)}%`;
    $('tvdlead').setAttribute('fill', css(party.color));
    $('tvdsub').textContent = party.short;
    if (top !== leader) {
      $('tvhead').innerHTML =
        leader < 0
          ? L(
              `📊 First returns: ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> is ahead`,
              `📊 Primeiros números: ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> está na frente`,
            )
          : L(
              `🔄 ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> takes the lead!`,
              `🔄 ${emblem(party)} <b style="color:${css(party.color)}">${party.name}</b> assume a liderança!`,
            );
      if (leader >= 0) sound.play('tick');
      leader = top;
    }
  };

  const duration = paced(COUNT_MS);
  sound.play('drumroll', duration / 1000);
  const start = performance.now();

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
      while (next < BATCHES && (next + 1) / BATCHES <= t) countBatch(next++);
      if (t < 1) requestAnimationFrame(frame);
      else {
        while (next < BATCHES) countBatch(next++);
        showResult();
      }
    };

    const showResult = () => {
      sound.play('electionResult');
      const share = rows[result.winnerId].share.toFixed(1);
      const name = `${emblem(winner.party)} <b style="color:${css(winner.party.color)}">${winner.party.name}</b>`;
      const again = result.previousId === result.winnerId;
      $('tvhead').innerHTML = again
        ? L(
            `🎖️ ${name} is <b>re-elected</b> to the presidency with ${share}%`,
            `🎖️ ${name} é <b>reeleito</b> para a presidência com ${share}%`,
          )
        : L(`🎖️ ${name} wins the presidency with ${share}%`, `🎖️ ${name} conquista a presidência com ${share}%`);
      const before = result.previousId < 0 ? null : players[result.previousId].party;
      const previous = before
        ? L(`the ${before.name}`, `${deArt(before)} ${before.name}`)
        : L('the Provisional President', 'do Presidente Provisório');
      const vetoes = R.vetoAllowance({ ...winner, isPresident: true });
      $('tvseats').innerHTML = `<div class="tvlabel">${L('PRESIDENT-ELECT', 'PRESIDENTE ELEITO')}</div>
        <div class="tvpresident" style="--pc:${css(winner.party.color)}">
          <span class="tvpemb">${emblem(winner.party)}</span>
          <span class="tvpname">${winner.party.name}<small>${
            again
              ? L('stays in the palace', 'continua no palácio')
              : L(`takes over from ${previous}`, `assume no lugar ${previous}`)
          }</small></span>
          <span class="tvpshare"><b>${share}%</b> ${L('of the vote', 'dos votos')}</span>
          <span class="tvpveto">🛑 ${L(`${vetoes} vetoes a year (+${R.PRESIDENT_VETOES})`, `${vetoes} vetos por ano (+${R.PRESIDENT_VETOES})`)}</span>
        </div>`;
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

/**
 * Splits each party's final share into BATCHES batches of ballots. Early batches are noisy (one region counts
 * before another), later ones calmer; each party's batches add up exactly to its final share.
 */
function countBatches(finalShares: number[]): number[][] {
  const raw = Array.from({ length: BATCHES }, (_, b) => {
    const noise = 0.45 * (1 - b / BATCHES);
    return finalShares.map((s) => s * Math.max(0.1, 1 + (Math.random() * 2 - 1) * noise));
  });
  const totals = finalShares.map((_, i) => raw.reduce((sum, batch) => sum + batch[i], 0));
  return raw.map((batch) => batch.map((v, i) => (v / totals[i]) * finalShares[i]));
}
