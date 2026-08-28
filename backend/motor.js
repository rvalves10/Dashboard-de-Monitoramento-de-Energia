/* motor.js — onde os numeros nascem

   Este e o coracao do projeto e a parte que a banca vai questionar. Nada
   aqui e digitado: tudo e calculado.

   O que ele faz, em ordem:

   1. Descobre onde o sol esta. A declinacao solar depende da data, entao a
      janela de luz encurta no inverno sozinha, sem ninguem mexer.

   2. Poe nuvem no ceu. Um gerador de ruido com semente fixa: o dia 12 de
      junho sempre tem o mesmo tempo, mas cada dia e diferente do outro.
      Isso deixa a simulacao realista e reproduzivel ao mesmo tempo.

   3. Cruza geracao e consumo hora a hora. O que o painel gera e a casa usa
      na mesma hora e autoconsumo; o que sobra vai para a rede; o que falta
      vem da rede. Somando as 24 horas sai o mes.

   4. Faz a conta de luz de verdade. Compensa credito mes a mes, respeita o
      minimo faturavel (que credito nao abate) e cobra o Fio B da Lei
      14.300 sobre a energia compensada.

   5. Reparte o consumo entre os aparelhos. Cada aparelho tem uma fatia do
      medidor, e as horas de uso sao deduzidas dela. Por isso o ranking
      sempre fecha com a leitura, nunca sobra nem falta.

   Aqui tambem mora o estado do site (o objeto S) e a gravacao no banco.
*/
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

/* Lê número digitado em português. O ponto é ambíguo: em "1.05" é decimal,
   em "26.000" é milhar. A regra que resolve:
   - se há vírgula, ela é o decimal e todo ponto é milhar;
   - sem vírgula, pontos só são milhar quando separam grupos de três dígitos. */
function numeroBR(txt) {
  const t = String(txt == null ? '' : txt).trim().replace(/\s/g, '');
  if (!t) return 0;
  let limpo;
  if (t.indexOf(',') >= 0) limpo = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) limpo = t.replace(/\./g, '');
  else limpo = t;
  const n = Number(limpo);
  return isFinite(n) ? n : 0;
}

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

