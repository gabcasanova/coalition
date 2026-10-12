/**
 * Brazilian Portuguese content. Applied over the English data at startup when the language is 'pt'
 * (see the `isPT` blocks in cards.ts, events.ts, board.ts and parties.ts).
 */

/** Cards by key: [name, text]. */
export const CARDS_PT: Record<string, [string, string]> = {
  // Policy bills
  rail: ['Estatização das Ferrovias', 'Os trens voltam a ser públicos.'],
  wealthtax: ['Imposto sobre Grandes Fortunas', 'Uma taxa de 2% sobre fortunas acima de dez milhões.'],
  minwage: ['Aumento do Salário Mínimo', 'Um salário digno para cada trabalhador.'],
  housing: ['Programa de Habitação Popular', '100 mil novas moradias populares.'],
  foodprice: ['Controle de Preços dos Alimentos', 'Teto para o preço do pão, do leite e do arroz.'],
  ubs: ['Serviços Básicos Universais', 'Transporte, cuidados e internet gratuitos para todos.'],
  rentcap: ['Lei do Teto dos Aluguéis', 'Congela os aluguéis nas cidades superaquecidas.'],
  labordereg: ['Flexibilização Trabalhista', 'Contratos flexíveis e menos burocracia.'],
  vouchers: ['Vales-Saúde de Livre Mercado', 'Pacientes escolhem atendimento privado.'],
  corptax: ['Corte de Impostos Corporativos', 'Imposto baixo para atrair investimentos.'],
  postal: ['Privatização dos Correios', 'Vende os correios nacionais a quem pagar mais.'],
  freetrade: ['Acordo de Livre Comércio', 'Derruba as tarifas com os vizinhos.'],
  budget: ['Emenda do Orçamento Equilibrado', 'Disciplina fiscal escrita na Constituição.'],
  marriage: ['Lei da Igualdade no Casamento', 'Os mesmos direitos de casamento para todos os casais.'],
  drugs: ['Descriminalização das Drogas', 'Tratar o vício como saúde, não como crime.'],
  immigration: ['Reforma Imigratória Aberta', 'Vistos rápidos para trabalhadores e refugiados.'],
  secular: ['Lei do Ensino Laico', 'Religião fora do currículo das escolas públicas.'],
  parity: ['Cotas de Paridade de Gênero', 'Representação igual em conselhos e listas.'],
  family: ['Lei da Família Tradicional', 'Créditos fiscais para pais casados.'],
  border: ['Verba para o Muro na Fronteira', 'Bilhões para cercas e patrulhas.'],
  crime: ['Pacote Linha-Dura contra o Crime', 'Penas maiores e mais polícia.'],
  relschools: ['Subsídio às Escolas Religiosas', 'Dinheiro público para escolas confessionais.'],
  service: ['Lei do Serviço Nacional', 'Um ano de serviço obrigatório para os jovens.'],
  carbontax: ['Imposto sobre Carbono', 'Quem polui paga por tonelada de CO₂.'],
  coal: ['Fim do Carvão', 'Fecha todas as usinas a carvão até o fim da década.'],
  rewild: ['Programa de Renaturalização', 'Devolve terras agrícolas às florestas e aos mangues.'],
  ev: ['Subsídio a Carros Elétricos', 'Dinheiro de volta em cada carro elétrico.'],
  plastic: ['Proibição do Plástico Descartável', 'Chega de canudos, sacolas e talheres.'],
  oilgas: ['Expansão do Petróleo e Gás', 'Novos blocos de exploração no mar.'],
  highway: ['Megaprojeto Rodoviário', 'Uma rodovia de seis faixas cruzando o país.'],
  nuclear: ['Programa Nuclear', 'Quatro novos reatores pela segurança energética.'],
  mining: ['Licenciamento Rápido para Mineração', 'Minas aprovadas em semanas, não em anos.'],
  industry: ['Subsídios à Indústria Pesada', 'Salvar as siderúrgicas com ajuda do Estado.'],
  referendum: ['Lei do Referendo Popular', 'Toda petição com 500 mil assinaturas vai a votação.'],
  autonomy: ['Lei da Autonomia Regional', 'Transfere poderes para as regiões.'],
  partbudget: ['Orçamento Participativo', 'Os bairros decidem os gastos locais.'],
  recall: ['Lei do Recall', 'Eleitores podem demitir seus representantes no meio do mandato.'],
  emergency: ['Lei dos Poderes de Emergência', 'O gabinete governa por decreto em crises.'],
  mediaauth: ['Agência de Fiscalização da Mídia', 'Um regulador estatal para a imprensa.'],
  police: ['Comando Policial Centralizado', 'Une as polícias regionais sob um ministério.'],
  decree: ['Reforma dos Decretos Executivos', 'Projetos do governo furam a fila das comissões.'],
  greenjobs: ['Garantia de Empregos Verdes', 'Um emprego público em energia renovável para quem quiser.'],
  digitalid: ['Identidade Digital Nacional', 'Uma identidade biométrica para cada cidadão.'],
  assemblies: ['Assembleia Cidadã do Clima', 'Uma assembleia sorteada define a política climática.'],
  pension: ['Lei da Aposentadoria Garantida', 'Uma aposentadoria que nenhum governo pode cortar.'],
  flattax: ['Reforma do Imposto Único', 'Uma alíquota simples para todo cidadão.'],
  freeuni: ['Universidade Gratuita', 'Ensino superior pago pelo Estado.'],
  schoolchoice: ['Vales para Escolha da Escola', 'Pais usam dinheiro público em qualquer escola.'],
  solar: ['Programa Telhados Solares', 'Um painel em cada prédio público.'],
  farmsubsidy: ['Pacote de Subsídio Agrícola', 'Protege o pequeno produtor das importações baratas.'],
  airport: ['Terceira Pista do Aeroporto', 'Mais voos, mais comércio, mais barulho.'],
  transparency: ['Lei da Transparência do Lobby', 'Toda reunião com lobistas vai para a internet.'],
  surveillance: ['Lei de Vigilância Digital', 'A polícia acessa mensagens privadas.'],
  euthanasia: ['Lei da Morte Digna', 'Morte assistida legal para doentes terminais.'],
  anthem: ['Lei do Patrimônio Nacional', 'História patriótica em todas as salas de aula.'],
  weekfour: ['Semana de Quatro Dias', 'Mesmo salário, um dia a mais de folga.'],
  deregulateenergy: ['Liberalização do Mercado de Energia', 'A rede elétrica aberta à concorrência privada.'],
  publictransit: ['Tarifa Zero no Transporte', 'Ônibus e trens de graça para todos.'],
  localpolice: ['Lei do Policiamento Comunitário', 'Os bairros escolhem seus chefes de polícia.'],
  military: ['Aumento dos Gastos com Defesa', 'Dois por cento do PIB para as Forças Armadas.'],
  // Strategy cards
  audit: ['Auditoria de Campanha', 'Auditores vasculham as contas de campanha de um rival.'],
  leak: ['Vazamento para a Imprensa', 'E-mails internos constrangedores chegam aos jornais.'],
  conflict: ['Conflito de Interesses', 'A empresa da família de um líder rival ganhou um contrato público.'],
  expenses: ['Escândalo das Despesas', 'Iates pagos pelo contribuinte. Os tabloides adoram.'],
  tweets: ['Posts Antigos Voltam à Tona', 'Uma década de opiniões infelizes, em print.'],
  recording: ['Gravação Secreta', 'O "off" estava gravando.'],
  grassroots: ['Discurso de Base', 'Um discurso inflamado na praça. +5 de popularidade.'],
  blitz: ['Blitz na Mídia', 'Domine as ondas do rádio e da TV. +5 de popularidade e compre uma carta.'],
  stadium: ['Comício no Estádio', 'Lote o estádio nacional. +8 de popularidade.'],
  discipline: ['Disciplina Partidária', 'Força o maior partido contrário a votar SIM no seu projeto.'],
  backroom: ['Acordo de Bastidores', 'Um acerto discreto: um partido rival vota SIM no seu projeto.'],
  spin: ['Marqueteiro', 'Cancela totalmente um escândalo ou ataque na mídia.'],
  gag: ['Mordaça Judicial', 'Cancela totalmente um escândalo ou caso de corrupção.'],
  bailout: ['Socorro de Emergência', 'Pague ⭐ capital em vez de perder popularidade (1 de capital a cada 2 pontos).'],
  damage: ['Controle de Danos', 'Reduz pela metade qualquer perda de popularidade.'],
  noconf: ['Moção de Desconfiança', 'Só a oposição, numa casa de Comissão: se a oposição tiver 76+ cadeiras, o governo cai.'],
};

