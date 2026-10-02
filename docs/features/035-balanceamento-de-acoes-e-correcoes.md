# 🚀 Versão 0.0.35 — Balanceamento de ações e correções

## Resumo

Recarga (cooldown) e custo de energia coerentes em todas as ações — ataques
(básico e habilidades), corrida, dash e pulo — pra criaturas e treinador.
Hoje os números foram nascendo um por feature e não conversam entre si: a
energia quase não pesa, um golpe de poder 40 custa o mesmo que o básico de
poder 5, e status que dura 60s recarrega em 1s.

Versão: `0.0.35` (`package.json`).

> **Números deste doc são fictícios (ilustrativos).** Servem pra mostrar a
> ordem de grandeza e o raciocínio na época da feature — o valor de verdade
> é sempre o do campo citado (`gameConfig`, espécie, skill), que pode mudar
> a qualquer momento, inclusive em outras features, sem este doc ser
> atualizado.

---

## Diagnóstico (números da época, antes da 035)

### Energia e regeneração

| Quem | Energia | Regen | Atraso do regen | Corrida | Pulo | Dash |
|---|---|---|---|---|---|---|
| Charmander / Bulbasaur / Squirtle (nível 5) | 22–25 (`calculateEnergyStat`: (hp + defesa + sp_def) ÷ 3 + 10; varia com espécie, IV e nível) | 45%/s (~10/s) | 2s | 0.25/s | 1 | 1 |
| Treinador (`boy`) | 80 | 10%/s (8/s) | 3s | 2/s | 4 | 1 |

- Dash: custo único global (`PLAYER_ACTIONS.dash.STAMINA_COST` = 1), sem
  recarga pro jogador; a IA tem `AI_MOVEMENT.DASH_INTERVAL` (4s).
- Custo de corrida e dash × até 8 com a vida baixa (`STAMINA_BY_HP`, 034).

### Golpes (custo / recarga / poder)

| Espécie | Slot | Golpe | Custo | Recarga | Poder / efeito | Duração |
|---|---|---|---|---|---|---|
| todas | básico | `*-basic` | 0.25 | 0 | 5 | ~0.8s |
| Charmander | Q | Growl | 2 | 1s | −1 ataque, 60s, cone | 1.2s |
| Charmander | E | Tackle | 0.25 | 2s | 40 | 1s |
| Charmander | R | Ember | 4 | 2s | 40, alcance 8 | 1s |
| Bulbasaur | Q | Growl | 2 | 1s | −1 ataque, 60s, cone | 1.2s |
| Bulbasaur | E | Leech Seed | 3 | 1s | 1/16 da vida a cada 2s, 6s | 1.2s |
| Bulbasaur | R | Vine Whip | 0.25 | 2s | 45 | 0.8s |
| Squirtle | Q | Tackle | 0.25 | 2s | 40 | 1s |
| Squirtle | E | Water Gun | 2 | 1s | 40 (canal 2.5s) | 2.5s |
| Squirtle | R | Tail Whip | 2 | 1s | −1 defesa, 60s, cone | 1s |

Outras skills cadastradas (fora dos slots hoje): Flamethrower (4 / 2s / 90
canal), Razor Leaf (2 / 2s / 55 canal), Whirlpool (4 / 2s / 35), Smokescreen
(3 / 1s / −1 precisão 30s), Growth (2 / 1s / +1 ataque e sp_atk 60s), Punch
(0.25 / 2s / 5).

### O que está incoerente

1. **A energia quase não pesa.** Com ~23 de energia e 45%/s de regen, o golpe
   mais caro (4) é ~17% da barra e volta em menos de 0.5s de regen — só o
   atraso de 2s segura alguma coisa. Correr a 0.25/s esvazia a barra em ~90s.
   (Energia por espécie no nível 5: Charmander 22–23, Bulbasaur 23–25,
   Squirtle 23–25, de IV 0 a 31. Cresce com o nível — ~10× no nível 50.)
