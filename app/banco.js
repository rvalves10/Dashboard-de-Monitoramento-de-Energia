/* ============================================================
   SOLARIS — banco de dados

   IndexedDB: o banco que já vem no navegador. Transacional, indexado,
   assíncrono e sem limite prático de tamanho — diferente do localStorage,
   que é um mapa de texto com uns 5 MB no total.

   Três tabelas:
     contas    quem pode entrar (id = e-mail)
     estado    o app de cada conta (unidades, aparelhos, metas, tarifa)
     leituras  o histórico do medidor, uma linha por minuto

   A tabela de leituras é a razão de existir um banco aqui. Guardar o
   medidor minuto a minuto dá 1.440 linhas por dia; em uma semana são
   dez mil. Isso não cabe em localStorage, e é exatamente o tipo de dado
   que um sistema de monitoramento precisa acumular.

   Se o IndexedDB não estiver disponível (navegador antigo, modo privado
   em alguns casos), tudo cai de volta para localStorage sozinho. O app
   nunca deixa de abrir por causa do banco.
   ============================================================ */
'use strict';

const BD_NOME = 'solaris';
const BD_VERSAO = 1;
const DIAS_HISTORICO = 7;      /* leituras mais velhas que isso são podadas */
const INTERVALO_LEITURA = 60;  /* segundos entre gravações */

let _bd = null;
let _bdFalhou = false;

function temIndexedDB() {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null; } catch (e) { return false; }
}

function abrirBanco() {
  if (_bd) return Promise.resolve(_bd);
  if (_bdFalhou || !temIndexedDB()) return Promise.resolve(null);

  return new Promise(resolve => {
    let pedido;
    try { pedido = indexedDB.open(BD_NOME, BD_VERSAO); }
    catch (e) { _bdFalhou = true; return resolve(null); }

    /* se o navegador travar a abertura (modo privado do Firefox, por
       exemplo), não deixamos o app pendurado esperando */
    const desistir = setTimeout(() => { _bdFalhou = true; resolve(null); }, 3000);

    pedido.onupgradeneeded = ev => {
      const bd = ev.target.result;
      if (!bd.objectStoreNames.contains('contas')) {
        bd.createObjectStore('contas', { keyPath: 'id' });
      }
      if (!bd.objectStoreNames.contains('estado')) {
        bd.createObjectStore('estado', { keyPath: 'conta' });
      }
      if (!bd.objectStoreNames.contains('leituras')) {
        const s = bd.createObjectStore('leituras', { keyPath: 'id', autoIncrement: true });
        s.createIndex('porConta', ['conta', 't']);
        s.createIndex('porTempo', 't');
      }
    };
    pedido.onsuccess = () => { clearTimeout(desistir); _bd = pedido.result; resolve(_bd); };
    pedido.onerror = () => { clearTimeout(desistir); _bdFalhou = true; resolve(null); };
    pedido.onblocked = () => { clearTimeout(desistir); _bdFalhou = true; resolve(null); };
  });
}

/* envelopa uma transação numa promise, sempre resolvendo:
   uma falha de banco nunca deve derrubar a tela */
function transacao(tabela, modo, fn) {
  return abrirBanco().then(bd => {
    if (!bd) return null;
    return new Promise(resolve => {
      let resultado = null;
      let t;
      try { t = bd.transaction(tabela, modo); }
      catch (e) { return resolve(null); }
      t.oncomplete = () => resolve(resultado);
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
      try {
        const pedido = fn(t.objectStore(tabela));
        if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };
      } catch (e) { resolve(null); }
    });
  });
}

const bdLer = (tabela, chave) => transacao(tabela, 'readonly', s => s.get(chave));
const bdTodos = tabela => transacao(tabela, 'readonly', s => s.getAll());
const bdGravar = (tabela, valor) => transacao(tabela, 'readwrite', s => s.put(valor));
const bdApagar = (tabela, chave) => transacao(tabela, 'readwrite', s => s.delete(chave));
const bdContar = tabela => transacao(tabela, 'readonly', s => s.count());

/* ---------- reserva em localStorage ----------
   Mesma interface, para o app não precisar saber qual dos dois está
   respondendo. Só entra em ação se o IndexedDB não abrir. */
const PREFIXO_RESERVA = 'solaris.bd.';
function reservaLer(tabela, chave) {
  try { const r = localStorage.getItem(PREFIXO_RESERVA + tabela + '.' + chave); return r ? JSON.parse(r) : undefined; }
  catch (e) { return undefined; }
}
function reservaGravar(tabela, chave, valor) {
  try { localStorage.setItem(PREFIXO_RESERVA + tabela + '.' + chave, JSON.stringify(valor)); } catch (e) { }
}
function reservaApagar(tabela, chave) {
  try { localStorage.removeItem(PREFIXO_RESERVA + tabela + '.' + chave); } catch (e) { }
}
function reservaTodos(tabela) {
  const fora = [], p = PREFIXO_RESERVA + tabela + '.';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(p) === 0) fora.push(JSON.parse(localStorage.getItem(k)));
    }
  } catch (e) { }
  return fora;
}

/* ---------- API que o resto do app usa ---------- */

