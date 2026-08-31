/* supabase.js — o banco de verdade, quando ha internet

   Fala com um projeto Supabase (Postgres gerenciado) por HTTP puro. Expoe
   exatamente a mesma interface do local.js, e por isso o resto do sistema
   nao precisa saber qual dos dois esta respondendo.

   POR QUE SEM BIBLIOTECA. O Supabase tem um SDK oficial em npm. Nao usamos,
   e nao e teimosia: o projeto inteiro se sustenta em nao ter build, nao ter
   npm install e abrir com duplo clique. Puxar o SDK por CDN traria de volta
   a dependencia de rede so para desenhar a tela de login. O que precisamos
   do SDK sao duas APIs REST bem simples — GoTrue para conta e PostgREST para
   tabela — e elas cabem neste arquivo.

   O QUE MUDA quando o Supabase esta ligado:

     - a conta deixa de ser deste navegador e passa a ser sua. A mesma conta
       abre no celular e no computador, com os mesmos dados;
     - a senha e verificada no servidor, nao aqui. Isso e a unica forma de
       o login virar seguranca de verdade — enquanto rodava so no navegador,
       era separacao de dados, e a tela dizia isso;
     - o historico do medidor sai da maquina da pessoa e vira uma tabela.

   O QUE NAO MUDA: se as credenciais nao estiverem em config.js, ou se o
   servidor nao responder na abertura, o site cai para o local.js e continua
   funcionando. Nunca ha tela branca por causa do banco.

   SOBRE A CHAVE ANON. Ela vai no navegador de proposito e nao e segredo. O
   que protege os dados sao as regras de RLS do esquema.sql: cada linha das
   tabelas de usuario carrega o dono, e o Postgres so devolve as linhas de
   quem esta autenticado. Sem RLS, esta chave abriria o banco inteiro — por
   isso o esquema liga RLS em todas as tabelas antes de criar qualquer coisa.
*/
'use strict';

/* Toda chamada tem prazo. Sem isto, uma rede ruim deixa o app pendurado
   esperando para sempre, que e pior do que dizer "nao consegui". */
const SB_PRAZO = 12000;
const SB_CHAVE_SESSAO = 'solaris.sb.sessao.v1';

const SB = {
  url: '',
  chave: '',
  /* sessao do Supabase: access_token, refresh_token, expira_em, usuario */
  sessao: null
};

function sbUrl(caminho) {
  return SB.url.replace(/\/+$/, '') + caminho;
}

/* fetch com prazo, sempre devolvendo objeto — nunca lancando por rede */
async function sbFetch(caminho, opcoes) {
  const o = opcoes || {};
  const controle = typeof AbortController === 'function' ? new AbortController() : null;
  const prazo = setTimeout(() => { if (controle) controle.abort(); }, o.prazo || SB_PRAZO);

  const cab = Object.assign({
    'apikey': SB.chave,
    'Content-Type': 'application/json'
  }, o.headers || {});

  /* O token do usuario manda; sem ele, a chave anon responde como visitante
     anonimo e o RLS nao devolve linha nenhuma. */
  if (!cab['Authorization']) {
    const t = SB.sessao && SB.sessao.access_token;
    cab['Authorization'] = 'Bearer ' + (t || SB.chave);
  }

  try {
    const r = await fetch(sbUrl(caminho), {
      method: o.method || 'GET',
      headers: cab,
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: controle ? controle.signal : undefined
    });
    clearTimeout(prazo);

    const texto = await r.text();
    let corpo = null;
    if (texto) { try { corpo = JSON.parse(texto); } catch (e) { corpo = texto; } }

    if (!r.ok) {
      const msg = (corpo && (corpo.msg || corpo.message || corpo.error_description || corpo.error)) ||
        ('HTTP ' + r.status);
      return { ok: false, status: r.status, erro: String(msg), dados: corpo };
    }
    return { ok: true, status: r.status, dados: corpo, faixa: r.headers.get('content-range') };
  } catch (e) {
    clearTimeout(prazo);
    const abortou = e && (e.name === 'AbortError');
    return { ok: false, status: 0, rede: true, erro: abortou ? 'O servidor demorou demais para responder.' : 'Sem conexão com o servidor.' };
  }
}

/* ---------- sessao ---------- */
function sbGuardarSessao(s) {
  SB.sessao = s;
  try {
    if (s) localStorage.setItem(SB_CHAVE_SESSAO, JSON.stringify(s));
    else localStorage.removeItem(SB_CHAVE_SESSAO);
  } catch (e) { }
}
function sbLerSessaoGuardada() {
  try {
    const r = localStorage.getItem(SB_CHAVE_SESSAO);
    return r ? JSON.parse(r) : null;
  } catch (e) { return null; }
}
/* O Supabase devolve expires_in em segundos; guardamos o instante absoluto
   porque e o que da para comparar depois de a aba ficar horas fechada. */
