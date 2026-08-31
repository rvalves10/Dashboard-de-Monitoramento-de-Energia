/* regiao-sorocaba.js — o que o Solaris sabe sobre onde o cliente mora

   Por que isto existe: ate aqui o sistema tratava "distribuidora" como uma
   caixa de texto livre. A pessoa digitava "CPFL" e o sistema nao sabia mais
   nada — nem quando a tarifa dela e reajustada, nem quanto tempo leva para
   homologar um sistema solar, nem para qual telefone ligar na queda de luz.

   Agora sabe. Esta tabela e a base de conhecimento da regiao de Sorocaba, e
   ela serve a tres coisas ao mesmo tempo:

     1. o cadastro sugere a distribuidora certa quando a pessoa escolhe a
        cidade, em vez de deixar ela adivinhar;
     2. a irradiacao do calculo passa a ser a da regiao dela, nao um perfil
        generico do interior de Sao Paulo;
     3. o assistente de IA responde com o nome, o prazo e o canal certos —
        e uma resposta especifica e o que separa um assistente util de um
        gerador de texto simpatico.

   ---------------------------------------------------------------------
   DE ONDE VEM CADA NUMERO — leia antes de mudar qualquer coisa

   Areas de concessao: listas de municipios concedidos da ARSESP e paginas
   institucionais do Grupo CPFL e da Neoenergia. Conferidas em agosto/2026.
   Concessao muda pouco, mas muda: se uma cidade trocar de distribuidora,
   e aqui que se corrige.

   Populacao: Censo 2022 do IBGE, ARREDONDADA AO MILHAR. E ordem de grandeza,
   para o assistente saber se fala de uma capital regional ou de uma cidade
   de dez mil pessoas. Nao use este campo em conta nenhuma.

   Irradiacao: UMA SERIE PARA A REGIAO INTEIRA, de proposito. As cidades daqui
   estao todas dentro de uns 60 km e a diferenca real de irradiacao entre elas
   e menor que a incerteza da propria medida. Inventar um valor diferente por
   cidade daria uma falsa precisao que o dado nao tem — e a regra do projeto e
   nao inventar dado. O grupo ainda deve conferir a serie no CRESESB/Atlas
   Brasileiro de Energia Solar para Sorocaba antes da banca.

   Tarifa: NAO esta aqui, e nao vai estar. Tarifa muda todo ano, varia por
   bandeira, por classe e por bandeira de consumo, e chutar um valor velho e
   pior que nao ter valor nenhum. O sistema le a tarifa da conta de luz da
   propria pessoa — que e o unico numero certo. O que guardamos aqui e QUANDO
   ela e reajustada, para o assistente avisar que a proxima conta vem
   diferente.
*/
'use strict';

/* Irradiacao global horizontal media, kWh/m² por dia, mes a mes, para a
   regiao de Sorocaba (lat -23,5; alt ~600 m). Janeiro a dezembro.
   Media anual de 4,95 kWh/m²/dia. */
const IRRADIACAO_SOROCABA = [5.6, 5.8, 5.2, 4.7, 4.0, 3.7, 3.9, 4.7, 4.8, 5.3, 5.7, 6.0];

