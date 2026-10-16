/** LAW deck: the policy bills. `target` is the ideological position each bill stands for (axes run 1..4). */
import type { Axes, CardDef } from '../core/types';

const bill = (key: string, name: string, target: Partial<Axes>, text: string): CardDef => ({
  key,
  kind: 'bill',
  name,
  target,
  text,
});

export const BILLS: CardDef[] = [
  // Economic — interventionist
  bill('rail', 'Nationalize the Railways', { econ: 1, inst: 3 }, 'Bring trains back under public ownership.'),
  bill('wealthtax', 'Wealth Tax', { econ: 1 }, 'A 2% levy on fortunes above ten million.'),
  bill('minwage', 'Minimum Wage Hike', { econ: 1.5, social: 2 }, 'A living wage for every worker.'),
  bill('housing', 'Public Housing Program', { econ: 1, env: 1 }, '100,000 new social homes.'),
  bill('foodprice', 'Price Controls on Food', { econ: 1 }, 'Cap the price of bread, milk and rice.'),
  bill('ubs', 'Universal Basic Services', { econ: 1, social: 1.5 }, 'Free transit, care and broadband for all.'),
  bill('rentcap', 'Rent Cap Act', { econ: 1.5 }, 'Freeze rents in overheated cities.'),
  // Economic — neoliberal
  bill('labordereg', 'Labor Deregulation', { econ: 4 }, 'Flexible contracts, fewer red-tape rules.'),
  bill('vouchers', 'Free Market Health Vouchers', { econ: 4, social: 3 }, 'Let patients shop for private care.'),
  bill('corptax', 'Corporate Tax Cut', { econ: 4 }, 'Slash corporate tax to attract investment.'),
  bill('postal', 'Privatize the Postal Service', { econ: 3.5, inst: 3 }, 'Sell the national post to bidders.'),
  bill('freetrade', 'Free Trade Agreement', { econ: 3.5, env: 1.5 }, 'Tear down tariffs with our neighbours.'),
  bill('budget', 'Balanced Budget Amendment', { econ: 3.5, inst: 3 }, 'Write fiscal discipline into the constitution.'),
  // Social — progressive
  bill('marriage', 'Marriage Equality Act', { social: 1 }, 'Equal marriage rights for every couple.'),
  bill('drugs', 'Drug Decriminalization', { social: 2, inst: 1 }, 'Treat addiction as health, not crime.'),
  bill(
    'immigration',
    'Open Immigration Reform',
    { social: 1, econ: 3.5 },
    'Fast-track visas for workers and refugees.',
  ),
  bill('secular', 'Secular Education Act', { social: 1.5 }, 'Remove religion from the public curriculum.'),
  bill('parity', 'Gender Parity Quotas', { social: 1, inst: 2 }, 'Equal representation on boards and lists.'),
  // Social — conservative
  bill('family', 'Traditional Family Act', { social: 3 }, 'Tax credits for married parents.'),
  bill('border', 'Border Wall Funding', { social: 4, inst: 4 }, 'Billions for fences and patrols.'),
  bill('crime', 'Tough on Crime Bill', { social: 3.5, inst: 3.5 }, 'Longer sentences, more police.'),
  bill('relschools', 'Religious Schools Subsidy', { social: 4, econ: 2.5 }, 'State funding for faith schools.'),
  bill('service', 'National Service Act', { social: 3.5, inst: 4 }, 'A mandatory year of service for youth.'),
  // Environmental — ecologist
  bill('carbontax', 'Carbon Tax', { env: 4, econ: 2 }, 'Make polluters pay per tonne of CO₂.'),
  bill('coal', 'Coal Phase-Out', { env: 4 }, 'Close every coal plant by the decade’s end.'),
  bill('rewild', 'Rewilding Program', { env: 3.5 }, 'Return farmland to forests and wetlands.'),
  bill('ev', 'EV Subsidies', { env: 4, econ: 2.5 }, 'Cash back on every electric car.'),
  bill('plastic', 'Single-Use Plastic Ban', { env: 3.5, econ: 2 }, 'No more straws, bags or cutlery.'),
  // Environmental — developmentalist
  bill('oilgas', 'Oil & Gas Expansion', { env: 1, econ: 3 }, 'Open new offshore drilling blocks.'),
  bill('highway', 'Highway Megaproject', { env: 1, econ: 2 }, 'A six-lane motorway across the country.'),
  bill('nuclear', 'Nuclear Power Program', { env: 1, inst: 3 }, 'Four new reactors for energy security.'),
  bill('mining', 'Mining Permits Fast-Track', { env: 1, econ: 3.5 }, 'Approve mines in weeks, not years.'),
  bill('industry', 'Heavy Industry Subsidies', { env: 1, econ: 1.5 }, 'Save the steelworks with state aid.'),
  // Institutional — direct democracy
  bill('referendum', 'Citizen Referendum Law', { inst: 1 }, 'Any petition with 500k signatures goes to a vote.'),
  bill('autonomy', 'Regional Autonomy Act', { inst: 1 }, 'Devolve powers to the regions.'),
  bill('partbudget', 'Participatory Budgeting', { inst: 1, econ: 2 }, 'Let neighbourhoods decide local spending.'),
  bill('recall', 'Recall Elections Act', { inst: 1 }, 'Voters can fire their representatives mid-term.'),
  // Institutional — centralist
  bill('emergency', 'Emergency Powers Act', { inst: 4 }, 'Let the cabinet rule by decree in a crisis.'),
  bill('mediaauth', 'Media Oversight Authority', { inst: 4, social: 3 }, 'A state regulator for news outlets.'),
  bill('police', 'Centralized Police Command', { inst: 3.5, social: 4 }, 'Merge regional forces under one ministry.'),
  bill('decree', 'Executive Decree Reform', { inst: 4 }, 'Fast-track government bills past committees.'),
  // Cross-cutting
  bill('greenjobs', 'Green Jobs Guarantee', { env: 3, econ: 1 }, 'A state-funded job in renewables for anyone.'),
  bill('digitalid', 'National Digital ID', { inst: 3.5, econ: 3 }, 'One biometric ID for every citizen.'),
  bill(
    'assemblies',
    'Citizens’ Climate Assembly',
    { inst: 1, env: 3.5 },
    'A randomly selected assembly sets climate policy.',
  ),
  bill('pension', 'Pension Guarantee Act', { econ: 1, social: 3.5 }, 'A state pension no government can cut.'),
  bill('flattax', 'Flat Tax Reform', { econ: 4, inst: 4 }, 'One simple rate for every citizen.'),
  bill('freeuni', 'Free University Tuition', { econ: 1.5, social: 1.5 }, 'Higher education paid for by the state.'),
  bill(
    'schoolchoice',
    'School Choice Vouchers',
    { econ: 3.5, social: 3 },
    'Let parents spend public money at any school.',
  ),
  bill('solar', 'Solar Roofs Program', { env: 4, inst: 1 }, 'A panel on every public building.'),
  bill('farmsubsidy', 'Farm Subsidy Package', { env: 1.5, social: 3 }, 'Protect the family farm from cheap imports.'),
  bill('airport', 'Third Airport Runway', { env: 1, econ: 3 }, 'More flights, more trade, more noise.'),
  bill(
    'transparency',
    'Lobbying Transparency Act',
    { inst: 1.5, econ: 2 },
    'Every meeting with a lobbyist goes online.',
  ),
  bill('surveillance', 'Online Surveillance Bill', { inst: 4, social: 3.5 }, 'Police access to private messages.'),
  bill('euthanasia', 'Right to Die Act', { social: 1, inst: 2 }, 'Legal assisted dying for the terminally ill.'),
  bill('anthem', 'National Heritage Act', { social: 4, inst: 3 }, 'Patriotic history in every classroom.'),
  bill('weekfour', 'Four-Day Work Week', { econ: 1.5, social: 1.5 }, 'Same pay, one more day off.'),
  bill(
    'deregulateenergy',
    'Energy Market Liberalisation',
    { econ: 4, env: 2 },
    'Open the grid to private competitors.',
  ),
  bill('publictransit', 'Free Public Transit', { econ: 1, env: 3 }, 'Buses and trains free for everyone.'),
  bill(
    'localpolice',
    'Community Policing Act',
    { inst: 1.5, social: 2 },
    'Neighbourhoods choose their own police chiefs.',
  ),
  bill('military', 'Defence Spending Boost', { inst: 3.5, social: 3.5 }, 'Two percent of GDP for the armed forces.'),
];