export const KIND_PT = {
  bill: 'Projeto de Lei',
  scandal: 'Escândalo',
  rally: 'Comício Populista',
  whip: 'Pressão de Bancada',
  reaction: 'Reação',
  noconfidence: 'Oposição',
};

/** Global and local crisis cards by key. `options` replaces the mitigation labels, in order. */
export const EVENTS_PT: Record<string, { name: string; flavor: string; text: string; options?: string[] }> = {
  recession: {
    name: 'Recessão Econômica',
    flavor: 'Uma queda repentina do mercado ameaça empregos e gastos públicos.',
    text: 'Os eleitores culpam quem está no poder: cada partido do governo perde 8 de popularidade, e a oposição ganha 4. Partidos intervencionistas parecem preparados e sofrem só metade do dano; os de livre mercado levam a culpa pela desregulação e perdem 50% a mais.',
    options: ['Aprovar um Pacote de Estímulo', 'Culpar os Mercados Internacionais'],
  },
  inflation: {
    name: 'Disparada da Inflação',
    flavor: 'Os preços disparam no caixa do supermercado. Os eleitores querem um culpado.',
    text: 'Os consumidores se voltam contra os liberais, que perdem 10 de popularidade. Os intervencionistas apontam o controle de preços e perdem só 2; quem está no meio perde 6. Quem governa perde mais 2, porque a conta chega primeiro a eles.',
    options: ['Anunciar um Congelamento de Preços', 'Subsidiar a Conta de Luz'],
  },
  climate: {
    name: 'Catástrofe Climática',
    flavor: 'Enchentes e queimadas recordes devastam o interior.',
    text: 'Os verdes estavam certos, e os eleitores lembram: partidos ecologistas ganham 3. Todos os outros perdem 6, e os desenvolvimentistas que combateram as regras climáticas perdem metade a mais. Os partidos do governo perdem mais 2 pela resposta lenta.',
    options: ['Financiar Ajuda de Emergência', 'Decretar Luto Nacional'],
  },
  corruption: {
    name: 'Onda de Corrupção',
    flavor: 'Um amplo esquema de propinas chega aos corredores do poder.',
    text: 'Todo partido do governo leva a mesma mancha e perde 8 de popularidade, enquanto a oposição ganha 2 por estar com as mãos limpas. Partidos centralistas, que concentraram o poder, sofrem 50% a mais; os da democracia direta, só metade.',
  },
  migration: {
    name: 'Onda Migratória',
    flavor: 'Uma crise de refugiados na fronteira domina todas as manchetes.',
    text: 'O medo favorece os conservadores sociais, que ganham 3. Os progressistas são acusados de ingenuidade e perdem 6; os moderados perdem 3. Quem governa perde mais 2 por perder o controle da fronteira.',
  },
  pandemic: {
    name: 'Surto Pandêmico',
    flavor: 'Um novo vírus se espalha. Hospitais lotam e o debate sobre lockdown pega fogo.',
    text: 'O governo carrega o peso de cada fila de hospital e perde 7 de popularidade; a oposição ainda perde 3. Partidos centralistas parecem decididos e sofrem só metade, enquanto os da democracia direta parecem caóticos e perdem 50% a mais.',
    options: ['Financiar Hospitais de Campanha', 'Assinar um Pacto de União Nacional'],
  },
  energy: {
    name: 'Choque no Preço da Energia',
    flavor: 'O fornecimento de gás é cortado. A conta de luz triplica da noite para o dia.',
    text: 'Todos os partidos perdem 6 de popularidade enquanto as famílias passam frio. Os ecologistas que fecharam as usinas levam a maior culpa e perdem 50% a mais; os desenvolvimentistas que queriam mais exploração perdem só metade.',
  },
  techboom: {
    name: 'Boom Tecnológico',
    flavor: 'Uma onda de investimentos eleva salários e mercados.',
    text: 'Tempos bons fazem o governo parecer competente: os partidos do governo ganham 6 de popularidade e a oposição 1. Os partidos de livre mercado, que prometeram exatamente isso, ganham mais 3.',
  },
  constitution: {
    name: 'Crise Constitucional',
    flavor: 'O Supremo e o gabinete entram em choque por causa dos decretos de emergência.',
    text: 'Os eleitores ficam do lado do povo. Partidos centralistas, que queriam os decretos, perdem 8 de popularidade; os da democracia direta ganham 3 por defender os tribunais; os moderados perdem 3.',
  },
  strike: {
    name: 'Greve Geral',
    flavor: 'Os sindicatos param portos, trens e fábricas.',
    text: 'O país para e o governo perde 7 de popularidade; até a oposição perde 2. Os intervencionistas, amigos dos sindicatos, sofrem só metade; os de livre mercado perdem 50% a mais.',
  },
  protests: {
    name: 'Protestos da Juventude pelo Clima',
    flavor: 'Milhões marcham pelo planeta.',
    text: 'Uma nova geração encontra seus campeões: os partidos ecologistas ganham 5 de popularidade. Os desenvolvimentistas são vaiados e perdem 6; os moderados perdem 2.',
  },
  financescandal: {
    name: 'Escândalo de Caixa Dois',
    flavor: 'Denunciantes vazam provas de doações ilegais de empresas para o seu partido.',
    text: 'A história pode custar 12 de popularidade. Você pode gastar 6 de capital numa multa que apaga quase tudo, ou 3 de capital para demitir o tesoureiro como bode expiatório.',
    options: ['Pagar a Multa', 'Demitir o Tesoureiro como Bode Expiatório'],
  },
  pressleak: {
    name: 'Vazamento para a Imprensa',
    flavor: 'Um memorando de estratégia chamando os eleitores de “ingênuos” vai parar na capa dos jornais.',
    text: 'Os eleitores não gostam de ser chamados de ingênuos. O vazamento ameaça custar 8 de popularidade, a menos que você consiga controlar a narrativa.',
  },
  accident: {
    name: 'Acidente Industrial',
    flavor: 'Um vazamento químico numa fábrica que o seu partido defendeu.',
    text: 'O vazamento pode custar 6 de popularidade. Se o seu partido defendia mais indústria, custa metade a mais; se você sempre alertou sobre a poluição, os eleitores perdoam metade.',
  },
  gaffe: {
    name: 'Gafe ao Vivo na TV',
    flavor: 'Seu líder esquece o preço do pão no horário nobre.',
    text: 'O vídeo viraliza em uma hora. A menos que seus marqueteiros ajam rápido, você perde 6 de popularidade.',
  },
  bribery: {
    name: 'Investigação de Propina',
    flavor: 'A polícia faz busca e apreensão no seu diretório regional.',
    text: 'A operação pode custar 10 de popularidade, e 20% a mais se o seu partido é conhecido por centralizar o poder.',
  },
  flood: {
    name: 'Enchente no Seu Reduto',
    flavor: 'Os rios transbordam no seu distrito mais forte.',
    text: 'Seus eleitores estão debaixo d’água e furiosos. No governo, você leva a culpa pela resposta lenta e perde 10; na oposição, os eleitores são mais gentis e você perde só 4.',
  },
  publicstrike: {
    name: 'Greve do Funcionalismo',
    flavor: 'Professores e enfermeiros cruzam os braços culpando seus planos de orçamento.',
    text: 'A greve pode custar 6 de popularidade. Os partidos de livre mercado, que planejaram os cortes, perdem metade a mais; os intervencionistas, só metade.',
  },
  databreach: {
    name: 'Vazamento de Dados',
    flavor: 'O cadastro de eleitores do seu partido aparece à venda na internet.',
    text: 'Constrangedor e descuidado: o vazamento pode custar 7 de popularidade, e metade a mais se o seu partido quer que o Estado colete mais dados.',
  },
  infighting: {
    name: 'Briga no Gabinete',
    flavor: 'Ministros se atacam nos jornais de domingo.',
    text: 'Se você está no governo, a briga custa 8 de popularidade. Se está na oposição, é só sentar e assistir: +3 de popularidade.',
  },
  factory: {
    name: 'Fechamento de Fábrica',
    flavor: 'O maior empregador da cidade se muda para o exterior.',
    text: 'Centenas de empregos somem e a cidade quer respostas: você pode perder 6 de popularidade. Os partidos de livre mercado perdem metade a mais; os intervencionistas, só metade.',
  },
  floorcross: {
    name: 'Crise de Troca de Partido',
    flavor: 'Deputados descontentes foram vistos jantando com um partido rival.',
    text: 'Vários deputados seus estão prontos para mudar de lado e se juntar ao partido rival mais próximo, levando as cadeiras até a próxima eleição. Você pode deixá-los ir, comprar parte da lealdade ou convocar um congresso de emergência para segurar todos.',
  },
  floorcross2: {
    name: 'Crise de Troca de Partido',
    flavor: 'Uma briga pela linha do partido deixou sua bancada em revolta aberta.',
    text: 'Um grupo de deputados ameaça migrar para o partido rival mais próximo, levando as cadeiras até a próxima eleição. Impeça, ou veja-os atravessar o plenário.',
  },
  viral: {
    name: 'Vídeo Viral da Militância',
    flavor: 'O vídeo emocionado de um voluntário batendo de porta em porta passa de dez milhões de views.',
    text: 'Pura sorte, e puro ouro: seu partido ganha 6 de popularidade sem gastar nada.',
  },
  celebrity: {
    name: 'Apoio de Celebridade',
    flavor: 'O cantor mais amado do país sobe ao palco com as cores do seu partido.',
    text: 'Os eleitores jovens prestam atenção, e seu partido ganha 5 de popularidade.',
  },
};

