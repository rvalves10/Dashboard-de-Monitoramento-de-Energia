---
name: solaris-revisao
description: Roteiro de revisão antes de abrir pull request no Solaris. Use ao terminar qualquer alteração, antes de commitar, e ao revisar o trabalho de outra pessoa do grupo.
---

# Revisão antes do pull request

O combinado do grupo: branch por frente, `main` sempre abrindo sem erro.
Este roteiro é o que separa "funcionou na minha máquina" de "pode subir".

## 1. A suíte, sempre

```
node ferramentas/servidor.mjs
```
e abra `http://localhost:8080/testes/index.html`.

Tem que dar **tudo verde**. Se alguma linha ficar vermelha, não abra o pull
request — nem que "não tem nada a ver com o que eu mexi". Normalmente tem.

## 2. Teste na conta de quem chega agora, não na sua

O defeito mais caro deste projeto apareceu porque todo mundo testava numa
conta que já tinha dados. Faça o caminho inteiro do zero:

1. Apague os dados do navegador (ou abra uma janela anônima)
2. Crie uma conta nova
3. Passe pelos três passos do cadastro
4. Confira que **nada de demonstração** aparece: nem "Casa das Acácias", nem
   "Padaria Pão de Ouro", nem aparelho que você não marcou, nem nome que não
   é o seu
5. Abra painel, histórico, aparelhos, cadastrar, alertas, relatório e
   configurações

## 3. O console tem que ficar limpo

Abra o console do navegador **antes** de começar e deixe aberto durante todo
o teste acima.

O medidor chama o motor de 2 em 2 segundos. Erro que só acontece nesse tique
não aparece na tela — aparece no console, repetido, e passa despercebido se
ninguém olhar.

## 4. As duas larguras

- **1440px** — a versão ampla, com menu lateral
- **390px** — abaixo de 761px o JavaScript troca a casca inteira

Não basta encolher a janela e ver se "não quebrou": as duas cascas são código
diferente (`telas.js` e `movel.js`). Se você mexeu numa, provavelmente
precisa mexer na outra.

## 5. Digitar não pode congelar a tela

Se você acrescentou algo que reage ao formulário, teste **digitando**, não
recarregando. A tela não é redesenhada a cada tecla, de propósito — o campo
perderia o foco. As funções `sync*` em `frontend/js/controle.js` atualizam o
que depende do que foi digitado, e o que você adicionou precisa entrar lá.

## 6. Texto do usuário nunca vira HTML

Se você acrescentou um lugar que mostra algo digitado pela pessoa — nome de
aparelho, nome de unidade, distribuidora — ele passa por `esc()`.

A suíte tem uma varredura que envenena todo campo digitável e passa por todas
as telas nas duas cascas. Ela existe porque um furo real escapou uma vez.

## 7. O build

```
node ferramentas/build.mjs
```

Ele confere sozinho se as listas batem com `frontend/index.html` e se
`testes/index.html` carrega os mesmos scripts, na mesma ordem. Se reclamar,
conserte — não contorne.

Commite o `Solaris.html` gerado junto com a alteração.

## 8. O commit

Mensagem que diz **o que mudou e por quê**, não "ajustes" nem "correções".
Se o commit conserta um defeito, descreva o defeito: quem vier depois precisa
entender o que estava errado, não só o que ficou.

## Roteiro curto

- [ ] Suíte verde
- [ ] Caminho completo numa conta nova, sem dado de demonstração
- [ ] Console limpo durante os 2 minutos do tique
- [ ] 1440px e 390px
- [ ] Campos novos entram na `sync` certa
- [ ] Texto do usuário passa por `esc()`
- [ ] `node ferramentas/build.mjs` sem reclamação
- [ ] Mensagem de commit explica o porquê
