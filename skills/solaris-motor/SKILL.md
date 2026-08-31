---
name: solaris-motor
description: Regras do cálculo do Solaris. Use ao mexer em backend/motor.js, ao mudar qualquer número de tarifa, irradiação, arquétipo ou Lei 14.300, ao alterar a divisão por aparelho, e sempre que uma tela for mostrar valor de período passado.
---

# O cálculo do Solaris

Esta é a parte que a banca vai questionar. A regra que sustenta todas as
outras: **nada aqui é digitado — tudo é calculado.**

## 1. Não acrescente número mágico

Se um valor novo precisa existir, ele tem que vir de algum lugar defensável:
da física, da conta de luz da pessoa, ou da lei. Se você está prestes a
escrever `* 0.85` sem explicar de onde veio o 0,85, pare.

Todo número que veio de fora leva comentário dizendo **de onde** veio.

Hoje existe **um só** número externo: `IRRADIACAO_REGIAO`, a irradiação média
mês a mês. Ele vem de `banco-de-dados/dados/regiao-sorocaba.js`, é **uma série
para a região inteira** — as cidades atendidas estão dentro de uns 60 km e a
diferença real entre elas é menor que a incerteza da medida — e continua
pendente de conferência no Atlas Brasileiro de Energia Solar (INPE/LABREN)
para Sorocaba. Trocar lá ajusta o resto sozinho.

**Nada de tarifa embutida no código.** Tarifa muda todo ano e varia por
bandeira e por classe; um valor velho é pior que nenhum. A tarifa vem da conta
de luz da própria pessoa. O que a base da região guarda é *quando* cada
distribuidora reajusta.

## 2. A soma tem que fechar com o medidor

A divisão por aparelho não pode sobrar nem faltar. O que os aparelhos
declarados não explicam vira **"Não identificado"** — que é a verdade e é o
convite para a pessoa cadastrar o resto.

**Nunca renormalize as fatias** para forçar 100%. Se a pessoa declarou só a
geladeira, a geladeira não vira a conta inteira dela.

Existe teste automatizado para isso. Se ele quebrar, o defeito é seu, não do
teste.

## 3. Ruído tem semente fixa

O tempo de um dia vem de ruído semeado pela data: 12 de junho sempre tem o
mesmo tempo, mas cada dia é diferente do outro.

Se você trocar isso por `Math.random()`, a simulação deixa de ser
reproduzível e os testes passam a falhar de forma intermitente — que é o pior
tipo de falha para depurar.

## 4. Lei 14.300/2022

- Ligado até **06/01/2023**: compensação integral até 2045 (direito
  adquirido).
- Ligado a partir de **07/01/2023**: paga percentual crescente do Fio B sobre
  a energia compensada. A escada está em `ESCADA_FIO_B` — 15% em 2023 até
  100% em 2029.
- O **mínimo faturável** (custo de disponibilidade) **nunca** é abatido por
  crédito.

Aplicar a lei derrubou a economia declarada da casa de exemplo de R$ 172 para
R$ 139 por mês. Se alguém "consertar" o cálculo e a economia subir de volta,
provavelmente a lei foi desligada sem querer.

## 5. Medido não é o mesmo que estimado

O medidor só vale a partir de `criadaEm` — o instante em que a unidade foi
cadastrada. Antes disso o motor reconstrói o período com a mesma física, para
haver contra o que comparar, **mas isso é conta, não leitura.**

Use `mesMedido()`, `mesParcial()` e `diaMedido()`. **Toda tela que mostra
passado precisa marcar o que é reconstrução** — hachura no gráfico, aviso no
relatório. Apresentar simulação como leitura é o tipo de coisa que derruba um
trabalho na banca.

## 6. Estado vazio é estado legítimo

Conta recém-criada sem unidade, unidade apagada, perfil de exemplo com os
exemplos desligados: os três acontecem de verdade, e o medidor chama o motor
de 2 em 2 segundos.

Use `UNIDADE_VAZIA` e `mesVazio()`, que têm a mesma forma dos de verdade com
tudo em zero. **Não espalhe `if (!u)` por campo.** Quem decide o que desenhar
é `semUnidade()`, e ele continua dizendo a verdade.

## 7. Conta nova começa vazia

Unidade nova só tem os aparelhos que a pessoa marcou no passo 3 do cadastro.
Unidade salva antes dessa versão não tem a lista e mantém tudo — senão o
painel de quem já usava esvaziaria sozinho.

Nenhum dado de demonstração pode aparecer em conta criada pelo usuário.

## 8. Antes de dizer que terminou

- [ ] `testes/index.html` verde — a suíte cobre energia, lei, ranking e datas
      de borda
- [ ] Números novos têm comentário dizendo de onde vieram
- [ ] A soma dos aparelhos ainda fecha com o medidor
- [ ] Testei em data de borda: dia 1º, dia 31, fevereiro, virada de ano
- [ ] Se mexi em passado, conferi que a marcação de estimado continua certa
- [ ] Rodei `node backend/ferramentas/build.mjs`

## Onde conferir

`backend/LEIA-ME.md` explica a ordem do cálculo e o que a segurança é e não é.
