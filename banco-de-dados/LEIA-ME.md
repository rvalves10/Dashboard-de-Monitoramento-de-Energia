# Banco de dados

**IndexedDB** — o banco que já vem no navegador. Um arquivo: `banco.js`.

---

## Por que IndexedDB e não `localStorage`

Porque uma das três tabelas não caberia em `localStorage`.

O medidor grava **uma leitura por minuto**. Isso dá 1.440 linhas por dia e
mais de dez mil por semana. `localStorage` é um mapa de texto com uns 5 MB e
sem índice: para achar as leituras de ontem seria preciso carregar tudo e
filtrar na mão, travando a página.

IndexedDB é banco de verdade — transações, índices, consultas por intervalo —
e não exige servidor, o que mantém a promessa de abrir com duplo clique.

Se o IndexedDB não abrir (navegador antigo, janela anônima, permissão
negada), tudo cai sozinho para `localStorage` e a tela avisa. **O site nunca
deixa de funcionar por causa do banco** — só perde o histórico longo.

---

## As três tabelas

| Tabela | Chave | O que guarda |
| --- | --- | --- |
| `contas` | e-mail | quem pode entrar: nome, salt e derivação da senha |
| `estado` | id da conta | o que cada conta configurou: unidades, aparelhos, metas, tarifa |
| `leituras` | auto | o histórico do medidor, uma linha por minuto |

### `leituras` em detalhe

```
{ conta: 'maria@exemplo.com',   índice por conta + instante
  quando: 1787918113903,        epoch em milissegundos
  cons: 0.42,                   consumo naquele minuto, em kW
  ger: 1.31 }                   geração naquele minuto, em kW
```

Guardamos **7 dias**. O que passa disso é apagado na abertura do banco — sem
essa poda o banco cresceria para sempre num navegador que ninguém limpa.

Cada conta tem o seu próprio balde: o índice é por conta, e uma conta nunca
lê a leitura de outra.

---

## Onde ver isso rodando

**Configurações → Banco de dados**, dentro do próprio site. Mostra ao vivo
quantas leituras existem, quanto espaço o navegador estima e um gráfico das
últimas duas horas gravadas. É a prova de que o banco é real e não enfeite.

---

## Como limpar

Em **Configurações → Banco de dados**, no rodapé do cartão:

| Botão | O que apaga |
| --- | --- |
| **Apagar histórico desta conta** | só as `leituras` da conta aberta. O painel continua funcionando; some o registro minuto a minuto. |
| **Apagar tudo do banco** | as três tabelas inteiras: todas as contas criadas neste navegador, todas as unidades e aparelhos, metas, tarifas e o histórico do medidor. Pergunta duas vezes. **Não tem desfazer.** |

Use o segundo quando o navegador acumulou teste de todo mundo e você quer
começar do zero de verdade.

### O defeito que isso corrigiu

"Apagar meus dados" removia a chave do `localStorage` — mas o estado de
verdade mora no IndexedDB. A tela dizia "apagado", nada era apagado, e no
salvamento seguinte tudo voltava. O sintoma só aparecia depois de recarregar,
que é justamente quando ninguém está mais olhando.

`Banco.apagarTudo()` limpa as duas vias de armazenamento e as chaves soltas
que o app guarda fora das tabelas. Há teste automatizado que grava, apaga e
confere que não voltou.

---

## Quem pode falar com esta pasta

Só o `backend/`. O `frontend/` nunca chama `Banco` direto — se chamasse, a
regra de qual conta pode ler o quê ficaria espalhada pela interface.

```
frontend/  ──▶  backend/  ──▶  banco-de-dados/
```

---

## Contrato de dados

O formato que o medidor físico (ESP32) precisa entregar está em
[`../documentacao/contrato-dados.md`](../documentacao/contrato-dados.md).
Enquanto o sensor não existe, a simulação do `motor.js` ocupa esse lugar — e
o resto do sistema não sabe a diferença, de propósito.
