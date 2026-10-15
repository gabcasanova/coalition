/** Lobby square: an interest group offers ⭐ capital; taking it from the wrong side angers your voters. */
import { L } from '../../i18n';
import * as R from '../rules';
import { AXIS_INFO, type EventCardView, type Player } from '../types';
import { W_CAP } from './aiValues';
import type { Engine } from './Engine';
import { doP, eventFace, LABEL_LOBBY, lobbyText, pop, the, The } from './text';

export async function lobby(game: Engine, p: Player): Promise<void> {
  const lb = game.lobbies.next();
  const l = R.lean(p.party.axes[lb.axis]);
  const aligned = l === lb.side;
  const pole = lb.side === 'low' ? AXIS_INFO[lb.axis].low : AXIS_INFO[lb.axis].high;
  const penalty = l === 'balanced' ? Math.ceil(lb.penalty / 2) : lb.penalty;
  const ev: EventCardView = {
    title: lb.name,
    subtitle: LABEL_LOBBY,
    flavor: lb.flavor,
    text: lobbyText(lb),
    tone: aligned ? 'good' : 'event',
  };
  await game.view.drawCard('lobby', p.id, eventFace(LABEL_LOBBY, { name: lb.name, flavor: lb.flavor, text: ev.text }));

  if (aligned) {
    await game.menu(
      p,
      lb.name,
      L(
        'This interest group shares your values and offers its backing.',
        'Este grupo de interesse compartilha seus valores e oferece apoio.',
      ),
      [
        {
          opt: {
            label: L('Accept their backing', 'Aceitar o apoio'),
            detail: L(`+${lb.capital} ⭐ Political Capital`, `+${lb.capital} ⭐ de Capital Político`),
            ai: lb.capital * W_CAP,
          },
          run: async () => {
            const g = game.gainCapital(p, lb.capital);
            await game.tell(
              p,
              L(`accepted the backing of the ${lb.name}`, `aceitou o apoio: ${lb.name}`),
              L(
                `The ${lb.name} wants ${pole}, which ${the(p)} also stands for, so ${the(p)}'s supporters don't mind: ${the(p)} gains ${g} ⭐ Political Capital.`,
                `${lb.name} quer ${pole}, que ${the(p)} também defende, então os apoiadores ${doP(p)} não se importam: ${the(p)} ganha ${g} ⭐ de Capital Político.`,
              ),
              'good',
              { event: ev },
            );
          },
        },
        {
          opt: { label: L('Politely decline', 'Recusar educadamente'), ai: -1 },
          run: () =>
            game.tell(
              p,
              L(`turned down the ${lb.name}`, `recusou o apoio: ${lb.name}`),
              L(
                `${The(p)} keeps the ${lb.name} at arm’s length, and nothing changes.`,
                `${The(p)} mantém distância, e nada muda.`,
              ),
              'info',
              { event: ev },
            ),
        },
      ],
      { event: ev },
    );
  } else {
    await game.menu(
      p,
      lb.name,
      L(
        `This group's agenda clashes with your base. Taking their money will cost you <b>${penalty}</b> popularity.`,
        `A pauta deste grupo bate de frente com sua base. Aceitar o dinheiro vai custar <b>${penalty}</b> de popularidade.`,
      ),
      [
        {
          opt: { label: L('Refuse the deal', 'Recusar o acordo'), ai: 0 },
          run: () =>
            game.tell(
              p,
              L(`refused money from the ${lb.name}`, `recusou o dinheiro: ${lb.name}`),
              L(
                `The ${lb.name} wants ${pole}, which ${the(p)}'s supporters reject. By saying no, ${the(p)} stays clean and nothing changes.`,
                `${lb.name} quer ${pole}, que os apoiadores ${doP(p)} rejeitam. Ao dizer não, ${the(p)} fica limpo e nada muda.`,
              ),
              'info',
              { event: ev },
            ),
        },
        {
          opt: {
            label: L('Take the deal anyway', 'Aceitar mesmo assim'),
            detail: L(`+${lb.capital} ⭐, −${penalty} popularity`, `+${lb.capital} ⭐, −${penalty} de popularidade`),
            ai: lb.capital * W_CAP - penalty,
          },
          run: async () => {
            const g = game.gainCapital(p, lb.capital);
            const lost = game.gainPop(p, -penalty);
            await game.tell(
              p,
              L(`took money from the ${lb.name} anyway`, `aceitou o dinheiro mesmo assim: ${lb.name}`),
              L(
                `${The(p)} pockets ${g}, but ${the(p)}'s supporters see it as a betrayal of what the party stands for: ${pop(lost)}.`,
                `${The(p)} embolsa ${g} ⭐, mas os apoiadores ${doP(p)} veem nisso uma traição ao que o partido defende: ${pop(lost)}.`,
              ),
              'bad',
              { event: ev },
            );
          },
        },
      ],
      { event: ev },
    );
  }
}
