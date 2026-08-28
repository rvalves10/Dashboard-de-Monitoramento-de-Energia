/* telas.js — as telas da versao ampla

   Cada tela e uma funcao que devolve HTML como texto. Nada de framework:
   monta a string, joga no innerHTML e pronto. Para o tamanho deste projeto
   isso e mais simples de ler e nao precisa de build.

   As telas:
     vPainel      o resumo: economia, autossuficiencia, curva do dia, conta
     vHistorico   comparativo por dia, semana ou mes
     vEquip       ranking de aparelhos e o detalhe de cada um
     vCadastro    formulario de aparelho novo
     vAlertas     meta do mes, regras de aviso e o que aconteceu
     vRelatorio   a fatura detalhada, feita para imprimir
     vConfig      tarifa, dados da unidade, fonte da leitura e banco
     vUnidade     cadastrar a sua propria casa ou comercio

   Os botoes nao tem onclick. Eles levam um data-act, e o controle.js
   escuta o clique num lugar so. Assim redesenhar a tela nao perde evento.
*/
'use strict';

const IC = {
  painel: 'M3 13a9 9 0 0 1 18 0M12 13l4.5-4.5',
  historico: 'M4 19V11M9 19V5M14 19v-6M19 19V8',
  aparelhos: 'M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0zM12 18v3',
  mais: 'M12 5v14M5 12h14',
  sino: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0',
  papel: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M7 15v4',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M23 12h-3M4 12H1M19.1 4.9l-2.1 2.1M7 17l-2.1 2.1M19.1 19.1L17 17M7 7L4.9 4.9',
  raio: 'M13 2L3 14h7l-1 8 10-12h-7z',
  folha: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6',
  troca: 'M3 12h18M12 3v18M7 7l10 10',
  faisca: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  seta: 'M5 12h14M13 6l6 6-6 6',
  cima: 'M5 15l7-7 7 7',
  check: 'M20 6L9 17l-5-5',
  x: 'M6 6l12 12M18 6L6 18',
  lupa: 'M20 20l-3.5-3.5',
  print: 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z',
  celular: 'M11 18.5h2',
  desktop: 'M8 21h8',
  volta: 'M15 6l-6 6 6 6',
  chevron: 'M9 6l6 6-6 6',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  lapis: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM14 6l4 4'
};
function ico(d, sz, cor, sw) {
  return '<svg width="' + (sz || 16) + '" height="' + (sz || 16) + '" viewBox="0 0 24 24" fill="none" stroke="' + (cor || 'currentColor') + '" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
}
const CONF = {
  alta: { bg: 'var(--good-bg)', cor: 'var(--good)', txt: 'Certeza alta' },
  'média': { bg: 'var(--warn-bg)', cor: 'var(--warn)', txt: 'Certeza média' },
  baixa: { bg: 'var(--ground)', cor: 'var(--faint)', txt: 'Certeza baixa' }
};
const TELAS = {
  painel: ['', 'Painel'], historico: ['Comparativos', 'Histórico'],
  equipamentos: ['Desagregação por IA', 'Seus aparelhos'], cadastro: ['Novo aparelho', 'Cadastrar consumo'],
  alertas: ['Regras e limites', 'Alertas e metas'], relatorio: ['Fechamento do mês', 'Relatório mensal'],
  config: ['Unidade e tarifa', 'Configurações'],
  unidade: ['Nova unidade', 'Cadastrar unidade']
};
const NAV = [
  { k: 'painel', label: 'Painel', icon: IC.painel },
  { k: 'historico', label: 'Histórico', icon: IC.historico },
  { k: 'equipamentos', label: 'Aparelhos', icon: IC.aparelhos },
  { k: 'cadastro', label: 'Cadastrar', icon: IC.mais },
  { k: 'alertas', label: 'Alertas e metas', icon: IC.sino },
  { k: 'relatorio', label: 'Relatório', icon: IC.papel },
  { k: 'config', label: 'Configurações', icon: IC.ajustes }
];
const PRESETS = [
  { nome: 'Ar-condicionado 12.000 BTU', pot: 1200, horas: 5, cat: 'Climatização' },
  { nome: 'Chuveiro elétrico', pot: 5500, horas: 0.6, cat: 'Aquecimento' },
  { nome: 'Geladeira frost free', pot: 180, horas: 8.9, cat: 'Refrigeração' },
  { nome: 'Máquina de lavar', pot: 900, horas: 0.9, cat: 'Lavanderia' },
  { nome: 'Micro-ondas', pot: 1400, horas: 0.4, cat: 'Cozinha' },
  { nome: 'Computador e monitor', pot: 190, horas: 8, cat: 'Eletrônicos' }
];

/* ---------- casca desktop ---------- */
function vRail() {
  const pend = deteccoesPendentes().length;
  const graves = alertasGraves();
  const p = potenciaAgora();
  const nav = NAV.map(n => {
    const at = S.tela === n.k;
    const n_ = n.k === 'equipamentos' ? pend : n.k === 'alertas' ? graves : 0;
    return '<button class="nav-item" data-act="nav" data-tela="' + n.k + '"' + (at ? ' aria-current="page"' : '') + '>' +
      ico(n.icon, 18, 'currentColor', 1.7) +
      '<span class="nav-label">' + n.label + '</span>' +
      (n_ ? '<span class="badge">' + n_ + '<span class="sr"> pendências</span></span>' : '') +
      '</button>';
  }).join('');
  const units = chavesUnidades().map(k => {
    const u = uni(k);
    return '<button class="unit" data-act="unit" data-unit="' + k + '" aria-pressed="' + (S.perfil === k) + '">' +
      '<span class="unit-dot"></span><span style="min-width:0"><span class="unit-name" style="display:block">' + esc(u.nome) + '</span>' +
      '<span class="unit-type" style="display:block">' + esc(u.curto) + '</span></span></button>';
  }).join('');
  return '<aside class="rail">' +
    '<div class="brand"><span class="brand-mark">' + ico(IC.sol, 19, '#16150F', 2.2) + '</span>' +
    '<span class="brand-text"><span class="brand-name" style="display:block">Solaris</span><span class="brand-sub" style="display:block">Energia sob controle</span></span></div>' +
    '<nav class="nav" aria-label="Seções">' + nav + '</nav>' +
    '<div class="rail-spacer"></div>' +
    '<div class="rail-foot">' +
    '<div class="meter"><div class="meter-head"><span class="live-dot"></span><span class="meter-lbl">Medidor agora</span></div>' +
    '<div class="meter-rows">' +
    '<div class="meter-row"><span>Consumindo</span><span class="meter-val" id="liveC">' + nf(p.cons, 2) + ' kW</span></div>' +
    '<div class="meter-row"><span>Gerando</span><span class="meter-val" id="liveG">' + nf(p.ger, 2) + ' kW</span></div>' +
    '</div><div class="meter-bar"><span id="liveBar" style="width:' + clamp((p.ger / Math.max(p.cons, .001)) * 100, 0, 100) + '%"></span></div>' +
    '<div class="meter-note" id="liveNote">' + textoMedidor(p) + '</div></div>' +
    cardConta() +
    '<div class="unitbox"><div class="unitbox-title">Unidade</div><div style="display:flex;flex-direction:column;gap:4px">' + units +
    '<button class="unit unit--nova" data-act="nav" data-tela="unidade">' + ico(IC.mais, 13, 'currentColor', 2.4) +
    '<span class="unit-name">Nova unidade</span></button></div></div>' +
    '</div></aside>';
}
function cardConta() {
  const s = sessao();
  if (!s) return '';
  const inicial = (s.nome || '?').trim().charAt(0).toUpperCase();
  if (ehVisitante()) {
    return '<button class="conta conta--entrar" data-act="auth-abrir">' +
      '<span class="conta-av conta-av--vis">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>' +
      '<span class="conta-txt"><span class="conta-nome">Entrar</span>' +
      '<span class="conta-mail">Opcional · salvar em conta própria</span></span>' +
      '</button>';
  }
  return '<div class="conta">' +
    '<span class="conta-av">' + esc(inicial) + '</span>' +
    '<span class="conta-txt"><span class="conta-nome">' + esc(s.nome) + '</span>' +
    '<span class="conta-mail">' + esc(s.email) + '</span></span>' +
    '<button class="conta-sair" data-act="sair" title="Sair da conta" aria-label="Sair da conta">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button>' +
    '</div>';
}

function textoMedidor(p) {
  if (p.ger <= 0.02) return 'Painéis dormindo. Tudo vem da rede.';
  if (p.inj > 0.05) return 'Sobrando ' + nf(p.inj, 2) + ' kW para a rede — virando crédito.';
  return 'O sol cobre ' + pct((p.ger / Math.max(p.cons, .001)) * 100) + ' do que a casa puxa agora.';
}

