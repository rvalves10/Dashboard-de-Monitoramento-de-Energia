/* ============================================================
   SOLARIS — motor
   Um medidor virtual que roda de verdade: curva solar calculada
   pela posição do sol na data, nuvens com ruído semeado, consumo
   hora a hora, compensação de créditos mês a mês.
   ============================================================ */
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const soma = a => a.reduce((x, y) => x + y, 0);

const nf = (v, d) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const brl = (v, d) => 'R$ ' + nf(v, d === undefined ? 0 : d);
const pct = (v, d) => nf(v, d === undefined ? 0 : d) + '%';
const sinal = (v, d) => (v >= 0 ? '+' : '−') + nf(Math.abs(v), d === undefined ? 0 : d);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAF = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diasNoMes = (y, m) => new Date(y, m + 1, 0).getDate();

/* ruído semeado — o mesmo dia sempre gera o mesmo tempo */
function semente(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function ruido(chave) {
  let a = semente(chave) | 0;
  a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
/* ruído suave: interpola entre âncoras a cada 4 passos */
function suave(chave, i, passo) {
  const p = passo || 4, base = Math.floor(i / p), t = (i % p) / p;
  const a = ruido(chave + ':' + base), b = ruido(chave + ':' + (base + 1));
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

/* ---------- unidades ---------- */
const LAT = -23.55 * Math.PI / 180; /* São Paulo */

/* Lei 14.300/2022 — marco legal da geração distribuída.
   Sistemas conectados até 06/01/2023 mantêm compensação integral até 2045
   ("direito adquirido"). Os conectados a partir de 07/01/2023 pagam um
   percentual crescente da componente TUSD Fio B sobre a energia compensada. */
const CORTE_DIREITO_ADQUIRIDO = new Date(2023, 0, 6);
const ESCADA_FIO_B = { 2023: .15, 2024: .30, 2025: .45, 2026: .60, 2027: .75, 2028: .90 };
function percentualFioB(ano, direitoAdquirido) {
  if (direitoAdquirido || ano <= 2022) return 0;
  return ESCADA_FIO_B[ano] !== undefined ? ESCADA_FIO_B[ano] : 1;
}

/* Irradiação global horizontal média, kWh/m² por dia, mês a mês.
   ATENÇÃO DO GRUPO: estes valores são um perfil típico do interior de São
   Paulo e precisam ser conferidos no Atlas Brasileiro de Energia Solar
   (INPE/LABREN) para a cidade real do projeto antes da banca. É o único
   número do motor que vem de fora — troque aqui e o resto se ajusta. */
const IRRADIACAO_SP = [5.9, 5.9, 5.2, 4.7, 4.0, 3.7, 3.9, 4.7, 4.8, 5.3, 5.8, 6.1];
const RAZAO_DESEMPENHO = 0.78; /* perdas de inversor, cabos, temperatura e sujeira */

const UNIDADES = {
  residencial: {
    chave: 'residencial', nome: 'Casa das Acácias', tipo: 'Residencial · 4 pessoas', curto: 'Residencial',
    distribuidora: 'Enel SP', tarifa: 0.92, tarifaComp: 0.79, fioB: 0.26, ilum: 22, minFatura: 50,
    potenciaKwp: 4.4, paineis: 10, investimento: 18400, mesesOperacao: 14,
    fatorInstalacao: 0.58, condicaoTelhado: 'telhado a oeste, sombra do prédio vizinho até as 9h',
    consumoMes: 320, geracaoMes: 285, metaPadrao: 300,
    consumoH: [.22, .20, .19, .19, .21, .30, .66, .88, .54, .37, .33, .35, .47, .51, .54, .57, .63, .76, .98, 1.12, .96, .70, .44, .27],
    semana: [1.13, .95, .95, .95, .95, .97, 1.10],
    comodos: ['Sala', 'Cozinha', 'Quarto', 'Banheiro suíte', 'Área de serviço', 'Externo'],
    /* share = fatia do consumo medido que a IA atribui ao aparelho.
       As horas de uso são deduzidas dela, para o ranking sempre fechar com o medidor. */
    equipamentos: [
      { id: 'ar', nome: 'Ar-condicionado', local: 'Sala', cat: 'Climatização', pot: 1200, share: .2875, cor: '#3E4C7A', conf: 'alta', fonte: 'ia', tend: 14 },
      { id: 'chu', nome: 'Chuveiro elétrico', local: 'Banheiro suíte', cat: 'Aquecimento', pot: 5500, share: .1906, cor: '#C4573C', conf: 'alta', fonte: 'ia', tend: -3 },
      { id: 'gel', nome: 'Geladeira', local: 'Cozinha', cat: 'Refrigeração', pot: 180, share: .15, cor: '#2E7A5A', conf: 'alta', fonte: 'ia', tend: 2 },
      { id: 'lav', nome: 'Máquina de lavar', local: 'Área de serviço', cat: 'Lavanderia', pot: 900, share: .0813, cor: '#7A6BA8', conf: 'média', fonte: 'ia', tend: 9 },
      { id: 'fre', nome: 'Freezer horizontal', local: 'Área de serviço', cat: 'Refrigeração', pot: 145, share: .0656, cor: '#4E8FA8', conf: 'alta', fonte: 'manual', tend: 0 },
      { id: 'for', nome: 'Forno e micro-ondas', local: 'Cozinha', cat: 'Cozinha', pot: 1400, share: .0563, cor: '#B4761B', conf: 'média', fonte: 'ia', tend: -6 },
      { id: 'luz', nome: 'Iluminação', local: 'Casa toda', cat: 'Iluminação', pot: 190, share: .0469, cor: '#EDA22B', conf: 'média', fonte: 'ia', tend: -1 },
      { id: 'tv', nome: 'TV e eletrônicos', local: 'Sala', cat: 'Eletrônicos', pot: 130, share: .0375, cor: '#8B8577', conf: 'média', fonte: 'ia', tend: 4 },
      { id: 'bom', nome: 'Bomba d’água', local: 'Externo', cat: 'Outros', pot: 750, share: .0281, cor: '#6B9E8E', conf: 'baixa', fonte: 'ia', tend: 0 }
    ],
    deteccoes: [
      { id: 'd1', palpite: 'Secadora de roupas', quando: 'terça, 21h04', kwh: 2.3, certeza: 78, pot: 1500, horas: 1.5, cat: 'Lavanderia' },
      { id: 'd2', palpite: 'Aquecedor de água', quando: 'domingo, 07h12', kwh: 1.1, certeza: 54, pot: 1200, horas: 0.9, cat: 'Aquecimento' }
    ]
  },
  negocio: {
    chave: 'negocio', nome: 'Padaria Pão de Ouro', tipo: 'Pequeno negócio · Centro', curto: 'Pequeno negócio',
    distribuidora: 'Enel SP', tarifa: 0.78, tarifaComp: 0.66, fioB: 0.22, ilum: 58, minFatura: 100,
    potenciaKwp: 18.6, paineis: 42, investimento: 96000, mesesOperacao: 22,
    fatorInstalacao: 0.55, condicaoTelhado: 'duas águas com inclinação baixa, caixa d’água sombreia parte da tarde',
    consumoMes: 1840, geracaoMes: 1150, metaPadrao: 1700,
    consumoH: [1.4, 1.3, 1.3, 2.9, 4.6, 5.2, 4.1, 3.4, 3.1, 3.0, 2.9, 3.2, 3.4, 3.1, 2.6, 2.3, 2.1, 1.9, 1.8, 1.7, 1.6, 1.5, 1.5, 1.4],
    semana: [.52, 1.04, 1.04, 1.04, 1.05, 1.08, 1.06],
    comodos: ['Produção', 'Atendimento', 'Estoque', 'Escritório', 'Externo'],
    equipamentos: [
      { id: 'for', nome: 'Forno de lastro', local: 'Produção', cat: 'Cozinha', pot: 12000, share: .2761, cor: '#C4573C', conf: 'alta', fonte: 'manual', tend: 3 },
      { id: 'cam', nome: 'Câmara fria', local: 'Estoque', cat: 'Refrigeração', pot: 2200, share: .2239, cor: '#4E8FA8', conf: 'alta', fonte: 'ia', tend: 11 },
      { id: 'arc', nome: 'Ar-condicionado salão', local: 'Atendimento', cat: 'Climatização', pot: 5300, share: .1571, cor: '#3E4C7A', conf: 'alta', fonte: 'ia', tend: 18 },
      { id: 'exp', nome: 'Expositores refrigerados', local: 'Atendimento', cat: 'Refrigeração', pot: 900, share: .1255, cor: '#2E7A5A', conf: 'alta', fonte: 'ia', tend: 1 },
      { id: 'mas', nome: 'Masseira e batedeira', local: 'Produção', cat: 'Cozinha', pot: 3000, share: .0804, cor: '#7A6BA8', conf: 'média', fonte: 'ia', tend: -4 },
      { id: 'luz', nome: 'Iluminação', local: 'Loja toda', cat: 'Iluminação', pot: 640, share: .0620, cor: '#EDA22B', conf: 'média', fonte: 'ia', tend: 0 },
      { id: 'caf', nome: 'Cafeteira industrial', local: 'Atendimento', cat: 'Cozinha', pot: 2400, share: .0342, cor: '#B4761B', conf: 'média', fonte: 'ia', tend: 6 }
    ],
    deteccoes: [
      { id: 'd1', palpite: 'Segundo freezer no estoque', quando: 'quinta, 04h40', kwh: 6.8, certeza: 71, pot: 400, horas: 17, cat: 'Refrigeração' }
    ]
  }
};

/* perfis horários por categoria (peso relativo em 24 h) */
const PERFIS = {
  'Refrigeração': [.9, .85, .8, .8, .8, .85, .95, 1, 1.05, 1.05, 1.1, 1.15, 1.2, 1.2, 1.15, 1.1, 1.1, 1.15, 1.2, 1.2, 1.1, 1, .95, .9],
  'Climatização': [.5, .4, .3, .25, .2, .2, .15, .2, .3, .4, .55, .7, .9, 1.05, 1.2, 1.3, 1.35, 1.3, 1.2, 1.15, 1.1, 1, .85, .7],
  'Aquecimento': [.02, .01, .01, .01, .02, .1, .5, 1.2, .9, .3, .15, .1, .12, .12, .15, .2, .4, .9, 1.3, 1.1, .6, .3, .1, .04],
  'Cozinha': [.05, .02, .02, .02, .03, .1, .4, .6, .4, .3, .5, 1.1, 1.3, .7, .35, .3, .5, .9, 1.3, 1, .5, .25, .12, .06],
  'Lavanderia': [.02, .01, .01, .01, .02, .05, .3, .7, 1.1, 1.3, 1.2, 1, .8, .7, .6, .5, .4, .3, .2, .15, .1, .06, .04, .03],
  'Iluminação': [.15, .1, .08, .08, .08, .15, .35, .3, .15, .08, .06, .05, .05, .05, .06, .1, .35, .9, 1.3, 1.35, 1.2, .9, .55, .3],
  'Eletrônicos': [.2, .12, .08, .06, .06, .1, .3, .5, .5, .5, .5, .55, .6, .6, .6, .65, .8, 1, 1.25, 1.35, 1.3, 1, .6, .35],
  'Outros': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
};
/* a padaria acorda cedo */
const PERFIS_NEGOCIO = {
  'Cozinha': [.1, .1, .4, 1.35, 1.4, 1.3, 1.1, .8, .6, .5, .5, .6, .7, .6, .4, .35, .3, .25, .2, .15, .12, .1, .1, .1],
  'Iluminação': [.1, .1, .3, .9, 1.2, 1.3, 1.3, 1.25, 1.2, 1.2, 1.2, 1.2, 1.2, 1.15, 1.1, 1, .9, .8, .6, .3, .15, .1, .1, .1],
  'Climatização': [.05, .05, .05, .1, .2, .35, .6, .9, 1.1, 1.2, 1.3, 1.35, 1.35, 1.3, 1.2, 1.05, .9, .7, .4, .2, .1, .07, .05, .05]
};
const CATS = ['Climatização', 'Refrigeração', 'Aquecimento', 'Cozinha', 'Lavanderia', 'Iluminação', 'Eletrônicos', 'Outros'];
const CORES_EXTRA = ['#7A6BA8', '#4E8FA8', '#6B9E8E', '#B4761B', '#C4573C', '#3E4C7A', '#2E7A5A'];

function perfilCat(unidade, cat) {
  const p = (unidade.chave === 'negocio' && PERFIS_NEGOCIO[cat]) || PERFIS[cat] || PERFIS['Outros'];
  const t = soma(p);
  return p.map(v => v / t);
}

/* ---------- sol: janela de luz calculada pela data ---------- */
function diaDoAno(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}
function janelaSolar(d) {
  const decl = 0.4093 * Math.sin(2 * Math.PI * (284 + diaDoAno(d)) / 365);
  const ha = Math.acos(clamp(-Math.tan(LAT) * Math.tan(decl), -1, 1));
  const meio = 12.2, meiaJornada = ha * 12 / Math.PI;
  return { nascer: meio - meiaJornada, por: meio + meiaJornada, meio: meio };
}
/* forma horária da geração: 24 pesos somando 1 */
function formaSolar(d) {
  const j = janelaSolar(d), out = [];
  for (let hr = 0; hr < 24; hr++) {
    const t = hr + 0.5;
    if (t <= j.nascer || t >= j.por) { out.push(0); continue; }
    const x = (t - j.nascer) / (j.por - j.nascer);
    out.push(Math.pow(Math.sin(Math.PI * x), 1.28));
  }
  const t = soma(out) || 1;
  return out.map(v => v / t);
}
/* nuvens do dia: 0,25 (fechado) a 1,05 (céu limpo) */
function tempoDoDia(chave, d) {
  const idx = Math.round(d.getTime() / 86400000);
  let c = 0.48 + 0.57 * suave(chave + '|ceu', idx, 3);
  if (ruido(chave + '|chuva' + idx) < 0.13) c *= 0.42;
  return clamp(c, 0.18, 1.06);
}

/* ---------- mês simulado (memoizado) ---------- */
const _cacheMes = new Map();
function mesSimulado(chave, y, m) {
  const ck = chave + '|' + y + '|' + m;
  if (_cacheMes.has(ck)) return _cacheMes.get(ck);
  const u = UNIDADES[chave], nd = diasNoMes(y, m);

  const sazG = 1 + 0.19 * Math.cos(2 * Math.PI * (m - 11) / 12);
  const sazC = 1 + 0.15 * Math.cos(2 * Math.PI * m / 12);
  const alvoG = u.geracaoMes * sazG, alvoC = u.consumoMes * sazC;

  const formaC = u.consumoH.slice(), somaFC = soma(formaC);
  const brutoG = [], brutoC = [], formasG = [];
  for (let i = 0; i < nd; i++) {
    const d = new Date(y, m, i + 1);
    formasG.push(formaSolar(d));
    brutoG.push(tempoDoDia(chave, d));
    const idx = Math.round(d.getTime() / 86400000);
    brutoC.push((0.87 + 0.27 * suave(chave + '|uso', idx, 3)) * u.semana[d.getDay()]);
  }
  const kG = alvoG / (soma(brutoG) || 1), kC = alvoC / (soma(brutoC) || 1);

  const dias = [];
  for (let i = 0; i < nd; i++) {
    const totG = brutoG[i] * kG, totC = brutoC[i] * kC;
    const ger = formasG[i].map(v => v * totG);
    const idx = Math.round(new Date(y, m, i + 1).getTime() / 86400000);
    let cons = formaC.map((v, hr) => (v / somaFC) * totC * (0.9 + 0.2 * ruido(chave + '|h' + idx + '_' + hr)));
    const kk = totC / (soma(cons) || 1);
    cons = cons.map(v => v * kk);
    let auto = 0, inj = 0, rede = 0;
    for (let hr = 0; hr < 24; hr++) {
      auto += Math.min(cons[hr], ger[hr]);
      inj += Math.max(0, ger[hr] - cons[hr]);
      rede += Math.max(0, cons[hr] - ger[hr]);
    }
    dias.push({ dia: i + 1, dow: new Date(y, m, i + 1).getDay(), cons: cons, ger: ger, tc: totC, tg: totG, auto: auto, inj: inj, rede: rede });
  }
  const r = {
    y: y, m: m, nd: nd, dias: dias,
    tc: soma(dias.map(d => d.tc)), tg: soma(dias.map(d => d.tg)),
    auto: soma(dias.map(d => d.auto)), inj: soma(dias.map(d => d.inj)), rede: soma(dias.map(d => d.rede))
  };
  _cacheMes.set(ck, r);
  return r;
}

/* soma parcial de um mês até "horas" decorridas */
function ate(md, horas) {
  const r = { tc: 0, tg: 0, auto: 0, inj: 0, rede: 0, dias: 0 };
  if (horas == null) horas = md.nd * 24;
  for (let i = 0; i < md.nd; i++) {
    const d = md.dias[i];
    const ini = i * 24;
    if (ini >= horas) break;
    const fim = Math.min(24, horas - ini);
    if (fim >= 24) { r.tc += d.tc; r.tg += d.tg; r.auto += d.auto; r.inj += d.inj; r.rede += d.rede; r.dias++; continue; }
    for (let hr = 0; hr < 24; hr++) {
      const f = clamp(fim - hr, 0, 1);
      if (f <= 0) break;
      const c = d.cons[hr] * f, g = d.ger[hr] * f;
      r.tc += c; r.tg += g;
      r.auto += Math.min(c, g); r.inj += Math.max(0, g - c); r.rede += Math.max(0, c - g);
    }
    r.dias += fim / 24;
  }
  return r;
}

/* data em que a unidade entrou em operação, deduzida dos meses de operação */
function inicioOperacao(chave) {
  const u = UNIDADES[chave], d = agora();
  return new Date(d.getFullYear(), d.getMonth() - (u.mesesOperacao - 1), 1);
}
function temDireitoAdquirido(chave) {
  return inicioOperacao(chave) <= CORTE_DIREITO_ADQUIRIDO;
}
/* Dois patamares diferentes, e a distinção importa:
   - potencial da região: o que um telhado ideal (voltado ao norte, sem sombra)
     entregaria com essa potência instalada;
   - esperado: o que ESTE telhado entrega, dada orientação e sombreamento.
   Comparar a geração real contra o esperado mede saúde operacional (sujeira,
   inversor, falha). Comparar contra o potencial mede qualidade da instalação. */
function potencialRegiao(chave, m, nd) {
  const u = UNIDADES[chave];
  return u.potenciaKwp * IRRADIACAO_SP[m] * RAZAO_DESEMPENHO * nd;
}
function geracaoEsperada(chave, m, nd) {
  return potencialRegiao(chave, m, nd) * UNIDADES[chave].fatorInstalacao;
}

/* ---------- livro de créditos: compensação mês a mês ---------- */
const _cacheLedger = new Map();
function ledger(chave, ate_y, ate_m, horasUltimo) {
  const ck = chave + '|' + ate_y + '|' + ate_m + '|' + (horasUltimo == null ? 'cheio' : Math.floor(horasUltimo));
  if (_cacheLedger.has(ck)) return _cacheLedger.get(ck);
  const u = UNIDADES[chave];
  const fim = ate_y * 12 + ate_m;
  const ini = fim - (u.mesesOperacao - 1);
  const adq = temDireitoAdquirido(chave);
  let creditos = 0, economiaTotal = 0, fioBTotal = 0;
  const linhas = [];
  for (let k = ini; k <= fim; k++) {
    const y = Math.floor(k / 12), m = k - y * 12;
    const md = mesSimulado(chave, y, m);
    const p = (k === fim) ? ate(md, horasUltimo) : ate(md, null);
    creditos += p.inj;
    /* o mínimo faturável (custo de disponibilidade) nunca é abatido por crédito */
    const usado = Math.min(creditos, Math.max(0, p.rede - u.minFatura));
    creditos -= usado;
    const faturado = p.rede - usado;

    /* Lei 14.300: paga-se Fio B sobre a energia compensada */
    const perc = percentualFioB(y, adq);
    const fioB = usado * u.fioB * perc;
    fioBTotal += fioB;

    /* economia real = energia que deixou de ser comprada, menos o Fio B */
    const economia = (p.auto + usado) * u.tarifa - fioB;
    economiaTotal += economia;

    linhas.push({
      y: y, m: m, k: k, cons: p.tc, ger: p.tg, auto: p.auto, inj: p.inj, rede: p.rede,
      usado: usado, faturado: faturado, fioB: fioB, percFioB: perc,
      economia: economia, creditos: creditos
    });
  }
  const r = { linhas: linhas, creditos: creditos, economiaTotal: economiaTotal, fioBTotal: fioBTotal, direitoAdquirido: adq };
  _cacheLedger.set(ck, r);
  return r;
}

/* ---------- estado ---------- */
const CHAVE_LS = 'solaris.v2';
const PADRAO = {
  perfil: 'residencial', tela: 'painel', periodo: 'mes', vista: 'desktop',
  tab: 'painel', msub: null, detalhe: null,
  metas: { residencial: 300, negocio: 1700 },
  regras: { meta: true, salto: true, solar: true, standby: false },
  tarifa: { residencial: null, negocio: null },
  extras: [], removidos: [], respondidas: {}, dispensados: [],
  novo: { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: 'Sala' },
  editando: null, salvo: false
};
let S = JSON.parse(JSON.stringify(PADRAO));

function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE_LS);
    if (!raw) return;
    const o = JSON.parse(raw);
    Object.keys(PADRAO).forEach(k => {
      if (o[k] === undefined) return;
      if (k === 'metas' || k === 'regras' || k === 'tarifa' || k === 'novo' || k === 'respondidas') S[k] = Object.assign({}, PADRAO[k], o[k]);
      else S[k] = o[k];
    });
    S.salvo = false;
  } catch (e) { /* armazenamento indisponível: segue com os padrões */ }
}
let _tsave = 0;
function salvar() {
  clearTimeout(_tsave);
  _tsave = setTimeout(() => {
    try { localStorage.setItem(CHAVE_LS, JSON.stringify(S)); } catch (e) { }
  }, 180);
}

