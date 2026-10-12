import { isPT } from './i18n';
import { EVENTS_PT, LOBBIES_PT, MEDIA_PT } from './locale_pt';
import { lean } from './rules';
import type { AxisKey, Player } from './types';

/** A paid response to a popularity hit. */
export interface Mitigation {
  label: string;
  /** Cost in ⭐ Political Capital. */
  cost?: number;
  /** Multiplier applied to the loss (0 = negate, 0.5 = halve). */
  lossMult?: number;
  /** Alternatively cap the loss at this amount. */
  reduceTo?: number;
  /** Popularity gained instead of the loss. */
  gain?: number;
}

export interface EventDef {
  key: string;
  name: string;
  flavor: string;
  tags: string[];
  /** What the card does, told as a short narrative. */
  text: string;
  /** Cards with their own rules instead of a popularity hit. */
  special?: 'floorcross';
  /** Popularity change for this player before defenses (negative = loss). */
  delta: (p: Player) => number;
  options?: Mitigation[];
}

/** Multiplier depending on which pole of an axis the party leans to. */
function m(p: Player, k: AxisKey, lowMult: number, highMult: number): number {
  const l = lean(p.party.axes[k]);
  return l === 'low' ? lowMult : l === 'high' ? highMult : 1;
}
const byLean = (p: Player, k: AxisKey, low: number, balanced: number, high: number) => {
  const l = lean(p.party.axes[k]);
  return l === 'low' ? low : l === 'high' ? high : balanced;
};
const loss = (base: number, mult: number) => -Math.round(base * mult);

