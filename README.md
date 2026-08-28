# Solaris

Site de monitoramento de energia solar para residência e pequeno negócio.
Projeto de UPX.

Mostra para onde vai cada quilowatt, quanto o sol cobriu de verdade e quanto
vem na próxima conta — com a Lei 14.300 já dentro do cálculo.

---

## Abrir

**Duplo clique em `index.html`.** O site abre na tela de entrada.

Para começar a testar na hora, clique em **"Entrar sem criar conta"** — vai
direto para o painel. Criar conta é para quando você quiser seus dados
separados de quem mais usa o mesmo computador.

Não tem instalação, não tem `npm install`, não precisa de internet nem de
servidor. Funciona em qualquer navegador razoavelmente atual.

Se preferir um arquivo só para mandar por e-mail ou WhatsApp, use
**`Solaris.html`** — é o site inteiro empacotado.

## Conferir se está tudo certo

Abra **`testes/index.html`** e espere alguns segundos.
Devem aparecer **105 de 105 testes passando**, tudo verde.

---

## Para a equipe: teste de campo

Se você chegou aqui para participar do teste de 7 a 30 dias, o roteiro está
em **[`docs/teste-de-campo.md`](docs/teste-de-campo.md)**. Leva 5 minutos
para começar.

## Para quem vai mexer no código

Leia **[`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md)** antes de abrir qualquer
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

**Relatório que imprime limpo.** `Ctrl+P` na tela de Relatório.

---

## Estrutura

```
Solaris/
├── index.html          abre o site
├── Solaris.html        o site num arquivo só (gerado pelo build)
├── site/               ◀ o projeto: css/ e js/
├── testes/             105 testes, rodam no navegador
├── firmware/           código do ESP32, para quando o sensor existir
├── app-futuro/         fase 2: o que fazer para virar aplicativo
├── docs/               teste de campo, contrato de dados, usabilidade
├── apresentacao/       plano do semestre e slides da banca
├── design/             o desenho original
└── ferramentas/        o script de build
```

Detalhe de cada arquivo em [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

---

## Banco de dados

**IndexedDB** — o banco que já vem no navegador. Escolhemos ele porque é
banco de verdade (transações, índices, consultas) sem exigir servidor, o que
mantém a promessa de abrir com duplo clique.

Três tabelas:

| Tabela | O que guarda |
| --- | --- |
| `contas` | quem pode entrar (chave: e-mail) |
| `estado` | o que cada conta configurou |
| `leituras` | o histórico do medidor, uma linha por minuto |

A tabela de leituras é a razão de existir um banco aqui. Uma leitura por
minuto dá 1.440 linhas por dia e mais de dez mil por semana — isso não cabe
em `localStorage`, que é um mapa de texto com uns 5 MB. Guardamos 7 dias.

**Configurações → Banco de dados** mostra o estado ao vivo: quantas leituras,
quanto espaço e um gráfico das últimas duas horas gravadas.

Se o IndexedDB não abrir, tudo cai sozinho para `localStorage` e a tela
avisa. O site nunca deixa de funcionar por causa do banco.

---

## Entrada, contas e dados de exemplo

A primeira tela é a de entrada: à esquerda o que o site faz, à direita o
formulário. **Ninguém fica travado ali** — o botão "Entrar sem criar conta"
leva direto ao painel.

**Visitante e conta veem coisas diferentes, de propósito:**

| | O que aparece |
| --- | --- |
| **Visitante** | Casa das Acácias e Padaria Pão de Ouro — as duas unidades de demonstração, para conhecer o sistema |
| **Conta nova** | Nada. A conta começa vazia e o site pede a primeira unidade |

Conta nova não pode vir com casa de mentira dentro. Quem cria conta cadastra
a própria unidade — ou liga os exemplos em Configurações se só quiser passear
pelo sistema antes.

**Isto não é segurança contra quem tem acesso ao computador.** Sem servidor,
não existe segredo do lado do cliente. O que é real:

- a senha nunca é gravada, só uma derivação com salt e 150 mil iterações;
- comparação em tempo constante e mesma mensagem de erro para senha errada e
  e-mail inexistente, para não revelar quais contas existem;
- cada conta tem seu próprio balde de dados.

Está escrito na própria tela de login, de propósito.

---

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

## Combinado do grupo

- Branch por frente, `main` sempre abrindo sem erro.
- Rodar `testes/index.html` antes de abrir pull request.
- `node ferramentas/build.mjs` depois de mexer em `site/`.
- **Congelamento na semana 13**: depois disso só correção de defeito.