/* ---------- visão consolidada ---------- */
function unidade() { return UNIDADES[S.perfil]; }
function tarifaAtual() { const u = unidade(); return S.tarifa[S.perfil] != null ? S.tarifa[S.perfil] : u.tarifa; }

function agora() { return new Date(); }
function horasDecorridas(d) { return (d.getDate() - 1) * 24 + d.getHours() + d.getMinutes() / 60; }

/* A desagregação sempre fecha com o medidor: os aparelhos da IA ocupam a fatia
   que lhes cabe da projeção do mês, os cadastrados à mão entram com o consumo
   informado, e o que sobra vira "Não identificado". */
function aparelhos() {
  const u = unidade(), t = tarifaAtual(), v = visao(), nd = v.nd;
  const nativos = u.equipamentos.filter(e => S.removidos.indexOf(S.perfil + ':' + e.id) < 0);
  const extras = S.extras.filter(e => e.perfil === S.perfil)
    .map(e => Object.assign({}, e, { kwh: (e.pot / 1000) * e.horas * e.dias }));

  const restante = Math.max(0, v.projConsumo - soma(extras.map(e => e.kwh)));
  const bruto = nativos.map(e => e.share * v.projConsumo);
  const somaBruto = soma(bruto);
  const k = somaBruto > 0 ? Math.min(1, restante / somaBruto) : 0;

  const lista = nativos.map((e, i) => {
    const kwh = bruto[i] * k;
    return Object.assign({}, e, {
      kwh: kwh, dias: nd,
      horas: e.pot > 0 ? (kwh * 1000) / (e.pot * nd) : 0
    });
  }).concat(extras);

  const nid = Math.max(0, restante - somaBruto * k);
  if (nid > 0.5) {
    lista.push({
      id: 'nid', nome: 'Não identificado', local: '—', cat: 'Outros', pot: 0, horas: 0, dias: 0,
      cor: '#C9C2B2', conf: 'baixa', fonte: 'ia', tend: 5, kwh: nid, sintetico: true
    });
  }
  lista.sort((a, b) => b.kwh - a.kwh);
  lista.forEach(e => { e.reais = e.kwh * t; });
  return lista;
}

