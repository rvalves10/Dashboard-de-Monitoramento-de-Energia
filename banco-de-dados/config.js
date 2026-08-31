/* config.js — para onde o Solaris fala

   Este e o unico arquivo que voce precisa editar para ligar o Solaris no
   Supabase. Preencha as duas linhas de `supabase` e recarregue: o site passa
   a gravar no Postgres em vez do banco do navegador, e a mesma conta abre em
   qualquer aparelho.

   Deixou em branco? O site continua funcionando exatamente como antes, com
   IndexedDB. Isso e proposital: a apresentacao nao pode depender de wi-fi, e
   o site tem que continuar abrindo com duplo clique.

   Onde achar os valores:
     Supabase -> seu projeto -> Project Settings -> API Keys
       url        = "Project URL", **sem nada depois do .co**
       chaveAnon  = a chave publica: "publishable" (sb_publishable_...) nos
                    projetos novos, ou "anon public" (eyJ...) nos antigos

   ATENCAO NA URL: e so o endereco do projeto. O codigo monta sozinho o
   /rest/v1, o /auth/v1 e o /functions/v1 conforme o que precisa. Colar a
   url ja com /rest/v1 no fim faz toda chamada virar 404.

   A chave publica vai no navegador de proposito e nao e segredo: ela so
   deixa fazer o que as regras de RLS do banco permitirem, e as regras estao
   em esquema.sql. O que nao pode aparecer aqui de jeito nenhum e a chave
   secreta ("service_role" ou "sb_secret_...") — essa ignora RLS.

   A chave do Gemini tambem NAO mora aqui. Ela fica guardada como segredo
   dentro do Supabase e so a Edge Function enxerga. O navegador nunca ve a
   chave, e o cliente nunca precisa ter uma. Veja supabase/functions/agente/.
*/
'use strict';

const SOLARIS_CONFIG = {

  supabase: {
    url: 'https://ussadqjeykkkuoapwywy.supabase.co',
    chaveAnon: 'sb_publishable_OC7Syp_UxH_F7Y96maAs9w_Hi1_KDvY'
  },

  agente: {
    /* Nome da Edge Function publicada no Supabase. Se o Supabase nao estiver
       configurado, o assistente aparece desligado e explica o porque. */
    funcao: 'agente',

    /* Qual modelo do Gemini responde. A Edge Function so aceita modelos desta
       familia, para um erro de digitacao aqui nao virar chamada estranha. */
    modelo: 'gemini-3.5-flash',

    /* Quantas mensagens do historico vao junto em cada pergunta. Alto demais
       fica caro e lento; baixo demais o assistente esquece o assunto. */
    memoria: 12
  }
};

/* Ligado de verdade so quando as duas coisas estao preenchidas. Meia
   configuracao e pior que nenhuma: o site tentaria falar com um endereco
   que nao existe e travaria na abertura.

   A SUITE DE TESTES FORCA O MODO LOCAL. Ela cria conta, troca senha e apaga
   tudo do banco — e nada disso pode acontecer no Postgres de verdade so
   porque alguem abriu testes/index.html com as credenciais preenchidas. A
   pagina de testes liga esta chave antes de carregar qualquer script. */
function supabaseConfigurado() {
  if (typeof window !== 'undefined' && window.SOLARIS_MODO_LOCAL) return false;
  const s = SOLARIS_CONFIG.supabase;
  return !!(s && typeof s.url === 'string' && s.url.indexOf('http') === 0 &&
    typeof s.chaveAnon === 'string' && s.chaveAnon.length > 20);
}
