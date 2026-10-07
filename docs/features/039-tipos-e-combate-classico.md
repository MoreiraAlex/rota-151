# 🚀 Versão 0.0.39 — Tipos e combate clássico

## Resumo

Criaturas e golpes passam a ter **tipo** (Fogo, Água, Planta…), e o tipo
entra de verdade na batalha: o golpe do mesmo tipo de quem ataca rende mais
(STAB), e cada tipo é **forte, fraco ou imune** contra os tipos do alvo
(tabela de efetividade). Até aqui a estrutura existia só como gancho:
`calculateDamage` já recebia `stab`/`type1`/`type2`, mas
`resolveTypeEffectivenessMultiplier` devolvia sempre neutro, nenhuma espécie
declarava `types` e todo golpe tinha `damage.type: null`
(docs/features/030-sistema-de-dano-de-ataques.md).

A feature cresceu em partes, todas puxando o combate pro jeito dos jogos
clássicos: **registro da batalha** em texto (Parte 2), **visual toon** com
contorno, revisado (Parte 3), **queimadura** do Ember/Flamethrower (Parte 4)
e o **fim do ataque básico** — a criatura só tem os golpes (Parte 5). O slug
foi de `039-tipos-e-efetividade` pra `039-tipos-e-combate-classico` pra cobrir
o escopo inteiro.

Versão: `0.0.39` (`package.json`). Branch: `feature/039-tipos-e-combate-classico`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config/espécie/golpe).

---

## O que já existe (ponto de partida)

- `computeDamage` (`core/battle/calculateDamage.js`) já monta `stab`,
  `type1`, `type2` a partir de `species.types` e `damage.type` — falta só a
  tabela e o dado.
- `resolveStab` com o multiplicador escrito no código (sai pra config).
- `IMPACT_TYPES` (`core/data/impactTypes.js`): a lista dos 18 tipos, hoje só
  pra escolher partícula/som do impacto genérico (`visual.impactType`, senão
  `damage.type`, senão `'normal'`).
- Wiki: a seção "Tipos" da página de dano e o catálogo de criaturas dizem
  "ainda não têm tipo".

---

## Decisões (com o usuário)

1. **Tabela da Gen 1, 15 tipos** (sem Aço, Sombrio e Fada), com as
   esquisitices dela (Fantasma não afeta Psíquico, Gelo neutro contra Fogo,
   Inseto e Veneno super efetivos um no outro). A lista dos 18 tipos do
   impacto genérico (`IMPACT_TYPES`) continua à parte: é só pra escolher
   partícula/som.
2. **Multiplicadores clássicos, escritos na própria tabela** (super efetivo,
   pouco efetivo, imune = zero). Só o STAB fica na config
   (`GAME_CONFIG.TYPES.STAB_MULTIPLIER`).
3. **Todo golpe tem tipo, inclusive os de status** — o tipo sobe de
   `damage.type` pro topo da skill (`skill.type`). `damage.type` sai; quem
   lia ele (STAB, impacto genérico, wiki) passa a ler `skill.type`. Sem tipo
   = `'normal'`.
4. **Golpe de status ignora a tabela**, como no original — exceto regras
   pontuais declaradas na skill: `immuneTypes` (ex.: Leech Seed não pega em
   tipo Planta).
5. **Golpe imune**: sem dano, sem efeitos secundários, sem brilho/hit stop,
   não conta como participação no XP nem como acerto pro domínio — mostra
   "Não afeta…". Continua gastando energia e recarga.
6. **Treinador e espécie sem `types`** = neutros: sem STAB e sem fraqueza.
7. **Conteúdo inicial** (dado, ajustável pelo usuário):
   - Espécies: Bulbasaur `['grass', 'poison']`, Charmander `['fire']`,
     Squirtle `['water']`.
   - Golpes: tackle/punch/growl/tail-whip/smokescreen/growth `normal`;
     vine-whip/razor-leaf/leech-seed `grass`; ember/flamethrower `fire`;
     water-gun/whirlpool `water`. Ataques básicos das espécies: `normal`.

---

## Arquitetura

