/** The always-visible parts of the HUD, as HTML: top bar, party panels, parliament bar, hand drawer, square tooltip. */
import { BOARD } from '../../core/board';
import type { Engine } from '../../core/engine';
import * as R from '../../core/rules';
import { sound } from '../../audio';
import { settings } from '../../core/settings';
import { AXIS_INFO, AXIS_KEYS, PORTFOLIO_INFO, type Player } from '../../core/types';
import { SQUARE_META } from '../../data/squares';
import { L } from '../../i18n';
import { cardHTML, css, emblem } from './html';

/** Top bar: year, Public Mood, game speed, camera mode, hand, history, rules and new game. */
export function topBarHTML(engine: Engine, viewer: Player | undefined, handOpen: boolean, cinematic: boolean): string {
  const mood = AXIS_KEYS.map((k) => {
    const v = engine.mood[k];
    const info = AXIS_INFO[k];
    return `<div class="maxis" title="${info.name}: ${info.low} ← ${v.toFixed(1)} → ${info.high}">
      <span>${info.name.slice(0, 4)}</span>
      <div class="mtrack"><i style="left:${((v - 1) / 3) * 100}%"></i></div>
    </div>`;
  }).join('');
  const moodTip = L(
    'Public Mood: where the median voter stands. Being close to it earns popularity at elections and wins debates.',
    'Humor do Eleitorado: onde está o eleitor médio. Ficar perto dele rende popularidade nas eleições e vence debates.',
  );
  const cameraTip = L(
    'Cinematic camera follows the action (drag to look around; it resumes after a few seconds)',
    'A câmera cinematográfica acompanha a ação (arraste para olhar em volta; ela volta depois de alguns segundos)',
  );
  const speeds = [1, 2, 4]
    .map((s) => `<button data-speed="${s}" class="${settings.speed === s ? 'on' : ''}">${s}×</button>`)
    .join('');
  const hand = viewer
    ? `<button id="btn-hand" class="${handOpen ? 'on' : ''}" title="${L('Show or hide your cards', 'Mostrar ou esconder suas cartas')}">
        🃏 ${L('Hand', 'Mão')} <b>${viewer.hand.length}</b>
      </button>`
    : '';
  return `
    <div class="logo">${L('COALITION', 'COALIZÃO')}</div>
    <div class="yr">${L('Year', 'Ano')} <b>${engine.year}</b>/${R.YEARS}</div>
    <div class="mood" title="${moodTip}"><span class="mlabel">${L('Public Mood', 'Humor do Eleitorado')}</span>${mood}</div>
    <div class="spacer"></div>
    <div class="speed" title="${L('Game speed', 'Velocidade do jogo')}">${speeds}</div>
    <button id="btn-cam" class="${cinematic ? 'on' : ''}" title="${cameraTip}">
      🎥 ${cinematic ? L('Cinematic', 'Cinematográfica') : L('Free cam', 'Câmera livre')}
    </button>
    ${hand}
    <button id="btn-sound" class="${sound.muted ? '' : 'on'}" title="${L('Sound on/off', 'Liga/desliga o som')}">
      ${sound.muted ? '🔇' : '🔊'} ${L('Sound', 'Som')}
    </button>
    <button id="btn-history">📜 ${L('History', 'Histórico')}</button>
    <button id="btn-help">${L('Rules', 'Regras')}</button>
    <button id="btn-new">${L('New Game', 'Novo Jogo')}</button>`;
}

/** Role badges of a party: waiting, President, Leader of Congress, ministries, opposition or independent. */
function rolesHTML(p: Player, first = false): string {
  const roles: string[] = [];
  if (first)
    roles.push(
      `<span class="badge opp" title="${L('Leader scrutiny: the most popular party gets 25% less from every popularity gain', 'Escrutínio do líder: o partido mais popular ganha 25% menos em cada aumento de popularidade')}">🔍 ${L('Scrutiny −25%', 'Escrutínio −25%')}</span>`,
    );
  if (p.waiting)
    roles.push(`<span class="badge opp">⏳ ${L('Waiting at the Election', 'Esperando na Eleição')}</span>`);
  if (p.isPresident)
    roles.push(
      `<span class="badge pres" title="${L('+2 vetoes a year', '+2 vetos por ano')}">🎖️ ${L('President', 'Presidente')}</span>`,
    );
  if (p.isPM) roles.push(`<span class="badge pm">👑 ${L('Leader of Congress', 'Líder do Congresso')}</span>`);
  for (const pf of p.portfolios) {
    const info = PORTFOLIO_INFO[pf];
    roles.push(`<span class="badge min" title="${info.title}: ${info.perk}">${info.icon} ${info.short}</span>`);
  }
  if (p.isOppLeader)
    roles.push(`<span class="badge lead">📣 ${L('Leader of the Opposition', 'Líder da Oposição')}</span>`);
  else if (p.inOpp) roles.push(`<span class="badge lead">${L('Opposition', 'Oposição')}</span>`);
  else if (!p.inGov) roles.push(`<span class="badge opp">${L('Independent', 'Independente')}</span>`);
  return roles.join('');
}

