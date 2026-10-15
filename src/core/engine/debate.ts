/** National Debate square: challenge a rival on one axis; whoever is closer to the Public Mood wins. */
import { L } from '../../i18n';
import { AXIS_INFO, AXIS_KEYS, type Player } from '../types';
import type { Engine } from './Engine';
import { the, The } from './text';

export async function debate(game: Engine, p: Player): Promise<void> {
  const rivals = game.players.filter((q) => q !== p);
  const adv = (q: Player, k: (typeof AXIS_KEYS)[number]) =>
    Math.abs(q.party.axes[k] - game.mood[k]) - Math.abs(p.party.axes[k] - game.mood[k]);
  const ri = await game.ask(p, {
    title: L('National Debate — choose your opponent', 'Debate Nacional — escolha seu adversário'),
    body: L(
      'Pick a rival and a topic. Whoever is closer to the <b>Public Mood</b> on that axis wins +6 popularity; the loser drops 3.',
      'Escolha um rival e um tema. Quem estiver mais perto do <b>Humor do Eleitorado</b> nesse eixo ganha +6 de popularidade; quem perde cai 3.',
    ),
    options: rivals.map((q) => ({
      label: q.party.name,
      detail: L(`Popularity ${q.popularity}`, `Popularidade ${q.popularity}`),
      color: q.party.color,
      ai: Math.max(...AXIS_KEYS.map((k) => adv(q, k))) * 3 + q.popularity / 20,
    })),
  });
  const r = rivals[ri];
  const ki = await game.ask(p, {
    title: L(`Debate topic vs ${r.party.name}`, `Tema do debate contra ${r.party.name}`),
    body: L(
      'The party closer to the Public Mood on this axis wins.',
      'Vence o partido mais perto do Humor do Eleitorado nesse eixo.',
    ),
    options: AXIS_KEYS.map((k) => ({
      label: AXIS_INFO[k].name,
      detail: L(
        `Mood ${game.mood[k].toFixed(1)} · You ${p.party.axes[k]} · Them ${r.party.axes[k]}`,
        `Humor ${game.mood[k].toFixed(1)} · Você ${p.party.axes[k]} · Eles ${r.party.axes[k]}`,
      ),
      ai: adv(r, k),
    })),
  });
  const k = AXIS_KEYS[ki];
  const topic = AXIS_INFO[k].name.toLowerCase();
  const did = L(
    `challenged ${the(r)} to a televised debate on ${topic} policy`,
    `desafiou ${the(r)} para um debate na TV sobre política ${topic}`,
  );
  const dp = Math.abs(p.party.axes[k] - game.mood[k]);
  const dr = Math.abs(r.party.axes[k] - game.mood[k]);
  if (Math.abs(dp - dr) < 0.05) {
    game.gainPop(p, 2);
    game.gainPop(r, 2);
    await game.tell(
      p,
      did,
      L(
        `Both parties were equally close to the public mood (${game.mood[k].toFixed(1)}). The debate is a draw and both gain +2 popularity.`,
        `Os dois partidos estavam igualmente perto do humor do eleitorado (${game.mood[k].toFixed(1)}). O debate empata e ambos ganham +2 de popularidade.`,
      ),
      'info',
    );
  } else {
    const [win, lose] = dp < dr ? [p, r] : [r, p];
    game.gainPop(win, 6);
    game.gainPop(lose, -3);
    await game.tell(
      p,
      did,
      L(
        `On ${topic} policy the public mood sits at ${game.mood[k].toFixed(1)}. ${The(win)} was closer to it and <b>won the debate</b>: +6 popularity for ${the(win)}, −3 for ${the(lose)}.`,
        `Na política ${topic}, o humor do eleitorado está em ${game.mood[k].toFixed(1)}. ${The(win)} estava mais perto e <b>venceu o debate</b>: +6 de popularidade para ${the(win)}, −3 para ${the(lose)}.`,
      ),
      win === p ? 'good' : 'bad',
    );
  }
}
