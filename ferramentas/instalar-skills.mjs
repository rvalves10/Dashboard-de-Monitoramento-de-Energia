/* instalar-skills.mjs
   Copia as skills de skills/ para .claude/skills/.

   As skills moram em skills/ porque é lá que elas ficam visíveis, versionadas
   e revisáveis num pull request. O Claude Code procura por elas em
   .claude/skills/. Este script faz a ponte.

   Rodar depois de clonar o repositório, e de novo quando alguém alterar uma
   skill:  node ferramentas/instalar-skills.mjs
*/
import { readdirSync, mkdirSync, copyFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'skills');
const destino = join(raiz, '.claude', 'skills');

if (!existsSync(origem)) {
  console.error('  Não achei a pasta skills/. Você está na raiz do projeto?');
  process.exit(1);
}

/* Apaga o destino antes de copiar: sem isso, uma skill removida de skills/
   continuaria valendo em .claude/skills/ para sempre, e ninguém entenderia
   por que o assistente ainda segue uma regra que foi apagada. */
if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

const copiarPasta = (de, para) => {
  mkdirSync(para, { recursive: true });
  for (const item of readdirSync(de)) {
    const origemItem = join(de, item);
    const destinoItem = join(para, item);
    if (statSync(origemItem).isDirectory()) copiarPasta(origemItem, destinoItem);
    else copyFileSync(origemItem, destinoItem);
  }
};

const skills = readdirSync(origem).filter(f => statSync(join(origem, f)).isDirectory());
if (!skills.length) {
  console.error('  A pasta skills/ não tem nenhuma skill dentro.');
  process.exit(1);
}

for (const s of skills) {
  const arquivo = join(origem, s, 'SKILL.md');
  if (!existsSync(arquivo)) {
    console.error('  ' + s + ' não tem SKILL.md — toda skill precisa de um.');
    process.exit(1);
  }
  copiarPasta(join(origem, s), join(destino, s));
}

console.log('');
console.log('  ' + skills.length + ' skills instaladas em .claude/skills/:');
skills.forEach(s => console.log('    ' + s));
console.log('');
console.log('  Para conferir, peça /' + skills[0] + ' no Claude Code.');
console.log('');
