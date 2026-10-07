# 🚀 Versão 0.0.40 — Dono da criatura

## Resumo

Toda criatura do time passa a saber **de qual treinador ela é**, por uma
relação do Koota (`OwnedBy`), em vez de o core supor que existe um treinador
só (`world.queryFirst(Party)`). XP, desmaio, domínio de golpes, treino,
invocar/recolher, troca de controle e a IA do grupo passam a agir sobre o
dono de cada criatura.

Nada muda de visível no jogo: continua um treinador só. A feature prepara o
core para a caixa (041), a captura (043) e o multiplayer (Marco 4), onde
vários treinadores dividem o mesmo mundo.

Versão: `0.0.40` (`package.json`). Branch: `feature/040-dono-da-criatura`.

---

## O que já existe (ponto de partida)

- `SummonedCreature` guarda só `slot` e `speciesId`; os dados do Pokémon
  (IV, vida, desmaio, nível/XP, golpes, domínio) vivem no treinador, por slot
  (`Party`, `PartyIndividualValues`, `PartyVitals`, `PartyFaint`,
  `PartyProgress`, `PartyMoves`…).
- Quem precisa do treinador faz `world.queryFirst(Party)`: XP
  (`experience.js`), desmaio (`faint.js`), domínio (`moveMasteryUse.js`),
  treino (`trainingSystem.js`), troca de controle (`controlSwitchSystem.js`),
  esfera de invocar (`summonBallSystem.js`) e menu de ações
  (`partyActionMenuInputSystem.js`).
- "A criatura do slot" é buscada no mundo inteiro: `findSummoned(world, slot)`
  (`partySummonSystem.js`) e `findSummonedCreature(world, slot)`
  (`experience.js`). Com dois treinadores, os dois slot1 se confundiriam.
- "O líder do grupo" é `world.queryFirst(InputControlled)` (seguir, IA do
  time, IA do treinador em batalha), e "o lado do jogador" é qualquer
  `Party`/`SummonedCreature` (`combatTargets.js`, `partyReactionSystem.js`).
- O Koota já é usado com relações: `FoughtBy`, `BurnedBy`, `SeededBy`,
  `Targeting`.

---

## Decisões (com o usuário)

1. **Escopo: o core todo.** Sai todo ponto do core que supõe um treinador
   só: `queryFirst(Party)`, a busca de criatura por slot sem dono e o
   líder/aliados globais. A view continua usando o jogador local
   (`playerEntity`), que é o certo pra interface.
2. **Dados continuam por slot no treinador.** A 040 só liga a criatura ao
   dono. Transformar cada Pokémon num registro próprio fica pra 041 (caixa).
3. **Criatura de outro treinador é neutra.** Nem ataca nem é atacada; cada
   time só luta contra selvagens e só defende o próprio treinador. Briga
   entre treinadores é a 069 (PvP).
4. **Validação só por testes.** Mundo de teste com dois treinadores; nada de
   segundo treinador no jogo nem no debug.

---

## Arquitetura

### Relação de dono (`core/traits/components/owner.js`)

- `OwnedBy = relation({ exclusive: true })`: da criatura invocada (e da
  `SummonBall` em voo) para o treinador. Exclusiva: uma criatura tem um dono.
- Quem cria a entidade põe a relação: `spawnSummonBall` na esfera,
  `summonBallSystem` na criatura que nasce (copiando o dono da esfera).

### Helpers (`core/actions/owner.js`, puros)

- `resolveOwner(entity)`: o treinador da entidade — ele mesmo se tiver
  `Party`, o alvo de `OwnedBy` se for criatura/esfera, senão `null`.
- `findOwnedCreature(world, trainer, slot)`: a criatura em campo daquele
  slot DAQUELE treinador. Substitui `findSummoned` e `findSummonedCreature`.
- `isSameTeam(a, b)`: mesmo dono (treinador conta como dono de si).
- `resolveGroupLeader(world, trainer)`: quem o grupo segue — o treinador, ou
  a criatura dele que está sendo pilotada.
