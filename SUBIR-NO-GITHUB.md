# Subir no GitHub

O repositório já está pronto: 8 commits, branch `main`, 23 arquivos, `.gitignore`
no lugar. Falta só o push, que precisa da sua conta — eu não consigo autenticar
daqui.

## Caminho mais rápido: pelo site

1. Vá em **github.com/new**
2. Nome sugerido: `solaris` (ou `solaris-upx`)
3. Visibilidade: **Private** por enquanto — dá para abrir depois num clique,
   mas o contrário não é bem verdade: repositório público pode ser clonado,
   forkado e indexado antes de você voltar atrás
4. **NÃO** marque "Add a README", "Add .gitignore" nem licença — o repositório
   local já tem tudo, e essas opções criam conflito no primeiro push
5. Criar, e rodar aqui embaixo os comandos que o GitHub mostrar (ou os daqui)

Trocando `SEU-USUARIO` pelo seu login:

```bash
git remote add origin https://github.com/SEU-USUARIO/solaris.git
git push -u origin main
```

Na primeira vez o Git vai pedir usuário e senha. **A senha não é a sua senha do
GitHub** — é um token. Se ele não abrir uma janela de login automática:

1. github.com → Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token
2. Marque só o escopo **repo**
3. Use o token no lugar da senha

## Alternativa: instalar o GitHub CLI

Resolve o login de uma vez e evita token na mão.

```bash
winget install --id GitHub.cli
```

Feche e reabra o terminal, então:

```bash
gh auth login
gh repo create solaris --private --source=. --remote=origin --push
```

## Depois de subir

Deixar o repositório apresentável leva dois minutos e conta ponto:

- **Description**: `Monitoramento de energia solar com medidor virtual, desagregação por aparelho e Lei 14.300 — projeto de UPX`
- **Topics**: `energia-solar`, `iot`, `esp32`, `javascript`, `upx`, `aneel`
- Se o professor precisa ver e o repo é privado: Settings → Collaborators →
  adicionar o usuário dele
- Para abrir ao público depois: Settings → General → Danger Zone →
  Change visibility

## Sobre a autoria dos commits

Os 8 commits estão como **Solaris \<richardvic12@gmail.com\>**. Como o e-mail é
o seu, o GitHub vai vincular tudo ao seu perfil e mostrar sua foto — o nome
"Solaris" é só o rótulo de exibição.

Se preferir seu nome real no histórico, me avise antes do push que eu reescrevo
os 8 commits. Depois de subir também dá, mas aí é `--force`, e se alguém do
grupo já tiver clonado, quebra o clone dele.

## Um aviso antes de tornar público

O repositório inclui `Solaris.dc.html` e `Solaris-completo.html`, que são os
arquivos originais do design. Confira se você quer esses dois no ar antes de
abrir o repositório — eles não são necessários para o sistema funcionar, e dá
para removê-los do histórico se preferir.
