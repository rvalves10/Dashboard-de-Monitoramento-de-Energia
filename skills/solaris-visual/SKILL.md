---
name: solaris-visual
description: Regras de aparência do Solaris. Use ao mexer em qualquer arquivo de frontend/css/, ao criar tela nova, ao escolher cor, tamanho de fonte, raio de canto ou animação, ao adicionar gráfico e ao mexer no céu (frontend/js/ceu.js, frontend/css/ceu.css). Impede que a interface volte a parecer template gerado por máquina.
---

# Aparência do Solaris

Estas regras não são preferência. Cada uma resolve um problema concreto, e
desfazer qualquer uma traz o problema de volta. Antes de mudar uma cor, leia
o porquê.

## 0. A ideia: a interface segue o sol

O Solaris fala de luz, então a peça principal da tela é o próprio céu de
hoje: o caminho do sol nas 24 horas, calculado para a região de Sorocaba,
com o sol no lugar em que ele está agora e o fundo na cor da hora (noite,
crepúsculo, luz dourada, dia). Ele abre a tela de entrada, o painel, o menu
lateral e o celular.

O resto é **papel e tinta**, para o céu ser a única coisa que brilha. Três
materiais, cada um com um trabalho:

- **Papel** (`--ground`, `--surface`): onde moram os números. Claro, com um
  fio de azul — nem o bege quente de interface gerada por IA, nem o cinza
  neutro sem cara.
- **Noite** (`--noite`): o índigo do menu, da entrada e dos cartões escuros.
  É a cor do céu sem sol, não um preto neutro.
- **Sol** (`--sun` e família): o âmbar. Um trabalho só (regra 1).

## 1. Âmbar significa geração solar

**Dentro de gráfico ou de dado:** âmbar (`--sun`) é energia que veio do sol,
azul-ardósia (`--grid`) é energia comprada da rede. Nenhuma outra série pode
ser âmbar — se um aparelho fosse âmbar, a barra de consumo pareceria estar
falando do sol.

Isso vale até para destaque: na unidade **sem painel**, a barra do mês atual
da conta não pode ser âmbar (ela fala de dinheiro, não de sol) — usa a tinta
do céu (`.spark--conta`).

**Fora dos dados,** âmbar é a cor da marca e do próprio sol: o símbolo, o
disco no arco do céu, o marcador de página no menu, o itálico da manchete da
entrada. São papéis que não se misturam na mesma peça.

De dia o âmbar de preenchimento não tem contraste sobre o céu claro (2,5:1).
Ali o arco usa `--sun-ink`. Isso já está nos tokens da fase `ceu--dia`.

## 2. A paleta dos aparelhos foi conferida por script

A ordem em `CORES_EXTRA` (em `backend/motor.js`) não é decoração: é o que
garante que duas fatias vizinhas continuem distinguíveis para quem tem
daltonismo. Foram conferidos separação CVD, piso de croma e contraste com o
fundo claro.

**Se mexer na paleta, confira de novo antes de subir.** Nunca acrescente uma
oitava cor "só desta vez" — a oitava série vira "Outros" em cinza neutro.

Os aparelhos moram sempre no papel, nunca no céu nem na noite: a conferência
foi feita contra o fundo claro.

## 3. Ou borda, ou sombra — nunca as duas

O cartão é definido pela borda e não leva sombra. Sombra fica para o que
flutua de verdade: aviso e dica de gráfico, e aí sem borda.

Borda fina somada a sombra larga é a assinatura mais reconhecível de tela
gerada por máquina.

## 4. O título vem antes do contexto

Nada de rotulinho em caixa-alta por cima do `h1`. Primeiro o título, depois a
linha de contexto embaixo. Vale para a barra do topo, a tela de entrada e a
versão de celular.

Se você está escrevendo um `<div>` com `text-transform:uppercase` logo acima
de um heading, pare: ou vira o próprio heading, ou vira rótulo de dado colado
no dado que ele nomeia.

## 5. Os degraus, e nada entre eles

Tudo sai de `frontend/css/base.css`:

- **Tipografia:** `--t-xs` (12px) até `--t-5xl` (80px — só o número do céu).
  Nada abaixo de 12px, nem em rótulo de eixo. Existe teste que varre o HTML
  de todas as telas atrás de `font-size` abaixo de 12px.
