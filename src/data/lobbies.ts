/** LOBBY deck: interest groups drawn on Lobby squares. They back parties on one pole of one ideology axis. */
import type { LobbyDef } from '../core/types';
import { isPT } from '../i18n';
import { LOBBIES_PT } from '../i18n/pt-BR';

export const LOBBIES: LobbyDef[] = [
  {
    key: 'agro',
    name: 'Agribusiness Federation',
    flavor: 'The agricultural lobby offers campaign backing in exchange for votes.',
    axis: 'env',
    side: 'low',
    capital: 7,
    penalty: 8,
  },
  {
    key: 'unions',
    name: 'Trade Union Congress',
    flavor: 'The unions will mobilise their members — for a price.',
    axis: 'econ',
    side: 'low',
    capital: 7,
    penalty: 7,
  },
  {
    key: 'chamber',
    name: 'Industrial Chamber',
    flavor: 'Captains of industry want a friend in parliament.',
    axis: 'econ',
    side: 'high',
    capital: 8,
    penalty: 7,
  },
  {
    key: 'religious',
    name: 'Religious Council',
    flavor: 'Church leaders offer their pulpits to a sympathetic party.',
    axis: 'social',
    side: 'high',
    capital: 6,
    penalty: 8,
  },
  {
    key: 'green',
    name: 'Green Alliance NGOs',
    flavor: 'Environmental groups offer volunteers and a donor list.',
    axis: 'env',
    side: 'high',
    capital: 6,
    penalty: 6,
  },
  {
    key: 'tech',
    name: 'Tech & Startups Association',
    flavor: 'Young founders want a modern, open society.',
    axis: 'social',
    side: 'low',
    capital: 7,
    penalty: 5,
  },
  {
    key: 'assemblies',
    name: 'Citizens’ Assemblies Network',
    flavor: 'Grassroots democrats offer an army of canvassers.',
    axis: 'inst',
    side: 'low',
    capital: 6,
    penalty: 5,
  },
  {
    key: 'security',
    name: 'Security & Defense Council',
    flavor: 'Generals and police chiefs seek a strong hand.',
    axis: 'inst',
    side: 'high',
    capital: 7,
    penalty: 6,
  },
  {
    key: 'banks',
    name: 'Banking Federation',
    flavor: 'The banks would like a word about regulation.',
    axis: 'econ',
    side: 'high',
    capital: 8,
    penalty: 9,
  },
  {
    key: 'students',
    name: 'National Students’ Union',
    flavor: 'Students offer energy, memes and door-knocking.',
    axis: 'social',
    side: 'low',
    capital: 4,
    penalty: 4,
  },
];

if (isPT) for (const l of LOBBIES) Object.assign(l, LOBBIES_PT[l.key] ?? {});
