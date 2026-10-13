/* login.js — contas e sessao

   Este arquivo confere senha, cria conta e guarda a sessao. A TELA de
   entrada nao mora mais aqui: esta em frontend/js/entrada.js, porque o
   backend nao monta HTML.

   O LOGIN E OBRIGATORIO. Nao ha mais "entrar sem criar conta": quem abre o
   link cai na tela de entrada e so passa dali com uma conta. Antes existia um
   modo visitante que ia direto ao painel com dados de demonstracao dentro.

   Por que mudou. O visitante resolvia um problema de teste de campo (ninguem
   travar no cadastro) e criava tres outros: os dados da pessoa ficavam
   presos num balde anonimo que qualquer um do mesmo navegador abria; o
   assistente de IA nao tinha de quem ser assistente, porque nao havia
   perfil; e a primeira coisa que a pessoa via era a casa de outra gente. Com
   conta, o Solaris sabe com quem esta falando desde o primeiro segundo — que
   e a condicao para tudo o que veio depois.

   Quem so quer passear pelo sistema continua podendo: cria a conta e liga as
   unidades de exemplo em Configuracoes, com um clique.

   ---------------------------------------------------------------------
   ONDE A SENHA E CONFERIDA — sao dois mundos, e a tela diz em qual voce esta

   COM SUPABASE CONFIGURADO (o normal): a conta e verificada no servidor. A
   senha nunca chega perto deste arquivo, o token tem prazo de validade e a
   mesma conta abre em qualquer aparelho. E autenticacao de verdade.

   SEM SUPABASE (site aberto do disco, sem credenciais): tudo continua
   acontecendo no navegador, como antes. E honesto dizer o que isso e:

     NAO E seguranca contra quem tem acesso ao computador. Sem servidor, quem
     abrir o DevTools le o banco. Nao existe segredo do lado do cliente.

     E DE VERDADE:
       - a senha nunca e gravada, nem em texto nem de forma reversivel;
       - guardamos uma derivacao dela com salt aleatorio e 150 mil iteracoes
         (PBKDF2 pelo WebCrypto, ou SHA-256 encadeado onde nao houver);
       - comparacao em tempo constante, para nao vazar pelo tempo de resposta;
       - a mesma mensagem de erro para senha errada e e-mail inexistente,
         para nao revelar quais contas existem;
       - cada conta tem seu proprio balde de dados no banco.

   As duas coisas estao escritas na propria tela de entrada, de proposito
   (cartaoSeguranca, em frontend/js/entrada.js).
*/
'use strict';

const CHAVE_CONTAS = 'solaris.contas.v1';
const CHAVE_SESSAO = 'solaris.sessao.v1';
const ITERACOES = 150000;
const DIAS_SESSAO = 30;

/* ---------- utilidades de bytes ---------- */
function bytesParaHex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
function saltAleatorio() {
  const a = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
  return bytesParaHex(a);
}

/* ---------- SHA-256 em JS puro ----------
   Existe porque crypto.subtle só funciona em contexto seguro, e o app
   precisa abrir de file:// em qualquer máquina. Quando o WebCrypto está
   disponível usamos ele (mais rápido e mais correto); senão, este.        */
function sha256(msg) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bytes = [];
  for (let i = 0; i < msg.length; i++) {
    let c = msg.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) bytes.push(192 | c >> 6, 128 | c & 63);
    else bytes.push(224 | c >> 12, 128 | (c >> 6) & 63, 128 | c & 63);
  }
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((i < 4 ? Math.floor(bits / Math.pow(2, i * 8)) : 0) & 0xff);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for (let bloco = 0; bloco < bytes.length; bloco += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[bloco + i * 4] << 24) | (bytes[bloco + i * 4 + 1] << 16) |
        (bytes[bloco + i * 4 + 2] << 8) | bytes[bloco + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [H[0] + a | 0, H[1] + b | 0, H[2] + c | 0, H[3] + d | 0,
    H[4] + e | 0, H[5] + f | 0, H[6] + g | 0, H[7] + h | 0];
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ---------- derivação da chave ---------- */
const TEM_WEBCRYPTO = typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder === 'function';

async function derivarWebCrypto(senha, salt) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERACOES, hash: 'SHA-256' }, base, 256);
  return bytesParaHex(bits);
}
/* fallback: SHA-256 encadeado. Menos robusto que PBKDF2-HMAC, mas ainda
   é uma função lenta com salt — não é a senha guardada em texto. */
