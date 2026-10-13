/* entrada.js — a porta do site

   A tela de entrada e a unica porta do Solaris: ninguem chega ao painel sem
   conta. Por isso ela carrega o peso de explicar o produto inteiro antes de
   pedir qualquer coisa — e a primeira coisa que ela mostra nao e um
   formulario, e o ceu de agora na regiao de Sorocaba, com o sol onde ele
   esta. Quem abre as sete da noite ve o crepusculo. E a melhor explicacao
   possivel do que o Solaris faz: ele sabe onde o sol esta.

   Este arquivo so desenha e escuta. Quem confere senha, cria conta e abre
   sessao e o backend/login.js. A tela morava la dentro ate esta versao, o
   que contrariava a regra de camada do projeto ("o backend nunca monta
   HTML"); agora cada metade mora na sua camada.
*/
'use strict';

let modoLogin = 'entrar';   /* entrar | criar | recuperar */
let erroLogin = '';
let avisoLogin = '';
let ocupado = false;

function vLogin() {
  const criar = modoLogin === 'criar';
  const recuperar = modoLogin === 'recuperar';
  const naNuvem = autenticacaoNoServidor();
  const c = ceuDeHoje();

  /* Coluna da esquerda: o ceu e o argumento. Agora que ninguem entra sem
     conta, ela e a unica chance de a pessoa entender onde chegou antes de
     decidir se cadastra. */
  const vitrine =
    '<section class="ent-vitrine ' + classeDoCeu(c) + '" data-ceu>' +
    '<div class="ent-vitrine-in">' +
      '<div class="ent-marca">' +
        '<span class="ent-ic">' + ico(IC.marca, 22, 'currentColor', 1.9) + '</span>' +
        '<div><div class="ent-nome">Solaris</div>' +
        '<div class="ent-tag">Sua energia, explicada</div></div>' +
      '</div>' +

      '<h1 class="ent-titulo">Sua conta de luz,<br><em>explicada.</em></h1>' +
      '<p class="ent-linha">Monitoramento de energia solar para casa e pequeno negócio na região de Sorocaba — com a Lei 14.300 dentro do cálculo.</p>' +

      '<div class="ent-ceu">' + arcoSolar(c, { id: 'arcoEntrada' }) + '</div>' +
      '<p class="ent-agora">' + ico(c.deDia ? IC.sol : IC.lua, 14, 'currentColor', 2) +
        '<span>Agora na região de Sorocaba · <span data-ceu-frase="longa">' + esc(fraseDoCeu(c)) + '</span></span></p>' +

      '<ul class="ent-lista">' +
        itemVitrine(IC.aparelhos, 'Para onde vai cada quilowatt',
          'O consumo dividido por aparelho, a partir do padrão do medidor.') +
        itemVitrine(IC.sol, 'Quanto o sol cobriu de verdade',
          'Hora a hora, cruzando o que o painel gera com o que a casa usa.') +
        itemVitrine(IC.papel, 'Quanto vem na próxima conta',
          'Com créditos, mínimo faturado e o Fio B da Lei 14.300.') +
        itemVitrine(IC.ia, 'Um assistente que conhece a sua conta',
          'Ele sabe a sua cidade, a sua distribuidora e o que o medidor marca agora.') +
      '</ul>' +
    '</div></section>';

  /* ----- a coluna do formulario ----- */
  const titulo = {
    entrar: 'Que bom te ver.',
    criar: 'Comece em dois minutos.',
    recuperar: 'Vamos recuperar o acesso.'
  }[modoLogin];
  const sub = {
    entrar: 'Use a conta que você criou aqui.',
    criar: 'Suas unidades, aparelhos e metas ficam guardados na sua conta' +
      (naNuvem ? ' e abrem em qualquer aparelho.' : ' neste navegador.'),
    recuperar: 'Mandamos um link de troca de senha para o seu e-mail.'
  }[modoLogin];

  const campos = recuperar
    ? campoEntrada('auEmail', 'E-mail da conta', 'email', 'username', 'voce@exemplo.com')
    : (criar ? campoEntrada('auNome', 'Nome', 'text', 'name', 'Como quer ser chamado') : '') +
      campoEntrada('auEmail', 'E-mail', 'email', 'username', 'voce@exemplo.com') +
      campoEntrada('auSenha', 'Senha', 'password',
        criar ? 'new-password' : 'current-password',
        criar ? 'Pelo menos 6 caracteres' : 'Sua senha') +
      (criar ? '' :
        '<label class="ent-check"><input type="checkbox" id="auManter" checked>' +
        '<span>Continuar conectado por 30 dias</span></label>');

  const botao = recuperar ? 'Mandar link de recuperação'
    : criar ? 'Criar conta e continuar' : 'Entrar';

  const formulario =
    '<section class="ent-form">' +
    '<div class="ent-cx">' +
      '<h2 class="ent-form-titulo">' + titulo + '</h2>' +

      (recuperar ? '' :
        '<div class="ent-abas" role="tablist">' +
          '<button role="tab" data-act="auth-modo" data-v="entrar" aria-selected="' + (modoLogin === 'entrar') + '">Entrar</button>' +
          '<button role="tab" data-act="auth-modo" data-v="criar" aria-selected="' + criar + '">Criar conta</button>' +
        '</div>') +

      '<p class="ent-sub">' + sub + '</p>' +

      '<form class="ent-campos" id="formLogin" autocomplete="on">' +
        campos +

        (erroLogin ? '<div class="ent-erro" role="alert">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
          '<span>' + esc(erroLogin) + '</span></div>' : '') +

        (avisoLogin ? '<div class="ent-ok" role="status">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
          '<span>' + esc(avisoLogin) + '</span></div>' : '') +

        '<button type="submit" class="ent-botao" id="auEnviar"' + (ocupado ? ' disabled' : '') + '>' +
        (ocupado ? '<span class="ent-girando"></span>Verificando…' : botao + ico(IC.seta, 16, 'currentColor', 2.2)) + '</button>' +
      '</form>' +

      /* Sem a saida de visitante, quem esquece a senha fica trancado do lado
         de fora do proprio painel. Recuperacao deixou de ser luxo e virou
         parte da porta de entrada — mas so existe de verdade com servidor. */
      (recuperar
        ? '<button class="ent-link-voltar" data-act="auth-modo" data-v="entrar">Voltar para o login</button>'
        : criar || !naNuvem ? ''
        : '<button class="ent-link-voltar" data-act="auth-modo" data-v="recuperar">Esqueci minha senha</button>') +

      cartaoSeguranca(naNuvem) +

    '</div></section>';

  return '<div class="entrada">' + vitrine + formulario + '</div>';
}

