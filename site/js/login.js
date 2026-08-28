/* login.js — contas e sessao

   O login e OPCIONAL. O site abre direto no painel, em modo visitante, e
   criar conta serve para separar dados de quem divide o mesmo navegador.

   Sendo honesto sobre o que isto e e o que nao e:

   NAO E seguranca contra quem tem acesso ao computador. O site roda sem
   servidor; quem abrir o DevTools le o banco. Nao existe segredo do lado
   do cliente, ponto.

   E DE VERDADE:
     - a senha nunca e gravada, nem em texto nem de forma reversivel;
     - guardamos uma derivacao dela com salt aleatorio e 150 mil iteracoes
       (PBKDF2 pelo WebCrypto, ou SHA-256 encadeado onde nao houver);
     - comparacao em tempo constante, para nao vazar informacao pelo tempo;
     - a mesma mensagem de erro para senha errada e e-mail inexistente,
       para nao revelar quais contas existem;
     - cada conta tem seu proprio balde de dados no banco.

   Num produto de verdade isso tudo aconteceria no servidor. Esta escrito
   na propria tela de login, de proposito.
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

let SESSAO = null;
function carregarSessao() {
  const s = lerJSON(CHAVE_SESSAO, null);
  if (!s || !s.id) return null;
  if (s.ate && Date.now() > s.ate) { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { } return null; }
  /* o visitante não tem cadastro; qualquer outra sessão só vale se a conta existir */
  if (s.id !== 'visitante' && !contas()[s.id]) return null;
  SESSAO = s;
  return s;
}
function sessao() { return SESSAO; }
function ehVisitante() { return SESSAO && SESSAO.id === 'visitante'; }