/* ---------- quem entrega a energia ---------- */
const DISTRIBUIDORAS = {
  'cpfl-piratininga': {
    id: 'cpfl-piratininga',
    nome: 'CPFL Piratininga',
    grupo: 'Grupo CPFL Energia (State Grid)',
    area: '27 municípios do interior e do litoral de São Paulo, incluindo Sorocaba, Jundiaí e Santos',
    clientes: '1,7 milhão de unidades consumidoras, sendo mais de 300 mil em Sorocaba',
    /* O mes do reajuste e o que a pessoa sente: e quando a conta muda de
       patamar sem ela ter mudado de habito. */
    reajusteMes: 10,
    reajusteDia: 23,
    vigencia: 'de 23 de outubro a 22 de outubro do ano seguinte',
    telefone: '0800 010 1010',
    site: 'https://www.cpfl.com.br/piratininga',
    emergencia: 'Falta de energia pelo 0800 010 1010, pelo app CPFL Energia ou por SMS',
    notas: 'Reajuste anual homologado pela ANEEL em outubro. A agência de atendimento presencial de Sorocaba mudou de endereço recentemente — confirme no site antes de ir.'
  },
  'cpfl-santa-cruz': {
    id: 'cpfl-santa-cruz',
    nome: 'CPFL Santa Cruz',
    grupo: 'Grupo CPFL Energia (State Grid)',
    area: '45 municípios em três estados — 39 em São Paulo, 3 no Paraná e 3 em Minas Gerais — cobrindo 20.249 km²',
    clientes: 'mais de 500 mil unidades consumidoras',
    reajusteMes: 2,
    reajusteDia: null,
    vigencia: 'anual, em fevereiro',
    telefone: '0800 701 0102',
    site: 'https://www.cpfl.com.br/santa-cruz',
    emergencia: 'Falta de energia pelo 0800 701 0102 ou pelo app CPFL Energia',
    notas: 'Mesmo grupo da Piratininga, mas concessão e tarifa separadas: quem mora em Sarapuí não paga a mesma tarifa de quem mora em Sorocaba.'
  },
  'neoenergia-elektro': {
    id: 'neoenergia-elektro',
    nome: 'Neoenergia Elektro',
    grupo: 'Grupo Neoenergia (Iberdrola)',
    area: 'municípios do interior de São Paulo e do Mato Grosso do Sul',
    clientes: 'atende parte da região de Sorocaba pelo lado leste e sul',
    reajusteMes: 8,
    reajusteDia: 27,
    vigencia: 'anual, em agosto',
    telefone: '0800 701 0102',
    site: 'https://www.neoenergia.com/web/sp',
    emergencia: 'Falta de energia pelo 0800 701 0102, pelo site ou pelo WhatsApp da distribuidora',
    notas: 'Antiga Elektro. Confirme o número de atendimento na sua fatura: a Neoenergia usa centrais diferentes por estado.'
  }
};

/* ---------- as cidades ----------
   distancia: quilometros ate o centro de Sorocaba, por estrada, arredondado.
   perfil: como a cidade consome energia, em uma linha. Serve para o
   assistente entender o contexto de quem esta falando com ele — comercio de
   centro historico, chacara sem gas encanado e industria nao tem o mesmo
   problema de conta de luz. */
