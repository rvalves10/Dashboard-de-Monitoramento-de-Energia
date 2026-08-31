# Solaris

Site de monitoramento de energia solar para residência e pequeno negócio.
Projeto de UPX.

Mostra para onde vai cada quilowatt, quanto o sol cobriu de verdade e quanto
vem na próxima conta — com a Lei 14.300 já dentro do cálculo.

---

## Abrir

**Duplo clique em `index.html`.** O site abre na tela de entrada.

**O login é obrigatório**: crie uma conta e o Solaris passa a saber com quem
está falando desde o primeiro segundo — que é o que faz o assistente de IA e
o painel serem *seus*, e não de um visitante anônimo. Quem só quer passear
pelo sistema cria a conta e liga as unidades de exemplo em Configurações,
num clique.

Para conferir o painel do banco de dados e a leitura da conta por foto, use o
endereço http: `node backend/ferramentas/servidor.mjs`.

Não tem instalação, não tem `npm install`, não precisa de framework. Funciona
em qualquer navegador razoavelmente atual.

**Sem configurar nada, ele grava no banco do próprio navegador e funciona
offline.** Com o Supabase configurado (10 minutos, em
[`documentacao/ligar-supabase-e-gemini.md`](documentacao/ligar-supabase-e-gemini.md)),
a conta passa a abrir em qualquer aparelho e o assistente de IA liga.

Se preferir um arquivo só para mandar por e-mail ou WhatsApp, use
**`Solaris.html`** — é o site inteiro empacotado.

## Conferir se está tudo certo

Suba o servidor local com `node backend/ferramentas/servidor.mjs` e abra
**`http://localhost:8080/testes/index.html`**. (Abrindo o arquivo direto do
disco também roda, mas o painel do banco de dados fica limitado.)
Devem aparecer **129 de 129 testes passando**, tudo verde.

---

## Para a equipe: teste de campo

Se você chegou aqui para participar do teste de 7 a 30 dias, o roteiro está
em **[`documentacao/teste-de-campo.md`](documentacao/teste-de-campo.md)**. Leva 5 minutos
para começar.

## Para quem vai mexer no código

Leia **[`documentacao/MAPA-DO-PROJETO.md`](documentacao/MAPA-DO-PROJETO.md)** antes de abrir qualquer
arquivo. Explica onde fica cada coisa e por quê.

---

## O que o site faz

**Medidor rodando ao vivo.** Um medidor virtual pulsa a cada 2 segundos. A
curva do sol vem da declinação solar na data — a janela de luz encurta no
inverno sozinha. As nuvens vêm de ruído semeado: o mesmo dia sempre tem o
mesmo tempo, mas cada dia é diferente.

**Desagregação por aparelho.** Estima quanto cada aparelho consome a partir
do padrão do medidor. A soma sempre fecha com a leitura — é teste
automatizado, não coincidência. Você pode discordar da IA e corrigir.

**Conta de luz de verdade.** Compensa créditos mês a mês, respeita o mínimo
faturável e cobra o Fio B da Lei 14.300 sobre a energia compensada. Aplicar a
lei derrubou a economia declarada da casa de R$ 172 para R$ 139 por mês.

**Cadastro da sua unidade.** Você informa o que está na conta de luz e na
nota do instalador; o resto o sistema calcula, inclusive a geração esperada,
a partir da irradiação da região e da condição do telhado.

**Alertas que reagem ao estado real.** Meta do mês, aparelho que disparou,
consumo fora do horário solar — tudo derivado do que está acontecendo, não
texto fixo.

**Um assistente que conhece o seu cliente.** Movido a Google Gemini. Ele
sabe a cidade da pessoa, quem entrega a energia dela, quando a tarifa é
reajustada e o que o medidor está marcando neste minuto — e fala do jeito
que ela pediu para ser tratada, no papo rápido do cadastro.

