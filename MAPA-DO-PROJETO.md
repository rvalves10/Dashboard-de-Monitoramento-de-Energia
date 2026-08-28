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
├── testes/               54 testes que rodam no navegador
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
| `telas.js` | Monta as telas da versão ampla. | Mudar o que aparece na tela. |
| `movel.js` | As mesmas telas em coluna única. | Mudar a versão de celular. |
| `controle.js` | Cliques, rotas, o tique do medidor e os avisos. | Adicionar botão ou atalho. |

Cada arquivo começa com um comentário explicando o que faz e por quê. Leia
o cabeçalho antes de editar — economiza tempo.

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

O build confere sozinho se as listas de arquivos batem com o `site/index.html`
— se alguém adicionar um CSS e esquecer de registrar, o build reclama em vez
de gerar coisa quebrada.
