# Solaris — visão e modelo de negócio

Escrito depois de uma revisão do projeto inteiro e da troca da camada
visual. Responde três perguntas: **o que o Solaris é hoje, o que ele pode
virar, e como isso paga as contas.**

Os números de mercado e de preço daqui são **hipóteses para validar**, não
previsão. Onde existe fonte, ela está dita; onde não existe, está escrito
"validar".

---

## Em uma frase

> **O Solaris é a camada de inteligência entre o brasileiro e a conta de
> luz:** lê, explica, confere e age — com o sol de cada telhado e a regra
> de cada distribuidora dentro do cálculo.

Hoje ele é um painel de monitoramento solar muito bem feito. A visão é que
ele vire **a primeira coisa que alguém abre quando pensa em energia** — tenha
painel no telhado ou não.

---

## 1. O diagnóstico

### O que já é raro, e vale proteger

- **Um motor que não inventa número.** Declinação solar, equação do tempo,
  nuvem por ruído semeado, compensação de créditos mês a mês, mínimo
  faturável que crédito não abate, Fio B escalonado da Lei 14.300. É mais
  rigor do que boa parte dos aplicativos comerciais de energia.
- **Honestidade como regra de projeto.** Período reconstruído aparece
  hachurado; o relatório impresso diz o que é estimativa; o motor confere
  a si mesmo contra a fatura de papel e publica o próprio erro. Isso é
  diferencial de produto, não só de banca.
- **Engenharia de gente grande.** 182 testes rodando no navegador, varredura
  de injeção de HTML em todas as telas, testes de acessibilidade, RLS no
  banco, exportação dos dados (LGPD), prompt do assistente como código
  legível, skills que padronizam o trabalho com IA.
- **Conhecimento local.** Vinte cidades, três distribuidoras, o mês de
  reajuste de cada uma. Quem mora em Piedade não é atendido pela CPFL, e o
  sistema sabe.
- **O caminho de quem não tem painel.** A simulação "vale a pena instalar?"
  com o consumo real, a tarifa real, o telhado e o Fio B descontado é o
  lead mais qualificado do mercado solar.

### O que impede de ser produto hoje, em ordem de gravidade

1. **Não há dado real.** O medidor é virtual; o firmware do ESP32 está
   escrito, mas o sensor nunca foi montado; não há integração com inversor.
   Sem dado real, o Solaris é uma demonstração muito convincente.
2. **A conferência com a fatura ainda não tem fatura.** O erro médio do
   motor é `null` porque ninguém informou uma conta de verdade. É a primeira
   pergunta de qualquer banca, cliente ou investidor: *"e bate?"*.
3. **Três números externos sem conferência.** Irradiação da região (CRESESB/
   INPE), bandeira de cada mês (ANEEL) e fator de emissão de CO₂ — este sem
   fonte nenhuma. O fator médio da rede publicado pelo MCTI muda muito de
   ano para ano e, em ano de reservatório cheio, fica bem abaixo do valor
   usado: o "CO₂ evitado" pode estar exagerado.
4. **"IA" onde ainda não há modelo.** A divisão por aparelho é um rateio do
   consumo medido pelo perfil de horário de cada categoria. É honesto e fecha
   com o medidor, mas não é aprendizado de máquina. Num produto vendido,
   chamar isso de IA é risco de credibilidade e de propaganda enganosa.
   **Recomendação:** "estimativa por padrão de uso" até existir desagregação
   treinada com dado do medidor (NILM).
5. **Duas cascas com lógica duplicada.** `telas.js` e `movel.js` montam as
   mesmas informações cada um do seu jeito — e a conta do celular já tinha se
   afastado do relatório (veja abaixo). O próximo passo de arquitetura é
   componente único e responsivo.
6. **Tudo depende da aba aberta.** O medidor grava enquanto o navegador está
   aberto; o aviso por e-mail precisa de amostra mínima por isso. Produto de
   verdade ingere dado no servidor, 24 horas por dia.

### O que esta revisão já corrigiu

