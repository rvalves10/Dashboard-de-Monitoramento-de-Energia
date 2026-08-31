# Mapa do projeto

Onde fica cada coisa e por quê. Se você abriu esta pasta pela primeira vez,
leia isto antes de mexer em qualquer arquivo.

---

## Começando

**Para ver o site funcionando:** abra `index.html` (ou `frontend/index.html`).
Duplo clique resolve — não precisa instalar nada, não precisa de internet.

**Para conferir se está tudo certo:** abra `testes/index.html`. Se aparecer
alguma linha vermelha, alguma coisa quebrou.

---

## As pastas

O projeto é dividido por **camada**. A dependência anda numa direção só:

```
frontend/  ──usa──▶  backend/  ──usa──▶  banco-de-dados/
```

O frontend nunca calcula tarifa nem fala com o banco. O backend nunca lê o
DOM nem monta HTML. Quando você não souber onde uma função deveria morar,
pergunte de quem ela precisa: é isso que decide.

```
Solaris/
├── index.html            abre o site (só encaminha para frontend/)
├── Solaris.html          o site inteiro num arquivo só, para mandar por e-mail
│
├── frontend/             ◀ o que a pessoa vê
│   ├── LEIA-ME.md
│   ├── index.html        a página; carrega as camadas na ordem certa
│   ├── css/              a aparência, dividida por assunto
│   ├── js/               telas.js, movel.js, assistente.js, controle.js
│   └── assets/           ícone
│
├── backend/              ◀ a lógica de domínio
│   ├── LEIA-ME.md        inclui por que se chama assim
│   ├── motor.js
│   ├── login.js
│   ├── leitor.js
│   ├── agente.js         o assistente de IA, do lado do navegador
│   ├── ferramentas/      build, servidor local, skills e o gerador do SQL
│   └── firmware/         o código do ESP32, para quando o sensor existir
│
├── banco-de-dados/       ◀ onde tudo é gravado
│   ├── LEIA-ME.md        os dois bancos e por que existem os dois
│   ├── config.js         url do Supabase e modelo do assistente
│   ├── banco.js          escolhe quem responde
│   ├── supabase.js       Postgres na nuvem
│   ├── local.js          IndexedDB
│   ├── esquema.sql       tabelas, RLS e os dados da região
│   ├── dados/            regiao-sorocaba.js
│   └── supabase/functions/agente/   a Edge Function que fala com o Gemini
│
├── skills/               instruções que padronizam o trabalho com IA
│   ├── solaris-visual/   regras de aparência
│   ├── solaris-motor/    regras do cálculo
│   └── solaris-revisao/  o que conferir antes do pull request
│
├── documentacao/         este mapa, como ligar o Supabase, teste de campo,
│   ├── apresentacao/     plano do semestre e slides da banca
│   ├── design/           o desenho original, antes de virar código
│   └── app-futuro/       fase 2: o que fazer quando virar aplicativo
│
└── testes/               129 testes que rodam no navegador
```

**São seis pastas, e é para continuar assim.** Ferramentas e firmware moram
dentro de `backend/` porque são a mesma camada: o firmware é o medidor que
alimenta o domínio, e as ferramentas existem para construir e servir o
projeto. Não crie pasta nova na raiz — se uma coisa não achou lugar, ela
provavelmente pertence a uma camada que já existe.

**Sobre o nome `backend`.** Ele nasceu num projeto sem servidor nenhum: era
a camada que, num sistema com servidor, moraria no servidor. Hoje já existe
servidor — o Supabase — mas o nome continua certo, porque é exatamente essa
camada que atravessou. `agente.js` fala com uma função que roda lá;
`login.js` manda a senha para ser conferida lá.

O que **não** mudou: sem credenciais, tudo cai para o banco do navegador e o
site continua abrindo com duplo clique. Essa promessa é o motivo de o
`banco-de-dados/banco.js` existir.

---

## `frontend/css/` — a aparência

A ordem em que entram importa: cada arquivo pode sobrescrever o anterior.
Se mexer na ordem no `frontend/index.html`, coisas quebram.

| Arquivo | O que tem dentro |
| --- | --- |
| `base.css` | Cores, fontes, espaçamentos e o reset. **Tudo herda daqui.** Mexeu numa cor aqui, mudou o site inteiro. |
| `componentes.css` | Peças que aparecem em várias telas: menu lateral, cartões, botões, formulários, avisos. |
| `telas.css` | O que é específico de uma tela só: o herói do painel, o donut, os gráficos, a tabela de aparelhos, a fatura. |
| `conta.css` | Tela de entrada, cartão da conta e o painel do banco de dados. |
| `assistente.css` | A fala (usada nas duas telas de conversa), o papo rápido do cadastro e o chat com o assistente. |
| `movel.css` | Como o site se comporta em tela estreita. |
| `responsivo.css` | Os pontos de quebra entre desktop, tablet e celular. |
| `impressao.css` | Como o relatório sai no papel. Esconde menu e botões, mostra o cabeçalho. |

---