const UNIDADES_BASE = {
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
      { id: 'ar', nome: 'Ar-condicionado', local: 'Sala', cat: 'Climatização', pot: 1200, share: .2875, cor: '#2A78D6', conf: 'alta', fonte: 'ia', tend: 14 },
      { id: 'chu', nome: 'Chuveiro elétrico', local: 'Banheiro suíte', cat: 'Aquecimento', pot: 5500, share: .1906, cor: '#E34948', conf: 'alta', fonte: 'ia', tend: -3 },
      { id: 'gel', nome: 'Geladeira', local: 'Cozinha', cat: 'Refrigeração', pot: 180, share: .15, cor: '#0F8F61', conf: 'alta', fonte: 'ia', tend: 2 },
      { id: 'lav', nome: 'Máquina de lavar', local: 'Área de serviço', cat: 'Lavanderia', pot: 900, share: .0813, cor: '#4A3AA7', conf: 'média', fonte: 'ia', tend: 9 },
      { id: 'fre', nome: 'Freezer horizontal', local: 'Área de serviço', cat: 'Refrigeração', pot: 145, share: .0656, cor: '#0B7FA3', conf: 'alta', fonte: 'manual', tend: 0 },
      { id: 'for', nome: 'Forno e micro-ondas', local: 'Cozinha', cat: 'Cozinha', pot: 1400, share: .0563, cor: '#C94F7C', conf: 'média', fonte: 'ia', tend: -6 },
      { id: 'luz', nome: 'Iluminação', local: 'Casa toda', cat: 'Iluminação', pot: 190, share: .0469, cor: '#008300', conf: 'média', fonte: 'ia', tend: -1 },
      { id: 'tv', nome: 'TV e eletrônicos', local: 'Sala', cat: 'Eletrônicos', pot: 130, share: .0375, cor: '#5B6570', conf: 'média', fonte: 'ia', tend: 4 },
      { id: 'bom', nome: 'Bomba d’água', local: 'Externo', cat: 'Outros', pot: 750, share: .0281, cor: '#98A0A9', conf: 'baixa', fonte: 'ia', tend: 0 }
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
      { id: 'for', nome: 'Forno de lastro', local: 'Produção', cat: 'Cozinha', pot: 12000, share: .2761, cor: '#E34948', conf: 'alta', fonte: 'manual', tend: 3 },
      { id: 'cam', nome: 'Câmara fria', local: 'Estoque', cat: 'Refrigeração', pot: 2200, share: .2239, cor: '#0B7FA3', conf: 'alta', fonte: 'ia', tend: 11 },
      { id: 'arc', nome: 'Ar-condicionado salão', local: 'Atendimento', cat: 'Climatização', pot: 5300, share: .1571, cor: '#2A78D6', conf: 'alta', fonte: 'ia', tend: 18 },
      { id: 'exp', nome: 'Expositores refrigerados', local: 'Atendimento', cat: 'Refrigeração', pot: 900, share: .1255, cor: '#0F8F61', conf: 'alta', fonte: 'ia', tend: 1 },
      { id: 'mas', nome: 'Masseira e batedeira', local: 'Produção', cat: 'Cozinha', pot: 3000, share: .0804, cor: '#4A3AA7', conf: 'média', fonte: 'ia', tend: -4 },
      { id: 'luz', nome: 'Iluminação', local: 'Loja toda', cat: 'Iluminação', pot: 640, share: .0620, cor: '#008300', conf: 'média', fonte: 'ia', tend: 0 },
      { id: 'caf', nome: 'Cafeteira industrial', local: 'Atendimento', cat: 'Cozinha', pot: 2400, share: .0342, cor: '#C94F7C', conf: 'média', fonte: 'ia', tend: 6 }
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
/* Paleta categórica dos aparelhos. A ORDEM não é enfeite: ela é o que
   garante que duas fatias vizinhas continuem distinguíveis para quem tem
   daltonismo. Foi conferida por script (separação CVD, piso de croma,
   contraste com o fundo claro) — não reordene nem inclua cor nova sem
   rodar a conferência de novo.

   Nenhum aparelho é âmbar de propósito: âmbar significa geração solar no
   site inteiro. Se um aparelho fosse âmbar, a barra de consumo pareceria
   estar falando do sol. */
const CORES_EXTRA = ['#0F8F61', '#2A78D6', '#C94F7C', '#4A3AA7', '#E34948', '#0B7FA3', '#008300'];

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
/* Mês sem nada medido. Tem exatamente a mesma forma do mês de verdade,
   porque quem consome isto não deve precisar saber a diferença. */
function mesVazio(y, m, nd) {
  const zeros = () => new Array(24).fill(0);
  const dias = [];
  for (let i = 0; i < nd; i++) {
    dias.push({
      dia: i + 1, dow: new Date(y, m, i + 1).getDay(),
      cons: zeros(), ger: zeros(), tc: 0, tg: 0, auto: 0, inj: 0, rede: 0
    });
  }
  return { y: y, m: m, nd: nd, dias: dias, tc: 0, tg: 0, auto: 0, inj: 0, rede: 0 };
}

const _cacheMes = new Map();
function mesSimulado(chave, y, m) {
  const ck = chave + '|' + y + '|' + m;
  if (_cacheMes.has(ck)) return _cacheMes.get(ck);
  const u = uni(chave), nd = diasNoMes(y, m);

  /* A chave pode não corresponder a unidade nenhuma: conta recém-criada
     ainda sem unidade, estado salvo apontando para uma unidade apagada, ou
     perfil de exemplo com os exemplos desligados. Antes isto estourava
     dentro de um timer de 2 em 2 segundos e enchia o console de erro.

     Mês zerado é a resposta correta: sem unidade não há o que medir. Quem
     desenha a tela já trata esse estado mostrando o cadastro. */
  if (!u) return mesVazio(y, m, nd);

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
  const u = uni(chave), d = agora();
  /* Mesma razão de mesVazio: a chave pode não existir. Sem unidade, a
     operação começa hoje — nenhum mês de histórico para montar. */
  const meses = u ? u.mesesOperacao : 1;
  return new Date(d.getFullYear(), d.getMonth() - (meses - 1), 1);
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
  const u = uni(chave) || UNIDADE_VAZIA;
  return u.potenciaKwp * IRRADIACAO_SP[m] * RAZAO_DESEMPENHO * nd;
}
function geracaoEsperada(chave, m, nd) {
  return potencialRegiao(chave, m, nd) * (uni(chave) || UNIDADE_VAZIA).fatorInstalacao;
}

/* ---------- livro de créditos: compensação mês a mês ---------- */
const _cacheLedger = new Map();
function ledger(chave, ate_y, ate_m, horasUltimo) {
  const ck = chave + '|' + ate_y + '|' + ate_m + '|' + (horasUltimo == null ? 'cheio' : Math.floor(horasUltimo));
  if (_cacheLedger.has(ck)) return _cacheLedger.get(ck);
  const u = uni(chave);

  /* Sem unidade não há histórico de compensação. Uma linha zerada no mês
     corrente mantém a forma que o resto do sistema espera — quem lê isto
     sempre pega linhas[linhas.length-1] e contava com ela existir. */
  if (!u) {
    return {
      linhas: [{
        y: ate_y, m: ate_m, k: ate_y * 12 + ate_m,
        cons: 0, ger: 0, auto: 0, inj: 0, rede: 0,
        usado: 0, faturado: 0, fioB: 0, percFioB: 0, economia: 0, creditos: 0,
        medido: false, parcial: false
      }],
      creditos: 0, economiaTotal: 0, fioBTotal: 0, direitoAdquirido: false
    };
  }

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
      economia: economia, creditos: creditos,
      /* medido: o mes inteiro veio do medidor.
         parcial: o mes em que a unidade foi cadastrada, metade e metade.
         nenhum dos dois: reconstrucao a partir do que a pessoa informou. */
      medido: mesMedido(chave, y, m), parcial: mesParcial(chave, y, m)
    });
  }
  const r = { linhas: linhas, creditos: creditos, economiaTotal: economiaTotal, fioBTotal: fioBTotal, direitoAdquirido: adq };
  _cacheLedger.set(ck, r);
  return r;
}

