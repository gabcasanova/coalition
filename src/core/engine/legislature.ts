/** Legislature square: introduce a bill, coalition discipline, whipping votes, vetoes and the vote itself. */
import { L } from '../../i18n';
import * as R from '../rules';
import { PORTFOLIO_INFO, type Card, type Player } from '../types';
import { W_CAP, W_CARD } from './aiValues';
import type { Engine, MenuEntry } from './Engine';
import { and, aoP, billView, doP, lawFace, ordinal, pn, pop, the, The } from './text';

export async function legislature(game: Engine, p: Player): Promise<void> {
  // Every Legislature Pass starts by drawing a fresh bill from the LAW deck.
  const fresh = game.drawOne('law');
  if (fresh) {
    p.hand.push(fresh);
    await game.view.drawCard('law', p.id, lawFace(fresh));
  }
  const bills = p.hand.filter((c) => c.kind === 'bill');
  if (!bills.length) {
    await game.tell(
      p,
      L('had nothing to put before parliament', 'não tinha nada para levar ao plenário'),
      L(
        'The LAW deck is empty, so the session passes quietly.',
        'O baralho de LEIS acabou, então a sessão passa em silêncio.',
      ),
      'info',
    );
    return;
  }

  const i = await game.ask(p, {
    title: L('Legislature Pass — introduce a bill', 'Votação no Plenário — apresente um projeto'),
    body: L(
      `You drew <b>${fresh?.name ?? 'a bill'}</b> from the LAW deck. Introducing one bill is <b>mandatory</b>. Bills that match your ideology win popularity <b>only if they become law</b>; misaligned bills cause a voter backlash either way. With <b>${R.MAJORITY}+</b> votes it becomes law (+2 ⭐ capital for you, +1 popularity for every governing party), unless an opponent pays ${R.VETO_COST} ⭐ to veto it.${
        p.inGov
          ? ' <br><b>🤝 You are in government, so this will be a coalition bill:</b> your partners are expected to vote YES, and any who rebel risk expulsion.'
          : ''
      }`,
      `Você comprou <b>${fresh?.name ?? 'um projeto'}</b> do baralho de LEIS. Apresentar um projeto é <b>obrigatório</b>. Projetos alinhados à sua ideologia rendem popularidade <b>só se virarem lei</b>; projetos desalinhados irritam seus eleitores de qualquer jeito. Com <b>${R.MAJORITY}+</b> votos ele vira lei (+2 ⭐ de capital para você, +1 de popularidade para cada partido do governo), a menos que um adversário pague ${R.VETO_COST} ⭐ para vetá-lo.${
        p.inGov
          ? ' <br><b>🤝 Você está no governo, então este será um projeto da coalizão:</b> seus aliados devem votar SIM, e quem se rebelar arrisca a expulsão.'
          : ''
      }`,
    ),
    options: bills.map((c) => {
      const d = R.billDelta(p.party.axes, c.target!);
      const passes = countVotes(game, c, p, new Set()).yes >= R.MAJORITY;
      return {
        label: c.name,
        detail: passes
          ? `${pop(d)} · ${L('likely passes', 'deve passar')}`
          : `${L('likely fails', 'deve cair')}${d < 0 ? ` · ${pop(d)}` : ` · ${L('no popularity', 'sem popularidade')}`}`,
        card: c,
        ai: passes ? d + 2 : Math.min(d, 0),
      };
    }),
  });
  const bill = bills[i];
  game.removeCard(p, bill);
  p.stats.billsIntroduced++;
  game.view.refresh();
  const delta = R.billDelta(p.party.axes, bill.target!);
  const coalition = p.inGov;
  const card = billView(bill, coalition);

  // Coalition discipline: partners who dislike a government bill must choose to back it or rebel.
  const forced = new Set<number>();
  const rebels: Player[] = [];
  const loyal: string[] = [];
  if (coalition) {
    game.view.log(
      L(
        `🤝 <b>Coalition bill:</b> ${pn(p)} introduces <i>${bill.name}</i> on behalf of the government.`,
        `🤝 <b>Projeto da coalizão:</b> ${pn(p)} apresenta <i>${bill.name}</i> em nome do governo.`,
      ),
      'gov',
    );
    await game.view.banner(
      L('🤝 Coalition Bill', '🤝 Projeto da Coalizão'),
      L(
        `${p.party.name} speaks for the government: coalition partners are expected to vote YES on the ${bill.name}.`,
        `${p.party.name} fala pelo governo: os aliados da coalizão devem votar SIM em ${bill.name}.`,
      ),
      'gov',
    );
    for (const q of game.players) {
      if (q === p || !q.inGov || q.isPM || votesFor(q, bill, p)) continue;
      // Swallowing a bill costs a distant partner more than a close ally, so distant partners rebel more.
      const leader = game.pm() ?? p;
      const backlash = Math.max(
        1,
        Math.round(
          (R.axisDistance(q.party.axes, bill.target!) - 1) *
            2 *
            R.loyaltyCost(R.partyDistance(q.party.axes, leader.party.axes)),
        ),
      );
      const gov = game.players.filter((x) => x.inGov).reduce((s, x) => s + x.seats, 0);
      const safe = gov - q.seats >= R.MAJORITY;
      const strikes = game.rebellions.get(q.id) ?? 0;
      const risk = Math.min(0.95, (safe ? 0.6 : 0.25) + strikes * 0.3);
      const pm = game.pm();
      const pmRef = pm ? the(pm) : L('the Leader of Congress', 'o Líder do Congresso');
      const k = await game.ask(q, {
        title: L(`Coalition vote: ${bill.name}`, `Votação da coalizão: ${bill.name}`),
        body: L(
          `Your coalition partner ${the(p)} has introduced a <b>coalition bill</b>, but your supporters dislike it.
          <ul class="choices">
            <li><b>Back the coalition:</b> vote YES. Your supporters grumble (−${backlash} popularity), but you keep your place in government.</li>
            <li><b>Rebel:</b> vote NO. Your supporters approve, but ${pmRef} may <b>expel you from the government</b>: you would lose your ministries and sit as an independent.${strikes ? ` You have already rebelled ${strikes === 1 ? 'once' : `${strikes} times`}.` : ''}</li>
          </ul>`,
          `Seu aliado ${the(p)} apresentou um <b>projeto da coalizão</b>, mas seus apoiadores não gostam dele.
          <ul class="choices">
            <li><b>Apoiar a coalizão:</b> votar SIM. Seus apoiadores reclamam (−${backlash} de popularidade), mas você continua no governo.</li>
            <li><b>Rebelar-se:</b> votar NÃO. Seus apoiadores aprovam, mas ${pmRef} pode <b>expulsar você do governo</b>: você perderia seus ministérios e iria para a oposição.${strikes ? ` Você já se rebelou ${strikes === 1 ? 'uma vez' : `${strikes} vezes`}.` : ''}</li>
          </ul>`,
        ),
        event: card,
        options: [
          {
            label: L('Back the coalition (vote YES)', 'Apoiar a coalizão (votar SIM)'),
            detail: `−${backlash} ${L('popularity', 'de popularidade')}`,
            ai: -backlash,
          },
          {
            label: L('Rebel (vote NO)', 'Rebelar-se (votar NÃO)'),
            detail: L('Risk being expelled from government', 'Risco de ser expulso do governo'),
            ai: -risk * (3 + q.portfolios.length * 2.5),
          },
        ],
      });
      if (k === 0) {
        forced.add(q.id);
        const lost = game.gainPop(q, -backlash);
        loyal.push(
          L(
            `${The(q)} held its nose and voted YES for coalition unity (${pop(lost)}).`,
            `${The(q)} engoliu em seco e votou SIM pela unidade da coalizão (${pop(lost)}).`,
          ),
        );
      } else rebels.push(q);
    }
  }

  // Whipping votes
  const whipped: Player[] = [];
  let tally = countVotes(game, bill, p, forced);
  for (let guard = 0; guard < 4 && tally.yes < R.MAJORITY; guard++) {
    const target = game.players.filter((q) => !tally.yesIds.has(q.id)).sort((a, b) => b.seats - a.seats)[0];
    if (!target) break;
    const whip = p.hand.find((c) => c.kind === 'whip');
    const after = tally.yes + target.seats;
    const success = after >= R.MAJORITY ? 5 : -1;
    const forceDetail = L(
      `Force ${target.party.name} (${target.seats} seats) → ${after} yes`,
      `Força ${target.party.name} (${target.seats} cadeiras) → ${after} sim`,
    );
    const entries: MenuEntry[] = [
      {
        opt: {
          label: L('Proceed to the vote', 'Ir para a votação'),
          detail: L(
            `${tally.yes} of ${R.TOTAL_SEATS} seats in favour`,
            `${tally.yes} de ${R.TOTAL_SEATS} cadeiras a favor`,
          ),
          ai: 0,
        },
      },
    ];
    const doForce = (how: string) => {
      forced.add(target.id);
      whipped.push(target);
      game.view.log(
        L(`${pn(p)} ${how}: ${pn(target)} must vote YES.`, `${pn(p)} ${how}: ${pn(target)} tem que votar SIM.`),
      );
    };
    if (whip) {
      entries.push({
        opt: { label: L(`Play ${whip.name}`, `Jogar ${whip.name}`), detail: forceDetail, ai: success - W_CARD * 0.5 },
        run: () => {
          game.removeCard(p, whip);
          doForce(L(`plays <i>${whip.name}</i>`, `joga <i>${whip.name}</i>`));
        },
      });
    }
    if (p.capital >= R.WHIP_COST) {
      entries.push({
        opt: {
          label: L(`Whip Vote (${R.WHIP_COST} ⭐)`, `Pressionar a Bancada (${R.WHIP_COST} ⭐)`),
          detail: forceDetail,
          ai: success - R.WHIP_COST * W_CAP,
        },
        run: () => {
          p.capital -= R.WHIP_COST;
          doForce(L(`calls in favours (${R.WHIP_COST} ⭐)`, `cobra favores (${R.WHIP_COST} ⭐)`));
        },
      });
    }
    if (entries.length === 1) break;
    const k = await game.menu(
      p,
      L(`Whipping votes: ${bill.name}`, `Buscando votos: ${bill.name}`),
      L(
        `The bill has <b>${tally.yes}</b> votes; <b>${R.MAJORITY}</b> are needed to pass.`,
        `O projeto tem <b>${tally.yes}</b> votos; são necessários <b>${R.MAJORITY}</b> para passar.`,
      ),
      entries,
      { event: card },
    );
    if (k === 0) break;
    tally = countVotes(game, bill, p, forced);
  }

  // Veto by an opposing party
  let vetoedBy: Player | null = null;
  let vetoGain = 0;
  if (tally.yes >= R.MAJORITY) {
    for (const q of game.players) {
      const vetoesLeft = game.vetoesLeft(q);
      if (q === p || tally.yesIds.has(q.id) || q.capital < R.VETO_COST || vetoesLeft <= 0) continue;
      const lastVeto = vetoesLeft === 1;
      const vetoUse = L(
        lastVeto ? 'uses your last veto this year' : `uses one of your ${vetoesLeft} vetoes this year`,
        lastVeto ? 'usa seu último veto do ano' : `usa um dos seus ${vetoesLeft} vetos do ano`,
      );
      const cheer = R.vetoApplause(q.party.axes, bill.target!);
      const threat = (game.isLeader(p) ? 3 : 0) + Math.max(0, delta) * 0.25 + (q.inGov !== p.inGov ? 1 : 0) + cheer;
      const cheerLine = cheer
        ? L(
            `Your supporters ${cheer >= 5 ? 'strongly ' : ''}oppose this bill, so they will <b>cheer the veto: +${cheer} popularity</b> for you.`,
            `Seus apoiadores ${cheer >= 5 ? 'odeiam' : 'são contra'} este projeto, então vão <b>comemorar o veto: +${cheer} de popularidade</b> para você.`,
          )
        : L(
            'Your supporters barely care about this bill, so the veto wins you no popularity.',
            'Seus apoiadores pouco ligam para este projeto, então o veto não rende popularidade.',
          );
      const k = await game.ask(q, {
        title: L(`Veto the ${bill.name}?`, `Vetar ${bill.name}?`),
        body: L(
          `${The(p)}'s bill has <b>${tally.yes}</b> votes, so it is about to pass. Your party voted against it.
          <ul class="choices">
            <li><b>Let it pass:</b> it becomes law. ${The(p)} earns +2 ⭐ capital and every governing party gains +1 popularity.</li>
            <li><b>Veto it (costs you ${R.VETO_COST} ⭐ and ${vetoUse}):</b> the bill is blocked and does <b>not</b> become law, so ${the(p)} gets no +2 ⭐ and the government gets no popularity bonus. ${cheerLine} If the bill is blocked, ${the(p)} wins no popularity from it.</li>
          </ul>`,
          `O projeto ${doP(p)} tem <b>${tally.yes}</b> votos e está prestes a passar. Seu partido votou contra.
          <ul class="choices">
            <li><b>Deixar passar:</b> vira lei. ${The(p)} ganha +2 ⭐ de capital e cada partido do governo ganha +1 de popularidade.</li>
            <li><b>Vetar (custa ${R.VETO_COST} ⭐ e ${vetoUse}):</b> o projeto é barrado e <b>não</b> vira lei, então ${the(p)} não ganha os +2 ⭐ e o governo fica sem bônus de popularidade. ${cheerLine} Se o projeto for barrado, ${the(p)} não ganha popularidade com ele.</li>
          </ul>`,
        ),
        event: card,
        options: [
          { label: L('Let it pass', 'Deixar passar'), detail: L('The bill becomes law', 'O projeto vira lei'), ai: 0 },
          {
            label: L(`Veto it (−${R.VETO_COST} ⭐)`, `Vetar (−${R.VETO_COST} ⭐)`),
            detail: cheer
              ? L(
                  `The bill is blocked · your supporters cheer: +${cheer} popularity`,
                  `O projeto é barrado · seus apoiadores comemoram: +${cheer} de popularidade`,
                )
              : L('The bill is blocked', 'O projeto é barrado'),
            ai: threat - R.VETO_COST * W_CAP,
          },
        ],
      });
      if (k === 1) {
        q.capital -= R.VETO_COST;
        vetoedBy = q;
        game.vetoesUsed.set(q.id, (game.vetoesUsed.get(q.id) ?? 0) + 1);
        vetoGain = cheer ? game.gainPop(q, cheer) : 0;
        break;
      }
    }
  }

  // Supporters only reward a bill that actually becomes law; a misaligned proposal angers them either way.
  const passed = !vetoedBy && tally.yes >= R.MAJORITY;
  if (passed) game.lawsThisYear.push(bill);
  const got = passed || delta < 0 ? game.gainPop(p, delta) : 0;
  const no = R.TOTAL_SEATS - tally.yes;
  const stance =
    delta < 0
      ? L(
          `The bill goes against ${the(p)}'s ideology, so ${the(p)}'s own supporters punish the flip-flop: ${pop(got)}.`,
          `O projeto contraria a ideologia ${doP(p)}, então os próprios apoiadores punem a incoerência: ${pop(got)}.`,
        )
      : passed
        ? L(
            `The bill fits ${the(p)}'s ideology, so ${the(p)}'s supporters reward the party: ${pop(got)}.`,
            `O projeto combina com a ideologia ${doP(p)}, então os apoiadores recompensam o partido: ${pop(got)}.`,
          )
        : L(
            `The bill fits ${the(p)}'s ideology, but it never became law, so ${the(p)} wins <b>no popularity</b> from it.`,
            `O projeto combina com a ideologia ${doP(p)}, mas não virou lei, então ${the(p)} <b>não ganha popularidade</b> com ele.`,
          );
  const stillRebels = rebels.filter((r) => !forced.has(r.id));
  const coalitionNote = [
    ...loyal,
    ...(stillRebels.length
      ? [
          L(
            `${and(stillRebels.map(The))} <b>rebelled</b> and voted NO against ${stillRebels.length > 1 ? 'their' : 'its'} own government.`,
            `${and(stillRebels.map(The))} <b>se rebelou</b> e votou NÃO contra o próprio governo.`.replace(
              'se rebelou e votou',
              stillRebels.length > 1 ? 'se rebelaram e votaram' : 'se rebelou e votou',
            ),
          ),
        ]
      : []),
  ].join(' ');
  const whipNote =
    (coalitionNote ? coalitionNote + ' ' : '') +
    (whipped.length
      ? L(
          `${The(p)} whipped ${and(whipped.map(the))} into voting yes. `,
          `${The(p)} enquadrou ${and(whipped.map(the))} para votar sim. `,
        )
      : '');
  const did = coalition
    ? L(
        `introduced the <i>${bill.name}</i>, a <b>coalition bill</b>`,
        `apresentou <i>${bill.name}</i>, um <b>projeto da coalizão</b>`,
      )
    : L(`introduced the <i>${bill.name}</i> in parliament`, `apresentou <i>${bill.name}</i> no plenário`);
  const yesIds = game.players.filter((q) => tally.yesIds.has(q.id)).map((q) => q.id);
  const noIds = game.players.filter((q) => !tally.yesIds.has(q.id)).map((q) => q.id);
  if (vetoedBy) await game.view.voteReaction({ outcome: 'vetoed', happy: noIds, sad: yesIds });
  else if (passed) await game.view.voteReaction({ outcome: 'passed', happy: yesIds, sad: noIds });
  if (vetoedBy) {
    const cheered = vetoGain
      ? L(
          `${The(vetoedBy)}'s supporters opposed the bill and cheer the veto: ${pop(vetoGain)} for ${the(vetoedBy)}. `,
          `Os apoiadores ${doP(vetoedBy)} eram contra o projeto e comemoram o veto: ${pop(vetoGain)} para ${the(vetoedBy)}. `,
        )
      : '';
    await game.tell(
      p,
      did,
      L(
        `${whipNote}It had enough votes to pass (${tally.yes}–${no}), but ${the(vetoedBy)} paid ${R.VETO_COST} ⭐ to <b>veto</b> it. The bill is <b>blocked</b> and does not become law, so ${the(p)} misses out on the +2 ⭐ capital and the government gets no popularity bonus. ${cheered}${stance}`,
        `${whipNote}Tinha votos para passar (${tally.yes}–${no}), mas ${the(vetoedBy)} pagou ${R.VETO_COST} ⭐ para <b>vetar</b>. O projeto foi <b>barrado</b> e não vira lei, então ${the(p)} fica sem os +2 ⭐ de capital e o governo sem bônus de popularidade. ${cheered}${stance}`,
      ),
      'bad',
      { card: bill },
    );
  } else if (tally.yes >= R.MAJORITY) {
    game.gainCapital(p, 2);
    p.stats.billsPassed++;
    for (const q of game.players) if (q.inGov) game.gainPop(q, 1);
    await game.tell(
      p,
      did,
      L(
        `${whipNote}Parliament voted <b>${tally.yes}–${no}</b> and the bill <b>became law</b>. ${stance} ${The(p)} also earns +2 ⭐ Political Capital, and every governing party gains +1 popularity.`,
        `${whipNote}O plenário votou <b>${tally.yes}–${no}</b> e o projeto <b>virou lei</b>. ${stance} ${The(p)} ainda ganha +2 ⭐ de Capital Político, e cada partido do governo ganha +1 de popularidade.`,
      ),
      delta >= 0 ? 'good' : 'bad',
      { card: bill },
    );
  } else {
    await game.tell(
      p,
      did,
      L(
        `${whipNote}Parliament voted <b>${tally.yes}–${no}</b>: short of the ${R.MAJORITY} votes needed, so the bill <b>failed</b>. ${stance}`,
        `${whipNote}O plenário votou <b>${tally.yes}–${no}</b>: abaixo dos ${R.MAJORITY} votos necessários, então o projeto <b>caiu</b>. ${stance}`,
      ),
      'bad',
      { card: bill },
    );
  }

  for (const r of stillRebels) await disciplineRebel(game, r, bill);
}

