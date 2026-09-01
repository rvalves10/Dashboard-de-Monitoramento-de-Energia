/* movel.js — o mesmo site em tela estreita

   Abaixo de 760 px de largura o controle.js chama vMovel() no lugar da
   versao ampla. Sai o menu lateral, entra coluna unica com abas embaixo.

   Importante: isto NAO e um aplicativo. E o mesmo site, o mesmo motor,
   o mesmo banco e os mesmos dados — so a casca muda. O que tem a ver com
   virar aplicativo mora na pasta app-futuro, fora do site.

   As abas sao painel, historico, aparelhos, metas e mais. Dentro de "mais"
   estao as telas que nao cabem numa aba: conta do mes, cadastro e ajustes.
*/
'use strict';

/* Cinco abas e o limite do polegar numa barra inferior; a sexta encolhe o
   alvo de toque abaixo do aceitavel. Como o assistente e a novidade que
   precisa ser encontrada, ele entra como aba e "Metas" desce para o Mais —
   metas se ajustam uma vez por mes, o assistente se abre todo dia. */
const MTABS = [
  { k: 'painel', label: 'Painel', icon: IC.painel },
  { k: 'historico', label: 'Histórico', icon: IC.historico },
  { k: 'aparelhos', label: 'Aparelhos', icon: IC.aparelhos },
  { k: 'assistente', label: 'Assistente', icon: IC.ia },
  { k: 'mais', label: 'Mais', icon: 'M5 12h.01M12 12h.01M19 12h.01' }
];
const MMENU = [
  { k: 'metas', t: 'Metas e alertas', s: 'O limite do mês e as regras que avisam', icon: IC.sino },
  { k: 'conta', t: 'Conta do mês', s: 'Fatura detalhada e economia do ano', icon: IC.papel },
  { k: 'cadastro', t: 'Cadastrar aparelho', s: 'Estime o consumo de algo que a IA não viu', icon: IC.mais },
  { k: 'config', t: 'Configurações', s: 'Tarifa, distribuidora e sistema solar', icon: IC.ajustes }
];

function vMovel() {
  const v = visao(), u = unidade();
  const sub = S.msub;
  const titulos = { painel: saudacao(), historico: 'Histórico', aparelhos: 'Seus aparelhos', assistente: 'Assistente', mais: 'Mais' };
  const subT = { conta: 'Conta de ' + MESES[v.m], cadastro: 'Novo aparelho', config: 'Configurações', metas: 'Metas e alertas' };
  const titulo = sub ? subT[sub] : titulos[S.tab];

  let corpo = '';
  if (sub === 'conta') corpo = mConta();
  else if (sub === 'cadastro') corpo = mCadastro();
  else if (sub === 'config') corpo = mConfig();
  else if (sub === 'metas') corpo = mMetas();
  else if (S.tab === 'painel') corpo = mPainel();
  else if (S.tab === 'historico') corpo = mHistorico();
  else if (S.tab === 'aparelhos') corpo = mAparelhos();
  else if (S.tab === 'assistente') corpo = vAssistente();
  else corpo = mMais();

  const tabs = MTABS.map(t => '<button class="mob-tab" data-act="mtab" data-k="' + t.k + '"' +
    (S.tab === t.k && !sub ? ' aria-current="page"' : '') + '>' + ico(t.icon, 21, 'currentColor', 1.8) +
    '<span>' + t.label + '</span></button>').join('');

  return '<div class="mob">' +
    '<div class="mob-head">' +
    (sub ? '<button class="mob-back" data-act="mback">' + ico(IC.volta, 14, 'currentColor', 2.4) + 'Voltar</button>' : '') +
    '<h1 class="mob-title">' + esc(titulo) + '</h1><div class="mob-unit">' + esc(u.nome) + '</div></div>' +
    '<div class="mob-body" id="conteudo" tabindex="-1">' + corpo + '</div>' +
    '<nav class="mob-tabs" aria-label="Seções">' + tabs + '</nav>' +
    '</div>';
}