/* quanto os aparelhos cadastrados à mão passam do que o medidor registra (0 = tudo certo) */
function extrasExcedem() {
  const s = soma(S.extras.filter(e => e.perfil === S.perfil).map(e => (e.pot / 1000) * e.horas * e.dias));
  const p = visao().projConsumo;
  return s > p ? s - p : 0;
}

let _visao = null, _visaoHora = -1;
function visao(forcar) {
  const d = agora();
  const marca = d.getFullYear() * 1e6 + d.getMonth() * 1e4 + d.getDate() * 100 + d.getHours();
  if (!forcar && _visao && _visaoHora === marca && _visao.perfil === S.perfil && _visao.tarifa === tarifaAtual()) return _visao;

  const u = unidade(), t = tarifaAtual();
  const y = d.getFullYear(), m = d.getMonth();
  const hDec = horasDecorridas(d);
  const md = mesSimulado(S.perfil, y, m);
  const mtd = ate(md, hDec);
  const cheio = ate(md, null);
  const lg = ledger(S.perfil, y, m, hDec);
  const atual = lg.linhas[lg.linhas.length - 1];
  const anteriores = lg.linhas.slice(0, -1);

  /* A projeção é o mês inteiro já simulado — o que passou mais o que falta.
     Extrapolar a média do que decorreu explodia no dia 1º, quando há
     poucas horas medidas para dividir. */
  const fracao = clamp(hDec / (md.nd * 24), 0.001, 1);
  const lgFim = ledger(S.perfil, y, m, null);
  const fim = lgFim.linhas[lgFim.linhas.length - 1];
  const projConsumo = cheio.tc;
  const projGeracao = cheio.tg;
  const projRede = cheio.rede;
  const projInj = cheio.inj;

  const economia = atual.economia;
  const economiaCheia = fim.economia;
  const anteriorEcon = anteriores.length ? anteriores[anteriores.length - 1].economia : economia;

  const bandeira = mtd.rede * 0.0189;
  const projUsado = fim.usado;
  const projFaturado = fim.faturado;
  const projFioB = fim.fioB;
  const contaProj = projFaturado * t + projRede * 0.0189 + u.ilum + projFioB;
  const semSolarProj = Math.max(projConsumo, u.minFatura) * t + projConsumo * 0.0189 + u.ilum;

  /* quanto o sistema entrega em relação ao que o telhado poderia entregar */
  const potencial = potencialRegiao(S.perfil, m, md.nd);
  const esperada = geracaoEsperada(S.perfil, m, md.nd);
  const desempenho = esperada > 0 ? (cheio.tg / esperada) * 100 : 0;
  const aproveitaTelhado = potencial > 0 ? (esperada / potencial) * 100 : 0;

  const autoPct = mtd.tc > 0 ? (mtd.auto / mtd.tc) * 100 : 0;
  const co2 = mtd.tg * 0.0861;

  _visao = {
    perfil: S.perfil, tarifa: t, data: d, y: y, m: m, nd: md.nd, hDec: hDec, fracao: fracao,
    md: md, mtd: mtd, cheio: cheio, ledger: lg, linhaAtual: atual, anteriores: anteriores,
    projConsumo: projConsumo, projGeracao: projGeracao, projRede: projRede, projInj: projInj,
    projUsado: projUsado, projFaturado: projFaturado, projFioB: projFioB,
    potencial: potencial, esperada: esperada, desempenho: desempenho, aproveitaTelhado: aproveitaTelhado,
    percFioB: fim.percFioB, direitoAdquirido: lg.direitoAdquirido, fioBTotal: lg.fioBTotal,
    economia: economia, economiaCheia: economiaCheia, anteriorEcon: anteriorEcon,
    creditos: lg.creditos, economiaTotal: lg.economiaTotal,
    bandeira: bandeira, contaProj: contaProj, semSolarProj: semSolarProj,
    autoPct: autoPct, co2: co2
  };
  _visaoHora = marca;
  return _visao;
}