2. **Custo não acompanha o poder.** Tackle (40) e Vine Whip (45) custam 0.25,
   igual ao básico (5); Ember (40) custa 4 — 16× o Tackle com o mesmo poder.
3. **Recarga invertida.** Status de 60s (Growl, Tail Whip) recarrega em 1s;
   golpe de dano em 2s. Leech Seed (dura 6s) recarrega em 1s.
4. **Treinador × criatura em escalas diferentes.** Treinador corre a 2/s e
   regenera 8/s; criatura corre a 0.25/s e regenera 45/s — sem relação.
5. **Dash igual pra todos e sem recarga pro jogador**, enquanto a IA tem 4s.
6. Os overrides por espécie (`skills[N].overrides`) mudam duração/alcance, mas
   ninguém revisou custo/recarga junto.

---

## Proposta (pra discutir)

**Modelo por mecanismo, igual à IA da 034** — custo e recarga saem dos campos
da skill (poder, canal, área, efeitos), com override explícito quando uma skill
precisar fugir da regra. Skill nova não exige número novo.

- **Barra de energia como orçamento de luta**: barra cheia ≈ 5–6 habilidades
  seguidas; regen bem mais lento (ex.: ~8%/s depois de 2s → cheia em ~12s
  parado). O básico continua quase de graça — sempre há algo pra fazer sem
  energia.
- **Custo pelo impacto**: dano → proporcional ao `power` (ex.: 40 → ~12);
  canal → pelo poder total; status/efeito → pelo valor do efeito (o mesmo
  `AI_EFFECT_EVALUATORS` da IA pode servir de régua).
- **Recarga pela duração do efeito/impacto**: dano forte recarrega mais; status
  de 60s não pode voltar em 1s (ex.: recarga ≥ alguns segundos, ou só quando o
  efeito estiver perto de acabar — a IA já faz isso pela nota).
- **Movimento na mesma escala**: corrida em energia/s que esvazie a barra em
  ~20–30s; dash como "meia habilidade" (custo + recarga curta, jogador e IA);
  pulo barato.
- **Treinador** na mesma régua, com a barra dele.

Números finais só depois das decisões abaixo e de testar jogando.

---

## Decisões do usuário

1. **Energia é recurso de verdade**: barra cheia ≈ 5–6 habilidades seguidas,
   regen lento (~12s pra encher parado).
2. **Básico com custo simbólico** (não grátis): pouco, mas soma com corrida e
   dash e atrasa o regen.
3. **Dash com recarga pra todos** (jogador e IA, mesma regra), além do custo
   de energia.