function mPainel() {
  const v = visao(), p = potenciaAgora();
  const dia = v.md.dias[v.data.getDate() - 1];
  const max = Math.max(Math.max.apply(null, dia.cons), Math.max.apply(null, dia.ger)) * 1.12 || 1;
  const u = unidade();
  /* sem painel, tres dos quatro numeros seriam zero */
  const tiles = (u.temSolar === false
    ? [
      ['Consumo', nf(v.mtd.tc), 'kWh no mês'],
      ['Conta', brl(v.contaProj), 'projeção do mês'],
      ['Por dia', brl(v.contaProj / v.nd, 2), 'no ritmo de hoje'],
      ['Tarifa', nf(tarifaAtual(), 2), 'R$ por kWh']
    ]
    : [
      ['Consumo', nf(v.mtd.tc), 'kWh no mês'],
      ['Geração', nf(v.mtd.tg), 'kWh no mês'],
      ['CO₂ evitado', nf(v.co2, 1), 'kg neste mês'],
      ['Créditos', nf(v.creditos), 'kWh na rede']
    ]).map(t => '<div class="mob-tile"><div class="mob-tile-k">' + t[0] + '</div><div class="mob-tile-v">' + t[1] + '</div><div class="mob-tile-s">' + t[2] + '</div></div>').join('');

  return '<div class="mob-col">' +
    '<div class="mob-hero"><div style="position:relative">' +
    '<div class="mob-hero-k">' + (u.temSolar === false ? 'Sua conta de ' + MESES[v.m] : 'Economizado em ' + MESES[v.m]) + '</div>' +
    '<div class="mob-hero-v"><span class="cur">R$</span><span class="num">' +
    nf(u.temSolar === false ? v.contaProj : v.economia) + '</span></div>' +
    '<div class="mob-hero-s">' + (u.temSolar === false
      ? 'Projeção do mês fechado, com ' + nf(v.projConsumo) + ' kWh'
      : 'O sol cobriu ' + pct(v.autoPct) + ' do seu consumo até agora') + '</div>' +
    '<div class="mob-live"><span class="live-dot batendo"></span><span>Agora: consumindo <b id="mLiveC">' + nf(p.cons, 2) + ' kW</b> · gerando <b id="mLiveG">' + nf(p.ger, 2) + ' kW</b></span></div>' +
    '</div></div>' +
    '<div class="mob-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
    '<h2>Hoje</h2><div class="legend" style="gap:11px">' +
    '<span><i class="swatch" style="background:var(--sun)"></i>Sol</span><span><i class="swatch" style="background:var(--grid)"></i>Consumo</span></div></div>' +
    '<svg viewBox="0 0 320 100" style="width:100%;height:auto;margin-top:10px;overflow:visible">' +
    '<defs><linearGradient id="gSolM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--sun)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--sun)" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + caminho(dia.ger, max, 320, 96, true) + '" fill="url(#gSolM)"/>' +
    '<path d="' + caminho(dia.ger, max, 320, 96) + '" fill="none" stroke="var(--sun)" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="' + caminho(dia.cons, max, 320, 96) + '" fill="none" stroke="var(--grid)" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round"/>' +
    '<line x1="' + ((v.hDec - (v.data.getDate() - 1) * 24) / 23 * 320).toFixed(1) + '" y1="0" x2="' + ((v.hDec - (v.data.getDate() - 1) * 24) / 23 * 320).toFixed(1) + '" y2="96" stroke="var(--n-900)" stroke-width="1" stroke-dasharray="3 3" opacity=".4"/>' +
    '</svg></div>' +
    '<div class="mob-grid2">' + tiles + '</div></div>';
}

function mHistorico() {
  const s = seriePeriodo();
  const max = Math.max(Math.max.apply(null, s.cons), Math.max.apply(null, s.ger)) * 1.08 || 1;
  const tC = soma(s.cons), tG = soma(s.ger);
  const dC = ((tC - (s.anterior.c || 1)) / (s.anterior.c || 1)) * 100;
  const dG = ((tG - (s.anterior.g || 1)) / (s.anterior.g || 1)) * 100;
  const saldos = s.cons.map((c, i) => s.ger[i] - c);
  let iM = 0; saldos.forEach((x, i) => { if (x > saldos[iM]) iM = i; });
  const cobertos = saldos.filter(x => x >= 0).length;
  const t = tarifaAtual();

  const per = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(p =>
    '<button data-act="periodo" data-p="' + p[0] + '" aria-pressed="' + (S.periodo === p[0]) + '">' + p[1] + '</button>').join('');
  const barras = s.cons.map((c, i) => '<div class="hbar" title="' + esc(s.nomes[i]) + ' · consumo ' + nf(c, 1) + ' kWh · geração ' + nf(s.ger[i], 1) + ' kWh">' +
    '<span class="hbar-pair"><i class="hbar-c" style="height:' + Math.max(1, (c / max) * 104) + 'px"></i>' +
    '<i class="hbar-g" style="height:' + Math.max(1, (s.ger[i] / max) * 104) + 'px"></i></span>' +
    '<span class="hbar-saldo" style="background:' + (saldos[i] >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)') + '"></span>' +
    '<span class="hbar-lbl">' + s.labels[i] + '</span></div>').join('');

  return '<div class="mob-col"><div class="mob-seg">' + per + '</div>' +
    '<div class="mob-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
    '<span style="font-size:13px;font-weight:600">' + esc(s.rotulo) + '</span></div>' +
    '<div class="hbars mob-hbars">' + barras + '</div></div>' +
    '<div class="mob-grid2">' +
    '<div class="mob-tile"><div class="mob-tile-k">Consumo</div><div class="mob-tile-v">' + nf(tC, 1) + '</div>' +
    '<div class="mob-tile-s" style="color:' + (dC <= 0 ? 'var(--good)' : 'var(--bad)') + '">' + sinal(dC, 1) + '%</div></div>' +
    '<div class="mob-tile"><div class="mob-tile-k">Geração</div><div class="mob-tile-v">' + nf(tG, 1) + '</div>' +
    '<div class="mob-tile-s" style="color:' + (dG >= 0 ? 'var(--good)' : 'var(--bad)') + '">' + sinal(dG, 1) + '%</div></div></div>' +
    '<div class="mob-card">' +
    '<div class="mob-rowline"><span>Saldo do período</span><b class="mono">' + sinal(tG - tC, 1) + ' kWh</b></div>' +
    '<div class="mob-rowline"><span>Puxado da rede</span><b class="mono">' + nf(s.rede, 1) + ' kWh · ' + brl(s.rede * t) + '</b></div>' +
    '<div class="mob-rowline"><span>Coberto pelo sol</span><b class="mono">' + cobertos + ' de ' + saldos.length + '</b></div></div>' +
    notaBox('good', 'Melhor: ' + s.nomes[iM], sinal(saldos[iM], 1) + ' kWh de sobra') + '</div>';
}

function mAparelhos() {
  const eq = aparelhos(), total = soma(eq.map(e => e.kwh)) || 1, maxK = eq[0] ? eq[0].kwh : 1;
  const linhas = eq.slice(0, 8).map(e => '<div class="mob-card">' +
    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">' +
    '<b style="font-size:13.5px">' + esc(e.nome) + '</b><span class="mono" style="font-size:13px">' + brl(e.reais) + '</span></div>' +
    '<div class="eq-track" style="margin-top:9px"><i style="width:' + (e.kwh / maxK) * 100 + '%;background:' + e.cor + '"></i></div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--faint);margin-top:6px">' +
    '<span>' + nf(e.kwh) + ' kWh</span><span>' + pct((e.kwh / total) * 100) + ' do total</span></div></div>').join('');
  return '<div class="mob-col"><p class="rotulo-lc" style="margin-bottom:4px">Estimado por IA a partir do medidor</p>' + linhas + '</div>';
}

function mMetas() {
  const v = visao(), meta = metaAtual();
  const p = clamp((v.mtd.tc / meta) * 100, 0, 100);
  const acima = v.projConsumo > meta;
  const feed = alertas().slice(0, 4).map(a => '<div class="feed-item feed-item--' + a.tipo + '"><span class="feed-dot"></span>' +
    '<div><div style="font-size:13px;font-weight:600">' + esc(a.titulo) + '</div>' +
    '<div style="font-size:12px;color:var(--ink-2);margin-top:3px;line-height:1.45">' + esc(a.txt) + '</div></div></div>').join('');
  return '<div class="mob-col"><div class="mob-card">' +
    '<h2>Meta do mês</h2>' +
    '<div style="display:flex;align-items:baseline;gap:6px;margin-top:6px">' +
    '<span class="big" style="font-size:30px">' + nf(v.mtd.tc) + '</span>' +
    '<span style="font-size:13px;color:var(--faint)">de <b id="metaLbl">' + nf(meta) + '</b> kWh</span></div>' +
    '<div class="track" style="margin-top:12px"><i id="metaFill" style="width:' + p + '%;background:' + (acima ? 'var(--bad)' : 'var(--good)') + '"></i></div>' +
    '<div style="font-size:12px;color:var(--faint);margin-top:8px">' + pct((v.mtd.tc / meta) * 100) + ' da meta · projeção ' + nf(v.projConsumo) + ' kWh</div>' +
    '<input type="range" data-fid="meta" data-in="meta" min="80" max="2600" step="10" value="' + meta + '" aria-label="Meta mensal" style="accent-color:var(--good)">' +
    '<div style="font-size:13px;font-weight:600;margin-top:6px;color:' + (acima ? 'var(--bad)' : 'var(--good)') + '">' +
    (acima ? 'Deve estourar em ' + nf(v.projConsumo - meta) + ' kWh' : 'No ritmo atual você fecha dentro da meta') + '</div></div>' +
    feed + '</div>';
}

function mMais() {
  const menu = MMENU.map(x => '<button class="mob-menu" data-act="msub" data-k="' + x.k + '">' +
    '<span class="mob-menu-ic">' + ico(x.icon, 17, 'var(--sun-deep)', 1.9) + '</span>' +
    '<span style="flex:1;min-width:0"><span class="mob-menu-t" style="display:block">' + x.t + '</span>' +
    '<span class="mob-menu-s" style="display:block">' + x.s + '</span></span>' + ico(IC.chevron, 15, 'var(--n-400)', 2.2) + '</button>').join('');
  const uns = chavesUnidades().map(k => {
    const u = uni(k), at = S.perfil === k;
    return '<button class="mob-menu" data-act="unit" data-unit="' + k + '" style="border-color:' + (at ? 'var(--ink)' : 'var(--line)') + '">' +
      '<span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + (at ? 'var(--sun)' : 'var(--line-2)') + '"></span>' +
      '<span style="flex:1;min-width:0"><span class="mob-menu-t" style="display:block">' + esc(u.nome) + '</span>' +
      '<span class="mob-menu-s" style="display:block">' + esc(u.tipo) + '</span></span></button>';
  }).join('');
  /* Sem modo visitante, quem chegou aqui tem conta. A guarda continua
     porque a tela nao pode quebrar se for chamada fora do fluxo normal. */
  const s = sessao();
  const conta = !s ? '' :
    '<div class="mob-card" style="display:flex;align-items:center;gap:12px">' +
    '<span class="conta-av">' + esc((s.nome || '?').charAt(0).toUpperCase()) + '</span>' +
    '<span style="flex:1;min-width:0"><span class="mob-menu-t" style="display:block">' + esc(s.nome) + '</span>' +
    '<span class="mob-menu-s" style="display:block">' + esc(s.email || '') + '</span></span>' +
    '<button class="link-btn" data-act="sair">Sair</button></div>';
  return '<div class="mob-col">' + conta + menu +
    '<h2 style="margin-top:10px">Trocar de unidade</h2>' + uns + '</div>';
}

function mConta() {
  const v = visao(), u = unidade(), t = tarifaAtual(), l = v.linhaAtual;
  const faturado = Math.max(l.rede - l.usado, 0);
  const total = faturado * t + l.rede * 0.0189 + u.ilum;
  const semSolar = l.cons * t + l.cons * 0.0189 + u.ilum;
  const linhas = [
    ['Consumo no medidor', brl(l.cons * t)],
    ['Autoconsumo solar', '− ' + brl(l.auto * t)],
    ['Injetado na rede', '− ' + brl(l.inj * u.tarifaComp)],
    ['Créditos usados', '− ' + brl(l.usado * t)],
    ['Bandeira + iluminação', brl(l.rede * 0.0189 + u.ilum, 2)]
  ].map(x => '<div class="mob-rowline"><span>' + x[0] + '</span><b class="mono">' + x[1] + '</b></div>').join('');
  return '<div class="mob-col">' +
    '<div class="mob-hero"><div class="mob-hero-k">Total a pagar</div>' +
    '<div class="mob-hero-v"><span class="num" style="font-size:38px">' + brl(total) + '</span></div>' +
    '<div class="mob-hero-s">Sem os painéis seria ' + brl(semSolar) + '</div></div>' +
    '<div class="mob-card">' + linhas + '</div>' +
    notaBox('good', 'Você economizou ' + brl(v.economia) + ' neste mês', nf(v.co2, 1) + ' kg de CO₂ deixaram de ir para a atmosfera') + '</div>';
}

function mCadastro() {
  const u = unidade(), n = S.novo, e = estimativaNovo();
  const pode = n.nome.trim().length > 1;
  const coms = u.comodos.map(c => '<button class="chip" data-act="chip" data-campo="comodo" data-v="' + esc(c) + '" aria-pressed="' + (n.comodo === c) + '">' + c + '</button>').join('');
  return '<div class="mob-col"><div class="mob-card">' +
    '<label class="field-lbl" for="mNome">Nome</label>' +
    '<input class="text-in" id="mNome" data-fid="nome" data-in="nome" type="text" value="' + esc(n.nome) + '" placeholder="Ex.: Ar do quarto" autocomplete="off">' +
    '<div class="slider-head" style="margin-top:16px"><span class="field-lbl">Potência</span><span class="slider-val" id="potLbl">' + nf(n.pot) + ' W</span></div>' +
    '<input type="range" data-fid="pot" data-in="pot" min="20" max="12000" step="10" value="' + n.pot + '" aria-label="Potência">' +
    '<div class="slider-head" style="margin-top:12px"><span class="field-lbl">Horas por dia</span><span class="slider-val" id="horasLbl">' + nf(n.horas, 1) + ' h por dia</span></div>' +
    '<input type="range" data-fid="horas" data-in="horas" min="0.1" max="24" step="0.1" value="' + n.horas + '" aria-label="Horas por dia">' +
    '<div class="slider-head" style="margin-top:12px"><span class="field-lbl">Dias por mês</span><span class="slider-val" id="diasLbl">' + n.dias + ' dias por mês</span></div>' +
    '<input type="range" data-fid="dias" data-in="dias" min="1" max="31" step="1" value="' + n.dias + '" aria-label="Dias por mês"></div>' +
    '<div class="mob-card"><h3>Onde fica</h3><div class="chips">' + coms + '</div></div>' +
    '<div class="mob-hero"><div class="mob-hero-k">Estimativa</div>' +
    '<div class="mob-hero-v"><span class="num" style="font-size:36px" id="estKwh">' + nf(e.kwh, 1) + '</span><span class="cur" style="font-size:14px">kWh/mês</span></div>' +
    '<div style="font-size:17px;font-weight:600;color:var(--sun-lite);margin-top:6px" id="estCusto">' + brl(e.custo) + ' por mês</div>' +
    '<div style="font-size:12px;color:var(--on-dark-soft);margin-top:3px" id="estAno">' + brl(e.ano) + ' ao longo de um ano</div>' +
    '<div class="est-bar"><i id="estBar" style="width:' + e.pctBar + '%"></i></div>' +
    '<div style="font-size:11.5px;color:var(--on-dark-soft);margin-top:7px" id="estPct">' + textoEstimativa(e) + '</div>' +
    '<button class="dark-btn" data-act="salvar" style="width:100%;height:44px;margin-top:16px;border-radius:12px;' +
    (pode ? 'background:var(--on-dark);color:var(--dark)' : '') + '"' + (pode ? '' : ' disabled') + '>Adicionar aparelho</button>' +
    (S.salvo ? '<div class="saved">' + ico(IC.check, 14, 'currentColor', 2.6) + 'Cadastrado e já no ranking</div>' : '') +
    '</div></div>';
}

/* A simulacao no celular: os mesmos numeros do cartao amplo, em coluna. */
function mSimulacao() {
  const sim = simulacaoSolar(S.perfil);
  if (!sim) return '';
  return '<div class="mob-card"><h3>Vale a pena instalar?</h3>' +
    '<div class="mob-hero-v" style="margin-top:6px"><span class="num" style="font-size:30px;color:var(--ink)">' +
    brl(sim.economiaMes) + '</span></div>' +
    '<div style="font-size:12.5px;color:var(--muted);margin-top:2px">a menos por mês, de ' +
    brl(sim.contaHoje) + ' para ' + brl(sim.contaDepois) + '</div>' +
    '<div class="mob-rowline" style="margin-top:12px"><span>Sistema</span><b class="mono">' + nf(sim.kwp, 1) + ' kWp</b></div>' +
    '<div class="mob-rowline"><span>Investimento</span><b class="mono">' + brl(sim.investimento) + '</b></div>' +
    '<div class="mob-rowline"><span>Se paga em</span><b class="mono">' + (sim.paybackAnos ? nf(sim.paybackAnos, 1) + ' anos' : '—') + '</b></div>' +
    '<div style="font-size:11.5px;color:var(--faint);margin-top:10px;line-height:1.5">' +
    'Estimativa para decidir se vale pedir orçamento — não é orçamento.</div></div>';
}

function mConfig() {
  const v = visao(), u = unidade(), t = tarifaAtual();
  return '<div class="mob-col"><div class="mob-card">' +
    '<h2>Tarifa de energia</h2>' +
    '<div class="big" style="font-size:30px;margin-top:6px" id="tarLbl">R$ ' + nf(t, 2) + ' / kWh</div>' +
    '<input type="range" data-fid="tarifa" data-in="tarifa" min="40" max="160" step="1" value="' + Math.round(t * 100) + '" aria-label="Tarifa">' +
    (S.tarifa[S.perfil] != null ? '<button class="link-btn" style="margin-top:8px" data-act="reset-tarifa">Voltar para a tarifa da distribuidora</button>' : '') +
    '</div>' +
    '<div class="mob-card">' +
    '<div class="mob-rowline"><span>Cidade</span><b>' + esc(u.cidade ? (cidade(u.cidade) || {}).nome || '—' : '—') + '</b></div>' +
    '<div class="mob-rowline"><span>Distribuidora</span><b>' + esc(u.distribuidora) + '</b></div>' +
    '<div class="mob-rowline"><span>Compensação</span><b class="mono">R$ ' + nf(u.tarifaComp, 2) + '</b></div>' +
    (u.temSolar === false
      ? '<div class="mob-rowline"><span>Sistema solar</span><b>Ainda não instalado</b></div>'
      : '<div class="mob-rowline"><span>Potência</span><b class="mono">' + nf(u.potenciaKwp, 1) + ' kWp</b></div>' +
        '<div class="mob-rowline"><span>Painéis</span><b class="mono">' + u.paineis + '</b></div>') +
    '<div class="mob-rowline"><span>Mínimo faturado</span><b class="mono">' + u.minFatura + ' kWh</b></div></div>' +
    (u.temSolar === false
      ? mSimulacao()
      : '<div class="softbox" style="margin-top:0">Sem geração solar sua conta seria <b>' + brl(v.semSolarProj) + '</b> por mês.</div>') +
    '<button class="danger-btn" style="padding:10px 0" data-act="reset-tudo">Apagar meus dados</button></div>';
}