/* ---------- estado ---------- */
/* cada conta tem o seu balde de dados; login.js define quem está logado */
const CHAVE_LS = 'solaris.v2';
function chaveEstado() {
  const s = (typeof sessao === 'function') ? sessao() : null;
  return CHAVE_LS + (s ? '.' + s.id : '');
}
function contaAtual() {
  const s = (typeof sessao === 'function') ? sessao() : null;
  return s ? s.id : 'visitante';
}
const PADRAO = {
  perfil: 'residencial', tela: 'painel', periodo: 'mes', vista: 'desktop',
  tab: 'painel', msub: null, detalhe: null,
  metas: { residencial: 300, negocio: 1700 },
  regras: { meta: true, salto: true, solar: true, standby: false },
  tarifa: { residencial: null, negocio: null },
  extras: [], removidos: [], respondidas: {}, dispensados: [], unidades: [],
  /* As duas unidades de demonstracao (Casa das Acacias e a padaria) so
     aparecem quando isto e verdadeiro. O visitante ve; conta nova nao,
     porque conta nova nao tem casa nenhuma cadastrada ainda. */
  exemplos: true,
  nova: {
    nome: '', arquetipo: 'casaVazia', telhado: 'bom', distribuidora: '',
    tarifa: 0.92, consumoMes: 300, potenciaKwp: 4.0, paineis: 9,
    investimento: 17000, mesesOperacao: 12,
    /* ids dos aparelhos que a pessoa marcou ter. null = ainda nao escolheu;
       o cadastro comeca com todos marcados e ela desmarca o que nao tem. */
    aparelhos: null,
    /* qual passo do cadastro esta aberto: 1 conta de luz, 2 sistema solar,
       3 aparelhos */
    passo: 1
  },
  novo: { nome: '', cat: 'Climatização', pot: 1400, horas: 3, dias: 30, comodo: 'Sala' },
  editando: null, salvo: false,
  medidor: { ativo: false, endereco: '192.168.4.1' }
};
let S = JSON.parse(JSON.stringify(PADRAO));

/* Carrega do banco. É assíncrono porque IndexedDB é assíncrono — o app
   espera isto terminar antes de desenhar a primeira tela. */
async function carregar() {
  try {
    const o = await Banco.estado(contaAtual());
    if (!o) return;
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
    S.medidor = { ativo: MEDIDOR.ativo, endereco: MEDIDOR.endereco };
    Banco.salvarEstado(contaAtual(), JSON.parse(JSON.stringify(S)));
  }, 180);
}

/* ---------- visão consolidada ---------- */

/* Unidade neutra, com a mesma forma de uma de verdade e tudo em zero.
   Existe para um estado legítimo do app: conta criada e ainda sem unidade
   cadastrada. Antes disso, qualquer função que lesse um campo da unidade
   estourava — e como o medidor chama isso de 2 em 2 segundos, o console
   enchia de erro enquanto a pessoa preenchia o cadastro.

   Não é para esconder o estado vazio: quem decide o que desenhar é
   semUnidade(), e ele continua dizendo a verdade. Isto só evita que o
   cálculo quebre no meio do caminho. */
