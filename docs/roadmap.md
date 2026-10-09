# 🗺️ Roadmap — Rota 151

---

# ✅ Já feito (0.0.1 – 0.0.49)

O que já foi entregue, por tema. Detalhes de cada uma em `docs/features/`.

### Fundação
- [x] **001 — Fundação do projeto**
- [x] **002 — Arquitetura e primeiro loop jogável**
- [x] **005 — Suíte de testes (Vitest)**

### Movimento, câmera e física
- [x] **003 — Câmera orbital e movimento relativo**
- [x] **004 — Física (Rapier) e character controller**
- [x] **007 — Sistema de ações do jogador (dash)**
- [x] **008 — Colisão e movimento por espécie**
- [x] **016 — Mira e arremesso**

### Animação
- [x] **006 — Animação procedural de ossos**
- [x] **009 — Rotação de ossos por quaternion**
- [x] **023 — Humor, piscar de olhos e boca sincronizada com o grito**
- [x] **032 — Animações por keyframes e embutidas no `.glb`**

### Treinador, time e itens
- [x] **010 — HP e stamina (com regeneração)**
- [x] **011 — Slots de ação**
- [x] **012 — Mecanismo de item**
- [x] **013 — Criaturas de time**
- [x] **014 — Arremessar, usar e invocar/recolher**
- [x] **015 — Menu de pausa, HUD e inventário**
- [x] **017 — Locomoção, recolhimento e pathfinding das criaturas do time**
- [x] **018 — Troca de controle entre treinador e criatura**
- [x] **024 — Esfera de invocar**
- [x] **026 — Preparo do treinador `boy`**
- [x] **040 — Dono da criatura**
- [x] **041 — Inventário de itens e Pokémon**
- [x] **042 — Itens da beta**
- [x] **043 — Captura**
- [x] **044 — Salvar o jogo**

### Pokémon e mundo
- [x] **020 — Selvagens, cena maior e textura por espécie**
- [x] **021 — Pokémon iniciais reais e sorteio de espécie selvagem**
- [x] **022 — Fogo de cauda do Charmander**
- [x] **029 — Melhorias na Pokédex e nos controles de exploração**
- [x] **045 — Terreno de um chunk**
- [x] **046 — Sistema de chunks**
- [x] **047 — Biomas**
- [x] **048 — Dia, noite e clima**
- [x] **049 — Vegetação e floresta**

### Combate
- [x] **025 — Ataque comum de criatura**
- [x] **027 — HUD de status e habilidades**
- [x] **028 — Status de combate e velocidade de ação**
- [x] **030 — Sistema de dano dos ataques**
- [x] **031 — IA de combate e desmaio**
- [x] **033 — Skills de combate e VFX**
- [x] **034 — IA de batalha**
- [x] **035 — Balanceamento de ações e correções**
- [x] **039 — Tipos e combate clássico**

### Progressão
- [x] **037 — Experiência e nível**
- [x] **038 — Aprendizado, treino e domínio de golpes**

### Áudio e extras
- [x] **019 — Som ambiente, passos, vocalização, dash e pulo**
- [x] **036 — Wiki do jogo**

---

# 🎯 Beta 0.1

**Objetivo:** um sandbox jogável em um mundo procedural infinito. O jogador cria
o seu treinador, escolhe o inicial, explora biomas, acha itens, captura e treina
o time com o progresso salvo. No fim, amigos jogam juntos no mesmo mundo, trocam
Pokémon e duelam.

Desenvolvimento offline primeiro (Marcos 1 a 3); depois o multiplayer
(Marco 4). Tudo roda local até o deploy, que fecha a beta. O Marco 5 junta
as revisões e pendências identificadas no caminho.

---

## Marco 1 — Ciclo offline completo

**Objetivo:** jogar sozinho, capturar Pokémon, organizar o time e o inventário e,
ao fechar e abrir o jogo, encontrar tudo como deixou.

Concluído: a 044 (salvar o jogo) fechou o ciclo offline.

---

## Marco 2 — Mundo procedural

**Objetivo:** um mundo infinito gerado por seed, em chunks, com biomas, dia e
noite, clima, água e cavernas. Há itens para achar, as 7 espécies selvagens
aparecem conforme bioma, horário e clima, e há um Pokécenter para curar o time.

**Biomas da beta:** os 11 biomas existem na seed (cobrem os 151), mas só os
que as 7 espécies selvagens usam são refinados e aparecem no jogo —
**floresta** (Caterpie, Weedle, Pidgey, Pikachu), **planície** (Pidgey,
Rattata, Pikachu), **savana** (Rattata, Spearow, Ekans) e **montanha**
(Spearow e a boca das cavernas, 057). Os outros (oceano, praia, selva,
pântano, deserto, vulcânico e tundra) ficam escondidos (`BIOMES.HIDDEN`) e
só aparecem pelo F2. Os 3 iniciais não nascem no mundo: vêm só no kit
inicial (063).

