# 🚀 Versão 0.0.1 — Fundação do Projeto

O objetivo desta versão é criar a infraestrutura do projeto, definindo sua arquitetura e preparando a base para o desenvolvimento das próximas funcionalidades.

Nenhuma mecânica de gameplay será implementada nesta etapa.

---

## Objetivos

- Estruturar a arquitetura do projeto.
- Configurar o ambiente de desenvolvimento.
- Inicializar o ECS.
- Criar o Game Loop.
- Definir a estrutura de pastas.
- Preparar o carregamento de assets.
- Configurar a infraestrutura de autenticação.

---

## Etapas

### 1. Configuração Inicial

- [X] Criar o projeto em Next.js
- [X] Configurar ESLint e Prettier
- [X] Configurar aliases (`@/`)

### 2. Dependências

- [X] Three.js
- [X] React Three Fiber
- [X] Koota ECS
- [X] Better Auth
- [X] Prisma
- [X] Bibliotecas auxiliares

### 3. Autenticação

- [X] Configurar o Better Auth
- [X] Configurar o banco de dados (Prisma)
- [X] Criar as tabelas/migrations
- [X] Configurar o cliente de autenticação
- [X] Configurar o servidor de autenticação
- [X] Criar páginas de Login
- [X] Criar páginas de Cadastro
- [X] Implementar proteção de rotas
- [X] Validar sessão do usuário

### 4. ECS

- [X] Criar o World
- [X] Criar o WorldProvider
- [X] Criar estrutura de Traits
- [X] Criar estrutura de Systems
- [X] Criar estrutura de Actions
- [X] Criar estrutura de Events

### 5. Game Loop

- [X] Criar Game Loop centralizado
- [X] Implementar Fixed Tick
- [X] Implementar Render Tick
- [X] Definir as fases do Game Loop
- [X] Criar Pipeline de Fases
- [X] Registrar Systems nas fases

### 6. Cena Inicial

- [X] Configurar Canvas
- [X] Criar Camera
- [X] Criar Luz Ambiente
- [X] Criar Cena de Teste
- [X] Criar primeira Entity ECS
- [X] Sincronizar ECS → View

---

## Critérios de Conclusão

A versão será considerada concluída quando:

- O projeto estiver inicializado e organizado.
- O Better Auth estiver configurado e funcional.
- O login e cadastro estiverem operacionais.
- O gerenciamento de sessão estiver funcionando.
- O ECS estiver funcionando.
- O Game Loop estiver em execução.
- Uma cena básica puder ser renderizada.