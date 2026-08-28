# Backend

A lógica de domínio do Solaris: o cálculo, as contas, as regras e a leitura
da fatura. É onde moram as decisões que a banca vai questionar.

---

## Antes de tudo: não existe servidor aqui

Esta pasta se chama `backend` porque é **a camada de domínio** — o que num
sistema com servidor moraria no servidor. Mas o Solaris não tem servidor:
tudo isto roda dentro do navegador de quem abre o site.

Isso é decisão de projeto, não limitação:

- o site abre com **duplo clique**, sem instalar nada e sem internet;
- na banca não dá para depender de um servidor no ar;
- os dados da pessoa **não saem da máquina dela** — inclusive a foto da conta
  de luz, que tem nome, endereço e número de instalação.

O que a separação em pastas garante é a **direção da dependência**:

```
frontend/  ──usa──▶  backend/  ──usa──▶  banco-de-dados/
```

O backend nunca lê o DOM nem monta HTML. O frontend nunca calcula tarifa nem
fala com o IndexedDB direto. Se um dia o projeto ganhar um servidor de
verdade, é esta pasta que atravessa — e o frontend passa a chamá-la por HTTP
em vez de chamar direto.

---

## Os três arquivos

| Arquivo | O que faz |
| --- | --- |
| `motor.js` | **O coração.** Sol, nuvem, consumo, compensação de créditos, Fio B da Lei 14.300 e a divisão por aparelho. |
| `login.js` | Contas, sessão e derivação de senha. |
| `leitor.js` | Lê a conta de luz por foto: OCR no navegador e interpretação dos campos. |

A ordem de carregamento importa: `motor` antes de `login` e `leitor`, porque
os dois usam utilitários e o estado `S` que o motor declara.

---

## `motor.js` — de onde vem cada número

Nada aqui é digitado. Tudo é calculado, nesta ordem:

1. **Onde o sol está.** A declinação solar depende da data, então a janela de
   luz encurta no inverno sozinha.
2. **Nuvem no céu.** Ruído com semente fixa: 12 de junho sempre tem o mesmo
   tempo, mas cada dia é diferente do outro. Realista e reproduzível ao mesmo
   tempo — sem isso, dois testes rodando no mesmo dia dariam resultados
   diferentes.
3. **Geração contra consumo, hora a hora.** O que o painel gera e a casa usa
   na mesma hora é autoconsumo; o que sobra vai para a rede; o que falta vem
   dela.
4. **A conta de luz.** Compensa crédito mês a mês, respeita o mínimo faturável
   (que crédito não abate) e cobra o Fio B sobre a energia compensada.
5. **A divisão por aparelho.** Cada aparelho tem uma fatia do medidor. A soma
   sempre fecha com a leitura — é teste automatizado, não coincidência.

### Os números que vêm de fora

Só um: `IRRADIACAO_SP`, a irradiação média mês a mês. **Precisa ser conferida
no Atlas Brasileiro de Energia Solar (INPE/LABREN) para a cidade real do
projeto antes da banca.** Está marcado no código.

### Lei 14.300/2022

Sistemas ligados até 06/01/2023 mantêm compensação integral até 2045. Os
ligados a partir de 07/01/2023 pagam um percentual crescente do Fio B sobre a
energia compensada — 15% em 2023, subindo até 100% em 2029. A escada está em
`ESCADA_FIO_B`.

Aplicar a lei derrubou a economia declarada da casa de exemplo de R$ 172 para
R$ 139 por mês. Esse é o tipo de número que a banca pergunta.

### Medido x estimado

O medidor só vale a partir do momento em que a unidade foi cadastrada
(`criadaEm`). Antes disso o motor reconstrói o período com a mesma física,
para haver contra o que comparar — mas **isso é conta, não leitura**, e
`mesMedido()`, `mesParcial()` e `diaMedido()` existem para a tela poder dizer
isso. Nenhuma tela pode mostrar passado reconstruído sem marcar.

---

## `login.js` — o que a segurança daqui é e o que não é

**Isto não é segurança contra quem tem acesso ao computador.** Sem servidor,
não existe segredo do lado do cliente. Está escrito na própria tela de
entrada, de propósito.

O que é real:

- a senha nunca é gravada, só uma derivação com salt e 150 mil iterações;
- comparação em tempo constante, e a mesma mensagem de erro para senha errada
  e e-mail inexistente, para não revelar quais contas existem;
- cada conta tem o seu próprio balde de dados.

---

## `leitor.js` — a foto da conta de luz

Recebe a foto, extrai o texto com OCR **dentro do navegador** e procura ali
distribuidora, consumo, tarifa e total.

Três decisões que valem explicar:

1. **O OCR não vai para servidor nenhum.** A fatura tem nome, endereço e
   número de instalação; mandar isso para um serviço de terceiro sem
   necessidade seria pior do que não ter a função.
2. **A biblioteca só é baixada quando a pessoa escolhe uma foto.** Quem nunca
   usar continua abrindo o site sem pedir nada da rede.
3. **Nada é aceito calado.** O que foi reconhecido aparece listado com pedido
   de conferência. Leitura de foto erra, e um erro aqui vira conta de luz
   errada pelos próximos doze meses.

Foi testado com imagem limpa e acertou distribuidora, consumo e tarifa. Foto
de celular de fatura amassada, torta ou com sombra vai acertar menos — por
isso a confirmação é obrigatória, não opcional.