## Os arquivos de código

A ordem de carregamento é a ordem das camadas, e não pode mudar: cada uma só
usa o que já foi carregado antes dela.

### `banco-de-dados/`

São dois bancos com a mesma interface e um que escolhe entre eles. Nada acima
desta camada sabe qual dos dois respondeu — é isso que deixa o site funcionar
com e sem internet.

| Arquivo | O que faz | Quando mexer |
| --- | --- | --- |
| `config.js` | A url e a chave do Supabase, e qual modelo do Gemini responde. | Ligar a nuvem, trocar de modelo. |
| `banco.js` | **Escolhe** quem atende: Supabase se der, navegador se não. Repassa a interface inteira. | Acrescentar um método novo ao banco — ele só existe de verdade depois de aparecer aqui. |
| `supabase.js` | Postgres na nuvem, por HTTP puro. Conta, sessão, estado, leituras, conversa e a chamada da Edge Function. | Mudar o que sobe para o servidor. |
| `local.js` | IndexedDB dentro do navegador, com reserva em `localStorage`. Era o banco inteiro até a versão passada. | Mudar o que é gravado offline. |
| `esquema.sql` | As sete tabelas, o RLS e os dados da região. Cole inteiro no SQL Editor do Supabase. | Mudar tabela ou política. |
| `dados/regiao-sorocaba.js` | As 20 cidades, as 3 distribuidoras e a irradiação. **É a fonte** — o bloco no `esquema.sql` é gerado dela. | Corrigir cidade, telefone ou concessão. |
| `supabase/functions/agente/index.ts` | A Edge Function: recebe a pergunta, monta o prompt com o perfil e a região, e chama o Gemini com a chave que só existe no servidor. | Mudar como o assistente pensa. |

### `backend/` — a lógica de domínio

| Arquivo | O que faz | Quando mexer |
| --- | --- | --- |
| `motor.js` | **O coração.** Calcula sol, nuvem, consumo, créditos, Fio B e a divisão por aparelho. | Mudar qualquer número ou regra de cálculo. |
| `login.js` | Contas, sessão e derivação de senha. | Mexer em cadastro ou entrada. |
| `leitor.js` | Lê a conta de luz por foto: OCR no navegador e interpretação dos campos. | Melhorar o que o leitor reconhece. |
| `agente.js` | O assistente do lado de cá: as cinco perguntas do cadastro, o contexto que vai junto de cada pergunta e o histórico da conversa. **A chave do Gemini não está aqui, e não pode estar.** | Mudar o que o assistente sabe sobre a pessoa. |

### `frontend/js/` — a interface

| Arquivo | O que faz | Quando mexer |
| --- | --- | --- |
| `telas.js` | Monta as telas da versão ampla. | Mudar o que aparece na tela. |
| `movel.js` | As mesmas telas em coluna única. | Mudar a versão de celular. |
| `assistente.js` | As duas telas de conversa: o papo rápido do cadastro e o chat com o assistente. | Mudar como a conversa aparece. |
| `controle.js` | Cliques, rotas, o tique do medidor e os avisos. | Adicionar botão ou atalho. |

Cada arquivo começa com um comentário explicando o que faz e por quê. Leia
o cabeçalho antes de editar — economiza tempo.

---

## As três portas, nesta ordem

`render()`, em `controle.js`, decide o que desenhar por três perguntas
seguidas — e a ordem delas é o desenho do produto:

1. **sem sessão** → tela de entrada. É a única porta do site: não existe mais
   "entrar sem criar conta";
2. **com sessão e sem o papo rápido** → as cinco perguntas. Acontece uma vez
   na vida da conta, e é o que dá ao assistente com quem falar;
3. **com papo feito e sem unidade** → cadastro da primeira unidade.

Só depois das três existe painel para desenhar. Quem mexer nessa ordem muda o
produto, não o código.

O papo rápido vem **antes** do cadastro da unidade de propósito: é o único
momento em que a pessoa ainda não tem nada para olhar. Se ela já tivesse um
painel com números, cinco perguntas sobre ela seriam um pedágio no meio do
caminho, e todo mundo pularia.

---

## Conta nova começa vazia — e vazia é vazia

Três defeitos chegaram juntos aqui, todos com a mesma cara para quem usa:
"criei uma conta e veio a casa de outra pessoa dentro". O grupo de testes
*Conta nova é conta da pessoa* trava os três.

**O nome é de quem entrou.** `saudacao()` lê `sessao().nome`. Havia um nome
fixo de demonstração no código, e toda conta era cumprimentada com ele.
Visitante não tem nome: recebe só "Bom dia".

**A unidade só tem os aparelhos que a pessoa marcou.** O arquétipo continua
definindo a curva de consumo hora a hora, mas a lista de aparelhos agora vem
do passo 3 do cadastro. `montarUnidade()` filtra por `f.aparelhos`. Unidade
salva antes desta versão não tem esse campo, e aí vale tudo — senão o painel
de quem já usava esvaziaria sozinho.

