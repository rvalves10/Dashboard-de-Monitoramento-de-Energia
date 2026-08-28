/* build.mjs
   Junta o site inteiro num arquivo só.

   Serve para duas coisas: mandar o Solaris por e-mail ou WhatsApp sem pasta
   nenhuma, e publicar online. O site em site/ continua sendo a fonte — este
   arquivo é gerado, nunca editado à mão.

   Rodar:  node ferramentas/build.mjs
   Saída:  Solaris.html                    documento completo, duplo clique
           dist/solaris-artifact.html       sem tags de documento, para publicar
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => readFileSync(join(raiz, ...p), 'utf8');

/* Cada arquivo mora na camada a que pertence, e o build precisa saber onde
   procurar. A ORDEM aqui e a mesma do frontend/index.html e nao pode mudar:
   banco de dados, dominio, interface. Cada camada so usa o que ja foi
   carregado antes dela. */
const CSS = ['base.css', 'componentes.css', 'telas.css', 'conta.css',
  'movel.css', 'responsivo.css', 'impressao.css'];
const JS = [
  ['banco-de-dados', 'banco.js'],
  ['backend', 'motor.js'],
  ['backend', 'login.js'],
  ['backend', 'leitor.js'],
  ['frontend/js', 'telas.js'],
  ['frontend/js', 'movel.js'],
  ['frontend/js', 'controle.js']
];
const caminhoJS = ([pasta, arq]) => pasta + '/' + arq;

const paginaFonte = ler('frontend', 'index.html');

/* O build so gera se a pagina e as listas daqui contarem a mesma historia.
   Sem isso, quem adiciona um arquivo e esquece de registrar descobre pelo
   site quebrado, nao pelo build. */
const faltandoCSS = CSS.filter(f => paginaFonte.indexOf('css/' + f) < 0);
if (faltandoCSS.length) {
  console.error('\n  CSS no build mas nao em frontend/index.html: ' + faltandoCSS.join(', '));
  process.exit(1);
}
const faltandoJS = JS.map(caminhoJS).filter(c => {
  const rel = c.indexOf('frontend/') === 0 ? c.slice('frontend/'.length) : '../' + c;
  return paginaFonte.indexOf(rel) < 0;
});
if (faltandoJS.length) {
  console.error('\n  JS no build mas nao em frontend/index.html: ' + faltandoJS.join(', '));
  process.exit(1);
}

/* A pagina de testes tem a propria lista de scripts, e ela precisa carregar
   os mesmos arquivos, na mesma ordem. Quando ela fica para tras, a suite roda
   contra um app pela metade e acusa falhas que nao existem — foi exatamente o
   que aconteceu quando leitor.js entrou. */
const paginaTestes = ler('testes', 'index.html');
const naTestes = (paginaTestes.match(/\.\.\/[\w/-]+\/([\w.-]+\.js)/g) || [])
  .map(x => x.replace(/^\.\.\//, ''))
  .filter(x => x.indexOf('testes') !== 0);
const esperado = JS.map(caminhoJS);
if (naTestes.join(',') !== esperado.join(',')) {
  console.error('\n  testes/index.html nao carrega os mesmos js do site, na mesma ordem.');
  console.error('  site:   ' + esperado.join(', '));
  console.error('  testes: ' + (naTestes.join(', ') || '(nenhum)'));
  process.exit(1);
}

const css = CSS.map(f => '/* ===== frontend/css/' + f + ' ===== */\n' + ler('frontend', 'css', f)).join('\n\n');
const js = JS.map(([pasta, arq]) => '/* ===== ' + pasta + '/' + arq + ' ===== */\n' + ler(...pasta.split('/'), arq)).join('\n\n');

/* um </script> dentro de uma string JS fecharia o bloco inline antes da hora */
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

const favicon = 'data:image/svg+xml,' + encodeURIComponent(ler('frontend', 'assets', 'favicon.svg'));

const fontes =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">';

const corpo =
  '<a class="pular" href="#conteudo">Pular para o conteúdo</a>\n' +
  '<div id="root"></div>\n' +
  '<div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>\n' +
  '<noscript><div class="sem-js"><h1>Solaris</h1>' +
  '<p>O painel lê o medidor em tempo real e desenha os gráficos no próprio navegador, ' +
  'então precisa de JavaScript ativado para funcionar.</p></div></noscript>';

const cabecalho = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Solaris — monitoramento de energia solar</title>
<meta name="description" content="Painel que mostra para onde vai cada quilowatt da sua casa ou do seu comércio, quanto o sol cobriu e quanto vem na próxima conta.">
<meta name="theme-color" content="#16150F">
${fontes}`;

const completo = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${cabecalho}
<link rel="icon" href="${favicon}">
<style>
${css}
</style>
</head>
<body>
${corpo}
<script>
${jsSeguro}
</script>
</body>
</html>
`;

/* a versão publicada não leva as tags de documento: o serviço que hospeda
   embrulha o conteúdo por conta própria */
const publicar = `<title>Solaris</title>
${fontes}
<style>
${css}
</style>
${corpo}
<script>
${jsSeguro}
</script>
`;

writeFileSync(join(raiz, 'Solaris.html'), completo, 'utf8');
mkdirSync(join(raiz, 'dist'), { recursive: true });
writeFileSync(join(raiz, 'dist', 'solaris-artifact.html'), publicar, 'utf8');

const kb = n => (n / 1024).toFixed(0).padStart(4) + ' KB';
console.log('  Solaris.html                ' + kb(completo.length) + '   (mandar por e-mail, abre com duplo clique)');
console.log('  dist/solaris-artifact.html  ' + kb(publicar.length) + '   (publicar online)');
console.log('  ' + CSS.length + ' arquivos de CSS e ' + JS.length + ' de JavaScript, na mesma ordem do site.');