- `resolveLocalTrainer(world)`: o treinador de quem tem `InputControlled`
  (ele mesmo ou dono da criatura pilotada). É quem recebe o input global
  (invocar, trocar controle, menu de ações).

### Onde troca

- **XP / domínio / treino**: o treinador vem do dono da criatura
  (`registrarParticipante`, `registrarUsoDeGolpe`, `trainingSystem`, e as
  actions de `training.js`/`moves.js`/`experience.js` recebem o treinador
  em vez de procurar).
- **Desmaio**: a criatura pilotada que desmaia devolve o controle ao
  PRÓPRIO dono.
- **Invocar/recolher**: o recolhimento automático e a esfera usam o dono;
  só o treinador local responde ao input. `hasPendingBall` olha só as
  esferas do treinador.
- **Troca de controle**: entre o treinador local e as criaturas DELE.
- **IA do grupo** (`creatureFollowSystem`, `partyBehaviorSystem`,
  `partyReactionSystem`, `trainerBattleSystem`): cada criatura segue o líder
  do próprio grupo e só defende o próprio dono; "selvagens lutando com o
  grupo" passa a ser por treinador.
- **Selvagem**: continua mirando qualquer treinador ou criatura de time; o
  treinador só fica "coberto" (`excludeCoveredTrainer`) por criatura DELE.
- **Fogo amigo**: já não existe (golpe do time só acerta `WildCreature`) —
  isso garante a neutralidade entre times sem mudança.
- **Interface**: o HUD do time (`PartyHud`) e o menu de ações
  (`PartyActionMenu`) só listam as criaturas do jogador local
  (`OwnedBy(playerEntity)`/`OwnedBy(trainer)`).

### Testes

- `makeWorld` ganhou `spawnTrainer` (um segundo treinador, sem input) e
  `ownedByPlayer(world)` (o `OwnedBy` pro treinador do world, espalhado no
  `spawn` das criaturas/esferas montadas à mão nos testes).
- `core/actions/owner.test.js`: os helpers de dono e o mundo com dois
  treinadores.

---

## Fora de escopo

- Cada Pokémon como registro próprio (id, dados fora do slot) — 041.
- Segundo treinador no jogo/debug, ou qualquer coisa de rede — Marco 4.
- Combate entre treinadores — 069.
- A interface (HUD, menus, Pokédex) continua lendo o jogador local.

---

## Etapas

- [x] Bump da versão para `0.0.40` e doc da feature.
- [x] Revisão do doc pelo usuário.
- [x] Relação `OwnedBy` e helpers de dono.
- [x] Esfera e criatura nascem com dono; busca por slot com dono.
- [x] XP, desmaio, domínio e treino pelo dono (sem `queryFirst(Party)`).
- [x] Invocar/recolher, troca de controle e menu de ações pelo treinador
      local.
- [x] IA do grupo (seguir, defender, treinador em batalha) por grupo.
- [x] Testes com dois treinadores (regras: o XP vai pro dono; desmaio
      devolve o controle ao dono; recolher não mexe no time do outro; um
      time não defende o outro; selvagem brigando com um não entra na luta
      do outro; cada criatura segue o próprio treinador). Domínio e treino
      pegam o dono pelo mesmo `resolveOwner` e seguem cobertos pelos testes
      de um treinador.

---

## Critérios de Conclusão

- [x] Nenhum `world.queryFirst(Party)` no core.
- [x] Toda criatura invocada (e esfera em voo) tem `OwnedBy` pro treinador.
- [x] Com dois treinadores, XP, domínio, treino, desmaio, invocar/recolher e
      a IA do grupo ficam cada um no seu time (testes).
- [x] Jogo igual ao de antes com um treinador (conferido pelo usuário).
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      144 arquivos, 1532 testes, com `--maxWorkers=2`; build feito numa cópia,
      por causa do `next dev` rodando).
- [x] Wiki: nada a mudar — a feature não muda nada visível pro jogador.
