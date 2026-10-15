/** Media square: a press conference (draw strategy cards) or a campaign rally (⭐ capital for popularity). */
import { L } from '../../i18n';
import * as R from '../rules';
import { type Card, type EventCardView, type MediaDef, type Player } from '../types';
import { W_CAP } from './aiValues';
import type { Engine, MenuEntry } from './Engine';
import { LABEL_MEDIA, mediaFace, mediaText, pn, pop, rallyText, the, The } from './text';

export async function media(game: Engine, p: Player): Promise<void> {
  if (p.portfolios.includes('economy')) {
    const g = game.gainCapital(p, 1);
    game.view.log(
      L(
        `${pn(p)} collects campaign donations as Minister of Economy (+${g} ⭐).`,
        `${pn(p)} recebe doações de campanha pelo Ministério da Economia (+${g} ⭐).`,
      ),
    );
  }
  // The MEDIA deck decides what kind of press opportunity this is.
  const md = game.medias.next();
  await game.view.drawCard('media', p.id, mediaFace(md));
  const card: EventCardView = {
    title: md.name,
    subtitle: LABEL_MEDIA,
    flavor: md.flavor,
    text: mediaText(md),
    tone: 'info',
  };
  const full = p.hand.length >= R.HAND_LIMIT;
  const poor = p.capital < md.rallyCost;
  const noCap = L('Not enough capital', 'Capital insuficiente');
  const entries: MenuEntry[] = [
    {
      opt: {
        label: L('🎤 Press Conference', '🎤 Coletiva de Imprensa'),
        detail: L(`Draw ${md.draw} strategy cards, keep 1`, `Compre ${md.draw} cartas de estratégia, fique com 1`),
        disabled: full ? L('Hand is full', 'Mão cheia') : undefined,
        ai: p.hand.length < 8 ? 3 : 0.5,
      },
      run: () => pressConference(game, p, md, card),
    },
    {
      opt: {
        label: L('📣 Campaign Rally', '📣 Comício'),
        detail: rallyText(md),
        disabled: poor ? noCap : undefined,
        ai: md.rallyGain - md.rallyCost * W_CAP - (md.rallyCost && p.capital - md.rallyCost < 3 ? 3 : 0),
      },
      run: async () => {
        p.capital -= md.rallyCost;
        const got = game.gainPop(p, md.rallyGain);
        await game.tell(
          p,
          L(
            `decided to turn the ${md.name.toLowerCase()} into a campaign rally`,
            `decidiu transformar ${md.name.toLowerCase()} em comício`,
          ),
          L(
            `${md.rallyCost ? `${The(p)} spends ${md.rallyCost} ⭐ capital` : 'It costs nothing'}, and ${the(p)} wins ${pop(got)}.`,
            `${md.rallyCost ? `${The(p)} gasta ${md.rallyCost} ⭐ de capital` : 'Não custa nada'}, e ${the(p)} ganha ${pop(got)}.`,
          ),
          'good',
          { event: card },
        );
      },
    },
  ];
  // Populist rally cards from the hand can be played here too.
  const seen = new Set<string>();
  for (const c of p.hand) {
    if (c.kind !== 'rally' || seen.has(c.key)) continue;
    seen.add(c.key);
    const cost = c.cost!;
    entries.push({
      opt: {
        label: L(`Play ${c.name}`, `Jogar ${c.name}`),
        detail: `${cost} ⭐ → +${c.power} ${L('popularity', 'de popularidade')}${c.key === 'blitz' ? L(' and a card', ' e uma carta') : ''}`,
        card: c,
        disabled: p.capital < cost ? noCap : undefined,
        ai: c.power! - cost * W_CAP - (p.capital - cost < 4 ? 4 : 0) - (p.popularity > 92 ? 10 : 0),
      },
      run: async () => {
        game.removeCard(p, c);
        p.capital -= cost;
        const got = game.gainPop(p, c.power!);
        if (c.key === 'blitz') game.draw(p, 1);
        await game.tell(
          p,
          L(
            `decided to stage the <i>${c.name}</i> in front of the cameras`,
            `decidiu fazer o <i>${c.name}</i> diante das câmeras`,
          ),
          L(
            `A populist rally works whatever your ideology: ${the(p)} spends ${cost} ⭐ capital and wins ${pop(got)}${c.key === 'blitz' ? ', plus a new card' : ''}.`,
            `Um comício populista funciona qualquer que seja a ideologia: ${the(p)} gasta ${cost} ⭐ de capital e ganha ${pop(got)}${c.key === 'blitz' ? ', além de uma carta nova' : ''}.`,
          ),
          'good',
          { card: c },
        );
      },
    });
  }
  if (entries.every((e) => e.opt.disabled)) {
    entries.push({
      opt: { label: L('Shake some hands and move on', 'Apertar algumas mãos e seguir'), ai: 0 },
      run: () =>
        game.tell(
          p,
          L('shook a few hands with reporters', 'cumprimentou alguns repórteres'),
          L(
            `With a full hand and an empty purse, nothing changes for ${the(p)} today.`,
            `Com a mão cheia e o caixa vazio, nada muda hoje para ${the(p)}.`,
          ),
          'info',
          { event: card },
        ),
    });
  }
  await game.menu(
    p,
    md.name,
    L(
      'You drew this card from the MEDIA deck. How will you use it?',
      'Você comprou esta carta do baralho de MÍDIA. Como vai usá-la?',
    ),
    entries,
    { event: card },
  );
}

export async function pressConference(game: Engine, p: Player, md: MediaDef, card: EventCardView): Promise<void> {
  const cards: Card[] = [];
  for (let i = 0; i < md.draw; i++) {
    const c = game.drawOne('strategy');
    if (c) cards.push(c);
  }
  if (!cards.length) return;
  await game.view.drawCard('strategy', p.id);
  const i =
    cards.length === 1
      ? 0
      : await game.ask(p, {
          title: L('Press Conference — keep one card', 'Coletiva de Imprensa — fique com uma carta'),
          body: L('The others go to the discard pile.', 'As outras vão para o descarte.'),
          options: cards.map((c) => ({ label: c.name, card: c, ai: game.cardValue(p, c) })),
        });
  p.hand.push(cards[i]);
  cards.forEach((c, j) => j !== i && game.strategyDiscard.push(c));
  await game.tell(
    p,
    L(
      `decided to hold a press conference for the ${md.name.toLowerCase()}`,
      `decidiu fazer uma coletiva de imprensa: ${md.name.toLowerCase()}`,
    ),
    L(
      `${The(p)} draws ${cards.length} cards from the STRATEGY deck and secretly keeps the most useful one for later.`,
      `${The(p)} compra ${cards.length} cartas do baralho de ESTRATÉGIA e guarda em segredo a mais útil para depois.`,
    ),
    'info',
    { event: card },
  );
}
