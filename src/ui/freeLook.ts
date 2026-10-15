import { BOARD } from '../core/board';
import { SQUARE_META } from '../data/squares';
import { L } from '../i18n';
import type { BoardScene } from '../render/BoardScene';

/**
 * Free look, from the main menu: orbit the board freely and hover squares for details, without playing.
 * Resolves when the player goes back to the menu.
 */
export function freeLook(board: BoardScene): Promise<void> {
  const host = document.getElementById('freelook')!;
  host.innerHTML = `<div class="flbar">
      <button id="flback">◀ ${L('Back to menu', 'Voltar ao menu')}</button>
      <span class="fltitle">👁️ ${L('Free Look', 'Explorar o Tabuleiro')}</span>
      <span class="flhint">${L(
        'Drag to rotate · right-drag to pan · scroll to zoom · hover a square for details',
        'Arraste para girar · botão direito para mover · role para zoom · passe o mouse numa casa para detalhes',
      )}</span>
      <label class="flspin"><input type="checkbox" id="flrot" /> ${L('Auto-rotate', 'Girar sozinho')}</label>
    </div>
    <div id="fltip" class="hidden"></div>`;
  host.classList.remove('hidden');
  board.controls.autoRotate = false;

  const tip = document.getElementById('fltip')!;
  board.onHover = (i, x, y) => {
    if (i === null) return tip.classList.add('hidden');
    const meta = SQUARE_META[BOARD[i]];
    tip.innerHTML = `<div class="tt">${meta.icon} ${i} · ${meta.name}</div><div>${meta.desc}</div>`;
    tip.style.left = `${Math.min(x + 16, window.innerWidth - 300)}px`;
    tip.style.top = `${Math.min(y + 16, window.innerHeight - 140)}px`;
    tip.classList.remove('hidden');
  };
  (document.getElementById('flrot') as HTMLInputElement).addEventListener('change', (e) => {
    board.controls.autoRotate = (e.target as HTMLInputElement).checked;
  });

  return new Promise((resolve) => {
    document.getElementById('flback')!.addEventListener('click', () => {
      board.onHover = undefined;
      board.controls.autoRotate = true;
      host.classList.add('hidden');
      host.innerHTML = '';
      resolve();
    });
  });
}