function vTopbar() {
  const v = visao();
  const t = TELAS[S.tela];
  const kicker = S.tela === 'painel'
    ? MESES[v.m].charAt(0).toUpperCase() + MESES[v.m].slice(1) + ' de ' + v.y + ' · dia ' + v.data.getDate() + ' de ' + v.nd
    : t[0];
  const titulo = S.tela === 'painel' ? saudacao() : t[1];
  const mostraPeriodo = S.tela === 'historico';
  const per = [['dia', 'Dia', 'D'], ['semana', 'Semana', 'S'], ['mes', 'Mês', 'M']].map(p =>
    '<button data-act="periodo" data-p="' + p[0] + '" aria-pressed="' + (S.periodo === p[0]) + '"><span class="full">' + p[1] + '</span><span class="short">' + p[2] + '</span></button>').join('');
  return '<header class="topbar no-print"><div><div class="eyebrow">' + esc(kicker) + '</div><h1>' + esc(titulo) + '</h1></div>' +
    '<div class="topbar-actions">' +
    (mostraPeriodo ? '<div class="seg" role="group" aria-label="Período">' + per + '</div>' : '') +
    '</div></header>';
}

/* ---------- painel ---------- */
function vPainel() {
  const v = visao(), u = unidade(), t = tarifaAtual(), eq = aparelhos();
  const dEcon = v.anteriorEcon > 0 ? ((v.economiaCheia - v.anteriorEcon) / v.anteriorEcon) * 100 : 0;
  const meses = v.ledger.linhas.slice(-12);
  const maxE = Math.max.apply(null, meses.map(l => l.economia)) || 1;
  const spark = meses.map((l, i) => {
    const ehAgora = i === meses.length - 1;
    return '<div class="spark-col' + (ehAgora ? ' is-now' : '') + '" title="' + MES3[l.m] + ': ' + brl(l.economia) + '">' +
      '<span class="spark-bar" style="height:' + Math.round((l.economia / maxE) * 52 + 6) + 'px"></span>' +
      '<span class="spark-lbl">' + MES3[l.m] + '</span></div>';
  }).join('');

  const diasGratis = Math.round(v.economia / Math.max(t * (v.projConsumo / v.nd), .01));
  const hero = '<section class="card card--dark hero s7"><span class="hero-glow"></span><div class="hero-in">' +
    '<div class="hero-top"><span class="hero-kicker">Você economizou em ' + MESES[v.m] + '</span>' +
    '<span class="delta' + (dEcon < 0 ? ' delta--down' : '') + '">' + ico(IC.cima, 12, 'currentColor', 2.6) + sinal(dEcon, 0) + '%</span></div>' +
    '<div class="hero-money"><span class="hero-cur">R$</span><span class="big big-74" id="heroEcon">' + nf(v.economia) + '</span></div>' +
    '<p class="hero-line">Equivale a ' + diasGratis + ' dias de energia de graça. Seu telhado cobriu ' + pct(v.autoPct) + ' de tudo que a unidade gastou até agora — e o mês deve fechar em ' + brl(v.economiaCheia) + '.</p>' +
    '<div class="spark">' + spark + '</div></div></section>';

  const dash = Math.round((clamp(v.autoPct, 0, 100) / 100) * 351.8);
  const donut = '<section class="card s5"><div class="eyebrow" style="font-size:12px">Autossuficiência</div>' +
    '<div class="donut-wrap"><div class="donut">' +
    /* decorativo: a porcentagem aparece em texto logo abaixo, entao o
       leitor de tela nao precisa atravessar o desenho */
    '<svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">' +
    '<circle cx="66" cy="66" r="56" fill="none" stroke="#EFEBE1" stroke-width="15"/>' +
    '<circle class="donut-ring" cx="66" cy="66" r="56" fill="none" stroke="var(--sun)" stroke-width="15" stroke-linecap="round" stroke-dasharray="' + dash + ' 351.8"/></svg>' +
    '<div class="donut-mid"><span class="donut-pct">' + pct(v.autoPct) + '</span><span class="donut-cap">do consumo</span></div></div>' +
    '<div class="split">' +
    linhaSplit('var(--sun)', 'Sol direto', nf(v.mtd.auto, 1) + ' kWh') +
    linhaSplit('var(--grid)', 'Da rede', nf(v.mtd.rede, 1) + ' kWh') +
    linhaSplit('var(--good-soft)', 'Injetado', nf(v.mtd.inj, 1) + ' kWh') +
    '</div></div></section>';

  const kpis = [
    { l: 'Consumo do mês', v: nf(v.mtd.tc), un: 'kWh', cor: 'var(--grid)', ic: IC.raio, n: 'Média de ' + nf(v.mtd.tc / Math.max(v.mtd.dias, .1), 1) + ' kWh por dia' },
    { l: 'Geração solar', v: nf(v.mtd.tg), un: 'kWh', cor: 'var(--sun)', ic: IC.sol, n: u.paineis + ' painéis · ' + nf(u.potenciaKwp, 1) + ' kWp instalados' },
    { l: 'CO₂ evitado', v: nf(v.co2, 1), un: 'kg', cor: 'var(--good)', ic: IC.folha, n: 'Como ' + nf(v.co2 / 0.12) + ' km de carro não rodados' },
    { l: 'Créditos na rede', v: nf(v.creditos), un: 'kWh', cor: 'var(--violet)', ic: IC.troca, n: 'Válidos por 60 meses · ' + esc(u.distribuidora) }
  ].map(k => '<section class="card card--tight s3"><div class="kpi-top">' + ico(k.ic, 15, k.cor, 1.9) + '<span class="kpi-lbl">' + k.l + '</span></div>' +
    '<div class="kpi-val"><span class="big big-32">' + k.v + '</span><span class="kpi-unit">' + k.un + '</span></div>' +
    '<div class="kpi-note">' + k.n + '</div></section>').join('');

  const dia = v.md.dias[v.data.getDate() - 1];
  const curva = graficoDia(dia, v);

  const somaTop = soma(eq.map(e => e.kwh)) || 1;
  const mix = eq.slice(0, 6).map(e => '<i style="width:' + (e.kwh / somaTop) * 100 + '%;background:' + e.cor + '" title="' + esc(e.nome) + ': ' + pct((e.kwh / somaTop) * 100) + '"></i>').join('');
  const top = eq.slice(0, 5).map(e => '<button class="toprow" data-act="eq-abrir" data-id="' + e.id + '">' +
    '<span class="toprow-bar" style="background:' + e.cor + '"></span>' +
    '<span style="flex:1;min-width:0"><span class="toprow-name" style="display:block">' + esc(e.nome) + '</span>' +
    '<span class="toprow-sub" style="display:block">' + pct((e.kwh / somaTop) * 100) + ' do total · ' + esc(e.local) + '</span></span>' +
    '<span style="text-align:right"><span class="toprow-num" style="display:block">' + nf(e.kwh) + ' kWh</span>' +
    '<span class="toprow-cash" style="display:block">' + brl(e.reais) + '</span></span></button>').join('');

  const desagreg = '<section class="card s7"><div style="display:flex;align-items:center;gap:9px">' +
    '<h2>Para onde vai sua energia</h2><span class="pill--ia">' + ico(IC.faisca, 10, 'currentColor', 2.4) + 'IA</span></div>' +
    '<div class="card-sub">Estimado pelo padrão do medidor, sem sensor em cada tomada</div>' +
    '<div class="mixbar">' + mix + '</div><div class="toplist">' + top + '</div>' +
    '<button class="link-btn" style="margin:12px 0 0 10px" data-act="nav" data-tela="equipamentos">Ver todos os ' + eq.length + ' aparelhos' + ico(IC.seta, 13, 'currentColor', 2.4) + '</button></section>';

  const fech = new Date(v.y, v.m + 1, 12);
  const conta = '<section class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
    '<span class="eyebrow" style="font-size:12px">Próxima conta</span><span class="pill pill--warn">Bandeira amarela</span></div>' +
    '<div style="display:flex;align-items:baseline;gap:8px;margin-top:10px"><span class="big big-40">' + brl(v.contaProj) + '</span>' +
    '<span style="font-size:13px;color:var(--faint)">estimado · fecha ' + fech.getDate() + ' de ' + MESES[fech.getMonth()] + '</span></div>' +
    '<hr class="rule">' +
    '<div style="display:flex;flex-direction:column;gap:9px">' +
    linhaConta('Energia da rede (' + nf(v.projRede) + ' kWh)', brl(v.projRede * t), 'var(--ink)') +
    linhaConta('Bandeira + iluminação pública', brl(v.projRede * 0.0189 + u.ilum), 'var(--ink)') +
    linhaConta('Abatido por créditos solares', '− ' + brl(v.projUsado * t), 'var(--good)') +
    '</div></section>';

  const mesesPay = v.economiaTotal > 0 ? Math.round(u.investimento / (v.economiaTotal / u.mesesOperacao)) : 0;
  const pbPct = clamp((v.economiaTotal / u.investimento) * 100, 0, 100);
  const payback = '<section class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
    '<span class="eyebrow" style="font-size:12px">Retorno do investimento</span>' +
    '<span class="mono" style="font-size:12px;color:var(--good);font-weight:500">' + pct(pbPct) + ' pago</span></div>' +
    '<div style="height:9px;background:var(--ground);border-radius:6px;margin-top:13px;overflow:hidden">' +
    '<div style="height:100%;border-radius:6px;background:linear-gradient(90deg,var(--sun),var(--good));width:' + pbPct + '%;transition:width .8s cubic-bezier(.4,0,.2,1)"></div></div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:var(--faint)">' +
    '<span>' + u.mesesOperacao + ' meses · ' + brl(v.economiaTotal) + ' economizados</span>' +
    '<span>faltam ' + nf(Math.max(0, mesesPay - u.mesesOperacao) / 12, 1) + ' anos</span></div></section>';

  return '<div class="grid12 enter">' + hero + donut + kpis + curva + desagreg +
    '<div class="s5 stack">' + conta + payback + '</div></div>';
}
function linhaSplit(cor, lbl, val) {
  return '<div><div class="split-row-top"><span class="split-dot" style="background:' + cor + '"></span><span class="split-lbl">' + lbl + '</span></div><div class="split-val">' + val + '</div></div>';
}
function linhaConta(l, v, cor) {
  return '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px"><span style="color:var(--muted)">' + l + '</span><span class="mono" style="font-weight:500;color:' + cor + '">' + v + '</span></div>';
}

