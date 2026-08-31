# Ligar o Supabase e o Gemini

Passo a passo para sair do Solaris rodando só no navegador e chegar no
Solaris com banco na nuvem e assistente de IA funcionando.

**Leva uns 20 minutos.** Você só precisa fazer isso **uma vez** — depois é o
grupo inteiro usando o mesmo projeto.

> **Enquanto você não fizer nada disso, o Solaris continua funcionando.**
> Ele abre, calcula, grava no banco do navegador e mostra tudo. O que não
> existe sem esta configuração é o assistente e a conta que abre em vários
> aparelhos. A tela diz em qual dos dois modos está rodando, em
> **Configurações → Banco de dados**.

---

## O que você vai ter no fim

| Antes | Depois |
| --- | --- |
| A conta vale só naquele navegador | A mesma conta abre no celular e no PC |
| A senha é conferida dentro do navegador | A senha é conferida no servidor |
| Sem recuperação de senha | "Esqueci minha senha" manda e-mail |
| Histórico de 7 dias | Histórico de 90 dias |
| Sem assistente | Assistente de IA que conhece o cliente |

---

## Parte 1 — o banco (10 minutos)

### 1.1 Criar o projeto

1. Entre em **[supabase.com](https://supabase.com)** e crie uma conta (o
   plano gratuito atende o projeto inteiro com folga).
2. **New project**. Dê um nome (`solaris`), escolha uma senha de banco e a
   região **South America (São Paulo)** — é a mais perto, e a latência
   aparece na hora de gravar leitura.
3. Espere uns dois minutos até o projeto ficar verde.

### 1.2 Criar as tabelas

1. No menu da esquerda: **SQL Editor → New query**.
2. Abra **`banco-de-dados/esquema.sql`**, copie **o arquivo inteiro** e cole
   ali.
3. **Run**.

No fim ele imprime uma linha com a contagem: 3 distribuidoras, 20 cidades e o
número de políticas de segurança. Se apareceu isso, o banco está pronto.

### 1.3 Ajustar o cadastro por e-mail

**Authentication → Providers → Email**:

- **Enable email provider**: ligado.
- **Confirm email**: **desligue durante o teste de campo.** Com ele ligado, a
  pessoa cria a conta e não consegue entrar até clicar num link no e-mail —
  e no teste de campo isso derruba metade dos participantes. Em produção,
  ligue de volta.

### 1.4 Colar as credenciais no site

**Project Settings → API**. Copie os dois valores e cole em
**`banco-de-dados/config.js`**:

```js
supabase: {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  chaveAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
```

> **A chave `anon` é pública de propósito** e pode ir para o GitHub. Ela só
> deixa fazer o que as regras de RLS do `esquema.sql` permitirem, e essas
> regras dizem que cada pessoa só lê as próprias linhas.
>
> **A chave `service_role` NÃO pode ir para lugar nenhum.** Ela ignora RLS e
> abre o banco inteiro. Se ela vazar, apague o projeto e comece outro.

Recarregue o site. Em **Configurações → Banco de dados** a etiqueta deve
mudar de `IndexedDB (neste navegador)` para **`Supabase (Postgres)`**.

Se continuar em IndexedDB, o próprio cartão diz por quê logo abaixo.

---

## Parte 2 — o assistente (10 minutos)

O assistente é o Google Gemini, e **a chave é do grupo, não do cliente**.
Nenhum usuário precisa criar chave, colar chave ou ter conta no Google. Ele
abre o site e o assistente está lá.

Para isso a chave **não pode** estar no código do site: qualquer pessoa
abriria o DevTools e copiaria. Ela mora como segredo dentro do Supabase, e
quem fala com o Google é uma função que roda lá — a Edge Function em
`banco-de-dados/supabase/functions/agente/`.

```
navegador  →  Edge Function (Supabase)  →  Gemini
             ↑ a chave vive só aqui
```

### 2.1 Pegar a chave do Gemini

1. Entre em **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
   com a conta Google do grupo.
2. **Create API key**, escolha um projeto.
3. Copie a chave. **Não cole em arquivo nenhum do repositório.**

### 2.2 Publicar a função

Precisa de Node instalado. Rode **de dentro da pasta `banco-de-dados/`** — a
CLI do Supabase procura as funções em `supabase/functions` a partir de onde
você está:

```bash
cd banco-de-dados

npm i -g supabase
supabase login

# o "project ref" está em Project Settings -> General, ou na própria URL
supabase link --project-ref SEU_PROJECT_REF

# a chave entra como segredo do projeto e nunca sai de lá
supabase secrets set GEMINI_API_KEY=cole_a_chave_aqui

supabase functions deploy agente
```

### 2.3 Conferir

```bash
supabase functions list     # tem que aparecer "agente"
supabase secrets list       # mostra o NOME do segredo, nunca o valor
```

No site, entre com uma conta e abra **Assistente**. Se aparecer a tela de
perguntas em vez do aviso de desligado, funcionou.

Deu erro? **Supabase → Edge Functions → agente → Logs** mostra o motivo. Os
dois mais comuns:

| O que aparece | O que é |
| --- | --- |
| `falta o segredo GEMINI_API_KEY` | o `secrets set` não rodou, ou rodou em outro projeto |
| `Sua sessão expirou` | saia e entre de novo no site |

### 2.4 Trocar o modelo

Em `banco-de-dados/config.js`:

```js
agente: {
  funcao: 'agente',
  modelo: 'gemini-3.5-flash',
  memoria: 12
}
```

A Edge Function só aceita modelos de uma lista fechada (está no topo do
`index.ts`) — assim um erro de digitação aqui não vira uma chamada estranha
na conta do Google. Para liberar um modelo novo, acrescente na lista **e**
publique a função de novo.

`memoria` é quantas mensagens anteriores vão junto de cada pergunta. Mais
memória custa mais e responde mais devagar; menos memória faz o assistente
esquecer o assunto no meio da conversa.

---

## Como o assistente "conhece" cada cliente

Não treinamos modelo — isso custaria caro e não resolveria, porque o que
muda de cliente para cliente muda toda semana. O que a Edge Function faz é
montar, **a cada pergunta**, um contexto de três camadas:

**1. Quem é a pessoa.** O papo rápido de cinco perguntas que aparece logo
depois de criar a conta. Como quer ser chamada, quanto entende de energia, o
que quer do sistema, como é a rotina da casa, o que mais a incomoda. Fica na
tabela `perfil_conversa`, e cada resposta vira uma instrução de comportamento
— "ela não entende de energia, nunca use kWh sem traduzir para reais".

**2. Onde ela mora.** A cidade escolhida no cadastro da unidade puxa a
distribuidora, o mês do reajuste e o telefone da emergência, das tabelas
`cidades` e `distribuidoras`.

**3. O que está acontecendo agora.** Os números do painel neste minuto:
consumo do mês, geração, créditos, projeção da conta, quais aparelhos pesam
mais. São os únicos dados que vão do navegador para a função — porque é no
navegador que o medidor roda.

Quem quiser ler o prompt inteiro: função `montarInstrucao`, no fim de
`banco-de-dados/supabase/functions/agente/index.ts`. Ele é uma função pura,
dá para ler e corrigir como qualquer outro código.

---

## Mexer nos dados da região

As cidades e distribuidoras vivem em **dois** lugares, e isso é de propósito:
o site lê do arquivo JS (funciona sem internet, sem ida ao servidor) e a Edge
Function lê do Postgres (dá para corrigir um telefone sem publicar o site).

Para os dois nunca divergirem, **só um deles é escrito à mão**:

1. edite `banco-de-dados/dados/regiao-sorocaba.js`;
2. rode `node backend/ferramentas/gerar-regiao-sql.mjs`;
3. cole o `esquema.sql` no SQL Editor de novo.

O bloco de dados dentro do `esquema.sql` é gerado. Editar ele à mão é
trabalho jogado fora no próximo gerador.

---

## Quanto custa

| | Plano gratuito cobre |
| --- | --- |
| **Supabase** | 500 MB de banco, 50 mil usuários ativos por mês, 500 mil chamadas de função. O projeto inteiro cabe com sobra: uma leitura por minuto por usuário dá ~4 MB por pessoa por mês. |
| **Gemini** | O nível gratuito do AI Studio tem limite por minuto e por dia, suficiente para o teste de campo. Passando disso, é cobrado por token — e `flash` é o modelo barato da família. |

Para não levar susto, ligue o alerta de gasto no Google Cloud antes de abrir
o teste para gente de fora.

---

## Voltar atrás

Apague as duas linhas de `supabase` em `config.js` e recarregue. O Solaris
volta a gravar no navegador, com todas as telas funcionando menos o
assistente. Os dados que subiram continuam no Supabase, esperando.