### Dados (`core/data/types/index.js`, puro)

- `TYPES` (15 tipos, `name` em português e `color` pra HUD/wiki),
  `TYPE_CHART` (tipo do golpe → tipo do defensor → multiplicador; par
  ausente = neutro), `DEFAULT_TYPE` (`'normal'`).
- `resolveTypeEffectiveness(attackType, defenderTypes)` →
  `{ multiplier, effectiveness }` (produto dos tipos do defensor;
  `classifyEffectiveness`: `'super'`/`'neutral'`/`'weak'`/`'immune'`).
- `resolveSkillType`, `resolveSpeciesTypes`, `resolveTypeMultiplier`,
  `isImmuneToStatusSkill` (`skill.immuneTypes`).
- `IMPACT_TYPES` continua separado; `resolveAttackImpactType` agora lê
  `visual.impactType`, senão `attack.type`.

### Conteúdo

- `skill.type` no topo de todo golpe e dos básicos das espécies (`damage.type`
  saiu); `immuneTypes: ['grass']` no Leech Seed; `species.types` nas 3
  iniciais. `_template`s de skill e espécie documentam os campos.

### Dano (`core/battle/calculateDamage.js`)

- O contexto da conta ganhou `attackType`; `resolveTypeEffectivenessMultiplier`
  lê a tabela; `resolveStab` lê `GAME_CONFIG.TYPES.STAB_MULTIPLIER`.
- `resolveDamageAmount`/`resolveChannelTickDamage` devolvem também
  `effectiveness` (`resolveDamageEffectiveness`).
- Calculadora da wiki (`tools/wiki/damageCalculator.js`) passa o tipo — os
  números já saem com STAB/efetividade.

### Impacto, eventos e imunidade

- `attackResolved` ganhou `effectiveness` e `channelTick`.
- Imune (`attackImpact`, `attackChannelTick`): sem dano, sem efeitos, sem
  participação no XP; o evento sai como `'hit'` com `effectiveness:
  'immune'` (a selvagem ainda se provoca). Golpe de status com
  `immuneTypes` (`applyAttackEffects`): idem, sem efeito.
- Domínio (`moveMasteryUse`): golpe imune não conta como acerto.

### Feedback (view)

- `damageNumberSystem`: "Super efetivo!" / "Pouco efetivo…" / "Não afeta…"
  (`formatEffectiveness`, cores em `FEEDBACK.EFFECTIVENESS_COLORS`); imune sem
  número de dano; no canalizado, só no primeiro tick.
- `hitFlashSystem`/`hitStopSystem` ignoram o imune.

### IA (`core/battle/aiAttackChoice.js`)

- `scoreAiAttack`: valor em cada atingido × `resolveTypeFactor` (dano: STAB ×
  efetividade; status: 0 se o alvo é de um tipo em `immuneTypes`).
  `resolveCombatantSpecies` (`attackTargets.js`) passou a ser exportada.

### HUD e menus

- `TypeBadge`/`TypeBadges` (`view/shared/statusDisplay.jsx`): no
  `StatusHud`, no `PartyHud` e na tela de status da Pokédex (`StatsScreen`).
  A etiqueta acima da cabeça (`NameplateView`) NÃO mostra tipo (decisão do
  usuário): o tipo de uma criatura só se descobre pela Pokédex ou pelo HUD do
  time.
- Selo do tipo ao lado do nome do golpe no menu de ações (Treino e Golpes) e
  na aba Time da Pokédex; borda do slot na cor do tipo (`SkillSlot` —
  `SkillsHud` e `ActionSlotHud`).

### Constantes

`GAME_CONFIG.TYPES.STAB_MULTIPLIER`; `GAME_CONFIG.FEEDBACK.EFFECTIVENESS_COLORS`.

### Log de batalha (Parte 2, pedido do usuário)