/** Drawn when the first party reaches the Midterm Convention each year. Hits every party. */
export const GLOBAL_CRISES: EventDef[] = [
  {
    key: 'recession',
    name: 'Economic Recession',
    flavor: 'A sudden market crash threatens employment and public spending.',
    tags: ['econ'],
    text: 'Voters blame whoever is in charge: every governing party loses 8 popularity, while the opposition gains 4. Parties that believe in state intervention look prepared and suffer only half the damage; free-market parties are blamed for the deregulation and take 50% more.',
    delta: (p) => (p.inGov ? loss(8, m(p, 'econ', 0.5, 1.5)) : 4),
    options: [
      { label: 'Pass a Stimulus Package', cost: 8, lossMult: 0, gain: 5 },
      { label: 'Blame International Markets', cost: 5, lossMult: 0 },
    ],
  },
  {
    key: 'inflation',
    name: 'Inflation Spike',
    flavor: 'Prices soar at the supermarket checkout. Voters want someone to blame.',
    tags: ['econ'],
    text: 'Shoppers turn on the free-marketeers, who lose 10 popularity. Interventionist parties point to their price controls and lose only 2; everyone in between loses 6. Those in government lose 2 more, because the buck stops with them.',
    delta: (p) => -byLean(p, 'econ', 2, 6, 10) - (p.inGov ? 2 : 0),
    options: [
      { label: 'Announce a Price Freeze', cost: 3, lossMult: 0.5 },
      { label: 'Subsidise Energy Bills', cost: 6, lossMult: 0 },
    ],
  },
  {
    key: 'climate',
    name: 'Climate Catastrophe',
    flavor: 'Record floods and wildfires ravage the countryside.',
    tags: ['env'],
    text: 'The Greens were right, and voters remember it: ecologist parties gain 3. Everyone else loses 6, and the developmentalists who fought climate rules lose half as much again. Governing parties take an extra 2 for the slow emergency response.',
    delta: (p) => (lean(p.party.axes.env) === 'high' ? 3 : loss(6, m(p, 'env', 1.5, 1)) - (p.inGov ? 2 : 0)),
    options: [
      { label: 'Fund Emergency Relief', cost: 6, lossMult: 0 },
      { label: 'Declare National Mourning', cost: 3, lossMult: 0.5 },
    ],
  },
  {
    key: 'corruption',
    name: 'Corruption Wave',
    flavor: 'A sprawling bribery network reaches the halls of power.',
    tags: ['corruption'],
    text: 'Every governing party is tarred with the same brush and loses 8 popularity, while the opposition gains 2 for keeping its hands clean. Centralist parties, who concentrated the power, suffer 50% more; direct-democracy parties only half.',
    delta: (p) => (p.inGov ? loss(8, m(p, 'inst', 0.5, 1.5)) : 2),
  },
  {
    key: 'migration',
    name: 'Migration Surge',
    flavor: 'A refugee crisis at the border dominates every headline.',
    tags: ['social'],
    text: 'Fear plays into the hands of social conservatives, who gain 3. Progressive parties are accused of naivety and lose 6; moderates lose 3. Whoever governs loses 2 more for losing control of the border.',
    delta: (p) => byLean(p, 'social', -6, -3, 3) - (p.inGov ? 2 : 0),
  },
  {
    key: 'pandemic',
    name: 'Pandemic Outbreak',
    flavor: 'A new virus spreads. Hospitals fill up and lockdown debates rage.',
    tags: ['health'],
    text: 'The government carries the weight of every hospital queue and loses 7 popularity; the opposition still loses 3. Centralist parties look decisive and suffer only half, while direct-democracy parties look chaotic and lose 50% more.',
    delta: (p) => loss(p.inGov ? 7 : 3, m(p, 'inst', 1.5, 0.5)),
    options: [
      { label: 'Fund Emergency Hospitals', cost: 7, lossMult: 0 },
      { label: 'Sign a Cross-Party Unity Pact', cost: 4, lossMult: 0.25 },
    ],
  },
  {
    key: 'energy',
    name: 'Energy Price Shock',
    flavor: 'Gas supplies are cut. Heating bills triple overnight.',
    tags: ['env', 'econ'],
    text: 'Every party loses 6 popularity as families shiver. The ecologists who closed the power plants are blamed most and lose 50% more; the developmentalists who wanted more drilling lose only half.',
    delta: (p) => loss(6, m(p, 'env', 0.5, 1.5)),
  },
  {
    key: 'techboom',
    name: 'Tech Boom',
    flavor: 'A wave of investment lifts wages and markets.',
    tags: ['econ'],
    text: 'Good times make the government look competent: governing parties gain 6 popularity and the opposition 1. Free-market parties, who promised exactly this, gain 3 more.',
    delta: (p) => (p.inGov ? 6 : 1) + (lean(p.party.axes.econ) === 'high' ? 3 : 0),
  },
  {
    key: 'constitution',
    name: 'Constitutional Crisis',
    flavor: 'The supreme court and the cabinet clash over emergency decrees.',
    tags: ['inst'],
    text: 'Voters rally to the people’s side. Centralist parties, who wanted the decrees, lose 8 popularity; direct-democracy parties gain 3 for defending the courts; moderates lose 3.',
    delta: (p) => byLean(p, 'inst', 3, -3, -8),
  },
  {
    key: 'strike',
    name: 'General Strike',
    flavor: 'Unions shut down ports, trains and factories.',
    tags: ['econ'],
    text: 'The country grinds to a halt and the government loses 7 popularity; even the opposition loses 2. Interventionist parties, friends of the unions, suffer only half; free-market parties lose 50% more.',
    delta: (p) => loss(p.inGov ? 7 : 2, m(p, 'econ', 0.5, 1.5)),
  },
  {
    key: 'protests',
    name: 'Youth Climate Protests',
    flavor: 'Millions march for the planet.',
    tags: ['env'],
    text: 'A new generation finds its champions: ecologist parties gain 5 popularity. Developmentalist parties are booed off stage and lose 6; moderates lose 2.',
    delta: (p) => byLean(p, 'env', -6, -2, 5),
  },
];