const Banco = {
  pronto: false,
  usandoIndexedDB: false,

  async iniciar() {
    const bd = await abrirBanco();
    this.usandoIndexedDB = !!bd;
    this.pronto = true;
    await this.migrarDoLocalStorage();
    await this.podarLeituras();
    return this.usandoIndexedDB;
  },

  /* contas */
  async contas() {
    if (!this.usandoIndexedDB) return reservaTodos('contas');
    return (await bdTodos('contas')) || [];
  },
  async conta(id) {
    if (!this.usandoIndexedDB) return reservaLer('contas', id);
    return await bdLer('contas', id);
  },
  async salvarConta(c) {
    if (!this.usandoIndexedDB) return reservaGravar('contas', c.id, c);
    return await bdGravar('contas', c);
  },
  async apagarConta(id) {
    if (!this.usandoIndexedDB) return reservaApagar('contas', id);
    return await bdApagar('contas', id);
  },

  /* estado do app, um por conta */
  async estado(conta) {
    const r = this.usandoIndexedDB ? await bdLer('estado', conta) : reservaLer('estado', conta);
    return r ? r.dados : null;
  },
  async salvarEstado(conta, dados) {
    const reg = { conta: conta, dados: dados, em: Date.now() };
    if (!this.usandoIndexedDB) return reservaGravar('estado', conta, reg);
    return await bdGravar('estado', reg);
  },
  async apagarEstado(conta) {
    if (!this.usandoIndexedDB) return reservaApagar('estado', conta);
    return await bdApagar('estado', conta);
  },

  /* leituras do medidor — só no IndexedDB, é o que justifica o banco */
  async registrarLeitura(conta, cons, ger) {
    if (!this.usandoIndexedDB) return null;
    return await transacao('leituras', 'readwrite', s => s.add({
      conta: conta, t: Date.now(),
      c: Math.round(cons * 1000) / 1000,
      g: Math.round(ger * 1000) / 1000
    }));
  },

  /* últimas leituras de uma conta, da mais antiga para a mais nova */
  async leituras(conta, desdeMs, limite) {
    if (!this.usandoIndexedDB) return [];
    const bd = await abrirBanco();
    if (!bd) return [];
    const inicio = desdeMs || (Date.now() - 2 * 3600000);
    return new Promise(resolve => {
      const fora = [];
      let t;
      try { t = bd.transaction('leituras', 'readonly'); } catch (e) { return resolve([]); }
      const faixa = IDBKeyRange.bound([conta, inicio], [conta, Date.now() + 1]);
      const cur = t.objectStore('leituras').index('porConta').openCursor(faixa);
      cur.onsuccess = ev => {
        const c = ev.target.result;
        if (!c || (limite && fora.length >= limite)) return resolve(fora);
        fora.push(c.value);
        c.continue();
      };
      cur.onerror = () => resolve(fora);
      t.onerror = () => resolve(fora);
    });
  },

  async contarLeituras() {
    if (!this.usandoIndexedDB) return 0;
    return (await bdContar('leituras')) || 0;
  },

  /* poda o que passou da janela de histórico */
  async podarLeituras() {
    if (!this.usandoIndexedDB) return 0;
    const bd = await abrirBanco();
    if (!bd) return 0;
    const corte = Date.now() - DIAS_HISTORICO * 86400000;
    return new Promise(resolve => {
      let n = 0, t;
      try { t = bd.transaction('leituras', 'readwrite'); } catch (e) { return resolve(0); }
      const cur = t.objectStore('leituras').index('porTempo').openCursor(IDBKeyRange.upperBound(corte));
      cur.onsuccess = ev => {
        const c = ev.target.result;
        if (!c) return;
        c.delete(); n++; c.continue();
      };
      t.oncomplete = () => resolve(n);
      t.onerror = () => resolve(n);
    });
  },

  async limparLeituras(conta) {
    if (!this.usandoIndexedDB) return 0;
    const linhas = await this.leituras(conta, 0);
    for (const l of linhas) await bdApagar('leituras', l.id);
    return linhas.length;
  },

  /* ---------- migração ----------
     Traz o que estava em localStorage e marca para não repetir. */
  async migrarDoLocalStorage() {
    let marca;
    try { marca = localStorage.getItem('solaris.migrado.v1'); } catch (e) { return; }
    if (marca) return;

    try {
      /* contas */
      const raw = localStorage.getItem('solaris.contas.v1');
      if (raw) {
        const todas = JSON.parse(raw);
        for (const id of Object.keys(todas)) await this.salvarConta(todas[id]);
      }
      /* estados: solaris.v2, solaris.v2.<conta> */
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf('solaris.v2') !== 0) continue;
        const conta = k === 'solaris.v2' ? 'visitante' : k.slice('solaris.v2.'.length);
        const dados = JSON.parse(localStorage.getItem(k));
        const jaTem = await this.estado(conta);
        if (!jaTem) await this.salvarEstado(conta, dados);
      }
      localStorage.setItem('solaris.migrado.v1', String(Date.now()));
    } catch (e) { /* migração é conveniência, não pode quebrar a abertura */ }
  },

  /* números para mostrar em Configurações */
  async estatisticas() {
    const nContas = (await this.contas()).length;
    const nLeituras = await this.contarLeituras();
    let bytes = null;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        bytes = e.usage || null;
      }
    } catch (e) { }
    return {
      motor: this.usandoIndexedDB ? 'IndexedDB' : 'localStorage (reserva)',
      contas: nContas, leituras: nLeituras, bytes: bytes,
      janelaDias: DIAS_HISTORICO, intervaloSeg: INTERVALO_LEITURA
    };
  }
};