**As fatias não são renormalizadas.** Se a pessoa declara só a geladeira, a
geladeira não vira 100% da conta dela: o que falta aparece como "Não
identificado". É a verdade, e é o convite para cadastrar o resto.

**O motor não estoura sem unidade.** Conta recém-criada, unidade apagada ou
perfil de exemplo com os exemplos desligados são estados legítimos. Antes
disso o medidor chamava o motor de 2 em 2 segundos e enchia o console de erro
enquanto a pessoa preenchia o cadastro. Agora existe `UNIDADE_VAZIA` e
`mesVazio()`, com a mesma forma dos de verdade e tudo em zero. Quem decide o
que desenhar continua sendo `semUnidade()`.

---

## As regras da aparência

Não são preferências. Cada uma resolve um problema concreto, e desfazer
qualquer uma delas traz o problema de volta.

**Âmbar é geração solar.** Dentro de gráfico ou de dado, âmbar significa
energia que veio do sol e azul-ardósia significa energia comprada da rede.
Nenhum aparelho pode ser âmbar — se fosse, a barra de consumo pareceria
estar falando do sol. Fora dos dados, o âmbar é a cor da marca (símbolo,
marcador de página, botão de entrar sem conta). São dois papéis, e eles não
se misturam na mesma peça.

**A paleta dos aparelhos foi conferida por script.** A ordem em
`CORES_EXTRA` (em `motor.js`) não é decoração: é o que garante que duas
fatias vizinhas continuem distinguíveis para quem tem daltonismo. Foram
conferidos separação CVD, piso de croma e contraste com o fundo claro. Se
mexer na paleta, confira de novo antes de subir.

**Ou borda, ou sombra — nunca as duas.** O cartão é definido pela borda e
não leva sombra. Sombra fica para o que flutua de verdade: aviso, dica de
gráfico. Borda fina somada a sombra larga é a assinatura mais reconhecível
de tela gerada por máquina.

**O título vem antes do contexto.** Nada de rotulinho em caixa-alta por
cima do `h1`. Primeiro o título, depois a linha de contexto embaixo. Vale
para a barra do topo, para a tela de entrada e para a versão de celular.

**Nada abaixo de 12px, entrelinha 1.6 no corpo.** Os degraus de tipografia
estão em `base.css` como `--t-*`. Use os degraus; não digite `px` solto.

**Animação só em `transform` e `opacity`, e nunca partindo do zero.** A
entrada de tela começa em 40% de opacidade de propósito: em máquina lenta,
animação que parte do zero deixa a tela em branco bem na hora em que a
pessoa está olhando. As barras de dados são a exceção deliberada — elas
animam largura/altura porque `scaleX` distorceria o canto arredondado, e
são poucas e pequenas.

---

## Três decisões que parecem estranhas mas têm motivo

**Não usamos framework.** Sem React, sem Vue, sem npm. As telas são funções
que devolvem HTML como texto. Para um projeto deste tamanho isso é mais
simples de ler, e principalmente: o site abre com duplo clique. Na banca não
dá para depender de `npm install` funcionando.

**Não usamos módulos ES.** `import`/`export` exigem servidor HTTP por causa
de CORS — o navegador se recusa a carregar módulo de `file://`. Com scripts
clássicos o site abre direto do disco. As variáveis de topo são compartilhadas
entre os arquivos pelo escopo global: `motor.js` declara, os outros usam.

**Os botões não têm `onclick`.** Cada um leva um `data-act`, e existe um
único escutador no documento. Como a tela é redesenhada inteira a cada
mudança, `onclick` se perderia; com delegação, nunca.

---

## O que NÃO editar

| Arquivo | Por quê |
| --- | --- |
| `Solaris.html` | É gerado por `node backend/ferramentas/build.mjs`. Editar aqui é jogar fora no próximo build. |
| `Solaris-publicar.html` | Mesma coisa. Saída, não fonte. |
| o bloco entre `-- >>> GERADO POR` e `-- <<< FIM` no `esquema.sql` | Gerado por `node backend/ferramentas/gerar-regiao-sql.mjs` a partir de `dados/regiao-sorocaba.js`. Edite o JS e rode o gerador. |
| `design/Solaris.dc.html` | O desenho original. É a referência de como deveria ficar. |

---

## Fluxo de trabalho

1. Editar em `frontend/`, `backend/` e `banco-de-dados/`
2. Recarregar o navegador e ver
3. Abrir `testes/index.html` e conferir se está tudo verde
4. Mexeu nas cidades ou distribuidoras? `node backend/ferramentas/gerar-regiao-sql.mjs`
5. `node backend/ferramentas/build.mjs` para atualizar o arquivo único
6. Commit

O build confere sozinho duas coisas, e reclama em vez de gerar coisa quebrada:

- se as listas de arquivos batem com o `frontend/index.html`;
- se `testes/index.html` carrega os mesmos `js`, na mesma ordem. A página de
  testes tem lista própria, e quando ela fica para trás a suíte roda contra um
  app pela metade e acusa falha que não existe.
