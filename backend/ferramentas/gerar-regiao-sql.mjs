/* gerar-regiao-sql.mjs
   Reescreve o bloco de dados da regiao dentro de banco-de-dados/esquema.sql a
   partir de banco-de-dados/dados/regiao-sorocaba.js.

   POR QUE ISTO EXISTE. A base da regiao precisa viver em dois lugares: o site
   le do arquivo JS (funciona offline, sem ida ao servidor) e a Edge Function
   le do Postgres (da para corrigir um telefone sem publicar o site). Dois
   lugares com o mesmo dado e um convite a divergencia — alguem corrige a
   distribuidora de Piedade num e esquece do outro, e o assistente passa a
   dizer uma coisa que a tela desmente.

   Entao so um deles e escrito a mao: o JS. O SQL e gerado.

   Rodar:  node backend/ferramentas/gerar-regiao-sql.mjs
   Depois: cole o esquema.sql inteiro no SQL Editor do Supabase de novo.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arqJS = join(raiz, 'banco-de-dados', 'dados', 'regiao-sorocaba.js');
const arqSQL = join(raiz, 'banco-de-dados', 'esquema.sql');

/* O arquivo da regiao e um script classico: declara consts no escopo global e
   nao exporta nada. Avaliamos e pedimos os dois objetos de volta. */
const fonte = readFileSync(arqJS, 'utf8');
const { DISTRIBUIDORAS, CIDADES_REGIAO } =
  new Function(fonte + '\n;return { DISTRIBUIDORAS, CIDADES_REGIAO };')();

/* Aspas simples dobradas: e assim que o Postgres escapa apostrofo, e
   "Bomba d'agua" tem um. */
const txt = v => (v === null || v === undefined || v === '')
  ? 'null'
  : "'" + String(v).replace(/'/g, "''") + "'";
const num = v => (v === null || v === undefined) ? 'null' : String(v);

const linhasDist = Object.keys(DISTRIBUIDORAS).map(k => {
  const d = DISTRIBUIDORAS[k];
  return '(' + [txt(d.id), txt(d.nome), txt(d.grupo), txt(d.area), txt(d.clientes),
    num(d.reajusteMes), txt(d.vigencia), txt(d.telefone), txt(d.site),
    txt(d.emergencia), txt(d.notas)].join(', ') + ')';
}).join(',\n');

const linhasCid = CIDADES_REGIAO.map(c =>
  '(' + [txt(c.id), txt(c.nome), txt(c.uf), num(c.populacao), num(c.distancia),
    txt(c.distribuidora), txt(c.perfil), txt(c.nota)].join(', ') + ')'
).join(',\n');

const bloco = `-- >>> GERADO POR backend/ferramentas/gerar-regiao-sql.mjs — NAO EDITE A MAO
-- A fonte e banco-de-dados/dados/regiao-sorocaba.js. Mude la e rode de novo:
--   node backend/ferramentas/gerar-regiao-sql.mjs

insert into public.distribuidoras
  (id, nome, grupo, area, clientes, reajuste_mes, vigencia, telefone, site, emergencia, notas)
values
${linhasDist}
on conflict (id) do update set
  nome = excluded.nome, grupo = excluded.grupo, area = excluded.area,
  clientes = excluded.clientes, reajuste_mes = excluded.reajuste_mes,
  vigencia = excluded.vigencia, telefone = excluded.telefone,
  site = excluded.site, emergencia = excluded.emergencia, notas = excluded.notas;

insert into public.cidades
  (id, nome, uf, populacao, distancia_km, distribuidora_id, perfil, nota)
values
${linhasCid}
on conflict (id) do update set
  nome = excluded.nome, populacao = excluded.populacao,
  distancia_km = excluded.distancia_km, distribuidora_id = excluded.distribuidora_id,
  perfil = excluded.perfil, nota = excluded.nota;
-- <<< FIM DO BLOCO GERADO`;

const sql = readFileSync(arqSQL, 'utf8');
const inicio = '-- >>> GERADO POR';
const fim = '-- <<< FIM DO BLOCO GERADO';
const i = sql.indexOf(inicio);
const j = sql.indexOf(fim);
if (i < 0 || j < 0) {
  console.error('\n  Nao achei os marcadores do bloco gerado em esquema.sql.');
  console.error('  Ele precisa ter uma linha "' + inicio + '" e outra "' + fim + '".');
  process.exit(1);
}

writeFileSync(arqSQL, sql.slice(0, i) + bloco + sql.slice(j + fim.length), 'utf8');

console.log('');
console.log('  esquema.sql atualizado a partir de regiao-sorocaba.js:');
console.log('    ' + Object.keys(DISTRIBUIDORAS).length + ' distribuidoras');
console.log('    ' + CIDADES_REGIAO.length + ' cidades');
console.log('');
console.log('  Cole o esquema.sql no SQL Editor do Supabase para valer no banco.');
console.log('');