function graficoDia(dia, v) {
  const max = Math.max(Math.max.apply(null, dia.cons), Math.max.apply(null, dia.ger)) * 1.15 || 1;
  const W = 720, H = 200;
  const grade = [0, 1, 2, 3].map(i => '<g><line x1="0" y1="' + i * 50 + '" x2="720" y2="' + i * 50 + '" stroke="#EFEBE1" stroke-width="1"/>' +
    '<text x="0" y="' + (i * 50 + 12) + '" fill="#A9A395" font-size="10" font-family="IBM Plex Mono, monospace">' + nf(max * (1 - i / 4), 1) + ' kW</text></g>').join('');
  const nowX = (v.hDec - (v.data.getDate() - 1) * 24) / 23 * W;
  const hr = Math.min(23, Math.floor(v.hDec - (v.data.getDate() - 1) * 24));
  const nowY = H - (dia.ger[hr] / max) * H;
  const eixo = ['00h', '04h', '08h', '12h', '16h', '20h', '23h'].map(t => '<span>' + t + '</span>').join('');
  return '<section class="card s12"><div class="card-head"><div><h2>Hoje, hora a hora</h2>' +
    '<div class="card-sub">Onde o sol cobre e onde a rede entra · a linha pontilhada vertical é agora</div></div>' +
    '<div class="legend"><span><i class="swatch" style="background:var(--sun)"></i>Geração solar</span>' +
    '<span><i class="swatch" style="background:var(--grid)"></i>Consumo</span></div></div>' +
    '<div class="chart" id="chartDia" data-max="' + max + '" tabindex="0" role="img" ' +
    'aria-label="Curva de hoje. Geração máxima ' + nf(Math.max.apply(null, dia.ger), 2) + ' quilowatts por volta das ' +
    dia.ger.indexOf(Math.max.apply(null, dia.ger)) + ' horas. Consumo máximo ' + nf(Math.max.apply(null, dia.cons), 2) +
    ' quilowatts por volta das ' + dia.cons.indexOf(Math.max.apply(null, dia.cons)) + ' horas. ' +
    'Use as setas para percorrer hora a hora.">' +
    '<svg viewBox="0 0 720 215" aria-hidden="true">' +
    '<defs><linearGradient id="gSol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EDA22B" stop-opacity="0.28"/><stop offset="100%" stop-color="#EDA22B" stop-opacity="0"/></linearGradient></defs>' +
    grade +
    '<path d="' + caminho(dia.ger, max, W, H, true) + '" fill="url(#gSol)"/>' +
    '<path d="' + caminho(dia.ger, max, W, H) + '" fill="none" stroke="#EDA22B" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="' + caminho(dia.cons, max, W, H) + '" fill="none" stroke="#3E4C7A" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4"/>' +
    '<line class="now-line" x1="' + nowX.toFixed(1) + '" y1="0" x2="' + nowX.toFixed(1) + '" y2="' + H + '"/>' +
    '<circle class="now-dot" cx="' + nowX.toFixed(1) + '" cy="' + nowY.toFixed(1) + '" r="4.5" fill="#EDA22B" stroke="#EFEBE1" stroke-width="2"/>' +
    '</svg><div class="tip" id="tipDia"></div></div>' +
    '<div class="chart-axis">' + eixo + '</div></section>';
}

/* ---------- histórico ---------- */
function vHistorico() {
  const v = visao(), t = tarifaAtual(), s = seriePeriodo();
  const max = Math.max(Math.max.apply(null, s.cons), Math.max.apply(null, s.ger)) * 1.08 || 1;
  const tC = soma(s.cons), tG = soma(s.ger);
  const aC = s.anterior.c || 1, aG = s.anterior.g || 1;
  const dC = ((tC - aC) / aC) * 100, dG = ((tG - aG) / aG) * 100;
  const saldos = s.cons.map((c, i) => s.ger[i] - c);
  let iM = 0, iP = 0;
  saldos.forEach((x, i) => { if (x > saldos[iM]) iM = i; if (x < saldos[iP]) iP = i; });
  const cobertos = saldos.filter(x => x >= 0).length;

  const barras = s.cons.map((c, i) => '<div class="hbar" data-i="' + i + '">' +
    '<span class="hbar-pair"><i class="hbar-c" style="height:' + Math.max(1, (c / max) * 150) + 'px"></i>' +
    '<i class="hbar-g" style="height:' + Math.max(1, (s.ger[i] / max) * 150) + 'px"></i></span>' +
    '<span class="hbar-saldo" style="background:' + (saldos[i] >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)') + '"></span>' +
    '<span class="hbar-lbl">' + s.labels[i] + '</span></div>').join('');

  const tiles = [
    ['Consumo no período', nf(tC, 1), 'kWh', '<span style="color:' + (dC <= 0 ? 'var(--good)' : 'var(--bad)') + '">' + sinal(dC, 1) + '% vs período anterior</span>'],
    ['Geração no período', nf(tG, 1), 'kWh', '<span style="color:' + (dG >= 0 ? 'var(--good)' : 'var(--bad)') + '">' + sinal(dG, 1) + '% vs período anterior</span>'],
    ['Saldo', sinal(tG - tC, 1), 'kWh', 'Sobra da geração sobre o consumo'],
    ['Energia puxada da rede', nf(s.rede, 1), 'kWh', 'Custa ' + brl(s.rede * t) + ' — só o que o sol não cobriu']
  ].map(x => '<section class="card card--tight s3"><div class="kpi-lbl">' + x[0] + '</div>' +
    '<div class="kpi-val"><span class="big big-30">' + x[1] + '</span>' + (x[2] ? '<span class="kpi-unit">' + x[2] + '</span>' : '') + '</div>' +
    '<div style="font-size:12px;margin-top:7px;color:var(--faint);font-weight:500">' + x[3] + '</div></section>').join('');

  const cmp = '<section class="card s7"><h2>Comparado com o período anterior</h2>' +
    '<div style="display:flex;flex-direction:column;gap:18px;margin-top:20px">' +
    blocoCmp('Consumo agora', nf(tC, 1) + ' kWh', tC, aC, 'var(--grid)') +
    '<div style="height:1px;background:var(--ground)"></div>' +
    blocoCmp('Geração agora', nf(tG, 1) + ' kWh', tG, aG, 'var(--sun)') +
    '</div></section>';

  const dest = '<section class="card s5" style="display:flex;flex-direction:column;gap:16px"><h2>Destaques</h2>' +
    notaBox('good', 'Melhor: ' + s.nomes[iM], sinal(saldos[iM], 1) + ' kWh de sobra') +
    notaBox('bad', 'Mais dependente da rede: ' + s.nomes[iP], nf(Math.abs(saldos[iP]), 1) + ' kWh puxados da rede') +
    notaBox('sun', cobertos + ' de ' + saldos.length + ' ' + (s.unidade === 'dia' ? 'dias' : 'horas') + ' com saldo positivo',
      'Em ' + pct((cobertos / saldos.length) * 100) + ' do período o sol deu conta sozinho') +
    '</section>';

  return '<div class="grid12 enter"><section class="card s12"><div class="card-head"><div><h2>' + esc(s.rotulo) + '</h2>' +
    '<div class="card-sub">A faixa fina embaixo mostra se o sol cobriu o gasto daquele ' + s.unidade + '</div></div>' +
    '<div class="legend"><span><i class="swatch swatch--sq" style="background:var(--grid)"></i>Consumo</span>' +
    '<span><i class="swatch swatch--sq" style="background:var(--sun)"></i>Geração</span></div></div>' +
    '<div class="chart" style="margin-top:0">' +
    '<div class="hbars" id="hbars" tabindex="0" role="img" aria-label="' + esc(s.rotulo) +
    '. Consumo total ' + nf(tC, 1) + ' quilowatt-hora, geração ' + nf(tG, 1) +
    '. Use as setas para percorrer cada ' + s.unidade + '.">' + barras + '</div>' +
    '<div class="tip" id="tipHist"></div></div>' +
    '</section>' + tiles + cmp + dest + '</div>';
}
function blocoCmp(lbl, val, atual, ant, cor) {
  const m = Math.max(atual, ant) || 1;
  return '<div><div class="compare-lbl"><span>' + lbl + '</span><span class="mono" style="color:var(--ink)">' + val + '</span></div>' +
    '<div class="track"><i style="width:' + (atual / m) * 100 + '%;background:' + cor + '"></i></div>' +
    '<div class="compare-lbl" style="margin:9px 0 7px;color:var(--fainter)"><span>Período anterior</span><span class="mono">' + nf(ant, 1) + ' kWh</span></div>' +
    '<div class="track"><i style="width:' + (ant / m) * 100 + '%;background:#C9C2B2"></i></div></div>';
}
function notaBox(tipo, t, s) {
  return '<div class="note note--' + tipo + '"><span class="note-dot"></span><div><div class="note-t">' + esc(t) + '</div><div class="note-s">' + esc(s) + '</div></div></div>';
}

