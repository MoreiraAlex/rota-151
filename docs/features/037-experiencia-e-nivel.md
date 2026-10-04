# 🚀 Versão 0.0.37 — Experiência e nível

## Resumo

As criaturas passam a **ganhar XP** quando derrubam uma selvagem e **sobem de
nível**. Ao subir de nível, os status são recalculados e a vida e a energia
crescem junto. Pra isso, o nível deixa de ser **da espécie**
(`species.level`, igual pra todo Bulbasaur) e vira **de cada criatura**,
seguindo o mesmo caminho do IV: a selvagem guarda o próprio nível na
entidade, e a criatura do time guarda por slot no treinador.

Versão: `0.0.37` (`package.json`). Branch: `feature/037-experiencia-e-nivel`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config/espécie).

---

## Decisões (com o usuário)

1. **Quem ganha XP:** toda criatura do time que **causou dano** à selvagem
   durante a luta (golpe, tick de golpe canalizado, roubo de vida). O XP é
   **dividido igualmente** entre elas. Criatura desmaiada na hora do
   nocaute não ganha nada. Tanto faz se ela está em campo ou já foi
   recolhida pra bola: o XP vai pro slot.
2. **Fórmula de XP ganho: escalada (Gen 5):**
   `XP = (XP base da derrotada × nível da derrotada ÷ 5) × ((2·Nd + 10) ÷ (Nd + Nv + 10))^2,5 + 1`
   (Nd = nível da derrotada, Nv = nível de quem ganha; depois disso, dividido
   pelo número de participantes). Vencer quem tem nível mais alto rende mais
   e vencer quem é mais fraco rende menos, o que segura o farm na selvagem
   que acorda depois de desmaiar.
3. **Curva de nível por grupo de crescimento** (XP total pra estar no nível
   `n`), cada espécie escolhe o seu (`growthRate`). As seis curvas clássicas
   ficam disponíveis (rápido, médio-rápido, médio-lento, lento, errático,
   flutuante); os iniciais usam médio-lento:
   `XP(n) = 1,2·n³ − 15·n² + 100·n − 140`. Nível máximo em config.
   Todas as curvas são multiplicadas por `CURVE_MULTIPLIER` (ver decisão 6).
4. **Ao subir de nível:** os status são recalculados, e o HP e a energia
   **atuais** sobem o mesmo tanto que o máximo subiu. Subir vários níveis de
   uma vez é permitido (aplica um por um).
5. **Nível das selvagens:** cada entrada de spawn tem uma **faixa
   mín–máx**, e o nível é sorteado no spawn com o `gameplayRng`, como o IV.
6. **Ritmo pela curva, não pelo ganho** (ajuste depois de jogar: subir de
   nível estava fácil demais). A curva é o "preço" dos níveis e vale pra
   qualquer fonte de XP (batalha, item futuro); o ganho de batalha
   (`BASE_DIVISOR`) só mexe na renda da batalha. Por isso o ritmo do jogo
   inteiro é controlado pelo multiplicador global da curva
   (`CURVE_MULTIPLIER`), que preserva o formato e a diferença entre os
   grupos. Itens de XP futuros devem ser pensados em relação à curva (ex.:
   "+1 nível") pra não quebrar o balanceamento.
7. **Teto 50, fórmulas na escala 100.** O nível máximo do jogo é 50
   (`MAX_LEVEL`), pra a progressão não ficar maçante, e a curva ficou mais
   cara (`CURVE_MULTIPLIER`) pra cada nível — e, no futuro, cada evolução —
   valer mais. As fórmulas da série (status, dano, custo de energia, CP)
   foram feitas pra teto 100, então recebem o nível convertido
   (`resolveFormulaLevel`, `core/data/species/formulaLevel.js`:
   `nível × 100 ÷ MAX_LEVEL`): uma criatura no nível máximo tem os status de
   uma nível 100 da série, e o balanceamento continua valendo. XP ganho,
   curva e tudo que o jogador vê continuam no nível do jogo. Efeito
   colateral: o nível inicial vale o dobro nas fórmulas, então os iniciais
   nascem um pouco mais fortes do que antes.

### Exemplo (fictício)

| Sua criatura | Derrotou Bulbasaur (XP base 64) | XP ganho |
|---|---|---|
| Nv. 5 | Nv. 5 | 65 |
| Nv. 10 | Nv. 5 | 37 |
| Nv. 5 | Nv. 10 | 202 |
| 2 participantes Nv. 5 | Nv. 5 | 32 cada |

---

## Arquitetura

### Dados da espécie

- `species.baseXp` — XP base que ela rende ao ser derrotada.
- `species.growthRate` — id do grupo de crescimento.
- `species.level` muda de papel: passa a ser o **nível inicial** de quem
  entra no time (`equiparCriatura`). Ninguém mais lê esse campo como "o
  nível desta criatura".
