# 🚀 Development Workflow

Este documento descreve o fluxo de desenvolvimento do projeto.

O objetivo é manter o código organizado, facilitar a colaboração e garantir que todas as versões publicadas sejam estáveis.

---

## 🌳 Branches

O projeto utiliza três tipos de branches.

```
main
│
├── develop
│
└── feature/*
```

### main

A branch `main` representa apenas versões oficiais do jogo.

Ela deve estar sempre estável e pronta para distribuição.

Exemplos:

```
v1.0.0
v2.0.0
```

---

### develop

Todo o desenvolvimento acontece na branch `develop`.

Ela representa a próxima versão do jogo.

---

### feature/*

Cada feature numerada é desenvolvida em uma branch própria, nomeada igual ao doc
correspondente (sem o `.md`): `feature/<seq>-<slug>` — ver a seção
"📁 Nome dos arquivos de feature", mais abaixo.

Exemplos:

```
feature/001-fundacao-do-projeto
feature/002-arquitetura-e-loop-jogavel
feature/003-camera-orbital-e-movimento
```

Após concluída, a feature é integrada na `develop`.

---

## 🏷️ Versionamento

O projeto utiliza Semantic Versioning.

```
MAJOR.MINOR.PATCH
```

- **MAJOR** → Versão oficial do jogo (`1.0.0`, `2.0.0`...)
- **MINOR** → Cada beta lançada durante o desenvolvimento (`0.1.0`, `0.2.0`...)
- **PATCH** → Cada feature entregue (`0.0.2`, `0.0.3`, `0.0.4`...)

Ou seja: features se acumulam em PATCH dentro do MINOR atual (`0.0.x`); quando uma
beta é lançada, sobe-se o MINOR e o contador de PATCH volta a zero (`0.1.0`, depois
`0.1.1`, `0.1.2`...).

### Bump de versão por feature

Toda feature **altera a versão no `package.json`** e tem um doc correspondente em
`docs/features/`. O bump entra na branch da feature (uma das etapas do doc), junto
das mudanças de código.

### 📁 Nome dos arquivos de feature

Formato: `docs/features/<seq>-<slug>.md`

- **`<seq>`** — número sequencial de **3 dígitos, contínuo, que nunca reinicia**
  (`001`, `002`, `003`...). É só um índice de busca — diferente do PATCH do
  SemVer, que reinicia a cada bump de MINOR. Serve pra achar a feature rápido
  (ex.: "cadê a feature de movimento?" → `003-camera-orbital-e-movimento.md`).
- **`<slug>`** — 2 a 4 palavras em kebab-case descrevendo o que a feature entrega.
  Não precisa repetir a versão SemVer; ela já está no título dentro do doc
  (`# 🚀 Versão 0.1.0 — ...`) e no `package.json`.

Como `<seq>` e a versão SemVer coincidem numericamente só durante a fase `0.0.x`
(nenhum MINOR foi lançado ainda), a tabela abaixo é só o histórico até aqui —
depois de um bump de MINOR elas divergem (ex.: a feature `006` pode ser a versão
`0.1.0`).

| seq | versão | arquivo |
|---|---|---|
| 001 | 0.0.1 | `001-fundacao-do-projeto.md` |
| 002 | 0.0.2 | `002-arquitetura-e-loop-jogavel.md` |
| 003 | 0.0.3 | `003-camera-orbital-e-movimento.md` |
| 004 | 0.0.4 | `004-fisica-e-character-controller.md` |
| 005 | 0.0.5 | `005-suite-de-testes.md` |

---

## 🏷️ Tags

Sempre que uma versão for publicada na `main`, uma Tag deve ser criada.

Exemplos:

```
v0.1.0
v0.2.0
v1.0.0
```

As Tags representam snapshots oficiais do projeto e permitem retornar facilmente para qualquer versão.

---

## 🔄 Fluxo de Trabalho

```
Criar feature

        │
        ▼

feature/player

        │
        ▼

Desenvolvimento

        │
        ▼

Pull Request

        │
        ▼

develop

        │
        ▼

Versão concluída

        │
        ▼

Merge para main

        │
        ▼

Criar Tag

        │
        ▼

Nova versão publicada
```