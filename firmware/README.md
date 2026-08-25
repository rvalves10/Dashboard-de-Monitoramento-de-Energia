# Medidor físico — ESP32 + SCT-013

Frente de IoT. Bônus do projeto: se não ficar pronto, o dashboard entrega
sozinho no modo simulado.

> **Segurança primeiro.** O SCT-013 é um transformador de corrente: ele
> **abraça o fio por fora**, sem cortar nem descascar nada. Nunca abra o
> quadro com energia ligada. Se houver qualquer dúvida, chame um eletricista.
> Nenhuma nota de UPX vale um choque.

## Lista de compras

Comprar na **semana 1** — frete é o maior risco de cronograma do semestre.

| Item | Aprox. | Observação |
| --- | --- | --- |
| ESP32 DevKit V1 | R$ 40 | Qualquer variante com WiFi serve |
| Sensor SCT-013-**030** | R$ 45 | O sufixo importa: o **-030** já tem saída em tensão |
| 2 resistores 10 kΩ | R$ 2 | Divisor para o ponto médio |
| Capacitor 10 µF | R$ 2 | Estabiliza o ponto médio |
| Jack P2 fêmea | R$ 5 | Onde o sensor pluga |
| Protoboard e jumpers | R$ 30 | |
| **Uma peça sobressalente de cada** | | Queimar componente na véspera é comum |

## Ligação

```
                3V3
                 |
                10k
                 |
    jack P2 ---- + ---- GPIO 34        (ponto médio: ~1,65 V)
      (anel)     |
                10k        10µF
                 |          |
                GND ------- +
```

O outro contato do jack (ponta) vai direto no **GND**.

O divisor existe porque o sensor gera tensão alternada — positiva e negativa —
e o ADC do ESP32 só lê de 0 a 3,3 V. Deslocando o zero para 1,65 V, os dois
semiciclos entram na faixa de leitura.

## Gravar

1. Arduino IDE → Preferências → URL adicional:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. Gerenciador de Placas → instalar **esp32**
3. Placa: *ESP32 Dev Module*
4. Abrir `solaris-medidor.ino`, selecionar a porta e gravar

## Calibrar

Sem calibração o número é chute. Faça assim:

1. Ligue o ESP32 com **a carga desligada**. Ele calibra o zero sozinho no boot
   e imprime o offset no monitor serial.
2. Meça a tensão real da tomada com multímetro e ajuste `TENSAO_REDE`.
   Não assuma 127 V — em muitos lugares é 220 V, e o erro seria de 73%.
3. Ligue uma **carga resistiva de potência conhecida** — uma lâmpada
   incandescente de 100 W é o ideal, porque o fator de potência é 1.
4. Compare o valor no serial com o esperado e ajuste `FATOR_POT` até bater.

Anote os valores de calibração e o erro final: isso vira slide de banca.

## Ligar no dashboard

1. Conecte o computador na rede WiFi `Solaris-Medidor` (senha `solaris2026`)
2. No Solaris, vá em **Configurações → Fonte da leitura**
3. Escolha **Medidor físico** e confirme o endereço (padrão `192.168.4.1`)

O app consulta a cada 2 segundos. Se ficar 15 segundos sem resposta, volta
sozinho para simulado e avisa — de propósito, para a demo nunca congelar.

## O que este arranjo mede, e o que não mede

**Mede:** corrente eficaz no ponto onde o sensor está, convertida em potência
aparente pela tensão e pelo fator de potência declarados.

**Não mede:** potência real (precisaria de sensor de tensão sincronizado, tipo
PZEM-004T), nem separa geração de consumo (precisaria de um segundo sensor no
ramal do inversor).

Declarar isso na banca é mais forte do que ser perguntado.
