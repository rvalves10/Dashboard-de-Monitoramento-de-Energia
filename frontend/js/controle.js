/* controle.js — quem manda no site

   Junta tudo: decide qual tela desenhar, escuta os cliques, cuida das
   rotas e mantem o medidor pulsando.

   Como os eventos funcionam: em vez de pendurar onclick em cada botao,
   existe UM escutador no documento inteiro. Ele olha o data-act do que foi
   clicado e procura a acao correspondente no objeto ACOES. Isso resolve o
   problema de redesenhar a tela toda hora — os eventos nunca se perdem
   porque nunca estiveram presos aos elementos.

   O tique: a cada 2 segundos atualiza o medidor na tela; a cada 60 grava
   uma leitura no banco; a cada 45 confere se virou a hora, e se virou,
   redesenha para os numeros do mes acompanharem.

   Aqui tambem estao os graficos interativos (mouse, dedo e teclado) e os
   avisos que aparecem no canto.
*/
'use strict';

const TELA_ORDEM = NAV.map(n => n.k);
/* O site e responsivo: abaixo de 760px ele troca a casca por uma versao
   de coluna unica com abas embaixo. Continua sendo o mesmo site, com o
   mesmo motor e os mesmos dados - nao e um app separado. */
const LARGURA_ESTREITA = 760;
function telaEstreita() { return window.innerWidth <= LARGURA_ESTREITA; }

/* O formulario de unidade sem a casca do site, porque ainda nao ha
   menu lateral nem painel para mostrar ao lado. */
function corpoPrimeiroCadastro() {
  return '<div class="cadastro-solo">' +
    '<header class="cadastro-solo-topo">' +
      '<button class="link-btn" data-act="nav" data-tela="painel">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      'Voltar</button>' +
      '<h1>Sua primeira unidade</h1>' +
    '</header>' +
    '<div class="cadastro-solo-corpo">' + vUnidade() + '</div>' +
    '</div>';
}

function corpoAmplo() {
  let tela = '';
  if (S.tela === 'painel') tela = vPainel();
  else if (S.tela === 'historico') tela = vHistorico();
  else if (S.tela === 'equipamentos') tela = vEquip();
  else if (S.tela === 'cadastro') tela = vCadastro();
  else if (S.tela === 'alertas') tela = vAlertas();
  else if (S.tela === 'relatorio') tela = vRelatorio();
  else if (S.tela === 'unidade') tela = vUnidade();
  else tela = vConfig();
  return '<div class="app">' + vRail() + '<main class="main" id="conteudo" tabindex="-1">' + vTopbar() + '<div class="page">' + tela + '</div></main></div>';
}

let _ultimoModo = null;
function render() {
  /* sem sessão não existe app: a tela de login é a única coisa renderizada */
  if (!sessao()) { renderLogin(); return; }
  document.body.classList.remove('vista-login');
  const root = $('#root');
  const ativo = document.activeElement;
  const fid = ativo && ativo.dataset ? ativo.dataset.fid : null;
  const caret = ativo && ativo.selectionStart != null ? ativo.selectionStart : null;

  /* Sem unidade nenhuma nao ha painel para desenhar. Duas telas passam
     nesse estado: o convite e o proprio formulario de cadastro. */
  ajustarPerfil();
  if (semUnidade()) {
    root.innerHTML = S.tela === 'unidade' ? corpoPrimeiroCadastro() : vPrimeiraUnidade();
    document.body.classList.remove('vista-celular');
    _ultimoModo = telaEstreita();
    if (fid) { const a = $('[data-fid="' + fid + '"]'); if (a) a.focus({ preventScroll: true }); }
    return;
  }

  const mob = telaEstreita();
  root.innerHTML = mob ? vMovel() : corpoAmplo();
  document.body.classList.toggle('vista-celular', mob);
  _ultimoModo = mob;

  if (fid) {
    const alvo = $('[data-fid="' + fid + '"]');
    if (alvo) {
      alvo.focus({ preventScroll: true });
      if (caret != null && alvo.setSelectionRange && alvo.type === 'text') {
        try { alvo.setSelectionRange(caret, caret); } catch (e) { }
      }
    }
  }
  ligarGraficos();
  preencherCardBanco();
  atualizarHash();
}

/* O cartão do banco depende de consultas assíncronas, então ele nasce
   vazio no render e se preenche logo depois. */