/* O que acontece com a senha e com os dados, dito na tela e nao no README.
   O texto muda conforme onde a conta esta sendo verificada, porque as duas
   situacoes sao honestamente diferentes — e prometer a mais seria mentira. */
function cartaoSeguranca(naNuvem) {
  if (naNuvem) {
    return '<div class="ent-modo ent-modo--nuvem">' +
      '<span class="ent-modo-ic">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 10a6 6 0 1 1 11.3 2.8A4 4 0 0 1 17 20H7a4 4 0 0 1-1-7.9z"/></svg></span>' +
      '<span>Conta guardada no servidor. A senha é conferida lá, não neste navegador, ' +
      'e os seus dados abrem no celular e no computador.</span></div>' +

      '<details class="ent-aviso">' +
        '<summary>O que fica guardado sobre você</summary>' +
        '<p>Seu nome, seu e-mail, as unidades que você cadastrar, o histórico do medidor ' +
        'e as suas conversas com o assistente. Cada linha guarda o dono, e o banco só devolve ' +
        'as linhas de quem está logado — ninguém lê a unidade de ninguém. ' +
        'Dá para apagar tudo de uma vez em <b>Configurações → Banco de dados</b>.</p>' +
      '</details>';
  }

  const quantas = Object.keys(contas()).length;
  return '<div class="ent-modo">' +
    '<span class="ent-modo-ic">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/></svg></span>' +
    '<span>Este Solaris está rodando <b>sem servidor</b>: a conta vale só neste navegador.</span></div>' +

    '<details class="ent-aviso">' +
      '<summary>O que isso significa para a sua senha</summary>' +
      '<p>A senha nunca é gravada — só uma derivação dela com salt e ' + nf(ITERACOES) + ' iterações' +
      (TEM_WEBCRYPTO ? ' (PBKDF2 pelo WebCrypto)' : ' (SHA-256 encadeado)') + '. ' +
      'Isso separa os dados entre contas, mas <b>não protege contra quem tem acesso a este ' +
      'computador</b>: sem servidor, não existe segredo do lado do cliente. Também não há ' +
      'recuperação de senha, porque não há servidor para mandar o e-mail.</p>' +
    '</details>' +

    (quantas ? '<div class="ent-contador">' + quantas +
      (quantas > 1 ? ' contas neste navegador' : ' conta neste navegador') + '</div>' : '');
}

