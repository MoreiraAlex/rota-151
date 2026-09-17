# 🚀 Versão 0.0.19 — Som ambiente, passos, vocalização, dash e pulo

Primeiro mecanismo de áudio do jogo. Som de PASSO, VOCALIZAÇÃO periódica
("voz"/grito, tipo "cry" de Pokémon), som AMBIENTE do nível, som de DASH
e de PULO já nascem todos com áudio de verdade (o usuário indicou
`.exemple/Steps/Steps/`, `.exemple/fox/`, `.exemple/ambient/` e
`.exemple/dash/`+`.exemple/jump/`, nessa ordem, em rodadas separadas).
Passo/voz/dash/pulo funcionam pra qualquer personagem (treinador ou
criatura, controlado ou IA); ambiente é global, do nível.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Visão geral

Cinco peças, graus de prontidão diferentes:

- **Passos**: `.exemple/Steps/Steps/` (fora do repo, `.gitignore`) é uma
  biblioteca de SFX real (padrão de nomes de jogo de parkour tipo Mirror's
  Edge/DICE — `ConcreteFootStepWalk_01.ogg`, `MetalFootStepRunChild_07.ogg`
  etc., ~640 arquivos, várias superfícies/pesos, cada som em várias
  variações numeradas). **Nota de transparência**: parecem assets
  extraídos de um jogo comercial — usados a pedido explícito do usuário
  ("pode pegar qualquer um, depois eu ajusto"); vale confirmar direitos de
  uso antes de considerar definitivo/publicável. Variações de duas
  seleções (arbitrárias, trocáveis) foram copiadas pro repo:
  `ConcreteFootStepWalk/Run` e `MetalFootStepWalkChild/RunChild` — nomes
  de grupo (`FOOTSTEP_GROUPS`, hoje `medium`/`light`), quem usa cada um
  (hoje bot e fox os dois em `medium`) e os números de volume/alcance são
  ajuste ao vivo do usuário, mudam com frequência — ver
  `core/data/audio/footstepGroups.js` pro estado de verdade, não este
  texto.
- **Vocalização periódica** ("voz"): `.exemple/fox/` trouxe 2 gritos reais
  da fox (`Fox_01.wav`/`Fox_02.wav`, mesma nota de transparência sobre
  origem do arquivo se aplica). Toda entidade com `sounds.voice`
  configurado emite um som periodicamente (independente de andar/correr),
  intervalo sorteado de novo a cada vez — hoje só a `fox` tem arquivo; o
  `bot` já tem o mecanismo pronto (comentário em `bot/index.js`), só falta
  um clipe de vocalização do treinador.
- **Ambiente**: `.exemple/ambient/` trouxe 2 rajadas de vento reais
  (`01_wind.wav`/`02_wind.wav`, ~5-9s cada, mesma nota de transparência
  sobre origem do arquivo se aplica). Dúvida legítima do usuário resolvida
  numa conversa à parte (ver seção própria abaixo): clipe curto desses NÃO
  vira loop contínuo (soaria repetitivo) — toca esporadicamente, mesmo
  mecanismo da vocalização periódica, só que GLOBAL (do nível, não de uma
  entidade).

- **Dash e pulo**: `.exemple/dash/` (2 arquivos) e `.exemple/jump/` (3
  arquivos) trouxeram amostras reais, mesma nota de transparência sobre
  origem se aplica. Pedido explícito: "seguindo o mesmo princípio dos
  grupos de áudio" — ou seja, mesmo grupo compartilhado + override
  individual do som de passo, aplicado aqui também. Diferente de todos os
  outros quatro sons (que tocam por CICLO de passada, TEMPORIZADOR
  aleatório, ou os dois), dash/pulo tocam no INSTANTE do próprio evento —
  ver seção própria abaixo pra como cada um detecta esse instante.