| Defeito | Por que importava |
| --- | --- |
| A fatura do Relatório **não fechava**: a energia injetada aparecia com sinal de menos mas não era descontada — a coluna somava R$ 6, o total dizia R$ 73. | Quem confere com a calculadora acha dinheiro sumido. Agora as linhas somam o total centavo a centavo, com teste. |
| A **conta do celular esquecia o Fio B** (R$ 69 no celular, R$ 73 no relatório, mesmo mês) e, sem painel, dizia "Você economizou R$ 0". | Dois números diferentes para a mesma conta derrubam a confiança no resto. Agora os dois leem a mesma função. |
| O aviso de abertura dizia **"Medidor conectado — lendo em tempo real"** com a simulação ligada. | Era a primeira frase que a pessoa lia, e era falsa. Agora a tela diz "medidor virtual" sempre que é virtual. |
| O **nascer e o pôr do sol estavam até 16 minutos errados** (meio-dia solar fixo em 12h12). | Ninguém via enquanto o sol só existia no cálculo. Com a hora escrita na tela, qualquer pessoa confere pela janela. Entrou a equação do tempo. |
| A **bandeira tarifária** (0,0189) estava copiada em **13 lugares** de 3 arquivos, e o rótulo "Bandeira amarela" era fixo. | Atualizar a bandeira exigiria achar treze cópias. Agora é uma constante com fonte, e a tela diz "estimada". |
| Tamanhos de fonte de **10,5 e 11,5 px** digitados direto nas telas. | Quebrava o piso de legibilidade do próprio projeto. Agora há teste que varre o HTML. |
| A tela de entrada morava no `backend/`. | Contrariava a regra de camada ("o backend não monta HTML"). Foi para `frontend/js/entrada.js`. |
| Na unidade sem painel, a barra da **conta** do mês ficava âmbar. | Âmbar dentro de dado significa geração solar — regra nº 1 do projeto. |

---

## 2. A nova identidade: a interface segue o sol

A camada visual foi refeita em torno de uma ideia só: **o Solaris fala de
luz, então a peça principal da tela é o céu de agora.**

- O **arco do sol** nas 24 horas, calculado para Sorocaba, com o sol no lugar
  em que ele está — na entrada, no painel, no menu e no celular.
- O **fundo muda com a fase do céu**: noite, crepúsculo, luz dourada, dia.
  Quem abre às sete da noite vê o crepúsculo; às seis da manhã, o sol
  nascendo à esquerda com o horizonte laranja.
- Não é enfeite: a altura do arco é a do sol de verdade (quase a pino em
  dezembro, baixo em junho), que é exatamente por que o painel gera menos no
  inverno. O desenho mostra o motivo, não só o efeito.
- Tipografia em duas vozes: **Newsreader** (serifa editorial, com algarismos
  tabulares) para títulos e números; IBM Plex para texto e dado.
- Três materiais: papel claro para os números, **noite** (índigo) para o
  menu, e o âmbar do sol com um trabalho só.

Nenhum painel de energia no mercado tem essa cara. É a identidade que faz o
Solaris ser reconhecido de longe — e ela só funciona porque o motor por trás
é sério.

As regras ficaram registradas em `skills/solaris-visual/SKILL.md`, com o
porquê de cada uma.

---

## 3. A visão

### O problema que ninguém resolveu

A conta de luz brasileira é das mais difíceis de ler do mundo: energia e
uso da rede separados, bandeira que muda todo mês, impostos, iluminação
pública, custo de disponibilidade. Para quem tem painel, ainda há créditos
que vencem em 60 meses e o Fio B subindo degrau a degrau até 2029. O Brasil
já passa de 30 GW de geração solar distribuída, quase toda em telhado, e a
imensa maioria dessas pessoas não sabe dizer se o sistema rende o que
deveria nem se a conta veio certa.

E as decisões só aumentam: instalar ou não, de que tamanho, aderir à tarifa
branca, assinar energia de uma usina compartilhada, e — com a abertura do
mercado livre para a baixa tensão em discussão — escolher de quem comprar
energia.

