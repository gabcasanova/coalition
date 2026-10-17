/**
 * Crisis cards. GLOBAL_CRISES are revealed when the first party reaches the Midterm Convention and hit every
 * party; CRISIS_EVENTS are drawn on Crisis squares and hit only the party that landed there.
 * Each card's `delta` decides the popularity change from the party's position on the ideology axes.
 */
import { lean } from '../core/rules';
import type { AxisKey, EventDef, Player } from '../core/types';
import { isPT } from '../i18n';
import { EVENTS_PT } from '../i18n/pt-BR';

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

/**
 * Super crises: now and then a Crisis square draws one of these instead (more often for the two most popular
 * parties). They hit harder, and there is no paying your way out: ⭐ capital can't buy them off, and reaction
 * cards and ministries can at most halve them.
 */
export const SUPER_CRISES: EventDef[] = [
  {
    key: 'tapes',
    name: 'The Secret Tapes',
    flavor: 'Hours of recordings of your leadership trading favours for donations are released at midnight.',
    tags: ['scandal', 'corruption'],
    text: 'There is no fine big enough and no spin good enough: the tapes cost you 14 popularity, and 30% more if your party is known for centralising power.',
    delta: (p) => loss(14, m(p, 'inst', 1, 1.3)),
  },
  {
    key: 'arrest',
    name: 'Leader Arrested at Dawn',
    flavor: 'Police cars outside your leader’s house, live on every channel.',
    tags: ['scandal'],
    text: 'Whatever the courts decide, the pictures are already everywhere: you lose 15 popularity.',
    delta: () => -15,
  },
  {
    key: 'bankcollapse',
    name: 'Bank Collapse',
    flavor: 'A bank your party fought to deregulate goes under, taking thousands of pensions with it.',
    tags: ['econ'],
    text: 'Savers want someone to blame: you lose 12 popularity. Free-market parties, who cut the rules, lose 40% more; interventionist parties a quarter less.',
    delta: (p) => loss(12, m(p, 'econ', 0.75, 1.4)),
  },
  {
    key: 'chemicaldisaster',
    name: 'Chemical Plant Disaster',
    flavor: 'A toxic cloud drifts over a city from a plant your party promised was safe.',
    tags: ['env'],
    text: 'Evacuations, hospitals, funerals: you lose 13 popularity. Parties that pushed for industry lose 40% more; ecologist parties, who warned about it, lose 30% less.',
    delta: (p) => loss(13, m(p, 'env', 1.4, 0.7)),
  },
  {
    key: 'blackout',
    name: 'Three-Day Blackout',
    flavor: 'The national grid fails in a heatwave. Hospitals run on generators.',
    tags: ['econ'],
    text: 'In government you are blamed for every dark hospital ward and lose 16 popularity; in opposition you still lose 9 for the plans you never made.',
    delta: (p) => (p.inGov ? -16 : -9),
  },
];

// Brazilian Portuguese: replace the card text (rules stay the same).
if (isPT) {
  for (const e of [...GLOBAL_CRISES, ...CRISIS_EVENTS, ...SUPER_CRISES]) {
    const t = EVENTS_PT[e.key];
    if (!t) continue;
    Object.assign(e, { name: t.name, flavor: t.flavor, text: t.text });
    t.options?.forEach((label, i) => e.options?.[i] && (e.options[i].label = label));
  }
}