- [ ] **050 — Planície e savana** — a vegetação dos dois biomas em cima da base da 049 (grama, flores, acácia, arbustos, pedras) e o ajuste visual de cada um (cores, desenho do chão). Os dois saem do `BIOMES.HIDDEN`.
- [ ] **051 — Montanha** — pinheiro, pedras grandes e o ajuste visual do bioma (cores, desenho do chão, neve no alto); sai do `BIOMES.HIDDEN`. Prepara as encostas para a boca das cavernas (057).
- [ ] **052 — Itens no mundo** — itens espalhados pela seed conforme o bioma (no chão e em arbustos: Pokébolas, poções) e **árvores de frutas** que dá para colher e voltam a dar fruto com o tempo. É a forma de conseguir itens além do kit inicial.
- [ ] **053 — Estruturas e Pokécenter** — sistema para colocar construções pré-modeladas no mundo procedural (posição pela seed, terreno aplainado). Primeiro: o Pokécenter, que cura o time (com o som de cura) e é o ponto de reaparecimento.
- [ ] **054 — As 10 espécies** — Bulbasaur, Charmander, Squirtle, Caterpie, Weedle, Pidgey, Rattata, Spearow, Ekans e Pikachu (7 novas, as selvagens; os 3 iniciais já existem e só vêm no kit inicial): modelo, status, golpes, sons e animações. Sons mapeados em `docs/reference/audio.md`.
- [ ] **055 — Spawn estilo Cobblemon** — limite por jogador ativo, nascer fora da vista, despawn dos distantes; condições por espécie: bioma, tags, horário, clima, faixa de nível e raridade. Só as 7 selvagens têm spawn; os 3 iniciais não nascem no mundo.
- [ ] **056 — Água** — lagos e rios; parte rasa andável (com respingo visual e sonoro), parte funda bloqueia treinador e criaturas; IA desvia da água funda; shader simples. Tag "perto de água" para o spawn. Só nos biomas visíveis (o oceano continua escondido).
- [ ] **057 — Cavernas** — camada subterrânea gerada pela seed (túneis e salões com malha, colisor e grade de navegação próprios, por chunk), sem mexer na superfície; boca numa encosta de montanha. Save e spawn passam a saber em que camada a entidade está.
- [ ] **058 — Design da HUD** — visual definitivo da interface (com horário e clima); menus saem de `src/tools/menu/` para `view/`.

> **Modelos das espécies (054):** o Sword/Shield só tem Caterpie e Pikachu.
> Weedle, Pidgey, Rattata, Spearow e Ekans precisam vir do Let's Go (todos os
> 151, com andar) ou do HOME (só animações de exibição). Resolver antes da 054.

---

## Marco 3 — O treinador e o começo do jogo

**Objetivo:** o jogador cria o próprio treinador, escolhe o Pokémon inicial,
aprende a jogar com um tutorial curto e controla um treinador com animações e
ações completas.

- [ ] **059 — Animações e ações do treinador** — revisar e completar o que o treinador faz *(detalhar quando chegar)*.
- [ ] **060 — Derrota do treinador** — cai ao chegar a 0 de HP e reaparece no último Pokécenter com o time curado.
- [ ] **061 — Criação do treinador** — escolha entre menino e menina e cores de cada parte (pele, cabelo, boné, blusa, calça, sapatos, mochila, olhos), aproveitando os materiais separados do modelo. Salvo com a conta.
- [ ] **062 — Áudio do treinador e da treinadora** — voz, passos, dash/rolamento, pulo, invocar/recolher, arremesso, dano e derrota para os dois modelos, mais os sons das ações revisadas na 059. Ver `docs/reference/audio.md`.
- [ ] **063 — Início do jogo e escolha do inicial** — primeira entrada: login → criação do treinador → escolha entre Bulbasaur, Charmander e Squirtle → mundo, com o kit inicial de itens (definido aqui; até lá o kit é de teste, ver 042). Quem já tem treinador vai direto para o mundo.
- [ ] **064 — Tutorial com o inicial** — passos guiados: andar, invocar/recolher, atacar, trocar o controle, usar um item, enfraquecer e capturar um selvagem. Avança ao fazer a ação; dá para pular.

> **Modelo da menina (061):** o `boy` veio do Legends (`tr0001`); a `girl`
> antiga foi removida. Usar a mesma fonte para ter os mesmos materiais e
> esqueleto.

---

## Marco 4 — Multiplayer

**Objetivo:** amigos entram no mesmo mundo e jogam juntos — se veem, veem os
mesmos selvagens, itens, horário e clima, batalham, capturam, trocam e duelam,
cada um com o próprio progresso salvo. O jogo vai para o ar.

