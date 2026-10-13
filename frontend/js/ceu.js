/* ceu.js — o ceu de hoje, desenhado

   A peca que so o Solaris tem: o caminho do sol nas 24 horas do dia, com o
   sol no lugar em que ele esta agora, visto da regiao de Sorocaba. Aparece
   em quatro lugares — a entrada, o painel, o menu lateral e o celular — e e
   a mesma funcao nos quatro.

   Nada aqui e enfeite, e nada aqui e calculo. A altura do sol, o nascer, o
   por e a fase do ceu vem do motor (ceuDeHoje e caminhoDoSol, em
   backend/motor.js); este arquivo so desenha. A regra de camada do projeto
   vale aqui como em todo o resto.

   Como ler o desenho:
     - a linha do horizonte separa o dia da noite;
     - acima dela, o arco do dia. A parte ja percorrida e cheia, a que falta
       e tracejada;
     - abaixo do horizonte, pontilhado, o sol do outro lado da Terra;
     - o disco e o sol agora. A noite ele fica apagado, abaixo da linha.

   O QUE A ALTURA DO DESENHO E. Nao e o angulo do sol, e o seno dele: a
   componente vertical da direcao do sol, a altura que ele teria numa
   esfera de raio um. Duas razoes. Primeiro, e essa grandeza que decide
   quanta luz cai num painel deitado — o desenho tem o mesmo formato da
   curva de geracao, e nao por coincidencia. Segundo, perto dos tropicos o
   angulo cresce quase em linha reta (15 graus por hora) e o arco saia um
   triangulo. O seno e a curva que o olho reconhece como o caminho do sol.
   Continua sendo o sol de verdade: quase a pino em dezembro, baixo em
   junho, e e por isso que o painel gera menos no inverno.

   O fundo do cartao que recebe o arco muda com a fase do ceu (noite,
   crepusculo, luz dourada, dia) — classe ceu--<fase>, em css/ceu.css. Abrir
   o Solaris as sete da noite e ver o crepusculo nao e decoracao: e a hora
   certa, na cidade certa.

   Os rotulos de hora sao HTML por cima do desenho, e nao texto dentro do
   SVG: texto de SVG encolhe junto com o desenho, e no celular cairia abaixo
   dos 12px que o sistema promete.
*/
'use strict';

/* Proporcao do desenho. O horizonte fica um pouco abaixo do meio porque o
   dia (acima) e o que interessa; a noite (abaixo) e escala comprimida. */
const ARCO = { W: 640, H: 236, horizonte: 0.68, topo: 18, base: 12 };

function arcoGeometria(o) {
  const W = o.W, H = o.H, yH = Math.round(H * o.horizonte);
  return {
    W: W, H: H, yH: yH,
    x: hora => (hora / 24) * W,
    /* Acima do horizonte, sol a pino e o topo do desenho. Abaixo a escala e
       comprimida, porque ali o que importa e saber que e noite, nao a
       profundidade exata do sol. */
    y: alt => {
      const s = Math.sin(alt * Math.PI / 180);
      return s >= 0 ? yH - s * (yH - o.topo) : yH - s * (H - yH - o.base);
    }
  };
}

function _trecho(pts, g) {
  return pts.map((p, i) => (i ? 'L' : 'M') + g.x(p.hora).toFixed(1) + ' ' + g.y(p.altura).toFixed(1)).join(' ');
}

/* Duracao em horas como relogio curto: 3.2 vira "3h12", 0.4 vira "24 min". */
function duracaoCurta(h) {
  const m = Math.max(0, Math.round(h * 60)), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? hh + 'h' + String(mm).padStart(2, '0') : mm + ' min';
}

/* A frase que acompanha o desenho. Curta para o menu e o celular, inteira
   para o painel e a entrada. */
function fraseDoCeu(c, curta) {
  if (c.deDia) {
    return curta
      ? 'Sol a ' + nf(c.altura) + '° · se põe às ' + hm(c.por)
      : 'O sol está a ' + nf(c.altura) + '° acima do horizonte · ' + duracaoCurta(c.restante) + ' de luz pela frente';
  }
  if (c.hora >= c.por) {
    return curta
      ? 'O sol se pôs às ' + hm(c.por)
      : 'O sol se pôs às ' + hm(c.por) + ' · volta a nascer daqui a ' + duracaoCurta(c.ateNascer);
  }
  return curta
    ? 'O sol nasce às ' + hm(c.nascer)
    : 'Ainda é noite · o sol nasce às ' + hm(c.nascer) + ', daqui a ' + duracaoCurta(c.ateNascer);
}

/* Descricao para leitor de tela: o desenho inteiro em uma frase. */
function descricaoDoCeu(c) {
  return 'Caminho do sol hoje na região de Sorocaba: nasce às ' + hm(c.nascer) +
    ', sobe até ' + nf(c.alturaMax) + ' graus ao meio-dia solar e se põe às ' + hm(c.por) + '. ' +
    (c.deDia
      ? 'Agora o sol está a ' + nf(c.altura) + ' graus acima do horizonte.'
      : 'Agora é ' + c.nomeFase + ': o sol está ' + nf(Math.abs(c.altura)) + ' graus abaixo do horizonte.');
}

/* O desenho. o.compacto tira os rotulos (menu lateral e celular); o.id deixa
   o controle.js achar o desenho para redesenhar quando a hora anda. */
