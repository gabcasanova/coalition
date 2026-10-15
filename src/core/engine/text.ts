/** Text helpers for the news stories: party names with articles, card descriptions, labels. */
import { aoArt, art, deArt, isPT, L } from '../../i18n';
import * as R from '../rules';
import {
  AXIS_INFO,
  AXIS_KEYS,
  type Card,
  type CardFace,
  type EventCardView,
  type LobbyDef,
  type MediaDef,
  type Player,
} from '../types';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export const pn = (p: Player) => `<b style="color:${hex(p.party.color)}">${p.party.name}</b>`;

// ───────────── party references in both languages ─────────────
/** "the National Union" / "a União Nacional". */
export const the = (p: Player) => (isPT ? `${art(p.party)} ${pn(p)}` : `the ${pn(p)}`);

/** Sentence-initial: "The National Union" / "A União Nacional". */
export const The = (p: Player) => (isPT ? `${art(p.party).toUpperCase()} ${pn(p)}` : `The ${pn(p)}`);

/** Portuguese "do/da X" (of the party). */
export const doP = (p: Player) => `${deArt(p.party)} ${pn(p)}`;

/** Portuguese "ao/à X" (to the party). */
export const aoP = (p: Player) => `${aoArt(p.party)} ${pn(p)}`;

/** "X and Y" / "X e Y". */
export const and = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} ${L('and', 'e')} ${items.at(-1)}` : (items[0] ?? '');

export const pop = (n: number) => L(`${R.fmt(n)} popularity`, `${R.fmt(n)} de popularidade`);

export const ordinal = (n: number) =>
  isPT ? (['', 'primeira', 'segunda', 'terceira'][n] ?? `${n}ª`) : (['', 'first', 'second', 'third'][n] ?? `${n}th`);

export const eventFace = (label: string, ev: { name: string; flavor: string; text: string }): CardFace => ({
  label,
  title: ev.name,
  flavor: ev.flavor,
  text: ev.text,
});

/** "Ecologism and Interventionism" for a bill's target positions. */
export const billStance = (c: Card) =>
  and(AXIS_KEYS.filter((k) => c.target![k] !== undefined).map((k) => R.poleName(k, c.target![k]!)));

export const lawText = (c: Card) =>
  L(
    `A bill rooted in ${billStance(c)}. Parties that share these values win popularity by introducing it; for anyone else it looks like a flip-flop. With ${R.MAJORITY} votes in parliament it becomes law.`,
    `Um projeto baseado em ${billStance(c)}. Partidos que compartilham esses valores ganham popularidade ao apresentá-lo; para os demais, parece incoerência. Com ${R.MAJORITY} votos no parlamento, vira lei.`,
  );

export const LABEL_BILL = L('POLICY BILL', 'PROJETO DE LEI');

export const LABEL_COALITION = L('🤝 COALITION BILL', '🤝 PROJETO DA COALIZÃO');

export const lawFace = (c: Card): CardFace => ({ label: LABEL_BILL, title: c.name, flavor: c.text, text: lawText(c) });

export const billView = (c: Card, coalition = false): EventCardView => ({
  title: c.name,
  subtitle: coalition ? LABEL_COALITION : LABEL_BILL,
  flavor: c.text,
  text: coalition
    ? `${lawText(c)} ${L('This is a coalition bill: every governing party is expected to vote for it.', 'É um projeto da coalizão: espera-se que todo partido do governo vote a favor.')}`
    : lawText(c),
  tone: coalition ? 'gov' : 'info',
});

export const LABEL_MEDIA = L('MEDIA & CAMPAIGNS', 'MÍDIA E CAMPANHA');

export const rallyText = (m: MediaDef) =>
  `${m.rallyCost ? `${m.rallyCost} ⭐` : L('Free', 'Grátis')} → +${m.rallyGain} ${L('popularity', 'de popularidade')}`;

export const mediaText = (m: MediaDef) =>
  L(
    `Use the spotlight for a press conference, drawing ${m.draw} strategy cards and keeping the best, or turn it into a campaign rally${m.rallyCost ? ` for ${m.rallyCost} ⭐ capital` : ' at no cost'} that wins ${m.rallyGain} popularity.`,
    `Use os holofotes numa coletiva de imprensa, comprando ${m.draw} cartas de estratégia e ficando com a melhor, ou transforme a ocasião num comício${m.rallyCost ? ` por ${m.rallyCost} ⭐ de capital` : ' sem custo'} que rende ${m.rallyGain} de popularidade.`,
  );

export const mediaFace = (m: MediaDef): CardFace => ({
  label: LABEL_MEDIA,
  title: m.name,
  flavor: m.flavor,
  text: mediaText(m),
});

export const LABEL_LOBBY = L('LOBBYISTS & FACTIONS', 'LOBISTAS E FACÇÕES');

export function lobbyText(lb: LobbyDef): string {
  const pole = lb.side === 'low' ? AXIS_INFO[lb.axis].low : AXIS_INFO[lb.axis].high;
  return L(
    `They back parties that stand for ${pole}, offering ${lb.capital} ⭐ Political Capital with no strings attached. Anyone else can take the deal too, but their own supporters will see it as a betrayal and ${lb.penalty} popularity walks out the door (half that for parties in the middle).`,
    `Eles apoiam partidos que defendem ${pole}, oferecendo ${lb.capital} ⭐ de Capital Político sem amarras. Qualquer outro pode aceitar também, mas os próprios apoiadores verão isso como traição e ${lb.penalty} de popularidade irão embora (metade disso para partidos de centro).`,
  );
}

export const LABEL_CRISIS = L('NATIONAL CRISIS', 'CRISE NACIONAL');