/* ---------- aparelhos ---------- */
function vEquip() {
  const v = visao(), t = tarifaAtual(), eq = aparelhos();
  const pend = deteccoesPendentes();
  const total = soma(eq.map(e => e.kwh)) || 1;
  const maxK = eq[0] ? eq[0].kwh : 1;

  const det = pend.map(x => '<div class="detect"><span class="detect-ic">' + ico(IC.faisca, 17, '#F5C25B', 2) + '</span>' +
    '<div style="flex:1;min-width:200px"><div class="detect-t">Um aparelho novo apareceu no medidor — é ' + esc(x.palpite) + '?</div>' +
    '<div class="detect-s">Primeiro registro ' + esc(x.quando) + ' · ' + nf(x.kwh, 1) + ' kWh nesse uso · ' + x.certeza + '% de certeza</div></div>' +
    '<div class="detect-btns"><button class="btn-no" data-act="det-nao" data-id="' + x.id + '">Não é</button>' +
    '<button class="btn-yes" data-act="det-sim" data-id="' + x.id + '">Confirmar</button></div></div>').join('');

  const linhas = eq.map((e, i) => {
    const aberto = S.detalhe === e.id;
    const c = CONF[e.conf] || CONF.baixa;
    return '<div class="eq-row" role="button" tabindex="0" data-act="eq-abrir" data-id="' + e.id + '" aria-expanded="' + aberto + '">' +
      '<span class="eq-pos eq-hide">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span style="min-width:0"><span class="eq-name"><b title="' + esc(e.nome) + '">' + esc(e.nome) + '</b>' +
      '<span class="pill" style="background:' + c.bg + ';color:' + c.cor + ';font-size:10.5px;padding:3px 8px">' + c.txt + '</span></span>' +
      '<span class="eq-meta" style="display:block">' + esc(e.local) + ' · ' + (e.fonte === 'ia' ? 'Detectado por IA' : 'Cadastrado por você') + '</span></span>' +
      '<span class="eq-hide"><span class="eq-track"><i style="width:' + (e.kwh / maxK) * 100 + '%;background:' + e.cor + '"></i></span>' +
      '<span class="eq-pct" style="display:block">' + pct((e.kwh / total) * 100) + '</span></span>' +
      '<span style="text-align:right"><span class="eq-kwh" style="display:block">' + nf(e.kwh) + ' kWh</span>' +
      '<span class="eq-cash" style="display:block">' + brl(e.reais) + '</span></span>' +
      '<span style="text-align:right"><span class="eq-trend" style="color:' + (e.tend > 0 ? 'var(--bad)' : e.tend < 0 ? 'var(--good)' : 'var(--faint)') + '">' + (e.tend > 0 ? '+' : '') + e.tend + '%</span></span>' +
      (e.sintetico ? '<span></span>' : '<button class="eq-kill" data-act="eq-remover" data-id="' + e.id + '" title="Remover ' + esc(e.nome) + '" aria-label="Remover ' + esc(e.nome) + '">' + ico(IC.lixo, 15, 'currentColor', 1.8) + '</button>') +
      '</div>';
  }).join('');

  const lista = '<section class="card s8" style="padding:20px 16px 18px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 12px 14px;flex-wrap:wrap">' +
    '<div><h2>Ranking de consumo</h2><div class="card-sub">Clique em um aparelho para ver o detalhe</div></div>' +
    '<button class="dark-btn" data-act="nav" data-tela="cadastro">' + ico(IC.mais, 13, 'currentColor', 2.6) + 'Cadastrar</button></div>' +
    '<div class="eq-head"><span class="eq-hide">#</span><span>Aparelho</span><span class="eq-hide">Participação</span>' +
    '<span style="text-align:right">Consumo</span><span style="text-align:right">Variação</span><span></span></div>' +
    '<div class="eq-list">' + linhas + '</div></section>';

  const alvo = eq.filter(e => e.id === S.detalhe)[0];
  const painel = '<div class="s4 det-sticky" style="position:sticky;top:104px">' + (alvo ? cardDetalhe(alvo, total, t) : cardVazio()) + '</div>';

  const excedeu = extrasExcedem();
  const alertaExcesso = excedeu > 0
    ? '<div class="feed-item feed-item--medio"><span class="feed-dot"></span><div>' +
    '<div class="feed-t"><b>Os aparelhos que você cadastrou somam mais do que o medidor registra</b></div>' +
    '<div class="feed-x">Sobram ' + nf(excedeu) + ' kWh sem lastro na leitura do mês, então as estimativas da IA ficaram zeradas. ' +
    'Revise as horas de uso ou remova o que estiver duplicado com algo que a IA já detecta.</div></div></div>'
    : '';

  return '<div class="stack enter">' + (det ? '<div class="stack">' + det + '</div>' : '') + alertaExcesso +
    '<div class="grid12">' + lista + painel + '</div></div>';
}
function cardVazio() {
  return '<section class="empty">' +
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B9B2A2" stroke-width="1.6" stroke-linecap="round" style="margin:0 auto"><circle cx="11" cy="11" r="7"/><path d="' + IC.lupa + '"/></svg>' +
    '<div class="empty-t">Escolha um aparelho</div>' +
    '<div class="empty-s">O detalhe mostra o horário de pico, quanto pesa no ano e o que dá para fazer a respeito.</div></section>';
}
function cardDetalhe(e, total, t) {
  const u = unidade();
  const perfil = perfilCat(u, e.cat);
  const maxP = Math.max.apply(null, perfil) || 1;
  const iPico = perfil.indexOf(maxP);
  const barras = perfil.map(p => '<i style="background:' + e.cor + ';opacity:' + (0.32 + 0.68 * (p / maxP)).toFixed(2) + ';height:' + Math.max(2, (p / maxP) * 54) + 'px"></i>').join('');
  const dicas = [];
  if (e.horas >= 3) dicas.push(['Uma hora a menos por dia', 'economiza ' + brl((e.pot / 1000) * 30 * t) + ' por mês']);
  if (e.cat === 'Refrigeração') dicas.push(['Limpar a serpentina a cada 6 meses', 'corta até 15% do consumo deste aparelho']);
  if (e.cat === 'Climatização') dicas.push(['Subir o termostato em 2 °C', 'reduz cerca de 12% sem perder conforto']);
  if (e.cat === 'Aquecimento') dicas.push(['Trocar para a posição verão', 'derruba a potência quase pela metade']);
  if (iPico >= 9 && iPico <= 15) dicas.push(['O pico cai dentro da geração', 'esse aparelho já roda quase todo no sol — mantenha assim']);
  if (!dicas.length) dicas.push(['Concentrar o uso entre 10h e 15h', 'aproveita o sol em vez da rede']);

  return '<section class="card"><div class="det-head"><span class="det-chip" style="background:' + e.cor + '"></span>' +
    '<div style="flex:1;min-width:0"><div class="det-name">' + esc(e.nome) + '</div>' +
    '<div class="det-loc">' + esc(e.local) + ' · ' + esc(e.cat) + '</div></div>' +
    '<button class="det-x" data-act="det-fechar" aria-label="Fechar detalhe">' + ico(IC.x, 16, 'currentColor', 2.2) + '</button></div>' +
    (e.sintetico ? '' : '<button class="link-btn" style="margin-top:14px" data-act="eq-editar" data-id="' + e.id + '">' +
      ico(IC.lapis, 13, 'currentColor', 2) + (e.fonte === 'ia' ? 'Corrigir a estimativa da IA' : 'Editar este aparelho') + '</button>') +
    '<div style="display:flex;align-items:baseline;gap:8px;margin-top:18px"><span class="big big-34">' + brl(e.reais) + '</span>' +
    '<span style="font-size:13px;color:var(--faint)">por mês · ' + nf(e.kwh) + ' kWh</span></div>' +
    '<div style="font-size:12.5px;color:var(--faint);margin-top:5px">' + pct((e.kwh / total) * 100) + ' da unidade · ' + brl(e.reais * 12) + ' por ano</div>' +
    '<div class="det-facts"><div class="fact"><div class="fact-k">Potência</div><div class="fact-v">' + (e.pot ? nf(e.pot) + ' W' : '—') + '</div></div>' +
    '<div class="fact"><div class="fact-k">Uso estimado</div><div class="fact-v">' + (e.horas ? nf(e.horas, 1) + ' h/dia' : '—') + '</div></div></div>' +
    '<div class="eyebrow-sm" style="margin:20px 0 9px">Perfil de uso nas 24 horas</div>' +
    '<div class="prof">' + barras + '</div>' +
    '<div style="font-size:12px;color:var(--faint);margin-top:8px">Uso concentrado por volta das ' + String(iPico).padStart(2, '0') + 'h</div>' +
    '<hr class="rule" style="margin:18px 0 14px">' +
    '<div class="tips">' + dicas.map(d => '<div class="tip-row">' + ico(IC.check, 15, 'var(--good)', 2.2) +
      '<div class="tip-txt"><b>' + d[0] + '</b> <span>' + d[1] + '</span></div></div>').join('') + '</div></section>';
}

