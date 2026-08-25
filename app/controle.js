
/* ============================================================
   SOLARIS — controle, eventos e o tique do medidor
   ============================================================ */
const TELA_ORDEM = NAV.map(n => n.k);
function modoMobile() { return S.vista === 'mobile' || window.innerWidth <= 760; }

function corpoDesktop() {
  let tela = '';
  if (S.tela === 'painel') tela = vPainel();
  else if (S.tela === 'historico') tela = vHistorico();
  else if (S.tela === 'equipamentos') tela = vEquip();
  else if (S.tela === 'cadastro') tela = vCadastro();
  else if (S.tela === 'alertas') tela = vAlertas();
  else if (S.tela === 'relatorio') tela = vRelatorio();
  else tela = vConfig();
  return '<div class="app">' + vRail() + '<main class="main" id="conteudo" tabindex="-1">' + vTopbar() + '<div class="page">' + tela + '</div></main></div>';
}

let _ultimoModo = null;
function render() {
  const root = $('#root');
  const ativo = document.activeElement;
  const fid = ativo && ativo.dataset ? ativo.dataset.fid : null;
  const caret = ativo && ativo.selectionStart != null ? ativo.selectionStart : null;

  const mob = modoMobile();
  root.innerHTML = mob ? vMobile() : corpoDesktop();
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
  atualizarHash();
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
  txt('#metaLbl', modoMobile() ? nf(meta) : nf(meta) + ' kWh');
  txt('#metaCusto', '≈ ' + brl(meta * t));
  const f = $('#metaFill');
  if (f) {
    f.style.width = clamp((v.mtd.tc / meta) * 100, 0, 100) + '%';
    f.style.background = v.projConsumo > meta ? 'var(--bad)' : 'var(--good)';
  }
}
function syncTarifa() { txt('#tarLbl', 'R$ ' + nf(tarifaAtual(), 2) + ' / kWh'); }

/* ---------- ações ---------- */
function irPara(tela) { S.tela = tela; S.detalhe = null; S.salvo = false; salvar(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

const ACOES = {
  nav: el => irPara(el.dataset.tela),
  unit: el => {
    S.perfil = el.dataset.unit; S.detalhe = null; S.salvo = false;
    S.novo.comodo = UNIDADES[S.perfil].comodos[0];
    _visao = null; salvar(); render();
    aviso('Unidade trocada', UNIDADES[S.perfil].nome + ' · ' + UNIDADES[S.perfil].tipo, 'sun');
  },
  periodo: el => { S.periodo = el.dataset.p; salvar(); render(); },
  mobile: () => { S.vista = 'mobile'; S.tab = 'painel'; S.msub = null; salvar(); render(); },
  desktop: () => { S.vista = 'desktop'; S.msub = null; salvar(); render(); },
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
      nome: e.nome, cat: e.cat, comodo: e.local === '—' ? UNIDADES[S.perfil].comodos[0] : e.local,
      pot: Math.round(clamp(e.pot || 1000, 20, 12000)),
      horas: Math.round(clamp(e.horas || 1, 0.1, 24) * 10) / 10,
      dias: Math.round(clamp(e.dias || 30, 1, 31))
    };
    S.salvo = false; S.tela = 'cadastro'; S.msub = 'cadastro';
    salvar(); render();
  },
  'cancelar-edicao': () => {
    S.editando = null; S.salvo = false;
    S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: UNIDADES[S.perfil].comodos[0] };
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
      S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: UNIDADES[S.perfil].comodos[0] };
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
    S.novo = { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: UNIDADES[S.perfil].comodos[0] };
    salvar(); render();
    aviso(campos.nome + ' cadastrado', nf(kwh, 1) + ' kWh por mês · ' + brl(kwh * tarifaAtual()) + ' na conta.', 'good');
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
  imprimir: () => window.print(),
  'reset-tarifa': () => { S.tarifa[S.perfil] = null; salvar(); render(); aviso('Tarifa restaurada', 'Voltou para R$ ' + nf(unidade().tarifa, 2) + ' / kWh da ' + unidade().distribuidora + '.', 'sun'); },
  'reset-tudo': () => {
    if (!window.confirm('Apagar aparelhos cadastrados, metas, tarifa e respostas da IA neste navegador?')) return;
    try { localStorage.removeItem(CHAVE_LS); } catch (e) { }
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
  if (ev.key >= '1' && ev.key <= '7' && !modoMobile()) { irPara(TELA_ORDEM[+ev.key - 1]); return; }
  if (ev.key.toLowerCase() === 'c') { S.vista = S.vista === 'mobile' ? 'desktop' : 'mobile'; S.msub = null; salvar(); render(); }
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
  if (campo === 'endereco') { MEDIDOR.endereco = el.value.trim(); MEDIDOR.ultima = null; salvar(); return; }
  if (campo === 'meta') { S.metas[S.perfil] = Number(el.value); syncMeta(); salvar(); return; }
  if (campo === 'tarifa') { S.tarifa[S.perfil] = Number(el.value) / 100; _visao = null; syncTarifa(); salvar(); return; }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.in) return;
  if (el.type === 'range') { _visao = null; render(); }
});

/* ---------- hash ---------- */
function hashAtual() {
  return S.vista === 'mobile'
    ? '#/celular/' + S.tab + (S.msub ? '/' + S.msub : '')
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
  if (p[0] === 'celular') {
    const tab = p[1] || 'painel', sub = p[2] || null;
    if (S.vista === 'mobile' && S.tab === tab && S.msub === sub) return;
    S.vista = 'mobile'; S.tab = tab; S.msub = sub;
  } else if (TELAS[p[0]]) {
    if (S.vista === 'desktop' && S.tela === p[0]) return;
    S.vista = 'desktop'; S.tela = p[0];
  } else return;
  salvar(); render();
}
window.addEventListener('hashchange', lerHash);
window.addEventListener('resize', () => { if (modoMobile() !== _ultimoModo) render(); });

/* ---------- o tique ---------- */
let _spikeCooldown = 0, _spikeAtivo = false;
function tique() {
  pulso();
  buscarMedidor();
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
let _ultimaHora = -1;
function tiqueLento() {
  const h = new Date().getHours();
  _visao = null;
  if (h !== _ultimaHora) { _ultimaHora = h; render(); }
}

/* ---------- partida ---------- */
function iniciar() {
  /* a suíte de testes carrega os mesmos scripts sem a casca da página:
     sem #root não há app para subir, só as funções para exercitar */
  if (!$('#root')) return;
  carregar();
  if (S.medidor) { MEDIDOR.ativo = !!S.medidor.ativo; MEDIDOR.endereco = S.medidor.endereco || MEDIDOR.endereco; }
  if (!UNIDADES[S.perfil]) S.perfil = 'residencial';
  if (!TELAS[S.tela]) S.tela = 'painel';
  _ultimaHora = new Date().getHours();
  lerHash();
  render();
  setInterval(tique, 2000);
  setInterval(tiqueLento, 45000);
  const v = visao();
  setTimeout(() => {
    aviso('Medidor conectado', 'Lendo ' + unidade().nome + ' em tempo real · ' + nf(v.mtd.tc) + ' kWh no mês até agora.', 'good');
  }, 900);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