async function preencherCardBanco() {
  if (!$('#cardBanco')) return;
  const est = await Banco.estatisticas();
  const motor = $('#bancoMotor');
  if (motor) {
    motor.textContent = est.motor;
    motor.className = 'pill ' + (Banco.usandoIndexedDB ? 'pill--good' : 'pill--warn');
  }

  const tamanho = est.bytes ? (est.bytes > 1048576
    ? nf(est.bytes / 1048576, 1) + ' MB' : nf(est.bytes / 1024) + ' KB') : '\u2014';
  const numeros = [
    ['Leituras gravadas', nf(est.leituras), 'uma por minuto, \u00faltimos ' + est.janelaDias + ' dias'],
    ['Contas', nf(est.contas), est.contas === 1 ? 'cadastrada neste navegador' : 'cadastradas neste navegador'],
    ['Espa\u00e7o em disco', tamanho, 'estimado pelo navegador'],
    ['Tabelas', '3', 'contas, estado e leituras']
  ];
  const g = $('#bancoNumeros');
  if (g) g.innerHTML = numeros.map(n =>
    '<div class="bd-cel"><div class="bd-k">' + n[0] + '</div>' +
    '<div class="bd-v">' + n[1] + '</div>' +
    '<div class="bd-s">' + n[2] + '</div></div>').join('');

  const alvo = $('#bancoGrafico');
  if (!alvo) return;
  if (!Banco.usandoIndexedDB) {
    alvo.innerHTML = '<div class="bd-vazio">Este navegador n\u00e3o liberou o IndexedDB, ent\u00e3o o sistema est\u00e1 usando o armazenamento simples como reserva. Tudo funciona, mas o hist\u00f3rico minuto a minuto n\u00e3o \u00e9 gravado.</div>';
    return;
  }
  const linhas = await Banco.leituras(contaAtual(), Date.now() - 2 * 3600000);
  if (linhas.length < 2) {
    alvo.innerHTML = '<div class="bd-vazio">O banco come\u00e7a a gravar assim que o painel fica aberto \u2014 uma leitura por minuto. Volte aqui daqui a pouco e o gr\u00e1fico aparece.' +
      (linhas.length ? ' J\u00e1 h\u00e1 ' + linhas.length + ' leitura registrada.' : '') + '</div>';
    return;
  }
  const maxV = Math.max.apply(null, linhas.map(l => Math.max(l.c, l.g))) * 1.1 || 1;
  const W = 720, H = 90;
  const cam = arr => caminho(arr, maxV, W, H);
  const c0 = new Date(linhas[0].t), c1 = new Date(linhas[linhas.length - 1].t);
  const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  alvo.innerHTML =
    '<div class="bd-graf-t">' + linhas.length + ' leituras reais do banco \u00b7 ' + hhmm(c0) + ' at\u00e9 ' + hhmm(c1) + '</div>' +
    '<svg viewBox="0 0 720 96" preserveAspectRatio="none" style="width:100%;height:96px;margin-top:10px">' +
    '<path d="' + caminho(linhas.map(l => l.g), maxV, W, H, true) + '" fill="rgba(237,162,43,.16)"/>' +
    '<path d="' + cam(linhas.map(l => l.g)) + '" fill="none" stroke="var(--sun)" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="' + cam(linhas.map(l => l.c)) + '" fill="none" stroke="var(--grid)" stroke-width="1.8" stroke-linejoin="round"/>' +
    '</svg>' +
    '<div class="bd-pe"><span>Cada ponto \u00e9 uma linha na tabela <code>leituras</code></span>' +
    '<button class="danger-btn" data-act="limpar-leituras">Apagar hist\u00f3rico</button></div>';
}

/* ---------- gráficos interativos ---------- */
/* Gráficos respondem a mouse, toque e teclado.
   pointermove cobre mouse e dedo de uma vez; as setas percorrem os pontos
   e o texto do balão é anunciado por leitor de tela via aria-live. */
