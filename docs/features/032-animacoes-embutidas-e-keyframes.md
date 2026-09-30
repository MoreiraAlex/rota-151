# 032 — Animações por keyframes e embutidas no `.glb`

## Resumo

Pedido inicial do usuário: "consegue fazer uma adaptação no load de
animações? Quero poder usar tanto animações procedurais quanto clips". A
feature cresceu em rodadas, com o usuário testando ao vivo:

1. **Clipe por keyframes gravados** — segundo formato de clipe
   (`type: "keyframes"`) ao lado do procedural.
2. **Leitura de `.glb` fora do jogo** — parser mínimo + CLI pra listar e
   converter animações embutidas.
3. **Reprodução das animações embutidas no jogo** — o usuário trocou os
   modelos de bulbasaur, charmander e squirtle por rigs completos (com
   dezenas de animações embutidas, convertidos por
   `scripts/blender/convert-pokemon.py`) e passou a tocá-las direto do
   `.glb` com `THREE.AnimationMixer`. A primeira versão, feita pelo
   usuário dentro do `animationRegistry.js`, foi revisada e reorganizada.
4. **Controles de animação** — sequências `start/loop/end`, lista de
   clipes tocados uma vez, corte por frames, duração da ação respeitada,
   `blend` por estado.
5. **Estados novos** — `battleIdle`, `appeal` (ao ser invocado), `jump`
   separado do `fall`, piscar por animação no lugar da textura.
6. **Dash** — frenagem no fim.
7. **Status `speed`** volta a influenciar a velocidade do ataque básico,
   como fator sobre a duração autorada.

O motor procedural continua valendo pra todo estado sem animação
embutida (fox, wolf, boy, bot, e o `cry` das três espécies).

## 1. Clipe por keyframes gravados

`core/animation/applyAnimationClip.js` só entendia curva por eixo
(`curves.js`). Agora aceita também:

```json
{
  "type": "keyframes",
  "fps": 30,
  "bones": {
    "hand": {
      "quaternion": [{ "x": 0, "y": 0, "z": 0, "w": 1 }, "..."],
      "position": [{ "x": 0, "y": 1.2, "z": 0 }, "..."]
    }
  }
}
```

- Um valor ABSOLUTO por frame, por osso; todos os arrays compartilham a
  mesma linha do tempo. Osso ausente do rig, ou sem array, é ignorado.
- Formato escolhido por clipe inteiro — nunca misturado no mesmo osso.
- `sampleKeyframeClip` interpola os frames vizinhos (slerp na rotação,
  lerp em posição/escala) e é cíclico.