Pedido explícito de estrutura pro som de PASSO (e, depois, DASH/PULO):
criaturas de tamanhos/estilos diferentes vão ter sons diferentes, mas
várias vão compartilhar o mesmo som (e as mesmas configs de volume/
alcance) — daí o conceito de GRUPO compartilhado + override individual
por espécie (seção abaixo), reaproveitado por
`core/data/audio/actionSoundGroups.js` pra dash/pulo em vez de duplicar a
mesma função de resolução de novo. Vocalização e ambiente NÃO têm esse
conceito de grupo ainda (não foi pedido pra eles) — cada espécie/o nível
declara a própria config ou nenhuma; adicionar grupo depois, se fizer
falta, é o mesmo desenho já usado pro passo/dash/pulo.

## Grupo compartilhado + override individual (`core/data/audio/footstepGroups.js`)

```js
// Ids/valores exatos são ajuste ao vivo — ver o arquivo de verdade.
export const FOOTSTEP_GROUPS = {
  medium: { volume: 0.02, refDistance: 6, walk: [...4 paths], run: [...4 paths] },
  light: { volume: 0.05, refDistance: 4, walk: [...5 paths], run: [...5 paths] },
}

export function resolveFootstepSound(species) {
  const sounds = species?.sounds
  if (!sounds) return null
  if (sounds.footstep) return sounds.footstep        // individual, vence
  if (sounds.footstepGroup) return getFootstepGroup(sounds.footstepGroup) // compartilhado
  return null
}
```

- `walk`/`run` são ARRAYS, não um path só — cada passo toca uma variação
  aleatória do array certo, evita o "clique" de repetir sempre o mesmo
  arquivo.
- `volume`/`refDistance` (distância de referência do falloff espacial do
  `THREE.PositionalAudio`) moram no GRUPO (ou no override individual) —
  "as outras configs" que viajam junto com o som escolhido, sem cada
  espécie repetir número.
- `core/data/species/bot/index.js`/`fox/index.js`: `sounds: {
  footstepGroup: '<id>' }` — qual id cada um aponta é ajuste ao vivo (hoje
  os dois usam `medium`, já demonstrando várias espécies compartilhando o
  mesmo grupo); `fox-red/green/blue` herdam o que `fox` apontar via
  `{...FOX, id: ...}`, sem precisar declarar de novo.
- Uma espécie que precisar de som PRÓPRIO usa `sounds: { footstep: {
  walk: [...], run: [...], volume?, refDistance? } }` em vez de
  `footstepGroup` — sem grupo nenhum, sem repetir número de ninguém (ver
  exemplo comentado em `_template/index.js`).
- Sem `sounds` na espécie (ou grupo/id desconhecido), `resolveFootstepSound`
  devolve `null` — a espécie simplesmente não tem som de passo ainda,
  mesmo fallback gracioso de qualquer conteúdo que ainda não existe no
  projeto.

## Detecção do instante do passo

Sem clipe autorado com marcação de "pé no chão" (os clipes deste projeto
são curvas proceduais, não mocap), o instante do passo é APROXIMADO a
partir do que a animação já expõe: `view/registry/animationRegistry.js`
mantém, por entidade, `entry.elapsed` (relógio de animação) e
`entry.clips[id].speed` (frequência do clipe ativo — mesmo valor que
`animationSystem.js` já usa pra tocar o clipe certo).

`phase = (elapsed * speed) mod 1` dá a fase normalizada do ciclo de
locomoção (0→1); dividir em 2 "beats" (`Math.floor(phase * 2)`) aproxima
passo esquerdo/direito — funciona igual pra bípede (bot) e quadrúpede
(fox) sem saber nada do rig, e já lida com `AnimationState.direction ===
-1` (andar de costas/lock-on, ver docs/features/016-mira-e-arremesso.md)
porque `elapsed` pode decrescer nesse caso e o módulo normaliza os dois
sentidos. Toca só na TROCA de beat (`previousBeat`, guardado no registry
de áudio) — nunca todo frame enquanto andando. Fora de `walk`/`run`,
`previousBeat` reseta pra `-1`: reentrar em andar/correr sempre dispara o
primeiro passo na hora.

## Vocalização periódica (`core/data/audio/voiceSound.js`)

Independente de andar/correr — puramente por TEMPO. Cada espécie declara
`sounds.voice: { clips: [...], volume?, refDistance?, minInterval?,
maxInterval? }` (sem conceito de grupo, ver "Visão geral" acima); sem
`voice`, a espécie simplesmente não vocaliza.

