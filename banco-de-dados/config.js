/* config.js — para onde o Solaris fala

   Este e o unico arquivo que voce precisa editar para ligar o Solaris no
   Supabase. Preencha as duas linhas de `supabase` e recarregue: o site passa
   a gravar no Postgres em vez do banco do navegador, e a mesma conta abre em
   qualquer aparelho.

   Deixou em branco? O site continua funcionando exatamente como antes, com
   IndexedDB. Isso e proposital: a apresentacao nao pode depender de wi-fi, e
   o site tem que continuar abrindo com duplo clique.

   Onde achar os valores:
     Supabase -> seu projeto -> Project Settings -> API
       url        = "Project URL"
       chaveAnon  = "anon public"

   A chave anon E PUBLICA de proposito: ela so deixa fazer o que as regras de
   RLS do banco permitirem, e as regras estao em esquema.sql. O que nao pode
   aparecer aqui de jeito nenhum e a "service_role" — essa ignora RLS.

   A chave do Gemini tambem NAO mora aqui. Ela fica guardada como segredo
   dentro do Supabase e so a Edge Function enxerga. O navegador nunca ve a
   chave, e o cliente nunca precisa ter uma. Veja supabase/funcoes/agente/.
*/
'use strict';

const SOLARIS_CONFIG = {

  supabase: {
    url: '',        /* ex.: 'https://abcdefgh.supabase.co' */
    chaveAnon: ''   /* ex.: 'eyJhbGciOiJI...' */
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
   que nao existe e travaria na abertura. */
function supabaseConfigurado() {
  const s = SOLARIS_CONFIG.supabase;
  return !!(s && typeof s.url === 'string' && s.url.indexOf('http') === 0 &&
    typeof s.chaveAnon === 'string' && s.chaveAnon.length > 20);
}