**A região de Sorocaba dentro do banco.** Vinte cidades com a distribuidora
certa de cada uma, a irradiação da região e o perfil de consumo do lugar.
Quem mora em Piedade é atendido pela Neoenergia Elektro, não pela CPFL — e
o sistema sabe disso.

**Relatório que imprime limpo.** `Ctrl+P` na tela de Relatório.

---

## Estrutura

O projeto é dividido por **camada**, e a ordem da dependência é sempre a
mesma: a interface usa o domínio, o domínio usa o banco. Nunca o contrário.

```
frontend/  ──usa──▶  backend/  ──usa──▶  banco-de-dados/
```

São **seis pastas**, e nada solto fora delas.

```
Solaris/
├── index.html            abre o site (encaminha para frontend/)
├── Solaris.html          o site num arquivo só (gerado pelo build)
│
├── frontend/             ◀ o que a pessoa vê
│   ├── index.html        a página; carrega as camadas na ordem certa
│   ├── css/              a aparência, dividida por assunto
│   ├── js/               telas, celular, assistente e eventos
│   └── assets/           o ícone
│
├── backend/              ◀ a lógica de domínio
│   ├── motor.js          sol, consumo, créditos, Fio B, divisão por aparelho
│   ├── login.js          contas, sessão e a tela de entrada
│   ├── leitor.js         lê a conta de luz por foto (OCR no navegador)
│   ├── agente.js         o assistente: contexto, perfil do cliente e conversa
│   ├── ferramentas/      build, servidor local, instalador de skills, gerador
│   └── firmware/         código do ESP32, para quando o sensor existir
│
├── banco-de-dados/       ◀ onde tudo é gravado
│   ├── config.js         url do Supabase e modelo do assistente
│   ├── banco.js          escolhe quem responde: nuvem ou navegador
│   ├── supabase.js       Postgres na nuvem, por HTTP puro
│   ├── local.js          IndexedDB, a reserva que funciona sem rede
│   ├── esquema.sql       as sete tabelas, o RLS e os dados da região
│   ├── dados/            cidades, distribuidoras e irradiação de Sorocaba
│   └── supabase/         a Edge Function que fala com o Gemini
│
├── skills/               instruções que padronizam o trabalho com IA
├── documentacao/         mapa, como ligar o Supabase, teste de campo, banca
└── testes/               129 testes, rodam no navegador
```

**Cada camada tem o seu `LEIA-ME.md`** explicando o que faz, o que não faz e
por quê. Comece pelo da camada que você vai mexer.

> **Sobre o nome `backend`:** não existe servidor neste projeto. A pasta se
> chama assim porque é a camada que, num sistema com servidor, moraria no
> servidor — e é ela que atravessaria se um dia isso acontecer. Hoje tudo roda
> no navegador, que é o que permite abrir com duplo clique e manter os dados
> da pessoa na máquina dela. Está explicado em
> [`backend/LEIA-ME.md`](backend/LEIA-ME.md).

Detalhe de cada arquivo em [`documentacao/MAPA-DO-PROJETO.md`](documentacao/MAPA-DO-PROJETO.md).

---

## Banco de dados

O Solaris tem **dois bancos com a mesma interface**, e escolhe entre eles na
abertura:

| | Quando entra | O que muda |
| --- | --- | --- |
| **Supabase** (Postgres) | há credenciais em `config.js` e o servidor responde | a conta é sua, não do navegador: abre no celular e no PC |
| **IndexedDB** (navegador) | qualquer outro caso | funciona sem rede, sem cadastro em lugar nenhum |

Quem decide é o `banco-de-dados/banco.js`, e **o resto do sistema nunca
pergunta qual dos dois respondeu.** É isso que permite o site continuar
abrindo com duplo clique depois de ganhar um servidor.