- **Duas vozes:** título e número grande em **Newsreader** (`--f-display`);
  texto em IBM Plex Sans; número que muda a cada tique em IBM Plex Mono. A
  Newsreader ganhou da Fraunces por um motivo medido: ela tem algarismos
  tabulares de verdade. Itálico, só na manchete da entrada.
- **Corpo:** 15px com entrelinha 1.6. Texto é para ler, não para caber.
- **Raio:** cartão para em 14px (`--r-lg`). Pílula só para etiqueta e botão
  pequeno.
- **Espaço:** `--e1` a `--e8`. O que dá ritmo não é usar todos: é usar os
  curtos dentro de um grupo e os longos entre seções.

Não digite `px` solto — nem no CSS, nem no `style` montado pelo JavaScript.
Se falta um degrau, acrescente ao sistema em vez de inventar um valor local.

**Texto dentro de SVG encolhe junto com o desenho.** Rótulo de gráfico e de
arco vai em HTML por cima do desenho (`.chart-y`, `.chart-sol`,
`.arco-rot`), posicionado em porcentagem. Assim ele nunca cai abaixo de 12px
numa tela média.

## 6. Movimento

Só `transform` e `opacity`, e **nunca partindo do zero** — a entrada de tela
começa em 40% de opacidade porque, em máquina lenta, animação que parte do
zero deixa a tela em branco bem na hora em que a pessoa está olhando.

Sem mola, sem repique. Isto é painel de medição.

As barras de dados são a exceção deliberada: animam largura e altura porque
`scaleX` distorceria o canto arredondado, e são poucas e pequenas.

Animação que pulsa só é permitida quando o dado por trás **está mesmo
mudando**. O ponto do medidor pisca porque o número ao lado troca a cada 2
segundos; se o medidor parar, a classe sai e o ponto congela. **O sol não
pulsa**: ele anda porque a hora anda, e o `controle.js` redesenha o arco a
cada 45 segundos.

## 7. Não invente dado no desenho

Escala de barra começa no zero. Se dois meses são parecidos, as barras saem
parecidas mesmo — quem resolve isso esticando a base inventa uma diferença
que não existe. O que dá para melhorar é o contraste.

Passado anterior ao cadastro da unidade aparece **hachurado**, com legenda
própria. Nunca mostre reconstrução com a mesma aparência de leitura.

## 8. O céu é dado, não decoração

- **A fase vem do motor** (`ceuDeHoje`, pela altura real do sol), nunca do
  relógio da parede: às 18h de junho já é noite, às 18h de dezembro ainda é
  luz dourada.
- **A altura do desenho é o seno da altura do sol** — a componente vertical
  da direção do sol, que é o que decide quanta luz cai num painel deitado.
  Por isso o arco tem o formato da curva de geração. Não troque por graus:
  perto dos trópicos o arco vira triângulo.
- **Degradê de céu só existe nos cartões `.ceu`.** Não espalhe degradê pelo
  resto da tela; ele deixa de significar "a hora de agora".
- **Nada de estrelas, nuvens animadas ou partículas.** Não são dado.
- **O brilho do horizonte mora dentro do SVG do arco**, preso ao ponto onde o
  sol está e cortado na linha do horizonte. No fundo do cartão ele passava
  por baixo dos rótulos de 12px e derrubava o contraste para 2:1.
- **Cada fase define o mesmo conjunto de `--ceu-*`**, com fundo e tinta
  conferidos juntos (WCAG AA nas quatro fases). Mudou uma cor de fase,
  confira de novo.
- **O menu lateral é sempre noite**, mesmo ao meio-dia (`.ceu-sobre-noite`).
- **No papel o céu some**: `impressao.css` tira o desenho e deixa o número.

## 9. Antes de dizer que terminou

- [ ] Rodei `testes/index.html` e está tudo verde
- [ ] Abri a tela em 1440px **e** em 390px (e em 1024px, onde o menu recolhe)
- [ ] Se mexi no céu, olhei as quatro fases — dá para congelar o relógio no
      console com `agora = () => new Date(2026, 9, 13, 6, 5)` e `render()`
- [ ] Nenhuma fonte abaixo de 12px
- [ ] Nenhum raio de cartão acima de 14px
- [ ] Nenhuma peça com borda e sombra ao mesmo tempo
- [ ] Nenhum chapéu em caixa-alta acima de heading
- [ ] Rodei `node backend/ferramentas/build.mjs`

## Onde conferir

`frontend/LEIA-ME.md` explica a divisão dos arquivos.
`documentacao/MAPA-DO-PROJETO.md` traz estas regras com mais história.
