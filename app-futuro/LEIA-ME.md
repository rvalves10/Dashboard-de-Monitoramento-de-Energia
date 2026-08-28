# Fase 2 — quando virar aplicativo

**Nada aqui faz parte da entrega deste semestre.** Esta pasta guarda o que
vai ser útil quando o Solaris deixar de ser só um site.

Separei porque misturar as duas coisas confunde: hoje o Solaris é um **site**
que funciona bem no celular, e isso é diferente de ser um **aplicativo**.

---

## O que tem aqui

| Arquivo | Para que serve |
| --- | --- |
| `previa-app.html` | Mostra o site dentro do desenho de um celular. Abre e vê. |
| `moldura-celular.css` | O desenho do aparelho. Saiu do site quando a gente separou. |
| `ios-frame.jsx` | Componente do design original, do canvas. Referência visual. |

Abra `previa-app.html` para ver como ficaria. O que está dentro da moldura é
o site de verdade num iframe, sem cópia nem alteração — se mudar o site,
muda a prévia junto.

---

## Por que o site já funciona no celular sem ser app

Abaixo de 760 px de largura o `site/js/movel.js` troca a casca: sai o menu
lateral, entra uma coluna única com abas embaixo. É o mesmo motor, os mesmos
dados e o mesmo banco. Quem abrir o endereço no celular vê isso.

Um aplicativo seria outra coisa: ícone na tela inicial, funcionar sem
internet por padrão, notificação, acesso a sensor.

---

## O que precisaria acontecer para virar app

Em ordem de esforço, do mais barato para o mais caro:

**1. PWA — o caminho mais curto**
Um `manifest.json` e um service worker. Com isso o site ganha ícone na tela
inicial, abre em tela cheia sem barra do navegador e funciona offline.
Aproveita 100% do que já existe. Dá para fazer numa tarde.

**2. Conta obrigatória e sincronização**
Hoje o login é opcional e os dados ficam só no aparelho. Como app, faria
sentido exigir conta e sincronizar entre celular e computador — e aí entra
servidor de verdade, com o hash da senha ficando lá e não aqui.

**3. Empacotar em loja**
Capacitor ou Tauri embrulham o mesmo site num aplicativo instalável. Só vale
a pena se precisar de algo que o navegador não dá: notificação garantida,
leitura de Bluetooth do inversor, widget na tela inicial.

---

## O que NÃO fazer

Reescrever em React Native ou Flutter. O motor de simulação, a compensação de
créditos e a regra da Lei 14.300 já estão prontos e testados em JavaScript.
Reescrever isso significa refazer 54 testes e reintroduzir bugs que já foram
resolvidos, para ganhar o quê.
