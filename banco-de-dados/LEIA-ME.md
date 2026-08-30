# Banco de dados

**Dois bancos com a mesma interface, e um arquivo que escolhe entre eles.**

```
banco.js        escolhe quem responde, e repassa
├── supabase.js   Postgres na nuvem
└── local.js      IndexedDB dentro do navegador
```

Nada acima desta camada sabe qual dos dois atendeu. `Banco.salvarEstado(...)`
funciona igual nos dois casos, e é isso que permite o Solaris ter servidor
sem perder a promessa de abrir com duplo clique.

---

## A regra da escolha

Decidida uma vez, na abertura, e não muda no meio da sessão:

1. `config.js` tem url e chave anon preenchidas? Se não, é local.
2. O projeto Supabase respondeu em 6 segundos? Se não, é local.
3. Deu tudo certo: é Supabase.

**Por que cair para o local em vez de mostrar erro.** O Solaris é apresentado
numa banca, testado em campo por gente que abre o arquivo pelo WhatsApp e
usado em lugar com internet ruim. Um site de monitoramento que não abre
porque o servidor caiu não monitora nada.

Mas a tela **diz** em qual dos dois está rodando, e por quê:
**Configurações → Banco de dados**. Ninguém pode confundir dado que subiu com
dado que ficou na máquina.

**Se a rede cair no meio.** A escolha já foi feita e não muda: trocar de
banco com a sessão aberta separaria os dados em dois lugares e a pessoa veria
metade do histórico. As gravações passam a falhar, o cartão do banco avisa, e
quando a rede volta, volta sozinho.

---

## O que muda com o Supabase ligado

| | Sem Supabase | Com Supabase |
| --- | --- | --- |
| A conta vale | só naquele navegador | em qualquer aparelho |
| A senha é conferida | dentro do navegador | no servidor |
| Recuperação de senha | não existe | e-mail com link |
| Histórico do medidor | 7 dias | 90 dias |
| Assistente de IA | desligado | ligado |

O login sem servidor **não é segurança contra quem tem acesso ao
computador** — sem servidor não existe segredo do lado do cliente. Está
escrito na própria tela de entrada, e o texto muda conforme o modo.

---

## As tabelas

No Postgres são sete. As cinco primeiras são dados da pessoa, com RLS por
dono; as duas últimas são conhecimento público da região.

| Tabela | Chave | O que guarda |
| --- | --- | --- |
| `perfis` | id do usuário | nome e e-mail de quem entrou |
| `estado` | id da conta | o que cada conta configurou, num `jsonb` |
| `leituras` | auto | o histórico do medidor, uma linha por minuto |
| `perfil_conversa` | id da conta | o papo rápido do cadastro: como falar com esta pessoa |
| `conversas` | auto | o histórico com o assistente |
| `cidades` | slug | as 20 cidades da região de Sorocaba |
| `distribuidoras` | slug | CPFL Piratininga, CPFL Santa Cruz e Neoenergia Elektro |

No IndexedDB são as três primeiras, sem o perfil de conversa e sem o
histórico do assistente — os dois só existem online, porque quem os lê é a
Edge Function, no servidor.

### `leituras` em detalhe

```
{ conta: <id>,     índice por conta + instante
  t: ...,          quando
  c: 0.42,         consumo naquele minuto, em kW
  g: 1.31 }        geração naquele minuto, em kW
```

É a tabela que justifica existir um banco aqui. Uma leitura por minuto dá
1.440 linhas por dia e mais de dez mil por semana — isso não caberia em
`localStorage`, que é um mapa de texto com uns 5 MB e sem índice.

Cada conta tem o seu próprio balde: o índice é por conta, e uma conta nunca
lê a leitura de outra. No Postgres isso é garantido pelo RLS, não por
disciplina do código do site.

**Poda.** No navegador, cada aba poda o próprio banco na abertura (7 dias).
No Postgres a poda é trabalho do servidor — `select public.podar_leituras();`,
agendável por `pg_cron` — porque N clientes brigando pela mesma tabela é
receita de lentidão.

---

## Por que a chave `anon` pode ir para o GitHub

Porque ela sozinha não abre nada. O que protege os dados são as políticas de
RLS do `esquema.sql`: cada linha carrega o dono, e o Postgres só devolve as
linhas de quem está autenticado.

O esquema **liga RLS em todas as tabelas antes de criar qualquer política**,
de propósito: tabela com RLS ligado e sem política não devolve nada, que é o
lado seguro de errar.

**A chave `service_role` é outra história.** Ela ignora RLS e abre o banco
inteiro. Nunca pode aparecer em arquivo nenhum do repositório.

---

## A região em dois lugares — e como eles não divergem

As cidades e distribuidoras vivem no `dados/regiao-sorocaba.js` **e** nas
tabelas do Postgres. É de propósito: o site lê do arquivo JS (funciona sem
internet, sem ida ao servidor) e a Edge Function lê do banco (dá para
corrigir um telefone sem publicar o site).

Dois lugares com o mesmo dado é convite à divergência. Então **só um deles é
escrito à mão**:

```
dados/regiao-sorocaba.js   ← a fonte, editada à mão
        ↓  node backend/ferramentas/gerar-regiao-sql.mjs
esquema.sql (bloco gerado) ← nunca editado à mão
```

---

## Onde ver isso rodando

**Configurações → Banco de dados**, dentro do próprio site. Mostra ao vivo
qual banco está atendendo, quantas leituras existem e um gráfico das últimas
duas horas gravadas. É a prova de que o banco é real e não enfeite.

## Como limpar

No rodapé do mesmo cartão:

| Botão | O que apaga |
| --- | --- |
| **Apagar histórico desta conta** | só as `leituras` da conta aberta. |
| **Apagar tudo** | offline, as três tabelas inteiras deste navegador. Online, **tudo que é seu** — e só seu, porque ninguém apaga a conta de outra pessoa pelo site. Pergunta duas vezes. **Não tem desfazer.** |

### O defeito que isso corrigiu

"Apagar meus dados" removia a chave do `localStorage` — mas o estado de
verdade morava no IndexedDB. A tela dizia "apagado", nada era apagado, e no
salvamento seguinte tudo voltava. Há teste automatizado que grava, apaga e
confere que não voltou.

---

## Quem pode falar com esta pasta

Só o `backend/`. O `frontend/` nunca chama `Banco` direto — se chamasse, a
regra de qual conta pode ler o quê ficaria espalhada pela interface.

```
frontend/  ──▶  backend/  ──▶  banco-de-dados/
```

---

## Ligar a nuvem

Passo a passo em
[`../documentacao/ligar-supabase-e-gemini.md`](../documentacao/ligar-supabase-e-gemini.md).
Leva uns 20 minutos e só precisa ser feito uma vez.

## Contrato de dados

O formato que o medidor físico (ESP32) precisa entregar está em
[`../documentacao/contrato-dados.md`](../documentacao/contrato-dados.md).
Enquanto o sensor não existe, a simulação do `motor.js` ocupa esse lugar — e
o resto do sistema não sabe a diferença, de propósito.