Um "chat" de log com os avisos da batalha, como nos jogos de turno
("Charmander usou Ember!", "Bulbasaur selvagem perdeu 12 de HP. É super
efetivo!", "Bulbasaur selvagem desmaiou!" — exemplos fictícios).

- Eventos novos no core: `attackUsed` (`resolveAttackImpact`, no `effectAt`,
  antes da falha/resultado — um por lançamento) e `creatureFainted`
  (`faintSystem`, antes da divisão de XP).
- `view/shared/battleLogFormat.js` (puro): evento → linhas `{ text, color }`.
  Golpe usado, falhou, acerto (dano, crítico, efetividade), errou, não acertou
  ninguém, não afeta, semeado (Leech Seed), atributo subiu/caiu (muito),
  interrompido, drenagem da semente, desmaio, XP, nível, golpe apto e
  aprendido. Selvagem leva "selvagem" no nome. Canalizado: uma linha só, no
  primeiro tick. Treino nunca entra; o básico só com
  `FEEDBACK.BATTLE_LOG.INCLUDE_BASIC_ATTACKS` (desligado — afogaria as
  habilidades).
- `view/registry/battleLogStore.js` (estado só da view): as últimas
  `MAX_LINES` linhas; apaga depois de `IDLE_FADE_TIME` sem mensagem. O
  snapshot só muda com linha nova ou ao apagar — o HUD não re-renderiza por
  frame.
- `battleLogSystem` (presentation, depois do `damageNumberSystem`) e
  `tools/hud/BattleLogHud.jsx` (canto inferior esquerdo, linha nova entra
  deslizando), montado no `GameHud`.
- Constantes: `GAME_CONFIG.FEEDBACK.BATTLE_LOG`.

### Visual toon com contorno (Parte 3, feito pelo usuário, revisado)

Materiais toon (luz em tons chapados, brilho de borda) e contorno da
silhueta por casca invertida, em `view/materials/toonMaterial.js`, aplicados
por `useAnimatedModel.js`; liga/desliga e ajustes em `GAME_CONFIG.RENDER`.

Ajustes da revisão (regras de docs/rules/README.md):

- **Dispose (5.3):** `applyToonLook` devolve o cleanup do efeito — tira os
  contornos, libera os toons criados e devolve o material original (antes
  vazava um material por mesh a cada spawn/recolhida, e o StrictMode
  convertia toon em toon).
- **Rim e contorno sumiam no primeiro golpe:** o `clone()` do three (hit
  flash, tint) não copia `onBeforeCompile`/`customProgramCacheKey` da
  instância. Viraram classes (`ToonRimMaterial`, `OutlineMaterial`), que o
  clone recria pelo construtor. O `hitFlashSystem` também pula o contorno.
- **Número mágico:** a faixa do rim no shader foi pra `RENDER.RIM_EDGE`.
- `receiveShadow` só desliga com `TOON` ligado — `TOON: false` volta ao
  visual antigo de verdade.
- Formatação (lint) do hook e do arquivo; testes em `toonMaterial.test.js`.

### Queimadura (Parte 4, pedido do usuário)

Efeito secundário do Ember e do Flamethrower: chance de QUEIMAR o alvo (regra
clássica). Os outros golpes ficam sem efeito secundário por enquanto (o
usuário ainda não definiu).

Decisões do usuário:

1. **Dura por tempo** e renova se queimar de novo (como a semente) — não há
   item/centro pra curar ainda.
2. **Corta o Ataque** de quem está queimado (só golpe físico), com o fator
   num parâmetro da PRÓPRIA skill (`attackMultiplier` no efeito), que a
   espécie pode trocar pelos `overrides` (`effects` inteiro).
3. **Visual:** reaproveita o fogo do Ember.

Implementação:

- Efeito `{ type: 'burn', chance, fraction, interval, duration,
  attackMultiplier, immuneTypes }` em `effects` (documentado no `_template`);
  Ember e Flamethrower com `immuneTypes: ['fire']`.
- `Burn` + relação `BurnedBy` (crédito do XP), `queimar` (sorteia a chance
  com o `gameplayRng`, imunidade pelo tipo do alvo, renova),
  `readBurnAttackMultiplier`, `resolveBurnDamage` (`core/actions/burn.js`).
- `burnSystem` (simulation, antes do `faintSystem`): fração do HP máximo a
  cada intervalo, evento `burnDamaged`; apaga no fim do tempo ou no desmaio.
  Dano passivo: não provoca nem interrompe.
- `computeDamage`: `attackerBurnMultiplier` multiplica o Ataque só no golpe
  físico (golpe normal e tick de canal passam o de quem ataca).
- **Efeito secundário de golpe de dano** (`applySecondaryEffects`): só no alvo
  que levou o dano, sem sortear a precisão de novo e sem um segundo
  `attackResolved` (antes, dano + efeito passava por `applyAttackEffects`,
  que fazia as duas coisas). No canalizado, cada alvo sorteia UMA vez por
  lançamento (`ActionState.channelEffectTargets`) — o canal vale um golpe.
  Evento `burnApplied` quando queima.
- IA e custo: `evaluateBurnEffect` / peso `burn` (`AI_ATTACK.BURN_VALUE` ×
  `chance`); tipo imune vale 0.
- View: número do dano a cada tick, linhas no log ("X foi queimado!", "X
  sofre com a queimadura (N de HP)!"), selo "QUEIMADO"
  (`ConditionBadges`/`useConditions`, cores em
  `FEEDBACK.CONDITION_COLORS`) na etiqueta e nos HUDs, e o fogo no corpo
  (`StatusConditionEffectsView` + `burnVfx.js`, texturas e cores do Ember).
- Wiki: `describeEffect` já descreve a queimadura (o texto das páginas fica
  pro fim da feature).

### Fim do ataque básico (Parte 5, decisão do usuário)

Mais parecido com os clássicos: a criatura só tem os GOLPES (Q/E/R). O
`basicAttack` saiu das espécies (os `basicAttack.js` foram apagados) e do
código.

Decisões do usuário:

1. **Clique esquerdo só confirma a mira** (`castMode: 'confirm'`); fora disso
   não faz nada. Continuam 3 golpes por criatura.
2. **Sem assistência de mira**: todo golpe sai pra onde a câmera aponta
   (`resolveAttackDirection` virou só o giro horizontal da câmera;
   `BATTLE.MELEE_AIM_HALF_ANGLE` saiu). O campo `aim` da skill continua — a IA
   usa pra manter distância com golpe `'ranged'`.
3. **A Velocidade acelera os golpes**: `duration`/`effectAt` de todo golpe
   escalam pelo `speed` da criatura (antes, só o básico), além da recarga.

O que mudou:

- `resolveCreatureAttack` não resolve mais `'primary'`; `ATTACK_SLOTS` é só
  Q/E/R; `AttackCooldowns.primary` saiu; `WantsToAttack.slot` sem padrão (a IA
  sempre pede um golpe); `withActionCost` sem o caso "básico sem recarga".
- IA sem golpe pronto (recarga/energia): fica no MENOR alcance entre os golpes
  dela (`resolveAttackReach(entity, species, body)`), em vez do alcance do
  básico. Sem energia pra nada, descansa (como já fazia).
- Som: chave sempre o id do golpe (`resolveAttackSoundKey(attack)`).
- HUD: o slot do clique só aparece com o treinador (item na mão).
- Log: `FEEDBACK.BATTLE_LOG.INCLUDE_BASIC_ATTACKS` saiu.
- Wiki (código): sem a linha "Ataque básico" nos catálogos/calculadora e sem
  o ângulo de assistência. O TEXTO das páginas ainda cita o básico — entra na
  atualização da wiki do fim da feature (MovesPage, EnergyPage,
  MoveTrainingPage, StatusPage, CatalogMoves, AccuracyPage).
- Testes: o "golpe de referência" dos testes de mecânica é o golpe de dano
  corpo a corpo do kit da espécie (derivado, sem fixar qual); mudanças de
  golpe nos testes vão por `skills[N].overrides`.

### Wiki (só no fim da feature)

Seção "Tipos" da página de dano com a regra real; página nova "Tipos" com a
tabela; tipo no catálogo de criaturas e de golpes; a calculadora mostrando
STAB e efetividade.

---

## Fora de escopo

- Habilidades (abilities) que mudam tipo/imunidade (Levitate, Flash Fire…).
- Golpes de tipo variável, troca de tipo, terreno/clima.
- Resistência a status por tipo (Fogo não queima etc.) — não existe status
  de condição ainda.

---

## Etapas

- [x] Bump da versão para `0.0.39` e doc da feature.
- [x] Revisão do doc pelo usuário (decisões acima).
- [x] Dados de tipo (`core/data/types/`) e tabela da Gen 1.
- [x] `skill.type` no topo (migrar `damage.type`), `_template`s e conteúdo
      das espécies/golpes.
- [x] Efetividade e STAB no dano (golpe, canal, calculadora).
- [x] Imunidade (dano e `immuneTypes` dos golpes de status).
- [x] Evento + feedback ("Super efetivo!"…).
- [x] IA considerando tipo.
- [x] HUD/menus/Pokédex com os tipos.
- [x] Testes (regras: tabela íntegra, combinação de dois tipos, STAB,
      imunidade — sem fixar números da config).
- [x] Log de batalha (Parte 2).
- [x] Visual toon com contorno (Parte 3), revisado.
- [x] Queimadura do Ember/Flamethrower (Parte 4).
- [x] Fim do ataque básico (Parte 5).
- [x] Wiki (versão `0.0.x`, atualizada no lugar): página nova **Tipos** (o
      que é, mesmo tipo, forte/fraco/imune, tabela, onde ver o tipo); Dano
      com mesmo tipo e efetividade na conta e nos exemplos; Efeitos em batalha
      com a **Queimadura**; Golpes sem o ataque básico, sem mira automática e
      com o **Registro da batalha**; tipo nas listas e fichas do catálogo
      (criaturas e golpes, com os tipos em que um golpe de status não pega);
      calculadora com tipo, mesmo tipo e efetividade; Energia (peso da
      queimadura), Status/Golpes e treino/Acerto/Como lutam/Pokédex sem o
      básico e com o tipo. Dados novos no retrato (`types`, `burn`, tipo de
      criatura/golpe, `TypeTag`).

### Falta conferir em jogo (pelo usuário)

- Sem básico: o clique só confirma a mira; golpes saem pra onde a câmera
  aponta; criatura rápida ataca mais rápido; a IA (selvagem/time) continua
  lutando só com os golpes e descansa sem energia.

- Queimadura: fogo no corpo (tamanho/quantidade), selo "QUEIMADO", número a
  cada tick e as linhas do log; o Charmander/fogo nunca queima; o dano físico
  de quem está queimado cai.

- Visual toon: o rim e o contorno continuam depois de a criatura apanhar
  (antes sumiam), e invocar/recolher várias vezes não acumula nada.

- Log de batalha: posição (canto inferior esquerdo), tamanho, quantidade de
  linhas e o tempo até apagar.

- Selos de tipo nos HUDs do time e na Pokédex (tamanho/legibilidade).
- Borda colorida dos slots de golpe.
- "Super efetivo!" / "Pouco efetivo…" / "Não afeta…" (ex.: Ember no
  Bulbasaur, Vine Whip no Charmander, Leech Seed no Bulbasaur).
- IA preferindo o golpe efetivo (o Charmander selvagem agora puxa mais o
  Ember, que tem STAB).

---

## Critérios de Conclusão

- [x] Toda espécie jogável e todo golpe têm tipo (ou caem no fallback
      documentado).
- [x] Golpe do mesmo tipo do atacante rende STAB; a efetividade combina os
      dois tipos do defensor.
- [x] Super efetivo / pouco efetivo / imune aparecem em texto no impacto e
      no registro da batalha.
- [x] A IA prefere golpe efetivo e não usa golpe imune.
- [x] Os tipos aparecem no HUD do time, nos golpes e na Pokédex (não na
      etiqueta das selvagens).
- [x] Queimadura com chance, dano por tempo e Ataque físico cortado; tipo
      Fogo não queima.
- [x] Sem ataque básico: só golpes, o clique confirma a mira.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      143 arquivos, 1523 testes, com `--maxWorkers=2`; build feito numa cópia,
      por causa do `next dev` rodando — 49 páginas, 39 da wiki `0.0.x`).
