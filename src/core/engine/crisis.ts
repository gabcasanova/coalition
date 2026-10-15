/** Crisis square (local crises, floor crossings) and the global crisis revealed at the Midterm Convention. */
import { L } from '../../i18n';
import * as R from '../rules';
import { type EventCardView, type EventDef, type Player } from '../types';
import { W_CAP } from './aiValues';
import { hit } from './defense';
import type { Engine } from './Engine';
import { and, doP, eventFace, LABEL_CRISIS, pn, pop, the, The } from './text';

export async function crisis(game: Engine, p: Player): Promise<void> {
  const ev = game.crises.next();
  await game.view.drawCard('crisis', p.id, eventFace(LABEL_CRISIS, ev));
  if (ev.special === 'floorcross') await floorCrossing(game, p, ev);
  else await applyEvent(game, p, ev, L('LOCAL CRISIS', 'CRISE LOCAL'));
}

/** Floor crossing: some of a party's MPs defect, seats and all, to the closest rival until the next election. */
export async function floorCrossing(game: Engine, p: Player, ev: EventDef): Promise<void> {
  const dest = game.players
    .filter((q) => q !== p)
    .sort((a, b) => R.partyDistance(p.party.axes, a.party.axes) - R.partyDistance(p.party.axes, b.party.axes))[0];
  const n = Math.min(p.seats - 1, R.clamp(Math.round(p.seats * 0.12), 2, 6));
  const card: EventCardView = {
    title: ev.name,
    subtitle: LABEL_CRISIS,
    flavor: ev.flavor,
    text: L(
      `${n} of your MPs are ready to cross the floor to ${dest.party.name}, the party closest to their views, taking their seats with them until the next election.`,
      `${n} dos seus deputados estão prontos para mudar para ${dest.party.name}, o partido mais próximo das ideias deles, levando as cadeiras até a próxima eleição.`,
    ),
    tone: 'bad',
  };
  if (!dest || n <= 0) {
    await game.tell(
      p,
      L('survived a floor-crossing scare', 'sobreviveu a um susto de troca de partido'),
      L(
        'The rebels lost their nerve: nobody crossed the floor.',
        'Os rebeldes perderam a coragem: ninguém mudou de lado.',
      ),
      'info',
      { event: card },
    );
    return;
  }
  const govNow = game.players.filter((q) => q.inGov).reduce((s, q) => s + q.seats, 0);
  const breaksGov = p.inGov !== dest.inGov && p.inGov && govNow >= R.MAJORITY && govNow - n < R.MAJORITY;
  const half = Math.ceil(n / 2);
  const cross = async (k: number, how: string) => {
    if (k <= 0) {
      await game.tell(
        p,
        L('stopped a floor-crossing', 'impediu uma troca de partido'),
        L(`${how} Every MP stays with ${the(p)}.`, `${how} Todos os deputados ficam com ${the(p)}.`),
        'good',
        { event: card },
      );
      return;
    }
    p.seats -= k;
    dest.seats += k;
    game.view.spotlight(p.id);
    await game.view.floorCross(p.id, dest.id, k);
    game.view.seatsChanged();
    const gov = game.players.filter((q) => q.inGov).reduce((s, q) => s + q.seats, 0);
    const govNote =
      p.inGov !== dest.inGov
        ? L(
            ` The government now holds ${gov} seats${gov < R.MAJORITY ? (govNow >= R.MAJORITY ? ' and has <b>lost its majority</b>!' : ', still short of a majority.') : '.'}`,
            ` O governo agora tem ${gov} cadeiras${gov < R.MAJORITY ? (govNow >= R.MAJORITY ? ' e <b>perdeu a maioria</b>!' : ', ainda sem maioria.') : '.'}`,
          )
        : '';
    await game.tell(
      p,
      L(
        `watched ${k} of its MPs cross the floor to ${the(dest)}`,
        `viu ${k} dos seus deputados mudarem para ${the(dest)}`,
      ),
      L(
        `${how} The defectors take their seats with them until the next election: ${the(p)} now holds ${p.seats} seats and ${the(dest)} ${dest.seats}.${govNote}`,
        `${how} Os desertores levam as cadeiras até a próxima eleição: ${the(p)} agora tem ${p.seats} cadeiras e ${the(dest)}, ${dest.seats}.${govNote}`,
      ),
      'bad',
      { event: card },
    );
  };
  const noCap = L('Not enough capital', 'Capital insuficiente');
  await game.menu(
    p,
    ev.name,
    L(
      `${n} MPs are about to defect to ${the(dest)}.${breaksGov ? ' <b>Losing them would cost the government its majority.</b>' : ''} What will you do?`,
      `${n} deputados estão prestes a desertar para ${the(dest)}.${breaksGov ? ' <b>Perdê-los custaria a maioria do governo.</b>' : ''} O que você vai fazer?`,
    ),
    [
      {
        opt: {
          label: L('Let them go', 'Deixá-los ir'),
          detail: L(`${n} seats move to ${dest.party.name}`, `${n} cadeiras vão para ${dest.party.name}`),
          ai: -n * 1.5 - (breaksGov ? 8 : 0),
        },
        run: () => cross(n, L(`${The(p)} let the rebels go.`, `${The(p)} deixou os rebeldes irem embora.`)),
      },
      {
        opt: {
          label: L('Promise them committee posts', 'Prometer cargos em comissões'),
          detail: L(`3 ⭐ → only ${half} cross`, `3 ⭐ → só ${half} mudam`),
          disabled: p.capital < 3 ? noCap : undefined,
          ai: -half * 1.5 - 3 * W_CAP - (breaksGov && govNow - half < R.MAJORITY ? 8 : 0),
        },
        run: () => {
          p.capital -= 3;
          return cross(
            half,
            L(
              `${The(p)} spent 3 ⭐ on promises, which kept some of the rebels.`,
              `${The(p)} gastou 3 ⭐ em promessas, que seguraram parte dos rebeldes.`,
            ),
          );
        },
      },
      {
        opt: {
          label: L('Call an emergency party congress', 'Convocar um congresso de emergência'),
          detail: L('6 ⭐ → nobody crosses', '6 ⭐ → ninguém muda'),
          disabled: p.capital < 6 ? noCap : undefined,
          ai: -6 * W_CAP,
        },
        run: () => {
          p.capital -= 6;
          return cross(
            0,
            L(
              `${The(p)} spent 6 ⭐ on an emergency party congress and won the rebels back.`,
              `${The(p)} gastou 6 ⭐ num congresso de emergência e reconquistou os rebeldes.`,
            ),
          );
        },
      },
    ],
    { event: card },
  );
}

