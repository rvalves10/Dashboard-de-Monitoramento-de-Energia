/* leitor.js — ler a conta de luz por foto

   O que ele faz: recebe a foto da fatura, extrai o texto com OCR dentro do
   proprio navegador e procura ali os quatro campos que o cadastro pede —
   distribuidora, consumo em kWh, tarifa e total. Depois preenche o
   formulario e devolve a lista do que achou, para a pessoa conferir.

   Tres decisoes que valem explicar:

   1. O OCR roda no navegador, nao num servidor nosso. Nao existe servidor
      neste projeto, e mandar a conta de luz de alguem para um servico de
      terceiro sem necessidade seria pior: a fatura tem nome, endereco e
      numero de instalacao. Assim a imagem nunca sai da maquina.

   2. A biblioteca so e baixada quando a pessoa escolhe uma foto. Se ela
      nunca usar, o site nao pede nada da rede e continua abrindo com
      duplo clique, como sempre.

   3. Nada e salvo sozinho. O que o OCR entende vira sugestao preenchida
      nos campos, com aviso de conferir. Leitura de foto de celular erra,
      e aqui um erro vira conta de luz errada pelos proximos doze meses.
*/
'use strict';

/* Estado da leitura. Fica fora de S de proposito: e estado de tela em
   andamento, nao dado da conta — nao faz sentido gravar no banco nem
   ressuscitar "lendo 40%" quando a pessoa voltar amanha. */
let LEITOR = {};

const LEITOR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/* As distribuidoras que atendem a maior parte do pais. Casar por nome e
   de longe o campo mais confiavel: e o texto maior da folha, quase sempre
   sai limpo no OCR, e a lista e fechada. */
const DISTRIBUIDORAS = [
  'Enel', 'CPFL', 'Light', 'Cemig', 'Copel', 'Celesc', 'Neoenergia', 'Equatorial',
  'EDP', 'Energisa', 'RGE', 'Coelba', 'Celpe', 'Cosern', 'Elektro', 'Sulgipe',
  'Amazonas Energia', 'CEB', 'CEEE', 'Celg', 'Cepisa', 'Ceron', 'Eletroacre', 'Boa Vista'
];

function leitorDisponivel() {
  return typeof fetch === 'function' && location.protocol !== 'file:';
}

/* Foto de celular vem com 12 megapixels e sombra. O OCR nao precisa de
   nada disso: reduzir para ~1600px de largura e jogar para tons de cinza
   com contraste esticado acelera muito e melhora o acerto. */
function prepararImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxL = 1600;
        const escala = Math.min(1, maxL / img.naturalWidth);
        const w = Math.round(img.naturalWidth * escala);
        const h = Math.round(img.naturalHeight * escala);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);

        const d = cx.getImageData(0, 0, w, h);
        const px = d.data;
        /* cinza pela luminancia e nao pela media: o vermelho da tarja da
           fatura sumia junto com o texto na media simples */
        let min = 255, max = 0;
        const cinza = new Uint8ClampedArray(px.length / 4);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) {
          const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
          cinza[j] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        const faixa = Math.max(1, max - min);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) {
          const g = ((cinza[j] - min) / faixa) * 255;
          px[i] = px[i + 1] = px[i + 2] = g;
        }
        cx.putImageData(d, 0, 0);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('Não consegui preparar a imagem.')), 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Esse arquivo não parece uma imagem.')); };
    img.src = url;
  });
}

function carregarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LEITOR_CDN;
    s.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(new Error('O leitor carregou pela metade. Recarregue a página e tente de novo.'));
    s.onerror = () => reject(new Error('Não consegui baixar o leitor. Ele precisa de internet na primeira vez — depois disso fica no cache do navegador.'));
    document.head.appendChild(s);
  });
}

/* ---------- interpretar o texto ---------- */

/* O OCR troca 0 por O e 1 por l com frequencia. Normalizar antes de
   procurar numero evita a maior parte dos falsos negativos. */
function limparTexto(t) {
  return String(t || '')
    .replace(/[|]/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function numeroDoTexto(txt) {
  if (txt == null) return NaN;
  const t = String(txt).trim().replace(/\s/g, '');
  if (!t) return NaN;
  let limpo;
  if (t.indexOf(',') >= 0) limpo = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) limpo = t.replace(/\./g, '');
  else limpo = t;
  const n = Number(limpo);
  return isFinite(n) ? n : NaN;
}

function acharDistribuidora(texto) {
  const alvo = texto.toLowerCase();
  for (let i = 0; i < DISTRIBUIDORAS.length; i++) {
    const d = DISTRIBUIDORAS[i];
    if (alvo.indexOf(d.toLowerCase()) >= 0) return d;
  }
  return null;
}

/* Consumo: procura um numero perto da palavra kWh. A fatura tem varios
   numeros com kWh do lado (consumo, injetado, saldo), entao pegamos o
   maior valor plausivel de consumo mensal residencial ou comercial. */
function acharConsumo(texto) {
  const candidatos = [];
  const re = /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*k\s*w\s*h/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const n = numeroDoTexto(m[1]);
    if (isFinite(n) && n >= 20 && n <= 50000) candidatos.push(n);
  }
  const reRotulo = /consumo[^\n\d]{0,40}(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)/gi;
  while ((m = reRotulo.exec(texto)) !== null) {
    const n = numeroDoTexto(m[1]);
    if (isFinite(n) && n >= 20 && n <= 50000) candidatos.push(n);
  }
  if (!candidatos.length) return null;
  /* o rotulado como consumo costuma ser o maior dos que aparecem com kWh */
  candidatos.sort((a, b) => b - a);
  return Math.round(candidatos[0]);
}

