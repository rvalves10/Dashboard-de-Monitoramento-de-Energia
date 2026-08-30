# Frontend

Tudo que a pessoa vê. Não há cálculo aqui: esta camada pergunta ao
`backend/` e desenha a resposta.

```
frontend/
├── index.html     a página; carrega as camadas na ordem certa
├── css/           a aparência, dividida por assunto
├── js/            as telas e os eventos
└── assets/        o ícone
```

---

## `js/` — quatro arquivos, quatro trabalhos

| Arquivo | O que faz | Quando mexer |
| --- | --- | --- |
| `telas.js` | Monta as telas da versão ampla. Cada tela é uma função que devolve HTML como texto. | Mudar o que aparece na tela. |
| `movel.js` | As mesmas telas em coluna única, para tela estreita. | Mudar a versão de celular. |
| `assistente.js` | As duas telas de conversa: o papo rápido do cadastro e o chat com o assistente. Serve à versão ampla e à de celular — a conversa é a mesma peça nas duas. | Mudar como a conversa aparece. |
| `controle.js` | Cliques, rotas, o tique do medidor e os avisos. | Adicionar botão ou atalho. |

### As três portas do `render()`

`controle.js` decide o que desenhar por três perguntas seguidas, e a ordem
delas é o desenho do produto:

1. **sem sessão** → tela de entrada (a única porta do site);
2. **com sessão e sem o papo rápido** → as cinco perguntas;
3. **com papo feito e sem unidade** → cadastro da primeira unidade.

Só depois das três existe painel.

---

## `css/` — a ordem importa

Cada arquivo pode sobrescrever o anterior. Se mexer na ordem no
`index.html`, coisas quebram.

| Arquivo | O que tem dentro |
| --- | --- |
| `base.css` | Cores, fontes, espaçamentos e o reset. **Tudo herda daqui.** |
| `componentes.css` | Peças de várias telas: menu, cartões, botões, formulários. |
| `telas.css` | O que é de uma tela só: o bloco da economia, o donut, os gráficos, a tabela de aparelhos, a fatura. |
| `conta.css` | Tela de entrada, cartão da conta e o painel do banco de dados. |
| `assistente.css` | A fala — a bolha usada nas duas telas de conversa — mais o papo do cadastro e o chat. |
| `movel.css` | Como o site se comporta em tela estreita. |
| `responsivo.css` | Os pontos de quebra entre desktop, tablet e celular. |
| `impressao.css` | Como o relatório sai no papel. |

As regras de aparência — o que é âmbar, quanto de raio, que tamanho de fonte
— estão em
[`../documentacao/MAPA-DO-PROJETO.md`](../documentacao/MAPA-DO-PROJETO.md),
com o porquê de cada uma. Leia antes de mudar uma cor.

---

## Três coisas que parecem estranhas e têm motivo

**As telas são funções que devolvem texto.** Sem React, sem Vue, sem npm.
Para um projeto deste tamanho é mais simples de ler e, principalmente, o site
abre com duplo clique — na banca não dá para depender de `npm install`.

**Os botões não têm `onclick`.** Cada um leva um `data-act`, e existe um único
escutador no documento. Como a tela é redesenhada inteira a cada mudança,
`onclick` se perderia; com delegação, nunca.

**Digitar não redesenha a tela.** Se redesenhasse, o campo perderia o foco no
meio da palavra. As funções `sync*` em `controle.js` atualizam só o que
depende do que foi digitado. **Quem adicionar um elemento que reage ao
formulário precisa atualizar a `sync` correspondente**, senão ele congela com
o valor do último desenho.

---

## O que esta camada não faz

Não calcula tarifa, não decide regra de compensação, não fala com o
IndexedDB. Se você está prestes a escrever uma conta aqui, ela provavelmente
pertence ao `backend/`.
