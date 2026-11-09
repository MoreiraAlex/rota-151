# 🚀 Versão 0.0.65 — Sons do mundo

## Resumo

O mundo já tem bioma, hora, clima, água e cidade, mas quase nada disso soa.
Hoje há só o vento esporádico do nível (019) e a chuva, o vento forte e o
trovão (048). Esta feature dá ao mundo:
- **música de fundo no estilo do Minecraft**: de vez em quando uma música
  calma, sorteada pelo bioma e pela hora, toca inteira; entre uma e outra,
  silêncio. A batalha tem a sua própria;
- **ambiente**: um fundo por bioma e hora (pássaros, cigarras, grilos,
  cidade), coruja à noite, rajadas de vento, e a água de lagos e rios
  soando de onde está;
- **volume separado** de música, ambiente e efeitos, salvo na conta.

A feature vai em partes, com o usuário testando ao vivo entre elas.

| Parte | O quê | Estado |
|---|---|---|
| 1 — Canais de volume | Música, ambiente e efeitos com volume próprio, tela "Som" no menu, salvo na conta | feita |
| 2 — Música de exploração | Estilo Minecraft: música inteira sorteada por bioma e hora, silêncio entre uma e outra, frequência na tela "Som" | feita |
| 3 — Música de batalha | Entra quando começa uma luta, sai depois de um tempo sem combate | feita |
| 4 — Ambiente por bioma e hora | Fundo por bioma, noite, coruja, rajadas de vento, chuva abafando os bichos | feita |
| 5 — Água | Lago e rio soando de onde estão, mais alto conforme chega perto | feita |

Versão: `0.0.65` (`package.json`). Branch: `feature/065-sons-do-mundo`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do som).

---

## O que já existe (ponto de partida)

- **Listener único** (`view/audio/audioListener.js`): um `THREE.AudioListener`
  pro jogo todo. O desbloqueio do áudio do navegador (primeiro clique) fica
  em `AmbientAudio.jsx` e vale pra todos os sons.
- **Vento esporádico do nível** (019): `TEST_LEVEL.ambientSound` +
  `AmbientAudio.jsx` / `ambientAudioState.js` / `ambientAudioSystem.js`.
  Toca uma rajada de vez em quando, igual em todo lugar.
- **Clima** (048): `WeatherAudio.jsx` monta chuva e vento forte em loop e o
  trovão; `weatherAudioSystem.js` mexe no volume pela intensidade;
  `lightningSystem.js` toca o trovão.
- **Som com posição e alcance** (062): `spatialAudio.js` e `soundRanges.js`
  (volume cai com a distância). Os efeitos (passo, voz, golpe, pokébola,
  dash, pulo, invocar/recolher, itens do mundo) já usam isso.
- **Hora**: `WorldClock` + `dayPhaseOf` / `isDaytime`
  (`core/time/dayCycle.js`).
- **Bioma num ponto**: `TEST_LEVEL.terrain.biomeAt(x, z)` (e os pesos de cada
  bioma, `biomeMap.weightsAt`). A cidade é um bioma (`city`, 056). Os biomas
  escondidos (`BIOMES.HIDDEN`) só aparecem pelo F2.
- **Água** (057): `waterDepthAt` / `nearWaterAt` (`core/terrain/water.js`);
  a correnteza (`flowAt`) separa rio de lago.
- **Luta**: `CombatMode` (`traits/components/combatMode.js`) marca quem está
  em combate e sai sozinho depois de `BATTLE.COMBAT_MODE_TIMEOUT` sem atacar.
- **Save** (044): `saveFormat.js` (`SAVE_VERSION` + migrações), tabela
  `Trainer` no Prisma.
- **Menu de pausa** (015): `PauseMenu.jsx`. "Configurações" hoje é o editor
  do `GAME_CONFIG` (ferramenta de dev), não tem nada pro jogador.
