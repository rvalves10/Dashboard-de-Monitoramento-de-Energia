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

/* A ordem tem que ser a mesma do site/index.html. Se alguém adicionar um
   arquivo lá e esquecer aqui, o build sai quebrado — por isso a conferência
   no fim compara as duas listas. */
const CSS = ['base.css', 'componentes.css', 'telas.css', 'conta.css',
  'movel.css', 'responsivo.css', 'impressao.css'];
const JS = ['banco.js', 'motor.js', 'login.js', 'telas.js', 'movel.js', 'controle.js'];

const paginaFonte = ler('site', 'index.html');
const conferir = (lista, pasta) => {
  const faltando = lista.filter(f => paginaFonte.indexOf(pasta + '/' + f) < 0);
  const sobrando = (paginaFonte.match(new RegExp(pasta + '\\/[\\w.-]+', 'g')) || [])
    .map(x => x.split('/')[1]).filter(f => lista.indexOf(f) < 0);
  if (faltando.length || sobrando.length) {
    console.error('\n  As listas do build e do site/index.html não batem.');
    if (faltando.length) console.error('  No build mas não na página: ' + faltando.join(', '));
    if (sobrando.length) console.error('  Na página mas não no build: ' + sobrando.join(', '));
    process.exit(1);
  }
};
conferir(CSS, 'css');
conferir(JS, 'js');

const css = CSS.map(f => '/* ===== css/' + f + ' ===== */\n' + ler('site', 'css', f)).join('\n\n');
const js = JS.map(f => '/* ===== js/' + f + ' ===== */\n' + ler('site', 'js', f)).join('\n\n');

/* um </script> dentro de uma string JS fecharia o bloco inline antes da hora */
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

const favicon = 'data:image/svg+xml,' + encodeURIComponent(ler('assets', 'favicon.svg'));

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
