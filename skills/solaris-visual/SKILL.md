---
name: solaris-visual
description: Regras de aparência do Solaris. Use ao mexer em qualquer arquivo de frontend/css/, ao criar tela nova, ao escolher cor, tamanho de fonte, raio de canto ou animação, e ao adicionar gráfico. Impede que a interface volte a parecer template gerado por máquina.
---

# Aparência do Solaris

Estas regras não são preferência. Cada uma resolve um problema concreto, e
desfazer qualquer uma traz o problema de volta. Antes de mudar uma cor, leia
o porquê.

## 1. Âmbar significa geração solar

**Dentro de gráfico ou de dado:** âmbar (`--sun`) é energia que veio do sol,
azul-ardósia (`--grid`) é energia comprada da rede. Nenhuma outra série pode
ser âmbar — se um aparelho fosse âmbar, a barra de consumo pareceria estar
falando do sol.

**Fora dos dados,** âmbar é a cor da marca: o símbolo, o marcador de página
no menu, o botão de entrar sem conta. São dois papéis, e eles não se misturam
na mesma peça.

## 2. A paleta dos aparelhos foi conferida por script

A ordem em `CORES_EXTRA` (em `backend/motor.js`) não é decoração: é o que
garante que duas fatias vizinhas continuem distinguíveis para quem tem
daltonismo. Foram conferidos separação CVD, piso de croma e contraste com o
fundo claro.

**Se mexer na paleta, confira de novo antes de subir.** Nunca acrescente uma
oitava cor "só desta vez" — a oitava série vira "Outros" em cinza neutro.

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

- **Tipografia:** `--t-xs` (12px) até `--t-4xl` (60px). Nada abaixo de 12px,
  nem em rótulo de eixo.
- **Corpo:** 15px com entrelinha 1.6. Texto é para ler, não para caber.
- **Raio:** cartão para em 14px (`--r-lg`). Pílula só para etiqueta e botão
  pequeno.
- **Espaço:** `--e1` a `--e8`. O que dá ritmo não é usar todos: é usar os
  curtos dentro de um grupo e os longos entre seções.

Não digite `px` solto. Se falta um degrau, acrescente ao sistema em vez de
inventar um valor local.

## 6. Movimento

Só `transform` e `opacity`, e **nunca partindo do zero** — a entrada de tela
começa em 40% de opacidade porque, em máquina lenta, animação que parte do
zero deixa a tela em branco bem na hora em que a pessoa está olhando.

Sem mola, sem repique. Isto é painel de medição.

As barras de dados são a exceção deliberada: animam largura e altura porque
`scaleX` distorceria o canto arredondado, e são poucas e pequenas.

Animação que pulsa só é permitida quando o dado por trás **está mesmo
mudando**. O ponto do medidor pisca porque o número ao lado troca a cada 2
segundos; se o medidor parar, a classe sai e o ponto congela.

## 7. Não invente dado no desenho

Escala de barra começa no zero. Se dois meses são parecidos, as barras saem
parecidas mesmo — quem resolve isso esticando a base inventa uma diferença
que não existe. O que dá para melhorar é o contraste.

Passado anterior ao cadastro da unidade aparece **hachurado**, com legenda
própria. Nunca mostre reconstrução com a mesma aparência de leitura.

## 8. Antes de dizer que terminou

- [ ] Rodei `testes/index.html` e está tudo verde
- [ ] Abri a tela em 1440px **e** em 390px
- [ ] Nenhuma fonte abaixo de 12px
- [ ] Nenhum raio de cartão acima de 14px
- [ ] Nenhuma peça com borda e sombra ao mesmo tempo
- [ ] Nenhum chapéu em caixa-alta acima de heading
- [ ] Rodei `node backend/ferramentas/build.mjs`

## Onde conferir

`frontend/LEIA-ME.md` explica a divisão dos arquivos.
`documentacao/MAPA-DO-PROJETO.md` traz estas regras com mais história.
