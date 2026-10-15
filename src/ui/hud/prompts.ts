/** Decisions for human players: the action bar, dialogs, cards with their choices printed on them, the wheel. */
import type { Player, Prompt } from '../../core/types';
import { L } from '../../i18n';
import { cardHTML, css, emblem, eventHTML } from './html';

/** Where prompts are shown: the slim action bar at the bottom, or the modal dialog. */
export interface PromptHosts {
  bar: HTMLElement;
  modal: HTMLElement;
}

/** Shows a prompt and resolves with the index of the chosen option. */
export function showPrompt(hosts: PromptHosts, prompt: Prompt, p: Player, humans: number): Promise<number> {
  return new Promise((resolve) => {
    const asBar = prompt.mode === 'bar';
    const host = asBar ? hosts.bar : hosts.modal;
    const who = `${emblem(p.party)} ${p.party.name}${humans > 1 ? L(' — your decision', ' — sua decisão') : ''}`;

    if (prompt.event && !asBar) host.innerHTML = cardPromptHTML(prompt, p, who);
    else host.innerHTML = dialogHTML(prompt, p, who, asBar);
    host.classList.remove('hidden');

    const done = (i: number) => {
      window.removeEventListener('keydown', onKey);
      host.classList.add('hidden');
      host.innerHTML = '';
      resolve(i);
    };
    // In the action bar, Space/Enter picks the first available option.
    const onKey = (e: KeyboardEvent) => {
      if (!asBar || (e.code !== 'Space' && e.code !== 'Enter')) return;
      const i = prompt.options.findIndex((o) => !o.disabled);
      if (i >= 0) {
        e.preventDefault();
        done(i);
      }
    };
    window.addEventListener('keydown', onKey);
    host
      .querySelectorAll<HTMLButtonElement>('button[data-i]')
      .forEach((b) => b.addEventListener('click', () => done(Number(b.dataset.i))));
  });
}

/** The option's detail line and, if it can't be picked, why. */
const optionExtras = (o: Prompt['options'][number]) =>
  `${o.detail ? `<span class="od">${o.detail}</span>` : ''}${o.disabled ? `<span class="dis">${o.disabled}</span>` : ''}`;

/** The drawn card itself, with its choices printed on it as buttons. */
function cardPromptHTML(prompt: Prompt, p: Player, who: string): string {
  const ev = prompt.event!;
  const buttons = prompt.options
    .map((o, i) => {
      const colour = o.color !== undefined ? `style="--oc:${css(o.color)}"` : '';
      return `<button class="cpopt ${o.color !== undefined ? 'colored' : ''}" data-i="${i}" ${o.disabled ? 'disabled' : ''} ${colour}>
        <span class="ol">${o.card ? '🃏 ' : ''}${o.label}</span>${optionExtras(o)}
      </button>`;
    })
    .join('');
  return `<div class="pr cardprompt t-${ev.tone}" style="--pc:${css(p.party.color)}">
    <div class="cplabel">${ev.subtitle}</div>
    <div class="cpinner">
      <div class="cpwho">${who}</div>
      <div class="cptitle">${ev.title}</div>
      <div class="cpflav">${ev.flavor}</div>
      <div class="cptext">${ev.text}</div>
      ${prompt.body ? `<div class="cpbody">${prompt.body}</div>` : ''}
      <div class="cpq">${prompt.title === ev.title ? L('What will you do?', 'O que você vai fazer?') : prompt.title}</div>
      <div class="cpopts">${buttons}</div>
    </div>
  </div>`;
}