/** "Vetoes left this year: 2 of 3", for a party's veto counter. */
const vetoTip = (engine: Engine, p: Player) =>
  L(
    `Vetoes left this year: ${engine.vetoesLeft(p)} of ${R.vetoAllowance(p)} (1 for every party, 2 for the Leader of Congress and the Leader of the Opposition, +${R.PRESIDENT_VETOES} for the President's party)`,
    `Vetos restantes neste ano: ${engine.vetoesLeft(p)} de ${R.vetoAllowance(p)} (1 para cada partido, 2 para o Líder do Congresso e o Líder da Oposição, +${R.PRESIDENT_VETOES} para o partido do Presidente)`,
  );

/** A party's ideology, for its panel's tooltip. */
const ideologyTip = (p: Player) =>
  AXIS_KEYS.map((k) => `${AXIS_INFO[k].name}: ${R.poleName(k, p.party.axes[k])} (${p.party.axes[k]})`).join('\n');

/**
 * The party panels, ranked by popularity. The party of the human currently deciding (`viewer`) gets a big panel
 * at its place in the ranking.
 */
export function playersHTML(engine: Engine, viewer: Player | undefined): string {
  const humans = engine.players.filter((p) => !p.isAI).length;
  const ranked = [...engine.players].sort((a, b) => b.popularity - a.popularity || b.seats - a.seats || a.id - b.id);
  const popularity = L('Popularity', 'Popularidade');

  return ranked
    .map((p, i) => {
      const rank = i + 1;
      const active = p.id === engine.turn ? 'active' : '';
      const style = `style="--pc:${css(p.party.color)}"`;
      if (p === viewer) {
        return `<div class="pcard mine ${active}" ${style} title="${ideologyTip(p)}">
          <div class="mytop">
            <div class="myemblem">${emblem(p.party)}</div>
            <div class="myid">
              <div class="mylabel">${humans > 1 ? L('NOW DECIDING', 'DECIDINDO AGORA') : L('YOUR PARTY', 'SEU PARTIDO')} · <span class="rank r${rank}">#${rank}</span></div>
              <div class="myname">${p.party.name}</div>
              <div class="mytag">${p.party.tagline}</div>
            </div>
          </div>
          <div class="roles">${rolesHTML(p, engine.isFrontRunner(p))}</div>
          <div class="popbar big"><div style="width:${p.popularity}%"></div><span>${popularity} <b>${p.popularity}</b></span></div>
          <div class="mystats">
            <div title="${L('Parliamentary seats', 'Cadeiras no parlamento')}"><b>${p.seats}</b><span>🪑 ${L('Seats', 'Cadeiras')}</span></div>
            <div title="${L('Laws passed', 'Leis aprovadas')}"><b>${p.stats.billsPassed}</b><span>📜 ${L('Laws', 'Leis')}</span></div>
            <div class="cap" title="${L('Political Capital: earned from lobbies, laws and office; spent on rallies, vetoes, whips and crisis fixes', 'Capital Político: vem de lobbies, leis e cargos; é gasto em comícios, vetos, pressão na bancada e crises')}">
              <b>${p.capital}</b><span>⭐ ${L('Capital', 'Capital')}</span>
            </div>
            <div title="${vetoTip(engine, p)}"><b>${engine.vetoesLeft(p)}<small>/${R.vetoAllowance(p)}</small></b><span>🛑 ${L('Vetoes', 'Vetos')}</span></div>
          </div>
        </div>`;
      }
      const who = p.isAI ? L('AI', 'IA') : humans > 1 ? L('HUMAN', 'HUMANO') : L('YOU', 'VOCÊ');
      return `<div class="pcard ${active}" ${style} title="${ideologyTip(p)}">
        <div class="pcwm">${emblem(p.party)}</div>
        <div class="pchead">
          <span class="rank r${rank}">#${rank}</span><span class="pcicon">${emblem(p.party)}</span>
          <span class="pcname">${p.party.name}</span><span class="who">${who}</span>
        </div>
        <div class="roles">${rolesHTML(p, engine.isFrontRunner(p))}</div>
        <div class="popbar"><div style="width:${p.popularity}%"></div><span>${popularity} <b>${p.popularity}</b></span></div>
        <div class="stats">
          <span title="${L('Political Capital', 'Capital Político')}">⭐ ${p.capital}</span>
          <span title="${L('Parliamentary seats', 'Cadeiras no parlamento')}">🪑 ${p.seats}</span>
          <span title="${L('Laws passed', 'Leis aprovadas')}">📜 ${p.stats.billsPassed}</span>
          <span title="${L('Cards in hand', 'Cartas na mão')}">🃏 ${p.hand.length}</span>
          <span title="${vetoTip(engine, p)}">🛑 ${engine.vetoesLeft(p)}/${R.vetoAllowance(p)}</span>
        </div>
      </div>`;
    })
    .join('');
}

