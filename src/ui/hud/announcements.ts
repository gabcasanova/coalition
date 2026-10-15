/** Things that appear in the middle of the screen: news stories, the "now playing" card and banners. */
import type { Engine, Story } from '../../core/engine';
import { paced, sleep } from '../../core/settings';
import type { Player, Tone } from '../../core/types';
import { L } from '../../i18n';
import { cardHTML, css, emblem, eventHTML } from './html';

/** Label in the corner of a news story, by tone. */
const STORY_TAG: Record<Tone, string> = {
  event: L('BREAKING NEWS', 'PLANTÃO'),
  gov: L('GOVERNMENT', 'GOVERNO'),
  bad: L('SETBACK', 'REVÉS'),
  good: L('GOOD NEWS', 'BOAS NOTÍCIAS'),
  info: L('TODAY', 'HOJE'),
  turn: L('TODAY', 'HOJE'),
};

/**
 * A news window in the centre of the screen: "Today, the … decided to …" and "This means …", with the card
 * involved on the side. It stays until the player clicks (or presses Space/Enter): there is no timeout.
 */
export function showStory(host: HTMLElement, story: Story, engine: Engine): Promise<void> {
  const actor = story.actorId !== undefined ? engine.players[story.actorId] : undefined;
  const accent = actor ? css(actor.party.color) : '#e8c35a';
  const side = story.event
    ? eventHTML(story.event)
    : story.card
      ? `<div class="stcard">${cardHTML(story.card)}</div>`
      : '';
  const who = actor
    ? `<div class="stwho"><span class="emb">${emblem(actor.party)}</span>${actor.party.name}${actor.isAI ? ` · ${L('AI', 'IA')}` : ''}</div>`
    : '';
  host.innerHTML = `<div class="story t-${story.tone} ${side ? 'withside' : ''}" style="--ac:${accent}">
    <div class="sthead">
      <span class="live">● ${L('LIVE', 'AO VIVO')}</span>
      <span class="net">${L('COALITION NEWS NETWORK', 'REDE COALIZÃO DE NOTÍCIAS')}</span>
      <span class="sttag">${STORY_TAG[story.tone]}</span>
      <span class="nyr">${L('YEAR', 'ANO')} ${engine.year}</span>
    </div>
    <div class="stbody">
      ${side ? `<div class="stside">${side}</div>` : ''}
      <div class="stmain">
        ${who}
        <div class="sthl">${story.headline}</div>
        <div class="stmeans"><span class="stlabel">${L('THIS MEANS', 'O QUE ISSO SIGNIFICA')}</span>${story.meaning}</div>
      </div>
    </div>
    <div class="stfoot"><button class="stnext">${L('Continue ▶', 'Continuar ▶')}</button><span>${L('or press Space', 'ou aperte Espaço')}</span></div>
  </div>`;
  host.classList.remove('hidden');

  // Ignore input for a moment so a click meant for the previous window doesn't skip this one.
  const openedAt = performance.now();
  return new Promise((resolve) => {
    const close = () => {
      if (performance.now() - openedAt < 350) return;
      host.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
      host.classList.add('hidden');
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault();
        close();
      }
    };
    host.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
  });
}

/** The big "NOW PLAYING" card at the start of a turn, shown for a moment. */
export async function showTurnCard(host: HTMLElement, p: Player, engine: Engine): Promise<void> {
  const humans = engine.players.filter((q) => !q.isAI).length;
  const who = p.isAI
    ? L('🤖 AI party', '🤖 Partido da IA')
    : humans > 1
      ? L('🧑 Human player — your turn', '🧑 Jogador humano — sua vez')
      : L('🧑 Your turn', '🧑 Sua vez');
  host.innerHTML = `<div class="tc" style="--pc:${css(p.party.color)}">
    <div class="tclabel">${L('NOW PLAYING', 'JOGANDO AGORA')}</div>
    <div class="tcicon">${emblem(p.party)}</div>
    <div class="tcname">${p.party.name}</div>
    <div class="tcsub">${who} · ${L('Year', 'Ano')} ${engine.year}</div>
  </div>`;
  host.classList.remove('hidden');
  await sleep(paced(p.isAI ? 1900 : 1400));
  host.classList.add('hidden');
}

/** The small persistent "NOW PLAYING" label. */
export function nowPlayingHTML(p: Player): string {
  return `<span class="nplabel">${L('NOW PLAYING', 'JOGANDO AGORA')}</span>
    <span class="npname" style="color:${css(p.party.color)}">${emblem(p.party)} ${p.party.name}</span>
    ${p.isAI ? `<span class="npai">${L('AI', 'IA')}</span>` : ''}`;
}

/** A banner across the top of the screen for a couple of seconds. */
export async function showBanner(host: HTMLElement, title: string, text: string, tone: Tone): Promise<void> {
  host.className = `t-${tone}`;
  host.innerHTML = `<div class="btitle">${title}</div><div class="btext">${text}</div>`;
  await sleep(paced(2300));
  host.className = 'hidden';
}
