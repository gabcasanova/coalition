/** Committee square: a committee report, leaking scandals, investigations and the vote of no confidence. */
import { L } from '../../i18n';
import * as R from '../rules';
import { type Card, type Player } from '../types';
import { W_CAP, W_CARD } from './aiValues';
import { hit } from './defense';
import type { Engine, MenuEntry } from './Engine';
import { formGovernment } from './government';
import { aoP, doP, pop, the, The } from './text';

export async function committee(game: Engine, p: Player): Promise<void> {
  const interior = p.portfolios.includes('interior');
  const invCost = interior ? 1 : R.INVESTIGATE_COST;
  const invDmg = interior ? 6 : 4;
  const reportCap = interior ? 4 : 2;
  const entries: MenuEntry[] = [
    {
      opt: {
        label: L('📝 Draft Committee Report', '📝 Redigir Relatório da Comissão'),
        detail: `+${reportCap} ⭐`,
        ai: reportCap * W_CAP,
      },
      run: async () => {
        game.gainCapital(p, reportCap);
        await game.tell(
          p,
          L('decided to draft a committee report', 'decidiu redigir um relatório da comissão'),
          L(
            `Careful, unglamorous work: ${the(p)} earns +${reportCap} ⭐ Political Capital to spend later.`,
            `Trabalho cuidadoso e sem glamour: ${the(p)} ganha +${reportCap} ⭐ de Capital Político para gastar depois.`,
          ),
          'info',
        );
      },
    },
  ];
  const seen = new Set<string>();
  for (const c of p.hand) {
    if (c.kind !== 'scandal' || seen.has(c.key)) continue;
    seen.add(c.key);
    entries.push({
      opt: {
        label: L(`Leak: ${c.name}`, `Vazar: ${c.name}`),
        detail: L(`A rival loses ${c.power}+ popularity`, `Um rival perde ${c.power}+ de popularidade`),
        card: c,
        ai: c.power! * 0.5 + 1.5 - W_CARD * 0.4,
      },
      run: async () => {
        const target = await chooseRival(
          game,
          p,
          L(`Leak “${c.name}” against whom?`, `Vazar “${c.name}” contra quem?`),
        );
        game.removeCard(p, c);
        const bonus = !p.inGov && target.inGov ? 3 : 0;
        const amount = c.power! + bonus;
        await game.tell(
          p,
          L(
            `leaked the <i>${c.name}</i> scandal against ${the(target)}`,
            `vazou o escândalo <i>${c.name}</i> contra ${the(target)}`,
          ),
          L(
            `${The(target)} stands to lose ${amount} popularity${bonus ? ' (including the opposition’s mudslinging bonus against the government)' : ''}. Now ${the(target)} must respond.`,
            `${The(target)} pode perder ${amount} de popularidade${bonus ? ' (incluindo o bônus da oposição por atacar o governo)' : ''}. Agora ${the(target)} precisa reagir.`,
          ),
          'bad',
          { card: c },
        );
        await hit(game, target, {
          ev: {
            title: c.name,
            subtitle: L(
              `SCANDAL LEAKED BY ${p.party.name.toUpperCase()}`,
              `ESCÂNDALO VAZADO POR ${p.party.name.toUpperCase()}`,
            ),
            flavor: c.text,
            text: L(
              `The leak threatens to cost ${target.party.name} ${c.power} popularity${bonus ? ', plus 3 more because the opposition is going after the government' : ''}, unless they can contain it.`,
              `O vazamento ameaça custar ${c.power} de popularidade a ${target.party.name}${bonus ? ', mais 3 porque a oposição está atacando o governo' : ''}, a menos que consigam contê-lo.`,
            ),
            tone: 'bad',
          },
          amount,
          tags: c.tags ?? ['scandal'],
          attack: true,
        });
      },
    });
  }
  entries.push({
    opt: {
      label: L('🔍 Launch Investigation', '🔍 Abrir Investigação'),
      detail: L(
        `${invCost} ⭐ → a rival loses ${invDmg} popularity`,
        `${invCost} ⭐ → um rival perde ${invDmg} de popularidade`,
      ),
      disabled: p.capital < invCost ? L('Not enough capital', 'Capital insuficiente') : undefined,
      ai: invDmg * 0.5 + 1 - invCost * W_CAP,
    },
    run: async () => {
      const target = await chooseRival(game, p, L('Investigate which party?', 'Investigar qual partido?'));
      p.capital -= invCost;
      await game.tell(
        p,
        L(`launched a committee investigation into ${the(target)}`, `abriu uma CPI contra ${the(target)}`),
        L(
          `${The(p)} spends ${invCost} ⭐ capital on subpoenas. ${The(target)} faces ${invDmg} popularity of damage and must respond.`,
          `${The(p)} gasta ${invCost} ⭐ de capital em convocações. ${The(target)} enfrenta ${invDmg} de dano à popularidade e precisa reagir.`,
        ),
        'bad',
      );
      await hit(game, target, {
        ev: {
          title: L('Committee Investigation', 'Investigação da Comissão'),
          subtitle: L(`LAUNCHED BY ${p.party.name.toUpperCase()}`, `ABERTA POR ${p.party.name.toUpperCase()}`),
          flavor: L(
            'Subpoenas fly. Your officials are summoned to testify.',
            'Chovem convocações. Seus dirigentes são chamados a depor.',
          ),
          text: L(
            `A long public hearing that will cost ${target.party.name} ${invDmg} popularity unless they manage the fallout.`,
            `Uma longa audiência pública que vai custar ${invDmg} de popularidade a ${target.party.name}, a menos que controlem o estrago.`,
          ),
          tone: 'bad',
        },
        amount: invDmg,
        tags: ['scandal'],
        attack: true,
      });
    },
  });
  const nc = p.hand.find((c) => c.kind === 'noconfidence');
  if (nc && !p.inGov) {
    const opp = game.players.filter((q) => !q.inGov).reduce((s, q) => s + q.seats, 0);
    entries.push({
      opt: {
        label: L('⚖️ Vote of No Confidence', '⚖️ Moção de Desconfiança'),
        detail: L(
          `Opposition holds ${opp} seats (needs ${R.MAJORITY})`,
          `A oposição tem ${opp} cadeiras (precisa de ${R.MAJORITY})`,
        ),
        card: nc,
        ai: opp >= R.MAJORITY ? 9 : -5,
      },
      run: () => noConfidence(game, p, nc),
    });
  }
  await game.menu(
    p,
    L('Parliamentary Committee', 'Comissão Parlamentar'),
    L('Choose your committee business.', 'Escolha o trabalho na comissão.'),
    entries,
  );
}

