# Solaris

Painel de monitoramento de energia solar para residência e pequeno negócio.
Projeto de UPX.

O sistema não é uma maquete: os números são calculados a partir da posição do
sol na data, de um padrão de nuvens por dia e das regras de compensação da
ANEEL. Um medidor virtual roda em tempo real e pode ser trocado por um sensor
físico sem que o resto do sistema saiba a diferença.

---

## Como rodar

Não tem instalação, não tem servidor, não tem build para desenvolver.

```bash
# abra este arquivo no navegador
app/index.html
```

Duplo clique resolve. Funciona em `file://` porque os scripts são clássicos,
não módulos ES.

## Como gerar a entrega

O arquivo único, para enviar por e-mail ou publicar:

```bash
node build.mjs
```

Gera `Solaris.html` (documento completo, duplo clique) e
`dist/solaris-artifact.html` (sem tags de documento, para publicar online).

## Como rodar os testes

```bash
# abra no navegador
testes/index.html
```

Os testes checam o motor: conservação de energia hora a hora, o ranking de
aparelhos fechando com o medidor, estabilidade da projeção do dia 1º ao 31,
virada de ano e a regra do Fio B.

---

## Estrutura

| Caminho | O que é |
| --- | --- |
| `app/index.html` | Casca da página; carrega os quatro scripts na ordem |
| `app/estilo.css` | Sistema de design inteiro: cores, tipografia, componentes, responsivo, impressão |
| `app/motor.js` | Simulação física, tarifas, compensação de créditos, estado e persistência |
| `app/telas.js` | As sete telas do desktop |
| `app/celular.js` | O app de celular (mesmo motor, outra casca) |
| `app/controle.js` | Eventos, rotas, o tique do medidor, avisos |
| `testes/` | Suíte de testes do motor, roda no navegador |
| `firmware/` | Sketch do ESP32 para o medidor físico |
| `docs/` | Contrato de dados e protocolo de teste com usuários |
| `build.mjs` | Gera as entregas de arquivo único |
| `Solaris.dc.html` | Design original no canvas — não editar, é a referência visual |

### Por que scripts clássicos e não módulos

Módulos ES exigem servidor HTTP por causa de CORS. Scripts clássicos abrem
direto do disco. Como a apresentação em banca não pode depender de rede nem de
`npm install`, essa restrição vale mais que a organização que módulos trariam.

As variáveis de topo declaradas com `let` e `const` são compartilhadas entre os
quatro arquivos pelo escopo léxico global — `motor.js` declara, os outros usam.

---

## Frentes de trabalho

| Frente | Arquivos | Responsável |
| --- | --- | --- |
| Motor e Dados | `app/motor.js`, `testes/` | |
| Interface | `app/telas.js`, `app/celular.js`, `app/estilo.css` | |
| IoT | `firmware/`, `docs/contrato-dados.md` | |
| Qualidade | `testes/`, `docs/protocolo-teste-usabilidade.md` | |
| Narrativa e banca | `Plano-UPX-Solaris.html` | |

Preencha os nomes antes da primeira sprint. Uma frente sem dono é uma frente
que atrasa.

## Combinado do grupo

- Branch por frente, `main` sempre abrindo sem erro.
- Rodar `testes/index.html` antes de abrir pull request.
- **Congelamento na semana 13**: depois disso só entra correção de defeito.
