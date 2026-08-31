# Ideias para o Solaris

Escrito depois da entrada do Supabase, do assistente de IA e da base da
região de Sorocaba. Cada item diz **que problema real resolve**, porque ideia
que não resolve problema só gasta sprint.

O grupo passou os olhos e decidiu: **cinco entraram, três ficaram de fora.**
As cinco estão implementadas e este documento virou o registro do que foi
feito e do porquê — mais o que ficou para trás, com o motivo.

---

## Feitas

### 1. Comparar com a conta de luz de verdade

**O problema.** O sistema calculava geração, créditos, Fio B e projetava a
próxima conta, e ninguém nunca tinha conferido esse número contra uma fatura
de papel. Na banca, a primeira pergunta ia ser exatamente essa: *"e bate?"*.
A resposta honesta era "não sabemos".

**O que existe agora.** Na tela de **Relatório**, o cartão *"Confere com a sua
conta?"*: você escolhe um mês fechado, digita o total que veio na fatura, e o
Solaris mostra o que ele calculou ao lado, com a diferença em porcentagem. O
número grande do cartão é o **erro médio do motor** contra todas as faturas
informadas.

Três decisões dentro disso:

- **Só mês fechado entra.** Comparar meio mês corrente com uma fatura inteira
  não compara nada, e daria um erro enorme que não é erro do motor.
- **Mês anterior ao cadastro da unidade sai marcado com asterisco.** Ali o
  Solaris reconstruiu o período, não mediu — a comparação vale menos, e a
  tela diz isso.
- **Sem fatura nenhuma, o erro médio é `null`, não zero.** Zero diria que o
  motor acerta em cheio, e não há nada que prove isso.

`conferirFatura()` e `erroMedioDoMotor()` estão em `backend/motor.js`. A conta
de um mês virou a função `contaDoMes()`, usada tanto pelo relatório quanto
pela comparação: duas cópias da mesma fórmula são duas chances de elas se
afastarem.

---

### 2. O assistente que fala primeiro

**O problema.** O assistente só respondia quando perguntavam. Mas quem mais
precisa dele é justamente quem não sabe o que perguntar — o mesmo motivo de
existirem as sugestões de partida na tela vazia.

**O que existe agora.** Uma vez por semana ele escreve sozinho um parágrafo
sobre o mês, que aparece no painel logo abaixo do bloco da economia: o que
está acontecendo com a conta, em reais, e **uma** coisa concreta para fazer
esta semana, ligada à rotina que a pessoa contou no cadastro.

- **Uma vez por semana**, não a cada abertura: gerar a cada carregamento de
  página custaria caro, demoraria e diria a mesma coisa — os números de uma
  casa não mudam de manhã para a tarde.
- **Roda em segundo plano.** A tela não espera por ele, e se falhar não
  aparece erro nenhum: resumo é um extra, e um extra que falha não pode virar
  uma caixa vermelha no painel de quem só queria ver o consumo.
- **A Edge Function trata `tipo: 'resumo'` diferente de uma resposta**: não
  leva histórico junto, não faz pergunta no fim e tem teto de tokens menor.
  Ele não está conversando — está avisando.

---

### 3. Alerta que sai do site

**O problema.** O painel avisa que a meta vai estourar, mas só para quem está
com o site aberto. O consumo alto acontece quando ninguém está olhando.

**O que existe agora.** A Edge Function `avisos`, agendável por `pg_cron`,
que roda uma vez por dia: lê as leituras do mês que subiram, estima o
fechamento, compara com a meta e manda um e-mail quando vai estourar.

Duas coisas que decidem se isso é útil ou irritante:

- **Um e-mail por mês e por conta.** A tabela `avisos_enviados` garante isso.
  Um sistema que avisa a mesma coisa todo dia por duas semanas não avisa nada:
  a pessoa cria uma regra no e-mail e nunca mais lê nenhum aviso nosso,
  inclusive os que importam.
- **A projeção daqui é mais grosseira que a do painel, e é de propósito.** O
  motor mora no navegador; portar ele para o servidor seria manter duas
  cópias da mesma física — a pior coisa que dá para fazer com um cálculo que
  a banca vai questionar. Aqui a conta é `potência média medida × 24 h ×
  dias do mês`, suficiente para decidir *se* vale incomodar a pessoa. O
  número fino ela vê no painel, e o e-mail manda ela para lá.

**O risco dessa conta, dito com todas as letras:** o medidor só grava
enquanto a aba está aberta. Se a pessoa só abre o Solaris de dia, a média
fica puxada para cima e a projeção exagera. Por isso a função exige uma
amostra mínima e espalhada — 200 leituras cobrindo 12 horas diferentes — e
pula a conta quando não tem isso. **Menos avisos é melhor que aviso errado:**
quem recebe alarme falso desliga o alarme.

