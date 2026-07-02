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

Cada funcionalidade deve ser desenvolvida em uma branch própria.

Exemplos:

```
feature/player
feature/camera
feature/battle
feature/inventory
feature/world
```

Após concluída, a feature é integrada na `develop`.

---

## 🏷️ Versionamento

O projeto utiliza Semantic Versioning.

```
MAJOR.MINOR.PATCH
```

Durante o desenvolvimento:

- **MAJOR** → Versões oficiais do jogo (`1.0.0`, `2.0.0`...)
- **MINOR** → Grandes entregas durante o desenvolvimento (`0.1.0`, `0.2.0`...)
- **PATCH** → Correções e pequenos ajustes (`0.2.1`, `0.2.2`...)

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