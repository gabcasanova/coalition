/** The final screen: the winner and the full ranking. */
import type { GameResult } from '../../core/engine';
import * as R from '../../core/rules';
import { L } from '../../i18n';
import { css, emblem } from './html';

export function showGameOver(modal: HTMLElement, result: GameResult): void {
  const rows = result.rows
    .map(
      (row, i) => `<tr>
        <td>${i + 1}</td>
        <td><b style="color:${css(row.player.party.color)}">${emblem(row.player.party)} ${row.player.party.name}</b></td>
        <td class="num">${row.wins}</td>
        <td class="num2">${row.score}</td>
        <td class="det">${row.detail}</td>
      </tr>`,
    )
    .join('');
  const tied = result.rows.filter((x) => x.wins === result.rows[0].wins).length > 1;
  const how =
    result.kind === 'majority'
      ? L(
          `wins an <b>absolute parliamentary majority</b> with ${result.winner.seats} seats!`,
          `conquista a <b>maioria absoluta no parlamento</b> com ${result.winner.seats} cadeiras!`,
        )
      : L(
          `wins the game by winning the most elections (${result.winner.stats.electionWins} of ${R.YEARS})${tied ? ', with the best Governance Score as the tiebreak' : ''}.`,
          `vence o jogo por ganhar mais eleições (${result.winner.stats.electionWins} de ${R.YEARS})${tied ? ', com a melhor Pontuação de Governo como desempate' : ''}.`,
        );
  const winner = result.winner.party;
  modal.innerHTML = `<div class="pr pdialog gameover" style="--pc:${css(winner.color)}">
    <div class="prwho">${L('Game over', 'Fim de jogo')}</div>
    <div class="prtitle">🏆 ${emblem(winner)} ${winner.name}</div>
    <div class="prbody">${winner.name} ${how}</div>
    <table class="score">
      <thead>
        <tr>
          <th>#</th>
          <th>${L('Party', 'Partido')}</th>
          <th>🏆 ${L('Elections won', 'Eleições vencidas')}</th>
          <th>${L('Governance', 'Governo')}</th>
          <th>${L('Governance breakdown (tiebreak)', 'Detalhe da pontuação de governo (desempate)')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="opts"><button class="opt primary" id="again"><span class="ol">${L('Play again', 'Jogar de novo')}</span></button></div>
  </div>`;
  modal.classList.remove('hidden');
  modal.querySelector('#again')!.addEventListener('click', () => location.reload());
}
