---
name: solaris-motor
description: Regras do cálculo do Solaris. Use ao mexer em backend/motor.js, ao mudar qualquer número de tarifa, bandeira, irradiação, arquétipo ou Lei 14.300, ao alterar a divisão por aparelho ou a posição do sol, ao mexer na fatura detalhada (linhasDaConta), e sempre que uma tela for mostrar valor de período passado.
---

# O cálculo do Solaris

Esta é a parte que a banca vai questionar. A regra que sustenta todas as
outras: **nada aqui é digitado — tudo é calculado.**

## 1. Não acrescente número mágico

Se um valor novo precisa existir, ele tem que vir de algum lugar defensável:
da física, da conta de luz da pessoa, ou da lei. Se você está prestes a
escrever `* 0.85` sem explicar de onde veio o 0,85, pare.

Todo número que veio de fora leva comentário dizendo **de onde** veio, e
mora num lugar só — uma constante com nome. O 0,0189 da bandeira estava
copiado em treze lugares de três arquivos; agora é `BANDEIRA_ESTIMADA`.

Os números externos de hoje, e o estado de cada um:

| Constante | De onde vem | Situação |
| --- | --- | --- |
| `IRRADIACAO_REGIAO` | `banco-de-dados/dados/regiao-sorocaba.js` | **pendente**: conferir no Atlas Brasileiro de Energia Solar (INPE/LABREN) |
| `BANDEIRA_ESTIMADA` | tabela de bandeiras da ANEEL (amarela) | **pendente**: buscar a bandeira de cada mês |
| `FATOR_EMISSAO_REDE` | sem fonte escrita | **pendente**: fator médio do SIN publicado pelo MCTI |
| `CUSTO_KWP_*` | ABSOLAR/ANEEL, 1º tri 2026 | pendente: dois ou três orçamentos reais em Sorocaba |
| `ESCADA_FIO_B` | Lei 14.300/2022 | conferido |
| `LAT`, `LON`, `MERIDIANO_FUSO` | geografia de Sorocaba e o fuso de Brasília (UTC−3) | conferido |
| `equacaoDoTempo()` | fórmula de Spencer (1971), a mesma da NOAA | conferido contra o nascer/pôr real |

A irradiação é **uma série para a região inteira** — as cidades atendidas
estão dentro de uns 60 km e a diferença real entre elas é menor que a
incerteza da medida. Trocar lá ajusta o resto sozinho.

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

## 6. A fatura fecha, e é a mesma em todo lugar

A conta detalhada de um mês sai de **`linhasDaConta()`**, e o total de
**`contaDoMes()`**. Relatório e celular leem as duas; nenhuma tela monta a
própria versão.

- **As linhas com valor somam exatamente o total.** Quem confere a fatura
  com a calculadora tem que chegar no mesmo número. Existe teste.
- **Energia injetada aparece, mas não desconta.** Ela vira crédito, e o
  crédito só entra na conta quando é usado (linha "Créditos usados"). Antes
  ela aparecia com sinal de menos e a coluna não fechava por dezenas de
  reais.
- **Sem painel, não há linha de compensação.**

O defeito que isto corrige: a conta do celular tinha a própria fórmula,
esqueceu o Fio B e mostrava um total menor que o do relatório para o mesmo
mês. Duas cópias da mesma fórmula sempre se afastam.

## 7. O céu é a mesma física da geração

`ceuDeHoje()`, `caminhoDoSol()` e `alturaSolarNaHora()` usam a declinação e
o meio-dia solar de `janelaSolar()` — de propósito. O arco que a tela
desenha nasce e se põe exatamente quando a curva de geração começa e
termina. Se mudar um, muda o outro, e o teste "o arco nasce e se põe na
mesma hora da curva de geração" confere.

O meio-dia solar leva a longitude e a equação do tempo. Antes era 12h12
fixo e ninguém via o erro; quando o nascer e o pôr passaram a aparecer
escritos na tela, apareceu o erro de até 16 minutos.

## 8. Estado vazio é estado legítimo

Conta recém-criada sem unidade, unidade apagada, perfil de exemplo com os
exemplos desligados: os três acontecem de verdade, e o medidor chama o motor
de 2 em 2 segundos.

Use `UNIDADE_VAZIA` e `mesVazio()`, que têm a mesma forma dos de verdade com
tudo em zero. **Não espalhe `if (!u)` por campo.** Quem decide o que desenhar
é `semUnidade()`, e ele continua dizendo a verdade.

## 9. Conta nova começa vazia

Unidade nova só tem os aparelhos que a pessoa marcou no passo 3 do cadastro.
Unidade salva antes dessa versão não tem a lista e mantém tudo — senão o
painel de quem já usava esvaziaria sozinho.

Nenhum dado de demonstração pode aparecer em conta criada pelo usuário.

## 10. Antes de dizer que terminou

- [ ] `testes/index.html` verde — a suíte cobre energia, lei, ranking e datas
      de borda
- [ ] Números novos têm comentário dizendo de onde vieram, e moram numa constante só
- [ ] A soma dos aparelhos ainda fecha com o medidor
- [ ] Testei em data de borda: dia 1º, dia 31, fevereiro, virada de ano
- [ ] Se mexi em passado, conferi que a marcação de estimado continua certa
- [ ] Rodei `node backend/ferramentas/build.mjs`

## Onde conferir

`backend/LEIA-ME.md` explica a ordem do cálculo e o que a segurança é e não é.