/* um item da lista de argumentos, na coluna da esquerda */
function itemVitrine(icone, titulo, texto) {
  return '<li><span class="ent-li-ic">' + ico(icone, 16, 'currentColor', 1.8) + '</span>' +
    '<div><b>' + titulo + '</b><span>' + texto + '</span></div></li>';
}

/* um campo do formulario */
function campoEntrada(id, rotulo, tipo, autocomplete, dica) {
  return '<label class="ent-campo" for="' + id + '">' +
    '<span>' + rotulo + '</span>' +
    '<input type="' + tipo + '" id="' + id + '" name="' + autocomplete + '" ' +
    'autocomplete="' + autocomplete + '" placeholder="' + dica + '" required>' +
    '</label>';
}

/* envio do formulario */
async function enviarLogin(ev) {
  ev.preventDefault();
  if (ocupado) return;
  const criar = modoLogin === 'criar';
  const recuperar = modoLogin === 'recuperar';
  const nome = criar ? ($('#auNome') || {}).value : '';
  const email = ($('#auEmail') || {}).value;
  const senha = recuperar ? '' : ($('#auSenha') || {}).value;
  const manter = criar ? true : !!(($('#auManter') || {}).checked);

  ocupado = true; erroLogin = ''; avisoLogin = ''; renderLogin();
  try {
    if (recuperar) {
      await Banco.impl.authRecuperarSenha(normalizarEmail(email));
      ocupado = false;
      modoLogin = 'entrar';
      /* A mesma mensagem sai com e-mail cadastrado ou nao: dizer "esse e-mail
         nao existe" entregaria quais contas existem para quem quisesse
         descobrir. */
      avisoLogin = 'Se houver conta com esse e-mail, o link de troca de senha já está a caminho.';
      renderLogin();
      return;
    }

    if (criar) {
      const c = await criarConta(nome, email, senha);
      /* Conta nova comeca vazia: sem unidade de demonstracao dentro e sem
         nenhum dado de quem usou este navegador antes. */
      if (!await Banco.estado(c.id)) {
        await Banco.salvarEstado(c.id, { exemplos: false, perfil: null, perfilCliente: null });
      }
    } else {
      await entrar(email, senha, manter);
    }
    ocupado = false;
    await aoEntrar();
  } catch (e) {
    ocupado = false;
    /* Cadastro que exige confirmacao por e-mail nao e erro da pessoa: ela fez
       tudo certo e so falta clicar no link. Vai como aviso, nao como falha. */
    if (e && e.confirmacaoPendente) {
      modoLogin = 'entrar';
      avisoLogin = e.message;
    } else {
      erroLogin = (e && e.message) || 'Não deu para continuar.';
    }
    renderLogin();
    const alvo = $('#auSenha'); if (alvo) { alvo.focus(); alvo.select(); }
  }
}

function renderLogin() {
  const root = $('#root');
  /* Mesma razao do render(): a pagina de testes nao tem casca. */
  if (!root) return;
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
  if (alvo && !ocupado) alvo.focus({ preventScroll: true });
}
