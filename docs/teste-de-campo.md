# Teste de campo — 7 a 30 dias

Roteiro para a equipe. A ideia é simples: **deixar o Solaris aberto e usar**,
por pelo menos uma semana, e anotar o que incomodar.

Não precisa de conhecimento técnico. Se você consegue abrir um site, consegue
participar.

---

## Antes de começar (5 minutos)

1. Abra o arquivo **`Solaris.html`** (duplo clique). Se preferir, `index.html`
   também abre a mesma coisa.
2. Vai aparecer a tela de entrada. Clique em **"Entrar sem criar conta"** e
   pronto — você já está no painel. **Não precisa criar conta para testar.**
3. Se quiser guardar seus dados separados dos de quem mais usa o computador,
   crie uma conta. O que você já fez como visitante vai junto.
4. Anote a data em que você começou.

> **Deixe a aba aberta.** O sistema grava uma leitura do medidor por minuto.
> Quanto mais tempo aberto, mais dado ele acumula — e é isso que a gente
> quer observar ao longo dos dias.

---

## O que fazer no primeiro dia

Percorra estas tarefas sem pedir ajuda a ninguém. Se travar, **anote onde
travou** — isso é o dado mais valioso do teste inteiro.

- [ ] Entrar sem criar conta e chegar ao painel
- [ ] Descobrir qual aparelho mais gasta e quanto ele custa por mês
- [ ] Trocar de unidade (Casa das Acácias ↔ Padaria) e ver o que muda
- [ ] Cadastrar um aparelho novo pela tela **Cadastrar**
- [ ] Corrigir a estimativa de algum aparelho que a IA detectou
- [ ] Mudar a meta do mês em **Alertas e metas** e ver o aviso mudar
- [ ] Abrir **Relatório** e dar `Ctrl+P` para ver como sai impresso
- [ ] Criar uma conta e reparar que ela começa **vazia** (é assim mesmo)
- [ ] Cadastrar a **sua própria casa** com os dados da sua conta de luz
- [ ] Abrir o site no celular e conferir se dá para usar

---

## O que fazer ao longo dos dias

Abra pelo menos uma vez por dia, mesmo que por um minuto.

| Quando | O que olhar |
| --- | --- |
| Todo dia | Os números do painel mudaram? Fazem sentido? |
| A cada 2–3 dias | **Configurações → Banco de dados**: o número de leituras está crescendo? O gráfico das últimas 2 horas aparece? |
| Dia 7 | O histórico em **Histórico → Semana** ficou com cara de semana de verdade? |
| Virada de mês | Os números zeraram e recomeçaram direito? |

---

## O que anotar

Uma planilha, um bloco de notas, o que for mais fácil. Só quatro colunas:

| Data | Onde estava | O que aconteceu | Era o que eu esperava? |
| --- | --- | --- | --- |
| | | | |

**Anote principalmente:**

- Qualquer número que pareceu **errado ou estranho**
- Qualquer lugar onde você **não achou** o que procurava
- Qualquer palavra que você **não entendeu**
- Se algo **travou, sumiu ou ficou lento**
- Se os dados **sumiram** depois de fechar e abrir

**Não filtre.** "Achei feio", "não entendi o que é injetado", "demorou para
abrir" — tudo serve. Quem julga se é problema é o grupo depois, não você
agora.

---

## Como saber se algo quebrou de verdade

Abra **`testes/index.html`** e espere uns segundos. Deve aparecer
**105 de 105 testes passaram**, tudo verde.

Se aparecer qualquer linha vermelha, tire um print e mande no grupo com a
mensagem: *"teste vermelho"* e o nome do que falhou.

---

## Perguntas para responder no fim

Respondam individualmente, sem combinar antes:

1. Numa palavra, o que este sistema faz?
2. O que mais te surpreendeu, para bem ou para mal?
3. Você usaria de verdade? O que faltaria?
4. Se pudesse mudar uma coisa só, qual seria?

---

## Coisas que a gente já sabe (não precisa reportar)

Para não gastar o tempo de vocês com o que já está mapeado:

- **Os dados do medidor são simulados.** Não tem sensor ligado ainda. Os
  números são calculados pela posição do sol na data, por um padrão de
  nuvens e pelo perfil de consumo — não são inventados, mas também não vêm
  de um medidor de verdade. Isso é a fase seguinte.
- **O login não é seguro contra quem usa o mesmo computador.** Sem servidor,
  não tem como ser. Ele serve para separar dados, não para proteger.
- **Não tem "esqueci minha senha".** Sem servidor, não tem e-mail para enviar.
- **Os dados ficam só neste navegador.** Não sincroniza entre computadores.
- **Conta nova começa vazia.** Não é bug: a casa e a padaria são exemplos,
  e exemplo não deve aparecer como se fosse seu. Dá para ligá-los em
  Configurações se quiser passear pelo sistema.
- **A moldura de celular saiu.** O site se adapta sozinho a tela estreita;
  a simulação de aplicativo está em `app-futuro/previa-app.html`.

---

## Prazo e retorno

- **Mínimo:** 7 dias de uso
- **Ideal:** 30 dias, para pegar a virada de mês
- **Retorno:** manda as anotações no grupo, mesmo que sejam três linhas

Três linhas de alguém que usou de verdade valem mais que uma página de
alguém que só olhou a tela.