`view/registry/voiceAudioRegistry.js` guarda, por entidade, um `timer`
(segundos até a PRÓXIMA vocalização) que nasce sorteado entre
`minInterval`/`maxInterval` — EXCETO pra uma `SummonedCreature` recém-
invocada (`immediate: true` no registro, ver seção própria abaixo), que
nasce com `timer = 0`, senão toda entidade vocalizaria no mesmo instante
em que nasce. `view/systems/voiceAudioSystem.js` decrementa esse timer
por `delta`; ao chegar em zero (com pelo menos 1 buffer carregado), toca
uma variação aleatória de `clips` (`pickRandomVariation`, ver seção
própria abaixo) e sorteia um NOVO timer — cada vocalização tem um
intervalo diferente da anterior, não um período fixo, pra várias
entidades do mesmo tipo não soarem em coro. O timer só conta enquanto a
entidade não está vocalizando agora (`!audio.isPlaying`) — deixa o som
atual terminar, não corta no meio.

### Quantidade de variações é livre, e pode repetir (pedido explícito)

`clips` (voz) e `walk`/`run` (passo) são arrays de tamanho QUALQUER — uma
espécie pode ter 1 variação só, outra 5 ou mais; nada no código assume um
tamanho fixo. `view/audio/pickRandomVariation.js` (novo, extraído do que
antes era `Math.floor(Math.random() * array.length)` duplicado nos dois
systems) formaliza isso: sorteio independente a cada reprodução, COM
reposição — pode escolher a mesma variação duas vezes seguidas de
propósito, não existe lógica de "evitar repetir a última" (não foi
pedido; a única exigência é que o sorteio seja de verdade aleatório a
cada vez, não sempre a primeira/mesma).

### Criatura invocada já vocaliza na hora; recolher não precisa de nada

Pedido explícito do usuário. Resolvido em `useAnimatedModel.js`: ao
registrar o áudio de voz, `immediate: entity.has(SummonedCreature)` —
`true` só pra criaturas (nunca pro treinador, que não é "invocado", só
existe desde o início do jogo). Isso zera o `timer` inicial em vez de
sortear, e o próprio `voiceAudioSystem.js` já sabe tocar assim que houver
QUALQUER buffer carregado — reaproveita 100% do mecanismo existente, sem
código dedicado a "tocar no summon". Recolher não precisa de nada
especial: o cleanup do efeito já só para/desconecta o áudio, sem tocar
som nenhum — comportamento que já existia, não mudou.

## Ciclo de vida e posicionamento 3D

Estendido em `view/hooks/useAnimatedModel.js` (único lugar que já
cria/destrói recursos Three por entidade, usado por `PlayerView.jsx` e
`CreatureView.jsx`) em vez de um hook/componente novo — o áudio de passo
E o de voz nascem/morrem junto com o modelo, sem vazar nó de áudio quando
uma criatura é recolhida. Cada um é um `THREE.PositionalAudio` PRÓPRIO
(nós separados — podem soar ao mesmo tempo, ex.: correr e vocalizar
juntos), anexado ao MESMO `<group>` que `syncTransformSystem` já move
(via `viewRegistry`), então acompanham a entidade em 3D de graça, sem
system de posição próprio — a atenuação por distância (`refDistance`) já
vem do Web Audio.

`view/systems/footstepAudioSystem.js`/`voiceAudioSystem.js` (fase
presentation, perto de `animationSystem`) iteram só as entidades JÁ
REGISTRADAS em `view/registry/footstepAudioRegistry.js`/
`voiceAudioRegistry.js` — sem query ECS pra filtrar de novo, membership
no registry já significa "esta entidade tem esse som".

## O "ponto de escuta" acompanha a câmera (`audioListenerSystem.js`)

Achado jogando: o `refDistance` funcionava (som mais alto perto, mais
baixo longe), mas o PONTO de referência ficava fixo perto de onde o
treinador nascia, em vez de acompanhar a câmera.