### Os quatro verbos do produto

| Verbo | O que o Solaris faz | Já existe? |
| --- | --- | --- |
| **Entender** | A conta explicada linha a linha; para onde vai cada kWh; o céu de hoje e por que o painel gera o que gera. | Sim |
| **Conferir** | A fatura de papel ao lado do cálculo; o erro do motor publicado; auditoria que encontra cobrança errada da distribuidora (crédito não abatido, Fio B acima da escada, classe tarifária errada). | Parcial — falta a auditoria |
| **Decidir** | Vale a pena instalar? De que tamanho? Tarifa branca compensa? Assinatura de energia para quem não tem telhado? Mercado livre quando abrir? | Parcial — existe a simulação de instalação |
| **Agir** | Alerta no WhatsApp; deslocar a máquina de lavar para a janela de sol; chamar limpeza quando o rendimento cai; contestar a cobrança; pedir orçamento a instaladores avaliados. | Parcial — existe alerta no painel e por e-mail |

### O fosso — o que é difícil de copiar

1. **A regra brasileira dentro do motor.** Lei 14.300, bandeiras, Fio B
   escalonado, mínimo faturável, calendário de reajuste de cada
   distribuidora. Plataformas estrangeiras de monitoramento não fazem isso;
   os aplicativos de fabricante falam do inversor, não da conta.
2. **Agnóstico de marca.** Lê qualquer inversor, o próprio medidor e a
   própria fatura — o cliente não fica preso a um fabricante.
3. **Honestidade publicada.** "O único aplicativo de energia que diz quanto
   erra." Ninguém mais publica o próprio erro contra a fatura.
4. **Efeito de rede com privacidade.** Cada telhado medido melhora a
   estimativa da região e o comparativo entre vizinhos — sempre agregado,
   com mínimo de unidades por grupo e participação opcional.
5. **A identidade.** A interface que segue o sol.

### Para quem

| Segmento | O que quer | Papel no negócio |
| --- | --- | --- |
| Dono de sistema solar | Saber se o sistema rende e se a conta veio certa | Usuário principal |
| Quem ainda não tem painel | Saber se vale a pena | Funil de leads — o mais valioso |
| Pequeno negócio (padaria, mercado, restaurante) | Conta alta, decisão de equipamento | Assinatura e auditoria |
| Integradores e instaladores | Pós-venda sem ligação de suporte, monitoramento de várias marcas | **Primeiro cliente pagante** |
| Distribuidoras | Menos ligação de "por que minha conta veio alta", programas de eficiência | Projetos e licença |
| Condomínios e geração compartilhada | Rateio de créditos, transparência | Assinatura |

---

## 4. Como vira renda

Não é para fazer tudo. É um cardápio, com a ordem recomendada logo depois.

