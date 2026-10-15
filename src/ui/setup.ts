import type { PlayerSetup } from '../core/engine';
import { isPT, L, setLang } from '../i18n';
import { CUSTOM_COLORS, CUSTOM_ICONS, initials, PREBUILT_PARTIES } from '../data/parties';
import { poleName } from '../core/rules';
import { emblem } from './hud/html';
import { AXIS_INFO, AXIS_KEYS, type Axes, type AxisKey, type PartyDef } from '../core/types';

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

interface Slot {
  isAI: boolean;
  /** Index into PREBUILT_PARTIES, or -1 for a custom party. */
  choice: number;
  name: string;
  color: number;
  icon: string;
  axes: Axes;
}

const CUSTOM_PRESETS: { name: string; axes: Axes }[] = [
  { name: L('Green Future', 'Futuro Verde'), axes: { econ: 2, social: 1.5, env: 4, inst: 1.5 } },
  { name: L('Pirate Party', 'Partido Pirata'), axes: { econ: 2.5, social: 1, env: 2.5, inst: 1 } },
  { name: L('Order & Progress', 'Ordem e Progresso'), axes: { econ: 3.5, social: 3, env: 1.5, inst: 3.5 } },
];

type Step = { kind: 'menu' } | { kind: 'count' } | { kind: 'party'; i: number } | { kind: 'confirm' };

export interface SetupHooks {
  /** Explore the board without playing; resolves when the viewer returns to the menu. */
  freeLook(): Promise<void>;
}

/**
 * The title screen and the new-game wizard:
 * menu → how many players → each player's party, one at a time → confirm and start.
 */
