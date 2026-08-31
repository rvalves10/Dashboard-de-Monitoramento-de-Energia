/* avisos — o alerta que sai do site
 *
 * O painel avisa que a meta vai estourar. So que ele avisa para quem esta com
 * o site aberto — e o consumo alto acontece justamente quando ninguem esta
 * olhando. Esta funcao roda no servidor, uma vez por dia, e manda e-mail.
 *
 * ---------------------------------------------------------------------
 * O QUE ELA FAZ, EM ORDEM
 *
 *   1. le todas as contas que tem estado e meta cadastrados;
 *   2. para cada uma, estima o consumo do mes a partir das leituras que
 *      subiram para a tabela `leituras`;
 *   3. compara com a meta da unidade ativa;
 *   4. se a projecao passar da meta, manda um e-mail — UM SO por mes e por
 *      conta, controlado pela tabela `avisos_enviados`.
 *
 * ---------------------------------------------------------------------
 * POR QUE A PROJECAO DAQUI E MAIS SIMPLES QUE A DO PAINEL — leia antes de
 * comparar os dois numeros e achar que um esta errado.
 *
 * O painel projeta simulando o mes inteiro hora a hora, com a curva do
 * arquetipo, a irradiacao da regiao e a compensacao de creditos. Esse motor
 * mora em backend/motor.js, no navegador, e portar ele para ca seria manter
 * duas copias da mesma fisica — a pior coisa que da para fazer com um calculo
 * que a banca vai questionar.
 *
 * Entao aqui a conta e outra, deliberadamente grosseira:
 *
 *     potencia media medida  x  24 h  x  dias do mes
 *
 * E o suficiente para o unico trabalho desta funcao, que e decidir SE vale
 * incomodar a pessoa. O numero fino ela ve no painel, e o e-mail manda ela
 * para la em vez de repetir valores.
 *
 * O RISCO DESSA CONTA, dito com todas as letras: o medidor so grava enquanto
 * a aba esta aberta. Se a pessoa so abre o Solaris de dia, a media fica
 * puxada para cima pelo consumo diurno e a projecao exagera. Por isso a
 * funcao exige uma amostra minima e espalhada — pelo menos 200 leituras
 * cobrindo 12 horas diferentes do dia — e pula a conta quando nao tem isso.
 * Menos avisos e melhor que aviso errado: quem recebe alarme falso desliga
 * o alarme.
 *
 * ---------------------------------------------------------------------
 * PUBLICAR (de dentro de banco-de-dados/):
 *
 *   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
 *   supabase secrets set AVISOS_REMETENTE="Solaris <avisos@seu-dominio.com>"
 *   supabase functions deploy avisos --no-verify-jwt
 *
 * O --no-verify-jwt e necessario: quem chama nao e uma pessoa logada, e o
 * agendador do banco. Em troca, a funcao exige um segredo proprio no
 * cabecalho (AVISOS_SEGREDO) — sem ele, qualquer um na internet dispararia
 * os e-mails do projeto inteiro.
 *
 *   supabase secrets set AVISOS_SEGREDO=$(openssl rand -hex 24)
 *
 * AGENDAR (no SQL Editor, uma vez):
 *
 *   create extension if not exists pg_cron;
 *   create extension if not exists pg_net;
 *
 *   select cron.schedule('solaris-avisos', '0 12 * * *', $$
 *     select net.http_post(
 *       url     := 'https://SEU_REF.supabase.co/functions/v1/avisos',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'x-solaris-segredo', 'O_MESMO_SEGREDO_DO_AVISOS_SEGREDO'),
 *       body    := '{}'::jsonb
 *     );
 *   $$);
 *
 * 12h UTC e 9h da manha em Sorocaba. Uma vez por dia: o consumo de uma casa
 * nao muda de hora em hora, e cada rodada custa uma chamada por conta.
 *
 * Para conferir sem esperar o dia seguinte, chame a mao com o cabecalho do
 * segredo e `{"seco": true}` no corpo — ele calcula tudo e devolve o que
 * mandaria, sem mandar e-mail nenhum.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-solaris-segredo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* A amostra minima para a media valer alguma coisa. */
