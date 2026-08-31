/* agente — a Edge Function que fala com o Google Gemini
 *
 * POR QUE ISTO EXISTE, E NAO UMA CHAMADA DIRETA DO NAVEGADOR
 *
 * A chave do Gemini e nossa e paga por nos. Chave de API em codigo de
 * navegador e chave publicada: basta abrir o DevTools, ou a aba de rede, ou
 * ler o Solaris.html. Em uma hora ela esta rodando no bot de outra pessoa na
 * nossa fatura.
 *
 * Entao o navegador nao fala com o Google. Ele fala com esta funcao, que roda
 * no Supabase, e ela e quem fala com o Google. A chave vive como segredo do
 * projeto e nunca sai de la. O cliente nao precisa de chave nenhuma, nao cria
 * conta no Google AI Studio e nao cola nada em lugar nenhum — abre o site e o
 * assistente esta ligado.
 *
 * QUEM PODE CHAMAR: so quem esta logado. O token do usuario vem no
 * Authorization e a funcao confere com o Supabase antes de qualquer coisa. E
 * o mesmo token que decide DE QUEM e o perfil carregado — por isso ninguem
 * consegue perguntar em nome de outra pessoa, nem lendo o codigo do site.
 *
 * ---------------------------------------------------------------------
 * PUBLICAR (uma vez, na maquina de quem tem acesso ao projeto).
 * Rode DE DENTRO da pasta banco-de-dados/ — a CLI do Supabase procura as
 * funcoes em supabase/functions a partir de onde voce esta:
 *
 *   cd banco-de-dados
 *   npm i -g supabase
 *   supabase login
 *   supabase link --project-ref SEU_PROJECT_REF
 *   supabase secrets set GEMINI_API_KEY=cole_a_chave_aqui
 *   supabase functions deploy agente
 *
 * (A pasta se chama "functions", em ingles, porque e a CLI que exige esse
 * nome. Foi o unico lugar do projeto onde nao deu para usar portugues.)
 *
 * A chave sai do Google AI Studio (aistudio.google.com/apikey). Ela nao
 * aparece em nenhum arquivo do repositorio, e nao deve.
 *
 * CONFERIR se subiu:
 *   supabase functions list
 *   supabase secrets list        (mostra o nome, nunca o valor)
 * ---------------------------------------------------------------------
 */

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

/* Modelos aceitos. A lista existe porque o nome do modelo vem do config.js,
   que e um arquivo do site: sem allowlist, um erro de digitacao la viraria
   uma chamada estranha na nossa conta do Google. */