/** A dialog (or the action bar): title, optional card or event, explanation and option buttons. */
function dialogHTML(prompt: Prompt, p: Player, who: string, asBar: boolean): string {
  const hasCards = prompt.options.some((o) => o.card);
  const buttons = prompt.options
    .map((o, i) => {
      const disabled = o.disabled ? 'disabled' : '';
      if (o.card) {
        return `<button class="optcard" data-i="${i}" ${disabled}>${cardHTML(o.card, p)}<span class="oclabel">${o.label}</span>${optionExtras(o)}</button>`;
      }
      const colour = o.color !== undefined ? `style="--oc:${css(o.color)}"` : '';
      const classes = `opt ${asBar && i === 0 ? 'primary' : ''} ${o.color !== undefined ? 'colored' : ''}`;
      return `<button class="${classes}" data-i="${i}" ${disabled} ${colour}><span class="ol">${o.label}</span>${optionExtras(o)}</button>`;
    })
    .join('');
  return `<div class="pr ${asBar ? 'pbar' : 'pdialog'}" style="--pc:${css(p.party.color)}">
    <div class="prwho">${who}</div>
    <div class="prtitle">${prompt.title}</div>
    ${prompt.event ? eventHTML(prompt.event) : ''}
    ${prompt.showCard ? `<div class="prcard">${cardHTML(prompt.showCard, p)}</div>` : ''}
    ${prompt.body ? `<div class="prbody">${prompt.body}</div>` : ''}
    <div class="opts ${hasCards ? 'withcards' : ''}">${buttons}</div>
  </div>`;
}

/**
 * A spin prompt: the player clicks the 3D roulette wheel itself (Space/Enter also works). `armWheel` resolves
 * when the wheel is clicked; `disarmWheel` stops waiting for it.
 */
export function showSpinPrompt(
  bar: HTMLElement,
  prompt: Prompt,
  p: Player,
  armWheel: () => Promise<void>,
  disarmWheel?: () => void,
): Promise<number> {
  return new Promise((resolve) => {
    bar.innerHTML = `<div class="pr pbar spinhint" style="--pc:${css(p.party.color)}">
      <div class="prwho">${emblem(p.party)} ${p.party.name}</div>
      <div class="prtitle">${prompt.title}</div>
      <div class="spincta">🎡 ${L('<b>Click the wheel</b> to spin it <span>(or press Space)</span>', '<b>Clique na roleta</b> para girar <span>(ou aperte Espaço)</span>')}</div>
    </div>`;
    bar.classList.remove('hidden');
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('keydown', onKey);
      disarmWheel?.();
      bar.classList.add('hidden');
      bar.innerHTML = '';
      resolve(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        done();
      }
    };
    window.addEventListener('keydown', onKey);
    void armWheel().then(done);
  });
}

/** After the deal: a human player's opening bills fan in one by one. Resolves when the player continues. */
export function showOpeningHand(modal: HTMLElement, p: Player): Promise<void> {
  const cards = p.hand
    .map((c, i) => `<div class="dealt" style="animation-delay:${i * 0.12}s">${cardHTML(c, p)}</div>`)
    .join('');
  modal.innerHTML = `<div class="pr pdialog openinghand" style="--pc:${css(p.party.color)}">
    <div class="prwho">${emblem(p.party)} ${p.party.name}</div>
    <div class="prtitle">${L(`Your opening hand: ${p.hand.length} policy bills`, `Sua mão inicial: ${p.hand.length} projetos de lei`)}</div>
    <div class="prbody">${L(
      'These are the laws you can put before parliament. Bills in <b style="color:var(--good)">green</b> match your ideology and will win you popularity; bills in <b style="color:var(--bad)">red</b> go against it. Every Legislature square adds a new bill from the LAW deck, and you must introduce one.',
      'Estas são as leis que você pode levar ao plenário. Projetos em <b style="color:var(--good)">verde</b> combinam com sua ideologia e rendem popularidade; projetos em <b style="color:var(--bad)">vermelho</b> vão contra ela. Cada casa de Plenário adiciona um novo projeto do baralho de LEIS, e você deve apresentar um.',
    )}</div>
    <div class="dealhand">${cards}</div>
    <div class="opts">
      <button class="opt primary" id="takeseat"><span class="ol">${L('Take your seat in parliament ▶', 'Assumir sua cadeira no parlamento ▶')}</span></button>
    </div>
  </div>`;
  modal.classList.remove('hidden');
  return new Promise((resolve) => {
    modal.querySelector('#takeseat')!.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.innerHTML = '';
      resolve();
    });
  });
}