- `speed` significa o mesmo nos dois formatos ("ciclos do clipe por
  segundo"), então `ActionState.animationSpeed` (`1/duration`) estica o
  clipe gravado inteiro pra caber na ação, sem olhar pro `fps`.
- `resolveClipSpeed(clip)`: `clip.speed` explícito; senão, pra keyframes
  com `fps`, `fps / totalDeFrames`; senão `1`.
- `blendFromPose` (novo): crossfade cujo destino é a pose que JÁ está nos
  ossos — usado quando o destino é procedural (ver seção 3).

## 2. Leitura de `.glb` fora do jogo

`core/animation/gltfAnimation.js` — parser próprio, puro (roda em Node,
sem Three/browser): `parseGlb`, `readAccessorFlat`, `sampleTrackAt`
(`STEP`/`LINEAR`, slerp pra quaternion; `CUBICSPLINE` lança erro claro),
`listGltfAnimations` (nome, índice, duração e **quantidade de frames**) e
`convertGltfAnimationToClip` (reamostra pro formato de keyframes da
seção 1).

CLI:

```
npm run extract:glb-animation -- --file <model.glb> --list
npm run extract:glb-animation -- --file <model.glb> \
  --animation <nome-ou-índice> --out <clip.json> [--fps 30]
```

`--list` imprime `índice  duração  frames  nome` — é de onde sai o número
pra `animationFrames`/`frames` (seção 4). `scripts/srcImportHook.js`
resolve os imports sem extensão de `src/core/` no Node puro (o bundler
faz isso no jogo).

## 3. Reprodução das animações embutidas

### Onde mora

- `view/animation/nativeAnimationPlayer.js` — player por entidade
  (`AnimationMixer` + fase atual). Não conhece ECS.
- `view/animation/nativeBlink.js` — camada de piscar (seção 5).
- `view/hooks/useAnimatedModel.js` — dono do player: cria no efeito de
  registro só quando a espécie tem `nativeAnimations`; no cleanup,
  `stopAllAction()` + `uncacheRoot()`.
- `view/registry/animationRegistry.js` — só registro (entrada `native`).
- `view/systems/animationSystem.js` — decide o estado EXIBIDO e avança o
  mixer OU o motor procedural.

### Formato — `species.nativeAnimations[stateId]`

| Forma | Comportamento |
|---|---|
| `'nome'` ou `{ animation, blend? }` | Um clipe. Estado cíclico repete; ação toca uma vez e segura o último frame. |
| `{ start, loop, end, blend? }` | `start` uma vez ao entrar, `loop` enquanto durar, `end` uma vez ao sair (todas opcionais). |
| `{ sequence: [...], blend? }` ou só o array | Cada clipe UMA vez, em ordem, sem loop. Item pode ser `{ animation, frames }`. |

- **`blend`** (s): crossfade ao ENTRAR no estado e entre as fases dele.
  Sem ele, `GAME_CONFIG.ANIMATION.BLEND_DURATION` (`nativeStateBlend` /
  `resolveBlend`).
- **Nome inexistente no `.glb`** é ignorado sem quebrar; estado sem
  nenhuma animação resolvível cai no procedural (ou no `fallback`).
- **Root motion:** os rigs trazem deslocamento só no nó `origin`, só em
  walk/run, só em Z. A track `origin.position` é descartada numa cópia do
  clipe (cache por clipe, `WeakMap`), sem mexer no clipe compartilhado do
  `useGLTF`.

### Estado exibido (`animationSystem.js`)

- **`fallback`** (`core/data/animationStates.js`): estado sem animação na
  espécie toca a do fallback (`battleIdle → idle`, `jump → fall`); trocar
  entre dois estados que tocam a mesma animação não reinicia nada
  (`entry.clipId`).
- **Saída com `end`**: quando o estado lógico muda e o exibido tem `end`,
  ele toca antes; o próximo estado CÍCLICO espera, uma ação interrompe.
  Voltar pro mesmo estado durante esse `end` de saída (desmaiar de novo
  levantando) recomeça a sequência — só o `end` de saída (`exiting`),
  não o `end` que toca dentro de uma ação.
- **Ação repetida** (ataque após ataque, mesmo `AnimationState.id`):
  detectada por `ActionState.elapsed` voltar pra trás; recomeça o gesto.
- **Crossfade**: com destino embutido, feito pelo próprio mixer
  (`crossFadeFrom`/`fadeIn`, `playPhase`); com destino procedural, pela
  fotografia + `blendFromPose`. Nunca pose escrita por fora num osso que
  o mixer controla — o `PropertyMixer` só reescreve um osso quando o
  valor que ELE calcula muda, então uma pose escrita por fora num osso
  parado ficava presa (bug real: pálpebra semicerrada ao trocar de
  animação no meio de um blink).
- **Passos**: `footstepAudioSystem` lê `entry.cyclePhase` (0-1), escrita
  pelo `animationSystem` a partir do motor que estiver tocando.
- **De costas** (`AnimationState.direction = -1`): `timeScale` negativo
  na fase que repete.

## 4. Ações e duração

- **Clipe único numa ação**: `timeScale = animationSpeed × duração do
  clipe` — o gesto inteiro cabe em `duration`.
- **Corte por frames** — `attacks.<slot>.overrides.animationFrames: N`:
  toca só os N primeiros keyframes e segura ali; o trecho cortado é que é
  esticado. `creatureAttackSystem` grava `ActionState.animationFrames` no
  disparo e volta a `null` no fim.
- **`{ start, loop, end }` numa ação** (`resolveActionSchedule`): `start` e
  `end` na velocidade original, `loop` preenche o resto, `end` começa a
  tempo de acabar junto com a ação. Se `start + end` > `duration`, os dois
  aceleram na mesma proporção e o loop é pulado. Trocas pelo relógio do
  estado, sem crossfade.
- **Lista `sequence` numa ação** (`resolveSequencePlan`): a lista inteira
  é esticada na mesma proporção pra somar `duration`; itens com `frames`
  entram cortados no cálculo. Fora de ação: velocidade original.
- **Duração do ataque básico** (`resolvePrimaryDurationOverride`,
  `creatureAttackSystem.js`): a BASE é a autorada
  (`attacks.primary.overrides.duration`, ou a do ataque); o `speed`
  calculado (base + IV + nível) multiplica por `√(REFERENCE / speed)`,
  limitado a `[MIN_FACTOR, MAX_FACTOR]` — `GAME_CONFIG.BATTLE.ATTACK_SPEED`
  (10, 0.6, 1.4; 10 ≈ bulbasaur nível 5 com IV médio). `effectAt`
  (override, ou 40% da base) escala junto.
  `calculateAttackDurationFactor` substitui `calculateAttackInterval`,
  que gerava a duração inteira (0.05–0.5s) — curta demais pros clipes
  embutidos, e que sobrescrevia o override da espécie em silêncio.

## 5. Estados novos

- **`battleIdle`** — parada no chão com `CombatMode` (`ctx.inCombat`).
  Substitui o "olho bravo" da textura. `fallback: 'idle'`.
  `Mood`/`eyeStates` continuam valendo pras espécies com olho por textura.
- **`appeal`** — ao ser invocada. `summonBallSystem` spawna a criatura com
  `ActionState` em `'appeal'` (`resolveAppealActionState`) se a espécie
  declarar `actions.appeal.duration`; `creatureAppealSystem` (novo, logo
  depois do `summonBallSystem`) avança e encerra. Parada enquanto dura:
  `creatureFollowSystem` passou a respeitar ação em andamento.
- **`jump` × `fall`** — tag `Jumping` (`core/traits/components/physics.js`):
  o `characterPhysicsSystem` põe no pulo de verdade (mesmo instante do
  `Jumped`) e tira ao aterrissar (`Grounded` e `vel.y <= 0`). O estado
  `jump` vale só na SUBIDA (`Jumping` e `vel.y > 0`); do ponto mais alto
  em diante, e ao cair de uma borda, é `fall`.
- **Piscar** — `species.nativeBlink: { animation, minInterval,
  maxInterval }`: camada ADITIVA no mesmo mixer, só com as tracks que o
  clipe de blink move (as pálpebras). Só pisca quando o clipe do corpo
  mantém essas pálpebras paradas na pose de olho aberto — decidido pelos
  dados de cada clipe, não por lista de estados (charmander: pisca em
  idle/battleIdle/walk/run/fall; não em appeal/attack/faint/hit/stepIn).

## 6. Dash — frenagem

`GAME_CONFIG.PLAYER_ACTIONS.dash.EASE_OUT_TIME` (0.25s; no máximo metade
de `DURATION`; 0 desliga): nos últimos segundos, a velocidade desce suave
(smoothstep) de `SPEED` até a de saída — 0 sem input, `walkSpeed`
andando, `runSpeed` segurando correr — e chega exata nela no fim
(`resolveDashSpeed`, `playerActionSystem.js`). Antes caía de 12 m/s pra
0–4 m/s num tick, e ainda sobrava um tick com velocidade 0 (o
`movementSystem`, que roda antes, zerava por ainda ver o dash ativo).

## Conteúdo (usuário)

- Modelos novos de bulbasaur, charmander e squirtle, convertidos por
  `scripts/blender/convert-pokemon.py` (animações com nomes limpos:
  `idle`, `battleIdle`, `blink`, `appeal`, `faintStart`...); texturas
  novas por material (`pm####_00_00_*_alb.png`), as antigas removidas.
- Clipes procedurais antigos (idle/walk/run/faint) removidos das três
  espécies; o `cry.json` de cada uma foi atualizado pros ossos do rig
  novo (boca sincronizada com o grito continua procedural).
- `nativeAnimations`, `nativeBlink` e `actions.appeal` nas três espécies;
  ajustes de corpo, velocidade, alcance e duração de ataque.

## Testes

- `applyAnimationClip.test.js` — clipe de keyframes (10 casos).
- `gltfAnimation.test.js` — parser, amostragem, conversão de ponta a
  ponta e fumaça contra o `001-bulbasaur.glb` real.
- `nativeAnimationPlayer.test.js`, `nativeBlink.test.js` — com
  `THREE.AnimationMixer` de verdade num rig mínimo em Node: fases,
  sequências, lista, corte por frames, encaixe na duração, root motion,
  blink permitido/bloqueado.
- `animationSystem.test.js` — faint start/loop/end, ação interrompendo o
  `end`, ataque repetido, fallback, osso parado sem pose presa, sequência
  de ataque tocando uma vez só, `blend` por estado.
- `animationStates.test.js`, `animationStateSystem.test.js`,
  `characterPhysicsSystem.test.js` (`Jumping`), `creatureAppealSystem.
  test.js`, `summonBallSystem.test.js` (nasce em `appeal`),
  `playerActionSystem.test.js` (frenagem), `creatureAttackSystem.test.js`
  e `stats.test.js` (fator de `speed`, `animationFrames`).

Os bugs de comportamento foram reproduzidos antes de corrigir (dois deles
com o `.glb` real do charmander rodando o `animationSystem` de verdade:
pálpebra presa e ataque repetindo 3-4x), e cada teste de regressão foi
conferido falhando com o código antigo.

## Fora de escopo / pendências

- `CUBICSPLINE` e morph targets (`weights`) não suportados no parser.
- Giro no fim do dash: o `movementSystem` volta a virar pro input com
  `turnSpeed` no mesmo tick (anotado no backlog).
- A condição `vel.y <= 0` na remoção de `Jumping` não é exercitada por
  teste: no Rapier de teste o `Grounded` já cai no 1º tick do pulo.
- Comentários antigos da Pokédex/modo Scan (commit da 0.0.29) citam
  `docs/features/032-*.md`/`033-*.md` de uma numeração anterior que não
  existe — não têm relação com esta feature.

## Gates

- `npm test` — 747 passam, 28 falham. Nenhuma falha desta feature: 22
  já falhavam no início (`applyAnimationClip.test.js` fox-walk 5,
  `orbitCamera.test.js` 10, `world.test.js` 3, `items/index.test.js` 1,
  `stats.test.js` 1, `summonBallSystem.test.js` 1,
  `creatureAttackSystem.test.js` 1) e 6 em `creatureAttackSystem.test.js`
  vêm de ajustes de dados do usuário durante a feature (cápsulas,
  alcances, durações novas) — confirmado que falham também sem o código
  desta feature.
- `npm run lint` — limpo nos arquivos de código desta feature.
- `npm run build` — a compilação passa (`✓ Compiled successfully`). A
  etapa de lint do build acusa erros só em arquivos fora do código desta
  feature (dados de espécie, HUDs, `roster.js`...) — quase todos de
  formatação do Prettier (corrigíveis com `eslint --fix`) e 2 de
  `camelcase` (`sp_def` em `stats.js`).
