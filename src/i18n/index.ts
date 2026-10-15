import type { PartyDef } from '../core/types';

/** Supported languages: English and Brazilian Portuguese. */
export type Lang = 'en' | 'pt';

const STORAGE_KEY = 'coalition.lang';

function loadLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'pt' ? 'pt' : 'en';
  } catch {
    return 'en';
  }
}

/** The language for this session (chosen on the title screen; changing it reloads the page). */
export const lang: Lang = loadLang();
export const isPT = lang === 'pt';

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable: the choice lasts only for this load */
  }
  location.reload();
}

/** Pick the string for the current language. */
export const L = (en: string, pt: string): string => (isPT ? pt : en);

// ───────────── Portuguese articles for party names ─────────────

/** Grammatical gender of a party name in Portuguese ("o Partido…", "a União…"). */
export function partyArticle(p: PartyDef): 'o' | 'a' {
  if (p.article) return p.article;
  const first = p.name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return /(a|ão|ade|gem)$/.test(first) && first !== 'partido' ? 'a' : 'o';
}

/** "o"/"a" (lower case) for this party. */
export const art = (p: PartyDef) => partyArticle(p);
/** "do"/"da" — of the party. */
export const deArt = (p: PartyDef) => (partyArticle(p) === 'a' ? 'da' : 'do');
/** "ao"/"à" — to the party. */
export const aoArt = (p: PartyDef) => (partyArticle(p) === 'a' ? 'à' : 'ao');
/** "pelo"/"pela" — by the party. */
export const peloArt = (p: PartyDef) => (partyArticle(p) === 'a' ? 'pela' : 'pelo');
