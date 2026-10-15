/** Forming a government: the mandate (and roll-offs), coalition talks, the new cabinet and the opposition. */
import { art, L } from '../../i18n';
import * as R from '../rules';
import { PORTFOLIO_INFO, PORTFOLIOS, type Player, type Portfolio } from '../types';
import { PF_VALUE } from './aiValues';
import type { Engine } from './Engine';
import { and, aoP, pn, the, The } from './text';

export interface Deal {
  partners: Player[];
  assign: Map<Portfolio, Player>;
  transfers: { to: Player; amount: number }[];
}

/** Each tied party spins; the highest number wins the mandate (ties at the top spin again). Returns the mandate order. */
export async function mandateRollOff(game: Engine, cands: Player[], why: string): Promise<Player[]> {
  game.view.log(L(`<b>Mandate roll-off!</b> ${why}`, `<b>Disputa pelo mandato!</b> ${why}`), 'event');
  await game.view.banner(L('🎡 Mandate Roll-Off', '🎡 Disputa pelo Mandato'), why, 'gov');
  const firstRoll = new Map<Player, number>();
  let pool = cands;
  while (pool.length > 1) {
    const rolls = new Map<Player, number>();
    for (const q of pool) {
      game.view.setActive(q.id);
      await game.view.turnStart(q.id);
      await game.ask(q, {
        title: L('Spin for the mandate', 'Gire pelo mandato'),
        body: L(
          'Parliament is tied. The party with the highest spin receives the mandate to form a government.',
          'O parlamento está empatado. O partido com o maior número recebe o mandato para formar o governo.',
        ),
        options: [{ label: L('🎡 Spin for the Mandate', '🎡 Girar pelo Mandato'), ai: 1 }],
        spin: true,
        mode: 'bar',
      });
      const roll = 1 + Math.floor(Math.random() * 10);
      await game.view.spin(roll);
      rolls.set(q, roll);
      if (!firstRoll.has(q)) firstRoll.set(q, roll);
      await game.view.story({
        actorId: q.id,
        headline: L(
          `Today, ${the(q)} spun a <b>${roll}</b> for the mandate.`,
          `Hoje, ${the(q)} tirou <b>${roll}</b> na disputa pelo mandato.`,
        ),
        meaning: rollOffStanding(pool, rolls, q),
        tone: 'gov',
      });
    }
    const best = Math.max(...rolls.values());
    const top = pool.filter((q) => rolls.get(q) === best);
    if (top.length > 1) {
      await game.view.story({
        headline: L(`Another tie at ${best}!`, `Novo empate em ${best}!`),
        meaning: L(`${and(top.map(The))} must spin again.`, `${and(top.map(The))} precisam girar de novo.`),
        tone: 'event',
      });
    }
    pool = top;
  }
  const winner = pool[0];
  await game.tell(
    winner,
    L('won the race for the mandate', 'venceu a disputa pelo mandato'),
    L(
      'With the highest spin, they get the first chance to build a government.',
      'Com o maior número, o partido tem a primeira chance de formar o governo.',
    ),
    'gov',
  );
  const rest = cands.filter((q) => q !== winner).sort((a, b) => firstRoll.get(b)! - firstRoll.get(a)!);
  return [winner, ...rest];
}

/** "The X takes the lead with a 9. Still to spin: …" after `just` has spun in a mandate roll-off. */
export function rollOffStanding(pool: Player[], rolls: Map<Player, number>, just: Player): string {
  const best = Math.max(...rolls.values());
  const leaders = pool.filter((q) => rolls.get(q) === best);
  const waiting = pool.filter((q) => !rolls.has(q));
  let lead: string;
  if (leaders.length > 1)
    lead = L(
      `${and(leaders.map(The))} are <b>tied for the lead</b> with a ${best}.`,
      `${and(leaders.map(The))} estão <b>empatados na liderança</b> com ${best}.`,
    );
  else if (leaders[0] === just)
    lead =
      rolls.size === 1
        ? L(
            `${The(just)} sets the mark to beat: <b>${best}</b>.`,
            `${The(just)} define a marca a ser batida: <b>${best}</b>.`,
          )
        : L(
            `${The(just)} <b>takes the lead</b> with a ${best}!`,
            `${The(just)} <b>assume a liderança</b> com ${best}!`,
          );
  else
    lead = L(
      `${The(leaders[0])} is still <b>in the lead</b> with a ${best}.`,
      `${The(leaders[0])} continua <b>na liderança</b> com ${best}.`,
    );
  const next = waiting.length
    ? L(` Still to spin: ${waiting.map(the).join(', ')}.`, ` Ainda vão girar: ${waiting.map(the).join(', ')}.`)
    : leaders.length > 1
      ? L(' Everyone has spun, so the tied parties spin again.', ' Todos já giraram, então os empatados giram de novo.')
      : L(
          ` Everyone has spun: ${the(leaders[0])} wins the mandate.`,
          ` Todos já giraram: ${the(leaders[0])} fica com o mandato.`,
        );
  return lead + next;
}

