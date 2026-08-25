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
| `app/login.js` | Contas, sessão e derivação de senha — leia o cabeçalho do arquivo |
| `app/telas.js` | As sete telas do desktop |
| `app/celular.js` | O app de celular (mesmo motor, outra casca) |
| `app/controle.js` | Eventos, rotas, o tique do medidor, avisos |
| `testes/` | Suíte de testes do motor, roda no navegador |
| `firmware/` | Sketch do ESP32 para o medidor físico |
| `docs/contrato-dados.md` | Formato da leitura e limites declarados do sensor |
| `docs/protocolo-teste-usabilidade.md` | Roteiro do teste com 8 usuários (Sprint 5) |
| `build.mjs` | Gera as entregas de arquivo único |
| `Banca-Solaris.html` | Deck da apresentação: setas navegam, `N` abre as notas, `T` zera o cronômetro |
| `Plano-UPX-Solaris.html` | Plano de 14 semanas, riscos e banco de perguntas |
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

## Sobre o login (opcional)

O site abre direto no painel, em modo visitante — o login nao bloqueia nada. Criar conta e opcional e serve para separar dados de quem divide o mesmo navegador. Conta obrigatoria fica para quando o projeto virar app.

Quando alguem cria conta depois de mexer como visitante, o que ele fez vai junto.

O login existe e funciona, mas **isto não é segurança contra
quem tem acesso ao computador**. O app roda sem servidor: quem abrir o DevTools
lê o armazenamento local. O que o login entrega de verdade:

- a senha nunca é gravada — só uma derivação com salt e 150 mil iterações
  (PBKDF2 via WebCrypto, com SHA-256 encadeado como reserva em contextos
  sem WebCrypto);
- cada conta tem o próprio balde de dados: unidades, aparelhos, metas e
  tarifas não vazam de uma para outra;
- não há recuperação de senha, porque não há servidor para enviar e-mail.

Num produto real a verificação aconteceria no servidor e o hash nunca sairia
de lá. Isso está escrito na própria tela de login, de propósito — é melhor
declarar a limitação do que ser pego por ela na banca.

## Estado das sprints

| Sprint | O que era | Situação |
| --- | --- | --- |
| 0 · Fundação | Modularizar, repo, README | **Feito** |
| 1 · Fechar o produto | CRUD completo, acessibilidade | **Feito** |
| 2 · Credibilidade | Lei 14.300, irradiação, testes | **Feito** — falta comparar com conta real |
| 3 · Unidade é sua | Cadastro de unidade pelo usuário | **Feito** |
| 4 · Medidor de verdade | Contrato, firmware, seletor | **Software feito** — falta montar o hardware |
| 5 · Gente de fora | Teste com 8 usuários | Protocolo pronto, falta executar |
| 6 · Banca | Slides, ensaios, vídeo reserva | **Deck pronto** — falta preencher validação e ensaiar |

## Combinado do grupo

- Branch por frente, `main` sempre abrindo sem erro.
- Rodar `testes/index.html` antes de abrir pull request.
- **Congelamento na semana 13**: depois disso só entra correção de defeito.