const UNIDADE_VAZIA = {
  chave: null, propria: false, arquetipo: 'casaVazia',
  nome: 'Sem unidade', tipo: '—', curto: '—', distribuidora: '—',
  tarifa: 0, tarifaComp: 0, fioB: 0, ilum: 0, minFatura: 0,
  potenciaKwp: 0, paineis: 0, investimento: 0, mesesOperacao: 1,
  fatorInstalacao: 0, condicaoTelhado: '—',
  consumoMes: 0, geracaoMes: 0, metaPadrao: 0,
  consumoH: new Array(24).fill(0), semana: new Array(7).fill(1),
  comodos: ['Geral'], equipamentos: [], deteccoes: []
};

function unidade() { return uni(S.perfil) || UNIDADE_VAZIA; }

/* ---------- unidades criadas pelo usuário ----------
   As duas de demonstração ficam em UNIDADES_BASE. As do usuário vivem no
   estado e são montadas a partir de um arquétipo de consumo: ninguém vai
   digitar 24 valores horários, mas quase todo mundo sabe dizer se a casa
   fica vazia de dia. */

const ARQUETIPOS = {
  casaVazia: {
    rotulo: 'Casa vazia durante o dia',
    desc: 'Todo mundo sai para trabalhar ou estudar. O gasto se concentra cedo e à noite, quando o sol já foi.',
    tipo: 'Residencial', minFatura: 50, ilum: 22,
    consumoH: [.22, .20, .19, .19, .21, .30, .66, .88, .54, .37, .33, .35, .47, .51, .54, .57, .63, .76, .98, 1.12, .96, .70, .44, .27],
    semana: [1.13, .95, .95, .95, .95, .97, 1.10],
    comodos: ['Sala', 'Cozinha', 'Quarto', 'Banheiro', 'Área de serviço', 'Externo'],
    equipamentos: [
      { id: 'ar', nome: 'Ar-condicionado', local: 'Quarto', cat: 'Climatização', pot: 1200, share: .26, cor: '#2A78D6', conf: 'média', tend: 6 },
      { id: 'chu', nome: 'Chuveiro elétrico', local: 'Banheiro', cat: 'Aquecimento', pot: 5500, share: .20, cor: '#E34948', conf: 'alta', tend: 0 },
      { id: 'gel', nome: 'Geladeira', local: 'Cozinha', cat: 'Refrigeração', pot: 180, share: .16, cor: '#0F8F61', conf: 'alta', tend: 1 },
      { id: 'lav', nome: 'Máquina de lavar', local: 'Área de serviço', cat: 'Lavanderia', pot: 900, share: .09, cor: '#4A3AA7', conf: 'média', tend: 0 },
      { id: 'coz', nome: 'Forno e micro-ondas', local: 'Cozinha', cat: 'Cozinha', pot: 1400, share: .07, cor: '#C94F7C', conf: 'média', tend: 0 },
      { id: 'luz', nome: 'Iluminação', local: 'Casa toda', cat: 'Iluminação', pot: 190, share: .06, cor: '#008300', conf: 'média', tend: 0 },
      { id: 'tv', nome: 'TV e eletrônicos', local: 'Sala', cat: 'Eletrônicos', pot: 130, share: .06, cor: '#5B6570', conf: 'baixa', tend: 2 }
    ]
  },
  casaCheia: {
    rotulo: 'Casa com gente o dia todo',
    desc: 'Home office, crianças ou aposentados. O consumo se espalha pelo dia, e por isso aproveita bem mais o sol.',
    tipo: 'Residencial', minFatura: 50, ilum: 22,
    consumoH: [.28, .24, .22, .22, .24, .34, .62, .80, .72, .68, .66, .74, .82, .78, .72, .74, .80, .92, 1.06, 1.14, 1.00, .78, .52, .34],
    semana: [1.06, .98, .98, .98, .98, 1.00, 1.04],
    comodos: ['Sala', 'Cozinha', 'Quarto', 'Escritório', 'Banheiro', 'Área de serviço', 'Externo'],
    equipamentos: [
      { id: 'ar', nome: 'Ar-condicionado', local: 'Sala', cat: 'Climatização', pot: 1400, share: .24, cor: '#2A78D6', conf: 'média', tend: 8 },
      { id: 'chu', nome: 'Chuveiro elétrico', local: 'Banheiro', cat: 'Aquecimento', pot: 5500, share: .16, cor: '#E34948', conf: 'alta', tend: 0 },
      { id: 'gel', nome: 'Geladeira', local: 'Cozinha', cat: 'Refrigeração', pot: 200, share: .15, cor: '#0F8F61', conf: 'alta', tend: 1 },
      { id: 'pc', nome: 'Computadores e monitores', local: 'Escritório', cat: 'Eletrônicos', pot: 260, share: .13, cor: '#0B7FA3', conf: 'média', tend: 4 },
      { id: 'coz', nome: 'Cozinha elétrica', local: 'Cozinha', cat: 'Cozinha', pot: 1400, share: .10, cor: '#C94F7C', conf: 'média', tend: 0 },
      { id: 'lav', nome: 'Lavanderia', local: 'Área de serviço', cat: 'Lavanderia', pot: 900, share: .08, cor: '#4A3AA7', conf: 'média', tend: 0 },
      { id: 'luz', nome: 'Iluminação', local: 'Casa toda', cat: 'Iluminação', pot: 210, share: .07, cor: '#008300', conf: 'média', tend: 0 }
    ]
  },
  comercioManha: {
    rotulo: 'Comércio que abre de madrugada',
    desc: 'Padaria, açougue, lanchonete. O pico vem antes de o sol nascer, então boa parte do gasto ainda depende da rede.',
    tipo: 'Pequeno negócio', minFatura: 100, ilum: 58,
    consumoH: [1.4, 1.3, 1.3, 2.9, 4.6, 5.2, 4.1, 3.4, 3.1, 3.0, 2.9, 3.2, 3.4, 3.1, 2.6, 2.3, 2.1, 1.9, 1.8, 1.7, 1.6, 1.5, 1.5, 1.4],
    semana: [.52, 1.04, 1.04, 1.04, 1.05, 1.08, 1.06],
    comodos: ['Produção', 'Atendimento', 'Estoque', 'Escritório', 'Externo'],
    equipamentos: [
      { id: 'forno', nome: 'Forno', local: 'Produção', cat: 'Cozinha', pot: 12000, share: .28, cor: '#E34948', conf: 'alta', tend: 2 },
      { id: 'refri', nome: 'Câmara fria', local: 'Estoque', cat: 'Refrigeração', pot: 2200, share: .23, cor: '#0B7FA3', conf: 'alta', tend: 5 },
      { id: 'ar', nome: 'Ar-condicionado do salão', local: 'Atendimento', cat: 'Climatização', pot: 5300, share: .16, cor: '#2A78D6', conf: 'alta', tend: 9 },
      { id: 'exp', nome: 'Expositores refrigerados', local: 'Atendimento', cat: 'Refrigeração', pot: 900, share: .13, cor: '#0F8F61', conf: 'alta', tend: 1 },
      { id: 'maq', nome: 'Máquinas de produção', local: 'Produção', cat: 'Cozinha', pot: 3000, share: .08, cor: '#4A3AA7', conf: 'média', tend: 0 },
      { id: 'luz', nome: 'Iluminação', local: 'Loja toda', cat: 'Iluminação', pot: 640, share: .07, cor: '#008300', conf: 'média', tend: 0 }
    ]
  },
  comercioDia: {
    rotulo: 'Comércio em horário comercial',
    desc: 'Loja ou escritório das 8h às 18h. É o melhor caso para solar: o consumo cai quase todo dentro da janela de geração.',
    tipo: 'Pequeno negócio', minFatura: 100, ilum: 58,
    consumoH: [.5, .45, .45, .45, .5, .7, 1.4, 2.6, 3.6, 4.0, 4.2, 4.3, 4.0, 4.2, 4.3, 4.1, 3.7, 3.0, 1.8, 1.0, .8, .7, .6, .55],
    semana: [.35, 1.10, 1.10, 1.10, 1.10, 1.12, .85],
    comodos: ['Atendimento', 'Escritório', 'Estoque', 'Copa', 'Externo'],
    equipamentos: [
      { id: 'ar', nome: 'Ar-condicionado', local: 'Atendimento', cat: 'Climatização', pot: 7000, share: .34, cor: '#2A78D6', conf: 'alta', tend: 7 },
      { id: 'luz', nome: 'Iluminação', local: 'Loja toda', cat: 'Iluminação', pot: 900, share: .19, cor: '#008300', conf: 'alta', tend: 0 },
      { id: 'pc', nome: 'Computadores e terminais', local: 'Escritório', cat: 'Eletrônicos', pot: 600, share: .17, cor: '#0B7FA3', conf: 'média', tend: 3 },
      { id: 'refri', nome: 'Refrigeração', local: 'Copa', cat: 'Refrigeração', pot: 400, share: .12, cor: '#0F8F61', conf: 'média', tend: 1 },
      { id: 'copa', nome: 'Copa e cafeteira', local: 'Copa', cat: 'Cozinha', pot: 1500, share: .08, cor: '#C94F7C', conf: 'baixa', tend: 0 },
      { id: 'div', nome: 'Equipamentos diversos', local: 'Externo', cat: 'Outros', pot: 500, share: .05, cor: '#98A0A9', conf: 'baixa', tend: 0 }
    ]
  }
};