4. **Custo e recarga por fórmula, com override por skill**, adaptada da
   fórmula de dano (pedido do usuário: "pegar a fórmula de dano, que já escala
   por nível, status do pokémon e do ataque"):
   - **peso** do golpe — o "poder" da conta: o `power` nos golpes de dano, o
     valor do efeito nos de status (`STAT_STAGE_VALUE` 25 por estágio,
     `LEECH_SEED_VALUE` 35 — a mesma régua da IA, 034). Só define o preço;
     o dano não muda.
   - **custo** = `(2·nível/5 + 2) × peso / 50` — o fator de nível do dano
     (o custo cresce com o nível junto com a barra); sem `ataque/defesa` (o
     custo é de quem usa, não do alvo; a energia de quem usa fica fora, então
     barra maior = mais habilidades); sem o `+2` (senão o básico custaria
     quase como um golpe fraco). No nível 5: básico 0.4, Tackle 3.2 (~14% da
     barra de ~23), Flamethrower 7.2 (~31%). Tackle do Charmander: 14% no
     nível 5, ~21% no 50, ~22% no 100.
   - **recarga** = `peso × 0.075s × fator de velocidade` — sem fator de nível
     (é tempo); o `speed` no papel do `ataque/defesa`, pelo mesmo fator que já
     encurta o básico (`calculateAttackDurationFactor`, 028). Tackle ≈ 3s.
   - Os números (`/50`, `0.075s`) ficam no `gameConfig`; `staminaCost` /
     `cooldown` escritos na skill (ou no override da espécie) valem por cima
     da fórmula.
5. **Peso com bônus**: à distância (alcance ≥ 5m) × 1.25, cone × 1.3 — Ember
   (40, 8m) pesa 50 e custa mais que o Tackle (40, corpo a corpo).
6. **Movimento das criaturas pelo mesmo fator de nível**: corrida (por
   segundo), dash e pulo têm um peso fixo no `gameConfig` e passam pela
   mesma conta dos golpes. Recarga do dash fixa, igual pra todos.
7. **Treinador com números próprios**: mantém a barra dele (80) e ganha
   corrida/dash/pulo fixos coerentes — ele não luta, não precisa da fórmula.

## Como funciona

**Golpes** — `core/battle/actionCost.js`, aplicado em
`resolveAttackForEntity` (`attackCasting.js`), por onde passam o disparo, a
IA, o desvio e o HUD:

1. **Peso** (`resolveAttackWeight`): `damage.power` (no canal, o total) + o
   peso de cada efeito (`EFFECT_WEIGHTS`: `statStage` 25 por estágio,
   `leechSeed` 35 — a régua da IA, valor cheio), × `CONE_BONUS` (1.3) em
   cone (área ou canal em cone), × `RANGED_BONUS` (1.25) com alcance ≥
   `RANGED_MIN_RANGE` (5m; golpe em si mesmo não conta). Nunca olha o id.
2. **Custo** (`resolveLevelCost`, `core/battle/levelCost.js`):
   `(2·nível/5 + 2) × peso / COST_DIVISOR` (50).
3. **Recarga** (`resolveAttackCooldown`): `peso × COOLDOWN_PER_WEIGHT`
   (0.075s) × fator de velocidade (`resolveSpeedFactor` — o mesmo que
   encurta o básico). O básico não tem recarga.
4. **Override** (`withActionCost`): `staminaCost`/`cooldown` escritos na skill
   ou no `skills[N].overrides` da espécie ganham da fórmula. Os números
   antigos saíram de todas as skills e dos básicos; o `_template` de skill
   documenta a fórmula.

**Movimento** — `resolveMovementCosts` (`traits/components/vitals.js`),
copiado no `Vitals` pelo `vitalsFromSpecies`:
- criatura com status (`kind: 'pokemon'` + `stats.energy`): pela mesma
  `resolveLevelCost`, com `RUN_WEIGHT_PER_SECOND` (12), `DASH_WEIGHT` (20) e
  `JUMP_WEIGHT` (5);
- treinador (e espécies não migradas): `species.vitals` — o `boy` corre a
  3.2/s (barra de 80 em ~25s), dash 8 (10%), pulo 4 (5%).
- `Vitals.dashStaminaCost` é novo; `resolveDashCost` = ele × vida baixa
  (`PLAYER_ACTIONS.dash.STAMINA_COST` global saiu).

**Recarga do dash** — `PLAYER_ACTIONS.dash.COOLDOWN` (2.5s), igual pra
jogador e IA: trait `DashCooldown` (posto no primeiro dash,
`travarRecargaDoDash`), contado pelo `dashCooldownSystem` (novo, antes do
`playerActionSystem`); `isDashReady` no jogador e no `canDash` da IA. O
`AI_MOVEMENT.DASH_INTERVAL` e o `AiMovement.dashTimer` saíram.

**Regen** das iniciais: 45%/s → 8%/s (`stats.energy.regenPercent`), atraso de
2s mantido — barra cheia em ~12s parado.

**HUD**: `SkillsHud` lê o golpe resolvido (`resolveAttackForEntity`, com o IV
da criatura) — a sombra de recarga usa a recarga calculada.

### Correção: seguidor oscilando entre parado/andando/correndo

Relatado jogando: seguindo o treinador, a criatura alternava parada ↔
andando (mini-passos, som de passo disparando, walk tremendo) e andando ↔
correndo.

**Causa:** `creatureFollowSystem` decidia a marcha do zero a cada tick, com
um limiar só por troca (`followMinDistance` 4 / `runDistance` 6) — controle
liga/desliga. O treinador anda a 2.5 m/s, entre o andar (1.5) e o correr (4)
das iniciais: correndo, ela cai abaixo de 6m, passa a andar, fica pra trás,
volta a correr — quase todo tick. Em 4m, o mesmo sempre que o treinador se
afasta mais devagar que 1.5 m/s (de lado, em curva). Animação
(`animationStateSystem`, pela velocidade) e passo (`footstepAudioSystem`,
que toca na hora a cada volta pro walk/run) só refletiam isso. A 035
piorou: com a corrida esvaziando a barra em ~24s (antes nunca esvaziava),
a energia vazia virava um tranco de corrida a cada ~2s — o primeiro pouco
regenerado pagava um tick de corrida e reiniciava o atraso do regen.

**Correção:** histerese em `resolveFollowGait` (marcha do tick anterior em
`PathState.gait`): parada só volta a andar acima de `followResumeDistance`
(5m, novo no `party` do `boy`); correndo, corre até chegar nela.
Energia: o mesmo descanso da IA de luta (`resolveResting`, 034,
`PathState.resting`) — sem correr da energia ≤ 15% até voltar a 60%. Ao
voltar a seguir depois de parada, o caminho é recalculado na hora (o
guardado era de antes de parar).

**2ª rodada (entre as criaturas):** o mesmo liga/desliga no desvio parada.
Parada, com outro personagem dentro de `avoidanceRadius` (2.5m), ela anda
com o `walkSpeed` cheio pra longe; fora dele, para no mesmo tick. Com outra
criatura chegando devagar, ficava presa na borda: anda um tick, sai, para,
a outra entra de novo. Agora, parada, só começa a se afastar com alguém
dentro de `avoidanceStartRadius` (2m, novo no `party`) e continua até
ninguém estar dentro de `avoidanceRadius` (`PathState.separating`).

### Correção: câmera e seguidor tremendo (mais com zoom)

**Causa:** o `GameLoop` roda a simulação em passo fixo (60 Hz) e a
apresentação a cada frame, mas a apresentação lia `Position` crua, sem
interpolar. Cada frame roda 0, 1 ou 2 passos; a tela anda em degraus
irregulares. Isso acontece sempre num monitor acima de 60 Hz e de vez em
quando a 60 Hz (o tempo de frame oscila em torno de 16.7ms). Na câmera
(`cameraFollowSystem`), a posição é suavizada (`SMOOTHING`), mas o
`lookAt` vai direto na posição do alvo: segue os degraus, e a câmera
inteira gira pra lá e pra cá. A criatura seguindo também é desenhada em
degraus, só que contra uma câmera suave — causa comum, não é o follow.
**Zoom:** o tranco angular é ~degrau ÷ distância da órbita — no zoom
mínimo (2.5m) é ~5× o da distância inicial (12m); aumenta de verdade, não
só fica mais visível.

**Correção:** interpolação de apresentação
(`view/registry/renderInterpolation.js`): o loop guarda Position/Rotation
antes de cada passo fixo e passa `alpha` = acumulador ÷ passo; o modelo
(`syncTransformSystem`), a câmera e a plaquinha de nome (`NameplateView`)
desenham entre o passo anterior e o atual (no máximo 16.7ms atrás). A
simulação e o `SMOOTHING` da câmera não mudaram.

### Velocidade das animações gravadas (`speed`)

Pedido do usuário: controlar a velocidade das animações embutidas no
`.glb`. Antes, estados cíclicos (idle, walk, run, fall, battleIdle) tocavam
sempre a 1× (−1× de costas), sem parâmetro.

`species.nativeAnimations`: qualquer forma objeto aceita `speed`
(multiplicador, padrão 1) — ex.: `walk: { animation: 'walk', speed: 1.3 }`,
`faint: { start, loop, end, speed }`, `dash: { sequence: [...], speed }`.
Vale onde o tempo não vem de uma ação: estado cíclico, o `loop` de qualquer
sequência, `start`/`end` e `sequence` fora de ação. Numa ação, a duração da
ação continua mandando (clipe único, `start`/`end` e `sequence` esticados
pela `duration`). O passo (`footstepAudioSystem`) segue a fase do ciclo,
então acompanha sozinho. Em `nativeAnimationPlayer.js`
(`resolveTimeScale`, `resolveSequencePlan`).

### Limpeza: fora o `bot` e as fox/wolf

Pedido do usuário: descartar o `bot` (avatar antigo do treinador, trocado
pelo `boy` na 026) e as placeholders `fox`/`wolf` (e os clones
`fox-red/green/blue`, que já não existiam mas ainda eram citados).

- Saíram `core/data/species/bot/` e `fox/` (com os clipes) e os assets
  `models/bot.glb`, `models/fox-debug.glb`, `textures/fox/`,
  `textures/wolf/` e `audio/voices/fox/`; o registro de espécies só tem o
  `boy` e as três iniciais.
- `CREATURE_TINTS` ficou vazio (só existia pros clones da fox) — quem lê
  cai no cinza de sempre.
- Comentários de código que citavam essas espécies foram atualizados
  (`boy/index.js` no lugar de `bot/index.js` etc.). "Virar o bot" (o
  treinador seguindo, fora do controle) é outro conceito e ficou. Os docs
  de features antigas ficam como histórico.
- Testes: `makeWorld` usa o `boy` como player de teste (antes `fox`); as
  criaturas de teste viraram iniciais (Bulbasaur no `creatureAttackSystem`,
  Charmander nos de movimento/IA, as três no lugar de `fox-red/green/blue`
  nos de time). Os que assumiam barra 100 leem o `maxStamina` /
  `staminaRegenDelayAfterUse` do `Vitals` da entidade. Os testes do clipe
  procedural da fox (`applyAnimationClip`) e os de `fox-red/green/blue`
  (registro, passo) saíram junto com o conteúdo. Ajustes por causa das
  diferenças: o Bulbasaur nasce com `appeal` (trava o movimento até
  acabar), a cápsula em pé do `boy` precisa assentar antes de subir a
  rampa, e "espécie sem habilidade" / "básico com outro alcance" mudam a
  espécie só dentro do teste.

### Correção: testes antigos

As 23 falhas antigas da suíte, por causa:

- **Câmera (`orbitCamera`, 10):** `CAMERA.TARGET_HEIGHT`/`SHOULDER_OFFSET`
  estavam comentados no `gameConfig` desde a 0.0.30 — o default de quem
  não declara `species.camera` virava `undefined` (NaN). Valores
  devolvidos (decisão do usuário: manter o fallback global).
- **Indicador (`creatureAttackSystem`, 7):** assumiam golpes reais em
  `castMode: 'confirm'`; hoje todos são `'instant'`. Agora forçam
  `castModeOverride: 'confirm'` — testam o mecanismo, não o conteúdo.
- **Alvo (`creatureAttackSystem`, 2):** tamanhos de cápsula fixos e
  desatualizados; agora derivados do `body` da espécie.
- **Kit e time (`world` 2, `items/index` 1):** contavam itens/ids fixos
  (o kit mudou na 029). Agora testam regras: categoria conhecida, item da
  mão no inventário, todo item do inventário registrado, time só com
  `kind: 'pokemon'`.
- **Fórmulas (`stats`, 1):** a energia ganhou o `+10`; o teste copiava a
  conta. Agora compara com a própria `calculateEnergyStat`, e o
  `calculateStat` testa propriedades (cresce com base/IV/nível, natureza)
  em vez da fórmula copiada.

Regras novas do usuário (valem daqui em diante): testes não fixam conteúdo
nem números de fórmula; comentários de código não citam valores de
parametrização (ficam obsoletos quando ajustados à mão); números em doc
são fictícios/ilustrativos. Feita uma passada limpando os comentários
existentes que repetiam valor de parâmetro.

### Números de exemplo (fictícios — nível 5, IV 15, valores da época)

| Quem | Energia | Regen | Corrida | Dash | Pulo |
|---|---|---|---|---|---|
| Charmander / Bulbasaur / Squirtle | 23–24 | 8%/s | 0.96/s (~24s) | 1.6 (+2.5s de recarga) | 0.4 |
| Treinador | 80 | 10%/s | 3.2/s (~25s) | 8 (+2.5s de recarga) | 4 |

| Espécie | Golpe | Peso | Custo (% da barra) | Recarga |
|---|---|---|---|---|
| todas | básico | 5 | 0.4 (2%) | — |
| Charmander | Growl | 32.5 | 2.6 (11%) | 2.2s |
| Charmander | Tackle | 40 | 3.2 (14%) | 2.7s |
| Charmander | Ember | 50 | 4.0 (17%) | 3.4s |
| Bulbasaur | Growl | 32.5 | 2.6 (11%) | 2.4s |
| Bulbasaur | Leech Seed | 43.75 | 3.5 (15%) | 3.3s |
| Bulbasaur | Vine Whip | 45 | 3.6 (15%) | 3.4s |
| Squirtle | Tackle | 40 | 3.2 (13%) | 3.0s |
| Squirtle | Water Gun | 50 | 4.0 (17%) | 3.75s |
| Squirtle | Tail Whip | 32.5 | 2.6 (11%) | 2.4s |

(A recarga varia um pouco entre espécies pelo `speed`.)

## Etapas

- [x] Doc da feature e bump da versão (`package.json` → `0.0.35`)
- [x] Decisões do modelo
- [x] `core/battle/actionCost.js` (peso, recarga) e `levelCost.js` (custo
      pelo nível) + testes
- [x] `resolveAttackForEntity` aplicando a fórmula; `staminaCost`/`cooldown`
      fora das skills e dos básicos; `_template` documentando
- [x] Básico: custo pela fórmula (simbólico), sem recarga
- [x] Movimento das criaturas pelo nível (`resolveMovementCosts`);
      `Vitals.dashStaminaCost`
- [x] Dash com recarga pra todos (`DashCooldown`, `dashCooldownSystem`)
- [x] Regen das iniciais 45%/s → 8%/s
- [x] Treinador com números próprios
- [x] HUD de skills lendo a recarga calculada
- [x] Testes dos arquivos mexidos (cada regra conferida desligando-a)
- [x] Correção: seguidor oscilando parado/andando/correndo (histerese +
      descanso de energia no `creatureFollowSystem`)
- [x] Correção: câmera/seguidor tremendo (interpolação de apresentação
      entre passos fixos)
- [x] `speed` nas animações gravadas (`nativeAnimations`)
- [x] Limpeza: fora o `bot` e as fox/wolf (código, assets, testes)
- [x] Correção: testes antigos (câmera, indicador, alvo, kit, fórmulas)
- [x] Suíte inteira

## Testes

- `actionCost.test.js` (novo) — peso: poder, efeitos (estágios, semente,
  tipo sem peso), bônus de alcance (no limite e abaixo), de cone (área e
  canal), golpe em si mesmo sem alcance; custo cresce com o nível; recarga ×
  fator de velocidade; ausentes pela fórmula, escritos ganham; básico sem
  recarga; skills do Charmander resolvidas pela fórmula (nível + speed);
  Ember custa mais que Tackle com o mesmo poder; básico simbólico.
- `vitals.test.js` — custo de movimento pelo nível (cresce com ele);
  treinador com os números dele; `vitalsFromSpecies` copia os custos.
- `dashCooldownSystem.test.js` (novo) — conta até zero, sem passar.
- `playerActionSystem.test.js` — custo do dash da entidade; recarga: outro
  dash só depois de `COOLDOWN`.
- `aiMovement.test.js` — dash da IA paga o custo da entidade e trava a mesma
  recarga do jogador.
- `stamina.test.js` — `resolveDashCost` = custo da entidade × vida.
- `creatureFollowSystem.test.js` — histerese da marcha (`resolveFollowGait`:
  parada fica parada até `followResumeDistance`, correndo corre até ela);
  no system: alvo se afastando pouco não tira da parada, correndo logo
  abaixo de `runDistance` continua correndo, energia vazia descansa em vez
  de correr com o pouco regenerado; desvio parada com histerese (alguém
  entre os dois raios não tira da parada; já se afastando, continua até
  sair de `avoidanceRadius`).
- `renderInterpolation.test.js` (novo) — desenha pelo `alpha` entre o
  passo anterior e o atual; frame sem passo anda sem degrau; rotação pelo
  menor ângulo; entidade sem captura usa o atual; captura descarta a
  anterior.
- `nativeAnimationPlayer.test.js` — `speed`: cíclico na velocidade pedida
  (também de costas); ação ignora (a duração manda); `start`/`loop` fora de
  ação e `sequence` fora de ação aceleram; sem `speed`, 1×.
- `creatureAttackSystem.test.js` — custos lidos do golpe resolvido (a
  definição não tem mais); o teste de precisão recarrega a energia entre as
  40 tentativas (é de precisão, não de custo).

Conferidos desligando: escrito ganhando da fórmula, bônus de alcance, bônus
de cone, básico sem recarga, movimento pela fórmula, `isDashReady`,
`travarRecargaDoDash`, fator de velocidade na recarga.

Falhas nos arquivos relacionados: só as antigas (`creatureAttackSystem` 9,
`stats` 1, `items/index` 1).

Depois da limpeza do `bot`/fox/wolf, sobraram 23 falhas antigas (eram 61),
nenhuma das espécies removidas — testes que não acompanharam mudanças de
features anteriores. Corrigidas (ver "Correção: testes antigos"); a suíte
inteira passa.

## Critérios de conclusão

- Nenhuma skill nem básico escreve custo/recarga; todos saem da fórmula.
- Mesmo poder: à distância e em cone custam mais.
- Custo cresce com o nível; recarga encurta com o `speed`.
- Energia pesa: ~6–9 habilidades por barra, ~12s pra encher.
- Dash com a mesma recarga pro jogador e pra IA.
- Testes dos arquivos mexidos passam; lint limpo.

## O que olhar em jogo

- Quantas habilidades por barra: ~6–9 parece certo? Botão: `COST_DIVISOR`.
- O ritmo das recargas: botão `COOLDOWN_PER_WEIGHT`.
- Regen 8%/s com atraso de 2s: o básico (custo 0.4) também reinicia o atraso
  — atacando sem parar, a barra não volta (decisão 2: custo simbólico).
- **A IA** (034) segura habilidade pra sobrar `AI_ENERGY.SKILL_RESERVE_FRACTION`
  (25%) depois de pagar: com o Ember a 17%, ela só lança com ~42% da barra.
  Pode ficar econômica demais — ajustar `AI_ENERGY` se for o caso.
- Dash de criatura (1.6, 7% da barra) com 2.5s de recarga; corrida esvaziando
  em ~24s.
- **Limitação conhecida:** o fator de velocidade usa
  `BATTLE.ATTACK_SPEED.REFERENCE` fixo (10, calibrado pro nível 5) — em níveis
  altos todo mundo bate no fator mínimo (0.6). Vale pro básico desde a 028 e
  agora pra recarga; resolver junto quando houver níveis maiores.
