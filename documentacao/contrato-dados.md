# Contrato de dados do medidor

O dashboard não sabe de onde vem a leitura. Ele pede uma potência instantânea
e recebe um objeto. Quem responde pode ser a simulação ou o ESP32 — a troca é
de uma linha.

Isso é o que permite que o hardware seja bônus de verdade: se o ESP32 falhar
na véspera da banca, o seletor volta para simulado e nada mais quebra.

---

## O objeto

Toda fonte devolve o mesmo formato:

```js
{
  cons: 0.85,   // potência consumida agora, em kW
  ger:  1.04,   // potência gerada agora, em kW
  rede: 0.00,   // importado da rede = max(0, cons - ger)
  inj:  0.19,   // injetado na rede = max(0, ger - cons)
  hora: 14.3    // hora decimal do dia, para posicionar o marcador do gráfico
}
```

`rede` e `inj` são derivados e nunca são ambos maiores que zero ao mesmo tempo.
Quem implementa uma fonte só precisa entregar `cons` e `ger` corretos.

## As fontes

| Fonte | Quem responde | Quando usar |
| --- | --- | --- |
| `simulado` | `potenciaAgora()` no `motor.js` | Padrão. Sempre disponível, não depende de rede. |
| `medidor` | Última leitura recebida do ESP32 | Quando há hardware na mesma rede local. |

O seletor fica em Configurações. Se a fonte `medidor` ficar mais de **15
segundos** sem leitura nova, o app volta sozinho para `simulado` e avisa.
Isso é proposital: numa apresentação, o pior cenário é a tela congelar.

## Como o ESP32 entrega a leitura

O firmware faz um `POST` a cada 2 segundos para o endereço configurado:

```
POST /leitura
Content-Type: application/json

{ "cons": 0.85, "ger": 1.04 }
```

Se o grupo não quiser subir servidor, existe o caminho mais simples e que
funciona offline: o ESP32 sobe como **access point** com um endpoint `GET`,
e a página consulta ele. Está descrito no `firmware/README.md`.

## Calibração

O SCT-013-030 entrega 1 V para 30 A. O que o firmware mede é **corrente**, não
potência. Para virar kW:

```
P (W) = I (A) × V (V) × FP
```

- `V` — tensão da rede. Medir com multímetro; não assumir 127 V.
- `FP` — fator de potência. Para carga resistiva (chuveiro, forno) é ~1.
  Para motor (geladeira, ar-condicionado) fica entre 0,7 e 0,9.

Um sensor de corrente sozinho **não mede potência real**, só aparente. Vale
dizer isso na banca antes que perguntem: é uma limitação conhecida do arranjo,
e a alternativa (medidor com sensor de tensão, tipo PZEM-004T) foi descartada
por custo e prazo.

## Limitação honesta do arranjo

Com um único sensor no quadro geral, mede-se o **consumo total**. Para separar
geração de consumo seriam necessários dois sensores: um no ramal do inversor e
outro na entrada. O plano prevê um sensor só — então, no modo `medidor`, a
geração continua vindo da simulação e apenas o consumo é real.

Isso é suficiente para a demonstração que importa: ligar um chuveiro e ver o
número subir na tela. E é honesto declarar o escopo.
