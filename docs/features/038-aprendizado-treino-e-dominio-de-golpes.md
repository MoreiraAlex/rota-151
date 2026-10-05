# 🚀 Versão 0.0.38 — Aprendizado, treino e domínio de golpes

## Resumo

Cada criatura do time passa a ter **os próprios 3 golpes** (Q/E/R), em vez do
kit fixo da espécie. Golpes novos não chegam sozinhos: ao cumprir as condições
(por enquanto, o nível), o Pokémon fica **apto**; o treinador precisa
**treiná-lo** perto de um objeto de treino do mapa pra ele aprender; e o golpe
recém-aprendido nasce com **domínio baixo** — erra mais, gasta mais energia e
demora mais pra recarregar — e melhora com o uso em combate. Como cada
Pokémon só tem 3 golpes, aprender um **esquece** outro, que guarda parte do
progresso pra ser re-treinado depois.

Versão: `0.0.38` (`package.json`). Branch:
`feature/038-aprendizado-treino-e-dominio-de-golpes`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config/espécie).

---

## Decisões (com o usuário)

1. **Ciclo de vida do golpe, por criatura:**
   `Bloqueado → Apto → Em treino → Aprendido (domínio baixo) → Dominado`.

   | Estado | Regra | No menu de treino |
   |---|---|---|
   | Bloqueado | não cumpre `requires` | `???` |
   | Apto | cumpre `requires` (calculado, não guardado) | nome + barra de progresso |
   | Em treino | treinando agora | barra subindo |
   | Aprendido | está num dos 3 slots, domínio abaixo do máximo | barra de domínio |
   | Dominado | domínio no máximo → valores clássicos | selo |

2. **Quem escolhe é o treinador**, mas não troca livremente: só 3 golpes por
   Pokémon, e aprender um novo esquece outro (efeito de memória). O
   esquecido volta a Apto guardando uma fração do progresso de treino.
3. **Treinar pra aprender** só perto de um **objeto de treino fixo no mapa**
   (tronco, pedra, boneco), com o Pokémon invocado e fora de combate. Não
   exige o golpe equipado. O Pokémon faz **repetições automáticas** do golpe,
   gastando energia; sem energia, descansa e volta.
4. **Dominar** exige o golpe equipado e acontece em **combate** (cada uso
   conta, acertando ou não; acerto rende mais; retorno decrescente perto do
   máximo) e também **treinando no objeto** (devagar, por tempo). O domínio
   não cai com o tempo.
5. **Domínio baixo piora** precisão, custo de energia e recarga. Golpe que
   nunca erra (sem precisão, em si mesmo, canalizado) passa a poder
   **falhar** ("Falhou!").
6. **Menu de ações treinador↔Pokémon:** no modo treinador, **segurar** Q/E/R
   abre o menu do Pokémon daquele slot (toque curto continua invocando/
   recolhendo, agora ao soltar). Ações: **Treino** (lista do learnset) e
   **Golpes** (reordenar os 3 slots). Futuras ações treinador↔Pokémon entram
   aqui.
7. **Ao concluir o treino** com 3 golpes, abre a escolha "esquecer qual?".
   Cancelar deixa o golpe apto com o treino completo, pra aprender depois.
8. **Selvagens** têm o kit da espécie com domínio máximo.
9. O kit inicial da espécie (`species.skills`) nasce aprendido e dominado.

### Exemplo (fictício)

Charmander nível 5 sabe Growl, Tackle e Ember, dominados. No nível 5 ele fica
apto pra Smokescreen. Perto de um tronco, o treinador segura Q → Treino →
Smokescreen; o Charmander repete o golpe até a barra encher. Ao concluir,
escolhe esquecer o Growl. O Smokescreen entra no slot com domínio baixo
(digamos 40% da precisão clássica, energia e recarga maiores) e melhora a cada
uso em combate. O Growl volta a Apto com parte do treino guardada.

---

## Arquitetura

### Dados (`core/data/species/moves.js`, puro)

- `species.skills` continua sendo o kit inicial (`{1,2,3}`); `species.moves`
  vira o learnset: `[{ id, requires?, overrides? }]`. Sem `requires`, o golpe
  fica apto de imediato (as espécies ainda não declaram nível — conteúdo do
  usuário; formato no `_template`). Condição que o jogo não avalia conta como
  não cumprida.
