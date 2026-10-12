import { isPT } from './i18n';
import { PARTIES_PT } from './locale_pt';
import type { PartyDef } from './types';

export const PREBUILT_PARTIES: PartyDef[] = [
  {
    name: 'National Union',
    short: 'NU',
    icon: '🦅',
    tagline: 'Center-Right · Liberal-Conservative',
    color: 0x2f6fd6,
    axes: { econ: 3, social: 3, env: 2, inst: 3 },
  },
  {
    name: 'Democratic-Labour Party',
    short: 'DLP',
    icon: '🌹',
    tagline: 'Center-Left · Social-Democratic',
    color: 0xe0457b,
    axes: { econ: 2, social: 2, env: 3, inst: 2 },
  },
  {
    name: "Citizens' Party",
    short: 'CP',
    icon: '🗽',
    tagline: 'Centrist · Liberal',
    color: 0xff9a1f,
    axes: { econ: 3, social: 2, env: 2.5, inst: 2 },
  },
  {
    name: "Socialist Worker's Party",
    short: 'SWP',
    icon: '✊',
    tagline: 'Far-Left · Socialist-Marxist',
    color: 0xc62828,
    axes: { econ: 1, social: 2, env: 1, inst: 1 },
  },
  {
    name: 'Communist Party',
    short: 'PCO',
    icon: '☭',
    tagline: 'Far-Left · Marxist-Leninist',
    color: 0x8b0d1e,
    axes: { econ: 1, social: 2.5, env: 1.5, inst: 4 },
  },
  {
    name: 'Alliance for the Country',
    short: 'AfC',
    icon: '🦁',
    tagline: 'Far-Right · National-Conservative',
    color: 0x7cb342,
    axes: { econ: 3, social: 4, env: 1, inst: 4 },
  },
];

// Brazilian Portuguese names, taglines and grammatical gender.
if (isPT) for (const p of PREBUILT_PARTIES) Object.assign(p, PARTIES_PT[p.short] ?? {});

export const CUSTOM_COLORS = [0x26c6da, 0xab47bc, 0xffd54f, 0x8d6e63, 0x5c6bc0, 0x00bfa5];

/** Emblems a custom party can pick from. */
export const CUSTOM_ICONS = ['🌿', '🏴‍☠️', '⚙️', '⭐', '🐝', '🌻', '🔥', '🌊', '🕊️', '🐺', '🚀', '⚡'];

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase());
  return letters.slice(0, 3).join('') || 'P';
}