function ligarGraficos() {
  const c = $('#chartDia');
  if (c) {
    const tip = $('#tipDia'), v = visao();
    const dia = v.md.dias[v.data.getDate() - 1];
    let i = -1;
    const mostrar = k => {
      i = clamp(k, 0, 23);
      tip.innerHTML = String(i).padStart(2, '0') + 'h<br>Sol <b>' + nf(dia.ger[i], 2) + ' kW</b> · Consumo <i>' + nf(dia.cons[i], 2) + ' kW</i>';
      tip.style.left = (i / 23) * 100 + '%';
      tip.style.top = '10px';
      tip.classList.add('on');
      anunciar(String(i).padStart(2, '0') + ' horas. Geração ' + nf(dia.ger[i], 2) + ' quilowatts. Consumo ' + nf(dia.cons[i], 2) + ' quilowatts.');
    };
    const esconder = () => { tip.classList.remove('on'); i = -1; };
    c.addEventListener('pointermove', ev => {
      const r = c.getBoundingClientRect();
      mostrar(Math.round(clamp((ev.clientX - r.left) / r.width, 0, 1) * 23));
    });
    c.addEventListener('pointerleave', esconder);
    c.addEventListener('blur', esconder);
    c.addEventListener('keydown', ev => {
      const base = i < 0 ? Math.round(v.hDec - (v.data.getDate() - 1) * 24) : i;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(base + 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(base - 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); mostrar(0); }
      else if (ev.key === 'End') { ev.preventDefault(); mostrar(23); }
      else if (ev.key === 'Escape') esconder();
    });
  }

  const hb = $('#hbars');
  if (hb) {
    const tip = $('#tipHist'), s = seriePeriodo();
    let j = -1;
    const mostrar = k => {
      j = clamp(k, 0, s.cons.length - 1);
      const alvo = hb.children[j];
      if (!alvo) return;
      const saldo = s.ger[j] - s.cons[j];
      tip.innerHTML = esc(s.nomes[j]) + '<br>Consumo <i>' + nf(s.cons[j], 1) + ' kWh</i> · Geração <b>' + nf(s.ger[j], 1) + ' kWh</b><br>Saldo ' + sinal(saldo, 1) + ' kWh';
      const r = hb.getBoundingClientRect(), rb = alvo.getBoundingClientRect();
      tip.style.left = (rb.left - r.left + rb.width / 2) + 'px';
      tip.style.top = '18px';
      tip.classList.add('on');
      anunciar(s.nomes[j] + '. Consumo ' + nf(s.cons[j], 1) + ' quilowatt-hora. Geração ' + nf(s.ger[j], 1) + '. Saldo ' + sinal(saldo, 1) + '.');
    };
    const esconder = () => { tip.classList.remove('on'); j = -1; };
    hb.addEventListener('pointermove', ev => {
      const alvo = ev.target.closest ? ev.target.closest('.hbar') : null;
      if (!alvo) { esconder(); return; }
      mostrar(+alvo.dataset.i);
    });
    hb.addEventListener('pointerleave', esconder);
    hb.addEventListener('blur', esconder);
    hb.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(j < 0 ? 0 : j + 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(j < 0 ? s.cons.length - 1 : j - 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); mostrar(0); }
      else if (ev.key === 'End') { ev.preventDefault(); mostrar(s.cons.length - 1); }
      else if (ev.key === 'Escape') esconder();
    });
  }
}

/* região viva única, para leitor de tela ler o ponto sob o cursor */
let _anuncio = null;
function anunciar(txt) {
  if (!_anuncio) {
    _anuncio = document.createElement('div');
    _anuncio.className = 'sr';
    _anuncio.setAttribute('aria-live', 'polite');
    document.body.appendChild(_anuncio);
  }
  _anuncio.textContent = txt;
}

/* ---------- avisos ---------- */
function aviso(titulo, sub, tipo) {
  const w = $('#toasts');
  if (!w) return;
  const el = document.createElement('div');
  el.className = 'toast toast--' + (tipo || 'sun');
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="toast-dot"></span><div><div class="toast-t">' + esc(titulo) + '</div>' +
    (sub ? '<div class="toast-s">' + esc(sub) + '</div>' : '') + '</div>';
  w.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 5200);
  while (w.children.length > 3) w.firstChild.remove();
}

/* ---------- sincronizações leves (sem re-render) ---------- */
function txt(sel, valor) { const e = $(sel); if (e) e.textContent = valor; }
function syncCadastro() {
  const n = S.novo, e = estimativaNovo();
  txt('#potLbl', nf(n.pot) + ' W');
  txt('#horasLbl', nf(n.horas, 1) + ' h por dia');
  txt('#diasLbl', n.dias + ' dias por mês');
  txt('#estKwh', nf(e.kwh, 1));
  txt('#estCusto', brl(e.custo) + ' por mês');
  txt('#estAno', brl(e.ano) + ' ao longo de um ano');
  txt('#estPct', textoEstimativa(e));
  const b = $('#estBar'); if (b) b.style.width = e.pctBar + '%';
  const btn = $('[data-act="salvar"]');
  if (btn) {
    const pode = n.nome.trim().length > 1;
    btn.disabled = !pode;
    btn.style.background = pode ? 'var(--on-dark)' : '';
    btn.style.color = pode ? 'var(--dark)' : '';
  }
}
function syncMeta() {
  const v = visao(), meta = S.metas[S.perfil], t = tarifaAtual();
  txt('#metaLbl', telaEstreita() ? nf(meta) : nf(meta) + ' kWh');
  txt('#metaCusto', '≈ ' + brl(meta * t));
  const f = $('#metaFill');
  if (f) {
    f.style.width = clamp((v.mtd.tc / meta) * 100, 0, 100) + '%';
    f.style.background = v.projConsumo > meta ? 'var(--bad)' : 'var(--good)';
  }
}
/* Digitar nao redesenha a tela inteira — o campo perderia o foco no meio
   da palavra. Estas funcoes atualizam so o que depende do que foi digitado.
   Quem adicionar um elemento que reage ao formulario precisa atualizar
   aqui tambem, senao ele congela com o valor do ultimo render. */