- `listLearnset` (kit + learnset), `meetsMoveRequirements`,
  `resolveSpeciesMoveReference` (acha os `overrides` da espécie pelo id),
  `createMovesState`, `cloneMovesState`, `resolveMoveStatus`
  (`locked`/`apt`/`ready`/`learned`/`mastered`).

### Estado

- `PartyMoves` (treinador, por slot) — fonte de verdade; `CreatureMoves`
  (criatura invocada, cópia feita no `summonBallSystem`). Formato:
  `{ slots: {1,2,3} → { id, mastery } | null, training: { [id]: fração } }`.
  Selvagem não tem: `resolveEntityMoves` cai no kit da espécie, dominado.
- `MoveLearnRequest` (treinador) — "esquecer qual?" pendente.
- `Training` (criatura) e `TrainingObject` (objeto do mapa).
- `PartyActionMenu` + `SlotHold` (treinador) — menu de ações e tempo segurado.

### Actions (`core/actions/moves.js`, `training.js`, `partyActionMenu.js`)

`progredirTreino`, `aprenderGolpe` (esquece com `FORGET_RETAINED`),
`pedirAprendizado`/`adiarAprendizado`, `reordenarGolpes`, `ganharDominio`,
`somarDominio` (debug), `anunciarGolpesAptos` (chamada por
`ganharExperiencia`); `iniciarTreino`/`pararTreino`/`resolveTrainingBlock`;
`abrirMenuDeAcoes`/`fecharMenuDeAcoes`/`isPartyMenuOpen`. Cada uma escreve no
slot do time e na criatura em campo.

### Golpe por slot vindo da criatura

- `resolveCreatureAttack(species, slot, moveSet)` / `resolveEntityMoveSet`
  / `resolveEntityAttack` (`core/battle/creatureAttack.js`); slot interno
  `'training'` pro golpe em treino. Sem `moveSet` (wiki), o kit da espécie.
- `resolveAttackForEntity(..., moveSet)` aplica o domínio: energia e recarga
  multiplicadas, e `attack.mastery` vai junto pro sorteio.
- Todos os leitores do jogo e da view passaram a usar a criatura:
  `creatureAttackSystem`, `attackCasting`, `attackStatusEffects`,
  `aiAttackChoice`, `aiMovement`, `SkillsHud`, `AttackIndicatorView`,
  `AttackTelegraphView`, `ContinuousAttackEffectsView`, `attackAudioSystem`.
- **Som por golpe**: o som de ataque passou a ser registrado por chave
  (`'primary'` ou o id do golpe, `resolveAttackSoundKey`) pro learnset inteiro,
  e o `AttackPulse` leva a chave — o golpe de cada slot muda por criatura.

### Domínio (`core/battle/moveMastery.js`, `moveMasteryUse.js`)

- Fatores interpolados em linha pelo domínio (`MOVES.MASTERY`): precisão
  (`resolveHitChance`), energia e recarga (`withActionCost` → `withMastery`).
- Golpe que não erra (`isNeverMissAttack`: sem precisão, em si mesmo,
  canalizado) sorteia falha no `effectAt` (`rollAttackFails`) → evento
  `attackFailed` ("Falhou!"); o canalizado acaba ali.
- Sobe no `effectAt` de um golpe Q/E/R da criatura do time, só com uma
  selvagem em combate perto (`OPPONENT_RADIUS`); acerto rende mais; retorno
  decrescente com piso (`MIN_GAIN_FRACTION`).
- IA: `scoreAiAttack` multiplica a nota pelo fator de precisão do domínio.

### Treino

- `TEST_LEVEL.trainingObjects` (tronco e pedra perto do início) — viram
  obstáculos comuns (colisão, pathfind, mesh com cor própria) e entidades
  `TrainingObject` (`trainingObjectSpawnSystem`).
- `trainingSystem` (antes do `creatureAttackSystem`): anda até o alcance,
  repete o golpe com `tryStartAttack(..., { enterCombat: false })`, conta a
  repetição no fim da ação, descansa sem energia, para em luta/controle/
  desmaio/longe do objeto. `creatureFollowSystem` pula quem treina.
