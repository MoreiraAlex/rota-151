# 🚀 Versão 0.0.22 — Fogo de cauda do Charmander (VFX de partícula no jogo)

Primeiro VFX de partícula real do jogo. Nasceu de um pedido direto pra ver
uma simulação de fogo funcionando — virou um spike isolado
(`src/tools/fireDemo/Campfire.jsx`, `/tools/teste-fogueira`, fora do jogo)
e agora foi ligado de verdade num modelo: um fogo pequeno na ponta da
cauda do Charmander, acompanhando a animação enquanto ele anda/idle.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Mecanismo reaproveitado: anexar objeto Three.js num osso nomeado

`view/systems/heldItemViewSystem.js` (item na mão do treinador) já
resolvia exatamente "anexar um objeto visual num osso, seguindo a pose
animada sem recalcular posição por frame" — `bone.add(objeto)` (Three.js
puro); uma vez encaixado, o próprio Three.js propaga a matriz do osso
animado pro filho a cada frame, sem o system precisar saber de posição
nenhuma. Único trabalho por frame: `bone.getWorldScale()` → escala local
inversa, cancelando a escala composta do rig/`model.scale` (~0.015 pros
Pokémon) que senão deixaria o objeto microscópico (bug real que o próprio
`heldItemViewSystem.js` documenta ter caído).

Diferença importante do fogo de cauda pro item na mão: item na mão é
SINGLETON de módulo (só o treinador segura item, uma vez); fogo de cauda é
POR ENTIDADE — várias Charmander (invocada + selvagens) podem existir ao
mesmo tempo, cada uma com o próprio fogo. Por isso usa o padrão de
registry por entidade que os sons já usam (`footstepAudioRegistry.js`
etc.), não o singleton do item na mão.

## Peças novas

- **`view/vfx/flameParticles.js`** (novo) — motor de partícula extraído do
  spike (`Campfire.jsx`) no momento em que um SEGUNDO consumidor real
  precisou da mesma mecânica (mesmo raciocínio já usado nesta sessão pra
  `createSimpleAudioRegistry.js`: generaliza no 2º consumidor, não antes).
  `createFlame(textures, config)` monta 3 camadas de partícula (silhueta/
  "sten", brilho interno/"core", brasas) MAIS uma `THREE.PointLight` de
  verdade (opcional, `config.light` — `color`/`distance`/`decay`/
  `baseIntensity`/`flickerSpeed`/`flickerAmount`/`flickerNoise`/
  `position`; `false` desliga) — tudo filho do MESMO `THREE.Group`,
  devolve `{ group, update(delta, overrides?), dispose() }`. A luz
  acompanha escala/rotação/posição de quem move o grupo (`Campfire.jsx`'s
  `<group scale>`, ou o osso da cauda) sem código extra nenhum, e o
  flicker avança junto no mesmo `update()`. Posição/escala geral/velocidade
  continuam por conta de quem chama. A luz da fogueira ERA um
  `<pointLight>` React separado em `Campfire.jsx`, com seu próprio flicker
  em `useFrame` — movida pra cá quando o fogo de cauda precisou do MESMO
  mecanismo (2º consumidor real, mesmo motivo da extração original).
- **`view/registry/tailFireRegistry.js`** (novo, + teste) — registro
  trivial entidade → `{ flame, bone, config }`, mesmo formato de
  `viewRegistry.js` (`config` é o `species.vfx.tailFire` resolvido,
  guardado porque `tailFireSystem.js` lê `scale`/`speed`/`rotation`/
  `position` dele de novo todo frame).
- **`view/systems/tailFireSystem.js`** (novo) — por entrada do registry:
  corrige a escala (mesma técnica do item na mão, agora multiplicada por
  `config.scale ?? 1` — ajuste geral opcional por cima da correção), aplica
  `config.position` (opcional, unidades de mundo — deslocamento LOCAL a
  partir da origem do osso, dividido por `worldScale` pelo MESMO motivo da
  correção de escala: posição de filho é interpretada no espaço pequeno do
  rig, senão o valor configurado pareceria quase não fazer nada) e
  `config.rotation` (opcional, graus — rotação LOCAL fixa do grupo, ver
  "Rotação" abaixo), e chama `flame.update(delta * (config.speed ?? 1))`.
  Sem recalcular posição — o `bone.add()` já resolve isso. Registrado em
  `registerSystems.js`, fase `presentation`, perto de
  `heldItemViewSystem`/`animationSystem`.