/** `opening`: the first government of the game, when every party spins for the mandate. */
export async function formGovernment(game: Engine, excludeId = -1, opening = false): Promise<void> {
  for (const q of game.players) {
    q.isPM = false;
    q.inGov = false;
    q.portfolios = [];
  }
  game.view.seatsChanged();
  // Most seats first; a seat tie goes to the more popular party (the one that won more votes).
  let ranking = [...game.players]
    .filter((q) => q.id !== excludeId)
    .sort((a, b) => b.seats - a.seats || b.popularity - a.popularity);
  // At the opening every party spins for the mandate; later, only parties tied on both seats and popularity do.
  const top = ranking[0];
  const tied = opening ? ranking : ranking.filter((q) => q.seats === top.seats && q.popularity === top.popularity);
  if (tied.length > 1) {
    const order = await mandateRollOff(
      game,
      tied,
      opening
        ? L(
            'Parliament is evenly split, so every party spins the wheel. The highest number receives the mandate.',
            'O parlamento está dividido igualmente, então todos os partidos giram a roleta. O maior número recebe o mandato.',
          )
        : L(
            `${tied.length} parties are tied on ${tied[0].seats} seats. Each spins the wheel; the highest number receives the mandate.`,
            `${tied.length} partidos estão empatados com ${tied[0].seats} cadeiras. Cada um gira a roleta; o maior número recebe o mandato.`,
          ),
    );
    ranking = [...order, ...ranking.filter((q) => !tied.includes(q))];
  }

  for (const f of ranking) {
    game.view.setActive(f.id);
    game.view.spotlight(f.id);
    await game.tell(
      f,
      L('received the mandate to form a government', 'recebeu o mandato para formar o governo'),
      f.seats >= R.MAJORITY
        ? L(`With ${f.seats} seats they already hold a majority.`, `Com ${f.seats} cadeiras, o partido já tem maioria.`)
        : L(
            `They hold ${f.seats} seats but need <b>${R.MAJORITY}</b>, so they must invite other parties into a coalition by offering cabinet posts.`,
            `O partido tem ${f.seats} cadeiras mas precisa de <b>${R.MAJORITY}</b>, então precisa convidar outros partidos para uma coalizão oferecendo ministérios.`,
          ),
      'gov',
    );
    const deal = await negotiate(game, f);
    if (deal) return install(game, f, deal);
    await game.tell(
      f,
      L('failed to build a majority', 'não conseguiu formar maioria'),
      L(
        'Too many parties said no. The mandate passes to the next party in line.',
        'Muitos partidos disseram não. O mandato passa para o próximo da fila.',
      ),
      'bad',
    );
  }
  const f = ranking[0];
  await game.tell(
    f,
    L('formed a minority government', 'formou um governo de minoria'),
    L(
      'No coalition could reach 76 seats, so the largest party governs alone and will struggle to pass bills.',
      'Nenhuma coalizão chegou a 76 cadeiras, então o maior partido governa sozinho e terá dificuldade para aprovar leis.',
    ),
    'gov',
  );
  await install(game, f, { partners: [], assign: new Map(), transfers: [] }, true);
}

export function acceptValue(game: Engine, partner: Player, f: Player, sweetener: number): number {
  const d = R.partyDistance(partner.party.axes, f.party.axes);
  let v = 3 - d * 2.2 + sweetener / 3;
  if (game.isLeader(partner)) v -= 1; // front-runners prefer the freedom of opposition
  return v;
}

