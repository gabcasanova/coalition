/** Decisions for human players: the action bar, dialogs, cards with their choices printed on them, the wheel. */
import type { Player, Prompt } from '../../core/types';
import { L } from '../../i18n';
import { cardHTML, css, emblem, eventHTML } from './html';

/** Where prompts are shown: the slim action bar at the bottom, or the modal dialog. */
export interface PromptHosts {
  bar: HTMLElement;
  modal: HTMLElement;
}

/** Shows a prompt and resolves with the index of the chosen option (-1 if `signal` aborts it). */
export function showPrompt(
  hosts: PromptHosts,
  prompt: Prompt,
  p: Player,
  humans: number,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve) => {
    const asBar = prompt.mode === 'bar';
    const host = asBar ? hosts.bar : hosts.modal;
    const who = `${emblem(p.party)} ${p.party.name}${humans > 1 ? L(' — your decision', ' — sua decisão') : ''}`;

    if (prompt.event && !asBar) host.innerHTML = cardPromptHTML(prompt, p, who);
    else host.innerHTML = dialogHTML(prompt, p, who, asBar);
    host.classList.remove('hidden');

    const done = (i: number) => {
      window.removeEventListener('keydown', onKey);
      signal?.removeEventListener('abort', onAbort);
      host.classList.add('hidden');
      host.innerHTML = '';
      resolve(i);
    };
    const onAbort = () => done(-1);
    signal?.addEventListener('abort', onAbort, { once: true });
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
 * when the wheel is clicked; `disarmWheel` stops waiting for it. Resolves with -1 if `signal` aborts it.
 */
export function showSpinPrompt(
  bar: HTMLElement,
  prompt: Prompt,
  p: Player,
  armWheel: () => Promise<void>,
  disarmWheel?: () => void,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve) => {
    bar.innerHTML = `<div class="pr pbar spinhint" style="--pc:${css(p.party.color)}">
      <div class="prwho">${emblem(p.party)} ${p.party.name}</div>
      <div class="prtitle">${prompt.title}</div>
      <div class="spincta">🎡 ${L('<b>Click the wheel</b> to spin it <span>(or press Space)</span>', '<b>Clique na roleta</b> para girar <span>(ou aperte Espaço)</span>')}</div>
    </div>`;
    bar.classList.remove('hidden');
    let finished = false;
    const done = (i = 0) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('keydown', onKey);
      signal?.removeEventListener('abort', onAbort);
      disarmWheel?.();
      bar.classList.add('hidden');
      bar.innerHTML = '';
      resolve(i);
    };
    const onAbort = () => done(-1);
    signal?.addEventListener('abort', onAbort, { once: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        done();
      }
    };
    window.addEventListener('keydown', onKey);
    void armWheel().then(() => done());
  });
}

/**
 * The yearly draft: the bills dealt to a human fan in, and the player picks `count` of them (click to toggle;
 * "Best for my ideology" picks for them). Resolves with the picked indices, or null if `signal` aborts it.
 */
export function showDraft(
  modal: HTMLElement,
  prompt: Prompt,
  p: Player,
  count: number,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const cards = prompt.options
    .map(
      (o, i) =>
        `<button class="dealt draftcard" data-i="${i}" style="animation-delay:${i * 0.08}s">${o.card ? cardHTML(o.card, p) : o.label}</button>`,
    )
    .join('');
  modal.innerHTML = `<div class="pr pdialog openinghand draft" style="--pc:${css(p.party.color)}">
    <div class="prwho">${emblem(p.party)} ${p.party.name}</div>
    <div class="prtitle">${prompt.title}</div>
    ${prompt.body ? `<div class="prbody">${prompt.body}</div>` : ''}
    <div class="dealhand">${cards}</div>
    <div class="opts">
      <button class="opt" id="draftbest"><span class="ol">✨ ${L('Best for my ideology', 'Melhores para minha ideologia')}</span></button>
      <button class="opt primary" id="draftgo" disabled><span class="ol" id="draftcount"></span></button>
    </div>
  </div>`;
  modal.classList.remove('hidden');
  const picked = new Set<number>();
  const go = modal.querySelector<HTMLButtonElement>('#draftgo')!;
  const buttons = [...modal.querySelectorAll<HTMLButtonElement>('.draftcard')];
  const render = () => {
    buttons.forEach((b) => b.classList.toggle('on', picked.has(Number(b.dataset.i))));
    modal.classList.toggle('full', picked.size >= count);
    go.disabled = picked.size !== count;
    modal.querySelector('#draftcount')!.textContent =
      picked.size === count
        ? L(`Keep these ${count} bills ▶`, `Ficar com estes ${count} projetos ▶`)
        : L(`Pick ${count - picked.size} more`, `Escolha mais ${count - picked.size}`);
  };
  render();
  return new Promise((resolve) => {
    const close = (result: number[] | null) => {
      signal?.removeEventListener('abort', onAbort);
      modal.classList.add('hidden');
      modal.classList.remove('full');
      modal.innerHTML = '';
      resolve(result);
    };
    const onAbort = () => close(null);
    signal?.addEventListener('abort', onAbort, { once: true });
    for (const b of buttons) {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        if (picked.has(i)) picked.delete(i);
        else if (picked.size < count) picked.add(i);
        render();
      });
    }
    modal.querySelector('#draftbest')!.addEventListener('click', () => {
      picked.clear();
      prompt.options
        .map((o, i) => ({ i, v: o.ai }))
        .sort((a, b) => b.v - a.v)
        .slice(0, count)
        .forEach((x) => picked.add(x.i));
      render();
    });
    go.addEventListener('click', () => picked.size === count && close([...picked].sort((a, b) => a - b)));
  });
}