- **Convenção do áudio**: sem seção `AUDIO` no `gameConfig.js`. Volume,
  alcance e intervalo moram junto do próprio som em `core/data/audio/`.

---

## Os áudios (já em `public/assets/audio/`)

Escolhidos e convertidos antes da Parte 1. Os originais ficam em
`.exemple/music/` e `.exemple/ambient-065/`; a conversão é o
`scripts/audio/sons-do-mundo.sh` (precisa do `ffmpeg`): iguala o volume
entre as faixas, corta o que não toca e salva em `.ogg`.

**Música de exploração** (`music/`, originais em `.exemple/music-pla/`), da
trilha do Legends Arceus — peças lentas, de piano e cordas, de alguns
minutos, que terminam no próprio fade:

| Lista | Arquivos | Faixas originais |
|---|---|---|
| Planície, dia | `plains-day-1..3` | Obsidian Fieldlands 1-1, Cobalt Coast 1-1, Cobalt Coast 2-1 |
| Floresta, dia | `forest-day-1..3` | Obsidian Fieldlands 2-1, Obsidian Fieldlands 1-2, Lake |
| Savana, dia | `savanna-day-1..3` | Crimson Mirelands 1-1, 2-1, 2-2 |
| Cidade, dia | `city-day-1..2` | Village, Jubilife Village |
| Noite (todo lugar) | `night-1..4` | Night, Late Night, Investigation Report Night, Clefairy's Moonlit Meeting |

As versões "-1" e "-2" de cada área do jogo são quase iguais; foram
escolhidas peças diferentes entre si, pra variar de verdade.

**Batalha** (`music/battle-wild`, original em `.exemple/music/`): Battle!
(Wild Pokémon), do Brilliant Diamond / Shining Pearl. Essa repete: o ponto
de loop foi medido comparando o áudio com ele mesmo, e o arquivo foi cortado
logo depois do fim do loop.

A primeira versão da Parte 2 usava as rotas do BDSP em loop contínuo (uma
por bioma × dia/noite); o usuário preferiu o estilo do Minecraft, com
músicas calmas e silêncio entre elas, e as rotas saíram.

**Ambiente** (`ambient/`), do BigSoundBank (CC0):

| Arquivo | Uso | Original |
|---|---|---|
| `forest-day` | fundo da floresta de dia | Forest #4 |
| `plains-day` | fundo da planície de dia | Countryside |
| `savanna-day` | fundo da savana de dia | Cicadas |
| `night` | fundo da noite (todos os biomas) | Campaign at night #3 |
| `city` | fundo da cidade | Village, city center #1 |
| `lake` / `river` | água parada / correnteza | Pond in a field / Small stream |
| `owl-01`, `owl-02` | coruja (avulso) | Tawny owl #1, #2 |

Os fundos foram emendados (o fim funde com o começo) pra repetir sem clique.
As rajadas de vento continuam sendo `wind-01` / `wind-02` (019).

---

## Decisões (com o usuário)

1. **Música no estilo do Minecraft**: a música não toca o tempo todo. Uma
   música calma toca inteira, uma vez; depois vem um silêncio sorteado
   (entre uns 2 e 5 minutos na frequência normal) e então a próxima. Há
   várias músicas por bioma × dia/noite, e a próxima é sorteada da lista do
   lugar e da hora no momento de começar.
2. **Batalha**: a música de batalha entra a qualquer momento em que uma luta
   começa e sai depois de um tempo sem combate.
2a. **Frequência da música** na tela "Som": pouca, normal ou sempre (sempre
   = quase sem silêncio). Salva na conta, com os volumes.
3. **Volumes salvos na conta**, junto do save (não no navegador).
4. **O vento esporádico da 019 vira parte do ambiente novo**: as rajadas
   tocam por cima do fundo de dia da planície e da savana; o som avulso do
   nível (`TEST_LEVEL.ambientSound`) sai. O vento forte do clima (048) fica
   como está. *(Escolha minha, o usuário deixou em aberto.)*

### Decisões minhas (para revisar)