**Falta um passo para funcionar:** uma chave do [Resend](https://resend.com)
(ou outro serviço de e-mail) e o agendamento. Está em
[`ligar-supabase-e-gemini.md`](ligar-supabase-e-gemini.md).

---

### 4. Tarifa que se atualiza sozinha

**O problema.** A base da região guarda **quando** cada distribuidora
reajusta, mas não **quanto** — valor de tarifa velho é pior que nenhum. Só
que isso deixava a pessoa responsável por atualizar à mão, e ela não ia
lembrar.

**O que existe agora.** No mês do reajuste da distribuidora dela, e no mês
anterior, entra um alerta: *"A CPFL Piratininga reajusta a tarifa este mês.
Quando a próxima fatura chegar, confira a tarifa e atualize em
Configurações — todo o cálculo do Solaris depende desse número."*

Ele cita a tarifa **atual**, a que a pessoa cadastrou. **Não chuta a nova.**
Isso é honesto, e resolve o problema de verdade, que é a pessoa esquecer.

A regra liga e desliga em Alertas e metas, como as outras.

---

### 7. Exportar o que é da pessoa

**O problema.** Os dados agora estão num servidor nosso. Quem entrega dado
para um sistema tem que conseguir tirar de volta.

**O que existe agora.** Em **Configurações → Banco de dados**, dois botões:

- **Baixar tudo (JSON)** — unidades, aparelhos, metas, tarifas, o perfil do
  assistente, o histórico do medidor e as conversas. Se está guardado, sai.
- **Leituras (CSV)** — o histórico minuto a minuto, que abre no Excel.

Isto não é enfeite de LGPD: é o que impede o Solaris de virar uma armadilha
para quem usou por seis meses.

---

## Deixadas de fora

Não por serem ruins — por decisão do grupo, e cada uma tem um custo que
explica a decisão.

### 5. Comparar com vizinhos parecidos

*"Casas com 4 pessoas em Sorocaba gastam em média 340 kWh; você está 9%
abaixo."*

**Por que ficou de fora.** Comparação entre pessoas é o tipo de
funcionalidade que vaza dado sem ninguém perceber, e fazer direito exige
regras que o projeto ainda não tem: agregado só com 20+ unidades no grupo,
consulta numa *view* `security definer` que devolve média e nunca linha, e
participação opcional. Além disso, ela só começa a funcionar quando houver
muitas contas — e hoje há o teste de campo.

Se voltar, comece por essas regras, não pela tela.

### 6. O medidor de verdade

O `firmware/solaris-medidor.ino` está escrito e o painel já sabe ler dele.
Falta montar: um ESP32 com sensor SCT-013 num quadro real.

**Por que ficou de fora.** É hardware, e o risco é o prazo de entrega da
peça, não o código. Continua sendo a coisa que mais valeria na banca — um dia
de leitura verdadeira ao lado da simulação, no mesmo gráfico, vale mais que
qualquer slide. Fica aqui registrada para quando houver tempo de comprar.

### 8. Aplicativo de verdade (PWA)

**Por que ficou de fora.** Um service worker serve arquivo de cache, e cache
velho é a origem de "mudei o código e o site não mudou" — o pior defeito
possível durante um teste de campo, porque some quando você vai investigar.
Se voltar, só depois do congelamento da semana 13, e com versão no nome do
cache.

O que já existe sobre virar aplicativo está em `documentacao/app-futuro/`.

---

## O que eu continuo não fazendo

**Framework.** React ou Vue resolveriam um problema que este projeto não tem
(o estado cabe num objeto) e criariam um que ele não tem hoje: o site
deixaria de abrir com duplo clique.

**Deixar o assistente executar ações.** *"Assistente, muda minha meta para
280"* soa ótimo até ele mudar a meta errada. Modelo de linguagem erra; ele
pode sugerir a mudança com um botão do lado, e a pessoa clica.

**Mais um gráfico no painel.** Ele já mostra economia, autossuficiência,
consumo, geração, CO₂, créditos, curva do dia, divisão por aparelho, conta,
retorno e agora o resumo do assistente. O próximo gráfico não vai ser lido.

**Trocar a paleta.** A ordem das cores dos aparelhos foi conferida por script
para daltonismo. Mexer ali sem refazer a conferência desfaz um trabalho que
ninguém vê e todo mundo sente.

---

## O que sobrou de verdade para a banca

Das cinco feitas, a **1** é a que muda a conversa com a banca — e ela só
funciona se alguém do grupo **informar faturas de verdade**. Três meses reais
de um integrante, na tela de Relatório, e a pergunta *"e bate?"* deixa de não
ter resposta.

É a única tarefa desta lista que o código não resolve sozinho.
