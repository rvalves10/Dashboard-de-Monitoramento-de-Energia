/* servidor.mjs
   Sobe o site num endereco http local.

   O site abre com duplo clique tambem, mas por file:// o navegador bloqueia
   parte do IndexedDB. Para conferir o banco de dados de verdade - e para
   mostrar para outra pessoa na mesma rede - use este servidor.

   Rodar:  node ferramentas/servidor.mjs
   Parar:  Ctrl+C
*/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.argv[2]) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.ino': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
  let caminho = decodeURIComponent(req.url.split('?')[0]);
  if (caminho === '/') caminho = '/index.html';

  /* Nao deixa sair da pasta do projeto por ../ na URL. */
  const alvo = join(raiz, normalize(caminho).replace(/^(\.\.[\/\\])+/, ''));
  if (!alvo.startsWith(raiz)) { res.writeHead(403); return res.end('fora do projeto'); }

  try {
    const conteudo = await readFile(alvo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<p style="font:16px system-ui;padding:40px">Nao achei <code>' + caminho + '</code>.</p>');
  }
}).listen(porta, () => {
  console.log('');
  console.log('  Solaris no ar:');
  console.log('    site      http://localhost:' + porta + '/frontend/index.html');
  console.log('    testes    http://localhost:' + porta + '/testes/index.html');
  console.log('    um arquivo so   http://localhost:' + porta + '/Solaris.html');
  console.log('');
  console.log('  Ctrl+C para parar.');
  console.log('');
});