/** The Leader of Congress decides whether a coalition partner who voted against a coalition bill is warned or expelled. */
export async function disciplineRebel(game: Engine, r: Player, bill: Card): Promise<void> {
  const pm = game.pm();
  if (!pm || pm === r || !r.inGov) return;
  const strikes = (game.rebellions.get(r.id) ?? 0) + 1;
  game.rebellions.set(r.id, strikes);
  const gov = game.players.filter((x) => x.inGov).reduce((s, x) => s + x.seats, 0);
  const after = gov - r.seats;
  const keeps = after >= R.MAJORITY;
  const nth = ordinal(strikes);
  const shorts = r.portfolios.map((pf) => PORTFOLIO_INFO[pf].short).join(', ') || L('none', 'nenhum');
  game.view.spotlight(pm.id);
  const k = await game.ask(pm, {
    title: L(`${r.party.name} voted against your government`, `${r.party.name} votou contra o seu governo`),
    body: L(
      `${The(r)} rebelled on the <i>${bill.name}</i>. This is their <b>${nth}</b> rebellion.
      <ul class="choices">
        <li><b>Give a warning:</b> they keep their ministries (${shorts}) and the coalition stays together.</li>
        <li><b>Expel them:</b> they lose their ministries (you take them over) and join the opposition. Your government would hold <b>${after}</b> seats${keeps ? ', still a majority' : `, a <b>minority</b> (below ${R.MAJORITY})`}.</li>
      </ul>`,
      `${The(r)} se rebelou em <i>${bill.name}</i>. É a <b>${nth}</b> rebelião.
      <ul class="choices">
        <li><b>Dar uma advertência:</b> o partido mantém seus ministérios (${shorts}) e a coalizão continua unida.</li>
        <li><b>Expulsar:</b> o partido perde os ministérios (que passam para você) e vai para a oposição. Seu governo ficaria com <b>${after}</b> cadeiras${keeps ? ', ainda uma maioria' : `, uma <b>minoria</b> (abaixo de ${R.MAJORITY})`}.</li>
      </ul>`,
    ),
    options: [
      {
        label: L('Give them a warning', 'Dar uma advertência'),
        detail: L('Keep the coalition together', 'Manter a coalizão unida'),
        ai: 0,
      },
      {
        label: L('Expel them from the government', 'Expulsar do governo'),
        detail: keeps
          ? L(`Government keeps ${after} seats`, `O governo fica com ${after} cadeiras`)
          : L(`Government drops to ${after} seats (minority)`, `O governo cai para ${after} cadeiras (minoria)`),
        ai: (keeps ? 1.5 : -4) + (strikes - 1) * 3 + (Math.random() - 0.5),
      },
    ],
  });
  if (k === 0) {
    await game.tell(
      pm,
      L(`gave ${the(r)} a warning`, `deu uma advertência ${aoP(r)}`),
      L(
        `${The(r)} voted against the <i>${bill.name}</i> but keeps its place in government. That was its ${nth} rebellion; next time ${the(pm)} may not be so forgiving.`,
        `${The(r)} votou contra <i>${bill.name}</i>, mas continua no governo. Foi a ${nth} rebelião; da próxima vez ${the(pm)} pode não perdoar.`,
      ),
      'gov',
    );
    return;
  }
  const lost = r.portfolios;
  r.inGov = false;
  pm.portfolios.push(...lost);
  r.portfolios = [];
  game.rebellions.delete(r.id);
  game.view.seatsChanged();
  const titles = lost.map((pf) => PORTFOLIO_INFO[pf].title).join(', ');
  await game.tell(
    pm,
    L(`expelled ${the(r)} from the government`, `expulsou ${the(r)} do governo`),
    L(
      `${The(r)} voted against the <i>${bill.name}</i> one time too many. It loses ${lost.length ? `its ministries (${titles}), which pass to ${the(pm)},` : 'its place at the cabinet table'} and sits as an independent. The government now holds ${after} seats${keeps ? ', still a majority' : ', a <b>minority government</b> that will struggle to pass laws'}.`,
      `${The(r)} votou contra <i>${bill.name}</i> uma vez a mais. Perde ${lost.length ? `seus ministérios (${titles}), que passam ${aoP(pm)},` : 'seu lugar no gabinete'} e passa a ser independente. O governo agora tem ${after} cadeiras${keeps ? ', ainda uma maioria' : ', um <b>governo de minoria</b> que terá dificuldade para aprovar leis'}.`,
    ),
    'event',
  );
}

export function countVotes(game: Engine, bill: Card, intro: Player, forced: Set<number>) {
  const yesIds = new Set<number>();
  let yes = 0;
  for (const q of game.players) {
    if (q === intro || forced.has(q.id) || votesFor(q, bill, intro)) {
      yesIds.add(q.id);
      yes += q.seats;
    }
  }
  return { yes, yesIds };
}

export function votesFor(q: Player, bill: Card, intro: Player): boolean {
  const d = R.axisDistance(q.party.axes, bill.target!);
  // Coalition loyalty: partners back the Leader of Congress's bills further from their own views the closer
  // they are to the Leader.
  if (intro.isPM && q.inGov && d <= R.coalitionLoyalty(R.partyDistance(q.party.axes, intro.party.axes))) return true;
  return d <= 1.25;
}