5. **Dia e noite**: "dia" é `isDaytime` (o sol acima do horizonte).
6. **Mudar de bioma ou de hora não corta a música**: como no Minecraft, a
   que está tocando vai até o fim; o lugar e a hora só escolhem a próxima.
   A noite usa a mesma lista em todo lugar. O ambiente segue os pesos dos
   biomas (cruza devagar na borda).
6a. **A primeira música** vem pouco depois de entrar no mundo
   (`MUSIC.FIRST_DELAY`), não depois de um silêncio inteiro; e a próxima
   nunca repete a última.
7. **Bioma escondido** (só pelo F2): toca a música e o ambiente da planície.
8. **Chuva**: abafa os pássaros e as cigarras (o fundo de dia baixa com a
   intensidade da chuva). A música não muda.
9. **Canais**: clima e água contam como **ambiente**; todo o resto que já
   existe (passos, vozes, golpes, pokébola, itens) é **efeitos**.
10. **Memória**: um áudio decodificado ocupa bem mais que o `.ogg` (uma
    faixa de um minuto em estéreo passa de 20 MB). As músicas de exploração
    vêm por streaming (um `<audio>` ligado no canal de música), sem
    decodificar inteiras. A de batalha (repete, precisa do loop exato) e os
    fundos do ambiente são decodificados; dos fundos, só ficam os dos biomas
    em volta.

---

## Parte 1 — Canais de volume

### Objetivos
- Três canais: **música**, **ambiente** e **efeitos**, cada um com volume
  próprio, mais um volume geral.
- Uma tela **"Som"** no menu de pausa, pro jogador, com um controle
  deslizante por canal.
- O volume fica salvo na conta e volta ao abrir o jogo.

### Como funciona
- `view/audio/audioMixer.js` (novo): um `GainNode` por canal, ligado na
  entrada do listener. Quem cria um som diz o canal, e o som passa por ele.
  Todos os sons que já existem passam a ir pro canal certo (decisão 9).
- Volume do jogador: estado de UI + save. Fica no trainer do save
  (`settings.volume = { master, music, ambient, effects }`). O mixer lê
  esse valor; o menu escreve por uma action.
- Save: `SAVE_VERSION` sobe, com migração que dá os volumes padrão a quem
  não tem. Campo novo `settings Json?` na tabela `Trainer` (migração do
  Prisma).
- O volume salvo entra antes do primeiro som tocar (o mesmo carregamento
  que já põe o treinador no lugar).

### Config
- `core/data/audio/mixer.js` (novo): canais e volume padrão de cada um.

### Etapas
- [x] Mixer com os canais; ligar os sons existentes no canal de cada um.
- [x] `settings.volume` no save (schema, migração, Prisma).
- [x] Tela "Som" no menu de pausa (botão novo na tela principal).
- [x] Mudar o volume vale na hora e entra no próximo save automático.

### Testes (regras, sem fixar valores)
- Migração: save da versão anterior ganha os volumes padrão do dado.
- Save → carregar devolve os mesmos volumes.
- Volume fora do intervalo é recusado pelo schema.
- Todo som registrado tem um canal que existe.

### Critérios de conclusão
- Cada controle muda só o seu canal; zerar o geral cala tudo.
- Fechar e abrir o jogo mantém os volumes.

---

## Parte 2 — Música de exploração

### Objetivos
- No estilo do Minecraft: de vez em quando uma música calma toca inteira,
  e entre uma e outra fica o silêncio (o ambiente).
- A música é sorteada da lista do bioma e da hora, sem repetir a última.
- O jogador escolhe a frequência (pouca, normal, sempre) na tela "Som".

### Como funciona
- **Regras** (puras, `core/audio/music.js`): `musicPool` (a lista do
  bioma e da hora; bioma sem lista usa a da planície), `pickTrack` (sorteia
  sem repetir a última) e `silenceDuration` (o silêncio da frequência). O
  sorteio recebe a função de aleatório de quem chama (música é cosmética).