function sbMontarSessao(d) {
  if (!d || !d.access_token) return null;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token || null,
    expira_em: Date.now() + ((d.expires_in || 3600) * 1000),
    usuario: d.user || null
  };
}
async function sbRenovar() {
  const s = SB.sessao;
  if (!s || !s.refresh_token) return false;
  const r = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SB.chave },
    body: { refresh_token: s.refresh_token }
  });
  if (!r.ok) { if (!r.rede) sbGuardarSessao(null); return false; }
  sbGuardarSessao(sbMontarSessao(r.dados));
  return !!SB.sessao;
}
/* Renova com folga de um minuto: token que vence no meio de uma gravacao
   perde a gravacao. */
async function sbGarantirToken() {
  const s = SB.sessao;
  if (!s) return false;
  if (Date.now() < s.expira_em - 60000) return true;
  return await sbRenovar();
}

/* ---------- PostgREST ----------
   Uma unica porta de entrada para tabela, para o tratamento de erro e de
   token nao ficar espalhado. */
async function sbTabela(tabela, opcoes) {
  const o = opcoes || {};
  await sbGarantirToken();
  const caminho = '/rest/v1/' + tabela + (o.query ? '?' + o.query : '');
  const cab = {};
  if (o.prefer) cab['Prefer'] = o.prefer;
  const r = await sbFetch(caminho, { method: o.method || 'GET', headers: cab, body: o.body });
  if (!r.ok) BancoSupabase.registrarFalha(r.erro);
  else BancoSupabase.registrarSucesso();
  return r;
}