const CIDADES_REGIAO = [
  {
    id: 'sorocaba', nome: 'Sorocaba', uf: 'SP', populacao: 687000, distancia: 0,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Capital regional, quarta maior cidade do interior paulista. Forte indústria metalúrgica e de autopeças, comércio grande e muita casa de alvenaria com laje. Sede da Região Metropolitana de Sorocaba.',
    nota: 'Cidade com mais de 300 mil unidades consumidoras da CPFL Piratininga.'
  },
  {
    id: 'votorantim', nome: 'Votorantim', uf: 'SP', populacao: 124000, distancia: 8,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Colada em Sorocaba, historicamente industrial (cimento e metalurgia). Bairros residenciais grandes e muita casa com telhado de duas águas.',
    nota: 'Na prática funciona como um bairro de Sorocaba para efeito de rede elétrica.'
  },
  {
    id: 'aracoiaba-da-serra', nome: 'Araçoiaba da Serra', uf: 'SP', populacao: 40000, distancia: 22,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade de chácaras e condomínios, muita área rural. Sem gás encanado na maior parte, o que joga chuveiro elétrico e aquecimento para cima da conta de luz.',
    nota: 'Perfil clássico para solar: telhado grande, terreno amplo, pouca sombra de prédio.'
  },
  {
    id: 'salto-de-pirapora', nome: 'Salto de Pirapora', uf: 'SP', populacao: 46000, distancia: 26,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Mistura de área urbana pequena e zona rural com sítios. Bombeamento de água pesa na conta de quem mora fora do centro.',
    nota: 'Bomba d’água costuma ser o aparelho invisível que ninguém lembra de cadastrar.'
  },
  {
    id: 'ipero', nome: 'Iperó', uf: 'SP', populacao: 35000, distancia: 28,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade pequena com forte presença rural e a Fábrica de Aramar por perto. Consumo residencial concentrado de manhã e à noite.',
    nota: ''
  },
  {
    id: 'capela-do-alto', nome: 'Capela do Alto', uf: 'SP', populacao: 21000, distancia: 30,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade pequena, agricultura e pequenas indústrias. Muita residência unifamiliar com telhado amplo.',
    nota: ''
  },
  {
    id: 'aluminio', nome: 'Alumínio', uf: 'SP', populacao: 18000, distancia: 28,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade formada em volta da indústria de alumínio. Base residencial pequena e concentrada.',
    nota: ''
  },
  {
    id: 'mairinque', nome: 'Mairinque', uf: 'SP', populacao: 48000, distancia: 32,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Serra, clima mais ameno e mais nublado que Sorocaba. Ferroviária de origem, hoje dormitório e chácaras.',
    nota: 'Região de serra: dias encobertos são mais frequentes, e o sistema solar rende um pouco menos que no vale.'
  },
  {
    id: 'sao-roque', nome: 'São Roque', uf: 'SP', populacao: 91000, distancia: 40,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Turismo, vinícolas e restaurantes. Muito pequeno negócio com câmara fria e cozinha elétrica, que é o perfil onde a conta de luz mais dói.',
    nota: 'Restaurante e adega: refrigeração roda 24 h e domina a fatura.'
  },
  {
    id: 'aracariguama', nome: 'Araçariguama', uf: 'SP', populacao: 20000, distancia: 45,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade pequena às margens da Castello Branco, com galpões e logística.',
    nota: ''
  },
  {
    id: 'ibiuna', nome: 'Ibiúna', uf: 'SP', populacao: 76000, distancia: 55,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Maior área rural da região, cinturão verde de hortaliças. Muita propriedade com irrigação, estufa e câmara fria — consumo bem diferente do urbano.',
    nota: 'Região de serra e neblina: a geração real costuma ficar abaixo do que a média do interior sugere.'
  },
  {
    id: 'itu', nome: 'Itu', uf: 'SP', populacao: 175000, distancia: 50,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Cidade histórica com indústria e muitos condomínios fechados de alto padrão. Consumo residencial alto: ar-condicionado, piscina aquecida e bomba.',
    nota: 'Piscina com bomba e aquecimento é um dos maiores consumos escondidos em condomínio.'
  },
  {
    id: 'salto', nome: 'Salto', uf: 'SP', populacao: 121000, distancia: 55,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Industrial e residencial, colada em Itu. Base têxtil e metalúrgica.',
    nota: ''
  },
  {
    id: 'porto-feliz', nome: 'Porto Feliz', uf: 'SP', populacao: 53000, distancia: 45,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Agroindústria, cana e usinas. Área rural grande com consumo sazonal.',
    nota: ''
  },
  {
    id: 'boituva', nome: 'Boituva', uf: 'SP', populacao: 63000, distancia: 35,
    distribuidora: 'cpfl-piratininga',
    perfil: 'Crescimento rápido em loteamentos e condomínios, capital do paraquedismo. Muita construção nova, que já sai preparada para solar.',
    nota: 'Casa nova com telhado limpo e sem sombra é o melhor caso de instalação da região.'
  },
  {
    id: 'piedade', nome: 'Piedade', uf: 'SP', populacao: 55000, distancia: 40,
    distribuidora: 'neoenergia-elektro',
    perfil: 'Agrícola, forte em fruticultura (caqui e uva). Propriedades rurais com bomba, câmara fria e secador.',
    nota: 'ATENÇÃO: aqui a distribuidora NÃO é a CPFL. É Neoenergia Elektro, com tarifa e reajuste próprios.'
  },
  {
    id: 'tatui', nome: 'Tatuí', uf: 'SP', populacao: 120000, distancia: 55,
    distribuidora: 'neoenergia-elektro',
    perfil: 'Cidade média, conhecida pelo conservatório de música. Comércio de rua forte e indústria leve.',
    nota: 'ATENÇÃO: distribuidora Neoenergia Elektro, não CPFL.'
  },
  {
    id: 'sarapui', nome: 'Sarapuí', uf: 'SP', populacao: 10000, distancia: 40,
    distribuidora: 'cpfl-santa-cruz',
    perfil: 'Cidade pequena, base rural e pecuária.',
    nota: 'ATENÇÃO: é CPFL, mas é a CPFL SANTA CRUZ — concessão, tarifa e mês de reajuste diferentes dos de Sorocaba.'
  },
  {
    id: 'itapetininga', nome: 'Itapetininga', uf: 'SP', populacao: 157000, distancia: 70,
    distribuidora: 'cpfl-santa-cruz',
    perfil: 'Polo regional ao sul, agropecuária e indústria de papel e celulose.',
    nota: 'ATENÇÃO: CPFL Santa Cruz, não Piratininga.'
  },
  {
    id: 'sao-miguel-arcanjo', nome: 'São Miguel Arcanjo', uf: 'SP', populacao: 33000, distancia: 65,
    distribuidora: 'cpfl-santa-cruz',
    perfil: 'Agrícola, fruticultura e turismo rural na divisa do Parque Estadual Carlos Botelho.',
    nota: ''
  }
];