/* ---------- cadastro ---------- */
function estimativaNovo() {
  const n = S.novo, v = visao(), t = tarifaAtual();
  const kwh = (n.pot / 1000) * n.horas * n.dias;
  const p = (kwh / Math.max(v.projConsumo, 1)) * 100;
  return { kwh: kwh, custo: kwh * t, ano: kwh * t * 12, pct: p, pctBar: clamp(p, 0, 100) };
}
function textoEstimativa(e) {
  return e.pct > 100
    ? 'Sozinho já passa do que o medidor registra no mês (' + nf(e.pct) + '%) — revise a potência ou as horas'
    : nf(e.pct, 1) + '% do consumo da unidade';
}
function vCadastro() {
  const u = unidade(), n = S.novo, e = estimativaNovo();
  const pode = n.nome.trim().length > 1;
  const cats = CATS.map(c => '<button class="chip" data-act="chip" data-campo="cat" data-v="' + esc(c) + '" aria-pressed="' + (n.cat === c) + '">' + c + '</button>').join('');
  const coms = u.comodos.map(c => '<button class="chip" data-act="chip" data-campo="comodo" data-v="' + esc(c) + '" aria-pressed="' + (n.comodo === c) + '">' + c + '</button>').join('');
  const presets = PRESETS.map((p, i) => '<button class="preset" data-act="preset" data-i="' + i + '">' +
    '<span style="min-width:0"><span class="preset-n" style="display:block">' + esc(p.nome) + '</span>' +
    '<span class="preset-d" style="display:block">' + nf(p.pot) + ' W · ' + nf(p.horas, 1) + ' h/dia</span></span>' +
    ico(IC.chevron, 14, '#B9B2A2', 2.2) + '</button>').join('');

  const editando = !!S.editando;
  const form = '<section class="card s7" style="padding:24px 28px 28px">' +
    '<h2>' + (editando ? 'Editar aparelho' : 'Descreva o aparelho') + '</h2>' +
    '<div class="card-sub">' + (editando
      ? 'Ajuste os valores e salve. Se este aparelho era uma estimativa da IA, ele passa a valer como cadastro seu.'
      : 'A IA já estima quase tudo sozinha. Cadastre o que ela não reconhece ou o que você quer acompanhar de perto.') + '</div>' +
    '<div class="field"><label class="field-lbl" for="inNome">Nome</label>' +
    '<input class="text-in" id="inNome" data-fid="nome" data-in="nome" type="text" value="' + esc(n.nome) + '" placeholder="Ex.: Ar-condicionado do quarto" autocomplete="off"></div>' +
    '<div class="field"><span class="field-lbl">Categoria</span><div class="chips">' + cats + '</div></div>' +
    '<div class="field"><span class="field-lbl">Onde fica</span><div class="chips">' + coms + '</div></div>' +
    '<hr class="rule" style="margin:24px 0 20px">' +
    '<div class="sliders">' +
    sliderBloco('Potência', 'potLbl', nf(n.pot) + ' W', 'pot', 20, 12000, 10, n.pot, '20 W', '12.000 W') +
    sliderBloco('Horas de uso por dia', 'horasLbl', nf(n.horas, 1) + ' h por dia', 'horas', 0.1, 24, 0.1, n.horas, '6 min', '24 h') +
    sliderBloco('Dias de uso por mês', 'diasLbl', n.dias + ' dias por mês', 'dias', 1, 31, 1, n.dias, '1 dia', '31 dias') +
    '</div></section>';

  const est = '<section class="card card--dark" style="padding:24px 26px 26px">' +
    '<div class="eyebrow" style="font-size:12px;color:var(--on-dark-soft)">Estimativa</div>' +
    '<div style="display:flex;align-items:baseline;gap:8px;margin-top:12px">' +
    '<span class="big big-46" id="estKwh">' + nf(e.kwh, 1) + '</span><span style="font-size:15px;color:var(--on-dark-soft)">kWh por mês</span></div>' +
    '<div class="big" id="estCusto" style="font-weight:600;font-size:24px;color:var(--sun-lite);margin-top:10px;letter-spacing:-.8px">' + brl(e.custo) + ' por mês</div>' +
    '<div style="font-size:13px;color:var(--on-dark-soft);margin-top:5px" id="estAno">' + brl(e.ano) + ' ao longo de um ano</div>' +
    '<div class="est-bar"><i id="estBar" style="width:' + e.pctBar + '%"></i></div>' +
    '<div style="font-size:12px;color:var(--on-dark-soft);margin-top:8px" id="estPct">' + textoEstimativa(e) + '</div>' +
    '<button class="dark-btn" data-act="salvar" style="width:100%;height:46px;margin-top:18px;border-radius:13px;font-size:14.5px;' +
    (pode ? 'background:var(--on-dark);color:var(--dark)' : '') + '"' + (pode ? '' : ' disabled') + '>' +
    ico(editando ? IC.check : IC.mais, 15, 'currentColor', 2.4) +
    (editando ? 'Salvar alterações' : 'Adicionar aos meus aparelhos') + '</button>' +
    (editando ? '<button class="link-btn" style="margin-top:12px;color:var(--on-dark-soft)" data-act="cancelar-edicao">Cancelar edição</button>' : '') +
    (S.salvo ? '<div class="saved">' + ico(IC.check, 14, 'currentColor', 2.6) + 'Aparelho cadastrado e já no ranking</div>' : '') +
    '</section>';

  const mod = '<section class="card" style="padding:20px 22px 22px"><div class="eyebrow" style="font-size:12px">Começar de um modelo</div>' +
    '<div style="display:flex;flex-direction:column;gap:2px;margin-top:12px">' + presets + '</div></section>';

  return '<div class="grid12 enter">' + form + '<div class="s5 stack">' + est + mod + '</div></div>';
}
function sliderBloco(lbl, idLbl, valor, campo, min, max, step, val, esq, dir) {
  return '<div><div class="slider-head"><span class="field-lbl">' + lbl + '</span><span class="slider-val" id="' + idLbl + '">' + valor + '</span></div>' +
    '<input type="range" data-fid="' + campo + '" data-in="' + campo + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" aria-label="' + lbl + '">' +
    '<div class="slider-ends"><span>' + esq + '</span><span>' + dir + '</span></div></div>';
}

/* ---------- alertas e metas ---------- */
function vAlertas() {
  const v = visao(), t = tarifaAtual();
  const meta = S.metas[S.perfil];
  const usado = v.mtd.tc, proj = v.projConsumo;
  const acima = proj > meta;
  const p = clamp((usado / meta) * 100, 0, 100);
  const marca = clamp((meta / Math.max(meta, proj)) * 100, 0, 100);

  const regras = [
    ['meta', 'Avisar quando eu passar de 80% da meta', 'Notificação no app e por e-mail'],
    ['salto', 'Alertar aparelho com salto acima de 10%', 'Comparado com a média de quatro semanas'],
    ['solar', 'Sugerir melhor horário para usar o sol', 'Uma vez por dia, às 9h'],
    ['standby', 'Relatar consumo em standby da madrugada', 'Resumo semanal aos domingos']
  ].map(r => '<button class="rule-row" data-act="regra" data-k="' + r[0] + '">' +
    '<span style="flex:1;min-width:0"><span class="rule-t" style="display:block">' + r[1] + '</span>' +
    '<span class="rule-s" style="display:block">' + r[2] + '</span></span>' +
    '<span class="tog" role="switch" aria-checked="' + !!S.regras[r[0]] + '" aria-pressed="' + !!S.regras[r[0]] + '"><i></i></span></button>').join('');

  const lista = alertas();
  const feed = lista.length
    ? lista.map(a => '<div class="feed-item feed-item--' + a.tipo + '"><span class="feed-dot"></span>' +
      '<div style="flex:1;min-width:0"><div class="feed-t"><b>' + esc(a.titulo) + '</b><span>' + esc(a.quando) + '</span></div>' +
      '<div class="feed-x">' + esc(a.txt) + '</div></div>' +
      '<button class="feed-close" data-act="alerta-dispensar" data-chave="' + esc(a.chave) + '" ' +
      'aria-label="Dispensar: ' + esc(a.titulo) + '">' + ico(IC.x, 14, 'currentColor', 2.2) + '</button></div>').join('')
    : '<div class="empty" style="padding:26px"><div class="empty-t">Nenhum alerta de pé</div>' +
      '<div class="empty-s">Você dispensou tudo por hoje. Os que continuarem valendo voltam amanhã.</div></div>';

  return '<div class="grid12 enter">' +
    '<section class="card s7" style="padding:24px 28px 26px"><div class="card-head"><div><h2>Meta do mês</h2>' +
    '<div class="card-sub">Quanto você quer consumir no total, somando rede e sol</div></div>' +
    '<div style="text-align:right"><div class="big" style="font-size:26px;letter-spacing:-1px" id="metaLbl">' + nf(meta) + ' kWh</div>' +
    '<div style="font-size:12px;color:var(--faint);margin-top:4px" id="metaCusto">≈ ' + brl(meta * t) + '</div></div></div>' +
    '<input type="range" data-fid="meta" data-in="meta" min="80" max="2600" step="10" value="' + meta + '" aria-label="Meta mensal em kWh" style="accent-color:var(--good);margin-top:20px">' +
    '<div class="goal-track"><div class="goal-fill" id="metaFill" style="width:' + p + '%;background:' + (acima ? 'var(--bad)' : 'var(--good)') + '"></div>' +
    '<div class="goal-mark" style="left:' + marca + '%" data-l="meta"></div></div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12.5px;color:var(--muted)">' +
    '<span>Já consumido: <b class="mono" style="color:var(--ink);font-weight:500">' + nf(usado) + ' kWh</b></span>' +
    '<span>' + pct((usado / meta) * 100) + ' da meta</span></div>' +
    '<div style="font-size:13.5px;font-weight:600;margin-top:10px;color:' + (acima ? 'var(--bad)' : 'var(--good)') + '">' +
    (acima ? 'Você deve estourar a meta em ' + nf(proj - meta) + ' kWh' : 'No ritmo atual, você fecha o mês dentro da meta') + '</div>' +
    '<div style="font-size:12.5px;color:var(--faint);margin-top:3px">Projeção de fechamento: ' + nf(proj) + ' kWh</div></section>' +

    '<section class="card s5" style="padding:22px 24px 24px"><h2>Quando avisar</h2>' +
    '<div style="display:flex;flex-direction:column;gap:4px;margin-top:16px">' + regras + '</div></section>' +

    '<section class="card s12"><h2>O que aconteceu por aqui</h2><div class="feed">' + feed + '</div></section></div>';
}