function syncUnidade() {
  const n = S.nova;

  /* prévia da geração: só existe nos passos 1 e 2 */
  if ($('#pvGer')) {
    const p = previaUnidade();
    txt('#pvGer', nf(p.geracao));
    txt('#pvExpl', nf(p.telhado.fator * 100) + '% do sol da região, com ' + nf(n.potenciaKwp, 1) + ' kWp instalados');
    txt('#pvCob', textoCobertura(p, n));
    const b = $('#pvBar'); if (b) b.style.width = clamp(p.cobertura, 0, 100) + '%';
    const c = $('#pvConta');
    if (c) c.innerHTML = 'Sem os painéis, sua conta seria cerca de <b style="color:var(--on-dark)">' + brl(p.contaSem) + '</b> por mês.';
  }

  /* o "Continuar" do passo aberto libera assim que o passo fecha */
  const at = typeof passoAtual === 'function' ? passoAtual() : 1;
  const seguir = $('[data-act="nova-passo"].dark-btn');
  if (seguir) seguir.disabled = !passoCompleto(at);

  const btn = $('[data-act="salvar-unidade"]');
  if (btn) btn.disabled = !(passoCompleto(1) && passoCompleto(2));

  /* a trilha marca o passo como concluído no mesmo instante */
  $$('.trilha-item').forEach((li, i) => {
    const n_ = i + 1;
    if (n_ === at) return;
    li.classList.toggle('trilha-item--feito', passoCompleto(n_) && n_ < at);
  });

  const falta = $('.passo-falta');
  if (falta) falta.style.display = passoCompleto(at) ? 'none' : '';
}
function syncTarifa() { txt('#tarLbl', 'R$ ' + nf(tarifaAtual(), 2) + ' / kWh'); }