/* condição do telhado -> quanto do potencial da região ele aproveita */
const TELHADOS = [
  { k: 'ideal', rotulo: 'Voltado ao norte, sem sombra', fator: 0.95 },
  { k: 'bom', rotulo: 'Boa orientação, sombra leve', fator: 0.80 },
  { k: 'medio', rotulo: 'Leste ou oeste, alguma sombra', fator: 0.65 },
  { k: 'ruim', rotulo: 'Pouca inclinação ou sombra boa parte do dia', fator: 0.50 }
];

/* Monta uma unidade completa a partir do que o usuário informou.
   O que dá para calcular, é calculado: geração vem da irradiação da região,
   da potência instalada e da condição do telhado — não se pergunta. */
/* Quais aparelhos o arquétipo sabe estimar. É a lista que o cadastro
   mostra para a pessoa marcar o que ela realmente tem. */
function aparelhosDoArquetipo(chaveArq) {
  const a = ARQUETIPOS[chaveArq] || ARQUETIPOS.casaVazia;
  return a.equipamentos.map(e => ({ id: e.id, nome: e.nome, local: e.local, cat: e.cat, pot: e.pot }));
}

function montarUnidade(f) {
  const a = ARQUETIPOS[f.arquetipo] || ARQUETIPOS.casaVazia;
  const telhado = TELHADOS.filter(t => t.k === f.telhado)[0] || TELHADOS[1];
  const irradiacaoMedia = soma(IRRADIACAO_SP) / 12;
  const geracaoMes = f.potenciaKwp * irradiacaoMedia * RAZAO_DESEMPENHO * telhado.fator * 30;

  return {
    chave: f.chave, propria: true, arquetipo: f.arquetipo,
    /* Quando esta unidade foi cadastrada no Solaris. Tudo antes disso e
       reconstrucao a partir do que a pessoa informou; dai para frente e
       o medidor. A tela usa isto para nao vender estimativa como leitura. */
    criadaEm: f.criadaEm || null,
    nome: f.nome, tipo: a.tipo + ' · ' + a.rotulo.toLowerCase(), curto: a.tipo,
    distribuidora: f.distribuidora || 'Não informada',
    tarifa: f.tarifa, tarifaComp: +(f.tarifa * 0.86).toFixed(3), fioB: +(f.tarifa * 0.28).toFixed(3),
    ilum: a.ilum, minFatura: a.minFatura,
    potenciaKwp: f.potenciaKwp, paineis: f.paineis, investimento: f.investimento,
    mesesOperacao: Math.max(1, f.mesesOperacao),
    fatorInstalacao: telhado.fator, condicaoTelhado: telhado.rotulo.toLowerCase(),
    consumoMes: f.consumoMes, geracaoMes: geracaoMes,
    metaPadrao: Math.round(f.consumoMes * 0.92),
    consumoH: a.consumoH.slice(), semana: a.semana.slice(), comodos: a.comodos.slice(),
    /* Só entra o que a pessoa marcou ter no cadastro. Unidade salva antes
       desta versão não tem a lista, e aí vale tudo — senão o painel de
       quem já usava esvaziaria sozinho.

       Não renormalizamos as fatias de propósito: se você declarou só a
       geladeira, ela não vira 100% da sua conta. O que sobra aparece como
       "Não identificado", que é a verdade e é o convite para cadastrar
       o resto. */
    equipamentos: a.equipamentos
      .filter(e => !Array.isArray(f.aparelhos) || f.aparelhos.indexOf(e.id) >= 0)
      .map(e => Object.assign({}, e, { fonte: 'ia' })),
    deteccoes: []
  };
}

