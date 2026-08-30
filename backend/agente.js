/* agente.js — o assistente de IA, do lado de ca

   O Solaris tem um assistente movido a Google Gemini. Este arquivo e a
   metade que roda no navegador: junta o contexto, manda a pergunta e guarda
   a conversa. A metade que fala com o Google roda no Supabase, em
   banco-de-dados/supabase/functions/agente/.

   A CHAVE NAO ESTA AQUI, e nao pode estar. Chave de API em codigo de
   navegador e chave publicada — qualquer pessoa abre o DevTools e copia.
   A nossa vive como segredo do projeto Supabase e so a Edge Function le.
   O cliente nao precisa de chave nenhuma: abre o site e o assistente
   funciona.

   O QUE FAZ O ASSISTENTE SER "DELE" E NAO GENERICO

   Nao treinamos modelo. Treinar peso de modelo custaria caro e nao caberia
   num trabalho de faculdade — e nem resolveria, porque o que muda de cliente
   para cliente muda toda semana. O que fazemos e montar, a cada pergunta,
   um contexto com tres camadas:

     1. QUEM E A PESSOA — o papo rapido do cadastro (PERGUNTAS_PERFIL, aqui
        embaixo). Como quer ser chamada, quanto entende de energia, o que ela
        quer do sistema, como e a rotina da casa. Isso fica no banco e a Edge
        Function le a cada pergunta.

     2. ONDE ELA MORA — a cidade, a distribuidora, quando a tarifa dela e
        reajustada, o telefone da emergencia. Vem de banco-de-dados/dados/
        regiao-sorocaba.js e da tabela `cidades`.

     3. O QUE ESTA ACONTECENDO AGORA — os numeros do painel neste minuto:
        consumo do mes, geracao, creditos, projecao da conta, quais aparelhos
        pesam mais. Sao os unicos dados que so existem no navegador, porque e
        aqui que o medidor roda — por isso vao no corpo do pedido.

   O efeito para quem usa e o de um assistente que conhece ele. Para quem
   mantem o codigo, e um prompt montado por funcao pura, que da para ler,
   testar e corrigir.
*/
'use strict';

/* ---------- o papo rapido do cadastro ----------

   Cinco perguntas, e nenhuma delas e sobre energia de proposito. Perguntar
   "qual sua tarifa" aqui seria repetir o cadastro da unidade; o que falta ao
   sistema nao e dado tecnico, e como falar com esta pessoa.

   Todas tem opcao de pular. Cadastro que obriga a responder e cadastro que
   as pessoas abandonam no meio — e um assistente sem perfil ainda funciona,
   so responde mais generico. */
const PERGUNTAS_PERFIL = [
  {
    id: 'tratamento',
    pergunta: 'Como você prefere que eu te chame?',
    porque: 'Para o assistente falar com você do jeito que você gosta.',
    opcoes: [
      { v: 'primeiro_nome', r: 'Pelo primeiro nome, de boa' },
      { v: 'neutro', r: 'Por “você”, normal' },
      { v: 'formal', r: 'Formal, senhor ou senhora' }
    ]
  },
  {
    id: 'conhecimento',
    pergunta: 'Quanto você entende de conta de luz hoje?',
    porque: 'Define se o assistente explica cada termo ou vai direto ao ponto.',
    opcoes: [
      { v: 'leigo', r: 'Quase nada. Só sei o valor que vem' },
      { v: 'medio', r: 'O básico: sei ler o kWh e o total' },
      { v: 'tecnico', r: 'Bastante. Entendo de tarifa e de sistema solar' }
    ]
  },
  {
    id: 'objetivo',
    pergunta: 'O que você mais quer do Solaris?',
    porque: 'Toda resposta vai puxar para o que importa para você.',
    opcoes: [
      { v: 'economizar', r: 'Gastar menos no fim do mês' },
      { v: 'entender', r: 'Entender para onde vai minha energia' },
      { v: 'investimento', r: 'Saber se o sistema se pagou' },
      { v: 'sustentabilidade', r: 'Reduzir meu impacto ambiental' }
    ]
  },
  {
    id: 'rotina',
    pergunta: 'Como é o movimento na sua unidade durante o dia?',
    porque: 'Quem fica em casa de dia aproveita muito mais o sol — e o conselho muda.',
    opcoes: [
      { v: 'Fica vazia de dia, todo mundo sai', r: 'Vazia: todo mundo sai cedo' },
      { v: 'Tem gente o dia inteiro', r: 'Tem gente o dia todo' },
      { v: 'Varia bastante de um dia para o outro', r: 'Varia bastante' },
      { v: 'É um comércio, com horário de funcionamento', r: 'É um comércio' }
    ]
  },
  {
    id: 'preocupacao',
    pergunta: 'O que mais te incomoda na conta de luz hoje?',
    porque: 'É por onde o assistente vai começar a te ajudar.',
    opcoes: [
      { v: 'A conta vem alta e eu não sei por quê', r: 'Vem alta e não sei por quê' },
      { v: 'A conta varia muito de um mês para o outro', r: 'Varia demais entre os meses' },
      { v: 'Não sei se o sistema solar está rendendo o que deveria', r: 'Não sei se o solar rende' },
      { v: 'Nada me incomoda, quero só acompanhar', r: 'Nada. Só quero acompanhar' }
    ]
  }
];