- **Ciclo** (`view/systems/musicSystem.js`, `presentation`):
  1. ao entrar no mundo, espera `MUSIC.FIRST_DELAY`;
  2. sorteia uma música pelo bioma de quem o jogador controla (treinador
     ou a criatura no controle) e pela hora, e toca inteira;
  3. terminou: silêncio sorteado pela frequência, e volta ao 2.
  Mudar de bioma ou de hora não corta a música (decisão 6). Trocar a
  frequência no meio do silêncio encurta a espera se a nova for menor.
- **Tocador** (`view/audio/musicPlayer.js`): a música vem por streaming
  (um `<audio>` ligado no canal de música por um `THREE.Audio`), sem
  decodificar inteira (decisão 10). Só começa depois de o navegador liberar
  o áudio (primeiro clique).
- **Frequência**: `SoundSettings.musicFrequency`, salva com os volumes;
  `definirFrequenciaDaMusica` escreve (o menu).

### Config
- `core/data/audio/musicTracks.js`: `MUSIC_TRACKS` (arquivo e volume de
  cada música), `BIOME_MUSIC` (as listas por bioma, de dia e de noite),
  `MUSIC_FREQUENCIES` (o silêncio de cada frequência, ex.: normal de `120`
  a `300` s), `MUSIC.FIRST_DELAY` e `MUSIC.FADE_OUT` (o sumiço quando a
  música é interrompida, Parte 3).

### Etapas
- [x] Músicas calmas convertidas e as listas por bioma e hora.
- [x] Regras (lista, sorteio, silêncio) e o ciclo no `musicSystem`.
- [x] Tocador por streaming.
- [x] Frequência no `SoundSettings`, no save e na tela "Som".

### Testes (regras, sem fixar valores)
- Todo bioma visível da beta tem lista de dia e de noite; bioma sem lista
  usa a de reserva; toda música citada existe e não tem loop.
- O sorteio não repete a última (se há outra) e não sai da lista.
- O silêncio fica entre o mínimo e o máximo da frequência; frequência
  desconhecida usa a padrão.
- Frequência no save: ida e volta, a padrão quando falta, desconhecida é
  recusada.

### Critérios de conclusão
- Pouco depois de entrar no mundo toca uma música, que vai até o fim.
- Depois dela, silêncio; em seguida outra (não a mesma).
- Em "Sempre", uma atrás da outra; em "Pouca", bem espaçadas.
- À noite tocam as da noite; mudar de bioma no meio não corta a música.

---

## Parte 3 — Música de batalha

### Objetivos
- A música de batalha entra quando uma luta começa e sai depois de um tempo
  sem combate (decisão 2).

### Como funciona
- **Em luta**: uma selvagem está perseguindo alguém do grupo (partiu pra
  cima ou revidou), ou uma criatura do time está lutando com uma. Golpe no
  vazio não conta. Uma regra pura (`core/audio/battleMusic.js`) responde
  "em luta?" lendo os traits.
- **Entrar**: a música de exploração que estiver tocando some
  (`MUSIC.FADE_OUT`) e a de batalha entra e repete no loop dela.
- **Sair**: depois de `MUSIC.BATTLE_HOLD` sem luta,
  a música da batalha some e começa o silêncio da Parte 2 (como depois de
  qualquer música).

### Config
- Em `musicTracks.js`: `MUSIC.BATTLE_TRACK` (a música), `MUSIC.BATTLE_HOLD`
  (ex.: `3` s sem combate pra sair) e `MUSIC.FADE_OUT` (o sumiço, o mesmo
  da exploração).

### Etapas
- [x] Regra "em luta" a partir dos traits.
- [x] A batalha interrompe a exploração e a espera pra sair.

### Testes (regras, sem fixar valores)
- Uma selvagem perseguindo o treinador ou o time, ou uma criatura do time
  lutando com uma selvagem, põe "em luta".
