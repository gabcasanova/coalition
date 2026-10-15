import type { Tone } from '../../core/types';
import { L } from '../../i18n';

/** Entries kept in the log; older ones are dropped. */
const MAX_ENTRIES = 400;

/** Everything that happens, kept for the History window (the 📜 button in the top bar). */
export class HistoryLog {
  private entries: { html: string; tone: Tone; year: number }[] = [];

  constructor(private readonly host: HTMLElement) {
    host.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#closehistory')) host.classList.add('hidden');
    });
  }

  add(html: string, tone: Tone, year: number): void {
    this.entries.push({ html, tone, year });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    if (!this.host.classList.contains('hidden')) this.show(); // live update while open
  }

  /** Opens the window, newest first. Turn separators are skipped, except year headings. */
  show(): void {
    const rows = [...this.entries]
      .reverse()
      .filter((h) => h.tone !== 'turn' || h.html.startsWith('<b>'))
      .map((h) => `<div class="hi t-${h.tone}"><span class="hy">${L('Y', 'A')}${h.year}</span>${h.html}</div>`)
      .join('');
    this.host.innerHTML = `<div class="pr pdialog historybox">
      <div class="prtitle">📜 ${L('History', 'Histórico')}</div>
      <div class="hlist">${rows || `<div class="muted">${L('Nothing has happened yet.', 'Nada aconteceu ainda.')}</div>`}</div>
      <div class="opts"><button class="opt primary" id="closehistory"><span class="ol">${L('Close', 'Fechar')}</span></button></div>
    </div>`;
    this.host.classList.remove('hidden');
  }
}