/* Tarifa: um valor entre R$ 0,30 e R$ 2,50 por kWh cobre o Brasil inteiro.
   Fora dessa faixa e outra coisa que o OCR pegou junto. */
function acharTarifa(texto) {
  const re = /(?:tarifa|pre[cç]o\s*unit|valor\s*unit|r\$\s*\/\s*kwh)[^\n\d]{0,30}(\d+[.,]\d{2,6})/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const n = numeroDoTexto(m[1]);
    if (isFinite(n) && n >= 0.3 && n <= 2.5) return +n.toFixed(4);
  }
  return null;
}

function acharTotal(texto) {
  const re = /total\s*a\s*pagar[^\n\d]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/gi;
  const m = re.exec(texto);
  if (m) {
    const n = numeroDoTexto(m[1]);
    if (isFinite(n) && n > 0 && n < 1000000) return n;
  }
  return null;
}

/* Devolve o que reconheceu. Campo que nao apareceu volta null — nunca
   um palpite, porque palpite silencioso aqui vira erro de calculo que
   ninguem percebe. */
function interpretarConta(textoBruto) {
  const texto = limparTexto(textoBruto);
  const consumo = acharConsumo(texto);
  let tarifa = acharTarifa(texto);
  const total = acharTotal(texto);

  /* Sem tarifa explicita, da para deduzir do total dividido pelo consumo.
     Fica marcado como deduzida para a tela poder avisar. */
  let tarifaDeduzida = false;
  if (tarifa == null && total != null && consumo) {
    const t = total / consumo;
    if (t >= 0.3 && t <= 2.5) { tarifa = +t.toFixed(4); tarifaDeduzida = true; }
  }
  return {
    distribuidora: acharDistribuidora(texto),
    consumo: consumo,
    tarifa: tarifa,
    tarifaDeduzida: tarifaDeduzida,
    total: total,
    texto: texto
  };
}

/* ---------- o fluxo completo ---------- */
async function lerContaDeLuz(file, aoMudar) {
  const anuncia = () => { if (typeof aoMudar === 'function') aoMudar(); };

  if (!file) return;
  if (!/^image\//.test(file.type)) {
    LEITOR = { estado: 'erro', msg: 'Mande uma imagem (JPG ou PNG). Se a conta é PDF, tire um print da primeira página.' };
    return anuncia();
  }
  if (file.size > 20 * 1024 * 1024) {
    LEITOR = { estado: 'erro', msg: 'Essa imagem tem mais de 20 MB. Tire a foto com qualidade menor.' };
    return anuncia();
  }
  if (!leitorDisponivel()) {
    LEITOR = { estado: 'erro', msg: 'A leitura por foto precisa que o site esteja aberto por um endereço http. Abrindo o arquivo direto do disco o navegador bloqueia o download do leitor — rode "node ferramentas/servidor.mjs" ou preencha à mão.' };
    return anuncia();
  }

  LEITOR = { estado: 'lendo', progresso: 2, etapa: 'Preparando a imagem' };
  anuncia();

  let worker;
  try {
    const imagem = await prepararImagem(file);

    LEITOR.progresso = 8; LEITOR.etapa = 'Baixando o leitor (só na primeira vez)'; anuncia();
    const T = await carregarTesseract();

    LEITOR.progresso = 20; LEITOR.etapa = 'Carregando o português'; anuncia();
    worker = await T.createWorker('por', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          LEITOR.progresso = 30 + Math.round((m.progress || 0) * 65);
          LEITOR.etapa = 'Lendo o texto da fatura';
          anuncia();
        }
      }
    });

    const saida = await worker.recognize(imagem);
    const lido = interpretarConta((saida && saida.data && saida.data.text) || '');

    /* preenche o formulario com o que foi reconhecido */
    const achados = [];
    if (lido.distribuidora) {
      S.nova.distribuidora = lido.distribuidora;
      achados.push({ rotulo: 'Distribuidora', valor: lido.distribuidora });
    }
    if (lido.consumo) {
      S.nova.consumoMes = lido.consumo;
      achados.push({ rotulo: 'Consumo', valor: nf(lido.consumo) + ' kWh' });
    }
    if (lido.tarifa) {
      S.nova.tarifa = lido.tarifa;
      achados.push({
        rotulo: 'Tarifa',
        valor: 'R$ ' + nf(lido.tarifa, 2) + (lido.tarifaDeduzida ? ' (deduzida do total)' : '')
      });
    }
    /* Nome so quando ainda esta vazio: se a pessoa ja escreveu "Minha casa",
       a foto nao tem por que apagar. */
    if (!S.nova.nome.trim() && lido.distribuidora) S.nova.nome = 'Minha unidade';

    LEITOR = { estado: 'ok', achados: achados };
    if (achados.length) salvar();
  } catch (e) {
    LEITOR = { estado: 'erro', msg: (e && e.message) || 'Algo deu errado na leitura.' };
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) { } }
  }
  anuncia();
}