function derivarJS(senha, salt) {
  let h = sha256(salt + '|' + senha);
  const voltas = Math.round(ITERACOES / 60);
  for (let i = 0; i < voltas; i++) h = sha256(h + salt);
  return h;
}
async function derivar(senha, salt, metodo) {
  const m = metodo || (TEM_WEBCRYPTO ? 'pbkdf2' : 'sha256x');
  const valor = m === 'pbkdf2' ? await derivarWebCrypto(senha, salt) : derivarJS(senha, salt);
  return { metodo: m, valor: valor };
}
/* comparação em tempo constante, para não vazar por quanto tempo demora */
function iguaisSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------- armazenamento ---------- */
function lerJSON(chave, padrao) {
  try { const r = localStorage.getItem(chave); return r ? JSON.parse(r) : padrao; }
  catch (e) { return padrao; }
}
function gravarJSON(chave, v) {
  try { localStorage.setItem(chave, JSON.stringify(v)); return true; } catch (e) { return false; }
}
/* Espelho em memória das contas. O banco é assíncrono, mas a tela precisa
   saber sincronamente se existe conta — então carregamos uma vez na
   abertura e mantemos o espelho junto com o banco. */
let _contas = {};
function contas() { return _contas; }
async function carregarContas() {
  const lista = await Banco.contas();
  _contas = {};
  lista.forEach(c => { _contas[c.id] = c; });
  return _contas;
}
function normalizarEmail(e) { return String(e || '').trim().toLowerCase(); }

/* Quem confere a senha: o servidor ou este arquivo. Decidido uma vez, na
   abertura, pelo banco.js — nao muda no meio da sessao. */
function autenticacaoNoServidor() {
  return !!(typeof Banco !== 'undefined' && Banco.online);
}

let SESSAO = null;
function carregarSessao() {
  const s = lerJSON(CHAVE_SESSAO, null);
  if (!s || !s.id) return null;
  if (s.ate && Date.now() > s.ate) { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { } return null; }
  /* No modo local a sessao so vale se a conta existir neste navegador. No
     modo servidor quem manda e o token do Supabase, conferido em
     restaurarSessao() — aqui a lista local esta vazia de proposito. */
  if (!autenticacaoNoServidor() && !contas()[s.id]) return null;
  SESSAO = s;
  return s;
}
function sessao() { return SESSAO; }

/* A sessao de verdade na abertura do site. E assincrona porque, com Supabase,
   pode ser preciso renovar o token antes de saber se ainda vale. */
async function restaurarSessao() {
  if (!autenticacaoNoServidor()) return carregarSessao();

  const u = await Banco.impl.authSessao();
  if (!u) { SESSAO = null; try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { } return null; }
  SESSAO = { id: u.id, nome: u.nome, email: u.email, ate: null };
  gravarJSON(CHAVE_SESSAO, SESSAO);
  return SESSAO;
}

/* ---------- operações de conta ---------- */
/* As tres validacoes valem nos dois modos. O Supabase tambem valida, mas a
   mensagem dele vem em ingles e generica — conferir aqui antes e o que faz a
   tela dizer "escreva seu nome" em vez de "invalid request". */