/* ---------- ações ---------- */
function irPara(tela) { S.tela = tela; S.detalhe = null; S.salvo = false; salvar(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

const ACOES = {
  nav: el => irPara(el.dataset.tela),
  unit: el => {
    S.perfil = el.dataset.unit; S.detalhe = null; S.salvo = false;
    S.novo.comodo = uni(S.perfil).comodos[0];
    _visao = null; salvar(); render();
    aviso('Unidade trocada', uni(S.perfil).nome + ' · ' + uni(S.perfil).tipo, 'sun');
  },
  periodo: el => { S.periodo = el.dataset.p; salvar(); render(); },
  mtab: el => { S.tab = el.dataset.k; S.msub = null; salvar(); render(); },
  msub: el => { S.msub = el.dataset.k; S.salvo = false; salvar(); render(); },
  mback: () => { S.msub = null; salvar(); render(); },
  'eq-abrir': el => { S.detalhe = S.detalhe === el.dataset.id ? null : el.dataset.id; if (S.tela !== 'equipamentos') S.tela = 'equipamentos'; salvar(); render(); },
  'det-fechar': () => { S.detalhe = null; salvar(); render(); },
  'eq-remover': el => {
    const id = el.dataset.id;
    const extra = S.extras.filter(e => e.perfil === S.perfil && e.id === id)[0];
    const nome = (aparelhos().filter(e => e.id === id)[0] || {}).nome || 'Aparelho';
    if (extra) S.extras = S.extras.filter(e => !(e.perfil === S.perfil && e.id === id));
    else S.removidos = S.removidos.concat([S.perfil + ':' + id]);
    if (S.detalhe === id) S.detalhe = null;
    salvar(); render();
    aviso(nome + ' removido', 'O consumo dele voltou para “Não identificado”.', 'bad');
  },
  'det-sim': el => {
    const x = unidade().deteccoes.filter(d => d.id === el.dataset.id)[0];
    S.respondidas[S.perfil + ':' + x.id] = 'sim';
    S.extras = S.extras.concat([{
      id: 'det-' + x.id, perfil: S.perfil, nome: x.palpite, local: '—', cat: x.cat,
      pot: x.pot, horas: x.horas, dias: 26, cor: CORES_EXTRA[S.extras.length % CORES_EXTRA.length],
      conf: 'média', fonte: 'ia', tend: 0
    }]);
    salvar(); render();
    aviso(x.palpite + ' confirmado', 'Entrou no ranking com estimativa própria.', 'good');
  },
  'det-nao': el => {
    const x = unidade().deteccoes.filter(d => d.id === el.dataset.id)[0];
    S.respondidas[S.perfil + ':' + x.id] = 'nao';
    salvar(); render();
    aviso('Palpite descartado', 'A IA não vai sugerir “' + x.palpite + '” de novo.', 'sun');
  },
  chip: el => { S.novo[el.dataset.campo] = el.dataset.v; S.salvo = false; salvar(); render(); },
  preset: el => {
    const p = PRESETS[+el.dataset.i];
    S.novo = Object.assign({}, S.novo, { nome: p.nome, pot: p.pot, horas: p.horas, cat: p.cat });
    S.salvo = false; salvar(); render();
  },
  'eq-editar': el => {
    const e = aparelhos().filter(x => x.id === el.dataset.id)[0];
    if (!e || e.sintetico) return;
    S.editando = e.id;
    S.novo = {
      nome: e.nome, cat: e.cat, comodo: e.local === '—' ? uni(S.perfil).comodos[0] : e.local,
      pot: Math.round(clamp(e.pot || 1000, 20, 12000)),
      horas: Math.round(clamp(e.horas || 1, 0.1, 24) * 10) / 10,
      dias: Math.round(clamp(e.dias || 30, 1, 31))
    };
    S.salvo = false; S.tela = 'cadastro'; S.msub = 'cadastro';
    salvar(); render();
  },
  'cancelar-edicao': () => {
    S.editando = null; S.salvo = false;
    S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: uni(S.perfil).comodos[0] };
    salvar(); render();
  },
  salvar: () => {
    const n = S.novo;
    if (n.nome.trim().length < 2) return;
    const kwh = (n.pot / 1000) * n.horas * n.dias;
    const campos = {
      nome: n.nome.trim(), local: n.comodo, cat: n.cat,
      pot: n.pot, horas: n.horas, dias: n.dias, conf: 'alta', fonte: 'manual', tend: 0
    };

    if (S.editando) {
      const alvo = S.editando;
      const jaExtra = S.extras.filter(x => x.perfil === S.perfil && x.id === alvo)[0];
      if (jaExtra) {
        S.extras = S.extras.map(x => (x.perfil === S.perfil && x.id === alvo) ? Object.assign({}, x, campos) : x);
      } else {
        /* era estimativa da IA: some do catálogo e vira cadastro seu, guardando a cor */
        const orig = unidade().equipamentos.filter(x => x.id === alvo)[0];
        S.removidos = S.removidos.concat([S.perfil + ':' + alvo]);
        S.extras = S.extras.concat([Object.assign({
          id: 'x' + Date.now().toString(36), perfil: S.perfil,
          cor: orig ? orig.cor : CORES_EXTRA[S.extras.length % CORES_EXTRA.length]
        }, campos)]);
      }
      S.editando = null; S.salvo = false; S.detalhe = null;
      S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: uni(S.perfil).comodos[0] };
      S.tela = 'equipamentos'; S.msub = null;
      salvar(); render();
      aviso(campos.nome + ' atualizado', nf(kwh, 1) + ' kWh por mês · ' + brl(kwh * tarifaAtual()) + ' na conta.', 'good');
      return;
    }

    S.extras = S.extras.concat([Object.assign({
      id: 'x' + Date.now().toString(36), perfil: S.perfil,
      cor: CORES_EXTRA[S.extras.length % CORES_EXTRA.length]
    }, campos)]);
    S.salvo = true;
    S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: uni(S.perfil).comodos[0] };
    salvar(); render();
    aviso(campos.nome + ' cadastrado', nf(kwh, 1) + ' kWh por mês · ' + brl(kwh * tarifaAtual()) + ' na conta.', 'good');
  },
  'ligar-exemplos': () => {
    S.exemplos = true;
    ajustarPerfil(); _visao = null; _cacheLedger.clear();
    salvar(); render();
    aviso('Exemplos carregados', 'Casa das Acácias e Padaria Pão de Ouro são demonstração. Desligue em Configurações quando cadastrar a sua.', 'sun');
  },
  'alternar-exemplos': () => {
    S.exemplos = !mostrandoExemplos();
    ajustarPerfil(); _visao = null; _cacheLedger.clear();
    salvar(); render();
    aviso(S.exemplos ? 'Exemplos ligados' : 'Exemplos desligados',
      S.exemplos ? 'As unidades de demonstração voltaram para o menu.'
        : 'Agora você vê apenas as unidades que cadastrou.', 'sun');
  },
  /* Trocar de arquetipo troca a lista de aparelhos possiveis, entao a
     selecao antiga nao vale mais: volta a null, que o cadastro le como
     "todos marcados". */
  'nova-arq': el => { S.nova.arquetipo = el.dataset.v; S.nova.aparelhos = null; salvar(); render(); },
  'nova-passo': el => { S.nova.passo = Number(el.dataset.v) || 1; salvar(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'nova-aparelho': el => {
    const id = el.dataset.v;
    const todos = aparelhosDoArquetipo(S.nova.arquetipo).map(e => e.id);
    const atual = Array.isArray(S.nova.aparelhos) ? S.nova.aparelhos.slice() : todos.slice();
    const i = atual.indexOf(id);
    if (i >= 0) atual.splice(i, 1); else atual.push(id);
    S.nova.aparelhos = atual;
    salvar(); render();
  },
  'nova-aparelhos-todos': () => {
    const todos = aparelhosDoArquetipo(S.nova.arquetipo).map(e => e.id);
    const atual = Array.isArray(S.nova.aparelhos) ? S.nova.aparelhos : todos;
    S.nova.aparelhos = atual.length === todos.length ? [] : todos.slice();
    salvar(); render();
  },
  'nova-telhado': el => { S.nova.telhado = el.dataset.v; salvar(); render(); },
  'salvar-unidade': () => {
    const n = S.nova;
    if (n.nome.trim().length < 2 || !(n.potenciaKwp > 0) || !(n.consumoMes > 0)) return;
    const chave = 'u' + Date.now().toString(36);
    /* passo e estado do formulario, nao da unidade — nao vai para o banco.
       aparelhos vira lista explicita: unidade nova nasce com o que a pessoa
       marcou, nunca com a lista inteira do arquetipo por omissao. */
    /* criadaEm marca o instante em que o medidor comeca a valer para esta
       unidade. Tudo anterior e reconstrucao, e a tela avisa. */
    const dados = Object.assign({}, n, { chave: chave, nome: n.nome.trim(), criadaEm: Date.now() });
    delete dados.passo;
    if (!Array.isArray(dados.aparelhos)) dados.aparelhos = aparelhosDoArquetipo(n.arquetipo).map(e => e.id);
    S.unidades = (S.unidades || []).concat([dados]);
    const u = uni(chave);
    S.metas[chave] = u.metaPadrao;
    S.tarifa[chave] = null;
    S.perfil = chave; S.tela = 'painel'; S.detalhe = null;
    S.nova = JSON.parse(JSON.stringify(PADRAO.nova));
    _visao = null; _cacheLedger.clear();
    salvar(); render();
    aviso(u.nome + ' criada', 'Gerando ' + nf(u.geracaoMes) + ' kWh/mês para um consumo de ' + nf(u.consumoMes) + ' kWh. O painel já está mostrando ela.', 'good');
  },
  'remover-unidade': el => {
    const chave = el.dataset.chave;
    const alvo = uni(chave);
    if (!alvo) return;
    if (!window.confirm('Remover a unidade "' + alvo.nome + '" e tudo que foi cadastrado nela?')) return;
    S.unidades = (S.unidades || []).filter(x => x.chave !== chave);
    S.extras = S.extras.filter(x => x.perfil !== chave);
    S.removidos = S.removidos.filter(x => x.indexOf(chave + ':') !== 0);
    delete S.metas[chave]; delete S.tarifa[chave];
    if (S.perfil === chave) S.perfil = 'residencial';
    _visao = null; _cacheLedger.clear();
    salvar(); render();
    aviso(alvo.nome + ' removida', 'A unidade e os aparelhos dela saíram do sistema.', 'bad');
  },
  'alerta-dispensar': el => {
    S.dispensados = S.dispensados.concat([el.dataset.chave]);
    salvar(); render();
  },
  regra: el => {
    const k = el.dataset.k;
    S.regras[k] = !S.regras[k];
    salvar(); render();
  },
  fonte: el => {
    MEDIDOR.ativo = el.dataset.v === 'medidor';
    MEDIDOR.ultima = null; MEDIDOR.erro = null;
    if (MEDIDOR.ativo) { buscarMedidor(); aviso('Procurando o medidor', 'Conecte o computador na rede Solaris-Medidor. Sem resposta em 15 s, o painel volta para a simulação.', 'sun'); }
    else aviso('Fonte: simulação', 'O painel voltou a calcular a leitura.', 'sun');
    salvar(); render();
  },
  'auth-modo': el => { modoLogin = el.dataset.v; erroLogin = ''; renderLogin(); },
  'auth-abrir': () => { modoLogin = 'entrar'; erroLogin = ''; renderLogin(); },
  'auth-visitante': () => { entrarComoVisitante(); aoEntrar(); },
  'auth-voltar': () => {
    if (!sessao()) { entrarComoVisitante(); aoEntrar(); return; }
    document.body.classList.remove('vista-login');
    render();
  },
  sair: () => {
    const visitante = ehVisitante();
    const aviso = visitante
      ? 'Voltar para a tela de entrada? O que você fez continua salvo neste navegador.'
      : 'Sair da conta? Seus dados continuam salvos neste navegador.';
    if (!window.confirm(aviso)) return;
    sair();
    /* a tela de entrada e a porta do site, entao sair leva de volta para ela */
    S = JSON.parse(JSON.stringify(PADRAO));
    _visao = null; _cacheLedger.clear();
    modoLogin = 'entrar'; erroLogin = '';
    renderLogin();
  },
  'limpar-leituras': async () => {
    if (!window.confirm('Apagar o hist\u00f3rico de leituras desta conta? O painel continua funcionando \u2014 s\u00f3 o registro minuto a minuto some.')) return;
    const n = await Banco.limparLeituras(contaAtual());
    render();
    aviso('Hist\u00f3rico apagado', n + ' leituras removidas do banco.', 'bad');
  },
  imprimir: () => window.print(),
  'reset-tarifa': () => { S.tarifa[S.perfil] = null; salvar(); render(); aviso('Tarifa restaurada', 'Voltou para R$ ' + nf(unidade().tarifa, 2) + ' / kWh da ' + unidade().distribuidora + '.', 'sun'); },
  'reset-tudo': () => {
    if (!window.confirm('Apagar aparelhos cadastrados, metas, tarifa e respostas da IA neste navegador?')) return;
    try { localStorage.removeItem(chaveEstado()); } catch (e) { }
    S = JSON.parse(JSON.stringify(PADRAO));
    _visao = null; render();
    aviso('Dados apagados', 'O Solaris voltou ao estado inicial.', 'bad');
  }
};

document.addEventListener('click', ev => {
  const el = ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el) return;
  const fn = ACOES[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  fn(el);
});
document.addEventListener('keydown', ev => {
  const el = ev.target.closest ? ev.target.closest('[data-act][role="button"]') : null;
  if (el && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); (ACOES[el.dataset.act] || function () { })(el); return; }
  if (ev.target.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === 'Escape') { if (S.msub) { S.msub = null; render(); } else if (S.detalhe) { S.detalhe = null; render(); } return; }
  if (ev.key >= '1' && ev.key <= '7' && !telaEstreita()) irPara(TELA_ORDEM[+ev.key - 1]);
});