- Golpe no vazio (só o modo combate) não conta; luta de outro treinador,
  só entre selvagens, ou selvagem que não está perseguindo, também não.
- Sai só depois de `BATTLE_HOLD` sem combate; uma nova luta zera a espera.

### Critérios de conclusão
- Uma selvagem partiu pra cima (ou você atacou): a música de exploração
  some e a de batalha entra.
- A luta acabou: depois de um tempo a de batalha some e fica o silêncio;
  a próxima música vem no tempo da frequência.

---

## Parte 4 — Ambiente por bioma e hora

### Objetivos
- Um fundo em loop por bioma de dia (floresta, planície, savana), um de
  noite, um da cidade.
- Coruja de vez em quando à noite (floresta e planície).
- Rajadas de vento de vez em quando no dia da planície e da savana (vem da
  019; decisão 4).
- Chuva abafa os pássaros e as cigarras (decisão 8).

### Como funciona
- `view/systems/ambientBedSystem.js` (novo): o volume de cada fundo é o peso
  do bioma em volta do jogador (`weightsAt`) × o quanto é dia ou noite,
  suavizado. Na borda, os dois fundos cruzam devagar. Fundo com volume
  zero não toca.
- Avulsos (coruja, rajada): intervalo sorteado entre um mínimo e um máximo,
  como o vento de hoje. A coruja toca de um ponto ao redor do jogador
  (som com posição), a rajada toca sem posição.
- O vento avulso da 019 (`TEST_LEVEL.ambientSound`, `AmbientAudio.jsx` e
  companhia) sai; o desbloqueio do áudio vai pro mixer (Parte 1).

### Config
- `core/data/audio/ambientBeds.js` (novo): `AMBIENT_BEDS` (arquivo e
  volume de cada fundo), `BIOME_AMBIENCE` (o fundo de dia e de noite de
  cada bioma), `AMBIENT_ONE_SHOTS` (os avulsos: arquivos, volume,
  intervalo, biomas, hora e, na coruja, o alcance e onde nasce — ex.:
  coruja de `40` a `120` s) e `AMBIENCE` (`TWILIGHT`, `LEVEL_SMOOTHING`,
  `PROBE_INTERVAL`, `RAIN_DUCKING` — ex.: `0.75` — e
  `ONE_SHOT_MIN_PRESENCE`).

### Etapas
- [x] Dado dos fundos e avulsos por bioma.
- [x] `ambientBedSystem` com os pesos e a hora.
- [x] Coruja e rajadas; tirar o ambiente avulso da 019.
- [x] Chuva abafando o fundo de dia.

### Testes (regras, sem fixar valores)
- Os volumes dos fundos seguem os pesos dos biomas (soma igual ao peso
  total; bioma ausente fica sem som).
- De dia não toca coruja; de noite não tocam rajadas.
- Com chuva máxima, o fundo de dia baixa pelo `RAIN_DUCKING`.

### Critérios de conclusão
- Cada bioma tem o seu som; à noite muda pra grilos.
- Na cidade se ouve a cidade.
- Ao entrar na chuva, os pássaros somem.

---

## Parte 5 — Água

### Objetivos
- Perto de lago se ouve água parada; perto de rio, correnteza. O som vem
  da água e fica mais alto ao chegar perto.

### Como funciona
- Busca da água mais perto, de tempos em tempos (não a cada frame), com
  anéis em volta de quem o jogador controla, como `nearWaterAt`, mas
  devolvendo o ponto de cada tipo. Rio ou lago pela correnteza (`flowAt`)
  no ponto.
- Um som com posição pra lago e um pra rio, movidos pro ponto achado, com
  o alcance do `soundRanges` (062). Sem água no raio, silêncio.

### Config
- `core/data/audio/waterSounds.js` (já existe, dos respingos): entra
  `WATER_AMBIENT` — por tipo, o arquivo, o volume e o alcance; e a busca
  (`SEARCH_RADIUS`, `SEARCH_STEP`, `SEARCH_DIRECTIONS`, `RIVER_FLOW`),
  `PROBE_INTERVAL` (ex.: `0.5` s) e `MOVE_SMOOTHING`.