/* potência instantânea — interpola a curva do dia e treme um pouco.
   De vez em quando um aparelho pesado liga: é o surto. */
let _jitterC = 1, _jitterG = 1, _surto = 0;
function surtoAtivo() { return _surto > 0; }
function pulso() {
  if (_surto > 0) _surto--;
  else if (Math.random() < 0.014) _surto = 5 + Math.floor(Math.random() * 7);
  const alvo = _surto > 0 ? 1.9 + Math.random() * 0.5 : 1;
  _jitterC = clamp(_jitterC + (alvo - _jitterC) * 0.38 + (Math.random() - 0.5) * 0.07, 0.82, 2.5);
  _jitterG = clamp(_jitterG + (Math.random() - 0.5) * 0.06, 0.9, 1.08);
}
function potenciaAgora() {
  const d = agora(), v = visao();
  const dia = v.md.dias[Math.min(d.getDate() - 1, v.md.nd - 1)];
  const hr = d.getHours(), f = d.getMinutes() / 60;
  const lerp = arr => arr[hr] * (1 - f) + arr[Math.min(23, hr + 1)] * f;
  const c = Math.max(0.02, lerp(dia.cons) * _jitterC);
  const g = Math.max(0, lerp(dia.ger) * _jitterG);
  return { cons: c, ger: g, rede: Math.max(0, c - g), inj: Math.max(0, g - c), hora: hr + f };
}