/* entradas contínuas */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.in) return;
  const campo = el.dataset.in;
  if (campo === 'nome') { S.novo.nome = el.value; S.salvo = false; syncCadastro(); salvar(); return; }
  if (campo === 'pot' || campo === 'horas' || campo === 'dias') {
    S.novo[campo] = Number(el.value); S.salvo = false; syncCadastro(); salvar(); return;
  }
  const CAMPOS_UNIDADE = {
    unNome: ['nome', 'texto'], unDistribuidora: ['distribuidora', 'texto'],
    unConsumo: ['consumoMes', 'num'], unTarifa: ['tarifa', 'num'],
    unPotencia: ['potenciaKwp', 'num'], unPaineis: ['paineis', 'int'],
    unInvestimento: ['investimento', 'num'], unMeses: ['mesesOperacao', 'int']
  };
  if (CAMPOS_UNIDADE[campo]) {
    const def = CAMPOS_UNIDADE[campo];
    S.nova[def[0]] = def[1] === 'texto' ? el.value
      : def[1] === 'int' ? Math.max(0, Math.round(numeroBR(el.value)))
        : Math.max(0, numeroBR(el.value));
    syncUnidade(); salvar(); return;
  }
  if (campo === 'endereco') { MEDIDOR.endereco = el.value.trim(); MEDIDOR.ultima = null; salvar(); return; }
  if (campo === 'meta') { S.metas[S.perfil] = Number(el.value); syncMeta(); salvar(); return; }
  if (campo === 'tarifa') { S.tarifa[S.perfil] = Number(el.value) / 100; _visao = null; syncTarifa(); salvar(); return; }
});
document.addEventListener('change', ev => {
  const el = ev.target;

  /* A foto da conta de luz. O input fica escondido dentro de um <label>,
     entao o clique vem do label e o arquivo chega por 'change'. */
  if (el.dataset && el.dataset.act === 'foto-conta') {
    const arquivo = el.files && el.files[0];
    el.value = '';   /* solta o arquivo: escolher a mesma foto de novo tem que disparar */
    if (arquivo) lerContaDeLuz(arquivo, render);
    return;
  }

  if (!el.dataset || !el.dataset.in) return;
  if (el.type === 'range') { _visao = null; render(); }
});