Causa: a primeira versão anexava o `THREE.AudioListener` como FILHO da
câmera (`camera.add(listener)`, dentro de `getAudioListener(camera)`),
seguindo a recomendação padrão do Three.js — mas essa primeira chamada
vinha de `useAnimatedModel.js`, dentro de um `useEffect` sem `camera` nas
dependências (captura por closure, nunca reavalia). O R3F começa com uma
câmera IMPLÍCITA própria e só troca pela `<PerspectiveCamera makeDefault>`
de verdade (`GameScene.jsx`) logo em seguida — se aquela primeira chamada
corresse antes da troca, o listener ficava preso pra sempre na câmera
implícita abandonada (nunca movida por `cameraFollowSystem.js`), parada
perto da origem/spawn.

Correção: `getAudioListener()` não anexa mais o listener a NENHUMA
câmera. Um system novo, `view/systems/audioListenerSystem.js` (fase
presentation, depois de `cameraFollowSystem` — precisa da posição FINAL
da câmera neste frame — e antes de `footstepAudioSystem`), copia
`position`/`quaternion` de `context.camera` (sempre a câmera de verdade
do pipeline, nunca a implícita) pro listener TODO FRAME, e chama
`listener.updateMatrixWorld(true)` (dispara o override que empurra a
posição pro Web Audio de verdade). Elimina a dependência de parentesco no
grafo de cena e de qual componente resolveu a câmera primeiro —
determinístico, sempre a câmera certa.

## Som ambiente — esporádico, não loop contínuo (`core/data/audio/ambientSound.js`)

O usuário indicou `.exemple/ambient/` — 2 rajadas de vento reais
(`01_wind.wav`/`02_wind.wav`, ~5-9s cada). Pergunta em aberto: um loop
contínuo de uma faixa só, ou variações tocadas esporadicamente? Loop
contínuo de um clipe de poucos segundos soaria obviamente repetitivo — os
arquivos disponíveis pedem a segunda abordagem, que é exatamente o
mecanismo que a vocalização periódica (seção acima) já resolve: variação
aleatória, intervalo também aleatório entre reproduções.

Por isso o design mudou do plano original (`AmbientAudio.jsx` tocando uma
faixa única em `loop = true`) pra reaproveitar o esquema de
`voiceAudioSystem.js`, só que GLOBAL — não por entidade, já que som
ambiente não pertence a "alguém" no mundo:

- `core/data/testLevel.js`, campo `ambientSound: { clips: [...], volume?,
  minInterval?, maxInterval? }` — mesmo formato de `sounds.voice`, mas é
  dado de NÍVEL, não de espécie.
- `view/audio/ambientAudioState.js` (novo) — um objeto de módulo só
  (não um `Map`/registry por entidade) guardando `{ audio, buffers,
  minInterval, maxInterval, timer }`, já que só existe UM som ambiente no
  jogo inteiro.
- `view/audio/AmbientAudio.jsx` (reescrito): monta um `THREE.Audio` (não
  posicional — sem fonte física no mundo), carrega cada variação em
  `ambientAudioState`, e cuida do desbloqueio de autoplay do browser
  (`pointerdown` uma vez, `listener.context.resume()` — o MESMO listener
  compartilhado por passo/voz, então desbloqueia os três de uma vez). Não
  chama `.play()` diretamente mais — isso é responsabilidade do system.
- `view/systems/ambientAudioSystem.js` (novo) — mesma lógica de
  `voiceAudioSystem.js` (timer conta com `delta`, toca variação aleatória
  ao zerar, sorteia novo intervalo, só conta enquanto não está tocando
  agora), lendo o estado único em vez de iterar um registry.

Sem `TEST_LEVEL.ambientSound`, fica em silêncio, sem quebrar nada (mesmo
fallback gracioso de sempre).

## Som de dash e de pulo — tocam no INSTANTE do evento

Diferente dos outros três sons (ciclo de passada, temporizador aleatório,
ou os dois), dash/pulo são disparados por um EVENTO instantâneo — cada um
precisou de uma forma diferente de detectar esse instante, escolhida pra
não precisar de dado novo em ECS quando o sinal já existia, e pra ser
precisa quando não existia:

- **Dash**: `ActionState.current` já fica `'dash'` durante toda a duração
  da ação (~0.25s, vários ticks) — nenhum dado novo necessário.
  `view/systems/dashAudioSystem.js` detecta a BORDA DE SUBIDA (`entry.
  previousAction` guardado no registro — mesmo princípio de `previousBeat`
  do passo) e toca só no tick em que `current` vira `'dash'`, não todo
  tick enquanto a ação dura.
