/** Fast Track and Red Tape squares: move forward or back a few squares, then play the square you land on. */
import { L } from '../../i18n';
import { BOARD_SIZE } from '../rules';
import type { Player } from '../types';
import type { Engine } from './Engine';
import { the } from './text';

export async function shortcut(game: Engine, p: Player, steps: number): Promise<void> {
  if (steps > 0) {
    // Never past the Election square.
    const forward = Math.min(steps, BOARD_SIZE - p.position);
    await game.tell(
      p,
      L('got its paperwork fast-tracked', 'teve a papelada aprovada na via rápida'),
      L(
        `The bureaucracy waves ${the(p)} through: it moves forward ${forward} squares and plays the square it lands on.`,
        `A burocracia libera ${the(p)} sem fila: o partido avança ${forward} casas e joga a casa onde parar.`,
      ),
      'good',
    );
    const arrived = await game.move(p, forward);
    if (arrived || game.over) return;
  } else {
    const back = Math.min(-steps, p.position - 1);
    if (back <= 0) return;
    await game.tell(
      p,
      L('got tangled up in red tape', 'ficou presa na burocracia'),
      L(
        `A pile of forms in triplicate sends ${the(p)} back ${back} squares, where it plays the square it lands on.`,
        `Uma pilha de formulários em três vias faz ${the(p)} voltar ${back} casas, onde joga a casa em que parar.`,
      ),
      'bad',
    );
    await game.moveBack(p, back);
  }
  await game.resolveSquare(p, true);
}