/* ---------- relatório ---------- */
function vRelatorio() {
  const v = visao(), u = unidade(), t = tarifaAtual();
  const l = v.linhaAtual;
  const faturado = Math.max(l.rede - l.usado, 0);
  const cobrado = Math.max(faturado, 0);
  const bandeira = l.rede * 0.0189;
  const total = cobrado * t + bandeira + u.ilum + l.fioB;
  const semSolar = Math.max(l.cons, 0) * t + l.cons * 0.0189 + u.ilum;
  const arv = Math.round(v.co2 / 22 * 12);

  const linhas = [
    ['Consumo registrado no medidor', nf(l.cons) + ' kWh', brl(l.cons * t), ''],
    ['Energia gerada e autoconsumida', '− ' + nf(l.auto) + ' kWh', '− ' + brl(l.auto * t), 'credit'],
    ['Energia injetada na rede', '− ' + nf(l.inj) + ' kWh', '− ' + brl(l.inj * u.tarifaComp), 'credit'],
    ['Créditos usados neste mês', '− ' + nf(l.usado) + ' kWh', '− ' + brl(l.usado * t), 'credit'],
    ['Fio B sobre energia compensada (Lei 14.300)', pct(l.percFioB * 100) + ' de ' + brl(u.fioB, 2) + '/kWh', brl(l.fioB, 2), ''],
    ['Bandeira amarela', '—', brl(bandeira, 2), ''],
    ['Contribuição de iluminação pública', '—', brl(u.ilum, 2), ''],
    ['Total a pagar', nf(faturado) + ' kWh faturados', brl(total), 'total']
  ].map(r => '<div class="inv-row' + (r[3] === 'total' ? ' inv-row--total' : r[3] === 'credit' ? ' inv-row--credit' : '') + '">' +
    '<span>' + r[0] + '</span><span class="inv-q">' + r[1] + '</span><span class="inv-v">' + r[2] + '</span></div>').join('');

  const meses = v.ledger.linhas.slice(-12);
  const maxE = Math.max.apply(null, meses.map(x => x.economia)) || 1;
  const ybars = meses.map((x, i) => '<div class="ybar' + (i === meses.length - 1 ? ' is-now' : '') + '" title="' + MES3[x.m] + ': ' + brl(x.economia) + '">' +
    '<i style="height:' + Math.round((x.economia / maxE) * 92 + 8) + 'px"></i><span>' + MES3[x.m] + '</span></div>').join('');

  const hoje = v.data;
  return '<div class="grid12 enter">' +
    '<section class="card s8" style="padding:30px 34px 32px">' +
    '<div class="print-head"><span class="brand-mark" style="background:var(--dark)">' + ico(IC.sol, 17, '#EDA22B', 2.2) + '</span><b style="font-family:var(--f-display);font-size:17px">Solaris</b></div>' +
    '<div class="card-head"><div><div class="big" style="font-size:22px;letter-spacing:-.7px">' + esc(u.nome) + '</div>' +
    '<div class="card-sub">' + esc(u.distribuidora) + ' · 01 a ' + hoje.getDate() + ' de ' + MESES[v.m] + ' de ' + v.y + '</div></div>' +
    '<button class="ghost-btn no-print" data-act="imprimir">' + ico(IC.print, 14, 'currentColor', 1.9) + 'Imprimir</button></div>' +
    '<div class="inv-head"><span>Descrição</span><span>Quantidade</span><span style="text-align:right">Valor</span></div>' +
    linhas +
    '<div class="leaf">' + ico(IC.folha, 20, 'var(--good)', 1.9) +
    '<div><div class="leaf-t">Sem os painéis, esta conta seria ' + brl(semSolar) + '</div>' +
    '<div class="leaf-s">Você vai pagar ' + brl(total) + ' — ' + pct(((semSolar - total) / Math.max(semSolar, 1)) * 100) + ' menor. No mês, ' +
    nf(v.co2, 1) + ' kg de CO₂ deixaram de ir para a atmosfera, o mesmo que ' + arv + ' árvores absorvem em um mês.</div></div></div>' +
    '<div style="font-size:11.5px;color:var(--fainter);margin-top:18px">Emitido em ' + hoje.getDate() + ' de ' + MESES[v.m] + ' de ' + v.y +
    ' · valores estimados a partir do medidor e da tarifa cadastrada</div></section>' +

    '<div class="s4 stack">' +
    '<section class="card" style="padding:20px 22px 22px"><div class="eyebrow" style="font-size:12px">Economia nos 12 meses</div>' +
    '<div class="big big-30" style="margin-top:8px">' + brl(soma(meses.map(x => x.economia))) + '</div>' +
    '<div class="ybars">' + ybars + '</div></section>' +
    '<section class="card" style="padding:20px 22px 22px"><div class="eyebrow" style="font-size:12px">Saldo de créditos</div>' +
    '<div class="big big-30" style="margin-top:8px">' + nf(v.creditos) + ' kWh</div>' +
    '<div style="font-size:12.5px;color:var(--faint);margin-top:6px;line-height:1.5">' +
    (v.creditos >= 1
      ? 'Energia injetada que ainda não foi usada. Vale por 60 meses e abate contas futuras — neste mês ela já derrubou ' + brl(l.usado * t) + '.'
      : 'Esta unidade consome mais do que gera, então tudo o que é injetado volta no mesmo ciclo: não sobra saldo. Neste mês os créditos abateram ' + brl(l.usado * t) + '.') +
    '</div></section>' +
    '</div></div>';
}

/* ---------- configurações ---------- */
function vConfig() {
  const v = visao(), u = unidade(), t = tarifaAtual();
  const inicio = new Date(v.y, v.m - (u.mesesOperacao - 1), 1);
  return '<div class="grid12 enter">' +
    '<section class="card s6" style="padding:24px 26px 26px"><h2>Tarifa de energia</h2>' +
    '<div class="card-sub">É o número que transforma kWh em reais em todo o sistema</div>' +
    '<div class="big" style="font-size:38px;letter-spacing:-1.6px;margin-top:18px" id="tarLbl">R$ ' + nf(t, 2) + ' / kWh</div>' +
    '<input type="range" data-fid="tarifa" data-in="tarifa" min="40" max="160" step="1" value="' + Math.round(t * 100) + '" aria-label="Tarifa em centavos por kWh" style="margin-top:18px">' +
    '<div class="slider-ends"><span>R$ 0,40</span><span>R$ 1,60</span></div>' +
    (S.tarifa[S.perfil] != null ? '<button class="link-btn" style="margin-top:14px" data-act="reset-tarifa">Voltar para a tarifa da distribuidora</button>' :
      '<div style="margin-top:14px;font-size:12.5px;color:var(--faint)">Usando a tarifa da ' + esc(u.distribuidora) + '</div>') +
    '<hr class="rule" style="margin:20px 0 16px">' +
    '<dl class="kvs">' +
    kv('Tarifa de compensação (injetado)', 'R$ ' + nf(u.tarifaComp, 2) + ' / kWh', true) +
    kv('Distribuidora', esc(u.distribuidora)) +
    kv('Consumo mínimo faturado', nf(u.minFatura) + ' kWh', true) +
    kv('Componente TUSD Fio B', 'R$ ' + nf(u.fioB, 2) + ' / kWh', true) +
    kv('Fator de emissão da rede', nf(86.1, 1) + ' g CO₂ por kWh', true) +
    '</dl>' +
    '<div class="softbox">' + (v.direitoAdquirido
      ? 'Sistema conectado antes de 07/01/2023: mantém <b>compensação integral</b> até 2045 pela regra de transição da Lei 14.300.'
      : 'Pela <b>Lei 14.300/2022</b>, este sistema paga <b>' + pct(v.percFioB * 100) + '</b> do Fio B sobre a energia compensada em ' + v.y +
      '. O degrau sobe até 2028 — no total já foram <b>' + brl(v.fioBTotal) + '</b> desde a entrada em operação.') +
    '</div></section>' +

    '<section class="card s6" style="padding:24px 26px 26px"><h2>Unidade e sistema solar</h2>' +
    '<dl class="kvs" style="margin-top:18px">' +
    kv('Unidade', esc(u.nome)) +
    kv('Perfil', esc(u.tipo)) +
    kv('Potência instalada', nf(u.potenciaKwp, 1) + ' kWp', true) +
    kv('Painéis', u.paineis + ' painéis', true) +
    kv('Investimento', brl(u.investimento), true) +
    kv('Em operação desde', MESES[inicio.getMonth()] + ' de ' + inicio.getFullYear() + ' · ' + u.mesesOperacao + ' meses') +
    '</dl>' +
    '<div class="softbox">Com a tarifa atual, sua conta média sem geração solar seria <b>' + brl(v.semSolarProj) + '</b> por mês. Com os painéis, a projeção é <b>' + brl(v.contaProj) + '</b>.</div>' +
    '<div class="' + (v.desempenho < 85 ? 'note note--bad' : 'note note--good') + '" style="margin-top:12px">' +
    '<span class="note-dot"></span><div>' +
    '<div class="note-t">Saúde do sistema: ' + pct(v.desempenho) + ' do esperado para este telhado</div>' +
    '<div class="note-s">Em ' + MESES[v.m] + ' a irradiação da região é ' + nf(IRRADIACAO_SP[v.m], 1) +
    ' kWh/m² por dia, o que daria ' + nf(v.potencial) + ' kWh num telhado ideal. O seu (' + esc(u.condicaoTelhado) +
    ') aproveita ' + pct(v.aproveitaTelhado) + ' disso, então o esperado são ' + nf(v.esperada) + ' kWh — e ele entregou ' +
    nf(v.cheio.tg) + '. ' +
    (v.desempenho < 85
      ? 'Abaixo do esperado: costuma ser sujeira nos módulos ou queda de rendimento do inversor.'
      : 'Dentro do esperado para as condições da instalação.') +
    '</div></div></div>' +
    '<hr class="rule" style="margin:22px 0 14px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">' +
    '<div style="font-size:12.5px;color:var(--faint);max-width:44ch">Aparelhos cadastrados, metas e tarifa ficam salvos neste navegador.</div>' +
    '<button class="danger-btn" data-act="reset-tudo">Apagar meus dados</button></div>' +
    '</section>' + cardUnidades() + cardExemplos() + cardFonte() + cardBanco() + '</div>';
}