- **Pulo**: NÃO existia nenhum dado contínuo equivalente — pular é uma
  mudança instantânea de `Velocity.y`, não uma "ação com duração" como
  dash. Inferir "acabou de pular" só a partir do que a view já tinha
  (`Grounded`/`Velocity`) seria impreciso: a tag `Grounded` só cai 1-2
  ticks DEPOIS do disparo de verdade (o corpo ainda encosta no chão logo
  após o impulso), e uma cápsula quase parada no topo de uma queda
  também tem `vel.y` perto de zero — ambíguo com "acabou de aterrissar".
  Por isso ganhou um sinal novo e preciso no CORE: `Jumped`
  (`core/traits/components/physics.js`), um pulso de UM TICK adicionado
  por `characterPhysicsSystem.js` na MESMA condição que já aplica
  `vel.y = jumpSpeed`. Detalhe de corretude: o system só ADICIONA a tag,
  nunca remove — é `view/systems/jumpAudioSystem.js` quem tira, depois de
  tocar o som. Isso importa porque a fase `simulation` pode rodar mais de
  um tick fixo por frame renderizado (acúmulo de atraso, `GameLoop.jsx`)
  — se `characterPhysicsSystem` limpasse a tag todo tick sem pulo novo,
  um pulo disparado no primeiro tick fixo do frame podia ser apagado
  antes da `presentation` (que roda uma vez por frame) ter a chance de
  ver e tocar o som.

Os dois reaproveitam `pickRandomVariation` (variação aleatória) e o mesmo
formato `{ clips, volume?, refDistance? }` de grupo/individual — só a
detecção do instante muda.

## Arquivos-chave

- `core/data/audio/footstepGroups.js` — grupos, `getFootstepGroup`,
  `resolveFootstepSound`.
- `core/data/audio/voiceSound.js` — `resolveVoiceSound`, defaults de
  intervalo (sem grupo, ver "Visão geral").
- `core/data/audio/ambientSound.js` — `resolveAmbientSound`, defaults de
  intervalo (sem grupo, dado de NÍVEL, não de espécie).
- `core/data/audio/actionSoundGroups.js` — `createActionSoundResolver`,
  fábrica do padrão grupo+individual (extraída de `footstepGroups.js`
  pra dash/pulo reusarem sem duplicar a função de novo).
- `core/data/audio/dashSound.js`/`jumpSound.js` — grupos (`DASH_SOUND_
  GROUPS`/`JUMP_SOUND_GROUPS`, hoje só `default` em cada), construídos
  com a fábrica acima.
- `core/data/species/bot/index.js`/`fox/index.js`/`_template/index.js` —
  bloco `sounds` (footstep + voice + dashGroup + jumpGroup, ver seções
  acima).
- `core/data/testLevel.js` — `ambientSound: { clips, volume?,
  minInterval?, maxInterval? }` (real, 2 rajadas de vento).
- `core/gameConfig.js` — SEM seção `AUDIO` de propósito: volume/alcance/
  intervalo de todo som (passo, voz, ambiente) mora junto do próprio som
  que descreve (grupo/espécie, ou nível), nunca um número genérico igual
  pra tudo.
- `view/audio/audioListener.js` — `THREE.AudioListener` singleton, NÃO
  anexado a nenhuma câmera (ver "O ponto de escuta acompanha a câmera").
- `view/systems/audioListenerSystem.js` — copia posição/orientação da
  câmera pro listener todo frame.
- `view/audio/audioBufferCache.js` — `loadAudioBuffer(path)`, cache por
  path, nunca rejeita (resolve `null` em erro de carga).
- `view/audio/pickRandomVariation.js` — sorteio (com reposição, qualquer
  tamanho de array) reaproveitado por todos os systems de áudio de
  variação.
- `view/audio/ambientAudioState.js` — estado ÚNICO (não registry por
  entidade) do som ambiente: `{ audio, buffers, minInterval, maxInterval,
  timer }`.