export const MEDIA_PT: Record<string, { name: string; flavor: string }> = {
  primetime: { name: 'Entrevista no Horário Nobre', flavor: 'O principal âncora do país quer uma hora com o seu líder.' },
  morning: { name: 'Programa Matinal', flavor: 'Um sofá aconchegante, um apresentador simpático e milhões de espectadores com café.' },
  townhall: { name: 'Sabatina Televisionada', flavor: 'Cidadãos comuns fazem as perguntas, ao vivo.' },
  viral: { name: 'Campanha Viral nas Redes', flavor: 'Sua equipe digital tem um meme pronto para soltar.' },
  oped: { name: 'Artigo de Opinião', flavor: 'Um grande jornal oferece uma coluna ao seu líder.' },
  podcast: { name: 'Podcast de Celebridade', flavor: 'Três horas com o humorista mais famoso do país.' },
  watchparty: { name: 'Debate no Telão', flavor: 'Apoiadores se reúnem em bares do país inteiro.' },
  radio: { name: 'Turnê nas Rádios do Interior', flavor: 'Doze rádios, doze cidades, um dia longo.' },
};

export const LOBBIES_PT: Record<string, { name: string; flavor: string }> = {
  agro: { name: 'Federação do Agronegócio', flavor: 'O agro oferece apoio de campanha em troca de votos.' },
  unions: { name: 'Central Sindical', flavor: 'Os sindicatos vão mobilizar suas bases — por um preço.' },
  chamber: { name: 'Confederação da Indústria', flavor: 'Os capitães da indústria querem um amigo no parlamento.' },
  religious: { name: 'Conselho Religioso', flavor: 'Líderes religiosos oferecem seus púlpitos a um partido simpático.' },
  green: { name: 'ONGs da Aliança Verde', flavor: 'Grupos ambientais oferecem voluntários e uma lista de doadores.' },
  tech: { name: 'Associação de Startups', flavor: 'Jovens fundadores querem uma sociedade moderna e aberta.' },
  assemblies: { name: 'Rede de Assembleias Cidadãs', flavor: 'Democratas de base oferecem um exército de cabos eleitorais.' },
  security: { name: 'Conselho de Segurança e Defesa', flavor: 'Generais e delegados buscam uma mão firme.' },
  banks: { name: 'Federação dos Bancos', flavor: 'Os bancos gostariam de conversar sobre regulação.' },
  students: { name: 'União Nacional dos Estudantes', flavor: 'Os estudantes oferecem energia, memes e panfletagem.' },
};