/** Drawn when a player lands on a Crisis square. Affects only that player. */
export const CRISIS_EVENTS: EventDef[] = [
  {
    key: 'financescandal',
    name: 'Campaign Finance Scandal',
    flavor: 'Whistleblowers leak evidence of illegal corporate donations to your party coffers.',
    tags: ['scandal', 'corruption'],
    text: 'The story could cost you 12 popularity. You can spend 6 capital on a fine that makes most of it go away, or 3 capital to fire your treasurer as a scapegoat.',
    delta: () => -12,
    options: [
      { label: 'Pay the Fine', cost: 6, reduceTo: 3 },
      { label: 'Fire the Treasurer as a Scapegoat', cost: 3, reduceTo: 4 },
    ],
  },
  {
    key: 'pressleak',
    name: 'Press Leak',
    flavor: 'An internal strategy memo calling voters “gullible” hits the front pages.',
    tags: ['scandal', 'media'],
    text: 'Voters do not like being called gullible. The leak threatens to cost you 8 popularity unless you can spin it.',
    delta: () => -8,
  },
  {
    key: 'accident',
    name: 'Industrial Accident',
    flavor: 'A chemical spill at a plant your party championed.',
    tags: ['env'],
    text: 'The spill could cost you 6 popularity. If your party pushed for more industry, it costs half as much again; if you always warned about pollution, voters forgive you half of it.',
    delta: (p) => loss(6, m(p, 'env', 1.5, 0.5)),
  },
  {
    key: 'gaffe',
    name: 'Live TV Gaffe',
    flavor: 'Your leader forgets the price of a loaf of bread on prime-time television.',
    tags: ['media'],
    text: 'The clip goes viral within the hour. Unless your spin doctors act fast, you lose 6 popularity.',
    delta: () => -6,
  },
  {
    key: 'bribery',
    name: 'Bribery Investigation',
    flavor: 'Prosecutors raid your regional party office.',
    tags: ['scandal', 'corruption'],
    text: 'The raid could cost you 10 popularity, and 20% more if your party is known for centralising power.',
    delta: (p) => loss(10, m(p, 'inst', 1, 1.2)),
  },
  {
    key: 'flood',
    name: 'Flood in Your Heartland',
    flavor: 'Rivers burst their banks in your strongest constituency.',
    tags: ['env'],
    text: 'Your voters are under water and angry. In government you are blamed for the slow response and lose 10; in opposition voters are kinder and you lose only 4.',
    delta: (p) => loss(7, p.inGov ? 1.5 : 0.5),
  },
  {
    key: 'publicstrike',
    name: 'Public Sector Strike',
    flavor: 'Teachers and nurses walk out, blaming your budget plans.',
    tags: ['econ'],
    text: 'The strike could cost you 6 popularity. Free-market parties, who planned the cuts, lose half as much again; interventionist parties lose only half.',
    delta: (p) => loss(6, m(p, 'econ', 0.5, 1.5)),
  },
  {
    key: 'databreach',
    name: 'Data Breach',
    flavor: 'Your party’s voter database is found for sale online.',
    tags: ['scandal'],
    text: 'Embarrassing and careless: the breach could cost you 7 popularity, and half as much again if your party wants the state to collect more data.',
    delta: (p) => loss(7, m(p, 'inst', 1, 1.5)),
  },
  {
    key: 'infighting',
    name: 'Cabinet Infighting',
    flavor: 'Ministers brief against each other in the Sunday papers.',
    tags: ['media'],
    text: 'If you are in government, the squabbling costs you 8 popularity. If you are in opposition, you sit back and enjoy the show: +3 popularity.',
    delta: (p) => (p.inGov ? -8 : 3),
  },
  {
    key: 'factory',
    name: 'Factory Closure',
    flavor: 'The town’s biggest employer moves abroad.',
    tags: ['econ'],
    text: 'Hundreds of jobs vanish and the town wants answers: you could lose 6 popularity. Free-market parties lose half as much again; interventionist parties only half.',
    delta: (p) => loss(6, m(p, 'econ', 0.5, 1.5)),
  },
  {
    key: 'floorcross',
    name: 'Floor-Crossing Crisis',
    flavor: 'Disillusioned backbenchers have been seen dining with a rival party.',
    tags: ['scandal'],
    special: 'floorcross',
    text: 'Several of your MPs are ready to cross the floor and join the rival party closest to them, taking their seats with them until the next election. You can let them go, buy back some loyalty, or call an emergency party congress to keep everyone.',
    delta: () => 0,
  },
  {
    key: 'floorcross2',
    name: 'Floor-Crossing Crisis',
    flavor: 'A row over the party line has your backbenches in open revolt.',
    tags: ['scandal'],
    special: 'floorcross',
    text: 'A group of your MPs threatens to defect to the rival party closest to them, taking their seats until the next election. Stop them, or watch them walk across the chamber.',
    delta: () => 0,
  },
  {
    key: 'viral',
    name: 'Viral Grassroots Video',
    flavor: 'A volunteer’s heartfelt doorstep video gets ten million views.',
    tags: ['media'],
    text: 'Pure luck, and pure gold: your party gains 6 popularity without spending a cent.',
    delta: () => 6,
  },
  {
    key: 'celebrity',
    name: 'Celebrity Endorsement',
    flavor: 'The nation’s favourite pop star wears your party colours on stage.',
    tags: ['media'],
    text: 'Young voters take notice, and your party gains 5 popularity.',
    delta: () => 5,
  },
];

/** Drawn when a player lands on a Media square: a press opportunity with two ways to use it. */
export interface MediaDef {
  key: string;
  name: string;
  flavor: string;
  /** Press conference: draw this many STRATEGY cards and keep one. */
  draw: number;
  /** Campaign rally: cost in ⭐ capital and popularity gained. */
  rallyCost: number;
  rallyGain: number;
}