- **Treino conta TEMPO, em horas** (pedido do usuário: trocar de golpe tem que
  exigir muito tempo — estilo "deixar treinando a noite toda"; o Flamethrower
  na casa de um dia). `resolveTrainingHours` (`core/battle/actionCost.js`):
  aprender = peso do golpe (`resolveAttackWeight`, a régua da energia) ÷ 100 ×
  `LEARN_HOURS_PER_100_WEIGHT`, mínimo `MIN_LEARN_HOURS`; dominar (de zero ao
  máximo) = aprender × `MASTERY_HOURS_MULTIPLIER`; `trainingHours` escrito na
  skill (ou no override da espécie) ganha da fórmula. O tempo no objeto
  (repetindo, esperando ou descansando — não o de ir até ele), ×
  `TIME_MULTIPLIER` (acelerar pra teste), é creditado a cada repetição
  concluída. `progredirTreino`/`treinarDominio` têm folga de arredondamento.
  (Substituiu a primeira versão, por número de repetições por peso.)
- **Treinar o domínio** de um golpe equipado ainda não dominado, no objeto,
  pela mesma ação Treino (`resolveTrainingGoal`: `'learn'` | `'master'`) —
  pedido original do usuário (item 4), que tinha ficado de fora. Sobe linear
  pelas horas de dominar; o combate continua subindo, mais rápido. No treino
  de domínio, o golpe usa o domínio que já tem (custo/recarga), não o mínimo.
- Barras de treino e de domínio (menu de ações, aba Time) mostram a
  porcentagem com duas casas (`formatProgressPercent`,
  `view/shared/formatProgress.js`) — com treino de horas, cada repetição mexe
  pouco no número.
- **Quando o treino acaba** (decisão do usuário): só se o treinador assumir o
  controle dela, recolher ela, ou alguém atacá-la (golpe, mesmo errando, ou
  drenagem — `partyReactionSystem`, que também não chama quem está treinando
  pra defender o grupo). O treinador se afastar ou o time entrar noutra luta
  não tiram do treino; empurrada pra longe, ela volta andando até o objeto.
  Além disso: o botão "Parar" do menu, desmaiar, e o treino completo.
- **Aba escondida / servidor** (decisão do usuário): manter o treino
  andando com a aba fora da tela fica pra quando o jogo rodar num servidor.
- **Persistência fica pro backlog** (decisão do usuário): sem save, recarregar
  a página perde o progresso, e o navegador pausa o jogo em aba escondida —
  treino longo só com a aba aberta.
- Parada no alcance esperando a próxima repetição (energia, pausa entre
  repetições ou recarga do golpe), a criatura toca a animação de descanso:
  `Training.waiting` → estado `rest` em `animationStates.js` (fallback
  `idle`), usando `nativeAnimations.rest` (início/loop/fim) da espécie.
- Parar o treino no meio de uma repetição encerra o golpe junto
  (`pararTreino`); e o `creatureAttackSystem` encerra a ação se o golpe do
  slot deixar de existir no meio dela (correção: assumir o controle durante
  uma repetição quebrava o jogo).

### Menu de ações e input

- `partyActionMenuInputSystem` (fase input, depois do `inputSystem`): no modo
  treinador, engole o aperto de Q/E/R e devolve o pulso ao SOLTAR (toque →
  invoca/recolhe, `partySummonSystem` sem mudança); segurar
  `ACTION_MENU_HOLD_TIME` abre o menu. Com menu ou "esquecer qual?" aberto,
  zera as flags de ação.
- View (`tools/menu/`): `PartyMenus` (solta/trava ponteiro, Esc fecha),
  `PartyActionMenu` (abas Treino e Golpes), `ForgetMoveDialog`. A aba Time da
  Pokédex mostra os golpes e o domínio (só leitura). O Esc do menu de pausa
  ignora quando uma dessas está aberta.

### Feedback e debug

- `damageNumberSystem`: "Falhou!", "Pode aprender X!", "Aprendeu X!" (cores
  `FEEDBACK.FAIL_COLOR`/`MOVE_NOTICE_COLOR`). `formatSpeciesName` foi pra
  `view/shared/formatName.js` (sem JSX) pra poder ser usada por system.