/* ---------- consultas ---------- */

function cidade(id) {
  return CIDADES_REGIAO.filter(c => c.id === id)[0] || null;
}
function distribuidora(id) {
  return DISTRIBUIDORAS[id] || null;
}
/* A distribuidora de uma cidade, ja resolvida. E o atalho que o cadastro e o
   assistente usam o tempo todo. */
function distribuidoraDaCidade(idCidade) {
  const c = cidade(idCidade);
  return c ? distribuidora(c.distribuidora) : null;
}
function nomesDeCidades() {
  return CIDADES_REGIAO.map(c => c.nome);
}
/* Sorocaba primeiro, depois as outras por distancia. E a ordem em que a
   lista faz sentido para quem mora aqui. */
function cidadesPorDistancia() {
  return CIDADES_REGIAO.slice().sort((a, b) => a.distancia - b.distancia);
}

/* Quantos meses faltam para a proxima conta vir reajustada. Serve para o
   sistema avisar antes, e nao depois que a pessoa levou o susto.

   ZERO significa "e este mes". Antes o mes do proprio reajuste devolvia 12,
   que e o contrario do que interessa: e justamente no mes do reajuste que a
   conta muda de patamar e a pessoa precisa conferir a tarifa. */
function mesesAteReajuste(idDistribuidora, hoje) {
  const d = distribuidora(idDistribuidora);
  if (!d || !d.reajusteMes) return null;
  const agora = hoje || new Date();
  const mesAtual = agora.getMonth() + 1;
  const diff = d.reajusteMes - mesAtual;
  return diff >= 0 ? diff : diff + 12;
}

/* O id da distribuidora a partir do nome que esta na unidade. A unidade
   guarda o nome ("CPFL Piratininga") porque e o que a pessoa le na tela; para
   consultar prazo e telefone precisamos do id de volta. */
function idDaDistribuidora(nome) {
  const alvo = String(nome || '').trim().toLowerCase();
  if (!alvo) return null;
  const achou = Object.keys(DISTRIBUIDORAS).filter(k =>
    DISTRIBUIDORAS[k].nome.toLowerCase() === alvo)[0];
  return achou || null;
}
