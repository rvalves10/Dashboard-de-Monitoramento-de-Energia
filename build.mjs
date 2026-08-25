/* Gera as duas entregas a partir de app/:
   - Solaris.html            documento completo, abre com duplo clique
   - dist/solaris-artifact.html   sem tags de documento, para publicar como Artifact

   Uso:  node build.mjs
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const ler = (...p) => readFileSync(join(raiz, ...p), 'utf8');

const JS = ['motor.js', 'login.js', 'telas.js', 'celular.js', 'controle.js'];
const css = ler('app', 'estilo.css');
const js = JS.map(f => '/* ===== ' + f + ' ===== */\n' + ler('app', f)).join('\n\n');

/* fecha </script> dentro de string JS quebraria o bloco inline */
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

const fontes =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">';

const corpo =
  '<a class="pular" href="#conteudo">Pular para o conteúdo</a>\n' +
  '<div id="root"></div>\n' +
  '<div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>\n' +
  '<noscript>\n' +
  '  <div style="max-width:60ch;margin:12vh auto;padding:0 24px;font-family:\'IBM Plex Sans\',system-ui,sans-serif;color:#16150F">\n' +
  '    <h1 style="font-family:\'Bricolage Grotesque\',sans-serif;font-size:30px;letter-spacing:-.9px;margin:0 0 12px">Solaris</h1>\n' +
  '    <p style="line-height:1.6;color:#6B665C">O painel lê o medidor em tempo real, então precisa de JavaScript ativado para funcionar.</p>\n' +
  '  </div>\n' +
  '</noscript>';

const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2316150F'/%3E%3Ccircle cx='50' cy='50' r='15' fill='none' stroke='%23EDA22B' stroke-width='4.5'/%3E%3Cg stroke='%23F5C25B' stroke-width='4.5' stroke-linecap='round'%3E%3Cpath d='M50 23v7M50 70v7M77 50h-7M30 50h-7M69 31l-5 5M36 64l-5 5M69 69l-5-5M36 36l-5-5'/%3E%3C/g%3E%3C/svg%3E";

const completo = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Solaris</title>
<meta name="description" content="Painel de monitoramento de energia solar com medidor ao vivo, desagregacao por aparelho e metas.">
<meta name="theme-color" content="#16150F">
${fontes}
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

const artifact = `<title>Solaris</title>
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
writeFileSync(join(raiz, 'dist', 'solaris-artifact.html'), artifact, 'utf8');

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('Solaris.html                 ' + kb(completo.length));
console.log('dist/solaris-artifact.html   ' + kb(artifact.length));
