/* banco.js — quem atende, e por que

   Este arquivo nao guarda nada. Ele escolhe.

   O Solaris tem dois bancos com a mesma interface:

     supabase.js   Postgres na nuvem. A conta e da pessoa, nao do navegador,
                   e os dados abrem em qualquer aparelho.
     local.js      IndexedDB dentro do navegador. Nao precisa de rede nem de
                   cadastro em lugar nenhum.

   Na abertura, `iniciar()` decide qual dos dois vai responder ao resto da
   sessao inteira, e o resto do sistema nunca mais pergunta. Chamar
   `Banco.salvarEstado(...)` funciona igual nos dois casos.

   A REGRA DA ESCOLHA, em ordem:

     1. config.js tem url e chave anon preenchidas?  Se nao, e local.
     2. O projeto Supabase respondeu em 6 segundos?  Se nao, e local.
     3. Deu tudo certo: e Supabase.

   Por que cair para o local em vez de mostrar erro: o Solaris e apresentado
   numa banca, testado em campo por gente que abre o arquivo por WhatsApp, e
   usado em lugar com internet ruim. Um site de monitoramento que nao abre
   porque o servidor esta fora nao monitora nada. A tela diz em qual dos dois
   esta rodando — em Configuracoes -> Banco de dados — para ninguem confundir
   dado que subiu com dado que ficou na maquina.

   O QUE ACONTECE SE A REDE CAIR NO MEIO. A escolha ja foi feita e nao muda
   no meio do caminho: trocar de banco com a sessao aberta separaria os dados
   em dois lugares, e a pessoa veria metade do historico. As gravacoes passam
   a falhar, o contador de falhas sobe e a tela avisa. Quando a rede volta,
   volta sozinho.
*/
'use strict';

const Banco = {
  /* qual implementacao esta atendendo */
  impl: null,
  motor: 'nenhum',        /* 'supabase' | 'indexeddb' | 'localStorage' */
  online: false,
  pronto: false,
  /* Mantido com este nome porque meio sistema pergunta por ele. Significa
     "da para gravar o historico minuto a minuto" — que e verdade no
     IndexedDB e no Supabase, e falso so na reserva de localStorage. */
  usandoIndexedDB: false,
  /* Por que caiu para o banco local, quando caiu. A tela mostra isto. */
  motivoLocal: null,

  async iniciar() {
    if (supabaseConfigurado()) {
      let subiu = false;
      try { subiu = await BancoSupabase.iniciar(); }
      catch (e) { subiu = false; }

      if (subiu) {
        this.impl = BancoSupabase;
        this.motor = 'supabase';
        this.online = true;
        this.usandoIndexedDB = true;   /* ha historico, so que numa tabela */
        this.pronto = true;
        return true;
      }
      this.motivoLocal = 'O Supabase está configurado, mas não respondeu. ' +
        'O Solaris abriu com o banco deste navegador para você não ficar parado.';
    } else {
      this.motivoLocal = 'Sem credenciais do Supabase em banco-de-dados/config.js. ' +
        'O Solaris está gravando neste navegador.';
    }

    this.impl = BancoLocal;
    this.motor = 'local';
    this.online = false;
    const comIndexedDB = await BancoLocal.iniciar();
    this.usandoIndexedDB = !!comIndexedDB;
    this.motor = comIndexedDB ? 'indexeddb' : 'localStorage';
    this.pronto = true;
    return false;
  },

  /* ---------- repasse ----------
     Uma linha por metodo, de proposito: assim da para ler a interface
     inteira do banco de uma vez, e um metodo novo em uma das
     implementacoes so existe de verdade depois de aparecer aqui. */

  contas() { return this.impl.contas(); },
  conta(id) { return this.impl.conta(id); },
  salvarConta(c) { return this.impl.salvarConta(c); },
  apagarConta(id) { return this.impl.apagarConta(id); },

  estado(conta) { return this.impl.estado(conta); },
  salvarEstado(conta, dados) { return this.impl.salvarEstado(conta, dados); },
  apagarEstado(conta) { return this.impl.apagarEstado(conta); },

  registrarLeitura(conta, cons, ger) { return this.impl.registrarLeitura(conta, cons, ger); },
  leituras(conta, desde, limite) { return this.impl.leituras(conta, desde, limite); },
  contarLeituras() { return this.impl.contarLeituras(); },
  podarLeituras() { return this.impl.podarLeituras(); },
  limparLeituras(conta) { return this.impl.limparLeituras(conta); },

  apagarTudo() { return this.impl.apagarTudo(); },
  migrarDoLocalStorage() { return this.impl.migrarDoLocalStorage(); },

  async estatisticas() {
    const e = await this.impl.estatisticas();
    e.online = this.online;
    if (!this.online && this.motivoLocal) e.motivo = this.motivoLocal;
    return e;
  },

  /* ---------- so existe online ----------
     Perfil da conversa e historico do assistente moram no Postgres porque a
     Edge Function precisa ler o perfil para montar o prompt. Offline, quem
     guarda isso e o proprio estado da conta (S.perfilCliente), e estas
     funcoes devolvem vazio sem quebrar. */

  perfilConversa(conta) {
    return this.online ? this.impl.perfilConversa(conta) : Promise.resolve(null);
  },
  salvarPerfilConversa(conta, r) {
    return this.online ? this.impl.salvarPerfilConversa(conta, r) : Promise.resolve(null);
  },
  historicoConversa(conta, limite) {
    return this.online ? this.impl.historicoConversa(conta, limite) : Promise.resolve([]);
  },
  salvarMensagem(conta, papel, texto) {
    return this.online ? this.impl.salvarMensagem(conta, papel, texto) : Promise.resolve(null);
  },
  limparConversa(conta) {
    return this.online ? this.impl.limparConversa(conta) : Promise.resolve(null);
  },
  chamarAgente(corpo) {
    return this.online
      ? this.impl.chamarAgente(corpo)
      : Promise.resolve({ ok: false, erro: 'O assistente precisa do Supabase configurado.' });
  }
};