- `view/audio/AmbientAudio.jsx` — monta o `THREE.Audio` (não posicional),
  carrega os buffers, cuida do desbloqueio de autoplay; não chama
  `.play()` mais (isso é do system).
- `view/registry/footstepAudioRegistry.js` — entidade → `{ audio,
  buffers: { walk, run }, previousBeat }` (formato próprio, dois arrays).
- `view/registry/createSimpleAudioRegistry.js` — fábrica do formato `{
  audio, buffers, ...extra }` (um array só) — extraída quando dash/pulo
  precisaram do MESMO formato que `voiceAudioRegistry.js` já usava
  (escrito antes da fábrica existir, não migrado pra não mexer em código
  já funcionando sem necessidade).
- `view/registry/dashAudioRegistry.js`/`jumpAudioRegistry.js` —
  construídos com a fábrica acima; dash guarda `previousAction` extra
  (detecta borda de subida), pulo não precisa de nada além do padrão.
- `core/traits/components/physics.js` — `Jumped` (tag pulso, ver seção
  "Som de dash e de pulo" acima).
- `core/systems/characterPhysicsSystem.js` — adiciona `Jumped` no tick do
  pulo de verdade (nunca remove — quem consome tira).
- `view/hooks/useAnimatedModel.js` — `setupPositionalActionSound` (helper
  local, não exportado) fatora a criação/carregamento/registro comum a
  voz/dash/pulo (formato `{ clips, volume?, refDistance? }`); passo
  continua com o próprio efeito (walk/run). Quatro `useEffect`s ao todo.
- `view/systems/footstepAudioSystem.js` — detecta a troca de beat e toca.
- `view/systems/voiceAudioSystem.js` — conta o timer (por entidade) e
  toca ao zerar.
- `view/systems/ambientAudioSystem.js` — mesma ideia, mas lê o estado
  único em vez de um registry.
- `view/systems/dashAudioSystem.js` — detecta a borda de subida de
  `ActionState.current === 'dash'` e toca.
- `view/systems/jumpAudioSystem.js` — consome o pulso `Jumped` e toca.
- `view/loop/registerSystems.js` — registra `audioListenerSystem`/
  `footstepAudioSystem`/`voiceAudioSystem`/`ambientAudioSystem`/
  `dashAudioSystem`/`jumpAudioSystem` na fase presentation.
- `public/assets/audio/footsteps/<grupo>/{walk,run}-0N.ogg` — arquivos
  reais (amostra de `.exemple/Steps/Steps/`); nome da pasta segue o id do
  grupo em `footstepGroups.js`, muda se o grupo for renomeado.
- `public/assets/audio/voices/fox/cry-0N.wav` — 2 arquivos reais (amostra
  de `.exemple/fox/`).
- `public/assets/audio/ambient/wind-0N.wav` — 2 arquivos reais (amostra
  de `.exemple/ambient/`).
- `public/assets/audio/dash/default/dash-0N.wav`/`jump/default/jump-0N.wav`
  — arquivos reais (amostra de `.exemple/dash/`/`.exemple/jump/`).
- Não muda: `pointerInput.js`/`keyboardInput.js` (nenhum sabe de áudio),
  `PlayerView.jsx`/`CreatureView.jsx` (só o hook que já usam ganha os
  efeitos por dentro), `animationStateSystem.js`/`animationSystem.js`
  (footstep só CONSOME o relógio que eles já produzem; voz/ambiente nem
  usam esse relógio, são por temporizador; dash lê `ActionState`, não
  precisa de `animationStateSystem` saber de nada novo), `playerActionSystem.js`
  (dispara/avança o dash normalmente — `Jumped` é adicionado por
  `characterPhysicsSystem.js`, não por ele).

## Bug real: recolher uma criatura derrubava o jogo

`Uncaught TypeError: Cannot read properties of undefined (reading 'id')`
em `footstepAudioSystem.js`, relatado jogando ao recolher uma criatura.

