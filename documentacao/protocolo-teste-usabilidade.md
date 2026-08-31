# Protocolo de teste com usuários

Sprint 5. Este é o entregável mais barato de produzir e o que quase nenhum
grupo leva para a banca. Um slide dizendo *"7 de 8 pessoas descobriram o
aparelho que mais gasta em menos de 30 segundos"* vale mais que três telas
bonitas.

**Tempo por pessoa:** 15 minutos. **Meta:** 8 pessoas.

---

## Quem recrutar

Pessoas **de fora do grupo**. Idealmente quem paga conta de luz — dono de
imóvel, quem mora sozinho, alguém com comércio pequeno. Evite só colegas de
curso: eles já entendem dashboard e vão achar tudo óbvio.

| Perfil | Quantos | Por quê |
| --- | --- | --- |
| Paga conta de luz e tem energia solar | 2 | Público-alvo direto |
| Paga conta e pensa em instalar | 3 | Valida a proposta de valor |
| Paga conta e não pensa em solar | 2 | Testa se o app se explica sozinho |
| Nunca olhou uma conta de luz | 1 | Encontra o vocabulário difícil |

## Antes de começar

Prepare o ambiente:

- Abrir o `Solaris.html` **antes** da pessoa chegar
- Em Configurações → **Apagar meus dados**, para todo mundo começar igual
- Cronômetro na mão, papel para anotar
- Se for gravar a tela, **peça permissão** e explique o que será feito com o
  vídeo

Diga exatamente isto, em voz alta:

> "A gente está testando o sistema, não você. Se travar em algo, o problema é
> nosso. Pensa em voz alta enquanto usa — fala o que está procurando e o que
> te confundiu. Não tem resposta errada."

**A regra mais importante:** não ajude. Quando a pessoa perguntar "é aqui?",
responda "o que você acha?". Cada vez que você ajuda, perde o dado.

---

## As três tarefas

Dê uma de cada vez, sem explicar a interface antes.

### Tarefa 1 — Descobrir o vilão

> "Descubra qual aparelho mais gasta energia nesta casa e quanto ele custa
> por mês."

- Sucesso: diz "ar-condicionado" e um valor em reais
- Cronometrar do fim da frase até a resposta
- **Anotar:** foi pelo painel ou foi direto em Aparelhos?

### Tarefa 2 — Cadastrar o que a IA não viu

> "Você comprou uma máquina de lavar louça de 1.500 W, usa 1 hora por dia,
> 20 dias por mês. Coloca ela no sistema."

- Sucesso: aparelho aparece no ranking
- **Anotar:** achou o botão Cadastrar? Entendeu os três controles deslizantes?
  Percebeu a estimativa mudando enquanto arrastava?

### Tarefa 3 — Prever a conta

> "Quanto vai vir de conta de luz este mês, e quanto seria sem os painéis?"

- Sucesso: diz os dois valores
- **Anotar:** foi no Painel ou no Relatório? Entendeu a linha do Fio B?

---

## O que medir

Uma linha por pessoa nesta tabela:

| # | Perfil | T1 tempo | T1 ok | T2 tempo | T2 ok | T3 tempo | T3 ok | Travou em |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | |
| 2 | | | | | | | | |

E, para cada pessoa, **as frases literais de confusão**. Não parafraseie:
"não sei o que é injetado" é dado; "achou o vocabulário difícil" é opinião
sua.

## Três perguntas no fim

1. "Numa palavra, o que este sistema faz?"
   → testa se a proposta chegou
2. "O que te surpreendeu?"
   → costuma revelar o melhor argumento de venda
3. "Você usaria? O que faltaria para usar?"
   → a resposta honesta quase nunca é "sim, do jeito que está"

---

## O que fazer com o resultado

Conte quantas pessoas travaram em cada ponto. Corrija **os três problemas mais
frequentes** — só os três. Corrigir tudo é o jeito clássico de estourar o
prazo e chegar na banca com o sistema instável.

Depois de corrigir, **reteste com duas pessoas novas** para confirmar que
melhorou.

## O slide da banca

Um slide, quatro números e uma frase:

- Taxa de conclusão por tarefa (ex.: 7/8, 8/8, 5/8)
- Tempo mediano da tarefa 1
- Os três problemas encontrados e o que foi corrigido
- Uma citação literal de usuário, a mais reveladora

Se a tarefa 3 tiver a pior taxa, **não esconda**. Mostrar que vocês mediram,
descobriram uma fraqueza e corrigiram é mais forte do que exibir três oitos.
Banca reconhece método; número redondo demais levanta suspeita.