| # | Modelo | Quem paga | Como cobra | Quando liga |
| --- | --- | --- | --- | --- |
| 1 | **Solaris Pro para integradores** — monitoramento multimarca, portal do cliente com a marca do integrador, relatório mensal com Lei 14.300, alerta de queda de rendimento | Integrador | Por sistema monitorado por mês (hipótese: R$ 4 a R$ 9) | Fase 1 |
| 2 | **Leads qualificados** — quem simula "vale a pena instalar?" pede orçamento a três instaladores avaliados, com consentimento | Integrador | Por lead entregue e/ou porcentagem do contrato fechado (validar com o mercado) | Fase 2 |
| 3 | **Solaris+ (assinatura pessoal)** — grátis para entender; pago para alerta no WhatsApp, assistente sem limite, auditoria automática, várias unidades, tarifa branca | Pessoa física, pequeno negócio | Mensalidade (hipótese: R$ 9,90 a R$ 19,90) | Fase 2 |
| 4 | **Auditoria de fatura** — encontra cobrança errada e prepara a contestação | Pequeno negócio, pessoa física | Porcentagem do valor recuperado | Fase 3 |
| 5 | **Financiamento e seguro embarcados** — crédito para o sistema simulado, seguro do sistema instalado | Banco, fintech de crédito solar, seguradora | Comissão por contrato | Fase 3 |
| 6 | **Serviços** — limpeza, manutenção, troca de inversor quando o rendimento cai abaixo do esperado | Prestador parceiro | Comissão por serviço | Fase 3 |
| 7 | **Energia por assinatura** — para quem mora em apartamento ou não tem telhado: indicar usinas de geração compartilhada | Usina | Comissão recorrente por cliente ativo | Fase 3 |
| 8 | **Solaris Medidor** — o kit ESP32 montado, com dado em tempo real por aparelho | Pessoa física, pequeno negócio | Venda do kit + assinatura, ou comodato dentro do plano | Fase 3 |
| 9 | **Projetos com distribuidoras** — as distribuidoras são obrigadas por lei (Lei 9.991/2000) a investir parte da receita em P&D e em eficiência energética; o Solaris é exatamente um projeto de eficiência para residência e pequeno negócio, e a CPFL Piratininga atende Sorocaba | Distribuidora | Contrato de projeto; depois licença da "conta explicada" dentro do app dela | Fase 1 a 3 |
| 10 | **Mercado livre** — quando a baixa tensão puder escolher de quem comprar, o Solaris já conhece a curva de consumo e recomenda a migração | Comercializadora | Comissão de comercialização | Fase 4 |
| 11 | **Certificados de energia renovável (I-REC)** — agregar a geração **medida** de milhares de telhados e vender certificados para empresas, dividindo com o dono do telhado | Empresas com meta de energia renovável | Venda de certificados, com repasse | Fase 4 |
| 12 | **Índices regionais anônimos** — consumo, geração e rendimento por cidade, sempre agregados e com consentimento | Distribuidoras, comercializadoras, pesquisa | Licença de dados | Fase 4 |

### Por que começar pelo integrador

O integrador **já tem o cliente**, já é cobrado por ele quando o sistema
"gera pouco", e hoje atende usando o portal de cada fabricante. Para ele, um
painel único de todas as marcas, que explica a conta para o cliente final
com a lei dentro, é redução de custo de suporte — paga-se fácil. E cada
integrador traz centenas de usuários finais de graça: é o canal de
aquisição mais barato que existe para o B2C.

### Uma conta de guardanapo (hipóteses para validar)

- Um integrador médio que monitora 300 sistemas a R$ 6 = **R$ 1.800 por mês**.
- 50 integradores = **R$ 90 mil por mês**, perto de R$ 1,1 milhão por ano de
  receita recorrente — e 15 mil usuários finais no funil.
- Desses usuários, os vizinhos e parentes que ainda não têm painel entram na
  simulação; cada orçamento fechado vira comissão para o modelo 2.

O custo variável por usuário é baixo (banco e função em nuvem, chamadas ao
modelo de linguagem só para resumo semanal e conversa). O custo que pesa é
gente e integração com inversores.

---

## 5. Como se sustenta ao longo do tempo

- **Receita recorrente na base** (Solaris Pro, Solaris+), **transação para
  acelerar** (leads, financiamento, serviços) e **projeto para financiar o
  começo** sem vender participação (P&D e eficiência com distribuidora,
  fomento público).
- **O ritual mensal já existe**: a conta chega todo mês. O Solaris vira o
  lugar onde a pessoa abre a fatura — retenção sem truque.
- **Custo de troca honesto**: quem tem três anos de histórico, créditos
  acompanhados por 60 meses e faturas conferidas não recomeça do zero em
  outro lugar. (E pode levar tudo embora quando quiser — a exportação já
  existe, e é isso que dá confiança para ficar.)
- **Cada mudança de regra é motivo para abrir o Solaris**: degrau novo do
  Fio B, bandeira vermelha, reajuste da distribuidora, abertura do mercado
  livre. Para um concorrente estrangeiro, cada uma é custo; para o Solaris,
  é produto.
- **Efeito de rede**: mais telhados medidos, melhor a estimativa regional e o
  comparativo — o que atrai mais telhados.

### Dinheiro para chegar lá