/** Board squares: name, big label, description. */
export const SQUARES_PT: Record<string, { name: string; short: string; desc: string }> = {
  election: {
    name: 'Eleição Parlamentar',
    short: 'ELEIÇÃO',
    desc: 'O ano termina aqui. Todos os partidos param nesta casa e esperam; quando o último chega, o país vota e a popularidade vira as 150 cadeiras do parlamento.',
  },
  formation: { name: 'Formação de Governo', short: 'GABINETE', desc: 'Reunião do gabinete. Partidos do governo ganham +2 ⭐ de capital; partidos da oposição compram uma carta.' },
  midterm: {
    name: 'Convenção de Meio de Mandato',
    short: 'CONVENÇÃO',
    desc: 'O primeiro partido a chegar aqui no ano revela uma Crise Global que atinge todos os partidos. Parar exatamente aqui: convenção do partido, +4 de popularidade e +2 ⭐.',
  },
  debate: { name: 'Debate Nacional', short: 'DEBATE', desc: 'Desafie um rival para um debate na TV sobre um eixo. Quem estiver mais perto do Humor do Eleitorado ganha +6 de popularidade; quem perde cai 3.' },
  legislature: {
    name: 'Votação no Plenário',
    short: 'LEI',
    desc: 'Obrigatório: apresente um Projeto de Lei da sua mão. Projetos alinhados ganham +5 a +15 de popularidade se virarem lei; desalinhados custam 5 a 15. Depois o parlamento vota.',
  },
  media: { name: 'Mídia e Campanha', short: 'MÍDIA', desc: 'Faça uma coletiva de imprensa (compre cartas e fique com 1) ou transforme a ocasião num comício (pago em ⭐ capital, por popularidade).' },
  crisis: { name: 'Crise Nacional', short: 'CRISE', desc: 'Compre um evento de crise. Ideologia, cartas de reação e ⭐ capital podem amortecer o golpe.' },
  lobby: { name: 'Lobistas e Facções', short: 'LOBBY', desc: 'Um grupo de interesse oferece apoio. Partidos alinhados ganham ⭐ capital; os demais recusam ou arriscam a revolta dos eleitores.' },
  committee: {
    name: 'Comissão Parlamentar',
    short: 'CPI',
    desc: 'Redija um relatório (+2 ⭐), vaze um escândalo contra um rival, abra uma investigação (3 ⭐) ou, na oposição, apresente uma moção de desconfiança.',
  },
};

/** Prebuilt parties by short code. */
export const PARTIES_PT: Record<string, { name: string; short?: string; tagline: string; article: 'o' | 'a' }> = {
  NU: { name: 'União Nacional', short: 'UN', tagline: 'Centro-Direita · Liberal-Conservador', article: 'a' },
  DLP: { name: 'Partido Democrático-Trabalhista', short: 'PDT', tagline: 'Centro-Esquerda · Social-Democrata', article: 'o' },
  CP: { name: 'Partido dos Cidadãos', short: 'PC', tagline: 'Centro · Liberal', article: 'o' },
  SWP: { name: 'Partido Socialista dos Trabalhadores', short: 'PST', tagline: 'Extrema Esquerda · Socialista-Marxista', article: 'o' },
  PCO: { name: 'Partido Comunista', short: 'PCO', tagline: 'Extrema Esquerda · Marxista-Leninista', article: 'o' },
  AfC: { name: 'Aliança pelo País', short: 'AP', tagline: 'Extrema Direita · Nacional-Conservador', article: 'a' },
};