const MINIMO_LEITURAS = 200;
const MINIMO_HORAS_DISTINTAS = 12;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);

  const URL_SB = Deno.env.get('SUPABASE_URL')!;
  const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SEGREDO = Deno.env.get('AVISOS_SEGREDO');
  const RESEND = Deno.env.get('RESEND_API_KEY');
  const REMETENTE = Deno.env.get('AVISOS_REMETENTE') || 'Solaris <onboarding@resend.dev>';

  /* Esta funcao roda sem verificacao de JWT, porque quem chama e o agendador
     do banco. O segredo proprio e o que impede a internet inteira de disparar
     os e-mails do projeto. */
  if (!SEGREDO) {
    return responder({ erro: 'Falta o segredo AVISOS_SEGREDO no projeto.' }, 500);
  }
  if (req.headers.get('x-solaris-segredo') !== SEGREDO) {
    return responder({ erro: 'Nao autorizado.' }, 401);
  }

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { corpo = {}; }
  const seco = corpo.seco === true;

  /* Chave de servico: esta funcao precisa enxergar todas as contas, e por
     isso ela passa por cima do RLS. E o unico lugar do projeto que faz isso,
     e ele roda no servidor — a chave nunca chega perto do navegador. */
  const cab = {
    apikey: SERVICO,
    Authorization: `Bearer ${SERVICO}`,
    'Content-Type': 'application/json'
  };
  const consultar = async (caminho: string) => {
    const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, { headers: cab });
    if (!r.ok) {
      console.error('consulta falhou', caminho, r.status, await r.text().catch(() => ''));
      return [];
    }
    return await r.json().catch(() => []);
  };

  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = agora.getUTCMonth();
  const referencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const inicioMes = new Date(Date.UTC(ano, mes, 1)).toISOString();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

  const estados = await consultar('estado?select=conta,dados');
  const jaAvisados = await consultar(
    `avisos_enviados?select=conta&tipo=eq.meta&referencia=eq.${referencia}`);
  const avisados = new Set(jaAvisados.map((a: { conta: string }) => a.conta));

  const relatorio: unknown[] = [];
  let mandados = 0;

  for (const linha of estados as Array<{ conta: string; dados: any }>) {
    const conta = linha.conta;
    const dados = linha.dados || {};
    const perfil = dados.perfil;
    const meta = perfil && dados.metas ? Number(dados.metas[perfil]) : NaN;

    /* Sem unidade ativa ou sem meta nao ha do que avisar. E a regra pode
       estar desligada por quem nao quer ser incomodado — isso se respeita. */
    if (!perfil || !isFinite(meta) || meta <= 0) continue;
    if (dados.regras && dados.regras.meta === false) continue;
    if (avisados.has(conta)) continue;

    const leituras = await consultar(
      `leituras?select=t,c&conta=eq.${conta}&t=gte.${inicioMes}&order=t.asc&limit=50000`);
    if (leituras.length < MINIMO_LEITURAS) continue;

    const horas = new Set(leituras.map((l: { t: string }) => new Date(l.t).getUTCHours()));
    if (horas.size < MINIMO_HORAS_DISTINTAS) continue;

    const somaKw = leituras.reduce((a: number, l: { c: number }) => a + Number(l.c), 0);
    const mediaKw = somaKw / leituras.length;
    const projecao = mediaKw * 24 * diasNoMes;

    if (projecao <= meta) continue;

    const perfis = await consultar(`perfis?select=nome,email&id=eq.${conta}&limit=1`);
    const pessoa = perfis[0];
    if (!pessoa || !pessoa.email) continue;

    const excedente = Math.round(projecao - meta);
    const caso = {
      conta, email: pessoa.email, nome: pessoa.nome,
      meta: Math.round(meta), projecao: Math.round(projecao), excedente,
      leituras: leituras.length, horasCobertas: horas.size
    };
    relatorio.push(caso);

    if (seco) continue;
    if (!RESEND) { console.warn('sem RESEND_API_KEY: nada foi enviado'); continue; }

    const primeiro = String(pessoa.nome || '').trim().split(/\s+/)[0] || 'Ola';
    const envio = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMETENTE,
        to: [pessoa.email],
        subject: `Sua meta de energia deve estourar em ${excedente} kWh`,
        text:
          `${primeiro},\n\n` +
          `No ritmo das ultimas leituras, o mes deve fechar em cerca de ` +
          `${Math.round(projecao)} kWh — sua meta e ${Math.round(meta)} kWh.\n\n` +
          `Esta e uma estimativa grosseira, feita a partir da media das leituras ` +
          `que ja subiram. O numero certo, com a curva do seu consumo e os seus ` +
          `creditos, esta no painel.\n\n` +
          `Abra o Solaris para ver o que subiu e o que da para fazer:\n` +
          `o assistente ja tem esses numeros na frente dele.\n\n` +
          `— Solaris\n\n` +
          `Voce recebeu isto porque a regra "avisar quando eu passar da meta" ` +
          `esta ligada em Alertas e metas. Da para desligar la, a qualquer hora.`
      })
    });

    if (!envio.ok) {
      console.error('resend falhou', envio.status, await envio.text().catch(() => ''));
      continue;
    }

    /* So marca depois de o e-mail sair. Marcar antes faria um erro de envio
       silenciar o aviso do mes inteiro. */
    await fetch(`${URL_SB}/rest/v1/avisos_enviados`, {
      method: 'POST',
      headers: { ...cab, Prefer: 'return=minimal' },
      body: JSON.stringify({ conta, tipo: 'meta', referencia })
    });
    mandados++;
  }

  return responder({
    referencia,
    contasOlhadas: estados.length,
    casos: relatorio.length,
    emailsEnviados: mandados,
    seco,
    detalhe: seco ? relatorio : undefined
  });
});
