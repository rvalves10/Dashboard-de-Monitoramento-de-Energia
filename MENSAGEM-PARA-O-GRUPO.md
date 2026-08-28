# Mensagem para mandar no grupo

Copie daqui para baixo e cole no WhatsApp da equipe, junto com o
`Solaris-UPX.zip`.

---

Pessoal, o Solaris está pronto para o teste de campo. 🌞

**O que é:** o site de monitoramento de energia solar do nosso projeto.
Mostra para onde vai cada quilowatt da casa, quanto o sol cobriu de verdade
e quanto vem na próxima conta — já com a Lei 14.300 no cálculo.

**Como abrir (2 minutos):**
1. Baixem o `Solaris-UPX.zip` e **extraiam a pasta** (não abram de dentro do zip)
2. Duplo clique em `index.html`
3. Na tela que abrir, clique em **"Entrar sem criar conta"**
4. Pronto. Não precisa instalar nada nem estar na internet

**O que eu preciso de vocês:** usar por **pelo menos 7 dias**, o ideal são 30
para pegar a virada de mês. Deixem a aba aberta quando der — o sistema grava
uma leitura por minuto e a gente quer ver o histórico crescer.

O roteiro completo do que testar está em `docs/teste-de-campo.md`, dentro da
pasta. São 8 tarefas para fazer no primeiro dia e um checklist rápido para
os dias seguintes.

**O mais importante:** anotem tudo que incomodar. Número estranho, botão que
não acharam, palavra que não entenderam, qualquer coisa que travou. Não
filtrem — "achei feio" também é dado. Três linhas de quem usou de verdade
valem mais que uma página de quem só olhou.

**Se quiserem conferir que está tudo funcionando:** abram `testes/index.html`.
Tem que aparecer 87 de 87 testes verdes. Se aparecer vermelho, print no grupo.

**Duas coisas para já saberem, para não perderem tempo reportando:**
- Os dados do medidor são simulados, ainda não tem sensor ligado. Os números
  são calculados pela posição do sol na data e por um padrão de nuvens — não
  são inventados, mas também não vêm de um medidor físico. Isso é a próxima
  fase, com o ESP32.
- O login é opcional e não é segurança de verdade. Ele serve só para separar
  dados de quem divide o mesmo computador.
- Se criarem conta, ela começa **vazia** — a casa e a padaria são exemplos, e
  exemplo não deve aparecer como se fosse de vocês. O site pede a primeira
  unidade, e dá para ligar os exemplos em Configurações.

Qualquer dúvida, me chamem. Valeu! 🙏

---

## Checklist antes de mandar

- [ ] Abrir o `Solaris-UPX.zip` e conferir que extrai direito
- [ ] Testar o `index.html` numa máquina que não seja a sua
- [ ] Anotar a data de início do teste
- [ ] Combinar a data de retorno (7 dias e 30 dias)
- [ ] Preencher os nomes da equipe no `README.md` e no slide de capa