export function runSetup(hooks: SetupHooks): Promise<PlayerSetup[]> {
  const root = document.getElementById('setup')!;
  let step: Step = { kind: 'menu' };
  let count = 4;
  /** Set when a party is edited from the summary, so "Next" goes straight back to it. */
  let backToConfirm = false;
  const slots: Slot[] = Array.from({ length: 6 }, (_, i) => {
    const preset = CUSTOM_PRESETS[i % CUSTOM_PRESETS.length];
    return {
      isAI: i !== 0,
      choice: i < PREBUILT_PARTIES.length ? i : -1,
      name: preset.name,
      color: CUSTOM_COLORS[i],
      icon: CUSTOM_ICONS[i],
      axes: { ...preset.axes },
    };
  });

  const partyOf = (s: Slot): PartyDef =>
    s.choice >= 0
      ? PREBUILT_PARTIES[s.choice]
      : {
          name: s.name.trim() || L('Custom Party', 'Partido Personalizado'),
          short: initials(s.name),
          icon: s.icon,
          tagline: L('Custom party', 'Partido personalizado'),
          color: s.color,
          axes: { ...s.axes },
        };

  /**
   * Which player already picked prebuilt party `j` (-1 if none). Only earlier players have picked so far;
   * when editing from the summary, every other player's pick counts.
   */
  const takenBy = (j: number, i: number) =>
    slots.slice(0, count).findIndex((s, k) => k !== i && s.choice === j && (k < i || backToConfirm));

  /** Make sure player `i` doesn't hold a party someone already picked. */
  const ensureFree = (i: number) => {
    const s = slots[i];
    if (s.choice < 0 || takenBy(s.choice, i) < 0) return;
    s.choice = PREBUILT_PARTIES.findIndex((_, j) => takenBy(j, i) < 0);
  };

  const axesSummary = (a: Axes) =>
    AXIS_KEYS.map((k) => `<span class="chip" title="${AXIS_INFO[k].name}">${poleName(k, a[k])}</span>`).join('');

  const steps = () => {
    const at = step.kind === 'count' ? 0 : step.kind === 'party' ? 1 : 2;
    return `<div class="wsteps">${[L('Players', 'Jogadores'), L('Parties', 'Partidos'), L('Confirm', 'Confirmar')]
      .map((t, k) => `<span class="${k === at ? 'on' : k < at ? 'done' : ''}"><b>${k + 1}</b>${t}</span>`)
      .join('<i></i>')}</div>`;
  };

  const header = (small = false) => `<div class="stitle ${small ? 'small' : ''}">${L('COALITION', 'COALIZÃO')}</div>`;

  const menuHTML = () => `<div class="setupbox menu">
      ${header()}
      <div class="ssub">${L('The Great Game about Political Machines and Democracy', 'O Grande Jogo sobre Máquinas Políticas e Democracia')}</div>
      <div class="mbuttons">
        <button class="start" data-go="new">▶ ${L('New Game', 'Novo Jogo')}</button>
        <button class="mbtn" data-go="look">👁️ ${L('Free Look', 'Explorar o Tabuleiro')}<small>${L('Explore the 3D board without playing', 'Explore o tabuleiro 3D sem jogar')}</small></button>
      </div>
      <div class="langpick"><span>🌐</span>
        <button data-lang="en" class="${isPT ? '' : 'on'}">English</button>
        <button data-lang="pt" class="${isPT ? 'on' : ''}">Português (BR)</button>
      </div>
      <div class="shint">${L('Five years. Fifty squares a year. 150 seats. Win 76 alone — or win the most elections.', 'Cinco anos. Cinquenta casas por ano. 150 cadeiras. Conquiste 76 sozinho — ou vença mais eleições.')}</div>
      <div class="credits">${L('Created by', 'Criado por')} <b>Gabriel Casanova</b></div>
    </div>`;

  const countHTML = () => `<div class="setupbox">
      ${header(true)}${steps()}
      <div class="wq">${L('How many parties will compete?', 'Quantos partidos vão disputar?')}</div>
      <div class="bigcount">
        ${[3, 4, 5, 6].map((n) => `<button data-count="${n}" class="${n === count ? 'on' : ''}"><b>${n}</b><span>${L('players', 'jogadores')}</span></button>`).join('')}
      </div>
      <div class="whint">${L('You choose who is human and who is played by the computer in the next step.', 'No próximo passo você escolhe quem é humano e quem é controlado pelo computador.')}</div>
      <div class="wnav"><button class="wback" data-nav="back">◀ ${L('Back', 'Voltar')}</button><button class="start" data-nav="next">${L('Next', 'Próximo')} ▶</button></div>
    </div>`;

  const customHTML = (s: Slot) => `<div class="custom wcustom" style="--pc:${css(s.color)}">
      <div class="crow">
        <input class="cname" data-f="name" maxlength="28" value="${esc(s.name)}" placeholder="${L('Party name', 'Nome do partido')}" />
        <input type="color" data-f="color" value="${css(s.color)}" title="${L('Party colour', 'Cor do partido')}" />
      </div>
      <div class="icons">${CUSTOM_ICONS.map((ic) => `<button data-icon="${ic}" class="${ic === s.icon ? 'on' : ''}">${ic}</button>`).join('')}</div>
      ${AXIS_KEYS.map(
        (k: AxisKey) => `<label class="axis"><span class="al">${AXIS_INFO[k].low}</span>
          <input type="range" min="1" max="4" step="0.5" data-axis="${k}" value="${s.axes[k]}" />
          <span class="ah">${AXIS_INFO[k].high}</span><output>${s.axes[k]}</output></label>`,
      ).join('')}
    </div>`;

  const partyHTML = (i: number) => {
    const s = slots[i];
    const cur = partyOf(s);
    const cards = PREBUILT_PARTIES.map((pp, j) => {
      const by = takenBy(j, i);
      const taken = by >= 0;
      return `<button class="pcardpick ${s.choice === j ? 'on' : ''}" data-pick="${j}" ${taken ? 'disabled' : ''} style="--pc:${css(pp.color)}">
          <span class="pkicon">${emblem(pp)}</span>
          <span class="pkname">${pp.name}</span>
          <span class="pktag">${pp.tagline}</span>
          <span class="chips">${axesSummary(pp.axes)}</span>
          ${taken ? `<span class="pktaken">${L('Taken by', 'Escolhido por')} P${by + 1}</span>` : ''}
        </button>`;
    }).join('');
    const customCard = `<button class="pcardpick custompick ${s.choice < 0 ? 'on' : ''}" data-pick="-1" style="--pc:${css(s.color)}">
        <span class="pkicon">✏️</span><span class="pkname">${L('Create your own', 'Crie o seu')}</span>
        <span class="pktag">${L('Name, colour, emblem and ideology', 'Nome, cor, emblema e ideologia')}</span>
      </button>`;
    const last = i === count - 1;
    return `<div class="setupbox" style="--pc:${css(cur.color)}">
      ${header(true)}${steps()}
      <div class="wplayer">
        <div class="wpemblem">${emblem(cur)}</div>
        <div class="wpinfo">
          <div class="wpnum">${L('Player', 'Jogador')} ${i + 1} ${L('of', 'de')} ${count}</div>
          <div class="wpname">${cur.name}</div>
        </div>
        <div class="seg2">
          <button data-ai="0" class="${s.isAI ? '' : 'on'}">🧑 ${L('Human', 'Humano')}</button>
          <button data-ai="1" class="${s.isAI ? 'on' : ''}">🤖 ${L('Computer', 'Computador')}</button>
        </div>
      </div>
      <div class="wq">${L('Choose a party', 'Escolha um partido')}</div>
      <div class="pickgrid">${cards}${customCard}</div>
      ${s.choice < 0 ? customHTML(s) : ''}
      <div class="wnav"><button class="wback" data-nav="back">◀ ${L('Back', 'Voltar')}</button>
        <button class="start" data-nav="next">${backToConfirm || last ? L('Review line-up', 'Revisar escalação') : `${L('Next player', 'Próximo jogador')}`} ▶</button></div>
    </div>`;
  };

  const confirmHTML = () => {
    const rows = slots
      .slice(0, count)
      .map((s, i) => {
        const p = partyOf(s);
        return `<div class="crow2" style="--pc:${css(p.color)}">
          <span class="cpn">P${i + 1}</span><span class="cicon">${emblem(p)}</span>
          <span class="cinfo"><b>${esc(p.name)}</b><small>${p.tagline}</small></span>
          <span class="cwho">${s.isAI ? `🤖 ${L('Computer', 'Computador')}` : `🧑 ${L('Human', 'Humano')}`}</span>
          <button class="cedit" data-edit="${i}">✏️ ${L('Change', 'Alterar')}</button>
        </div>`;
      })
      .join('');
    const humans = slots.slice(0, count).filter((s) => !s.isAI).length;
    return `<div class="setupbox">
      ${header(true)}${steps()}
      <div class="wq">${L('Ready to campaign?', 'Pronto para a campanha?')}</div>
      <div class="confirmlist">${rows}</div>
      <div class="whint">${
        humans
          ? L(
              `${humans} human player${humans > 1 ? 's' : ''} · ${count - humans} computer`,
              `${humans} ${humans > 1 ? 'jogadores humanos' : 'jogador humano'} · ${count - humans} computador`,
            )
          : L(
              'No human players: you will watch the computer play.',
              'Nenhum jogador humano: você vai assistir o computador jogar.',
            )
      }</div>
      <div class="serr" id="serr"></div>
      <div class="wnav"><button class="wback" data-nav="back">◀ ${L('Back', 'Voltar')}</button><button class="start" data-nav="start">${L('Start the Campaign', 'Começar a Campanha')} ▶</button></div>
    </div>`;
  };

  const render = () => {
    root.innerHTML =
      step.kind === 'menu'
        ? menuHTML()
        : step.kind === 'count'
          ? countHTML()
          : step.kind === 'party'
            ? partyHTML(step.i)
            : confirmHTML();
  };

  const go = (next: Step) => {
    step = next;
    if (step.kind === 'party') ensureFree(step.i);
    render();
    root.scrollTop = 0;
  };

  render();
  root.classList.remove('hidden');

  return new Promise((resolve) => {
    root.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest<HTMLButtonElement>('button');
      if (!btn || btn.disabled) return;
      const d = btn.dataset;

      if (d.lang) {
        if ((d.lang === 'pt') !== isPT) setLang(d.lang as 'en' | 'pt');
        return;
      }
      if (d.go === 'new') return go({ kind: 'count' });
      if (d.go === 'look') {
        root.classList.add('hidden');
        await hooks.freeLook();
        root.classList.remove('hidden');
        return;
      }
      if (d.count) {
        count = Number(d.count);
        return render();
      }
      if (step.kind === 'party') {
        const s = slots[step.i];
        if (d.ai) {
          s.isAI = d.ai === '1';
          return render();
        }
        if (d.pick) {
          s.choice = Number(d.pick);
          return render();
        }
        if (d.icon) {
          s.icon = d.icon;
          return render();
        }
      }
      if (d.edit) {
        backToConfirm = true;
        return go({ kind: 'party', i: Number(d.edit) });
      }

      if (d.nav === 'back') {
        if (step.kind === 'count') return go({ kind: 'menu' });
        if (step.kind === 'party') {
          if (backToConfirm) {
            backToConfirm = false;
            return go({ kind: 'confirm' });
          }
          return go(step.i === 0 ? { kind: 'count' } : { kind: 'party', i: step.i - 1 });
        }
        if (step.kind === 'confirm') return go({ kind: 'party', i: count - 1 });
      }
      if (d.nav === 'next') {
        if (step.kind === 'count') return go({ kind: 'party', i: 0 });
        if (step.kind === 'party') {
          if (backToConfirm || step.i === count - 1) {
            backToConfirm = false;
            return go({ kind: 'confirm' });
          }
          return go({ kind: 'party', i: step.i + 1 });
        }
      }
      if (d.nav === 'start') {
        const chosen = slots.slice(0, count);
        const picks = chosen.filter((s) => s.choice >= 0).map((s) => s.choice);
        if (new Set(picks).size !== picks.length) {
          document.getElementById('serr')!.textContent = L(
            'Each prebuilt party can only be chosen once.',
            'Cada partido pronto só pode ser escolhido uma vez.',
          );
          return;
        }
        root.classList.add('hidden');
        resolve(chosen.map((s) => ({ party: partyOf(s), isAI: s.isAI })));
      }
    });

    root.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (step.kind !== 'party') return;
      const s = slots[step.i];
      if (t.dataset.f === 'color') {
        s.color = parseInt(t.value.slice(1), 16);
        render();
      }
    });

    root.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (step.kind !== 'party') return;
      const s = slots[step.i];
      if (t.dataset.f === 'name') {
        s.name = t.value;
        const nameEl = root.querySelector('.wpname');
        if (nameEl) nameEl.textContent = s.name.trim() || L('Custom Party', 'Partido Personalizado');
      }
      const axis = t.dataset.axis as AxisKey | undefined;
      if (axis) {
        s.axes[axis] = Number(t.value);
        t.parentElement!.querySelector('output')!.textContent = t.value;
      }
    });
  });
}