/* liga e desliga as unidades de demonstracao */
function cardExemplos() {
  const ligado = mostrandoExemplos();
  const proprias = (S.unidades || []).length;
  return '<section class="card s6"><div class="card-head"><div><h2>Unidades de exemplo</h2>' +
    '<div class="card-sub">Uma casa e uma padaria de demonstração, para conhecer o sistema</div></div>' +
    '<button class="tog" data-act="alternar-exemplos" role="switch" ' +
    'aria-checked="' + ligado + '" aria-label="Mostrar unidades de exemplo"><i></i></button></div>' +
    '<div style="font-size:13px;color:var(--muted);margin-top:14px;line-height:1.55;max-width:60ch">' +
    (ligado
      ? 'Elas aparecem no menu junto com as suas. Não são dados reais — servem para mostrar como o sistema se comporta.' +
        (proprias ? '' : ' Desligar agora deixaria a conta vazia, porque você ainda não cadastrou nenhuma unidade sua.')
      : 'Estão escondidas. Você vê apenas ' + (proprias === 1 ? 'a sua unidade' : 'as suas ' + proprias + ' unidades') + '.') +
    '</div></section>';
}

/* estado do banco de dados — preenchido de forma assíncrona depois do render */
function cardBanco() {
  return '<section class="card s12" id="cardBanco">' +
    '<div class="card-head"><div><h2>Banco de dados</h2>' +
    '<div class="card-sub">O histórico do medidor é gravado minuto a minuto — é o que não caberia em armazenamento simples</div></div>' +
    '<span class="pill pill--neutral" id="bancoMotor">carregando…</span></div>' +
    '<div class="bd-grade" id="bancoNumeros"></div>' +
    '<div class="bd-graf" id="bancoGrafico"></div>' +
    '</section>';
}

/* unidades criadas pelo usuário */
function cardUnidades() {
  const proprias = S.unidades || [];
  const linhas = proprias.length
    ? proprias.map(f => {
      const u = montarUnidade(f);
      return '<div class="un-row">' +
        '<span style="min-width:0"><b style="font-size:13.5px">' + esc(u.nome) + '</b>' +
        '<span class="un-meta">' + esc(u.tipo) + ' · ' + nf(u.potenciaKwp, 1) + ' kWp · ' + nf(u.consumoMes) + ' kWh/mês</span></span>' +
        (S.perfil === f.chave ? '<span class="pill pill--good">Em uso</span>' : '') +
        '<button class="eq-kill" style="opacity:1" data-act="remover-unidade" data-chave="' + f.chave + '" ' +
        'aria-label="Remover ' + esc(u.nome) + '">' + ico(IC.lixo, 15, 'currentColor', 1.8) + '</button></div>';
    }).join('')
    : '<div style="font-size:13px;color:var(--faint);margin-top:10px;max-width:60ch">' +
      'Você ainda não cadastrou nenhuma. As duas que aparecem no menu são exemplos que vêm com o sistema.</div>';
  return '<section class="card s6"><div class="card-head"><div><h2>Suas unidades</h2>' +
    '<div class="card-sub">Cadastre a sua casa ou o seu comércio para ver os números reais</div></div>' +
    '<button class="dark-btn" data-act="nav" data-tela="unidade">' + ico(IC.mais, 13, 'currentColor', 2.6) + 'Nova unidade</button></div>' +
    '<div class="un-list">' + linhas + '</div></section>';
}

/* seletor entre simulação e medidor físico */
function cardFonte() {
  const f = fonteAtual();
  const estado = {
    simulado: ['pill--neutral', 'Simulado'],
    medidor: ['pill--good', 'Lendo o medidor'],
    aguardando: ['pill--bad', 'Sem resposta']
  }[f];
  return '<section class="card s6"><div class="card-head"><div>' +
    '<h2>Fonte da leitura</h2>' +
    '<div class="card-sub">O painel não sabe de onde vem o número. Trocar a fonte não muda mais nada no sistema.</div></div>' +
    '<span class="pill ' + estado[0] + '">' + estado[1] + '</span></div>' +
    '<div class="chips" style="margin-top:16px">' +
    '<button class="chip" data-act="fonte" data-v="simulado" aria-pressed="' + !MEDIDOR.ativo + '">Simulação</button>' +
    '<button class="chip" data-act="fonte" data-v="medidor" aria-pressed="' + MEDIDOR.ativo + '">Medidor físico (ESP32)</button>' +
    '</div>' +
    (MEDIDOR.ativo
      ? '<div class="field"><label class="field-lbl" for="inEnd">Endereço do medidor na rede</label>' +
      '<input class="text-in" id="inEnd" data-fid="endereco" data-in="endereco" type="text" value="' + esc(MEDIDOR.endereco) + '" ' +
      'placeholder="192.168.4.1" autocomplete="off" spellcheck="false" style="max-width:280px"></div>' +
      '<div style="font-size:12.5px;color:var(--faint);margin-top:12px;line-height:1.55;max-width:70ch">' +
      (f === 'medidor'
        ? 'Última leitura: <b class="mono" style="color:var(--ink)">' + nf(MEDIDOR.ultima, 3) + ' kW</b>, há ' +
        nf((Date.now() - MEDIDOR.quando) / 1000, 0) + ' segundos. Só o consumo vem do sensor — a geração continua simulada, porque um sensor no quadro geral não separa as duas.'
        : 'Sem resposta do medidor' + (MEDIDOR.erro ? ' (' + esc(MEDIDOR.erro) + ')' : '') +
        '. Confira se o computador está na rede <b>Solaris-Medidor</b>. Depois de 15 segundos sem leitura o painel volta sozinho para a simulação, para nunca congelar numa apresentação.') +
      '</div>'
      : '<div style="font-size:12.5px;color:var(--faint);margin-top:12px;max-width:70ch">' +
      'A simulação calcula tudo a partir da data, da irradiação da região e do padrão de consumo da unidade. É a fonte padrão e não depende de rede.</div>') +
    '</section>';
}
function kv(k, v, mono) {
  return '<div class="kv"><dt>' + k + '</dt><dd' + (mono ? ' class="mono"' : '') + '>' + v + '</dd></div>';
}

/* ---------- conta nova, sem unidade nenhuma ----------
   Aparece no lugar do painel enquanto nao ha o que mostrar. Duas saidas:
   cadastrar a unidade de verdade ou ligar os exemplos para dar uma olhada. */