/* ---------- operações de conta ---------- */
async function criarConta(nome, email, senha) {
  const e = normalizarEmail(email);
  if (String(nome).trim().length < 2) throw new Error('Escreva seu nome com pelo menos 2 letras.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Esse e-mail não parece válido.');
  if (String(senha).length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
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
  return todas[e];
}

async function entrar(email, senha, manter) {
  const e = normalizarEmail(email);
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

function entrarComoVisitante() {
  SESSAO = { id: 'visitante', nome: 'Visitante', email: null, ate: null };
  gravarJSON(CHAVE_SESSAO, SESSAO);
  return SESSAO;
}

function sair() {
  SESSAO = null;
  try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { }
}

async function trocarSenha(senhaAtual, senhaNova) {
  if (!SESSAO || ehVisitante()) throw new Error('Entre com uma conta para trocar a senha.');
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
  if (!SESSAO || ehVisitante()) return;
  const id = SESSAO.id;
  delete _contas[id];
  await Banco.apagarConta(id);
  await Banco.apagarEstado(id);
  await Banco.limparLeituras(id);
  sair();
}

/* ---------- migração de dados ----------
   Dois casos em que os dados ficariam órfãos e o usuário acharia que
   perdeu tudo. Os dois são resolvidos calados. */

/* quem brincou como visitante e depois criou conta leva o que fez junto */
async function migrarDoVisitante(destinoId) {
  const dados = await Banco.estado('visitante');
  if (!dados) return false;
  if (await Banco.estado(destinoId)) return false;
  await Banco.salvarEstado(destinoId, dados);
  await Banco.apagarEstado('visitante');
  return true;
}

/* ---------- tela de login ---------- */
let modoLogin = 'entrar';   /* entrar | criar */
let erroLogin = '';
let ocupado = false;

function vLogin() {
  const criar = modoLogin === 'criar';
  const quantas = Object.keys(contas()).length;

  /* Coluna da esquerda: o que o site faz. Quem chega aqui pela primeira vez
     precisa saber onde entrou antes de decidir criar conta. */
  const vitrine =
    '<section class="ent-vitrine">' +
    '<span class="ent-glow"></span>' +
    '<div class="ent-vitrine-in">' +
      '<div class="ent-marca">' +
        '<span class="ent-ic">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16150F" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M22 12h-2.4M4.4 12H2M19.07 4.93l-1.7 1.7M6.63 17.37l-1.7 1.7M19.07 19.07l-1.7-1.7M6.63 6.63l-1.7-1.7"/>' +
        '</svg></span>' +
        '<div><div class="ent-nome">Solaris</div>' +
        '<div class="ent-tag">Energia sob controle</div></div>' +
      '</div>' +

      '<h1 class="ent-titulo">Sua conta de luz,<br>explicada.</h1>' +

      '<ul class="ent-lista">' +
        itemVitrine('M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0zM12 18v3',
          'Para onde vai cada quilowatt',
          'O consumo dividido por aparelho, a partir do padr\u00e3o do medidor.') +
        itemVitrine('M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M23 12h-3M4 12H1',
          'Quanto o sol cobriu de verdade',
          'Hora a hora, cruzando o que o painel gera com o que a casa usa.') +
        itemVitrine('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
          'Quanto vem na pr\u00f3xima conta',
          'Com cr\u00e9ditos, m\u00ednimo faturado e o Fio B da Lei 14.300.') +
      '</ul>' +

      '<div class="ent-rodape">' +
        '<span class="live-dot"></span>' +
        'Medidor virtual rodando \u00b7 uma leitura por minuto gravada no banco' +
      '</div>' +
    '</div></section>';

  /* Coluna da direita: o formulario. */
  const formulario =
    '<section class="ent-form">' +
    '<div class="ent-cx">' +

      '<div class="ent-abas" role="tablist">' +
        '<button role="tab" data-act="auth-modo" data-v="entrar" aria-selected="' + (!criar) + '">Entrar</button>' +
        '<button role="tab" data-act="auth-modo" data-v="criar" aria-selected="' + criar + '">Criar conta</button>' +
      '</div>' +

      '<p class="ent-sub">' + (criar
        ? 'A conta guarda suas unidades, aparelhos e metas separados de quem mais usa este navegador.'
        : 'Use a conta que voc\u00ea criou neste navegador.') + '</p>' +

      '<form class="ent-campos" id="formLogin" autocomplete="on">' +
        (criar
          ? campoEntrada('auNome', 'Nome', 'text', 'name', 'Como quer ser chamado')
          : '') +
        campoEntrada('auEmail', 'E-mail', 'email', 'username', 'voce@exemplo.com') +
        campoEntrada('auSenha', 'Senha', 'password',
          criar ? 'new-password' : 'current-password',
          criar ? 'Pelo menos 6 caracteres' : 'Sua senha') +

        (criar ? '' :
          '<label class="ent-check"><input type="checkbox" id="auManter" checked>' +
          '<span>Continuar conectado por 30 dias</span></label>') +

        (erroLogin ? '<div class="ent-erro" role="alert">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
          '<span>' + esc(erroLogin) + '</span></div>' : '') +

        '<button type="submit" class="ent-botao" id="auEnviar"' + (ocupado ? ' disabled' : '') + '>' +
        (ocupado ? '<span class="ent-girando"></span>Verificando\u2026'
          : (criar ? 'Criar conta e entrar' : 'Entrar')) + '</button>' +
      '</form>' +

      '<div class="ent-ou"><span>ou</span></div>' +

      /* O caminho de teste tem que ser um clique. Durante o teste de campo
         ninguem deveria travar numa tela de cadastro. */
      '<button class="ent-visitante" data-act="auth-visitante">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        'Entrar sem criar conta' +
      '</button>' +
      '<p class="ent-visitante-d">Vai direto para o painel com os dados de demonstra\u00e7\u00e3o. ' +
      'D\u00e1 para criar conta depois sem perder o que voc\u00ea fez.</p>' +

      '<details class="ent-aviso">' +
        '<summary>Como seus dados ficam guardados</summary>' +
        '<p>O Solaris roda sem servidor, direto no seu navegador. A senha nunca ' +
        '\u00e9 gravada \u2014 s\u00f3 uma deriva\u00e7\u00e3o dela com salt e ' + nf(ITERACOES) + ' itera\u00e7\u00f5es' +
        (TEM_WEBCRYPTO ? ' (PBKDF2 pelo WebCrypto)' : ' (SHA-256 encadeado)') + '. ' +
        'Isso separa os dados entre contas, mas <b>n\u00e3o protege contra quem tem ' +
        'acesso a este computador</b>: sem servidor, n\u00e3o existe segredo do lado do ' +
        'cliente. Tamb\u00e9m n\u00e3o h\u00e1 recupera\u00e7\u00e3o de senha, porque n\u00e3o h\u00e1 e-mail para enviar.</p>' +
      '</details>' +

      (quantas ? '<div class="ent-contador">' + quantas +
        (quantas > 1 ? ' contas neste navegador' : ' conta neste navegador') + '</div>' : '') +

    '</div></section>';

  return '<div class="entrada">' + vitrine + formulario + '</div>';
}

/* um item da lista de argumentos, na coluna da esquerda */
function itemVitrine(icone, titulo, texto) {
  return '<li><span class="ent-li-ic">' +
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + icone + '"/></svg>' +
    '</span><div><b>' + titulo + '</b><span>' + texto + '</span></div></li>';
}

/* um campo do formulario */
function campoEntrada(id, rotulo, tipo, autocomplete, dica) {
  return '<label class="ent-campo" for="' + id + '">' +
    '<span>' + rotulo + '</span>' +
    '<input type="' + tipo + '" id="' + id + '" name="' + autocomplete + '" ' +
    'autocomplete="' + autocomplete + '" placeholder="' + dica + '" required>' +
    '</label>';
}

/* envio do formulário */
async function enviarLogin(ev) {
  ev.preventDefault();
  if (ocupado) return;
  const criar = modoLogin === 'criar';
  const nome = criar ? ($('#auNome') || {}).value : '';
  const email = ($('#auEmail') || {}).value;
  const senha = ($('#auSenha') || {}).value;
  const manter = criar ? true : !!(($('#auManter') || {}).checked);

  ocupado = true; erroLogin = ''; renderLogin();
  try {
    let migrou = false;
    if (criar) {
      const eraVisitante = ehVisitante();
      const c = await criarConta(nome, email, senha);
      if (eraVisitante) migrou = await migrarDoVisitante(c.id);
      await entrar(email, senha, true);
    } else await entrar(email, senha, manter);
    ocupado = false;
    await aoEntrar(migrou);
  } catch (e) {
    ocupado = false;
    erroLogin = e.message || 'Não deu para continuar.';
    renderLogin();
    const alvo = $('#auSenha'); if (alvo) { alvo.focus(); alvo.select(); }
  }
}

function renderLogin() {
  const root = $('#root');
  const foco = document.activeElement ? document.activeElement.id : null;
  const vals = {};
  ['auNome', 'auEmail', 'auSenha'].forEach(id => { const e = $('#' + id); if (e) vals[id] = e.value; });

  root.innerHTML = vLogin();
  document.body.classList.remove('vista-celular');
  document.body.classList.add('vista-login');

  Object.keys(vals).forEach(id => { const e = $('#' + id); if (e && id !== 'auSenha') e.value = vals[id]; });
  const f = $('#formLogin');
  if (f) f.addEventListener('submit', enviarLogin);
  /* foco pode ser '' quando o elemento ativo é o body — '#' sozinho não é seletor válido */
  const alvo = (foco && $('#' + foco)) || $('#auNome') || $('#auEmail');
  if (alvo && !ocupado) alvo.focus();
}