/** The parliament bar under the top bar: every party's seats, opposition left and government right. */
export function seatBarHTML(engine: Engine): string {
  const governmentSeats = engine.players.filter((p) => p.inGov).reduce((s, p) => s + p.seats, 0);
  const oppositionSeats = engine.players.filter((p) => p.inOpp).reduce((s, p) => s + p.seats, 0);
  const independentSeats = engine.players.filter((p) => R.isIndependent(p)).reduce((s, p) => s + p.seats, 0);
  const role = (p: Player) =>
    p.inGov
      ? L(' (government)', ' (governo)')
      : p.inOpp
        ? L(' (opposition)', ' (oposição)')
        : governmentSeats
          ? L(' (independent)', ' (independente)')
          : '';
  const independents =
    governmentSeats && independentSeats ? `${L('Independents', 'Independentes')} <b>${independentSeats}</b> · ` : '';
  const segments = R.benchOrder(engine.players)
    .filter((p) => p.seats > 0)
    .map((p) => {
      const tip = `${p.party.name}: ${p.seats} ${L('seats', 'cadeiras')}${role(p)}`;
      const label =
        p.seats >= 12 ? `${emblem(p.party)} ${p.party.short} ${p.seats}` : p.seats >= 6 ? emblem(p.party) : '';
      return `<div class="seg ${p.inGov ? 'gov' : ''}" style="flex:${p.seats};background:${css(p.party.color)}" title="${tip}">${label}</div>`;
    })
    .join('');
  const majorityLine = ((R.TOTAL_SEATS - R.MAJORITY) / R.TOTAL_SEATS) * 100;
  return `<div class="sbar">${segments}<div class="maj" style="left:${majorityLine}%"></div></div>
    <div class="slabel">
      ◀ ${L('Opposition', 'Oposição')} <b>${oppositionSeats}</b> · ${independents}
      ${L('Government', 'Governo')} <b>${governmentSeats}</b> ▶ ·
      ${L('majority', 'maioria')} ${R.MAJORITY}
    </div>`;
}

/** The hand drawer (opened with the 🃏 Hand button). */
export function handHTML(p: Player): string {
  const cards = p.hand.map((c) => cardHTML(c, p)).join('') || `<div class="empty">${L('No cards', 'Sem cartas')}</div>`;
  return `<div class="hhead" style="color:${css(p.party.color)}">
      ${p.party.name} — ${L('hand', 'mão')} (${p.hand.length})<button class="hclose">✕</button>
    </div>
    <div class="hcards">${cards}</div>`;
}

/** Tooltip for a board square: its name, what it does and which pawns stand on it. */
export function squareTooltipHTML(index: number, engine: Engine | undefined): string {
  const meta = SQUARE_META[BOARD[index]];
  const here =
    engine?.players
      .filter((p) => p.position === index)
      .map((p) => `<b style="color:${css(p.party.color)}">${emblem(p.party)} ${p.party.short}</b>`) ?? [];
  return `<div class="tt">${meta.icon} ${index} · ${meta.name}</div>
    <div>${meta.desc}</div>
    ${here.length ? `<div class="th">${L('Here', 'Aqui')}: ${here.join(' ')}</div>` : ''}`;
}