function vPrimeiraUnidade() {
  const s = sessao() || {};
  const primeiro = (s.nome || '').split(' ')[0];
  return '<div class="comecar">' +
    '<div class="comecar-cx">' +
      '<span class="comecar-ic">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16150F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 11l9-8 9 8M5 9.5V21h14V9.5M9 21v-6h6v6"/></svg></span>' +

      '<h1>' + (primeiro ? primeiro + ', vamos' : 'Vamos') + ' come\u00e7ar<br>pela sua unidade</h1>' +
      '<p class="comecar-d">Sua conta est\u00e1 vazia \u2014 e \u00e9 assim que tem que ser. ' +
      'Cadastre a casa ou o com\u00e9rcio que voc\u00ea quer acompanhar e o Solaris passa a ' +
      'calcular gera\u00e7\u00e3o, consumo, cr\u00e9ditos e conta em cima dos <b>seus</b> n\u00fameros.</p>' +

      '<div class="comecar-precisa">' +
        '<div class="comecar-precisa-t">Tenha \u00e0 m\u00e3o</div>' +
        '<ul>' +
          '<li>Uma <b>conta de luz</b>: consumo m\u00e9dio em kWh e a tarifa</li>' +
          '<li>A <b>nota do instalador</b>: pot\u00eancia em kWp e n\u00famero de pain\u00e9is</li>' +
        '</ul>' +
        '<div class="comecar-precisa-p">N\u00e3o tem agora? D\u00e1 para colocar valores aproximados e corrigir depois.</div>' +
      '</div>' +

      '<button class="dark-btn comecar-botao" data-act="nav" data-tela="unidade">' +
        ico(IC.mais, 16, 'currentColor', 2.4) + 'Cadastrar minha unidade</button>' +

      '<div class="comecar-ou"><span>ou</span></div>' +
      '<button class="comecar-exemplo" data-act="ligar-exemplos">' +
        'Ver primeiro com dados de exemplo' +
      '</button>' +
      '<p class="comecar-exemplo-d">Carrega duas unidades de demonstra\u00e7\u00e3o \u2014 uma casa e uma ' +
      'padaria \u2014 para voc\u00ea passear pelo sistema. D\u00e1 para desligar depois em Configura\u00e7\u00f5es.</p>' +
    '</div></div>';
}

/* ---------- cadastrar unidade ---------- */
function previaUnidade() {
  const n = S.nova;
  const a = ARQUETIPOS[n.arquetipo], tel = TELHADOS.filter(t => t.k === n.telhado)[0] || TELHADOS[1];
  const irr = soma(IRRADIACAO_SP) / 12;
  const geracao = n.potenciaKwp * irr * RAZAO_DESEMPENHO * tel.fator * 30;
  const cobertura = n.consumoMes > 0 ? clamp((geracao / n.consumoMes) * 100, 0, 999) : 0;
  const contaSem = n.consumoMes * n.tarifa + n.consumoMes * 0.0189 + a.ilum;
  return { arquetipo: a, telhado: tel, geracao: geracao, cobertura: cobertura, contaSem: contaSem };
}

function textoCobertura(p, n) {
  const base = 'Cobre ' + pct(p.cobertura) + ' de um consumo de ' + nf(n.consumoMes) + ' kWh';
  if (p.cobertura > 130) return base + ' — sistema bem maior que o consumo, o excedente vira crédito e pode nunca ser usado';
  if (p.cobertura < 40 && n.potenciaKwp > 0) return base + ' — sistema pequeno para esse consumo';
  return base;
}

function vUnidade() {
  const n = S.nova, p = previaUnidade();
  const pode = n.nome.trim().length > 1 && n.potenciaKwp > 0 && n.consumoMes > 0;

  const arqs = Object.keys(ARQUETIPOS).map(k => {
    const a = ARQUETIPOS[k], at = n.arquetipo === k;
    return '<button class="opt" data-act="nova-arq" data-v="' + k + '" aria-pressed="' + at + '">' +
      '<span class="opt-t">' + a.rotulo + '</span>' +
      '<span class="opt-d">' + a.desc + '</span></button>';
  }).join('');

  const tels = TELHADOS.map(t => '<button class="chip" data-act="nova-telhado" data-v="' + t.k + '" ' +
    'aria-pressed="' + (n.telhado === t.k) + '">' + t.rotulo + '</button>').join('');

  /* Sempre type=text: input[type=number] recusa vírgula decimal, e em
     português a vírgula é o separador natural. O parse aceita as duas. */
  const campo = (id, rot, dica, valor, num) =>
    '<div class="field"><label class="field-lbl" for="' + id + '">' + rot + '</label>' +
    '<input class="text-in" id="' + id + '" data-fid="' + id + '" data-in="' + id + '" type="text" ' +
    (num ? 'inputmode="decimal" ' : '') +
    'value="' + esc(num ? (valor % 1 === 0 ? nf(valor) : String(valor).replace('.', ',')) : valor) + '" autocomplete="off" style="max-width:320px">' +
    (dica ? '<div class="dica">' + dica + '</div>' : '') + '</div>';

  const form = '<section class="card s7" style="padding:24px 28px 28px">' +
    '<h2>Sua unidade</h2>' +
    '<div class="card-sub">Só o que está na sua conta de luz e na nota do instalador. O resto o sistema calcula.</div>' +

    campo('unNome', 'Nome da unidade', 'Como você quer ver no menu — “Minha casa”, “Loja do centro”.', n.nome) +

    '<div class="field"><span class="field-lbl">Como a energia é usada</span>' +
    '<div class="dica">Isso define a curva de consumo hora a hora, sem você digitar 24 números.</div>' +
    '<div class="opts">' + arqs + '</div></div>' +

    '<div class="field"><span class="field-lbl">Condição do telhado</span>' +
    '<div class="dica">Determina quanto do sol da região os painéis conseguem aproveitar.</div>' +
    '<div class="chips">' + tels + '</div></div>' +

    '<hr class="rule" style="margin:24px 0 4px">' +
    '<div class="eyebrow-sm" style="margin-bottom:4px">Da sua conta de luz</div>' +
    campo('unConsumo', 'Consumo médio por mês (kWh)', 'Pegue a média dos últimos 12 meses — costuma vir num gráfico na própria conta.', n.consumoMes, true) +
    campo('unTarifa', 'Tarifa (R$ por kWh)', 'Divida o valor total pela quantidade de kWh, ou procure por “tarifa” na conta.', n.tarifa, true) +
    campo('unDistribuidora', 'Distribuidora', '', n.distribuidora) +

    '<hr class="rule" style="margin:24px 0 4px">' +
    '<div class="eyebrow-sm" style="margin-bottom:4px">Do seu sistema solar</div>' +
    campo('unPotencia', 'Potência instalada (kWp)', 'Está na nota do instalador. Some a potência dos painéis e divida por mil.', n.potenciaKwp, true) +
    campo('unPaineis', 'Quantidade de painéis', '', n.paineis, true) +
    campo('unInvestimento', 'Quanto custou (R$)', 'Usado só para calcular em quanto tempo o sistema se paga.', n.investimento, true) +
    campo('unMeses', 'Há quantos meses está ligado', 'Define se você tem direito adquirido pela Lei 14.300 e o histórico que o sistema monta.', n.mesesOperacao, true) +
    '</section>';

  const previa = '<section class="card card--dark" style="padding:24px 26px 26px">' +
    '<div class="eyebrow" style="font-size:12px;color:var(--on-dark-soft)">O que o sistema vai calcular</div>' +
    '<div style="display:flex;align-items:baseline;gap:8px;margin-top:12px">' +
    '<span class="big big-46" id="pvGer">' + nf(p.geracao) + '</span>' +
    '<span style="font-size:15px;color:var(--on-dark-soft)">kWh gerados por mês</span></div>' +
    '<div style="font-size:13px;color:var(--on-dark-soft);margin-top:6px" id="pvExpl">' +
    nf(p.telhado.fator * 100) + '% do sol da região, com ' + nf(n.potenciaKwp, 1) + ' kWp instalados</div>' +
    '<div class="est-bar"><i id="pvBar" style="width:' + clamp(p.cobertura, 0, 100) + '%"></i></div>' +
    '<div style="font-size:12px;color:var(--on-dark-soft);margin-top:8px" id="pvCob">' + textoCobertura(p, n) + '</div>' +
    '<hr style="border:0;height:1px;background:rgba(244,241,234,.14);margin:18px 0 14px">' +
    '<div style="font-size:13px;color:var(--on-dark-soft);line-height:1.55" id="pvConta">' +
    'Sem os painéis, sua conta seria cerca de <b style="color:var(--on-dark)">' + brl(p.contaSem) + '</b> por mês.</div>' +
    '<button class="dark-btn" data-act="salvar-unidade" style="width:100%;height:46px;margin-top:20px;border-radius:13px;font-size:14.5px;' +
    (pode ? 'background:var(--on-dark);color:var(--dark)' : '') + '"' + (pode ? '' : ' disabled') + '>' +
    ico(IC.mais, 15, 'currentColor', 2.4) + 'Criar unidade</button>' +
    (pode ? '' : '<div style="font-size:12px;color:var(--on-dark-soft);margin-top:10px">Falta o nome, a potência ou o consumo.</div>') +
    '</section>';

  const ajuda = '<section class="card" style="padding:20px 22px 22px">' +
    '<div class="eyebrow" style="font-size:12px">Como o cálculo funciona</div>' +
    '<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-top:10px">' +
    'A geração não é chute nem um número que você digita: vem da irradiação média da região (' +
    nf(soma(IRRADIACAO_SP) / 12, 1) + ' kWh/m² por dia), da potência que você informou, de ' +
    pct(RAZAO_DESEMPENHO * 100) + ' de rendimento típico do inversor e da condição do telhado.' +
    '<br><br>O consumo hora a hora vem do arquétipo escolhido, ajustado para bater com a média mensal da sua conta. ' +
    'Depois disso o sistema calcula sozinho autoconsumo, injeção, créditos e Fio B.' +
    '</div></section>';

  return '<div class="grid12 enter">' + form + '<div class="s5 stack">' + previa + ajuda + '</div></div>';
}
