/** Defense layers: how a party absorbs a popularity hit (cabinet perks, reaction cards, spending ⭐ capital). */
import { L } from '../../i18n';
import { type EventCardView, type Mitigation, type Player } from '../types';
import { W_CAP, W_CARD } from './aiValues';
import type { Engine, MenuEntry } from './Engine';
import { pop, the, The } from './text';

export interface Hit {
  ev: EventCardView;
  amount: number;
  tags: string[];
  options?: Mitigation[];
  /** Damage dealt by a rival (leaks, investigations): it can be reduced but not avoided entirely. */
  attack?: boolean;
  /**
   * A super crisis: no ⭐ capital can buy it off (no paid options, no Bailout card), and cards and ministries can
   * at most halve it.
   */
  superCrisis?: boolean;
}

/**
 * Resolve a popularity loss through the four defense layers:
 * ideological shield (already in `amount`), cabinet privileges, reaction cards, currency.
 */
export async function hit(game: Engine, p: Player, h: Hit): Promise<void> {
  let loss = h.amount;
  const tags = h.tags;
  const title = `<i>${h.ev.title}</i>`;
  const hitBy = L(`was hit by ${title}`, `foi atingido por ${title}`);
  // Neither a rival's attack nor a super crisis can be escaped entirely.
  const unavoidable = h.attack || h.superCrisis;
  game.view.spotlight(p.id);
  let shield = '';
  if (p.portfolios.includes('environment') && tags.includes('env') && h.superCrisis) {
    loss = Math.ceil(loss / 2);
    shield = L(
      `As Minister of Environment, ${the(p)} has the emergency plans ready and halves the damage. `,
      `Com o Ministério do Meio Ambiente, ${the(p)} tem os planos de emergência prontos e corta o dano pela metade. `,
    );
  } else if (p.portfolios.includes('environment') && tags.includes('env')) {
    await game.tell(
      p,
      hitBy,
      L(
        `But as Minister of Environment, ${the(p)} is immune to environmental penalties: no damage at all.`,
        `Mas, com o Ministério do Meio Ambiente, ${the(p)} é imune a penalidades ambientais: nenhum dano.`,
      ),
      'gov',
      { event: h.ev },
    );
    return;
  }
  if (p.portfolios.includes('interior') && (tags.includes('scandal') || tags.includes('corruption'))) {
    loss = Math.ceil(loss / 2);
    shield = L(
      `As Minister of Interior, ${the(p)} quietly suppressed half of the investigation. `,
      `Com o Ministério do Interior, ${the(p)} abafou discretamente metade da investigação. `,
    );
  }

  const settle = async (after: number, decided: string, how: string) => {
    const got = after > 0 ? game.gainPop(p, -after) : 0;
    const outcome =
      after > 0
        ? L(`${how} ${The(p)} loses ${-got} popularity.`, `${how} ${The(p)} perde ${-got} de popularidade.`)
        : L(`${how} ${The(p)} loses no popularity at all.`, `${how} ${The(p)} não perde nada de popularidade.`);
    await game.tell(
      p,
      L(`${hitBy} and decided to ${decided}`, `${hitBy} e decidiu ${decided}`),
      shield + outcome,
      after > 0 ? 'bad' : 'good',
      { event: h.ev },
    );
  };

  const noCap = L('Not enough capital', 'Capital insuficiente');
  const entries: MenuEntry[] = [
    {
      opt: {
        label: L('Take the hit', 'Aceitar o golpe'),
        detail: L(`Lose ${loss} popularity`, `Perder ${loss} de popularidade`),
        ai: -loss,
      },
      run: () =>
        settle(
          loss,
          L('take the hit', 'aceitar o golpe'),
          L(`${The(p)} saves its money and influence for later.`, `${The(p)} guarda o capital para depois.`),
        ),
    },
  ];

  const seen = new Set<string>();
  for (const c of p.hand) {
    if (c.kind !== 'reaction' || seen.has(c.key)) continue;
    seen.add(c.key);
    const use = () => game.removeCard(p, c);
    const play = L(`Play ${c.name}`, `Jogar ${c.name}`);
    const played = L(`play <i>${c.name}</i>`, `jogar <i>${c.name}</i>`);
    const cancels =
      (c.reaction === 'spin' && (tags.includes('scandal') || tags.includes('media'))) ||
      (c.reaction === 'gag' && (tags.includes('scandal') || tags.includes('corruption')));
    if (cancels && unavoidable) {
      const after = Math.ceil(loss / 2);
      entries.push({
        opt: {
          label: play,
          detail: h.superCrisis
            ? L(`Too big to bury: loss reduced to ${after}`, `Grande demais para abafar: perda reduzida para ${after}`)
            : L(
                `A rival's attack can't be killed outright: loss reduced to ${after}`,
                `Ataque de rival não se anula por completo: perda reduzida para ${after}`,
              ),
          card: c,
          ai: -after - W_CARD,
        },
        run: () => {
          use();
          return settle(
            after,
            played,
            h.superCrisis
              ? L(
                  'The card blunts the story, but a crisis this big cannot be buried.',
                  'A carta amortece a história, mas uma crise deste tamanho não pode ser abafada.',
                )
              : L(
                  'The card blunts the attack, but a rival’s leak cannot be buried completely.',
                  'A carta amortece o ataque, mas um vazamento de rival não pode ser abafado por completo.',
                ),
          );
        },
      });
    } else if (cancels) {
      entries.push({
        opt: { label: play, detail: L('Cancel the damage entirely', 'Cancela todo o dano'), card: c, ai: -W_CARD },
        run: () => {
          use();
          return settle(0, played, L('The card kills the story completely.', 'A carta enterra a história de vez.'));
        },
      });
    } else if (c.reaction === 'damage') {
      const after = Math.ceil(loss / 2);
      entries.push({
        opt: {
          label: play,
          detail: L(`Loss reduced to ${after}`, `Perda reduzida para ${after}`),
          card: c,
          ai: -after - W_CARD,
        },
        run: () => {
          use();
          return settle(after, played, L('The card halves the damage.', 'A carta corta o dano pela metade.'));
        },
      });
    } else if (c.reaction === 'bailout' && !unavoidable) {
      const cost = Math.ceil(loss / 2);
      entries.push({
        opt: {
          label: play,
          detail: L(`Pay ${cost} ⭐ instead of losing popularity`, `Pagar ${cost} ⭐ em vez de perder popularidade`),
          card: c,
          disabled: p.capital < cost ? noCap : undefined,
          ai: -cost * W_CAP - W_CARD,
        },
        run: () => {
          use();
          p.capital -= cost;
          return settle(
            0,
            played,
            L(
              `${The(p)} pays ${cost} ⭐ capital to make the problem go away.`,
              `${The(p)} paga ${cost} ⭐ de capital para o problema sumir.`,
            ),
          );
        },
      });
    }
  }

  // No paying your way out of a super crisis.
  const mits: Mitigation[] = h.superCrisis
    ? []
    : (h.options ?? [
        {
          label: L('Hire a PR Team', 'Contratar uma Equipe de RP'),
          cost: Math.max(1, Math.round(loss * 0.4)),
          lossMult: 0.5,
        },
        { label: L('Call in Favours', 'Cobrar Favores'), cost: Math.ceil(loss / 3) + 1, lossMult: 0 },
      ]);
  for (const m of mits) {
    const after = m.reduceTo !== undefined ? Math.min(loss, m.reduceTo) : Math.ceil(loss * (m.lossMult ?? 1));
    const gain = m.gain ?? 0;
    const c = m.cost ?? 0;
    const cost = L(`${c} ⭐ capital`, `${c} ⭐ de capital`);
    if (h.attack && (after === 0 || gain)) continue; // a rival's attack can be softened, never escaped
    const res = gain
      ? L(`+${gain} popularity instead`, `+${gain} de popularidade em vez disso`)
      : after === 0
        ? L('negate the loss', 'anula a perda')
        : L(`loss reduced to ${after}`, `perda reduzida para ${after}`);
    entries.push({
      opt: {
        label: m.label,
        detail: `${cost} → ${res}`,
        disabled: p.capital < c ? noCap : undefined,
        ai: gain - after - c * W_CAP - (c > 0 && p.capital - c < 3 ? 3 : 0),
      },
      run: async () => {
        p.capital -= c;
        if (gain) {
          const got = game.gainPop(p, gain);
          await game.tell(
            p,
            L(`${hitBy} and decided to ${m.label.toLowerCase()}`, `${hitBy} e decidiu ${m.label.toLowerCase()}`),
            L(
              `${shield}${The(p)} spends ${cost} and turns the crisis into a win: ${pop(got)}.`,
              `${shield}${The(p)} gasta ${cost} e transforma a crise em vitória: ${pop(got)}.`,
            ),
            'good',
            { event: h.ev },
          );
        } else {
          await settle(
            after,
            m.label.toLowerCase(),
            after === 0
              ? L(
                  `${The(p)} spends ${cost} and the problem goes away entirely.`,
                  `${The(p)} gasta ${cost} e o problema some por completo.`,
                )
              : L(`${The(p)} spends ${cost} to limit the damage.`, `${The(p)} gasta ${cost} para limitar o estrago.`),
          );
        }
      },
    });
  }

  await game.menu(
    p,
    h.ev.title,
    L(
      `You stand to lose <b>${loss}</b> popularity.${h.attack ? ' This is an attack by a rival party: you can soften it, but not escape it completely.' : ''}${h.superCrisis ? " <b>This is a super crisis: you can't pay your way out of it</b>, and no card buries it completely." : ''} How do you respond?`,
      `Você pode perder <b>${loss}</b> de popularidade.${h.attack ? ' É um ataque de um partido rival: dá para amortecer, mas não escapar totalmente.' : ''}${h.superCrisis ? ' <b>É uma supercrise: não dá para comprar uma saída</b>, e nenhuma carta a abafa por completo.' : ''} Como você reage?`,
    ),
    entries,
    { event: h.ev },
  );
  game.view.refresh();
}
