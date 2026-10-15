/** MEDIA deck: press opportunities drawn on Media squares (press conference or campaign rally). */
import type { MediaDef } from '../core/types';
import { isPT } from '../i18n';
import { MEDIA_PT } from '../i18n/pt-BR';

export const MEDIA_EVENTS: MediaDef[] = [
  {
    key: 'primetime',
    name: 'Prime-Time Interview',
    flavor: 'The country’s top anchor wants an hour with your leader.',
    draw: 2,
    rallyCost: 3,
    rallyGain: 4,
  },
  {
    key: 'morning',
    name: 'Morning Talk Show',
    flavor: 'A cosy sofa, a friendly host, millions of viewers with coffee.',
    draw: 2,
    rallyCost: 2,
    rallyGain: 3,
  },
  {
    key: 'townhall',
    name: 'Televised Town Hall',
    flavor: 'Ordinary citizens ask the questions, live.',
    draw: 2,
    rallyCost: 4,
    rallyGain: 6,
  },
  {
    key: 'viral',
    name: 'Viral Social Campaign',
    flavor: 'Your digital team has a meme ready to go.',
    draw: 3,
    rallyCost: 3,
    rallyGain: 4,
  },
  {
    key: 'oped',
    name: 'Newspaper Op-Ed',
    flavor: 'A national paper offers your leader a column.',
    draw: 2,
    rallyCost: 0,
    rallyGain: 2,
  },
  {
    key: 'podcast',
    name: 'Celebrity Podcast',
    flavor: 'Three hours with the nation’s most famous comedian.',
    draw: 2,
    rallyCost: 5,
    rallyGain: 7,
  },
  {
    key: 'watchparty',
    name: 'Debate Watch Party',
    flavor: 'Supporters gather in bars across the country.',
    draw: 2,
    rallyCost: 2,
    rallyGain: 4,
  },
  {
    key: 'radio',
    name: 'Regional Radio Tour',
    flavor: 'Twelve stations, twelve towns, one long day.',
    draw: 3,
    rallyCost: 2,
    rallyGain: 3,
  },
];

if (isPT) for (const m of MEDIA_EVENTS) Object.assign(m, MEDIA_PT[m.key] ?? {});
