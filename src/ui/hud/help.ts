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
  <p>📜 <b>Drafted hands:</b> every year each party is offered 12 policy bills and keeps 7. 🧭 <b>Voters tire of the government:</b> every year the Public Mood drifts a little away from the Leader of Congress's views, so governing wears a party out.</p>
  <p><b>Popularity</b> wins you votes, and votes win seats in 24 electoral districts (150 seats in all, shared out in each district by the D'Hondt method). Like a real parliament it distorts: big parties get a seat bonus, regional strongholds pay off, and rural votes weigh more. <b>⭐ Political Capital</b> is your one currency:
  you earn it from lobbies, cabinet posts, committee reports and passing laws, and spend it on rallies, vetoes, whip votes, investigations and crisis fixes.</p>
  <p><b>Win</b> by taking 76+ seats alone in an election, or by having the <b>most points</b> after 5 years: each parliamentary election won (most seats that year), each presidential election won and each year as <b>Legislative MVP</b> (the party with the most new laws matching its ideas that year, whoever introduced them) is worth one point.
  Ties are broken by the <b>Governance Score</b> (years as Leader of Congress ×15, cabinet years ×6, laws passed ×8, plus final seats).
  Once the new government has formed, every party starts the year afresh: popularity back to 30, ⭐ capital back to 15 and a new hand of 7 bills. Bills only win popularity if they become law.</p>
  <p>In Year 1 every party <b>spins the wheel</b>, and the first parliament's seats are shared out in proportion to the numbers.</p>
  <p>When no party has 76 seats, the largest party negotiates a <b>coalition</b> by offering cabinet portfolios and ⭐ capital.
  Then the largest party left outside becomes <b>Leader of the Opposition</b> and may invite <b>one</b> more party onto the opposition bench; everyone else sits as an <b>independent</b>.
  The opposition draws STRATEGY cards on Cabinet squares, hits the government harder with leaks and can call a vote of no confidence (independents closer to it than to the Leader of Congress vote with it); independents gain popularity on Cabinet squares instead.
  Parties vote on bills by ideology; coalition partners back the Leader of Congress's bills. Each party may veto once a year; the <b>Leader of Congress</b> and the <b>Leader of the Opposition</b> may veto twice.</p>
  <p>🤝 <b>Ideology counts:</b> partners close to the Leader of Congress back its bills even when they only half agree, while distant partners pay more popularity to stay loyal and rebel more. Every year voters judge the government: allies close to the Leader win up to +4 popularity, unlikely partners lose up to 6. 🔍 <b>Leader scrutiny:</b> the most popular party gets 25% less from every popularity gain.</p>
  <p>🎖️ <b>Presidential Election:</b> the first party to pass the middle of the board each year (right after the Midterm Convention) sets off the presidential vote. The most popular party at that moment wins the presidency, and with it <b>2 extra vetoes</b> a year until the next presidential election. Until the first one, a <b>Provisional President</b> from no party holds the office. Each party's vetoes left this year show as 🛑 on its panel.</p>
  <p>☢️ <b>Super crises:</b> now and then a Crisis square draws a super crisis instead, more often for the two most popular parties. It hits hard, and <b>you can't pay your way out</b>: no ⭐ capital can buy it off, and cards and ministries can only halve it.</p>
  <p><b>Defense layers</b> against crises and scandals: your ideology (passive), reaction cards, spending ⭐ capital, and cabinet privileges.</p>`;

const RULES_PT = `
  <p>Conduza seu partido por <b>5 anos</b> de política. Cada volta no tabuleiro de 50 casas é um ano, subindo rumo à
  Eleição Parlamentar no topo. Gire a roleta (1–10) para andar.</p>
  <p>📜 <b>Escolha da mão:</b> todo ano cada partido recebe 12 projetos de lei e fica com 7. 🧭 <b>O eleitor cansa do governo:</b> todo ano o Humor do Eleitorado se afasta um pouco das ideias do Líder do Congresso, então governar desgasta.</p>
  <p>A <b>popularidade</b> rende votos, e os votos conquistam cadeiras em 24 distritos eleitorais (150 cadeiras no total, divididas em cada distrito pelo método D'Hondt). Como num parlamento de verdade, há distorções: os grandes partidos ganham um bônus de cadeiras, redutos regionais fazem diferença e o voto rural pesa mais. O <b>⭐ Capital Político</b> é sua única moeda:
  você ganha com lobbies, ministérios, relatórios de comissão e leis aprovadas, e gasta em comícios, vetos, pressão na bancada, investigações e crises.</p>
  <p><b>Vença</b> conquistando 76+ cadeiras sozinho numa eleição, ou tendo <b>mais pontos</b> depois de 5 anos: cada eleição parlamentar vencida (mais cadeiras no ano), cada eleição presidencial vencida e cada ano como <b>MVP legislativo</b> (o partido com mais leis novas que combinam com suas ideias no ano, não importa quem as apresentou) vale um ponto.
  Empates são decididos pela <b>Pontuação de Governo</b> (anos liderando o Congresso ×15, anos no gabinete ×6, leis aprovadas ×8, mais as cadeiras finais).
  Depois que o novo governo se forma, todos os partidos recomeçam o ano: popularidade de volta a 30, ⭐ capital de volta a 15 e uma nova mão de 7 projetos. Projetos só rendem popularidade se virarem lei.</p>
  <p>No Ano 1 cada partido <b>gira a roleta</b>, e as cadeiras do primeiro parlamento são divididas na proporção dos números.</p>
  <p>Quando nenhum partido tem 76 cadeiras, o maior partido negocia uma <b>coalizão</b> oferecendo ministérios e ⭐ capital.
  Depois, o maior partido que ficou de fora vira <b>Líder da Oposição</b> e pode convidar <b>mais um</b> partido para a bancada da oposição; os demais ficam como <b>independentes</b>.
  A oposição compra cartas de ESTRATÉGIA nas casas de Gabinete, atinge o governo com mais força nos vazamentos e pode apresentar uma moção de desconfiança (os independentes mais próximos dela do que do Líder do Congresso votam junto); os independentes ganham popularidade nas casas de Gabinete.
  Os partidos votam nos projetos conforme a ideologia; os aliados da coalizão apoiam os projetos do Líder do Congresso. Cada partido pode vetar uma vez por ano; o <b>Líder do Congresso</b> e o <b>Líder da Oposição</b> podem vetar duas vezes.</p>
  <p>🤝 <b>A ideologia pesa:</b> aliados próximos do Líder do Congresso apoiam os projetos dele mesmo quando concordam só em parte, enquanto aliados distantes pagam mais popularidade para se manter leais e se rebelam mais. Todo ano os eleitores julgam o governo: aliados próximos do Líder ganham até +4 de popularidade, parceiros improváveis perdem até 6. 🔍 <b>Escrutínio do líder:</b> o partido mais popular ganha 25% menos em cada aumento de popularidade.</p>
  <p>🎖️ <b>Eleição Presidencial:</b> o primeiro partido a passar pelo meio do tabuleiro a cada ano (logo depois da Convenção) dispara a votação presidencial. O partido mais popular naquele momento conquista a presidência e, com ela, <b>2 vetos extras</b> por ano até a próxima eleição presidencial. Até a primeira, um <b>Presidente Provisório</b> sem partido ocupa o cargo. Os vetos que cada partido ainda tem no ano aparecem como 🛑 no seu painel.</p>
  <p>☢️ <b>Supercrises:</b> de vez em quando uma casa de Crise sorteia uma supercrise, mais provável para os dois partidos mais populares. Ela bate forte e <b>não dá para comprar uma saída</b>: nenhum ⭐ capital a compra, e cartas e ministérios só cortam metade.</p>
  <p><b>Camadas de defesa</b> contra crises e escândalos: sua ideologia (passiva), cartas de reação, gastar ⭐ capital e privilégios dos ministérios.</p>`;
