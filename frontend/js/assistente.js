/* assistente.js — as duas telas de conversa

   Sao duas, e elas fazem coisas diferentes:

   1. O PAPO RAPIDO (vBoasVindas). Aparece uma vez, logo depois de criar a
      conta, antes de cadastrar qualquer unidade. Cinco perguntas com botao,
      nenhuma sobre energia: o que falta ao sistema neste momento nao e dado
      tecnico, e saber como falar com esta pessoa. O que sai daqui vira o tom
      de todas as respostas do assistente depois.

      Por que antes do cadastro da unidade e nao depois: e o unico momento em
      que a pessoa ainda nao tem nada para olhar. Se ela ja tivesse um painel
      com numeros, cinco perguntas sobre ela seriam um pedagio no meio do
      caminho — e todo mundo pularia.

   2. O ASSISTENTE (vAssistente). A conversa de verdade, com o Gemini do
      outro lado. Comeca com sugestoes montadas a partir do estado real do
      sistema, porque tela de chat vazia e a coisa mais intimidante de
      qualquer produto com IA: ninguem sabe o que da para perguntar.

   Este arquivo so desenha e escuta. Quem monta o contexto, chama o modelo e
   guarda a conversa e o backend/agente.js — a regra de camada do projeto vale
   aqui como em todo o resto.
*/
'use strict';

/* ---------- 1. o papo rapido ---------- */

/* Enquanto a pessoa responde. Nao vai para o banco a cada clique de
   proposito: sao cinco perguntas em trinta segundos, e gravar parcial faria
   uma conta existir com meio perfil dentro. So o fim grava. */
const ONBOARD = { passo: 0, respostas: {}, livre: '' };

function vBoasVindas() {
  const s = sessao() || {};
  const primeiro = String(s.nome || '').trim().split(/\s+/)[0];
  const total = PERGUNTAS_PERFIL.length;
  const i = clamp(ONBOARD.passo, 0, total);

  /* Passo final: o campo livre e o fecho. */
  if (i >= total) return telaFechoBoasVindas(primeiro);

  const q = PERGUNTAS_PERFIL[i];
  const opcoes = q.opcoes.map(o =>
    '<button class="fala-op" data-act="perfil-responder" data-id="' + esc(q.id) + '" data-v="' + esc(o.v) + '">' +
    '<span>' + esc(o.r) + '</span>' +
    ico(IC.seta, 14, 'currentColor', 2.2) + '</button>').join('');

  /* As respostas ja dadas ficam na tela, acima da pergunta atual: e o que faz
     isto parecer uma conversa e nao um formulario paginado. */
  const anteriores = PERGUNTAS_PERFIL.slice(0, i).map(p => {
    const dada = ONBOARD.respostas[p.id];
    const rotulo = (p.opcoes.filter(o => o.v === dada)[0] || {}).r;
    return '<div class="fala-par">' +
      '<div class="fala fala--ia">' + esc(p.pergunta) + '</div>' +
      (rotulo ? '<div class="fala fala--eu">' + esc(rotulo) + '</div>'
        : '<div class="fala fala--eu fala--pulou">Preferiu não dizer</div>') +
      '</div>';
  }).join('');

  return '<div class="boas enter">' +
    '<div class="boas-cx">' +

      cabecalhoBoasVindas(primeiro, i, total) +

      '<div class="boas-conversa">' +
        anteriores +
        '<div class="fala-par">' +
          '<div class="fala fala--ia">' + esc(q.pergunta) +
            '<span class="fala-porque">' + esc(q.porque) + '</span></div>' +
          '<div class="fala-ops">' + opcoes + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="boas-pe">' +
        (i > 0 ? '<button class="ghost-btn" data-act="perfil-voltar">Voltar</button>' : '<span></span>') +
        '<button class="link-btn" data-act="perfil-pular" data-id="' + esc(q.id) + '">Pular esta</button>' +
      '</div>' +

    '</div></div>';
}