/* ---------- hash ---------- */
function hashAtual() {
  return telaEstreita()
    ? '#/' + S.tab + (S.msub ? '/' + S.msub : '')
    : '#/' + S.tela;
}
/* alguns contextos (data:, about:) recusam mudança de hash — o app segue sem ela */
const HASH_OK = location.protocol === 'http:' || location.protocol === 'https:' || location.protocol === 'file:';
function atualizarHash() {
  if (!HASH_OK) return;
  try {
    const h = hashAtual();
    if (location.hash !== h) location.hash = h;
  } catch (e) { }
}
/* só re-renderiza se o hash descrever um estado diferente do atual —
   evita o laço entre atualizarHash e o evento hashchange */
function lerHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!p.length) return;
  if (telaEstreita()) {
    const tab = p[0], sub = p[1] || null;
    if (S.tab === tab && S.msub === sub) return;
    S.tab = tab; S.msub = sub;
  } else if (TELAS[p[0]]) {
    if (S.tela === p[0]) return;
    S.tela = p[0];
  } else return;
  salvar(); render();
}
window.addEventListener('hashchange', lerHash);
/* So redesenha quando a largura cruza o ponto de quebra, nao a cada pixel.
   Escutamos os dois: resize cobre o uso normal, matchMedia cobre rotacao de
   tela e emulacao de dispositivo, onde nem sempre chega um resize. */
const _consultaEstreita = window.matchMedia('(max-width: ' + LARGURA_ESTREITA + 'px)');
function aoMudarLargura() { if (telaEstreita() !== _ultimoModo) render(); }
window.addEventListener('resize', aoMudarLargura);
if (_consultaEstreita.addEventListener) _consultaEstreita.addEventListener('change', aoMudarLargura);
else if (_consultaEstreita.addListener) _consultaEstreita.addListener(aoMudarLargura);