export const MEDIA_EVENTS: MediaDef[] = [
  { key: 'primetime', name: 'Prime-Time Interview', flavor: 'The country’s top anchor wants an hour with your leader.', draw: 2, rallyCost: 3, rallyGain: 4 },
  { key: 'morning', name: 'Morning Talk Show', flavor: 'A cosy sofa, a friendly host, millions of viewers with coffee.', draw: 2, rallyCost: 2, rallyGain: 3 },
  { key: 'townhall', name: 'Televised Town Hall', flavor: 'Ordinary citizens ask the questions, live.', draw: 2, rallyCost: 4, rallyGain: 6 },
  { key: 'viral', name: 'Viral Social Campaign', flavor: 'Your digital team has a meme ready to go.', draw: 3, rallyCost: 3, rallyGain: 4 },
  { key: 'oped', name: 'Newspaper Op-Ed', flavor: 'A national paper offers your leader a column.', draw: 2, rallyCost: 0, rallyGain: 2 },
  { key: 'podcast', name: 'Celebrity Podcast', flavor: 'Three hours with the nation’s most famous comedian.', draw: 2, rallyCost: 5, rallyGain: 7 },
  { key: 'watchparty', name: 'Debate Watch Party', flavor: 'Supporters gather in bars across the country.', draw: 2, rallyCost: 2, rallyGain: 4 },
  { key: 'radio', name: 'Regional Radio Tour', flavor: 'Twelve stations, twelve towns, one long day.', draw: 3, rallyCost: 2, rallyGain: 3 },
];

export interface LobbyDef {
  key: string;
  name: string;
  flavor: string;
  axis: AxisKey;
  side: 'low' | 'high';
  /** ⭐ Political Capital offered to parties that share the cause. */
  capital: number;
  penalty: number;
}

export const LOBBIES: LobbyDef[] = [
  { key: 'agro', name: 'Agribusiness Federation', flavor: 'The agricultural lobby offers campaign backing in exchange for votes.', axis: 'env', side: 'low', capital: 7, penalty: 8 },
  { key: 'unions', name: 'Trade Union Congress', flavor: 'The unions will mobilise their members — for a price.', axis: 'econ', side: 'low', capital: 7, penalty: 7 },
  { key: 'chamber', name: 'Industrial Chamber', flavor: 'Captains of industry want a friend in parliament.', axis: 'econ', side: 'high', capital: 8, penalty: 7 },
  { key: 'religious', name: 'Religious Council', flavor: 'Church leaders offer their pulpits to a sympathetic party.', axis: 'social', side: 'high', capital: 6, penalty: 8 },
  { key: 'green', name: 'Green Alliance NGOs', flavor: 'Environmental groups offer volunteers and a donor list.', axis: 'env', side: 'high', capital: 6, penalty: 6 },
  { key: 'tech', name: 'Tech & Startups Association', flavor: 'Young founders want a modern, open society.', axis: 'social', side: 'low', capital: 7, penalty: 5 },
  { key: 'assemblies', name: 'Citizens’ Assemblies Network', flavor: 'Grassroots democrats offer an army of canvassers.', axis: 'inst', side: 'low', capital: 6, penalty: 5 },
  { key: 'security', name: 'Security & Defense Council', flavor: 'Generals and police chiefs seek a strong hand.', axis: 'inst', side: 'high', capital: 7, penalty: 6 },
  { key: 'banks', name: 'Banking Federation', flavor: 'The banks would like a word about regulation.', axis: 'econ', side: 'high', capital: 8, penalty: 9 },
  { key: 'students', name: 'National Students’ Union', flavor: 'Students offer energy, memes and door-knocking.', axis: 'social', side: 'low', capital: 4, penalty: 4 },
];

// Brazilian Portuguese: replace the card text (rules stay the same).
if (isPT) {
  for (const e of [...GLOBAL_CRISES, ...CRISIS_EVENTS]) {
    const t = EVENTS_PT[e.key];
    if (!t) continue;
    Object.assign(e, { name: t.name, flavor: t.flavor, text: t.text });
    t.options?.forEach((label, i) => e.options?.[i] && (e.options[i].label = label));
  }
  for (const m of MEDIA_EVENTS) Object.assign(m, MEDIA_PT[m.key] ?? {});
  for (const l of LOBBIES) Object.assign(l, LOBBIES_PT[l.key] ?? {});
}