Causa: `applyRecall` (`partySummonSystem.js`) destrói a entidade no ECS
na fase `simulation` — SÍNCRONA e ANTES da `presentation`, dentro do
MESMO `useFrame` (`GameLoop.jsx`). Quem de fato tira a entidade dos
registries de áudio (`footstepAudioRegistry.js`/`dashAudioRegistry.js`/
etc.) é o cleanup do `useEffect` em `useAnimatedModel.js`, disparado só
quando `CreatureView` desmonta — e isso só acontece no PRÓXIMO commit do
React, depois deste mesmo frame já ter rodado `simulation` +
`presentation` inteiros. Por um frame inteiro, o registry ainda aponta
pra uma entidade que o koota já não tem mais NENHUM dado — `entity.get(
AnimationState)`/`entity.get(ActionState)` devolvem `undefined`, e o
código lia `.id`/`.current` direto em cima sem checar.

`footstepAudioSystem.js` e `dashAudioSystem.js` (os dois únicos que
chamam `entity.get(...)` e leem uma propriedade na sequência) ganharam a
checagem — sem o trait, trata como "não está andando/correndo"/"sem dash
em andamento", mesmo fallback gracioso de sempre; resolve sozinho assim
que o registry for limpo de verdade no frame seguinte.
`voiceAudioSystem.js` nunca lê trait nenhum (só timer) e `jumpAudioSystem.js`
usa `entity.has(...)` (não quebra do mesmo jeito) — não precisaram de
mudança.

## Testes

- `view/systems/footstepAudioSystem.test.js`/`dashAudioSystem.test.js`
  (novos) — regressão do bug acima: entidade destruída (`entity.destroy()`)
  ainda registrada não derruba o system; entidade viva sem estar andando/
  correndo (ou sem dash em andamento) também não quebra. Únicos dois
  `*AudioSystem.js` com teste — não tocam áudio de verdade, só provam que
  não lançam exceção nesses dois cenários (headless, sem depender de
  WebAudio: o crash acontecia ANTES de qualquer chamada de áudio).
- `core/data/audio/footstepGroups.test.js` — `getFootstepGroup` (id
  conhecido/desconhecido); `resolveFootstepSound`: sem `sounds`/sem
  `footstep`+`footstepGroup` declarados → `null`; `footstepGroup` resolve
  o grupo; grupo desconhecido → `null` (não quebra); `footstep` individual
  vence `footstepGroup` mesmo os dois declarados; `footstep` sozinho
  funciona; `bot`/`fox` (espécies reais) resolvem grupos diferentes;
  `fox-red/green/blue` herdam o grupo de `fox`; todo grupo em
  `FOOTSTEP_GROUPS` tem pelo menos uma variação de `walk` e `run`.
- `core/data/audio/voiceSound.test.js` — `resolveVoiceSound`: sem
  `sounds`/sem `voice` → `null`; `voice` declarado é devolvido como está
  (sem indireção de grupo); `fox` (espécie real) tem voz configurada;
  `bot` (espécie real) ainda não — mecanismo pronto, sem arquivo;
  `DEFAULT_VOICE_MIN_INTERVAL` menor que `DEFAULT_VOICE_MAX_INTERVAL`.
- `view/audio/pickRandomVariation.test.js` (novo) — sempre devolve um
  item que está de fato no array (1 variação só, ou várias); com muitas
  chamadas, não fica preso sempre no mesmo índice. Não testa "nunca
  repete o mesmo duas vezes seguidas" de propósito — não é esse o
  comportamento pedido.
- `view/registry/voiceAudioRegistry.test.js` — `registerVoiceAudio` com
  `immediate: true` começa o `timer` em `0`; sem `immediate` (ou `false`
  explícito), o `timer` sai sorteado dentro de `minInterval`/
  `maxInterval`. Registry é objeto puro (Map + mock de `audio`), por
  isso testável mesmo sem WebAudio.
- `core/data/audio/ambientSound.test.js` (novo) — `resolveAmbientSound`:
  nível sem `ambientSound` → `null`; nível `null`/undefined não quebra;
  `ambientSound` declarado é devolvido como está; `TEST_LEVEL` (nível
  real) tem som ambiente configurado; defaults de intervalo consistentes
  (mínimo < máximo).
- `view/audio/ambientAudioState.test.js` (novo) — `getAmbientAudioState`
  sempre devolve o MESMO objeto (estado global, não por entidade); mutar
  o estado persiste pra próxima leitura; `resetAmbientAudioState` volta
  tudo ao zerado/vazio. Também objeto puro, testável sem WebAudio.