/* Onde o perfil mora enquanto a pessoa responde, e depois de responder.
   Sempre no estado da conta (que vai para o banco de qualquer jeito) e,
   quando ha Supabase, tambem na tabela propria — porque quem le o perfil
   para montar o prompt e a Edge Function, no servidor. */
function perfilCliente() {
  return (S && S.perfilCliente) || null;
}
function perfilRespondido() {
  const p = perfilCliente();
  return !!(p && p.em);
}
async function salvarPerfilCliente(respostas) {
  S.perfilCliente = Object.assign({}, respostas, { em: Date.now() });
  salvar();
  await Banco.salvarPerfilConversa(contaAtual(), S.perfilCliente);
  return S.perfilCliente;
}

/* ---------- o contexto que so existe aqui ----------
   O medidor roda no navegador, entao estes numeros nao estao em tabela
   nenhuma no instante da pergunta. Vao junto com ela. */
function contextoDoPainel() {
  if (semUnidade()) return {};
  const v = visao(), u = unidade();
  const eq = aparelhos()
    .filter(e => !e.sintetico)
    .slice(0, 4)
    .map(e => e.nome + ' (' + nf((e.kwh / Math.max(v.projConsumo, 1)) * 100) + '%)')
    .join(', ');
  const abertos = alertas().filter(a => a.tipo === 'alto').map(a => a.titulo).join('; ');

  return {
    unidade: u.nome,
    tipo: u.tipo,
    cidade: u.cidade || null,
    distribuidora: u.distribuidora,
    potenciaKwp: nf(u.potenciaKwp, 1),
    paineis: u.paineis,
    tarifa: nf(tarifaAtual(), 2),
    consumoMes: nf(v.mtd.tc),
    geracaoMes: nf(v.mtd.tg),
    economia: nf(v.economia),
    creditos: nf(v.creditos),
    autoPct: nf(v.autoPct),
    contaProj: nf(v.contaProj),
    desempenho: nf(v.desempenho),
    topAparelhos: eq,
    direitoAdquirido: v.direitoAdquirido,
    percFioB: nf(v.percFioB * 100),
    alertas: abertos || 'nenhum'
  };
}

/* ---------- estado da conversa ---------- */
const AGENTE = {
  mensagens: [],      /* { papel: 'pessoa'|'assistente', texto } */
  rascunho: '',       /* o que esta digitado e ainda nao foi enviado */
  ocupado: false,
  erro: null,
  carregada: false
};

/* Por que o assistente pode estar desligado, em uma frase que diz o que
   fazer. "Indisponivel" sozinho nao ajuda ninguem. */