export async function applyEvent(game: Engine, p: Player, ev: EventDef, subtitle: string): Promise<void> {
  const d = ev.delta(p);
  const view: EventCardView = {
    title: ev.name,
    subtitle,
    flavor: ev.flavor,
    text: ev.text,
    tone: d < 0 ? 'bad' : 'good',
  };
  if (d < 0) {
    await hit(game, p, { ev: view, amount: -d, tags: ev.tags, options: ev.options });
  } else {
    game.view.spotlight(p.id);
    const got = game.gainPop(p, d);
    await game.tell(
      p,
      L(`got a lucky break: <i>${ev.name}</i>`, `teve um golpe de sorte: <i>${ev.name}</i>`),
      L(
        `${ev.flavor} ${The(p)}'s popularity changes by ${R.fmt(got)}.`,
        `${ev.flavor} A popularidade ${doP(p)} muda em ${R.fmt(got)}.`,
      ),
      'good',
      { event: view },
    );
  }
}

export async function midterm(game: Engine, trigger: Player): Promise<void> {
  const ev = game.globals.next();
  const subtitle = L(`GLOBAL MIDTERM CRISIS · YEAR ${game.year}`, `CRISE GLOBAL DE MEIO DE MANDATO · ANO ${game.year}`);
  game.view.log(
    L(
      `${pn(trigger)} reaches the Midterm Convention first. <b>Global crisis: ${ev.name}!</b>`,
      `${pn(trigger)} chega primeiro à Convenção. <b>Crise global: ${ev.name}!</b>`,
    ),
    'event',
  );
  await game.view.drawCard('global', trigger.id, eventFace(L('GLOBAL CRISIS', 'CRISE GLOBAL'), ev));
  await game.view.story({
    headline: L(
      `Today, a national crisis broke out: <i>${ev.name}</i>.`,
      `Hoje, estourou uma crise nacional: <i>${ev.name}</i>.`,
    ),
    meaning: L(
      `${The(trigger)} reached the Midterm Convention first, so this global event now hits <b>every party</b>, depending on where they stand on the issues.`,
      `${The(trigger)} chegou primeiro à Convenção, então este evento global atinge <b>todos os partidos</b>, conforme a posição de cada um.`,
    ),
    tone: 'event',
    event: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'event' },
  });
  const winners: Player[] = [];
  const gains: string[] = [];
  for (const q of game.players) {
    const d = ev.delta(q);
    if (d < 0) {
      await hit(game, q, {
        ev: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'bad' },
        amount: -d,
        tags: ev.tags,
        options: ev.options,
      });
    } else if (d > 0) {
      winners.push(q);
      const got = game.gainPop(q, d);
      gains.push(L(`${The(q)} gains ${pop(got)}.`, `${The(q)} ganha ${pop(got)}.`));
    }
  }
  if (winners.length) {
    const many = winners.length > 1;
    await game.view.story({
      headline: L(
        `Today, ${and(winners.map(the))} came out of the <i>${ev.name}</i> stronger.`,
        `Hoje, ${and(winners.map(the))} ${many ? 'saíram' : 'saiu'} mais ${many ? 'fortes' : 'forte'} da crise: <i>${ev.name}</i>.`,
      ),
      meaning: L(
        `Where ${many ? 'these parties stand' : 'this party stands'} on the issue protected ${many ? 'them' : 'it'}, and voters rewarded that stance. ${gains.join(' ')}`,
        `A posição ${many ? 'desses partidos' : 'desse partido'} no tema ${many ? 'os protegeu' : 'o protegeu'}, e os eleitores recompensaram. ${gains.join(' ')}`,
      ),
      tone: 'good',
      event: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'good' },
    });
  }
  game.view.refresh();
}