const MODELOS = new Set([
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash'
]);
const MODELO_PADRAO = 'gemini-3.5-flash';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);

  const URL_SB = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const CHAVE_GEMINI = Deno.env.get('GEMINI_API_KEY');

  if (!CHAVE_GEMINI) {
    /* Erro de configuracao nossa, nao da pessoa. A mensagem diz o que fazer
       para quem estiver com o projeto na mao. */
    return responder({
      erro: 'O assistente ainda nao foi configurado: falta o segredo GEMINI_API_KEY no projeto Supabase.'
    }, 500);
  }

  /* ---------- 1. quem esta perguntando ---------- */
  const autorizacao = req.headers.get('Authorization') || '';
  if (!autorizacao.startsWith('Bearer ')) {
    return responder({ erro: 'Entre na sua conta para falar com o assistente.' }, 401);
  }

  const cabUsuario = { apikey: ANON, Authorization: autorizacao };
  const rUsuario = await fetch(`${URL_SB}/auth/v1/user`, { headers: cabUsuario });
  if (!rUsuario.ok) {
    return responder({ erro: 'Sua sessao expirou. Entre de novo.' }, 401);
  }
  const usuario = await rUsuario.json();
  const contaId: string = usuario.id;
  const nomeUsuario: string =
    (usuario.user_metadata && usuario.user_metadata.nome) ||
    String(usuario.email || '').split('@')[0];

  /* ---------- 2. o que a pessoa mandou ---------- */
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { corpo = {}; }

  const pergunta = String(corpo.pergunta || '').trim();
  if (!pergunta) return responder({ erro: 'Nao veio pergunta nenhuma.' }, 400);
  if (pergunta.length > 4000) {
    return responder({ erro: 'Essa mensagem e longa demais. Tente resumir.' }, 400);
  }

  const modelo = MODELOS.has(String(corpo.modelo)) ? String(corpo.modelo) : MODELO_PADRAO;

  /* Dois trabalhos, o mesmo contexto. 'resposta' e a conversa: alguem
     perguntou. 'resumo' e o assistente falando primeiro, uma vez por semana,
     sem ninguem ter perguntado nada — e por isso ele nao responde como se
     estivesse num papo, nem leva historico junto. */
  const tipo: 'resposta' | 'resumo' = corpo.tipo === 'resumo' ? 'resumo' : 'resposta';

  /* Os numeros ao vivo do painel so existem no navegador (o medidor roda la),
     entao eles vem no corpo. O que e dado guardado — perfil e regiao — a
     funcao busca no banco, para o cliente nao poder inventar contexto. */
  const painel = (corpo.painel || {}) as Record<string, unknown>;
  const historico = Array.isArray(corpo.historico) ? corpo.historico : [];

  /* ---------- 3. o que o banco sabe ----------
     Com o token da pessoa: o RLS garante que o perfil que volta e o dela. */
  const consultar = async (caminho: string) => {
    const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, { headers: cabUsuario });
    if (!r.ok) return [];
    return await r.json().catch(() => []);
  };

  const [perfilLinhas, cidadeLinhas] = await Promise.all([
    consultar(`perfil_conversa?conta=eq.${contaId}&select=respostas,resumo`),
    corpo.cidade
      ? consultar(
          `cidades?id=eq.${encodeURIComponent(String(corpo.cidade))}` +
          `&select=nome,populacao,distancia_km,perfil,nota,distribuidoras(*)`
        )
      : Promise.resolve([])
  ]);

  const perfil = (perfilLinhas[0]?.respostas || {}) as Record<string, string>;
  const cidade = cidadeLinhas[0] || null;

  /* ---------- 4. o prompt ----------
     Tres blocos, nesta ordem: quem ele e, com quem esta falando, e o que
     esta acontecendo agora na casa da pessoa. */
  const instrucao = montarInstrucao(nomeUsuario, perfil, cidade, painel, tipo);

  const conteudo = [
    ...(tipo === 'resumo' ? [] : historico).slice(-12).map((m: { papel: string; texto: string }) => ({
      role: m.papel === 'assistente' ? 'model' : 'user',
      parts: [{ text: String(m.texto || '').slice(0, 4000) }]
    })),
    { role: 'user', parts: [{ text: pergunta }] }
  ];

  /* ---------- 5. o Google ---------- */
  const rGemini = await fetch(`${GEMINI}/${modelo}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': CHAVE_GEMINI
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucao }] },
      contents: conteudo,
      generationConfig: {
        temperature: 0.7,
        /* O resumo e um paragrafo, nao um artigo: teto menor sai mais barato e
           impede o modelo de encher linguica quando nao ha muito a dizer. */
        maxOutputTokens: tipo === 'resumo' ? 500 : 900,
        /* Resposta de painel e para ler rapido. Sem este teto o modelo
           escreve tres paragrafos onde cabia uma frase. */
        topP: 0.95
      },
      safetySettings: []
    })
  });

  if (!rGemini.ok) {
    const detalhe = await rGemini.text().catch(() => '');
    console.error('gemini falhou', rGemini.status, detalhe.slice(0, 500));
    /* A mensagem para a tela nao repete o erro do Google: ele vem em ingles e
       as vezes traz pedaco de configuracao nossa dentro. */
    const msg = rGemini.status === 429
      ? 'O assistente recebeu muitas perguntas ao mesmo tempo. Tente de novo em alguns segundos.'
      : 'O assistente nao conseguiu responder agora. Tente de novo daqui a pouco.';
    return responder({ erro: msg }, 502);
  }

  const dados = await rGemini.json();
  const texto = (dados?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('')
    .trim();

  if (!texto) {
    return responder({ erro: 'O assistente ficou sem resposta para essa. Tente perguntar de outro jeito.' }, 502);
  }

  return responder({ texto, modelo });
});


/* ============================================================
   O PROMPT

   Esta funcao e o "treinamento" de que fala o requisito: nao treinamos pesos
   de modelo — isso custaria caro e nao caberia num trabalho de faculdade — e
   sim damos ao modelo, a cada pergunta, quem e a pessoa, como ela quer ser
   tratada, onde ela mora, quem entrega a energia dela e o que o medidor esta
   marcando neste minuto. O efeito para quem usa e o mesmo: o assistente
   conhece ele, e nao um cliente generico.
   ============================================================ */
function montarInstrucao(
  nome: string,
  perfil: Record<string, string>,
  cidade: any,
  painel: Record<string, unknown>,
  tipo: 'resposta' | 'resumo' = 'resposta'
): string {
  const linhas: string[] = [];

  linhas.push(
    'Voce e o assistente do Solaris, um painel de monitoramento de energia solar ' +
    'usado por moradores e donos de pequeno negocio na regiao de Sorocaba, no interior de Sao Paulo.',
    '',
    'COMO VOCE FALA:',
    '- Portugues do Brasil, direto, sem jargao. Se precisar usar um termo tecnico, explique na mesma frase.',
    '- Respostas curtas: duas a cinco frases resolvem quase tudo. So se estenda se pedirem detalhe.',
    '- Numero sempre com unidade e com o que ele significa. "312 kWh" sozinho nao ajuda ninguem.',
    '- Nunca invente numero. Se o dado nao esta no contexto abaixo, diga que nao tem e explique onde a pessoa acha.',
    '- Nao prometa economia que voce nao calculou, e nao de conselho eletrico que exija tecnico. ' +
      'Mexer em quadro, disjuntor ou inversor e trabalho de profissional habilitado, e voce diz isso.',
    ''
  );

  linhas.push('COM QUEM VOCE ESTA FALANDO:', `- Nome: ${nome}.`);

  /* O papo rapido do cadastro entra aqui. Cada resposta vira uma instrucao de
     comportamento, nao um dado solto — e a diferenca entre o modelo saber que
     a pessoa e leiga e o modelo agir como se ela fosse. */
  const tratamento: Record<string, string> = {
    primeiro_nome: `- Chame de ${nome.split(' ')[0]}, sem formalidade.`,
    formal: '- Trate com formalidade, use "senhor" ou "senhora".',
    neutro: '- Trate por "voce", cordial e sem intimidade excessiva.'
  };
  if (perfil.tratamento && tratamento[perfil.tratamento]) linhas.push(tratamento[perfil.tratamento]);

  const nivel: Record<string, string> = {
    leigo: '- Ela NAO entende de energia. Nunca use kWh, kWp, TUSD ou Fio B sem traduzir para reais ou para uma comparacao do dia a dia.',
    medio: '- Ela entende o basico da conta de luz. Pode usar kWh, mas explique os termos da Lei 14.300.',
    tecnico: '- Ela entende do assunto. Pode ir direto ao ponto tecnico, sem rodeio didatico.'
  };
  if (perfil.conhecimento && nivel[perfil.conhecimento]) linhas.push(nivel[perfil.conhecimento]);

  const objetivo: Record<string, string> = {
    economizar: '- O que ela quer e gastar menos. Puxe toda resposta para o efeito em reais na proxima conta.',
    entender: '- O que ela quer e entender a propria conta. Explique o porque das coisas, nao so o numero.',
    sustentabilidade: '- O que move ela e o impacto ambiental. Traga CO2 evitado junto do dinheiro.',
    investimento: '- Ela olha o sistema como investimento. Fale de retorno, payback e vida util dos equipamentos.'
  };
  if (perfil.objetivo && objetivo[perfil.objetivo]) linhas.push(objetivo[perfil.objetivo]);

  if (perfil.moradores) linhas.push(`- Na unidade: ${perfil.moradores}.`);
  if (perfil.rotina) linhas.push(`- Rotina da casa: ${perfil.rotina}.`);
  if (perfil.preocupacao) linhas.push(`- O que mais incomoda ela hoje: ${perfil.preocupacao}.`);
  if (perfil.livre) linhas.push(`- Ela mesma contou: "${perfil.livre}".`);

  /* ---- a regiao ---- */
  if (cidade) {
    const d = cidade.distribuidoras;
    linhas.push('', 'ONDE ELA MORA:');
    linhas.push(`- ${cidade.nome}, SP` + (cidade.distancia_km ? `, a ${cidade.distancia_km} km de Sorocaba.` : '.'));
    if (cidade.perfil) linhas.push(`- Perfil da cidade: ${cidade.perfil}`);
    if (cidade.nota) linhas.push(`- ${cidade.nota}`);
    if (d) {
      linhas.push(
        `- Distribuidora: ${d.nome} (${d.grupo || 'grupo nao informado'}).`,
        `- Area de concessao: ${d.area}.`,
        `- Reajuste da tarifa: ${d.vigencia}. Avise antes que a conta vai mudar de patamar quando o mes chegar.`,
        `- Atendimento: ${d.telefone}. ${d.emergencia || ''}`
      );
      if (d.notas) linhas.push(`- Observacao: ${d.notas}`);
    }
  }

  /* ---- o painel agora ---- */
  const p = painel as any;
  if (p && p.unidade) {
    linhas.push('', 'O QUE O PAINEL DELA MOSTRA AGORA:');
    linhas.push(`- Unidade: ${p.unidade}${p.tipo ? ` (${p.tipo})` : ''}.`);
    if (p.potenciaKwp) linhas.push(`- Sistema de ${p.potenciaKwp} kWp com ${p.paineis || '?'} paineis.`);
    if (p.tarifa) linhas.push(`- Tarifa da conta dela: R$ ${p.tarifa} por kWh.`);
    if (p.consumoMes != null) linhas.push(`- Consumo no mes ate agora: ${p.consumoMes} kWh.`);
    if (p.geracaoMes != null) linhas.push(`- Geracao no mes ate agora: ${p.geracaoMes} kWh.`);
    if (p.economia != null) linhas.push(`- Economia acumulada no mes: R$ ${p.economia}.`);
    if (p.creditos != null) linhas.push(`- Creditos na rede: ${p.creditos} kWh.`);
    if (p.autoPct != null) linhas.push(`- O sol cobriu ${p.autoPct}% do consumo dela neste mes.`);
    if (p.contaProj != null) linhas.push(`- Projecao da proxima conta: R$ ${p.contaProj}.`);
    if (p.topAparelhos) linhas.push(`- Aparelhos que mais pesam: ${p.topAparelhos}.`);
    if (p.direitoAdquirido != null) {
      linhas.push(p.direitoAdquirido
        ? '- O sistema dela foi conectado antes de 07/01/2023: tem direito adquirido e nao paga Fio B ate 2045.'
        : `- Pela Lei 14.300 ela paga ${p.percFioB || '?'}% do Fio B sobre a energia compensada neste ano, e esse percentual sobe todo ano ate 2029.`);
    }
    if (p.alertas) linhas.push(`- Alertas abertos: ${p.alertas}.`);
  } else {
    linhas.push('', 'ATENCAO: ela ainda nao cadastrou nenhuma unidade, entao voce nao tem numero nenhum dela. ' +
      'Ajude a cadastrar antes de falar de economia — pergunte o consumo medio da conta de luz e a potencia do sistema.');
  }

  /* ---- o que fazer com tudo isso ---- */
  if (tipo === 'resumo') {
    linhas.push('',
      'A SUA TAREFA AGORA E OUTRA: ninguem perguntou nada.',
      '',
      'Escreva, por conta propria, um resumo curto do mes desta pessoa — dois paragrafos, ' +
      'no maximo cinco frases no total. Ele aparece direto no painel dela, sem ela ter pedido.',
      '',
      'A estrutura que funciona:',
      '1. O que esta acontecendo com a conta dela neste mes, em reais.',
      '2. UMA coisa concreta que ela pode fazer esta semana, ligada a rotina que ela contou.',
      '',
      'Regras deste formato:',
      '- Comece pelo nome dela. Nao comece com "Ola" nem com "Resumo do mes:".',
      '- Nao faca pergunta no fim. Ela nao esta conversando com voce agora.',
      '- Nao repita o painel inteiro: ele esta logo ali do lado, com todos os numeros. ' +
        'Escolha o que importa e diga por que importa.',
      '- Use **negrito** em no maximo duas expressoes, e so em coisa que muda decisao.',
      '- Se nao houver nada digno de nota, diga isso em uma frase. Inventar um alerta ' +
        'que nao existe e a forma mais rapida de a pessoa parar de ler os proximos.');
  } else {
    linhas.push('',
      'Se perguntarem algo fora de energia, conta de luz, energia solar ou do proprio Solaris, ' +
      'responda com simpatia que esse nao e o seu assunto e volte para o que voce sabe.');
  }

  return linhas.join('\n');
}