function agenteIndisponivel() {
  if (!Banco.online) {
    return 'O assistente precisa do Supabase configurado. Preencha a url e a chave em ' +
      'banco-de-dados/config.js e publique a função `agente` — está explicado em ' +
      'documentacao/ligar-supabase-e-gemini.md.';
  }
  if (!sessao()) return 'Entre na sua conta para falar com o assistente.';
  return null;
}

async function carregarConversa() {
  if (AGENTE.carregada) return;
  AGENTE.carregada = true;
  const h = await Banco.historicoConversa(contaAtual(), 30);
  if (h && h.length) AGENTE.mensagens = h.map(m => ({ papel: m.papel, texto: m.texto }));
}

/* Manda a pergunta e devolve o texto. Quem chama cuida de redesenhar: este
   arquivo nao toca no DOM, e a regra de camada do projeto. */
async function perguntarAoAgente(texto) {
  const pergunta = String(texto || '').trim();
  if (!pergunta || AGENTE.ocupado) return null;

  const impedimento = agenteIndisponivel();
  if (impedimento) { AGENTE.erro = impedimento; return null; }

  AGENTE.ocupado = true;
  AGENTE.erro = null;
  AGENTE.mensagens = AGENTE.mensagens.concat([{ papel: 'pessoa', texto: pergunta }]);

  const memoria = (SOLARIS_CONFIG.agente && SOLARIS_CONFIG.agente.memoria) || 12;
  const u = semUnidade() ? null : unidade();

  const r = await Banco.chamarAgente({
    pergunta: pergunta,
    modelo: (SOLARIS_CONFIG.agente && SOLARIS_CONFIG.agente.modelo) || undefined,
    cidade: (u && u.cidade) || null,
    painel: contextoDoPainel(),
    /* -1 para nao mandar de volta a pergunta que acabamos de acrescentar */
    historico: AGENTE.mensagens.slice(0, -1).slice(-memoria)
  });

  AGENTE.ocupado = false;

  if (!r || !r.ok) {
    const msg = (r && r.dados && r.dados.erro) || (r && r.erro) ||
      'Não consegui falar com o assistente agora.';
    AGENTE.erro = msg;
    /* A pergunta sai da lista: deixar ela pendurada sem resposta faz parecer
       que o assistente ignorou a pessoa. */
    AGENTE.mensagens = AGENTE.mensagens.slice(0, -1);
    return null;
  }

  const resposta = (r.dados && r.dados.texto) || '';
  AGENTE.mensagens = AGENTE.mensagens.concat([{ papel: 'assistente', texto: resposta }]);

  /* Gravar a conversa e conveniencia, nao pode segurar a tela. */
  const conta = contaAtual();
  Banco.salvarMensagem(conta, 'pessoa', pergunta);
  Banco.salvarMensagem(conta, 'assistente', resposta);

  return resposta;
}

async function limparConversaDoAgente() {
  AGENTE.mensagens = [];
  AGENTE.erro = null;
  await Banco.limparConversa(contaAtual());
}

/* Perguntas de partida. Tela de chat vazia e a coisa mais intimidante de
   qualquer produto com IA: ninguem sabe o que da para perguntar. Estas sao
   escolhidas pelo estado real do sistema, entao mudam junto com ele. */
function sugestoesDoAgente() {
  if (semUnidade()) {
    return [
      'Como eu descubro meu consumo médio na conta de luz?',
      'O que é kWp e onde acho isso na nota do instalador?',
      'Vale a pena instalar solar na minha casa?'
    ];
  }
  const v = visao(), u = unidade();
  const fora = [];
  fora.push('Por que minha conta deu ' + brl(v.contaProj) + ' esse mês?');
  if (v.desempenho < 90) fora.push('Meu sistema está gerando menos do que devia?');
  else fora.push('Meu sistema está rendendo o esperado?');
  if (!v.direitoAdquirido) fora.push('O que a Lei 14.300 mudou na minha conta?');
  fora.push('O que eu mudo hoje para gastar menos no mês que vem?');
  if (u.distribuidora && u.distribuidora !== 'Não informada' && u.distribuidora !== '—') {
    fora.push('Quando a ' + u.distribuidora + ' reajusta minha tarifa?');
  }
  return fora.slice(0, 4);
}
