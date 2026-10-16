/**
 * The country's electoral districts. Each district elects several MPs (150 in total) by the D'Hondt method, so
 * seats follow the votes in each district rather than across the whole country, with the usual distortions:
 * big parties win a seat bonus, regional strongholds matter, and rural districts are over-represented.
 *
 * `lean` is the district's political character on the four axes (1..4, like the parties): parties close to it do
 * better there. `x`/`y` place the district on the election-night map (x 0..1.4 left to right, y 0..1 top to bottom).
 */
import type { Axes } from '../core/types';
import { L } from '../i18n';

export interface DistrictDef {
  key: string;
  name: string;
  /** MPs elected here. */
  seats: number;
  lean: Axes;
  /** Rural districts have fewer voters per seat (their votes weigh more), as in many real parliaments. */
  rural?: boolean;
  x: number;
  y: number;
}

/**
 * Kinds of district and how they lean (economy, social, environment, institutions). The country covers the whole
 * spectrum, so every kind of party has heartlands: union towns and the old coal country on the left, the border
 * and the farm belt on the right, coasts and campuses for the progressives, suburbs and market towns for the
 * centre-right, and a capital in the middle.
 */
const LEAN = {
  // Radical left
  unionTown: { econ: 1.1, social: 2.0, env: 1.1, inst: 1.2 },
  portCity: { econ: 1.6, social: 1.9, env: 1.6, inst: 1.6 },
  coalCountry: { econ: 1.1, social: 2.5, env: 1.5, inst: 3.8 },
  oldIndustrial: { econ: 1.5, social: 2.4, env: 1.8, inst: 3.2 },
  // Progressive centre-left
  coast: { econ: 2.0, social: 2.0, env: 3.1, inst: 2.0 },
  university: { econ: 1.9, social: 1.6, env: 3.3, inst: 1.8 },
  // Centre
  capital: { econ: 2.9, social: 2.0, env: 2.5, inst: 2.1 },
  islands: { econ: 3.0, social: 2.1, env: 2.6, inst: 1.9 },
  // Centre-right
  suburbs: { econ: 3.2, social: 3.0, env: 2.0, inst: 3.0 },
  marketTowns: { econ: 3.0, social: 3.0, env: 2.2, inst: 2.8 },
  heartland: { econ: 2.8, social: 2.9, env: 2.1, inst: 2.8 },
  highlands: { econ: 2.9, social: 3.1, env: 2.2, inst: 2.6 },
  // Right
  farmBelt: { econ: 3.0, social: 3.7, env: 1.2, inst: 3.6 },
  border: { econ: 3.0, social: 3.9, env: 1.1, inst: 3.9 },
} satisfies Record<string, Axes>;

export const DISTRICTS: DistrictDef[] = [
  { key: 'capital', name: L('The Capital', 'A Capital'), seats: 20, lean: LEAN.capital, x: 0.7, y: 0.52 },
  {
    key: 'suburbs',
    name: L('Capital Suburbs', 'Subúrbios da Capital'),
    seats: 9,
    lean: LEAN.suburbs,
    x: 0.82,
    y: 0.42,
  },
  { key: 'harbour', name: L('Harbour City', 'Cidade Portuária'), seats: 13, lean: LEAN.portCity, x: 1.18, y: 0.62 },
  {
    key: 'north-metro',
    name: L('Northern Metropolis', 'Metrópole do Norte'),
    seats: 10,
    lean: LEAN.oldIndustrial,
    x: 0.62,
    y: 0.22,
  },
  { key: 'steel', name: L('Steel Valley', 'Vale do Aço'), seats: 7, lean: LEAN.unionTown, x: 0.45, y: 0.2 },
  { key: 'mills', name: L('Mill Towns', 'Cidades Fabris'), seats: 6, lean: LEAN.unionTown, x: 0.33, y: 0.32 },
  {
    key: 'coalfields',
    name: L('Red Coalfields', 'Bacia Carbonífera'),
    seats: 5,
    lean: LEAN.coalCountry,
    x: 0.22,
    y: 0.18,
  },
  {
    key: 'iron-hills',
    name: L('Iron Hills', 'Serra do Ferro'),
    seats: 4,
    lean: LEAN.coalCountry,
    x: 0.12,
    y: 0.36,
    rural: true,
  },
  {
    key: 'highlands',
    name: L('Western Highlands', 'Planalto Ocidental'),
    seats: 4,
    lean: LEAN.highlands,
    x: 0.12,
    y: 0.6,
    rural: true,
  },
  {
    key: 'plains',
    name: L('Great Plains', 'Grandes Planícies'),
    seats: 6,
    lean: LEAN.farmBelt,
    x: 0.38,
    y: 0.55,
    rural: true,
  },
  {
    key: 'wheat',
    name: L('Wheat Belt', 'Cinturão do Trigo'),
    seats: 5,
    lean: LEAN.farmBelt,
    x: 0.3,
    y: 0.73,
    rural: true,
  },
  {
    key: 'cattle',
    name: L('Cattle Country', 'Terra do Gado'),
    seats: 4,
    lean: LEAN.farmBelt,
    x: 0.18,
    y: 0.84,
    rural: true,
  },
  {
    key: 'south-border',
    name: L('Southern Border', 'Fronteira Sul'),
    seats: 5,
    lean: LEAN.border,
    x: 0.46,
    y: 0.9,
    rural: true,
  },
  {
    key: 'frontier',
    name: L('Frontier March', 'Marcha da Fronteira'),
    seats: 4,
    lean: LEAN.border,
    x: 0.06,
    y: 0.82,
    rural: true,
  },
  { key: 'delta', name: L('River Delta', 'Delta do Rio'), seats: 6, lean: LEAN.coast, x: 0.98, y: 0.84 },
  { key: 'gold-coast', name: L('Golden Coast', 'Costa Dourada'), seats: 5, lean: LEAN.coast, x: 1.24, y: 0.82 },
  { key: 'lakes', name: L('Lake District', 'Região dos Lagos'), seats: 4, lean: LEAN.coast, x: 0.94, y: 0.28 },
  {
    key: 'university',
    name: L('University Town', 'Cidade Universitária'),
    seats: 6,
    lean: LEAN.university,
    x: 0.98,
    y: 0.52,
  },
  { key: 'east-shore', name: L('Eastern Shore', 'Litoral Leste'), seats: 5, lean: LEAN.coast, x: 1.28, y: 0.38 },
  {
    key: 'pines',
    name: L('Pine Forests', 'Pinheirais'),
    seats: 4,
    lean: LEAN.coalCountry,
    x: 0.8,
    y: 0.12,
    rural: true,
  },
  { key: 'midlands', name: L('Midlands', 'Interior'), seats: 8, lean: LEAN.heartland, x: 0.58, y: 0.72 },
  {
    key: 'market-towns',
    name: L('Market Towns', 'Cidades Mercantis'),
    seats: 5,
    lean: LEAN.marketTowns,
    x: 0.8,
    y: 0.76,
  },
  {
    key: 'north-isles',
    name: L('Northern Isles', 'Ilhas do Norte'),
    seats: 3,
    lean: LEAN.islands,
    x: 1.24,
    y: 0.06,
    rural: true,
  },
  {
    key: 'south-isles',
    name: L('Southern Isles', 'Ilhas do Sul'),
    seats: 2,
    lean: LEAN.islands,
    x: 1.38,
    y: 0.97,
    rural: true,
  },
];
