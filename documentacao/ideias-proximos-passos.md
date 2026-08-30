# Ideias para o Solaris

Escrito depois da entrada do Supabase, do assistente de IA e da base da
região de Sorocaba. São sugestões, não plano fechado — cada uma diz **que
problema real resolve**, porque ideia que não resolve problema só gasta
sprint.

Estão em ordem de retorno pelo esforço. As três primeiras cabem no semestre.

---

## 1. Comparar com a conta de luz de verdade — a que falta para a banca

**O problema.** O sistema calcula geração, créditos, Fio B e projeta a
próxima conta. Ninguém nunca conferiu esse número contra uma fatura de papel.
Na banca, a primeira pergunta vai ser exatamente essa: *"e bate?"*. Hoje a
resposta honesta é "não sabemos".

**O que fazer.** A tela do leitor de conta já lê a fatura por foto. Falta
guardar o que foi lido como uma **medição de referência** e mostrar, no
Relatório, uma linha só:

```
Sua conta de julho:   R$ 214,80   (foto da fatura)
O Solaris previu:     R$ 209,00   (erro de 2,7%)
```

Uma tabela com três meses reais de um integrante do grupo resolve a sprint 2,
que está aberta desde o começo, e vale mais na apresentação do que qualquer
funcionalidade nova.

**Esforço**: baixo. O leitor já existe; falta uma tabela e uma tela.

---

## 2. O assistente que fala primeiro

**O problema.** O assistente só responde quando perguntam. Mas quem mais
precisa dele é justamente quem não sabe o que perguntar — o mesmo motivo de
existirem as sugestões de partida.

**O que fazer.** Uma vez por semana, ou quando um alerta grave aparece, o
sistema manda a pergunta pelo próprio agente e guarda a resposta como um
**resumo da semana** no painel:

> *"Richard, sua conta deve fechar em R$ 250 este mês, R$ 30 acima da meta.
> O ar-condicionado subiu 14% — foram cinco dias acima de 30 °C. Se você
> ligar ele às 14h em vez das 18h, o painel cobre metade."*

Os dados para isso já estão todos no contexto que a função monta. A diferença
é o gatilho: em vez de a pessoa perguntar, o sistema pergunta por ela.

**Esforço**: baixo-médio. Reaproveita a Edge Function inteira; muda o
gatilho e onde a resposta aparece.

**Cuidado**: gerar isso a cada carregamento de página custaria caro e
diria a mesma coisa. Uma vez por semana, gravado, e a tela mostra o que
está gravado.

---

## 3. Alerta que sai do site

**O problema.** O painel avisa que a meta vai estourar — mas só para quem
está com o site aberto. O consumo alto acontece quando ninguém está olhando.

**O que fazer.** Supabase tem **Database Webhooks** e agendamento por
`pg_cron`. Uma rotina diária compara projeção com meta e dispara e-mail (ou
WhatsApp, via um serviço) quando passar do limite.

**Esforço**: médio. Exige escolher um serviço de envio e cuidar para não
virar spam — um aviso por semana, no máximo, e com botão de desligar.

---

## 4. Tarifa que se atualiza sozinha

**O problema.** A base da região guarda **quando** cada distribuidora
reajusta, mas não **quanto**, de propósito: valor de tarifa velho é pior que
nenhum. Só que isso deixa a pessoa responsável por atualizar à mão, e ela não
vai lembrar.

**O que fazer.** No mês do reajuste da distribuidora dela, o sistema avisa:
*"a CPFL Piratininga reajustou a tarifa em outubro. Confira o valor na sua
conta e atualize aqui."* Um campo, um botão, e o cálculo inteiro se ajusta.

Isso é honesto — não inventa número — e resolve o problema de verdade, que é
a pessoa esquecer.

**Esforço**: baixo. `mesesAteReajuste()` já existe em
`banco-de-dados/dados/regiao-sorocaba.js`.

---

## 5. Comparar com vizinhos parecidos

**O problema.** "Você gastou 310 kWh" não diz se é muito ou pouco. Falta
referência.

**O que fazer.** Com várias contas no mesmo Postgres, dá para responder:
*"casas com 4 pessoas em Sorocaba e sistema de ~5 kWp gastam em média 340 kWh.
Você está 9% abaixo."*

**Esforço**: médio.

**O cuidado que decide se isto pode existir.** Comparação entre pessoas é
o tipo de funcionalidade que vaza dado sem ninguém perceber. As regras
mínimas: agregado nunca sai com menos de **20 unidades** no grupo; nada de
mostrar unidade individual; a consulta roda numa *view* com `security
definer` que só devolve média, nunca linha. E a pessoa escolhe participar —
não entra ligado.

---

## 6. O medidor de verdade

**O problema.** A sprint 4 diz "software feito, falta montar o hardware". O
`firmware/solaris-medidor.ino` está escrito e o painel já sabe ler dele
(Configurações → Fonte da leitura). Ninguém montou.

**O que fazer.** Montar **um**. Um ESP32 com sensor SCT-013 num quadro real,
por uma semana, gravando no Supabase. Um dia de leitura verdadeira ao lado da
simulação, no mesmo gráfico, vale mais na banca do que qualquer slide.

**Esforço**: médio, e é hardware — o risco é o prazo de entrega da peça,
não o código.

---

## 7. Exportar o que é da pessoa

**O problema.** Os dados agora estão num servidor nosso. Quem entrega dado
para um sistema tem que conseguir tirar de volta.

**O que fazer.** Um botão em Configurações que baixa um `.json` com tudo:
unidades, aparelhos, metas, histórico do medidor e as conversas. E um
`.csv` das leituras, que abre no Excel.

**Esforço**: baixo. Os dados já estão todos acessíveis pelo `Banco`.

Vale dizer: isto não é enfeite de LGPD. É o que impede o Solaris de virar uma
armadilha para quem usou por seis meses.

---

## 8. Aplicativo de verdade (PWA)

**O problema.** O site funciona bem no celular, mas mora numa aba. Ninguém
abre uma aba todo dia.

**O que fazer.** Um `manifest.json` e um service worker transformam o Solaris
em algo que se instala na tela inicial e abre sem barra de navegador. É o
menor passo entre "site" e "aplicativo", e não exige loja nem framework.

**Esforço**: baixo — mas **cuidado com o que ele quebra**: service worker
serve arquivo de cache, e cache velho é a origem de "mudei o código e o site
não mudou". Só depois do congelamento da semana 13, e com versão no nome do
cache.

O que já existe sobre virar aplicativo está em `documentacao/app-futuro/`.

---

## O que eu NÃO faria

Ideias que parecem boas e cobram caro:

**Framework.** React ou Vue resolveriam um problema que este projeto não tem
(o estado cabe num objeto) e criariam um que ele não tem hoje: o site deixaria
de abrir com duplo clique.

**Deixar o assistente executar ações.** "Assistente, muda minha meta para 280"
soa ótimo até ele mudar a meta errada. Modelo de linguagem erra; ele pode
sugerir a mudança com um botão do lado, e a pessoa clica.

**Mais um gráfico no painel.** O painel já mostra economia, autossuficiência,
consumo, geração, CO₂, créditos, curva do dia, divisão por aparelho, conta e
retorno. O próximo gráfico não vai ser lido. Se sobrar tempo, gaste no item 1
desta lista.

**Trocar a paleta.** A ordem das cores dos aparelhos foi conferida por script
para daltonismo. Mexer ali sem refazer a conferência desfaz um trabalho que
ninguém vê e todo mundo sente.
