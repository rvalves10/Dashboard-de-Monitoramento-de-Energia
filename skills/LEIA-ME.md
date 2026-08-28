# Skills

Instruções que o assistente de IA lê antes de mexer no projeto. Existem para
que **qualquer pessoa do grupo peça alteração e receba o mesmo padrão** — sem
depender de quem lembrou de avisar o quê.

```
skills/
├── solaris-visual/     regras de aparência: cor, tipografia, forma, movimento
├── solaris-motor/      regras do cálculo: de onde vem cada número, a lei, estimado x medido
└── solaris-revisao/    o que conferir antes de abrir pull request
```

---

## Como ativar

As skills moram aqui (versionadas, revisáveis em pull request), mas o Claude
Code procura por elas em `.claude/skills/`. Para copiar:

```bash
node ferramentas/instalar-skills.mjs
```

Rode isso depois de clonar o repositório, e de novo sempre que alguém alterar
uma skill. É só cópia de arquivo — leva um instante e não instala nada.

Para conferir se pegou, peça no Claude Code: `/solaris-revisao`.

---

## Como usar no dia a dia

Não precisa invocar nada: a `description` de cada skill diz quando ela vale, e
o assistente carrega sozinha quando o assunto aparece. Mexer em CSS puxa a
`solaris-visual`; mexer em tarifa puxa a `solaris-motor`.

Para chamar de propósito, digite o nome com barra:

```
/solaris-revisao
```

---

## Por que isto está no repositório

Duas razões práticas.

**A primeira é repetição.** As mesmas três coisas voltavam a cada alteração:
alguém mudava uma cor sem saber que âmbar significa geração solar, alguém
acrescentava um número ao cálculo sem dizer de onde ele veio, alguém abria
pull request sem rodar a suíte. Escrever a regra uma vez é mais barato do que
explicar toda vez.

**A segunda é que decisão sem o porquê não sobrevive.** "Cartão para em 14px"
é fácil de desfazer. "Cartão para em 14px porque acima disso tudo vira o mesmo
borrão macio e a interface perde a cara de instrumento de medição" é bem mais
difícil de desfazer por engano. Cada regra aqui carrega o motivo.

---

## Ao mexer numa skill

Ela é documentação que alguém vai seguir — trate como código:

- **Diga o porquê**, não só a regra;
- **prefira o exemplo concreto** ao princípio abstrato;
- se a regra nasceu de um defeito real, **conte qual foi**. É o que impede a
  próxima pessoa de desfazer a correção sem perceber.