### Etapas
- [x] Busca do ponto de água mais perto (pura, em `core/terrain/water.js`).
- [x] Os dois sons com posição.

### Testes (regras, sem fixar valores)
- Sem água no raio, nada é achado; com água, o ponto achado está na água.
- Ponto com correnteza conta como rio; sem, como lago.
- O ponto achado fica a no máximo um passo da margem mais próxima; em cima
  da água, distância zero.
- O raio da busca alcança todo som que ainda se ouve.

### Critérios de conclusão
- Chegando num rio, a correnteza cresce e vem do lado dele.

---

## Wiki (no fim da feature)

Feito no fechamento: seção **"Sons e música"** na página "O mundo"
(`WorldPage.jsx`, e o resumo da página em `pages.js`) — a música no estilo
do Minecraft (lugar e hora escolhem a próxima, silêncio entre elas), a
música de batalha (quando entra e quando sai; golpe no vazio não conta), o
ambiente de cada bioma e da noite, coruja, vento, chuva abafando os bichos,
a água de lagos e rios, e a tela "Som" (volumes e frequência, salvos na
conta). A tabela do silêncio de cada frequência sai do jogo
(`world.musicSilence` no `wikiData.js`, com teste).

---

## Como ficou (implementação)

### Parte 1

- **Dado**: `core/data/audio/mixer.js` — `SOUND_CHANNELS`, `VOLUME_KEYS`
  (`master` + canais) e `DEFAULT_VOLUMES`.
- **Estado**: trait `SoundSettings` no treinador
  (`traits/components/soundSettings.js`), com os padrão ao nascer
  (`world.js` e `makeWorld`). Escreve só `definirVolume`
  (`core/actions/soundSettings.js`, prende entre 0 e 1 e ignora chave
  desconhecida) e o `restoreTrainer`.
- **Save**: `SAVE_VERSION` 6. `trainer.settings.volume` no schema; a
  migração 5 → 6 põe os padrão. `serializeTrainer` / `restoreTrainer` levam
  e trazem. No banco, coluna `settings` (JSONB) no `trainer` (migração
  `20261109120000_ajustes_do_treinador`, já aplicada no banco local);
  `saveRepository.js` traduz.
- **Áudio**: `view/audio/audioMixer.js` — um `GainNode` por canal ligado
  no listener; `routeToChannel(audio, canal)` liga a saída de um som no
  canal; o geral é o volume do listener. `createPositionalAudio` ganhou
  `channel` (padrão `effects`), então passos, vozes, golpes, pokébola e
  itens já caem em efeitos. Clima e o vento avulso da 019 vão pro
  `ambient`. `audioMixerSystem` (fase `presentation`) aplica os volumes do
  trait quando mudam.
- **Menu**: botão "Som" na tela principal do menu de pausa →
  `tools/menu/SoundSettingsPanel.jsx`, um controle deslizante por chave.
  Arrastar muda na hora; soltar pede um save (`pedirSave`).
- **Testes**: `soundSettings.test.js` (action), `mixer.test.js` (dado),
  `saveFormat.test.js` (migração 5 → 6, sem ajustes é recusado, volume fora
  de 0 a 1 é recusado) e `trainerSave.test.js` (ida e volta dos volumes).

### Parte 2

Primeira versão (rotas do BDSP em loop contínuo, uma por bioma ×
dia/noite, com troca suave e espera na borda) trocada pelo estilo do
Minecraft a pedido do usuário. O que ficou:

- **Dado**: `core/data/audio/musicTracks.js` — `MUSIC_TRACKS` (15 músicas
  do Legends Arceus, mais a de batalha com o loop medido), `BIOME_MUSIC`
  (listas por bioma; a noite é a mesma lista em todo lugar),
  `MUSIC_FREQUENCIES` + `DEFAULT_MUSIC_FREQUENCY` e `MUSIC`
  (`FIRST_DELAY`, `FADE_OUT`).
