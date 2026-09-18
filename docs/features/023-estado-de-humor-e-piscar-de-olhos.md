# 🚀 Versão 0.0.23 — Estado de humor, piscar de olhos e boca sincronizada com o grito

Mecanismo pra criatura ter uma "cara" que muda com o humor (acordada,
dormindo, braba, etc.), pisca sozinha, e uma boca que se mexe exatamente
junto do grito — nasceu do próprio trabalho do usuário recortando UV de
um atlas de olho com várias expressões (`Eye1_Merged.png` do Bulbasaur,
grade 4x4, que até então só selecionava UMA célula fixa por espécie, pra
sempre) e autorando uma curva de animação de boca/cabeça
(`clips/cry.json`).

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## `Mood` — trait novo, sem IA nenhuma decidindo ainda

`core/traits/components/mood.js`: `{ state: 'awake' }`, string livre (sem
enum fechado — cada espécie declara as próprias chaves em `eyeStates`).
Adicionado por padrão em toda entidade jogável (`core/world/world.js`,
`partySummonSystem.js`'s `applySummon`, `wildCreatureSpawnSystem.js`),
mesmo trait universal simples que `AnimationState`/`ActionState`. Por
enquanto só o seletor de debug (`DebugPanel.jsx`, ver abaixo) escreve
nele — mesmo estágio que `Party` teve antes de existir captura de verdade.

## `eyeStates` substitui `pan` fixo (por entrada de textura)

Uma entrada de `species.model.texture[materialIndex]` que queira
alternar expressão troca `pan: {x,y}` (célula fixa, pra sempre) por
`eyeStates: { [mood]: { open: {x,y}, closed: {x,y} } }` — mutuamente
exclusivos, uma entrada usa um ou outro. `open`/`closed` são exatamente
no formato de `pan` (célula do atlas, em unidades de célula/`repeat`), só
que agora há duas por humor. `blink` (opcional — `minInterval`,
`maxInterval`, `closedDuration`, defaults 2s-6s aberto / 0.12s fechado)
ajusta o ritmo. Entrada sem `eyeStates` continua exatamente como antes —
nenhuma espécie existente quebra.

## Peças novas

- **`view/registry/eyeBlinkRegistry.js`** (novo, + teste) — entidade →
  lista de "unidades de piscar" (uma por textura de olho carregada com
  `eyeStates`), cada uma com `{ texture, repeat, states, blink, phase,
  timer, lastMood }`.
- **`view/systems/eyeBlinkSystem.js`** (novo) — por unidade: lê
  `entity.get(Mood).state`; timer decrescendo alterna entre fase "aberto"
  (dura um intervalo aleatório, sorteado de novo a cada ciclo — mesmo
  raciocínio de `voiceAudioSystem.js`, pra várias criaturas não piscarem
  em sincronia) e "fechado" (dura `closedDuration`, fixo e curto);
  recalcula `texture.offset` a cada troca de célula (mesma fórmula que
  `pan` estático já usava). Troca de humor no MEIO de um "aberto" reflete
  na hora, não espera o próximo ciclo. Sem estado declarado pro humor
  atual na espécie, cai pro primeiro declarado (fallback gracioso).
  Registrado em `registerSystems.js`, fase `presentation`, perto de
  `voiceAudioSystem`/`footstepAudioSystem` (mesma família).
- **`useAnimatedModel.js`** — no mesmo efeito que já aplica textura por
  material: entrada com `eyeStates` calcula o offset INICIAL a partir da
  célula "aberto" do humor atual (evita um flash da célula (0,0) antes do
  1º tick do system) e registra a unidade; cleanup desregistra.

## `DebugPanel.jsx` — seletor de humor

`<select>` novo (opções fixas `awake`/`sleeping`/`angry`, mesmo padrão de
`PartySlotSelect`), escreve em `controlled.set(Mood, { state })` — quem
estiver sendo pilotado no momento (treinador ou criatura sob controle,
docs/features/018). Só tem efeito visível numa espécie com `eyeStates`
configurado (hoje só Bulbasaur); nas outras, inofensivo.

## Bulbasaur migrado — só `awake.open` é valor real

`001-bulbasaur/index.js`: a célula que já estava em uso (`pan` antigo)
virou `eyeStates.awake.open`. **As outras três (`awake.closed`,
`sleeping`, `angry`) são placeholder** — não sei quais células do atlas
de verdade são "olho fechado"/"dormindo"/"braba" (decisão visual, só dá
pra ver olhando `pm0001_00_Eye1_Merged.png`). `sleeping`/`angry` saíram
IGUAIS a `awake` de propósito (não quebra, só não muda de cara até
alguém preencher os valores reais).

## Boca sincronizada com o grito

Toca uma animação de boca/cabeça (`species.clips.cry`, o usuário autorou
a curva) exatamente enquanto o áudio de vocalização (`sounds.voice`) está
tocando de verdade — não um temporizador próprio, os dois lêem o MESMO
evento (`audio.isPlaying`), nunca dessincronizam.

### O problema: `applyAnimationClip` reseta TODO osso do mapa que recebe

`core/animation/applyAnimationClip.js` (docstring já existente) sempre
parte da pose de descanso pra **todo** osso do mapa passado, não só os
mencionados no clipe — é assim que uma troca de clipe (ex.: walk → idle)
"solta" perna que só o clipe anterior mexia. Isso significa que só dá
pra "sobrepor" um clipe de boca em cima da animação de corpo (idle/walk/
run) já em andamento se o mapa de ossos passado pro `applyAnimationClip`
do grito contiver SÓ os ossos do grito (cabeça/queixo/antenas) — passar o
mapa inteiro faria o corpo inteiro (pernas, coluna) saltar pra pose de
descanso enquanto o grito toca.

### Peças novas

- **`view/registry/mouthSyncRegistry.js`** (novo, + teste) — entidade →
  `{ bones (SUBCONJUNTO de `getAnimatedBonesEntry`, só os ossos que
  `clips.cry` de fato anima), clip, elapsed (relógio PRÓPRIO do grito,
  não o compartilhado de `animationRegistry.js`), wasPlaying }`.
- **`view/systems/mouthSyncSystem.js`** (novo) — por entidade registrada:
  lê `getVoiceAudioEntry(entity)?.audio.isPlaying` (do registro de VOZ já
  existente, `voiceAudioRegistry.js` — sem plumbing de áudio novo
  nenhum); borda de subida (começou a tocar agora) zera `elapsed`; toca
  parado (`entry.wasPlaying = isPlaying`); enquanto tocando, avança
  `elapsed` e chama `applyAnimationClip(clip, bones, elapsed, clip.speed)`
  no SUBCONJUNTO de ossos. Parado (ou sem entrada de voz correspondente —
  `undefined` cai em "não tocando", no-op gracioso), simplesmente NÃO
  escreve nada nesses ossos neste frame — `animationSystem.js` (roda
  ANTES) já escreveu a pose normal de idle/walk/run pra eles, então a
  boca "solta" sozinha assim que o grito acaba, sem esse system precisar
  reverter nada.
- **`useAnimatedModel.js`** — novo `useEffect` (depois do que já registra
  os ossos, mesma ordem de commit React já usada pro fogo de cauda):
  resolve `species.clips?.cry`, filtra `getAnimatedBonesEntry(entity)
  .bones` pra só os nomes de osso que `cry.bones` declara, registra o
  subconjunto. Sem `clips.cry` OU sem nenhum osso do clipe existir no rig
  (reexportado diferente, por exemplo), no-op gracioso.
- **Ordem no `registerSystems.js`**: `mouthSyncSystem` registrado por
  ÚLTIMO na fase `presentation` de propósito — precisa rodar DEPOIS de
  `animationSystem` de verdade (não só por proximidade, como a maioria
  dos outros systems da vizinhança), senão o clipe de idle/walk/run
  escreveria por cima do overlay de boca no mesmo frame.

### Bulbasaur (única espécie com `clips.cry` hoje)

`001-bulbasaur/index.js`: `clips.cry` aponta pro `cry.json` que o usuário
autorou (curva animando `Head`/`Jaw`/`LFeelerC01..10`/`RFeelerC01..10` —
cabeça, queixo e as "antenas"/folhas da cabeça do Bulbasaur, `loop:
false`).

## Testes

- `eyeBlinkRegistry.test.js`/`mouthSyncRegistry.test.js` (novos) —
  registram/desregistram/iteram, objetos fake, sem Three.js de verdade.
- Sem teste automatizado pro `eyeBlinkSystem.js`/`mouthSyncSystem.js`
  (Three.js/browser, mesmo precedente de sempre).
- `npm run lint`/`npx vitest run` verdes — mesma baseline pré-existente
  (`items`/`world`/`applyAnimationClip`, alheios a esta feature).

## Fora de escopo (de propósito)

- Preencher os valores reais de `sleeping`/`angry`/`awake.closed` do
  Bulbasaur — decisão visual do usuário, olhando o atlas.
- Qualquer IA/comportamento decidindo `Mood` sozinho — só o seletor de
  debug escreve nele por enquanto.
- Migrar Charmander/Squirtle pro eyeStates OU pro `clips.cry` — hoje sem
  atlas de múltiplas expressões pro olho (Charmander/Squirtle usam
  `Eye1.png` sozinho) nem `clips.cry` próprio autorado.
- Qualquer variação de intensidade/velocidade da boca por parâmetro —
  toca o clipe exatamente como autorado, sem ajuste nenhum exposto (ao
  contrário do fogo de cauda/piscar, que têm vários parâmetros).
- Som de invocar/recolher criatura — mecanismo preparado à parte
  (`SummonPulse`/`RecallPulse`, registries/systems de áudio,
  `bot/index.js`), vira feature própria mais pra frente, não faz parte
  desta.