/* série do período selecionado */
function seriePeriodo() {
  const v = visao(), d = v.data;
  if (S.periodo === 'dia') {
    const dia = v.md.dias[d.getDate() - 1];
    const ha = Math.max(1, Math.ceil(v.hDec - (d.getDate() - 1) * 24));
    return {
      rotulo: 'Hoje, hora a hora', unidade: 'hora',
      cons: dia.cons.slice(0, ha), ger: dia.ger.slice(0, ha),
      rede: soma(dia.cons.slice(0, ha).map((c, i) => Math.max(0, c - dia.ger[i]))),
      labels: dia.cons.slice(0, ha).map((_, i) => i % 3 === 0 ? String(i).padStart(2, '0') + 'h' : ''),
      nomes: dia.cons.map((_, i) => String(i).padStart(2, '0') + 'h'),
      anterior: (() => { const p = new Date(d); p.setDate(d.getDate() - 1); const pm = mesSimulado(S.perfil, p.getFullYear(), p.getMonth()); const pd = pm.dias[p.getDate() - 1]; const n = Math.max(1, ha); return { c: soma(pd.cons.slice(0, n)), g: soma(pd.ger.slice(0, n)) }; })()
    };
  }
  if (S.periodo === 'semana') {
    const cons = [], ger = [], labels = [], nomes = [];
    let ac = 0, ag = 0, redeTot = 0;
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d); dd.setDate(d.getDate() - i);
      const mm = mesSimulado(S.perfil, dd.getFullYear(), dd.getMonth());
      const dia = mm.dias[dd.getDate() - 1];
      const parcial = i === 0 ? (d.getHours() + d.getMinutes() / 60) : 24;
      let c = 0, g = 0;
      for (let hr = 0; hr < 24; hr++) {
        const f = clamp(parcial - hr, 0, 1);
        c += dia.cons[hr] * f; g += dia.ger[hr] * f;
        redeTot += Math.max(0, dia.cons[hr] - dia.ger[hr]) * f;
      }
      cons.push(c); ger.push(g);
      labels.push(DIA3[dd.getDay()]); nomes.push(DIAF[dd.getDay()] + ', ' + dd.getDate() + '/' + (dd.getMonth() + 1));
      const pd = new Date(dd); pd.setDate(dd.getDate() - 7);
      const pm = mesSimulado(S.perfil, pd.getFullYear(), pd.getMonth());
      const pdia = pm.dias[pd.getDate() - 1];
      ac += pdia.tc; ag += pdia.tg;
    }
    return { rotulo: 'Últimos 7 dias', unidade: 'dia', cons: cons, ger: ger, rede: redeTot, labels: labels, nomes: nomes, anterior: { c: ac, g: ag } };
  }
  const nDias = Math.ceil(v.hDec / 24);
  const cons = [], ger = [], labels = [], nomes = [];
  for (let i = 0; i < nDias; i++) {
    const dia = v.md.dias[i];
    const parcial = i === nDias - 1 ? (v.hDec - i * 24) : 24;
    let c = 0, g = 0;
    for (let hr = 0; hr < 24; hr++) { const f = clamp(parcial - hr, 0, 1); c += dia.cons[hr] * f; g += dia.ger[hr] * f; }
    cons.push(c); ger.push(g);
    labels.push((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '');
    nomes.push(dia.dia + ' de ' + MESES[v.m]);
  }
  const pk = v.y * 12 + v.m - 1, py = Math.floor(pk / 12), pm2 = pk - py * 12;
  const ant = ate(mesSimulado(S.perfil, py, pm2), Math.min(v.hDec, diasNoMes(py, pm2) * 24));
  return { rotulo: MESES[v.m].charAt(0).toUpperCase() + MESES[v.m].slice(1) + ', dia a dia', unidade: 'dia', cons: cons, ger: ger, rede: v.mtd.rede, labels: labels, nomes: nomes, anterior: { c: ant.tc, g: ant.tg } };
}