Por que cair para o banco local em vez de mostrar erro: o Solaris é
apresentado numa banca, testado em campo por gente que abre o arquivo pelo
WhatsApp e usado em lugar com internet ruim. Um site de monitoramento que não
abre porque o servidor caiu não monitora nada. **Configurações → Banco de
dados** diz em qual dos dois está rodando, e por quê.

As tabelas no Postgres:

| Tabela | O que guarda |
| --- | --- |
| `perfis` | nome e e-mail de quem entrou |
| `estado` | o que cada conta configurou, num `jsonb` |
| `leituras` | o histórico do medidor, uma linha por minuto |
| `perfil_conversa` | o papo rápido do cadastro: como falar com esta pessoa |
| `conversas` | o histórico com o assistente |
| `cidades` | as 20 cidades da região de Sorocaba |
| `distribuidoras` | CPFL Piratininga, CPFL Santa Cruz e Neoenergia Elektro |

A tabela de leituras é a razão de existir um banco aqui. Uma leitura por
minuto dá 1.440 linhas por dia e mais de dez mil por semana — isso não cabe
em `localStorage`, que é um mapa de texto com uns 5 MB. Guardamos 7 dias no
navegador e 90 no Postgres.

**Cada linha carrega o dono, e o RLS só devolve as linhas de quem está
logado.** A chave `anon` que vai no navegador é pública de propósito: sem as
regras do `esquema.sql` ela abriria o banco inteiro, e é por isso que o
esquema liga RLS em todas as tabelas antes de criar qualquer coisa.

Como ligar: [`documentacao/ligar-supabase-e-gemini.md`](documentacao/ligar-supabase-e-gemini.md).

---

## O assistente de IA

Google Gemini, com **a chave do grupo — não do cliente.** Ninguém que usa o
Solaris precisa criar chave, colar chave ou ter conta no Google: abre o site
e o assistente está lá.

Para isso a chave não pode estar no código do site, onde qualquer pessoa a
copiaria pelo DevTools. Ela vive como segredo dentro do Supabase, e quem fala
com o Google é uma função que roda lá:

```
navegador  ──▶  Edge Function (Supabase)  ──▶  Gemini
                ↑ a chave existe só aqui
```

**Como ele conhece cada cliente.** Não treinamos modelo — custaria caro e não
resolveria, porque o que muda de pessoa para pessoa muda toda semana. A cada
pergunta, a função monta um contexto de três camadas:

1. **quem é a pessoa** — o papo rápido de cinco perguntas do cadastro. Como
   quer ser chamada, quanto entende de energia, o que quer do sistema, como é
   a rotina da casa, o que mais a incomoda;
2. **onde ela mora** — cidade, distribuidora, mês do reajuste, telefone da
   emergência;
3. **o que está acontecendo agora** — consumo do mês, geração, créditos,
   projeção da conta, quais aparelhos pesam mais.

O prompt inteiro é uma função pura no fim de
`banco-de-dados/supabase/functions/agente/index.ts`. Dá para ler, discutir e
corrigir como qualquer outro código — que é o oposto de um prompt escondido.

---

## A região de Sorocaba

Até aqui "distribuidora" era uma caixa de texto livre: a pessoa digitava
"CPFL" e o sistema não sabia mais nada.

Agora o cadastro pergunta a **cidade**, e dela sai o resto. Vinte cidades da
região, cada uma com a distribuidora certa:

| Distribuidora | Cidades |
| --- | --- |
| **CPFL Piratininga** | Sorocaba, Votorantim, Araçoiaba da Serra, Salto de Pirapora, Iperó, Capela do Alto, Alumínio, Mairinque, São Roque, Araçariguama, Ibiúna, Itu, Salto, Porto Feliz, Boituva |
| **Neoenergia Elektro** | Piedade, Tatuí |
| **CPFL Santa Cruz** | Sarapuí, Itapetininga, São Miguel Arcanjo |

Errar isso não é detalhe: quem mora em Piedade **não** é atendido pela CPFL,
e um assistente que dá o telefone e o mês de reajuste da empresa errada é
pior do que um assistente que não responde.