Para um projeto que nasce na faculdade, nesta ordem: programas de fomento
e aceleração sem custo de participação (FAPESP PIPE, Centelha, InovAtiva
Brasil, Sebrae, incubadoras da região), projeto de P&D ou eficiência com a
distribuidora local, e capital semente **só depois** de existir receita
recorrente — ela é o que define o preço da conversa.

---

## 6. A sequência

| Fase | Prazo | O que fazer | Como saber que deu certo |
| --- | --- | --- | --- |
| **0 — Provar o cálculo** | até a banca | Informar três faturas reais; montar um medidor ESP32 numa casa real por sete dias; conferir irradiação, bandeira e fator de CO₂ | Erro médio do motor contra fatura publicado, abaixo de 10% |
| **1 — Piloto** | 3 a 6 meses | Dois ou três integradores de Sorocaba usando o Pro de graça; integração com as duas marcas de inversor mais vendidas na região; alerta por WhatsApp; conversa com a distribuidora sobre projeto de eficiência | % de unidades com dado real; erro médio abaixo de 5% |
| **2 — Cobrar** | 6 a 12 meses | Pro pago; funil de leads para os integradores parceiros; Solaris+ | Receita recorrente mensal; leads por mês e taxa de fechamento |
| **3 — Expandir** | 12 a 24 meses | Outras distribuidoras (a base regional vira nacional), auditoria de fatura, financiamento embarcado, componentes únicos no lugar das duas cascas | Distribuidoras cobertas; valor recuperado em auditoria |
| **4 — Mercado** | 24 meses ou mais | Mercado livre, certificados de renovável, índices regionais | Clientes migrados; certificados emitidos |

### As cinco coisas desta semana

1. **Informar três faturas reais** de integrantes do grupo, em Relatório →
   "Confere com a sua conta?". Fecha a pergunta "e bate?".
2. **Montar um medidor ESP32** e deixar sete dias numa casa, com a leitura
   real ao lado da simulação no mesmo gráfico.
3. **Conferir os três números pendentes**: irradiação (CRESESB), bandeira do
   mês (ANEEL), fator de emissão (MCTI).
4. **Conversar com três integradores de Sorocaba**: quanto custa para eles
   atender a ligação de "meu sistema está gerando pouco"?
5. **Trocar "IA" por "estimativa"** onde ainda não há modelo treinado — e
   planejar a desagregação de verdade com o dado do medidor.

---

## 7. Riscos, e o que fazer com cada um

| Risco | Tratamento |
| --- | --- |
| **Dado real** — APIs de inversor mudam e fecham | Começar pelas duas ou três marcas mais vendidas; a fatura (por foto) e o medidor próprio como fontes que não dependem de fabricante |
| **Privacidade** — consumo minuto a minuto revela quando a casa está vazia | Tratar como dado sensível na prática: consentimento por finalidade, RLS (já existe), exportação e exclusão (já existem), agregados com mínimo de unidades, encarregado de dados |
| **Credibilidade** — prometer economia que é estimativa | Manter a regra do projeto: estimativa sempre marcada, "não é orçamento" escrito, erro do motor publicado |
| **Custo e qualidade do modelo de linguagem** | Prompt como código (já existe), respostas presas aos dados do painel, limite de uso no plano grátis, o produto funciona inteiro sem o assistente |
| **Fabricantes e plataformas grandes** | O diferencial não é o gráfico do inversor: é a conta, a regra brasileira e ser de todas as marcas |
| **Mudança regulatória** | É risco e oportunidade: regra em código testado muda em um lugar só |

---

## 8. O que medir

- **Erro médio do motor contra fatura real** — a métrica de confiança.
- **% de unidades com dado real** — a métrica de produto.
- **Receita recorrente mensal e sistemas monitorados** — a métrica de negócio.
- **Leads por mês e taxa de instalação** — a métrica do funil.
- **Retenção mês a mês** — o ritual da fatura funcionando.
- **Reais economizados pelos usuários** — a métrica de impacto, e a que
  conta a história do Solaris melhor do que qualquer slide.