export async function chooseRival(game: Engine, p: Player, title: string): Promise<Player> {
  const rivals = game.players.filter((q) => q !== p);
  const i = await game.ask(p, {
    title,
    options: rivals.map((q) => ({
      label: q.party.name,
      detail: L(
        `Popularity ${q.popularity} · ${q.seats} seats · ${q.isPM ? 'Prime Minister' : q.inGov ? 'Government' : 'Opposition'}`,
        `Popularidade ${q.popularity} · ${q.seats} cadeiras · ${q.isPM ? 'Primeiro-Ministro' : q.inGov ? 'Governo' : 'Oposição'}`,
      ),
      color: q.party.color,
      ai: q.popularity / 10 + (game.isLeader(q) ? 3 : 0) + (q.inGov && !p.inGov ? 1.5 : 0),
    })),
  });
  return rivals[i];
}

export async function noConfidence(game: Engine, p: Player, card: Card): Promise<void> {
  game.removeCard(p, card);
  const opp = game.players.filter((q) => !q.inGov).reduce((s, q) => s + q.seats, 0);
  const pm = game.pm();
  const did = L(
    'called a vote of no confidence in the government',
    'apresentou uma moção de desconfiança contra o governo',
  );
  if (opp >= R.MAJORITY && pm) {
    game.gainPop(pm, -5);
    await game.tell(
      p,
      did,
      L(
        `The opposition holds ${opp} seats, enough to win <b>${opp}–${R.TOTAL_SEATS - opp}</b>. The government of ${the(pm)} <b>falls</b> and ${the(pm)} loses 5 popularity. A new government must be formed.`,
        `A oposição tem ${opp} cadeiras, o suficiente para vencer por <b>${opp}–${R.TOTAL_SEATS - opp}</b>. O governo ${doP(pm)} <b>cai</b> e ${the(pm)} perde 5 de popularidade. Um novo governo precisa ser formado.`,
      ),
      'event',
      { card },
    );
    await formGovernment(game, pm.id);
  } else {
    const got = game.gainPop(p, -3);
    await game.tell(
      p,
      did,
      L(
        `The opposition only holds ${opp} seats, so the motion is <b>defeated</b> ${opp}–${R.TOTAL_SEATS - opp}. The failed stunt costs ${the(p)} ${pop(got)}.`,
        `A oposição só tem ${opp} cadeiras, então a moção é <b>derrotada</b> por ${opp}–${R.TOTAL_SEATS - opp}. A manobra fracassada custa ${pop(got)} ${aoP(p)}.`,
      ),
      'bad',
      { card },
    );
  }
}
