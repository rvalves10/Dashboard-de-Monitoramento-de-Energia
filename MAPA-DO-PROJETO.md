# Mapa do projeto

Onde fica cada coisa e por quê. Se você abriu esta pasta pela primeira vez,
leia isto antes de mexer em qualquer arquivo.

---

## Começando

**Para ver o site funcionando:** abra `index.html` (ou `site/index.html`).
Duplo clique resolve — não precisa instalar nada, não precisa de internet.

**Para conferir se está tudo certo:** abra `testes/index.html`. Se aparecer
alguma linha vermelha, alguma coisa quebrou.

---

## As pastas

```
Solaris/
├── index.html            abre o site (só encaminha para site/)
├── Solaris.html          o site inteiro num arquivo só, para mandar por e-mail
│
├── site/                 ◀ O PROJETO. É isto que a gente está entregando.
│   ├── index.html        a página; carrega o CSS e o JS na ordem certa
│   ├── css/              a aparência, dividida por assunto
│   └── js/               o funcionamento, dividido por responsabilidade
│
├── testes/               105 testes que rodam no navegador
├── firmware/             o código do ESP32, para quando o sensor existir
├── app-futuro/           fase 2: o que fazer quando virar aplicativo
├── docs/                 documentação de apoio
├── apresentacao/         plano do semestre e slides da banca
├── design/               o desenho original, antes de virar código
├── assets/               ícone
├── ferramentas/          o script que gera o arquivo único
└── dist/                 saída do build (não versionado, pode apagar)
```

---

## `site/css/` — a aparência

A ordem em que entram importa: cada arquivo pode sobrescrever o anterior.
Se mexer na ordem no `site/index.html`, coisas quebram.

| Arquivo | O que tem dentro |
| --- | --- |
| `base.css` | Cores, fontes, espaçamentos e o reset. **Tudo herda daqui.** Mexeu numa cor aqui, mudou o site inteiro. |
| `componentes.css` | Peças que aparecem em várias telas: menu lateral, cartões, botões, formulários, avisos. |
| `telas.css` | O que é específico de uma tela só: o herói do painel, o donut, os gráficos, a tabela de aparelhos, a fatura. |
| `conta.css` | Tela de entrada, cartão da conta e o painel do banco de dados. |
| `movel.css` | Como o site se comporta em tela estreita. |
| `responsivo.css` | Os pontos de quebra entre desktop, tablet e celular. |
| `impressao.css` | Como o relatório sai no papel. Esconde menu e botões, mostra o cabeçalho. |

---

## `site/js/` — o funcionamento

Também tem ordem: `banco` antes de `motor`, `motor` antes de todos os outros.

| Arquivo | O que faz | Quando mexer |
| --- | --- | --- |
| `banco.js` | Abre o IndexedDB e guarda contas, estado e leituras. | Mudar o que é gravado. |
| `motor.js` | **O coração.** Calcula sol, nuvem, consumo, créditos, Fio B e a divisão por aparelho. | Mudar qualquer número ou regra de cálculo. |
| `login.js` | Contas, sessão e derivação de senha. | Mexer em cadastro ou entrada. |
| `leitor.js` | Lê a conta de luz por foto: OCR no navegador e interpretação dos campos. | Melhorar o que o leitor reconhece. |
| `telas.js` | Monta as telas da versão ampla. | Mudar o que aparece na tela. |
| `movel.js` | As mesmas telas em coluna única. | Mudar a versão de celular. |
| `controle.js` | Cliques, rotas, o tique do medidor e os avisos. | Adicionar botão ou atalho. |

Cada arquivo começa com um comentário explicando o que faz e por quê. Leia
o cabeçalho antes de editar — economiza tempo.

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
| `Solaris.html` | É gerado por `node ferramentas/build.mjs`. Editar aqui é jogar fora no próximo build. |
| `dist/` | Mesma coisa. Saída, não fonte. |
| `design/Solaris.dc.html` | O desenho original. É a referência de como deveria ficar. |

---

## Fluxo de trabalho

1. Editar em `site/`
2. Recarregar o navegador e ver
3. Abrir `testes/index.html` e conferir se está tudo verde
4. `node ferramentas/build.mjs` para atualizar o arquivo único
5. Commit

O build confere sozinho duas coisas, e reclama em vez de gerar coisa quebrada:

- se as listas de arquivos batem com o `site/index.html`;
- se `testes/index.html` carrega os mesmos `js`, na mesma ordem. A página de
  testes tem lista própria, e quando ela fica para trás a suíte roda contra um
  app pela metade e acusa falha que não existe.
