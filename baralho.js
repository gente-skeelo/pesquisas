/**
 * Baralho do quiz: festas juninas pelo mundo.
 *
 * As perguntas em pt são o texto canônico (fornecido pela organização);
 * o en é tradução. As alternativas ficam na mesma ordem nos dois idiomas,
 * por isso `correta` é um índice só, compartilhado. `curiosidade` é opcional
 * e aparece na tela grande na revelação.
 */

export const BARALHO = [
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'Qual é a origem das festas juninas?',
      opcoes: [
        'Surgiram no Brasil para celebrar a colheita do milho',
        'Têm origem em festividades pagãs europeias ligadas ao solstício de verão',
        'Foram criadas pela Igreja Católica na América do Sul',
        'Nasceram na Espanha como uma homenagem aos agricultores',
      ],
      curiosidade: '',
    },
    en: {
      enunciado: 'What is the origin of the festas juninas?',
      opcoes: [
        'They appeared in Brazil to celebrate the corn harvest',
        'They come from European pagan festivities tied to the summer solstice',
        'They were created by the Catholic Church in South America',
        'They were born in Spain as a tribute to farmers',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'O nome "junina" está relacionado principalmente a:',
      opcoes: [
        'O antigo rei europeu Juno',
        'O mês de junho',
        'A dança típica portuguesa',
        'A cidade italiana',
      ],
      curiosidade: '',
    },
    en: {
      enunciado: 'The name "junina" is mainly related to:',
      opcoes: [
        'The ancient European king Juno',
        'The month of June',
        'A traditional Portuguese dance',
        'An Italian city',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 25,
    correta: 0,
    pt: {
      enunciado:
        'As primeiras celebrações que deram origem às festas juninas tinham como objetivo principal:',
      opcoes: [
        'Celebrar os ciclos da natureza, especialmente o solstício de verão, e agradecer pela fertilidade da terra',
        'Comemorar a conclusão das colheitas de inverno promovidas pelos reinos medievais',
        'Marcar o início das peregrinações cristãs dedicadas aos santos de junho',
        'Celebrar o início da expansão agrícola durante o Império Romano',
      ],
      curiosidade: '',
    },
    en: {
      enunciado:
        'The earliest celebrations that gave rise to the festas juninas had as their main purpose:',
      opcoes: [
        "Celebrating nature's cycles, especially the summer solstice, and giving thanks for the fertility of the land",
        'Marking the end of the winter harvests promoted by medieval kingdoms',
        'Marking the start of Christian pilgrimages devoted to the June saints',
        'Celebrating the start of agricultural expansion under the Roman Empire',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 0,
    pt: {
      enunciado:
        'A Igreja Católica incorporou as antigas festas pagãs ao calendário cristão para celebrar quais santos?',
      opcoes: [
        'São João, Santo Antônio e São Pedro',
        'São Francisco, São Bento e São Jorge',
        'Santa Luzia, São José e São Paulo',
        'Santo Expedito, São Miguel e São Marcos',
      ],
      curiosidade: '',
    },
    en: {
      enunciado:
        'The Catholic Church folded the old pagan festivals into the Christian calendar to celebrate which saints?',
      opcoes: [
        'Saint John, Saint Anthony and Saint Peter',
        'Saint Francis, Saint Benedict and Saint George',
        'Saint Lucy, Saint Joseph and Saint Paul',
        'Saint Expeditus, Saint Michael and Saint Mark',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 2,
    pt: {
      enunciado: 'As famosas simpatias de Santo Antônio têm como principal objetivo:',
      opcoes: [
        'Atrair prosperidade para a colheita',
        'Pedir proteção para a família durante o inverno',
        'Buscar sorte na vida amorosa ou encontrar um parceiro',
        'Garantir fartura de alimentos durante o ano',
      ],
      curiosidade:
        'A fama de Santo Antônio como casamenteiro surgiu, entre outros motivos, pela tradição de que ele ajudava mulheres pobres oferecendo recursos para o dote, tornando o casamento possível. As simpatias existem em vários países católicos — Portugal, Itália, Espanha —, mas foi no Brasil que ficaram mais populares e ganharam versões bem criativas.',
    },
    en: {
      enunciado: "The famous Saint Anthony love charms have as their main goal:",
      opcoes: [
        'Attracting prosperity for the harvest',
        'Asking protection for the family through winter',
        'Seeking luck in love or finding a partner',
        'Ensuring plenty of food through the year',
      ],
      curiosidade:
        "Saint Anthony's fame as a matchmaker arose, among other reasons, from the tradition that he helped poor women by providing dowry money, making marriage possible. The charms exist in several Catholic countries — Portugal, Italy, Spain — but it was in Brazil that they became most popular, with very creative versions.",
    },
  },
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'O milho ocupa um lugar de destaque nas festas juninas brasileiras principalmente porque:',
      opcoes: [
        'Era considerado um alimento sagrado pelos colonizadores portugueses',
        'Está em época de colheita durante os meses em que a festa acontece no Brasil',
        'Foi introduzido pelos imigrantes italianos',
        'Era o principal alimento consumido nas festas medievais europeias',
      ],
      curiosidade: '',
    },
    en: {
      enunciado: 'Corn holds pride of place at Brazilian festas juninas mainly because:',
      opcoes: [
        'It was considered a sacred food by the Portuguese colonizers',
        'It is in harvest season during the months when the festival happens in Brazil',
        'It was introduced by Italian immigrants',
        'It was the main food eaten at medieval European festivals',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'Na Itália, uma celebração tradicional relacionada ao período junino é conhecida como:',
      opcoes: [
        'Festa della Vendemmia',
        'Notte di San Giovanni',
        'Carnevale di Venezia',
        'Festa della Primavera',
      ],
      curiosidade:
        'A Notte di San Giovanni (Noite de São João) reúne fogueiras, flores, ervas aromáticas e celebrações populares em diversas regiões italianas.',
    },
    en: {
      enunciado: 'In Italy, a traditional celebration tied to the June season is known as:',
      opcoes: [
        'Festa della Vendemmia',
        'Notte di San Giovanni',
        'Carnevale di Venezia',
        'Festa della Primavera',
      ],
      curiosidade:
        "The Notte di San Giovanni (Saint John's Night) brings together bonfires, flowers, aromatic herbs and popular celebrations across several Italian regions.",
    },
  },
  {
    segundos: 20,
    correta: 2,
    pt: {
      enunciado:
        'Na Colômbia, qual é a principal festa realizada no fim de junho e inspirada nas tradições de São João e São Pedro?',
      opcoes: [
        'Feria de las Flores',
        'Carnaval de Barranquilla',
        'Festival Folclórico de San Juan y San Pedro',
        'Fiesta del Café',
      ],
      curiosidade: '',
    },
    en: {
      enunciado:
        'In Colombia, what is the main festival held at the end of June, inspired by the traditions of Saint John and Saint Peter?',
      opcoes: [
        'Feria de las Flores',
        'Carnaval de Barranquilla',
        'Festival Folclórico de San Juan y San Pedro',
        'Fiesta del Café',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 0,
    pt: {
      enunciado:
        'Qual tradição também pode ser encontrada nas celebrações de São João em algumas regiões da Argentina?',
      opcoes: [
        'A queima de fogueiras como símbolo de renovação',
        'A dança da quadrilha com encenação de casamento tradicional',
        'A construção de altares decorados para homenagear São João Batista',
        'A distribuição de fitas coloridas para representar os pedidos feitos aos santos',
      ],
      curiosidade: '',
    },
    en: {
      enunciado:
        "Which tradition can also be found in Saint John's celebrations in some regions of Argentina?",
      opcoes: [
        'Lighting bonfires as a symbol of renewal',
        'Dancing the quadrilha with a staged traditional wedding',
        'Building decorated altars to honour Saint John the Baptist',
        'Handing out coloured ribbons to represent wishes made to the saints',
      ],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'A tradicional quadrilha brasileira é inspirada em:',
      opcoes: [
        'Danças indígenas brasileiras',
        'Danças de salão francesas adaptadas pelos portugueses e brasileiros',
        'Ritmos africanos trazidos pelos escravizados',
        'Danças medievais espanholas',
      ],
      curiosidade:
        'A palavra "quadrilha" vem da dança francesa quadrille, muito popular entre a nobreza europeia no século XVIII. No Brasil, ela foi adaptada e ganhou um estilo bem-humorado e popular.',
    },
    en: {
      enunciado: 'The traditional Brazilian quadrilha is inspired by:',
      opcoes: [
        'Brazilian Indigenous dances',
        'French ballroom dances adapted by the Portuguese and Brazilians',
        'African rhythms brought by enslaved people',
        'Medieval Spanish dances',
      ],
      curiosidade:
        'The word "quadrilha" comes from the French dance quadrille, hugely popular with European nobility in the 18th century. In Brazil it was adapted and took on a playful, popular style.',
    },
  },
  {
    segundos: 20,
    correta: 1,
    pt: {
      enunciado: 'A fogueira das festas juninas simboliza, segundo a tradição cristã:',
      opcoes: [
        'A proteção das plantações',
        'O anúncio do nascimento de São João Batista',
        'A chegada do inverno',
        'A despedida da colheita',
      ],
      curiosidade:
        'Segundo a tradição, Isabel teria acendido uma fogueira para avisar Maria sobre o nascimento de João Batista.',
    },
    en: {
      enunciado: 'According to Christian tradition, the festa junina bonfire symbolizes:',
      opcoes: [
        'Protection of the crops',
        'The announcement of the birth of Saint John the Baptist',
        'The arrival of winter',
        'The farewell to the harvest',
      ],
      curiosidade:
        'According to tradition, Elizabeth lit a bonfire to let Mary know of the birth of John the Baptist.',
    },
  },
  {
    segundos: 20,
    correta: 2,
    pt: {
      enunciado:
        'Qual destes doces é originalmente produzido a partir da mandioca e também é muito comum nas festas juninas?',
      opcoes: ['Curau', 'Cocada', 'Bolo de aipim (mandioca)', 'Pé de moleque'],
      curiosidade: '',
    },
    en: {
      enunciado:
        'Which of these sweets is originally made from cassava and is also very common at festas juninas?',
      opcoes: ['Curau', 'Cocada', 'Cassava cake (bolo de aipim)', 'Pé de moleque'],
      curiosidade: '',
    },
  },
  {
    segundos: 20,
    correta: 2,
    pt: {
      enunciado:
        'Em qual região do Brasil as festas juninas costumam ter maior duração e mobilizar milhões de pessoas?',
      opcoes: ['Sul', 'Centro-Oeste', 'Nordeste', 'Norte'],
      curiosidade:
        'Cidades como Campina Grande (PB) e Caruaru (PE) disputam o título de "Maior São João do Mundo".',
    },
    en: {
      enunciado:
        'In which region of Brazil do the festas juninas last longest and draw millions of people?',
      opcoes: ['South', 'Center-West', 'Northeast', 'North'],
      curiosidade:
        'Cities like Campina Grande (PB) and Caruaru (PE) fight over the title of "World\'s Biggest São João".',
    },
  },
  {
    segundos: 20,
    correta: 0,
    pt: {
      enunciado: 'Qual destes países também celebra intensamente a Festa de São João?',
      opcoes: ['Portugal', 'Japão', 'Canadá', 'Austrália'],
      curiosidade:
        'No Porto, em Portugal, é tradição bater levemente na cabeça das pessoas com martelinhos de plástico durante a festa.',
    },
    en: {
      enunciado: 'Which of these countries also celebrates the Feast of Saint John intensely?',
      opcoes: ['Portugal', 'Japan', 'Canada', 'Australia'],
      curiosidade:
        'In Porto, Portugal, it is tradition to gently tap people on the head with squeaky plastic hammers during the festival.',
    },
  },
  {
    segundos: 20,
    correta: 3,
    pt: {
      enunciado: 'Qual destas brincadeiras tradicionalmente faz parte das festas juninas?',
      opcoes: ['Corrida do saco', 'Cabo de guerra', 'Pescaria', 'Todas as alternativas'],
      curiosidade: '',
    },
    en: {
      enunciado: 'Which of these games is traditionally part of the festas juninas?',
      opcoes: ['Sack race', 'Tug of war', 'Fishing booth', 'All of the above'],
      curiosidade: '',
    },
  },
];