function cabecalhoBoasVindas(primeiro, i, total) {
  return '<header class="boas-topo">' +
    '<h1>' + (primeiro ? esc(primeiro) + ', prazer' : 'Prazer') + '. Me conta de você?</h1>' +
    '<p class="boas-d">Cinco perguntas rápidas, nenhuma sobre energia. Elas servem para o ' +
    'assistente do Solaris falar com você do seu jeito, em vez de responder igual para todo mundo. ' +
    'Dá para pular qualquer uma e mudar tudo depois em Configurações.</p>' +
    '<div class="boas-trilha" role="group" aria-label="Progresso">' +
    '<div class="boas-barra"><i style="width:' + Math.round((i / total) * 100) + '%"></i></div>' +
    '<span class="boas-cont">' + Math.min(i + 1, total) + ' de ' + total + '</span>' +
    '</div></header>';
}

function telaFechoBoasVindas(primeiro) {
  return '<div class="boas enter"><div class="boas-cx">' +
    '<header class="boas-topo">' +
      '<h1>Mais alguma coisa que eu deva saber?</h1>' +
      '<p class="boas-d">Opcional, e do seu jeito. Vale qualquer coisa que mude o que eu deveria ' +
      'olhar na sua conta — “tenho piscina aquecida”, “trabalho de casa às terças”, ' +
      '“a padaria abre às 4h”, “sou aposentado e fico o dia todo em casa”.</p>' +
    '</header>' +

    '<div class="boas-livre">' +
      '<label class="sr" for="perfilLivre">Algo mais que o assistente deva saber</label>' +
      '<textarea class="text-in" id="perfilLivre" data-fid="perfilLivre" data-in="perfilLivre" rows="4" ' +
      'placeholder="Escreva aqui, ou deixe em branco e siga em frente.">' + esc(ONBOARD.livre) + '</textarea>' +
    '</div>' +

    '<div class="boas-pe">' +
      '<button class="ghost-btn" data-act="perfil-voltar">Voltar</button>' +
      '<button class="dark-btn" data-act="perfil-terminar">' +
      ico(IC.check, 14, 'currentColor', 2.6) +
      (primeiro ? 'Pronto, ' + esc(primeiro) : 'Pronto') + '</button>' +
    '</div>' +

    '</div></div>';
}

/* ---------- 2. o assistente ---------- */

function vAssistente() {
  const impedimento = agenteIndisponivel();
  if (impedimento) return assistenteDesligado(impedimento);

  const msgs = AGENTE.mensagens;
  const corpo = msgs.length
    ? msgs.map(m => '<div class="fala fala--' + (m.papel === 'pessoa' ? 'eu' : 'ia') + '">' +
        textoDaFala(m.texto) + '</div>').join('')
    : assistenteVazio();

  const digitando = AGENTE.ocupado
    ? '<div class="fala fala--ia fala--digitando" role="status">' +
      '<span></span><span></span><span></span>' +
      '<span class="sr">O assistente está escrevendo</span></div>'
    : '';

  const erro = AGENTE.erro
    ? '<div class="note note--bad" style="margin:0 0 var(--e3)"><span class="note-dot"></span>' +
      '<div><div class="note-t">O assistente não respondeu</div>' +
      '<div class="note-s">' + esc(AGENTE.erro) + '</div></div></div>'
    : '';

  return '<div class="chat enter">' +
    '<section class="card chat-cx">' +
      '<div class="chat-topo">' +
        '<div><h2>' + esc(tituloDoContexto()) + '</h2>' +
        '<div class="card-sub">' + esc(resumoDoContexto()) + '</div></div>' +
        (msgs.length
          ? '<button class="link-btn" data-act="agente-limpar">Limpar conversa</button>' : '') +
      '</div>' +

      '<div class="chat-rolo" id="chatRolo" aria-live="polite">' + corpo + digitando + '</div>' +

      erro +

      '<form class="chat-barra" id="formAgente">' +
        '<label class="sr" for="agenteEntrada">Sua pergunta</label>' +
        '<input class="chat-in" id="agenteEntrada" data-fid="agenteEntrada" data-in="agente" type="text" ' +
        'value="' + esc(AGENTE.rascunho || '') + '" autocomplete="off" ' +
        'placeholder="Pergunte sobre a sua conta, o seu consumo ou os seus painéis…"' +
        (AGENTE.ocupado ? ' disabled' : '') + '>' +
        '<button class="chat-enviar" type="submit"' + (AGENTE.ocupado ? ' disabled' : '') +
        ' aria-label="Enviar pergunta">' + ico(IC.seta, 17, 'currentColor', 2.4) + '</button>' +
      '</form>' +

      '<p class="chat-rodape">Respostas geradas por IA a partir dos seus dados. ' +
      'Confira antes de decidir alguma coisa com dinheiro, e chame um técnico habilitado ' +
      'para qualquer serviço elétrico.</p>' +
    '</section>' +
    '</div>';
}