- `_template/index.js` documenta os dois campos novos.

### Fórmulas (`core/data/species/experience.js`, puro)

- `experienceForLevel(growthRate, level)` — XP total do nível (curvas).
- `levelForExperience(growthRate, xp)` — nível de um total de XP (teto
  `MAX_LEVEL`).
- `calculateExperienceGain({ baseXp, defeatedLevel, winnerLevel })` —
  fórmula escalada (Gen 5).
- `resolveLevelProgress(growthRate, level, xp)` — fração 0–1 até o próximo
  nível (anel de XP do HUD).

### Estado

- **`CreatureLevel({ level, xp })`** — novo trait, na entidade de toda
  criatura (selvagem e invocada). Escrito no spawn
  (`wildCreatureSpawnSystem`, `summonBallSystem`) e pela action de ganhar XP.
- **`PartyProgress`** — novo trait no treinador, por slot (`null` | `{ level,
  xp }`), mesmo formato de `PartyIndividualValues`. É a fonte de verdade da
  criatura do time: `equiparCriatura` cria com o nível inicial da espécie,
  `summonBallSystem` copia pra `CreatureLevel` ao invocar e a action de XP
  atualiza os dois (slot + entidade em campo, se existir).
- **`FoughtBy`** — `relation()` da selvagem pro treinador, com os slots que
  causaram dano. Marcada no dano (`damageTarget`, ticks canalizados, roubo de
  vida); limpa quando a selvagem desmaia e o XP é distribuído. **Não** limpa
  ao sair do modo combate: a selvagem pacífica que só foge nem entra nele, e
  perderia o registro no meio da perseguição. Usar relation (e não um id)
  segue a regra de grafo de entidade e já prepara pra mais de um treinador
  no multiplayer.

### Fluxo

1. A selvagem chega a 0 de HP → `faintSystem` chama `desmaiar` (como hoje)
   e, logo depois, `distribuirExperiencia(world, events, selvagem)`.
2. `distribuirExperiencia` lê `FoughtBy`, descarta slot vazio/desmaiado,
   calcula o XP de cada participante pelo próprio nível dele, divide e
   chama `ganharExperiencia(trainer, slot, amount)`.
3. `ganharExperiencia` soma o XP e, se o nível mudou, chama `subirDeNivel`:
   recalcula `maxHp`/`maxStamina` e soma a diferença no atual, tanto no
   `Vitals` da entidade em campo quanto no `PartyVitals` guardado na bola.
4. Eventos tipados `experienceGained` e `leveledUp` (com os payloads
   documentados em `core/events/index.js`) → a view mostra o feedback.

### Quem lê o nível (troca `species.level` → nível do indivíduo)

Todas as funções que recebiam `(species, individualValues)` e liam
`species.level` ganharam um parâmetro `level` (opcional — sem ele, cai no
`species.level`, que é o que a wiki e os testes antigos usam):
`resolveCreatureStats`, `resolveMaxHp`/`resolveMaxStamina`/
`vitalsFromSpecies`/`resolveMovementCosts` (`vitals.js`),
`resolveCombatStats` (`calculateDamage.js`), `resolveSpeedFactor`/
`resolveAttackForEntity` (`attackCasting.js`), `scanning.js` e os
chamadores (IA, HUD, sistemas de ataque). Um helper
`resolveEntityLevel(entity)` lê `CreatureLevel`, com fallback pro
`species.level` (treinador e testes antigos).

### Interface

- **HUD** (`StatusHud`, `PartyHud`), **placa de nome** (`NameplateView`) e
  **tela de status** (`StatsScreen`): `Lv.` e o anel de XP passam a vir do
  indivíduo (`CreatureLevel`/`PartyProgress`). `resolveXpPercent(species)`
  vira `resolveLevelProgress`; o `species.xp` de exibição sai.
- **Feedback:** texto flutuante "+N XP" em cima de cada participante em campo
  e "Nível N!" ao subir (`damageNumberSystem.js`, mesmo mecanismo do
  "Errou!"), e o brilho de atributo subindo na criatura ao subir de nível
  (`hitFlashSystem.js`). A criatura que está na bola não mostra nada (só o
  HUD do time muda).
- **Debug:** linha por slot no `DebugPanel` com nível/XP e botão "+XP"
  (`DEBUG_XP_AMOUNT`). O painel não tem a fila de eventos do loop, então pelo
  botão não aparece o texto flutuante — só o estado muda (HUD, placa).

### Constantes (`gameConfig.js`, grupo `EXPERIENCE`)

`MAX_LEVEL`, multiplicador da curva (`CURVE_MULTIPLIER`), expoente da
escala (`SCALING_EXPONENT`), divisor (`BASE_DIVISOR`), fallbacks
(`FALLBACK_BASE_XP`, `DEFAULT_GROWTH_RATE`), a faixa de nível padrão das
selvagens (`WILD_LEVEL_MIN`/`WILD_LEVEL_MAX`, usada quando a entrada de
spawn não traz `levelRange`) e o XP do botão de debug (`DEBUG_XP_AMOUNT`).
Cores do texto em `FEEDBACK.XP_COLOR`/`LEVEL_UP_COLOR`.