/* ---------- o que foi medido e o que e estimativa ----------
   O medidor so existe a partir do momento em que a unidade foi cadastrada.
   Antes disso o sistema reconstroi o historico com a mesma fisica, para a
   pessoa ter contra o que comparar — mas isso e conta, nao leitura, e a
   tela precisa dizer isso.

   Unidade de demonstracao nao tem data de cadastro: nela tudo e estimativa,
   o que e a verdade, ja que ninguem mediu a Casa das Acacias. */
function medidoDesde(chave) {
  const u = uni(chave);
  return u && u.criadaEm ? new Date(u.criadaEm) : null;
}
/* Um dia so conta como medido se a unidade ja existia no comeco dele. */
function diaMedido(chave, data) {
  const desde = medidoDesde(chave);
  if (!desde) return false;
  const d0 = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  return data >= d0;
}
/* Um mes so e medido inteiro se a unidade foi cadastrada antes de ele comecar. */
function mesMedido(chave, y, m) {
  const desde = medidoDesde(chave);
  if (!desde) return false;
  return (y * 12 + m) > (desde.getFullYear() * 12 + desde.getMonth());
}
/* O mes do cadastro e o unico que tem os dois: comeca estimado e vira medido
   no meio. A tela chama isso de parcial. */
function mesParcial(chave, y, m) {
  const desde = medidoDesde(chave);
  if (!desde) return false;
  return (y * 12 + m) === (desde.getFullYear() * 12 + desde.getMonth());
}