export async function negotiate(game: Engine, f: Player): Promise<Deal | null> {
  const deal: Deal = { partners: [], assign: new Map(), transfers: [] };
  if (f.seats >= R.MAJORITY) return deal;
  const coalition: Player[] = [f];
  const left = [...PORTFOLIOS];
  const approached = new Set<number>();
  let rejections = 0;
  let budget = f.capital;
  const bloc = () => coalition.reduce((s, q) => s + q.seats, 0);

  while (bloc() < R.MAJORITY && left.length && rejections < 3) {
    const cands = game.players.filter((q) => !coalition.includes(q) && !approached.has(q.id));
    if (!cands.length) break;
    const cur = bloc();
    const ci = await game.ask(f, {
      title: L('Coalition talks — you hold the mandate', 'Negociação da coalizão — o mandato é seu'),
      body: L(
        `Your bloc holds <b>${cur}</b> seats; <b>${R.MAJORITY}</b> are needed. Invite a party into government.${rejections ? ` <i>(${rejections}/3 rejections so far)</i>` : ''}`,
        `Seu bloco tem <b>${cur}</b> cadeiras; são necessárias <b>${R.MAJORITY}</b>. Convide um partido para o governo.${rejections ? ` <i>(${rejections}/3 recusas até agora)</i>` : ''}`,
      ),
      options: [
        ...cands.map((q) => {
          const d = R.partyDistance(f.party.axes, q.party.axes);
          return {
            label: L(`Invite ${q.party.name}`, `Convidar ${q.party.name}`),
            detail: L(
              `${q.seats} seats · ideological distance ${d.toFixed(1)} · bloc → ${cur + q.seats}`,
              `${q.seats} cadeiras · distância ideológica ${d.toFixed(1)} · bloco → ${cur + q.seats}`,
            ),
            color: q.party.color,
            ai: q.seats / 8 - d * 2 + (cur + q.seats >= R.MAJORITY ? 3 : 0),
          };
        }),
        { label: L('Give up the mandate', 'Desistir do mandato'), ai: -20 },
      ],
    });
    if (ci >= cands.length) return null;
    const partner = cands[ci];

    const pfi = await game.ask(f, {
      title: L(`Offer a cabinet portfolio to ${partner.party.name}`, `Oferecer um ministério a ${partner.party.name}`),
      options: left.map((pf) => ({
        label: `${PORTFOLIO_INFO[pf].icon} ${PORTFOLIO_INFO[pf].title}`,
        detail: PORTFOLIO_INFO[pf].perk,
        ai: -PF_VALUE[pf],
      })),
    });
    const pf = left[pfi];

    const sweets = [0, 4, 8].filter((s) => s <= budget);
    const si =
      sweets.length > 1
        ? await game.ask(f, {
            title: L('Sweeten the deal?', 'Adoçar o acordo?'),
            body: L(
              `Give ⭐ Political Capital to ${partner.party.name} if they join your government.`,
              `Dê ⭐ Capital Político a ${partner.party.name} se entrar no seu governo.`,
            ),
            options: sweets.map((s) => ({
              label: s ? L(`Offer ${s} ⭐`, `Oferecer ${s} ⭐`) : L('No sweetener', 'Sem agrado'),
              ai: (acceptValue(game, partner, f, s) > 0.3 ? 10 : 0) - s * 0.5,
            })),
          })
        : 0;
    const s = sweets[si];
    const offer = L(
      `the post of ${PORTFOLIO_INFO[pf].title}${s ? ` and ${s} ⭐ capital` : ''}`,
      `o ${PORTFOLIO_INFO[pf].title}${s ? ` e ${s} ⭐ de capital` : ''}`,
    );

    const noise = (Math.random() - 0.5) * 0.8;
    const answer = await game.ask(partner, {
      title: L(`${f.party.name} invites you into government`, `${f.party.name} convida você para o governo`),
      body: L(
        `Offer: <b>${PORTFOLIO_INFO[pf].title}</b> (${PORTFOLIO_INFO[pf].perk})${s ? ` plus <b>${s} ⭐ capital</b>` : ''}. The coalition would hold ${cur + partner.seats} seats.`,
        `Oferta: <b>${PORTFOLIO_INFO[pf].title}</b> (${PORTFOLIO_INFO[pf].perk})${s ? ` e mais <b>${s} ⭐ de capital</b>` : ''}. A coalizão teria ${cur + partner.seats} cadeiras.`,
      ),
      options: [
        {
          label: L('Accept — join the coalition', 'Aceitar — entrar na coalizão'),
          ai: acceptValue(game, partner, f, s) + noise,
        },
        { label: L('Decline — stay in opposition', 'Recusar — ficar na oposição'), ai: 0 },
      ],
    });
    if (answer === 0) {
      coalition.push(partner);
      left.splice(pfi, 1);
      deal.assign.set(pf, partner);
      if (s) {
        deal.transfers.push({ to: partner, amount: s });
        budget -= s;
      }
      const now = bloc();
      await game.tell(
        f,
        L(`offered ${the(partner)} ${offer}`, `ofereceu ${aoP(partner)} ${offer}`),
        L(
          `${The(partner)} <b>accepted</b> and joins the coalition. The coalition now holds ${now} seats${now >= R.MAJORITY ? ' — a majority!' : `; it still needs ${R.MAJORITY - now} more.`}`,
          `${The(partner)} <b>aceitou</b> e entra na coalizão. A coalizão agora tem ${now} cadeiras${now >= R.MAJORITY ? ' — maioria!' : `; ainda faltam ${R.MAJORITY - now}.`}`,
        ),
        'gov',
      );
    } else {
      rejections++;
      approached.add(partner.id);
      await game.tell(
        f,
        L(`offered ${the(partner)} ${offer}`, `ofereceu ${aoP(partner)} ${offer}`),
        L(
          `${The(partner)} <b>said no</b> and prefers to stay in opposition. (${rejections}/3 rejections)`,
          `${The(partner)} <b>recusou</b> e prefere ficar na oposição. (${rejections}/3 recusas)`,
        ),
        'bad',
      );
    }
  }
  if (bloc() >= R.MAJORITY) {
    deal.partners = coalition.slice(1);
    return deal;
  }
  return null;
}