/* O que a tela vazia mostra: o que ele sabe, e o que da para perguntar. */
function assistenteVazio() {
  const sugestoes = sugestoesDoAgente().map(t =>
    '<button class="chat-sug" data-act="agente-sugestao" data-v="' + esc(t) + '">' +
    esc(t) + '</button>').join('');

  return '<div class="chat-vazio">' +
    '<span class="chat-vazio-ic">' +
    ico('M12 3a6 6 0 0 0-3.4 10.9c.5.5.9 1.3.9 2.1h5c0-.8.4-1.6.9-2.1A6 6 0 0 0 12 3zM10 19.5h4', 26, 'var(--n-900)', 1.8) +
    '</span>' +
    '<h3>Pergunte o que quiser sobre a sua energia</h3>' +
    '<p>Eu enxergo o que o seu medidor está marcando agora, a sua tarifa, os seus créditos ' +
    'e a sua distribuidora. Não invento número: se eu não tiver o dado, eu digo.</p>' +
    '<div class="chat-sugs">' + sugestoes + '</div>' +
    '</div>';
}

/* De qual unidade ele esta falando, e em cima de quais dados.

   Sem estas duas linhas a pessoa nao tem como saber se o assistente esta
   olhando a unidade certa — e quem tem casa e comercio cadastrados no mesmo
   Solaris precisa saber. O titulo do cartao nao repete "Assistente", que ja
   esta na barra do topo e na aba: repetir nome de tela e desperdicar a linha
   mais visivel do cartao. */
function tituloDoContexto() {
  return semUnidade() ? 'Vamos começar pela sua unidade' : 'Falando sobre ' + unidade().nome;
}
function resumoDoContexto() {
  if (semUnidade()) return 'Ainda sem unidade cadastrada — eu ajudo você a cadastrar a primeira.';
  const u = unidade();
  const c = u.cidade ? cidade(u.cidade) : null;
  const partes = [];
  if (c) partes.push(c.nome);
  if (u.distribuidora && u.distribuidora !== 'Não informada' && u.distribuidora !== '—') partes.push(u.distribuidora);
  partes.push(nf(u.potenciaKwp, 1) + ' kWp');
  return partes.join(' · ');
}

/* O modelo responde em texto corrido com quebras de linha, e as vezes usa
   **negrito**. Convertemos as duas coisas e escapamos o resto: nada que vem
   do modelo pode virar HTML de verdade. */
function textoDaFala(txt) {
  return esc(txt)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

/* Assistente desligado nao e erro da pessoa: e configuracao que falta. A tela
   diz o que fazer, e nao some com a secao do menu — sumir faria parecer que a
   funcionalidade nunca existiu. */
function assistenteDesligado(motivo) {
  return '<div class="chat enter"><section class="card chat-cx">' +
    '<div class="chat-vazio">' +
    '<span class="chat-vazio-ic chat-vazio-ic--off">' +
    ico('M12 3a6 6 0 0 0-3.4 10.9c.5.5.9 1.3.9 2.1h5c0-.8.4-1.6.9-2.1A6 6 0 0 0 12 3zM10 19.5h4M4 4l16 16', 26, 'var(--faint)', 1.8) +
    '</span>' +
    '<h3>O assistente ainda não está ligado</h3>' +
    '<p>' + esc(motivo) + '</p>' +
    '</div></section></div>';
}
