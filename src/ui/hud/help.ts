/** The Rules window (the "Rules" button in the top bar). */
import type { SquareType } from '../../core/types';
import { SQUARE_META } from '../../data/squares';
import { L } from '../../i18n';

export function showHelp(host: HTMLElement): void {
  const squares = (Object.keys(SQUARE_META) as SquareType[])
    .map((k) => `<li><b>${SQUARE_META[k].icon} ${SQUARE_META[k].name}</b> — ${SQUARE_META[k].desc}</li>`)
    .join('');
  host.innerHTML = `<div class="pr pdialog help">
    <div class="prtitle">${L('How to play COALITION', 'Como jogar COALIZÃO')}</div>
    <div class="prbody">
      ${L(RULES_EN, RULES_PT)}
      <ul class="sqlist">${squares}</ul>
      <p class="muted">${L(
        'Tip: the 🎥 cinematic camera follows the action; drag or scroll to look around yourself (it resumes after a few seconds), or switch to Free cam. Hover a square for details. Space/Enter confirms the action bar.',
        'Dica: a 🎥 câmera cinematográfica acompanha a ação; arraste ou role para olhar você mesmo (ela volta depois de alguns segundos), ou mude para Câmera livre. Passe o mouse sobre uma casa para ver detalhes. Espaço/Enter confirma a barra de ação.',
      )}</p>
    </div>
    <div class="opts"><button class="opt primary" id="closehelp"><span class="ol">${L('Close', 'Fechar')}</span></button></div>
  </div>`;
  host.classList.remove('hidden');
  host.querySelector('#closehelp')!.addEventListener('click', () => host.classList.add('hidden'));
}

const RULES_EN = `
  <p>Lead your party through <b>5 years</b> of politics. Each lap of the 50-square board is one year, climbing toward the
  Parliamentary Election at the summit. Spin the roulette (1–10) to move.</p>
  <p><b>Popularity</b> converts into the 150 seats of parliament at each election. <b>⭐ Political Capital</b> is your one currency:
  you earn it from lobbies, cabinet posts, committee reports and passing laws, and spend it on rallies, vetoes, whip votes, investigations and crisis fixes.</p>
  <p><b>Win</b> by taking 76+ seats alone in an election, or by <b>winning the most elections</b> (most seats each year) over 5 years.
  Ties are broken by the <b>Governance Score</b> (PM years ×15, cabinet years ×6, laws passed ×8, plus final seats).
  Popularity resets to 30 after every election, and bills only win popularity if they become law.</p>
  <p>When no party has 76 seats, the largest party negotiates a <b>coalition</b> by offering cabinet portfolios and ⭐ capital.
  Parties vote on bills by ideology; coalition partners back the Prime Minister's bills.</p>
  <p><b>Defense layers</b> against crises and scandals: your ideology (passive), reaction cards, spending ⭐ capital, and cabinet privileges.</p>`;

const RULES_PT = `
  <p>Conduza seu partido por <b>5 anos</b> de política. Cada volta no tabuleiro de 50 casas é um ano, subindo rumo à
  Eleição Parlamentar no topo. Gire a roleta (1–10) para andar.</p>
  <p>A <b>popularidade</b> vira as 150 cadeiras do parlamento em cada eleição. O <b>⭐ Capital Político</b> é sua única moeda:
  você ganha com lobbies, ministérios, relatórios de comissão e leis aprovadas, e gasta em comícios, vetos, pressão na bancada, investigações e crises.</p>
  <p><b>Vença</b> conquistando 76+ cadeiras sozinho numa eleição, ou <b>vencendo mais eleições</b> (mais cadeiras a cada ano) ao longo de 5 anos.
  Empates são decididos pela <b>Pontuação de Governo</b> (anos como PM ×15, anos no gabinete ×6, leis aprovadas ×8, mais as cadeiras finais).
  A popularidade volta a 30 depois de cada eleição, e projetos só rendem popularidade se virarem lei.</p>
  <p>Quando nenhum partido tem 76 cadeiras, o maior partido negocia uma <b>coalizão</b> oferecendo ministérios e ⭐ capital.
  Os partidos votam nos projetos conforme a ideologia; os aliados da coalizão apoiam os projetos do Primeiro-Ministro.</p>
  <p><b>Camadas de defesa</b> contra crises e escândalos: sua ideologia (passiva), cartas de reação, gastar ⭐ capital e privilégios dos ministérios.</p>`;