/* caminho SVG */
function caminho(vals, max, w, hh, fechar) {
  const n = vals.length; if (n < 2) return '';
  const passo = w / (n - 1);
  let d = '';
  vals.forEach((v, i) => {
    const x = +(i * passo).toFixed(1), y = +(hh - (v / max) * hh).toFixed(1);
    d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
  });
  if (fechar) d += 'L' + w + ' ' + hh + ' L0 ' + hh + ' Z';
  return d.trim();
}

/* alertas derivados do estado real */
function alertas() {
  const v = visao(), u = unidade(), t = tarifaAtual(), eq = aparelhos();
  const meta = S.metas[S.perfil], proj = v.projConsumo;
  const out = [];
  if (S.regras.meta) {
    if (proj > meta) out.push({ id: 'meta', tipo: 'alto', titulo: 'A meta de ' + nf(meta) + ' kWh deve estourar', quando: 'projeção de agora', txt: 'No ritmo de hoje o mês fecha em ' + nf(proj) + ' kWh — ' + nf(proj - meta) + ' kWh acima, cerca de ' + brl((proj - meta) * t) + ' a mais na conta. Cortar ' + nf((proj - meta) / Math.max(1, v.nd - v.mtd.dias), 1) + ' kWh por dia até o fim do mês já resolve.' });
    else if (meta - proj > meta * 0.2) out.push({ id: 'meta', tipo: 'bom', titulo: 'Meta folgada: sobram ' + nf(meta - proj) + ' kWh', quando: 'projeção de agora', txt: 'O mês deve fechar bem abaixo do limite. Dá para apertar a meta e economizar mais — ou usar a folga nos dias quentes.' });
    else out.push({ id: 'meta', tipo: 'bom', titulo: 'No caminho certo para bater a meta', quando: 'projeção de agora', txt: 'A projeção fecha em ' + nf(proj) + ' kWh, dentro dos ' + nf(meta) + ' kWh definidos.' });
  }
  if (S.regras.salto) {
    const alta = eq.filter(e => !e.sintetico && e.tend >= 10).sort((a, b) => b.tend - a.tend)[0];
    if (alta) out.push({ id: 'salto-' + alta.id, tipo: 'alto', titulo: alta.nome + ' subiu ' + alta.tend + '%', quando: 'contra a média de 4 semanas', txt: 'São ' + brl(alta.kwh * t * (alta.tend / 100)) + ' a mais no mês. O aparelho responde por ' + pct((alta.kwh / v.projConsumo) * 100) + ' de tudo que a unidade gasta.' });
  }
  if (S.regras.solar) {
    const dia = v.md.dias[v.data.getDate() - 1];
    let noite = 0, tot = 0;
    for (let hr = 0; hr < 24; hr++) { tot += dia.cons[hr]; if (dia.ger[hr] < dia.cons[hr] * 0.2) noite += dia.cons[hr]; }
    const p = tot > 0 ? (noite / tot) * 100 : 0;
    out.push({ id: 'solar', tipo: p > 55 ? 'medio' : 'bom', titulo: p > 55 ? pct(p) + ' do consumo cai fora do sol' : 'Bom aproveitamento do sol hoje', quando: 'hoje', txt: p > 55 ? 'Boa parte do gasto acontece quando os painéis já não produzem, então vem da rede. Puxar a máquina de lavar ou o forno para a faixa das 10h às 15h troca rede por sol.' : 'A maior parte do consumo está caindo dentro da janela de geração — é o cenário em que o painel paga a conta na hora.' });
  }
  if (S.regras.standby) {
    const dia = v.md.dias[v.data.getDate() - 1];
    const madrugada = soma(dia.cons.slice(0, 5));
    out.push({ id: 'standby', tipo: 'medio', titulo: 'Madrugada consumiu ' + nf(madrugada, 1) + ' kWh', quando: 'entre 0h e 5h', txt: 'Com quase tudo desligado, esse piso é o standby da casa: ' + brl(madrugada * 30 * t) + ' por mês só de aparelhos em espera.' });
  }
  const melhor = v.md.dias.slice(0, Math.ceil(v.hDec / 24)).slice().sort((a, b) => b.tg - a.tg)[0];
  if (melhor) out.push({ id: 'melhor', tipo: 'bom', titulo: 'Melhor dia de geração do mês', quando: 'dia ' + melhor.dia, txt: 'Os painéis entregaram ' + nf(melhor.tg, 1) + ' kWh — céu limpo praticamente o dia inteiro.' });

  /* dispensar vale pelo dia: amanhã o alerta volta se a situação continuar */
  return out.map(a => Object.assign(a, { chave: chaveDispensa(a.id) }))
    .filter(a => S.dispensados.indexOf(a.chave) < 0);
}
function chaveDispensa(id) {
  const d = agora();
  return S.perfil + ':' + id + ':' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
/* quantos alertas graves estão de pé — vira o contador do menu */
function alertasGraves() {
  return alertas().filter(a => a.tipo === 'alto').length;
}

function deteccoesPendentes() {
  return unidade().deteccoes.filter(x => !S.respondidas[S.perfil + ':' + x.id]);
}

function saudacao() {
  const hr = agora().getHours();
  return (hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite') + ', Marina';
}