- `core/data/audio/actionSoundGroups.test.js` (novo) — testa a FÁBRICA
  genérica (`createActionSoundResolver`) com grupos fictícios: `getGroup`
  (id conhecido/desconhecido); `resolve`: sem `sounds`/sem nenhuma das
  duas chaves → `null`; chave de grupo resolve; grupo desconhecido → `null`;
  chave individual vence a de grupo mesmo as duas declaradas; individual
  sozinha funciona; duas instâncias da fábrica não compartilham chaves
  entre si.
- `core/data/audio/dashSound.test.js`/`jumpSound.test.js` (novos) — não
  repetem a matriz de `actionSoundGroups.test.js` (já cobre a lógica em
  si); só confirmam a integração de verdade: todo grupo tem pelo menos
  uma variação; `bot`/`fox` (espécies reais) resolvem o grupo que cada um
  declara (`sounds.dashGroup`/`jumpGroup`), nunca `null`.
- `core/systems/characterPhysicsSystem.test.js` — 2 testes novos: pulo de
  verdade adiciona `Jumped`, e o system NUNCA remove sozinho (continua
  presente mesmo depois de vários ticks sem pular de novo — quem consome
  tira, ver `jumpAudioSystem.js`); sem `input.jump`, ou no ar (já sem
  `Grounded`), não adiciona.
- `view/registry/createSimpleAudioRegistry.test.js` (novo) — testa a
  FÁBRICA genérica: entrada nasce com `buffers` vazio; `extra` é mesclado
  na entrada; `get` de entidade nunca registrada devolve `undefined`;
  `unregister` remove a entrada (e não quebra se a entidade não estava
  registrada); `unregister` para o áudio se estava tocando, e desconecta;
  `all()` itera todas as entradas; duas instâncias da fábrica têm
  registries independentes.
- **Sem teste automatizado pro resto** (listener/buffer cache/hook/
  systems que de fato tocam áudio) — `AudioContext`/decodificação de
  buffer não existem no ambiente de teste (Vitest/node, sem WebAudio),
  mesmo caso já aceito no projeto pra `cameraFollowSystem.js`/
  `heldItemViewSystem.js`/`PathfindingDebugView.jsx` (nenhum tem
  `.test.js`, todos view/Three-dependentes). Verificação é manual
  (`npm run dev`).

## Fora de escopo

- Voz do treinador (`bot`) — mecanismo pronto, falta o arquivo.
- Grupo compartilhado pra vocalização/ambiente (só passo/dash/pulo têm
  isso hoje) — não pedido ainda pra eles; mesmo desenho de
  `footstepGroups.js`/`actionSoundGroups.js` se um dia fizer falta.
- Som de dash/pulo PRÓPRIO por espécie (`sounds.dash`/`sounds.jump`,
  sem grupo) — mecanismo já suporta (mesmo `createActionSoundResolver`
  de `footstepGroup`), só ninguém pediu um som individual ainda; hoje
  `bot`/`fox` os dois usam o grupo `default`.
- Slider de volume "de verdade" no menu de pausa — fica pro
  `ConfigEditor.jsx` genérico do F2 por enquanto. Como volume não é mais
  uma seção `GAME_CONFIG.AUDIO` (mora em cada som/nível/espécie), deixou
  de aparecer sozinho ali — ajustar ao vivo agora é editar
  `core/data/testLevel.js`/`species/<id>/index.js` direto, não pelo F2.
- Variação de PITCH por passo/voz/ambiente (só varia o ARQUIVO, não a
  velocidade de playback) — não pedido, fácil de adicionar depois se
  quiser mais variedade ainda.
- Som de pulo/aterrissagem, de itens, de UI — só passos/voz/ambiente
  foram pedidos até agora.
- Múltiplos "beats por ciclo" configuráveis por espécie (hoje fixo em 2,
  `BEATS_PER_CYCLE` em `footstepAudioSystem.js`) — quadrúpedes com marcha
  de 4 tempos ficariam mais realistas com um valor próprio; não pedido.