- **Regras** (`core/audio/music.js`): `musicPool`, `pickTrack`,
  `randomBetween`, `silenceDuration`.
- **Tocador** (`view/audio/musicPlayer.js`): um `<audio>` só, ligado no
  canal de música por `THREE.Audio.setMediaElementSource`; `playSong`,
  `fadeOutSong` / `updateSong` (pra batalha), `currentSong`,
  `canPlayMusic` (o contexto de áudio já liberado). Se o navegador recusar
  o `play`, conta como terminada.
- **Ciclo** (`view/systems/musicSystem.js`): espera inicial → sorteia e
  toca → silêncio pela frequência → de novo. `MusicAudio.jsx` (em
  `GameScene`) para tudo e zera o ciclo ao sair da cena.
- **Frequência**: campo `musicFrequency` no `SoundSettings`;
  `definirFrequenciaDaMusica`; no save, `settings.musicFrequency` com a
  padrão quando falta (a versão do save continua a 6, que ainda não foi
  publicada); botões "Pouca / Normal / Sempre" na tela "Som".
- **Testes**: `music.test.js` (as regras), `musicTracks.test.js` (arquivos
  existem, listas completas, músicas de exploração sem loop, o loop da
  batalha cabe no arquivo — duração lida do próprio `.ogg` por
  `src/test/oggDuration.js` — e os intervalos são válidos), e os de
  ajustes e save ganharam a frequência.

### Parte 3

- **Regras** (`core/audio/battleMusic.js`): `isGroupInBattle(world,
  trainer)` — uma selvagem em `'chase'` cujo `WildBehavior.target` é do
  grupo (`resolveOwner`), ou uma criatura do time (`SummonedCreature` +
  `OwnedBy`) com `PartyBehavior.state` `'fight'`. A música começa na veia
  de raiva, antes do primeiro golpe. A primeira versão contava o
  `CombatMode` do próprio grupo, e um golpe no vazio tocava a música de
  batalha; o usuário pediu pra tirar. Com isso a saída também deixou de
  depender do `COMBAT_MODE_TIMEOUT`: é só o `BATTLE_HOLD` depois de a luta
  acabar. Nos dois lados a selvagem tem que estar ainda na luta
  (`isActiveCombatant`): desmaiada ou na Pokébola, a IA dela para de
  decidir e o `'chase'` fica parado com o alvo de antes — a música não
  acabava até recolher o Pokémon (relatado jogando).
  `advanceBattleHold` — entra na hora, sai depois de `BATTLE_HOLD` s sem
  luta.
- **Tocador**: a batalha num `THREE.Audio` com o buffer decodificado (o
  loop exato precisa dele) e os pontos de loop da faixa; carregado no
  primeiro frame com o áudio liberado, pra entrar na hora. `startBattle
  Music` (do começo, ou subindo de volta se estava sumindo),
  `stopBattleMusic` / `updateBattleMusic` (o sumiço).
- **Ciclo** (`musicSystem`): em luta, a música de exploração some, a de
  batalha toca e a espera do ciclo fica parada. Fora da luta, a de batalha
  some; enquanto some, conta como tocando, e o silêncio começa quando ela
  acaba. A música interrompida não volta (a próxima é sorteada depois do
  silêncio).
- **Testes**: `battleMusic.test.js` (quem conta como luta e a espera) e
  `musicTracks.test.js` (a música de batalha existe e tem loop).

### Parte 4

- **Regras** (`core/audio/ambience.js`, puras): `daylightFactor` (quanto é
  dia pela altura do sol, misturando no amanhecer e no entardecer),
  `ambientBedLevels` (peso de cada bioma × dia/noite; a chuva baixa só o de
  dia; bioma sem entrada usa a planície) e `oneShotPresence` (quanto um
  avulso combina com o lugar e a hora).