**Tarifa não está nessa base, de propósito.** Muda todo ano e varia por
bandeira e por classe; um valor velho é pior que nenhum. A tarifa vem da
conta de luz da própria pessoa. O que guardamos é *quando* cada distribuidora
reajusta — para o assistente avisar antes, e não depois do susto.

A fonte é `banco-de-dados/dados/regiao-sorocaba.js`; o bloco equivalente
dentro do `esquema.sql` é **gerado** por
`node backend/ferramentas/gerar-regiao-sql.mjs`, para os dois nunca
divergirem.

## Entrada e contas

A primeira tela é a de entrada, e **é a única porta**: ninguém chega ao
painel sem conta.

Antes existia um modo visitante que ia direto ao painel com dados de
demonstração dentro. Ele resolvia um problema de teste de campo — ninguém
travar no cadastro — e criava três outros: os dados ficavam presos num balde
anônimo que qualquer um do mesmo navegador abria; o assistente não tinha de
quem ser assistente; e a primeira coisa que a pessoa via era a casa de outra
gente. Conta nova começa **vazia**, e o site pede a primeira unidade.

Depois de criar a conta vêm **cinco perguntas rápidas**, nenhuma sobre
energia. O que falta ao sistema naquele momento não é dado técnico — é saber
como falar com aquela pessoa. Dá para pular qualquer uma, e para refazer
tudo em Configurações, onde o perfil guardado fica visível.

**O que a segurança é, e o que não é**, depende de onde a conta está sendo
verificada — e a própria tela de login diz em qual dos dois você está:

**Com Supabase**: a senha é conferida no servidor, o token tem prazo, a
mesma conta abre em qualquer aparelho e existe recuperação de senha por
e-mail. É autenticação de verdade.

**Sem Supabase**: tudo acontece no navegador. Isso **não é segurança contra
quem tem acesso ao computador** — sem servidor não existe segredo do lado do
cliente. O que é real:

- a senha nunca é gravada, só uma derivação com salt e 150 mil iterações;
- comparação em tempo constante e mesma mensagem de erro para senha errada e
  e-mail inexistente, para não revelar quais contas existem;
- cada conta tem seu próprio balde de dados.

## Site, não aplicativo

Hoje o Solaris é um **site**. Ele funciona bem no celular porque é
responsivo: abaixo de 760 px troca o menu lateral por abas embaixo. Isso é
diferente de ser um **aplicativo**.

Tudo que tem a ver com virar app está em **`app-futuro/`**, fora do site.
Abra `app-futuro/previa-app.html` para ver como ficaria.

---

## Estado das sprints

| Sprint | Situação |
| --- | --- |
| 0 · Fundação | Feito |
| 1 · Fechar o produto | Feito |
| 2 · Credibilidade | Feito — falta comparar com uma conta real |
| 3 · Unidade é sua | Feito |
| 4 · Medidor de verdade | Software feito — falta montar o hardware |
| 5 · Gente de fora | **Em andamento: teste de campo de 7 a 30 dias** |
| 6 · Banca | Deck pronto — falta preencher validação e ensaiar |
| 7 · Nuvem e IA | Supabase, assistente Gemini e a base da região — feito |

## Combinado do grupo

- Branch por frente, `main` sempre abrindo sem erro.
- Rodar `testes/index.html` antes de abrir pull request.
- `node backend/ferramentas/build.mjs` depois de mexer em `frontend/`, `backend/` ou
  `banco-de-dados/`.
- `node backend/ferramentas/instalar-skills.mjs` depois de clonar, e sempre que alguém
  alterar uma skill.
- `node backend/ferramentas/gerar-regiao-sql.mjs` depois de mexer nas cidades ou
  distribuidoras, para o `esquema.sql` não ficar para trás.
- **Congelamento na semana 13**: depois disso só correção de defeito.