- [ ] **065 — Servidor e sala** — Colyseus com uma sala, local. Servidor no mesmo repositório (ex.: `server/`) importando o `src/core/`.
- [ ] **066 — Entrar e ver os outros jogadores** — login na sala (Better Auth com `bearer()`), posição/rotação/animação sincronizadas com interpolação, aparência do treinador, nome acima da cabeça, entrar/sair e reconexão.
- [ ] **067 — Mundo compartilhado** — servidor é dono da seed, do horário e do clima; clientes e servidor geram os mesmos chunks.
- [ ] **068 — Selvagens no servidor** — spawn e IA no servidor, limite por jogadores ativos, cada jogador só recebe os selvagens perto dele. Entram aqui o bando e as regras de acerto pendentes do backlog.
- [ ] **069 — Combate no servidor** — cliente manda a intenção, servidor calcula dano, efetividade, status, desmaio e XP. A mira deixa de ler a câmera dentro do `core/` (`aim.js`).
- [ ] **070 — Captura, itens e save no servidor** — captura decidida no servidor; pegar itens do mundo e colher frutas passam pelo servidor (cada item pego some para todos); inventário e time mudam pelo servidor; só o servidor grava no banco.
- [ ] **071 — Troca entre jogadores** — pedir troca, os dois escolhem e confirmam; transação única no banco.
- [ ] **072 — Duelo PvP** — desafiar e lutar time contra time com o combate existente; usa a derrota do treinador da 060.
- [ ] **073 — Deploy** — jogo na Vercel e servidor na VPS da Hostinger (`wss://` com SSL via nginx, PM2 ou Docker, acesso ao banco). Fecha a beta 0.1.

> ⚠️ **Para rever depois:** o movimento é decidido pelo cliente (o servidor só
> repassa). Funciona entre amigos, mas não impede trapaça.

---

## Marco 5 — Revisão e pendências

**Objetivo:** juntar num lugar só as revisões e pendências que forem
aparecendo ao longo da beta, pra não interromper a feature em andamento. Cada
item entra aqui quando for identificado e vira feature quando chegar a vez.

- [ ] **074 — Revisão das ações das poções** — rever como as poções são usadas *(detalhar quando chegar)*.
- [ ] **075 — Revisão da batalha e da IA** — rever o combate e as decisões da IA dos selvagens (partir para a ofensiva ou fugir) *(detalhar quando chegar)*.
- [ ] **076 — Revisão da wiki** — rever a wiki inteira *(detalhar quando chegar)*.
- [ ] **077 — Limpeza de código sem uso** — achar e remover código que ficou de testes ou de ideias descartadas (systems, traits, componentes, dados, assets e configs que nada mais usa) *(detalhar quando chegar)*.
- [ ] **078 — Revisão do diagrama ER** — com todos os requisitos da beta conhecidos (save, mundo, multiplayer, troca, duelo), rever as tabelas do banco desenhadas na 044 e montar um diagrama ER melhor *(detalhar quando chegar)*.
- [ ] **079 — Chão plano no relevo** — o Rapier erra parte dos raios (bola, comida, câmera, mira) em células PLANAS do heightfield do relevo (medido na 045; o relevo por ruído não tem célula plana, então hoje não aparece). Resolver antes de aplainar terreno (estruturas na 053, chão da água na 056) — ex.: colisor próprio pra área plana *(detalhar quando chegar)*.
- [ ] **080 — Rotação das entidades no relevo** — rever como o corpo acompanha a inclinação do terreno: subindo um morro o corpo continua reto, e às vezes as skills saem da cabeça do personagem *(detalhar quando chegar)*.
- [ ] **081 — Luz no estilo BotW por hora** — sol mais quente, sombra azulada e névoa leve nas cores de cada hora (`DAY_CYCLE.KEYFRAMES`, 048). Mexer na luz muda a cor da grama, então junto vem um novo ajuste das cores da grama e da floresta (a 049 casou tudo com a luz de hoje) *(detalhar quando chegar)*.
- [ ] **082 — Desempenho no celular** — medir no celular na qualidade baixa (a 049 só mediu na Intel UHD do PC: a mata densa fica perto do limite de 30 FPS) e cortar o que pesar — copas, grama, sombra, raio *(detalhar quando chegar)*.
- [ ] **083 — Ambiente da floresta** — névoa um pouco mais fechada dentro da mata; partículas (folhas caindo de dia, vaga-lumes à noite); som ambiente por bioma (pássaros de dia, grilos e coruja à noite) *(detalhar quando chegar)*.
- [ ] **084 — Detalhes da floresta** — cogumelo-prateleira (`Mushroom_Laetiporus` do MegaKit), musgo nos troncos caídos e grama mais rala sob a copa fechada *(detalhar quando chegar)*.

---

## 🔭 Depois da beta 0.1

- Refinar os biomas escondidos (oceano, praia, selva, pântano, deserto, vulcânico e tundra — vegetação e ajuste visual) quando as espécies deles entrarem
- PC/caixa de Pokémon
- Evolução
- Nado
- Loja e dinheiro
- Crafting (estilo Cobblemon)
- Servidores pré-definidos (estilo Conquer)
- Emotes e chat