export async function install(game: Engine, f: Player, deal: Deal, minority = false): Promise<void> {
  game.rebellions.clear(); // a new government starts with a clean slate
  f.isPM = true;
  f.inGov = true;
  for (const q of deal.partners) q.inGov = true;
  for (const pf of PORTFOLIOS) (deal.assign.get(pf) ?? f).portfolios.push(pf);
  for (const t of deal.transfers) {
    const amt = Math.min(t.amount, f.capital);
    f.capital -= amt;
    t.to.capital += amt;
  }
  f.capital += 4;
  for (const q of deal.partners) q.capital += 2;
  const seats = f.seats + deal.partners.reduce((s, q) => s + q.seats, 0);
  game.view.seatsChanged();
  game.view.log(
    L(
      `${pn(f)} forms a government (${seats} seats). <b>Prime Minister: ${f.party.name}</b>.`,
      `${pn(f)} forma o governo (${seats} cadeiras). <b>Primeiro-Ministro: ${f.party.name}</b>.`,
    ),
    'gov',
  );
  await game.view.pmTakesSeat(f.id);
  if (!minority) await announceGovernment(game, f, deal, seats);
  await announceOpposition(game, seats);
}

export async function announceGovernment(game: Engine, f: Player, deal: Deal, seats: number): Promise<void> {
  const ministers = game.players
    .filter((q) => q.portfolios.length)
    .map((q) => `${the(q)}: ${q.portfolios.map((pf) => PORTFOLIO_INFO[pf].short).join(', ')}`)
    .join('; ');
  await game.tell(
    f,
    L('formed a new government', 'formou um novo governo'),
    L(
      `They become <b>Prime Minister</b>${deal.partners.length ? ` in coalition with ${and(deal.partners.map(the))}` : ''}, with ${seats} of ${R.TOTAL_SEATS} seats. Ministries — ${ministers}. Everyone else sits in opposition.`,
      `O partido assume o cargo de <b>Primeiro-Ministro</b>${deal.partners.length ? ` em coalizão com ${and(deal.partners.map(the))}` : ''}, com ${seats} de ${R.TOTAL_SEATS} cadeiras. Ministérios — ${ministers}. Todos os demais ficam na oposição.`,
    ),
    'gov',
  );
}

/** Once the government is seated, the opposition forms behind its leader: the largest party left outside. */
export async function announceOpposition(game: Engine, govSeats: number): Promise<void> {
  const leader = R.oppositionLeader(game.players);
  if (!leader) return;
  const members = game.players.filter((q) => !q.inGov && q.seats > 0).sort((a, b) => b.seats - a.seats);
  const others = members.filter((q) => q !== leader);
  const oppSeats = members.reduce((s, q) => s + q.seats, 0);
  await game.view.oppositionForms(
    leader.id,
    members.map((q) => q.id),
  );
  const joined = others.length
    ? L(
        `, joined on the opposition benches by ${and(others.map(the))}`,
        `, ao lado de ${and(others.map(the))} nos bancos da oposição`,
      )
    : L(
        ', alone on the opposition benches',
        `, ${art(leader.party) === 'a' ? 'sozinha' : 'sozinho'} nos bancos da oposição`,
      );
  await game.tell(
    leader,
    L('became the Leader of the Opposition', 'assumiu a Liderança da Oposição'),
    L(
      `As the largest party outside the government (${leader.seats} seats), ${the(leader)} leads the opposition${joined}. ${others.length ? 'Together they hold' : 'It holds'} <b>${oppSeats}</b> seats against the government's <b>${govSeats}</b>. Their job: block bills with vetoes, investigate the government (leaks against it hit 3 harder) and bring it down with a vote of no confidence if they ever reach ${R.MAJORITY} seats.`,
      `Como maior partido fora do governo (${leader.seats} cadeiras), ${the(leader)} lidera a oposição${joined}. ${others.length ? 'Juntos, têm' : 'O partido tem'} <b>${oppSeats}</b> cadeiras contra <b>${govSeats}</b> do governo. A missão: barrar projetos com vetos, investigar o governo (vazamentos contra ele custam 3 a mais) e derrubá-lo com uma moção de desconfiança se um dia chegarem a ${R.MAJORITY} cadeiras.`,
    ),
    'event',
  );
}
