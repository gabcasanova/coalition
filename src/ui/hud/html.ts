/** Small helpers shared by the HUD: colours, element lookup, emblems and card markup. */
import { emblemImage } from '../../assets';
import * as R from '../../core/rules';
import { AXIS_KEYS, type Card, type EventCardView, type PartyDef, type Player } from '../../core/types';
import { KIND_LABEL } from '../../data/strategyCards';
import { L } from '../../i18n';

/** A hex colour number as a CSS colour (0xff8800 → "#ff8800"). */
export const css = (color: number) => '#' + color.toString(16).padStart(6, '0');

/** An element of index.html by id (they always exist). */
export const byId = (id: string) => document.getElementById(id)!;

/** A party's emblem for HTML: its image from the assets if there is one, otherwise its emoji. */
export function emblem(party: PartyDef): string {
  const img = emblemImage(party.key);
  return img ? `<img class="emblem-img" src="${img.src}" alt="">` : party.icon;
}

/** A card from a hand. With `viewer`, a bill shows how much popularity it would win or lose that party. */
export function cardHTML(card: Card, viewer?: Player): string {
  let body = `<div class="cflav">${card.text}</div>`;
  let foot = '';
  if (card.kind === 'bill' && card.target) {
    const chips = AXIS_KEYS.filter((k) => card.target![k] !== undefined)
      .map((k) => `<span class="chip">${R.poleName(k, card.target![k]!)}</span>`)
      .join('');
    body = `<div class="chips">${chips}</div>${body}`;
    if (viewer) {
      const delta = R.billDelta(viewer.party.axes, card.target);
      foot = `<div class="cfoot ${delta > 0 ? 'pos' : 'neg'}">${R.fmt(delta)} ${L('popularity', 'de popularidade')}</div>`;
    }
  } else if (card.kind === 'scandal') foot = `<div class="cfoot neg">${L('Rival', 'Rival')} −${card.power}</div>`;
  else if (card.kind === 'rally') foot = `<div class="cfoot pos">${card.cost} ⭐ → +${card.power}</div>`;
  return `<div class="card k-${card.kind}">
    <div class="ckind">${KIND_LABEL[card.kind]}</div>
    <div class="cname">${card.name}</div>
    ${body}${foot}
  </div>`;
}

/** An event card (crisis, lobby, media opportunity…) as shown in prompts and news. */
export function eventHTML(ev: EventCardView): string {
  return `<div class="evcard t-${ev.tone}">
    <div class="evsub">${ev.subtitle}</div>
    <div class="evtitle">${ev.title}</div>
    <div class="evflav">${ev.flavor}</div>
    <div class="evtext">${ev.text}</div>
  </div>`;
}