/* ---------- a interface, identica a do local.js ---------- */
const BancoSupabase = {
  pronto: false,
  usandoIndexedDB: false,   /* nome mantido por compatibilidade: aqui sempre falso */
  online: true,
  motorNome: 'Supabase (Postgres)',
  ultimaFalha: null,
  falhasSeguidas: 0,

  registrarFalha(msg) {
    this.falhasSeguidas++;
    this.ultimaFalha = { msg: msg, em: Date.now() };
  },
  registrarSucesso() {
    this.falhasSeguidas = 0;
    this.ultimaFalha = null;
  },

  /* Abre a conexao e confere que o projeto responde. Devolver false aqui e o
     sinal para o banco.js cair para o local.js — e o site abrir do mesmo
     jeito, so que sem nuvem. */
  async iniciar() {
    SB.url = SOLARIS_CONFIG.supabase.url;
    SB.chave = SOLARIS_CONFIG.supabase.chaveAnon;
    SB.sessao = sbLerSessaoGuardada();

    /* Um toque leve so para saber se o projeto esta de pe. Prazo curto: se
       o Supabase nao respondeu em 6 segundos, nao vamos fazer a pessoa
       esperar mais para ver a tela de login. */
    const r = await sbFetch('/auth/v1/health', {
      headers: { 'Authorization': 'Bearer ' + SB.chave }, prazo: 6000
    });
    /* 404 tambem serve: significa que o host existe e respondeu. O que
       reprova e nao ter resposta nenhuma. */
    const vivo = r.ok || (r.status >= 200 && r.status < 500);
    if (!vivo) return false;

    if (SB.sessao) await sbGarantirToken();
    this.pronto = true;
    return true;
  },

  /* ---------- contas ----------
     Online nao existe "listar todas as contas": o cliente nao pode enumerar
     usuarios, e nem deveria. A tela de entrada trata a lista vazia. */
  async contas() { return []; },

  async conta(id) {
    const r = await sbTabela('perfis', { query: 'id=eq.' + encodeURIComponent(id) + '&select=*' });
    return (r.ok && Array.isArray(r.dados) && r.dados[0]) || undefined;
  },

  async salvarConta(c) {
    return await sbTabela('perfis', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { id: c.id, nome: c.nome, email: c.email }
    });
  },

  /* Apagar a propria conta de verdade (a linha em auth.users) exige chave de
     servico, que nao pode viver no navegador. O que da para fazer daqui e
     apagar tudo que e dado da pessoa; a funcao apagar-conta cuida do resto
     quando publicada. */
  async apagarConta(id) {
    await sbTabela('perfis', { query: 'id=eq.' + encodeURIComponent(id), method: 'DELETE' });
    return true;
  },

  /* ---------- estado ---------- */
  async estado(conta) {
    const r = await sbTabela('estado', {
      query: 'conta=eq.' + encodeURIComponent(conta) + '&select=dados'
    });
    if (!r.ok || !Array.isArray(r.dados) || !r.dados[0]) return null;
    return r.dados[0].dados || null;
  },

  async salvarEstado(conta, dados) {
    return await sbTabela('estado', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { conta: conta, dados: dados, em: new Date().toISOString() }
    });
  },

  async apagarEstado(conta) {
    return await sbTabela('estado', {
      query: 'conta=eq.' + encodeURIComponent(conta), method: 'DELETE'
    });
  },

  /* ---------- leituras do medidor ---------- */
  async registrarLeitura(conta, cons, ger) {
    return await sbTabela('leituras', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        conta: conta, t: new Date().toISOString(),
        c: Math.round(cons * 1000) / 1000,
        g: Math.round(ger * 1000) / 1000
      }
    });
  },

  /* Devolve no mesmo formato do local.js: t em milissegundos, c e g em kW.
     Quem le o grafico nao deve precisar saber que aqui a coluna e timestamp. */
  async leituras(conta, desdeMs, limite) {
    const inicio = new Date(desdeMs || (Date.now() - 2 * 3600000)).toISOString();
    const q = 'conta=eq.' + encodeURIComponent(conta) +
      '&t=gte.' + encodeURIComponent(inicio) +
      '&select=id,t,c,g&order=t.asc' +
      (limite ? '&limit=' + limite : '&limit=5000');
    const r = await sbTabela('leituras', { query: q });
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return r.dados.map(l => ({
      id: l.id, conta: conta, t: Date.parse(l.t),
      c: Number(l.c), g: Number(l.g)
    }));
  },

  /* O PostgREST devolve a contagem no cabecalho Content-Range ("0-0/1440"),
     nao no corpo. Pedimos uma linha so e lemos o total dali — trazer as
     14 mil linhas de volta so para contar seria absurdo. */
  async contarLeituras() {
    const r = await sbTabela('leituras', {
      query: 'select=id&limit=1', prefer: 'count=exact'
    });
    if (!r.ok || !r.faixa) return 0;
    const total = String(r.faixa).split('/')[1];
    return total && total !== '*' ? Number(total) : 0;
  },

  /* No Postgres a poda e trabalho do banco, nao do navegador: existe uma
     rotina no esquema.sql para isso. Deixar cada aba tentando apagar linha
     velha seria N clientes brigando pela mesma tabela. */
  async podarLeituras() { return 0; },

  async limparLeituras(conta) {
    const r = await sbTabela('leituras', {
      query: 'conta=eq.' + encodeURIComponent(conta), method: 'DELETE'
    });
    return r.ok ? 1 : 0;
  },

  /* Online, "apagar tudo" e apagar tudo DA PESSOA. Nao existe botao no
     navegador que limpe o banco dos outros — e isso e uma melhora, nao uma
     limitacao: no IndexedDB o botao apagava a conta de todo mundo que tinha
     usado aquele computador. */
  async apagarTudo() {
    const antes = await this.estatisticas();
    const conta = SB.sessao && SB.sessao.usuario ? SB.sessao.usuario.id : null;
    if (conta) {
      await this.limparLeituras(conta);
      await this.apagarEstado(conta);
      await sbTabela('perfil_conversa', { query: 'conta=eq.' + conta, method: 'DELETE' });
      await sbTabela('conversas', { query: 'conta=eq.' + conta, method: 'DELETE' });
    }
    try {
      const soltas = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('solaris.') === 0) soltas.push(k);
      }
      soltas.forEach(k => localStorage.removeItem(k));
    } catch (e) { }
    return antes;
  },

  async migrarDoLocalStorage() { return; },

  async estatisticas() {
    const leituras = await this.contarLeituras();
    return {
      motor: this.motorNome,
      contas: 1, leituras: leituras, bytes: null,
      janelaDias: 90, intervaloSeg: 60,
      online: true,
      falha: this.ultimaFalha ? this.ultimaFalha.msg : null
    };
  },

  /* ---------- conta e sessao (o que o login.js usa) ---------- */

  async authCriar(nome, email, senha) {
    const r = await sbFetch('/auth/v1/signup', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SB.chave },
      body: { email: email, password: senha, data: { nome: nome } }
    });
    if (!r.ok) throw new Error(sbMensagem(r.erro));

    /* Se o projeto estiver com confirmacao por e-mail ligada, o cadastro nao
       devolve sessao — e a pessoa precisa clicar no link antes de entrar. */
    const s = sbMontarSessao(r.dados);
    if (!s) {
      const e = new Error('Conta criada. Confirme o e-mail que enviamos e depois entre.');
      e.confirmacaoPendente = true;
      throw e;
    }
    sbGuardarSessao(s);
    const u = s.usuario || {};
    await this.salvarConta({ id: u.id, nome: nome, email: email });
    return { id: u.id, nome: nome, email: email };
  },

  async authEntrar(email, senha) {
    const r = await sbFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SB.chave },
      body: { email: email, password: senha }
    });
    if (!r.ok) throw new Error(sbMensagem(r.erro));
    const s = sbMontarSessao(r.dados);
    if (!s) throw new Error('E-mail ou senha não conferem.');
    sbGuardarSessao(s);
    const u = s.usuario || {};
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      nome: meta.nome || (u.email || '').split('@')[0],
      email: u.email
    };
  },

  async authSair() {
    if (SB.sessao) {
      await sbFetch('/auth/v1/logout', { method: 'POST' });
    }
    sbGuardarSessao(null);
  },

  /* Sessao valida guardada, ja renovada se precisava. */
  async authSessao() {
    if (!SB.sessao) return null;
    const vale = await sbGarantirToken();
    if (!vale) return null;
    const u = SB.sessao.usuario || {};
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      nome: meta.nome || (u.email || '').split('@')[0],
      email: u.email
    };
  },

  /* Manda o e-mail de troca de senha. Nao dizemos se o e-mail existe: a
     resposta e sempre a mesma, aqui e na tela. */
  async authRecuperarSenha(email) {
    await sbFetch('/auth/v1/recover', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SB.chave },
      body: { email: email }
    });
    return true;
  },

  async authTrocarSenha(senhaNova) {
    const r = await sbFetch('/auth/v1/user', { method: 'PUT', body: { password: senhaNova } });
    if (!r.ok) throw new Error(sbMensagem(r.erro));
    return true;
  },

  /* ---------- o que o assistente precisa ---------- */

  async perfilConversa(conta) {
    const r = await sbTabela('perfil_conversa', {
      query: 'conta=eq.' + encodeURIComponent(conta) + '&select=respostas'
    });
    if (!r.ok || !Array.isArray(r.dados) || !r.dados[0]) return null;
    return r.dados[0].respostas || null;
  },

  async salvarPerfilConversa(conta, respostas) {
    return await sbTabela('perfil_conversa', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { conta: conta, respostas: respostas, em: new Date().toISOString() }
    });
  },

  async historicoConversa(conta, limite) {
    const r = await sbTabela('conversas', {
      query: 'conta=eq.' + encodeURIComponent(conta) +
        '&select=papel,texto,em&order=em.desc&limit=' + (limite || 30)
    });
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return r.dados.slice().reverse();
  },

  async salvarMensagem(conta, papel, texto) {
    return await sbTabela('conversas', {
      method: 'POST', prefer: 'return=minimal',
      body: { conta: conta, papel: papel, texto: texto, em: new Date().toISOString() }
    });
  },

  async limparConversa(conta) {
    return await sbTabela('conversas', {
      query: 'conta=eq.' + encodeURIComponent(conta), method: 'DELETE'
    });
  },

  /* Chamada da Edge Function que fala com o Gemini. O token do usuario vai
     junto: e assim que a funcao sabe de quem e o perfil que ela vai carregar,
     e e por isso que ninguem consegue perguntar em nome de outra pessoa. */
  async chamarAgente(corpo) {
    await sbGarantirToken();
    const nome = (SOLARIS_CONFIG.agente && SOLARIS_CONFIG.agente.funcao) || 'agente';
    return await sbFetch('/functions/v1/' + nome, {
      method: 'POST', body: corpo, prazo: 45000
    });
  }
};

/* O GoTrue responde em ingles. Traduzimos os casos que a pessoa realmente
   encontra, e deixamos o resto passar como veio — mensagem errada em
   portugues e pior que mensagem certa em ingles. */
function sbMensagem(erro) {
  const e = String(erro || '');
  if (/invalid login credentials/i.test(e)) return 'E-mail ou senha não conferem.';
  if (/user already registered|already been registered/i.test(e)) return 'Já existe uma conta com esse e-mail.';
  if (/password should be at least/i.test(e)) return 'A senha precisa de pelo menos 6 caracteres.';
  if (/unable to validate email|invalid format/i.test(e)) return 'Esse e-mail não parece válido.';
  if (/email not confirmed/i.test(e)) return 'Confirme o e-mail que enviamos antes de entrar.';
  if (/rate limit|too many requests/i.test(e)) return 'Muitas tentativas seguidas. Espere um minuto.';
  if (/sem conexão|demorou demais/i.test(e)) return e;
  return e || 'Não deu para continuar.';
}