- **Todos os parâmetros do spike (`/tools/teste-fogueira`) valem aqui** —
  `shape`/`width`/`height`/`density`/`turbulence`/`palette`/`intensity`/
  `light` (já eram repassados direto pra `createFlame`, sem plumbing
  extra) mais `scale`/`speed`/`position`/`rotation` (novos, exclusivos
  daqui — só o fogo de cauda precisa: uma fogueira solta não herda
  posição/rotação de osso nenhum, e escala/velocidade geral já eram feitas
  por fora, no `<group>` do próprio `Campfire.jsx`).
- **`useAnimatedModel.js`** — novo `useEffect` (depois do que já registra
  os ossos, mesmo componente/commit — o osso já está disponível ali, sem
  precisar do retry-todo-frame que o item na mão precisa, que é um system
  ECS separado): resolve `species.vfx?.tailFire` (opcional) +
  `TAIL_BONE_BY_SPECIES[species.id]` (mapa hardcoded na view, mesmo
  espírito de `HAND_BONE_BY_SPECIES` — nome de osso vem do rig, não é dado
  de espécie). Com os dois presentes, carrega as texturas via `loadTexture`
  (`Promise.all`, mesmo padrão `cancelled` do efeito de textura de
  material), cria a chama, `bone.add(flame.group)`, registra. Cleanup
  desregistra (que já remove do osso e descarta a chama).
- **Osso usado**: `Tail6` (ponta da cadeia `Tail1`...`Tail6` do rig do
  Charmander, visto direto no `bones` de `clips/idle.json`/`walk.json`).
- **Config da espécie** (`004-charmander/index.js`): `vfx.tailFire` com
  `width`/`height`/`density` bem menores que o default de `createFlame`
  (calibrado pra uma fogueira ~1 unidade; cauda é bem menor) — valores
  exatos ficam ao vivo em ajuste (ver arquivo, não este texto).
  Documentado em `_template/index.js`, mesma convenção "Opcional — sem
  isso, ..." de `sounds`/`model.texture`.

## Rotação — `bone.add()` também herda orientação, não só posição

Bug real, relatado jogando: o fogo saía "deitado" na cauda em vez de
apontando pra cima. Causa — `bone.add()` faz o grupo do fogo herdar a
ROTAÇÃO do osso, não só a posição; o eixo "pra cima" da partícula (onde
ela sobe/estreita, ver `flameParticles.js`) só bate com o mundo por
coincidência, depende de como o rig orienta aquele osso especificamente.
`config.rotation` (`{ x?, y?, z? }`, graus) resolve isso — rotação LOCAL
fixa aplicada por cima da herdada, ajustada na mão olhando o resultado no
jogo (sem fórmula pra calcular o valor certo direto do `.glb` — não vale a
pena derivar isso da bind pose quando dá pra simplesmente olhar e girar).

**Trade-off ainda em aberto**: isso corrige a orientação de REPOUSO, mas
`bone.add()` continua fazendo o fogo girar JUNTO com a cauda enquanto ela
balança andando (fogo de verdade se comporta mais independente da rotação
rígida). Se isso incomodar visualmente durante o andar, o follow-up é
trocar `bone.add()` por sincronizar só a POSIÇÃO do grupo a cada frame
(`bone.getWorldPosition` + `worldToLocal` num grupo que NÃO é filho do
osso), mantendo o fogo sempre "de pé" o tempo todo — mais código, mais
correto visualmente, não implementado ainda (decisão consciente de ir com
o simples primeiro).

## Testes

- `tailFireRegistry.test.js` (novo) — registra/desregistra/itera, com
  objetos fake (sem depender de Three.js de verdade). Desregistrar chama
  `bone.remove`/`flame.dispose`; desregistrar uma entidade nunca
  registrada não quebra.
- Sem teste automatizado pro `tailFireSystem.js` nem pro motor de
  partícula (`flameParticles.js`) — mesmo precedente já documentado pra
  `audioBufferCache.js`/`textureCache.js`: Three.js/browser não testável
  headless.
- `npm run lint`/`npx vitest run` verdes — mesma baseline pré-existente
  (items/world/applyAnimationClip, alheios a esta feature).

## Fora de escopo (de propósito)

- Manter o fogo "de pé" independente da rotação da cauda (ver trade-off
  acima) — fica pro follow-up se necessário.
- Fogo em qualquer outra espécie além do Charmander — mecanismo é
  genérico (`TAIL_BONE_BY_SPECIES`/`vfx.tailFire`), só falta uma segunda
  entrada quando fizer sentido.
- Texturas de fogo próprias por espécie — hoje fixo nos dois PNGs do
  Charmander (`TAIL_FIRE_TEXTURE_PATHS`, `useAnimatedModel.js`); vira
  campo configurável se uma segunda espécie precisar de arquivo diferente.
