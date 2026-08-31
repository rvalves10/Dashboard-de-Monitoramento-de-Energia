/* ============================================================
   SOLARIS — medidor de corrente
   ESP32 + SCT-013-030 (sensor de corrente não invasivo)

   O ESP32 sobe como access point e serve a leitura em JSON.
   O dashboard consulta esse endereço. Sem internet, sem servidor,
   sem nuvem: dá para demonstrar em qualquer sala.

   Ligação do sensor:
     SCT-013-030 ---> jack P2
       - resistor de burden NÃO é necessário: o modelo -030 já
         tem saída em tensão (1 V para 30 A)
       - divisor resistivo 10k + 10k entre 3V3 e GND cria o
         ponto médio (1,65 V) para ler os dois semiciclos
       - capacitor 10 uF do ponto médio para GND estabiliza
       - um lado do jack no ponto médio, outro no GPIO 34

   Segurança: o SCT-013 é um transformador de corrente, abraça o
   fio POR FORA. Não abra o quadro com energia ligada e não corte
   nem descasque nenhum cabo. Se houver qualquer dúvida, chame um
   eletricista — este projeto não vale um choque.
   ============================================================ */

#include <WiFi.h>
#include <WebServer.h>

// ---------- configuração ----------
const char* AP_SSID     = "Solaris-Medidor";
const char* AP_SENHA    = "solaris2026";   // mínimo 8 caracteres

const int   PINO_SENSOR = 34;      // ADC1, entrada apenas
const float TENSAO_REDE = 127.0;   // MEDIR com multímetro e ajustar
const float FATOR_POT   = 0.92;    // fator de potência estimado da instalação
const float AMPS_POR_VOLT = 30.0;  // SCT-013-030: 1 V = 30 A
const int   AMOSTRAS    = 1480;    // ~3 ciclos de 60 Hz

// Offset do ponto médio, em contagens do ADC (0..4095).
// É calibrado sozinho no boot, com o disjuntor da carga desligado.
float offsetADC = 2048.0;

WebServer servidor(80);

// ---------- leitura ----------
// Mede o valor eficaz (RMS) da corrente. Somar amostras ao quadrado
// e tirar a raiz é o único jeito correto: a média simples de uma
// senoide dá zero.
float lerCorrenteRMS() {
  double somaQuadrados = 0;
  for (int i = 0; i < AMOSTRAS; i++) {
    int bruto = analogRead(PINO_SENSOR);
    // acompanha lentamente a deriva térmica do ponto médio
    offsetADC = offsetADC + (bruto - offsetADC) / 4096.0;
    double desvio = bruto - offsetADC;
    somaQuadrados += desvio * desvio;
  }
  double rmsADC = sqrt(somaQuadrados / AMOSTRAS);

  // contagens -> volts (ADC de 12 bits, fundo de escala ~3,3 V)
  double rmsVolts = (rmsADC * 3.3) / 4095.0;
  double amperes  = rmsVolts * AMPS_POR_VOLT;

  // abaixo disso é ruído do próprio ADC, não carga real
  if (amperes < 0.08) amperes = 0;
  return amperes;
}

float potenciaKW() {
  return (lerCorrenteRMS() * TENSAO_REDE * FATOR_POT) / 1000.0;
}

// ---------- calibração do zero ----------
void calibrarZero() {
  Serial.println("Calibrando o zero — mantenha a carga desligada...");
  double soma = 0;
  for (int i = 0; i < 8000; i++) { soma += analogRead(PINO_SENSOR); delayMicroseconds(50); }
  offsetADC = soma / 8000.0;
  Serial.printf("Offset do ADC: %.1f contagens\n", offsetADC);
}

// ---------- rotas ----------
// CORS liberado: a página pode estar aberta de file:// ou de outra origem.
void enviarJSON(const String& corpo) {
  servidor.sendHeader("Access-Control-Allow-Origin", "*");
  servidor.send(200, "application/json", corpo);
}

void rotaLeitura() {
  float kw = potenciaKW();
  // Um sensor só mede o consumo total. A geração continua vindo da
  // simulação no dashboard — está documentado em docs/contrato-dados.md.
  String json = "{\"cons\":" + String(kw, 3) + ",\"fonte\":\"medidor\"}";
  enviarJSON(json);
}

void rotaRaiz() {
  servidor.sendHeader("Access-Control-Allow-Origin", "*");
  servidor.send(200, "text/plain",
    "Solaris - medidor ativo\n"
    "GET /leitura  -> potencia instantanea em kW\n");
}

void setup() {
  Serial.begin(115200);
  delay(300);

  analogReadResolution(12);
  analogSetPinAttenuation(PINO_SENSOR, ADC_11db); // faixa de leitura ate ~3,3 V
  calibrarZero();

  WiFi.softAP(AP_SSID, AP_SENHA);
  Serial.print("Rede criada: ");
  Serial.println(AP_SSID);
  Serial.print("Endereco para o dashboard: http://");
  Serial.println(WiFi.softAPIP());   // normalmente 192.168.4.1

  servidor.on("/", rotaRaiz);
  servidor.on("/leitura", rotaLeitura);
  servidor.begin();
}

void loop() {
  servidor.handleClient();

  // eco no monitor serial, útil para calibrar contra uma carga conhecida
  static unsigned long ultimo = 0;
  if (millis() - ultimo > 2000) {
    ultimo = millis();
    Serial.printf("%.3f A   %.3f kW\n", lerCorrenteRMS(), potenciaKW());
  }
}