/* ---------- o tique ---------- */
let _spikeCooldown = 0, _spikeAtivo = false;
function tique() {
  /* Sem unidade cadastrada nao existe medidor para ler: a conta acabou de
     nascer e a pessoa ainda esta na tela de cadastro. Sem esta guarda o
     tique chamava potenciaAgora() a cada 2 segundos e estourava em
     mesSimulado, porque uni() devolve null. */
  if (!sessao() || semUnidade()) return;
  pulso();
  buscarMedidor();
  gravarLeitura();
  const p = potenciaAgora();
  txt('#liveC', nf(p.cons, 2) + ' kW');
  txt('#liveG', nf(p.ger, 2) + ' kW');
  txt('#mLiveC', nf(p.cons, 2) + ' kW');
  txt('#mLiveG', nf(p.ger, 2) + ' kW');
  txt('#liveNote', textoMedidor(p));
  const b = $('#liveBar');
  if (b) b.style.width = clamp((p.ger / Math.max(p.cons, .001)) * 100, 0, 100) + '%';

  if (_spikeCooldown > 0) _spikeCooldown--;
  const emSurto = surtoAtivo();
  if (emSurto && !_spikeAtivo && _spikeCooldown === 0) {
    _spikeCooldown = 60;
    const eq = aparelhos().filter(e => !e.sintetico && e.pot > 900);
    const culpado = eq.length ? eq[Math.floor(Math.random() * eq.length)].nome : 'Algum aparelho';
    aviso('Pico de consumo agora', culpado + ' provavelmente acabou de ligar — o medidor saltou para ' + nf(p.cons, 2) + ' kW.', 'bad');
  }
  _spikeAtivo = emSurto;
}
/* uma linha por minuto no banco: e o historico que localStorage nao aguenta */
let _ultimaGravacao = 0;
async function gravarLeitura() {
  if (!sessao() || semUnidade() || !Banco.usandoIndexedDB) return;
  const agoraMs = Date.now();
  if (agoraMs - _ultimaGravacao < 60000) return;
  _ultimaGravacao = agoraMs;
  const p = potenciaAgora();
  await Banco.registrarLeitura(contaAtual(), p.cons, p.ger);
}

let _ultimaHora = -1;
function tiqueLento() {
  if (!sessao() || semUnidade()) return;
  const h = new Date().getHours();
  _visao = null;
  if (h !== _ultimaHora) { _ultimaHora = h; render(); }
}

let _relogiosLigados = false;
function iniciarRelogios() {
  if (_relogiosLigados) return;
  _relogiosLigados = true;
  setInterval(tique, 2000);
  setInterval(tiqueLento, 45000);
}

/* chamado quando uma sessão acabou de ser aberta */
async function aoEntrar(migrou) {
  document.body.classList.remove('vista-login');
  S = JSON.parse(JSON.stringify(PADRAO));
  await carregar();
  if (!uni(S.perfil)) S.perfil = 'residencial';
  if (!TELAS[S.tela]) S.tela = 'painel';
  if (S.medidor) { MEDIDOR.ativo = !!S.medidor.ativo; MEDIDOR.endereco = S.medidor.endereco || MEDIDOR.endereco; }
  _visao = null; _cacheLedger.clear();
  render();
  const s = sessao();
  if (semUnidade()) {
    aviso('Conta criada', 'Cadastre sua primeira unidade para o Solaris começar a calcular.', 'good');
    return;
  }
  if (ehVisitante()) {
    aviso('Medidor conectado', nf(visao().mtd.tc) + ' kWh no mês até agora · dados de demonstração.', 'good');
  } else {
    aviso('Bem-vindo, ' + s.nome.split(' ')[0],
      migrou ? 'As unidades que você cadastrou vieram junto.'
        : 'Medidor conectado · ' + nf(visao().mtd.tc) + ' kWh no mês até agora.', 'good');
  }
}

/* ---------- partida ---------- */
async function iniciar() {
  /* a suíte de testes carrega os mesmos scripts sem a casca da página:
     sem #root não há app para subir, só as funções para exercitar */
  if (!$('#root')) return;
  await Banco.iniciar();
  await carregarContas();
  /* A porta de entrada e a tela de login. Quem so quer olhar entra sem
     criar conta, num clique - o botao esta la. */
  if (!carregarSessao()) {
    modoLogin = 'entrar';
    renderLogin();
    iniciarRelogios();
    return;
  }
  await carregar();
  if (S.medidor) { MEDIDOR.ativo = !!S.medidor.ativo; MEDIDOR.endereco = S.medidor.endereco || MEDIDOR.endereco; }
  if (!uni(S.perfil)) S.perfil = 'residencial';
  if (!TELAS[S.tela]) S.tela = 'painel';
  _ultimaHora = new Date().getHours();
  lerHash();
  render();
  iniciarRelogios();
  const v = visao();
  setTimeout(() => {
    aviso('Medidor conectado', 'Lendo ' + unidade().nome + ' em tempo real · ' + nf(v.mtd.tc) + ' kWh no mês até agora.', 'good');
  }, 900);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