- `DebugPanel`: por slot, golpes com domínio, treino, "+treino" (primeiro
  golpe apto) e "+domínio". Como o "+XP", sem fila de eventos (sem texto
  flutuante). O mesmo vale pro "esquecer qual?" e pro "Aprender" do menu:
  quem aprende pela interface não mostra "Aprendeu X!".

### Constantes (`gameConfig.js`, grupo `MOVES`)

`MASTERY` (domínio inicial, piores fatores, ganho por uso, bônus de acerto,
piso do ganho, raio do oponente), `TRAINING` (raio do objeto, horas por 100 de
peso e mínimo, multiplicador de horas pra dominar, acelerador do relógio,
pausa, descanso, fração guardada ao esquecer, debug),
`ACTION_MENU_HOLD_TIME`, `DEBUG_MASTERY`.

---

## Fora de escopo

- Tutor/dojo (NPC ou lugar que acelera o treino) — no backlog.
- Condições além do nível (item, vínculo...) — o formato `requires` já
  aceita, mas só `level` é avaliado.
- Learnsets completos da série — conteúdo do usuário.
- Persistência (não existe save ainda).

---

## Etapas

- [x] Bump da versão para `0.0.38`, doc da feature e backlog.
- [x] Learnset (`species.moves` + `requires`), `resolveSpeciesMoveReference`,
      `_template`.
- [x] Traits `PartyMoves`/`CreatureMoves` + `resolveEntityMoves`; spawn,
      starters, invocação, selvagens.
- [x] Golpe por slot vindo da entidade (todos os chamadores, jogo e view).
- [x] Domínio: precisão, falha ("Falhou!"), energia, recarga, ganho em
      combate, IA.
- [x] Objetos de treino (dados, entidades, cena).
- [x] Toque × segurar em Q/E/R, pedido de menu, bloqueio de input, menu de
      ações (Treino + Golpes).
- [x] Treino automático, conclusão e "esquecer qual?".
- [x] Feedback (textos flutuantes) e debug.
- [x] Wiki: versionamento passou a ser por BETA (pedido do usuário) — as
      versões 0.0.36/0.0.37/0.0.38 viraram uma só, `0.0.x`, ao vivo (ver
      docs/features/036-wiki-do-jogo.md, "Como as versões funcionam"); página nova "Golpes e treino"; Acerto e erro, Energia,
      Experiência, Seu time, Como lutam e o catálogo de criaturas ("Pode
      aprender") atualizados.

### Falta conferir em jogo (pelo usuário)

- Segurar/tocar Q/E/R: o tempo de segurar e o pequeno atraso do toque.
- Menu de ações e "esquecer qual?" (ponteiro solta e volta, Esc).
- Criatura indo até o tronco/pedra e repetindo o golpe; descanso sem energia.
- "Falhou!", "Errou!" mais frequente, custo/recarga maiores num golpe novo, e
  o domínio subindo em luta.
- Posição e cor dos objetos de treino.
- Níveis do learnset das espécies (hoje sem `requires`: smokescreen e
  flamethrower do Charmander já aptos; o leech-seed do Bulbasaur já está no
  kit).

---

## Critérios de Conclusão

- [x] Duas criaturas da mesma espécie podem ter golpes e domínios diferentes.
- [x] Subir de nível deixa o golpe apto, sem aprender sozinho.
- [x] Treinar perto do objeto de treino ensina o golpe (por tempo, em horas,
      proporcional ao peso); com 3 golpes, escolhe qual esquecer; o esquecido
      guarda parte do progresso.
- [x] Domínio baixo erra/falha mais, gasta mais e recarrega mais devagar;
      sobe com uso em combate e treinando no objeto, até os valores clássicos.
- [x] Treino só acaba por controle, recolher, ataque (ou "Parar"/desmaio/
      completo).
- [x] Tocar Q/E/R invoca/recolhe; segurar abre o menu.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      136 arquivos, 1480 testes, com `--maxWorkers=2` — sem limite o vitest
      estourou a memória; build feito numa cópia, por causa do `next dev`
      rodando — 38 páginas da wiki `0.0.x`).