function unidadesProprias() { return (S.unidades || []).map(montarUnidade); }

/* As de demonstracao vem do codigo; as suas vem do banco. A bandeira
   S.exemplos decide se as primeiras entram na lista. */
function mostrandoExemplos() { return S.exemplos !== false; }

function uni(chave) {
  if (UNIDADES_BASE[chave]) return mostrandoExemplos() ? UNIDADES_BASE[chave] : null;
  const f = (S.unidades || []).filter(x => x.chave === chave)[0];
  return f ? montarUnidade(f) : null;
}
function chavesUnidades() {
  const proprias = (S.unidades || []).map(x => x.chave);
  return mostrandoExemplos() ? Object.keys(UNIDADES_BASE).concat(proprias) : proprias;
}
/* true quando nao ha nada para mostrar e o site precisa pedir a primeira
   unidade antes de desenhar qualquer painel */
function semUnidade() { return chavesUnidades().length === 0; }

/* Garante que S.perfil aponta para uma unidade que existe. Chamado depois
   de qualquer coisa que possa remover a unidade ativa. */
function ajustarPerfil() {
  const chaves = chavesUnidades();
  if (!chaves.length) { S.perfil = null; return false; }
  if (chaves.indexOf(S.perfil) < 0) { S.perfil = chaves[0]; _visao = null; _cacheLedger.clear(); }
  return true;
}
function tarifaAtual() {
  const u = unidade();
  if (S.tarifa[S.perfil] != null) return S.tarifa[S.perfil];
  /* A unidade neutra tem tarifa 0, que e correto para ela mas pessimo aqui:
     tarifa zero zera todo valor em reais da tela. Sem unidade cadastrada
     vale um numero plausivel, so para a interface ter o que mostrar. */
  return u && u !== UNIDADE_VAZIA ? u.tarifa : 0.92;
}

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
      cor: '#C2C7CE', conf: 'baixa', fonte: 'ia', tend: 5, kwh: nid, sintetico: true
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
  let c = Math.max(0.02, lerp(dia.cons) * _jitterC);
  const g = Math.max(0, lerp(dia.ger) * _jitterG);

  /* Com o medidor físico ligado, o consumo passa a ser leitura real.
     Um sensor só no quadro geral não separa geração — ela segue simulada.
     Ver docs/contrato-dados.md. */
  if (MEDIDOR.ativo && MEDIDOR.ultima != null && (Date.now() - MEDIDOR.quando) < MEDIDOR.limiteMs) {
    c = MEDIDOR.ultima;
  }
  return { cons: c, ger: g, rede: Math.max(0, c - g), inj: Math.max(0, g - c), hora: hr + f };
}

/* ---------- fonte da leitura ---------- */
const MEDIDOR = {
  ativo: false, endereco: '192.168.4.1', ultima: null, quando: 0,
  limiteMs: 15000, erro: null, buscando: false
};
function fonteAtual() {
  if (!MEDIDOR.ativo) return 'simulado';
  const fresca = MEDIDOR.ultima != null && (Date.now() - MEDIDOR.quando) < MEDIDOR.limiteMs;
  return fresca ? 'medidor' : 'aguardando';
}
/* Busca a leitura do ESP32. Nunca lança: se a rede cair, o app
   simplesmente volta a mostrar o simulado. */