function arcoSolar(c, o) {
  o = o || {};
  const g = arcoGeometria(ARCO);
  const pts = caminhoDoSol(c.quando, 96);
  const W = g.W, H = g.H, yH = g.yH;
  const uid = o.id || 'arco';

  /* os quatro trechos do caminho, com pontos exatos no nascer, no por e agora */
  const noHorizonte = h => ({ hora: h, altura: 0 });
  const antes = pts.filter(p => p.hora < c.nascer).concat([noHorizonte(c.nascer)]);
  const depois = [noHorizonte(c.por)].concat(pts.filter(p => p.hora > c.por));
  const dia = [noHorizonte(c.nascer)].concat(pts.filter(p => p.hora > c.nascer && p.hora < c.por), [noHorizonte(c.por)]);
  const agoraPt = { hora: c.hora, altura: c.altura };
  const feito = c.hora <= c.nascer ? []
    : c.hora >= c.por ? dia
      : [noHorizonte(c.nascer)].concat(pts.filter(p => p.hora > c.nascer && p.hora < c.hora), [agoraPt]);
  const falta = c.hora >= c.por ? []
    : c.hora <= c.nascer ? dia
      : [agoraPt].concat(pts.filter(p => p.hora > c.hora && p.hora < c.por), [noHorizonte(c.por)]);

  const sx = g.x(c.hora), sy = g.y(c.altura);
  const ticks = [0, 6, 12, 18, 24].map(h =>
    '<line x1="' + g.x(h).toFixed(1) + '" y1="' + (yH - 4) + '" x2="' + g.x(h).toFixed(1) + '" y2="' + (yH + 4) + '" class="arco-tique"/>').join('');

  const svg =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(descricaoDoCeu(c)) + '">' +
    '<defs>' +
    '<linearGradient id="' + uid + 'Luz" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" class="arco-luz-a"/><stop offset="1" class="arco-luz-b"/></linearGradient>' +
    '<radialGradient id="' + uid + 'Brilho"><stop offset="0" class="arco-brilho-a"/><stop offset="1" class="arco-brilho-b"/></radialGradient>' +
    '<radialGradient id="' + uid + 'Disco" cx=".4" cy=".38" r=".7"><stop offset="0" class="arco-disco-a"/><stop offset=".55" class="arco-disco-b"/><stop offset="1" class="arco-disco-c"/></radialGradient>' +
    /* o brilho do horizonte: nasce no ponto da linha onde o sol esta e so
       existe acima dela. Mora dentro do desenho, e nao no fundo do cartao,
       para nunca passar por baixo de texto. */
    '<radialGradient id="' + uid + 'Horizonte" gradientUnits="userSpaceOnUse" cx="' + sx.toFixed(1) + '" cy="' + yH + '" r="250">' +
    '<stop offset="0" class="arco-hz-a"/><stop offset=".5" class="arco-hz-b"/><stop offset="1" class="arco-hz-c"/></radialGradient>' +
    '<clipPath id="' + uid + 'Acima"><rect x="-400" y="-400" width="' + (W + 800) + '" height="' + (yH + 400) + '"/></clipPath>' +
    '</defs>' +
    '<circle cx="' + sx.toFixed(1) + '" cy="' + yH + '" r="250" fill="url(#' + uid + 'Horizonte)" clip-path="url(#' + uid + 'Acima)"/>' +
    '<path d="' + _trecho(dia, g) + ' Z" fill="url(#' + uid + 'Luz)"/>' +
    '<line x1="0" y1="' + yH + '" x2="' + W + '" y2="' + yH + '" class="arco-horizonte"/>' +
    ticks +
    '<path d="' + _trecho(antes, g) + '" class="arco-noite"/>' +
    '<path d="' + _trecho(depois, g) + '" class="arco-noite"/>' +
    (feito.length ? '<path d="' + _trecho(feito, g) + '" class="arco-feito"/>' : '') +
    (falta.length ? '<path d="' + _trecho(falta, g) + '" class="arco-falta"/>' : '') +
    '<circle cx="' + g.x(c.nascer).toFixed(1) + '" cy="' + yH + '" r="3" class="arco-marco"/>' +
    '<circle cx="' + g.x(c.por).toFixed(1) + '" cy="' + yH + '" r="3" class="arco-marco"/>' +
    '<g class="arco-sol' + (c.deDia ? '' : ' arco-sol--noite') + '" transform="translate(' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ')">' +
    (c.deDia ? '<circle r="58" fill="url(#' + uid + 'Brilho)"/>' : '') +
    '<circle r="10" fill="url(#' + uid + 'Disco)" class="arco-disco"/>' +
    '</g>' +
    '</svg>';

  /* rotulos em HTML, posicionados em porcentagem do desenho */
  const pos = (x, y) => 'left:' + (x / W * 100).toFixed(2) + '%;top:' + (y / H * 100).toFixed(2) + '%';
  const longeDoPico = Math.abs(c.hora - c.meio) > 1.6 || !c.deDia;
  const rotulos = o.compacto ? '' :
    '<span class="arco-rot arco-rot--nascer" style="' + pos(g.x(c.nascer), yH) + '">nasce <b>' + hm(c.nascer) + '</b></span>' +
    '<span class="arco-rot arco-rot--por" style="' + pos(g.x(c.por), yH) + '">se põe <b>' + hm(c.por) + '</b></span>' +
    (longeDoPico
      ? '<span class="arco-rot arco-rot--pico" style="' + pos(g.x(c.meio), g.y(c.alturaMax)) + '">máx. <b>' + nf(c.alturaMax) + '°</b></span>'
      : '');

  return '<div class="arco' + (o.compacto ? ' arco--compacto' : '') + '" data-arco="' + esc(uid) + '"' +
    (o.compacto ? ' data-compacto="1"' : '') + '>' + svg + rotulos + '</div>';
}

/* A classe de fase que o cartao do ceu carrega. */
function classeDoCeu(c) {
  return 'ceu ceu--' + c.fase;
}