function conferirCadastro(nome, e, senha) {
  if (String(nome).trim().length < 2) throw new Error('Escreva seu nome com pelo menos 2 letras.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Esse e-mail não parece válido.');
  if (String(senha).length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
}

/* Cria a conta E DEIXA A PESSOA DENTRO, nos dois modos.

   Isto e uma unica operacao do ponto de vista de quem usa: o botao diz
   "criar conta e continuar", e ninguem espera digitar a senha de novo logo
   depois de escolher a senha. Os dois caminhos precisam terminar com sessao
   aberta, senao a tela seguinte nao sabe quem entrou. */
async function criarConta(nome, email, senha) {
  const e = normalizarEmail(email);
  conferirCadastro(nome, e, senha);

  if (autenticacaoNoServidor()) {
    const u = await Banco.impl.authCriar(String(nome).trim(), e, senha);
    SESSAO = { id: u.id, nome: u.nome, email: u.email, ate: null };
    gravarJSON(CHAVE_SESSAO, SESSAO);
    return u;
  }

  const todas = contas();
  if (todas[e]) throw new Error('Já existe uma conta com esse e-mail neste navegador.');

  const salt = saltAleatorio();
  const d = await derivar(senha, salt);
  todas[e] = {
    id: e, nome: String(nome).trim(), email: e,
    salt: salt, hash: d.valor, metodo: d.metodo, criadoEm: Date.now()
  };
  _contas = todas;
  await Banco.salvarConta(todas[e]);

  const c = todas[e];
  SESSAO = { id: c.id, nome: c.nome, email: c.email, ate: Date.now() + DIAS_SESSAO * 86400000 };
  gravarJSON(CHAVE_SESSAO, SESSAO);
  return c;
}

async function entrar(email, senha, manter) {
  const e = normalizarEmail(email);

  if (autenticacaoNoServidor()) {
    const u = await Banco.impl.authEntrar(e, senha);
    SESSAO = { id: u.id, nome: u.nome, email: u.email, ate: null };
    gravarJSON(CHAVE_SESSAO, SESSAO);
    return SESSAO;
  }

  const c = contas()[e];
  /* mesmo sem conta, derivamos uma vez: assim o tempo de resposta não
     revela se o e-mail existe */
  const alvo = c || { salt: 'inexistente', hash: '', metodo: TEM_WEBCRYPTO ? 'pbkdf2' : 'sha256x' };
  const d = await derivar(senha, alvo.salt, alvo.metodo);
  if (!c || !iguaisSeguro(d.valor, c.hash)) throw new Error('E-mail ou senha não conferem.');

  SESSAO = {
    id: c.id, nome: c.nome, email: c.email,
    ate: manter ? Date.now() + DIAS_SESSAO * 86400000 : null
  };
  gravarJSON(CHAVE_SESSAO, SESSAO);
  return SESSAO;
}

/* Sair de verdade: no modo servidor tambem invalida o token la, senao a
   sessao continuaria valendo em outra aba ate vencer sozinha. */
function sair() {
  const eraServidor = autenticacaoNoServidor();
  SESSAO = null;
  try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { }
  if (eraServidor) Banco.impl.authSair();
}

async function trocarSenha(senhaAtual, senhaNova) {
  if (!SESSAO) throw new Error('Entre com uma conta para trocar a senha.');
  if (String(senhaNova).length < 6) throw new Error('A nova senha precisa de pelo menos 6 caracteres.');

  if (autenticacaoNoServidor()) {
    /* Confere a atual entrando de novo: o Supabase deixa trocar a senha so
       com o token, e isso permitiria trocar a senha de uma sessao esquecida
       aberta. Pedir a senha atual e o que impede. */
    await Banco.impl.authEntrar(SESSAO.email, senhaAtual);
    await Banco.impl.authTrocarSenha(senhaNova);
    return;
  }

  const todas = contas(), c = todas[SESSAO.id];
  if (!c) throw new Error('Conta não encontrada.');
  const atual = await derivar(senhaAtual, c.salt, c.metodo);
  if (!iguaisSeguro(atual.valor, c.hash)) throw new Error('A senha atual não confere.');
  if (String(senhaNova).length < 6) throw new Error('A nova senha precisa de pelo menos 6 caracteres.');
  const salt = saltAleatorio();
  const d = await derivar(senhaNova, salt);
  c.salt = salt; c.hash = d.valor; c.metodo = d.metodo;
  await Banco.salvarConta(c);
}

async function apagarConta() {
  if (!SESSAO) return;
  const id = SESSAO.id;
  delete _contas[id];
  await Banco.apagarConta(id);
  await Banco.apagarEstado(id);
  await Banco.limparLeituras(id);
  sair();
}

/* ---------- a tela de entrada ----------
   Mora em frontend/js/entrada.js. Este arquivo cuida da conta e da sessao;
   quem desenha a porta e quem a escuta e o frontend, como no resto do
   projeto. */