function buscarMedidor() {
  if (!MEDIDOR.ativo || MEDIDOR.buscando || typeof fetch !== 'function') return;
  MEDIDOR.buscando = true;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  if (ctrl) setTimeout(() => ctrl.abort(), 3000);
  fetch('http://' + MEDIDOR.endereco + '/leitura', { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' })
    .then(r => r.json())
    .then(j => {
      const kw = Number(j && j.cons);
      if (isFinite(kw) && kw >= 0) { MEDIDOR.ultima = kw; MEDIDOR.quando = Date.now(); MEDIDOR.erro = null; }
    })
    .catch(e => { MEDIDOR.erro = String(e && e.message || e); })
    .then(() => { MEDIDOR.buscando = false; });
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
      /* Se a unidade foi cadastrada hoje as 14h, as horas de 0 a 13 sao
         reconstrucao, nao leitura. Por isso a comparacao e por hora. */
      medido: dia.cons.slice(0, ha).map((_, i) => {
        const desde = medidoDesde(S.perfil);
        if (!desde) return false;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), i + 1) > desde;
      }),
      anterior: (() => { const p = new Date(d); p.setDate(d.getDate() - 1); const pm = mesSimulado(S.perfil, p.getFullYear(), p.getMonth()); const pd = pm.dias[p.getDate() - 1]; const n = Math.max(1, ha); return { c: soma(pd.cons.slice(0, n)), g: soma(pd.ger.slice(0, n)) }; })()
    };
  }
  if (S.periodo === 'semana') {
    const cons = [], ger = [], labels = [], nomes = [], medido = [];
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
      medido.push(diaMedido(S.perfil, new Date(dd.getFullYear(), dd.getMonth(), dd.getDate())));
      const pd = new Date(dd); pd.setDate(dd.getDate() - 7);
      const pm = mesSimulado(S.perfil, pd.getFullYear(), pd.getMonth());
      const pdia = pm.dias[pd.getDate() - 1];
      ac += pdia.tc; ag += pdia.tg;
    }
    return { rotulo: 'Últimos 7 dias', unidade: 'dia', cons: cons, ger: ger, rede: redeTot, labels: labels, nomes: nomes, medido: medido, anterior: { c: ac, g: ag } };
  }
  const nDias = Math.ceil(v.hDec / 24);
  const cons = [], ger = [], labels = [], nomes = [], medido = [];
  for (let i = 0; i < nDias; i++) {
    const dia = v.md.dias[i];
    const parcial = i === nDias - 1 ? (v.hDec - i * 24) : 24;
    let c = 0, g = 0;
    for (let hr = 0; hr < 24; hr++) { const f = clamp(parcial - hr, 0, 1); c += dia.cons[hr] * f; g += dia.ger[hr] * f; }
    cons.push(c); ger.push(g);
    labels.push((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '');
    nomes.push(dia.dia + ' de ' + MESES[v.m]);
    medido.push(diaMedido(S.perfil, new Date(v.y, v.m, i + 1)));
  }
  const pk = v.y * 12 + v.m - 1, py = Math.floor(pk / 12), pm2 = pk - py * 12;
  const ant = ate(mesSimulado(S.perfil, py, pm2), Math.min(v.hDec, diasNoMes(py, pm2) * 24));
  return { rotulo: MESES[v.m].charAt(0).toUpperCase() + MESES[v.m].slice(1) + ', dia a dia', unidade: 'dia', cons: cons, ger: ger, rede: v.mtd.rede, labels: labels, nomes: nomes, medido: medido, anterior: { c: ant.tc, g: ant.tg } };
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

/* O nome é de quem está logado, não um nome de exemplo. Visitante não tem
   nome, então recebe só o cumprimento — inventar um nome ali fazia a conta
   da pessoa parecer a conta de outra. Só o primeiro nome: "Bom dia, Ana
   Carolina de Souza" não é como ninguém cumprimenta. */
function saudacao() {
  const hr = agora().getHours();
  const cumprimento = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  const s = (typeof sessao === 'function') ? sessao() : null;
  const temConta = s && s.id !== 'visitante' && s.nome;
  const nome = temConta ? String(s.nome).trim().split(/\s+/)[0] : '';
  return nome ? cumprimento + ', ' + nome : cumprimento;
}