- **Estado** (`view/audio/ambientBeds.js`): um `THREE.Audio` em loop por
  fundo no canal de ambiente; o áudio decodificado só existe enquanto o
  fundo pode soar (`requestBed` / `releaseBed`, fora do cache que guarda
  pra sempre). Os avulsos: a coruja com posição (presa no grupo da cena),
  a rajada sem.
- **System** (`view/systems/ambientBedSystem.js`, `presentation`): lê os
  pesos dos biomas em volta (`terrain.sample`) de tempos em tempos; cada
  fundo vai suave até o volume pedido; fundo que some para e é largado.
  Avulsos: na vez de cada um, toca se a presença passa do mínimo; a coruja
  nasce num ponto sorteado em volta do jogador, no alto.
- **Componente** (`AmbientAudio.jsx`, reescrito): monta tudo e continua
  liberando o áudio do navegador no primeiro clique.
- **Saiu o vento avulso da 019**: `TEST_LEVEL.ambientSound`,
  `core/data/audio/ambientSound.js`, `view/audio/ambientAudioState.js`,
  `view/systems/ambientAudioSystem.js` e os testes deles. As rajadas
  voltaram como avulso do dia na planície e na savana.
- **Áudio**: os fundos ficaram com cerca de um minuto, em mono (ficam
  decodificados na memória).
- **Testes**: `ambience.test.js` (as regras) e `ambientBeds.test.js`
  (arquivos existem, todo bioma visível tem fundo de dia e de noite, os
  avulsos são válidos).

### Parte 5

- **Busca** (`core/terrain/water.js`, pura): `nearestWaterPoints(depthAt,
  flowAt, x, z, { radius, step, directions, riverFlow })` → `{ lake,
  river }`, cada um `{ x, z, distance }` ou `null`. Começa no próprio
  ponto e vai em anéis; para quando achou os dois tipos.
- **Custo**: medido no Node (PC), cerca de 1,4 ms por busca com os valores
  de hoje, uma vez a cada `PROBE_INTERVAL`. Se pesar no celular, dá pra
  espaçar mais ou dividir os anéis entre frames.
- **Sons** (`view/audio/waterAmbient.js` + `WaterAmbientView.jsx`, na
  `GameScene`): um `PositionalAudio` em loop por tipo, no canal de
  ambiente, preso num `Object3D` da cena.
- **System** (`view/systems/waterAmbientSystem.js`, `presentation`): roda a
  busca a partir de quem o jogador controla, põe cada som no ponto achado
  (na hora na primeira vez, deslizando depois) na altura da água, e toca;
  sem água daquele tipo no raio, pausa. O volume pela distância é o do
  alcance do som (062).
- **Áudio**: os fundos de lago e rio foram encurtados (ficam decodificados
  na memória); água corrente não deixa a repetição aparecer.
- **Testes**: `water.test.js` (busca: tipo certo, perto da margem, nada sem
  água, zero em cima dela) e `waterSounds.test.js` (arquivos, alcance e o
  raio da busca cobrindo o alcance).

---

## Gates

No fechamento (o dev não estava rodando, então o build foi na própria
pasta):

- `npm test` (suíte inteira): 293 arquivos, 3192 testes passando (14
  pulados, os de sempre).
- `npm run lint`: sem avisos nem erros (rodado de novo depois da wiki).
- `npm run build`: compilou. Só o aviso de sempre do Better Auth
  (`BETTER_AUTH_SECRET` não definido no ambiente do build).

Durante as partes, só os testes dos arquivos mexidos. A migração do banco
(`20261109120000_ajustes_do_treinador`) já foi aplicada no banco local na
Parte 1.

---

## Fora de escopo

- Música e som dos biomas escondidos (cada um quando for refinado).
- Música de ginásio, Pokécenter, loja e dentro das estruturas (066).
- Jingle de vitória ao fim da luta.
- Som próprio do treinador e da treinadora (070).