---

## Fora de escopo

- Aprender golpe novo ao subir de nível — no backlog.
- Evolução — no backlog.
- EV ganho por vitória (os EVs continuam fixos na espécie).
- XP pro treinador e XP de captura (captura ainda não existe).
- Persistência de nível/XP (não existe save ainda; reiniciar o jogo volta ao
  nível inicial).

---

## Etapas

- [x] Bump da versão para `0.0.37` no `package.json`.
- [x] `experience.js` (curvas + fórmula de ganho) com testes de regra
      (curva cresce, `levelForExperience` inverte `experienceForLevel`,
      vencer nível maior rende mais).
- [x] `baseXp`/`growthRate` nas espécies + `_template`.
- [x] Traits `CreatureLevel`, `PartyProgress`, relation `FoughtBy`.
- [x] Nível sorteado das selvagens no spawn; nível inicial do time em
      `equiparCriatura`; cópia na invocação.
- [x] Trocar todos os leitores de `species.level` pelo nível do indivíduo.
- [x] Marcar participantes no dano; actions `distribuirExperiencia`,
      `ganharExperiencia`, `subirDeNivel`; ligação no `faintSystem`.
- [x] Eventos `experienceGained`/`leveledUp`.
- [x] HUD/placa/tela de status lendo nível e anel de XP do indivíduo.
- [x] Texto flutuante de XP/nível.
- [x] Botão de debug "+XP".
- [x] Wiki `0.0.37`: a 0.0.36 congelada (`data.json`, gerado a partir de uma
      cópia do último commit, que ainda tinha as regras antigas); página nova
      "Experiência e nível" (quem ganha, fórmula, curvas, subir de nível,
      nível de cálculo); Status, Dano e Energia explicam o nível de cálculo;
      catálogo mostra nível inicial, XP base e grupo de crescimento; Seu
      time e Selvagens citam o nível.

---

## Critérios de Conclusão

- [x] Derrubar uma selvagem dá XP a quem causou dano, dividido, pela fórmula
      escalada.
- [x] Subir de nível recalcula status; HP/energia atuais sobem a diferença.
- [x] Duas criaturas da mesma espécie podem ter níveis diferentes (selvagem
      sorteada na faixa; time progride por slot e mantém o nível ao
      recolher/invocar).
- [x] Nenhum leitor de nível de batalha usa mais `species.level` direto.
- [x] HUD, placa e tela de status mostram nível e XP do indivíduo.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      130 arquivos, 1408 testes; build feito numa cópia, por causa do
      `next dev` rodando — 83 páginas, as duas versões da wiki incluídas).

---

## Arquivos principais

- `core/data/species/experience.js` — curvas, fórmula de ganho,
  `createLevelState`, `rollWildLevel` (+ testes).
- `core/data/species/formulaLevel.js` — `resolveFormulaLevel` (+ testes),
  usada em `stats.js`, `calculateDamage.js`, `attackCasting.js` e
  `levelCost.js`.
- `core/traits/components/creatureLevel.js` — `CreatureLevel`,
  `PartyProgress`, `FoughtBy`, `resolveEntityLevel`.
- `core/actions/experience.js` — `registrarParticipante`,
  `distribuirExperiencia`, `ganharExperiencia`, `subirDeNivel` (+ testes).
- `core/events/index.js` — `experienceGained`, `leveledUp`.
- Leitores de nível: `stats.js`, `vitals.js`, `calculateDamage.js`,
  `attackCasting.js`, `attackTargets.js`, `attackImpact.js`,
  `attackChannelTick.js`, `attackStatusEffects.js`, `aiAttackChoice.js`,
  `aiMovement.js`, `creatureAttackSystem.js`, `scanning.js`.
- Spawn/time: `wildCreatureSpawnSystem.js`, `summonBallSystem.js`,
  `actions/party.js`, `world/world.js`, `test/makeWorld.js`.
- Desmaio/dano: `faintSystem.js`, `leechSeedSystem.js`.
- Interface: `statusDisplay.jsx` (`resolveXpPercent`/`resolveDisplayLevel`),
  `StatusHud.jsx`, `PartyHud.jsx`, `SkillsHud.jsx`, `NameplateView.jsx`,
  `StatsScreen.jsx`, `TeamTab.jsx`, `HistoryTab.jsx`,
  `damageNumberSystem.js`, `hitFlashSystem.js`, `DebugPanel.jsx`.
- Espécies: `baseXp`/`growthRate` em bulbasaur/charmander/squirtle e no
  `_template` (o `xp` de exibição saiu do template).
