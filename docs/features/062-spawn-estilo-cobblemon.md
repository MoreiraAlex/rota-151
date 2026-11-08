# 🚀 Versão 0.0.62 — Spawn estilo Cobblemon

## Resumo

Até aqui, os selvagens nasciam uma vez só, na abertura do jogo: um punhado
sorteado num quadrado em volta da origem, entre 9 espécies (iniciais
inclusive), e nunca sumiam. Agora o mundo se povoa sozinho em volta do
jogador, no molde do Cobblemon:

- **Teto por jogador**: há sempre até um número de selvagens vivos em volta
  de cada jogador ativo.
- **Nasce fora da vista**: longe o bastante e fora do que a câmera mostra.
- **Some quem ficou para trás**: três faixas de distância — perto nunca
  some, no meio some quem está velho e fora da vista, longe some.
- **Condições por espécie**: bioma (ou tags do bioma), horário, clima e
  raridade. Só as 7 selvagens têm spawn; os 3 iniciais não nascem no mundo.
- **Os selvagens entram no save**: fechar e abrir o jogo traz de volta os
  que estavam vivos, como estavam.

Versão: `0.0.62` (`package.json`). Branch: `feature/062-spawn-estilo-cobblemon`.

> **Renumeração do roadmap:** entraram no Marco 2, depois do spawn, a
> revisão da IA selvagem (063), a revisão da IA do parceiro (064) e o
> ambiente interno nas estruturas (065). Da antiga 063 em diante tudo andou
> +3 (os selvagens no servidor, era 073, agora é 076). Os docs das features
> antigas ficam com os números da época; os comentários do código que
> apontavam pro roadmap foram atualizados.
>
> Depois, os sons do mundo (ambientação e música) entraram no Marco 2 como
> 065, antes do ambiente interno nas estruturas (que virou 066). Da antiga
> 065 em diante tudo andou +1 (os selvagens no servidor viraram 077, o
> volume dos gritos dos iniciais 095); este doc já usa os números novos.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado da espécie).

---

## O que já existe (ponto de partida)

- **Spawn provisório** (020/021): `wildCreatureSpawnSystem` nasce
  `TEST_LEVEL.wildCreatures` uma vez, se não houver nenhuma `WildCreature`.
  A lista sai de `generateWildCreatures` (`core/data/testLevel.js`): espécie
  sorteada em `WILD_CREATURE_SPECIES`, posição num quadrado em volta da
  origem (`WILD_AREA_HALF_SIZE`), levada para a margem se cair em água funda
  (`shoreNear`, 057).
- **Traits de um selvagem**: o conjunto montado no próprio spawn system
  (`WildCreature`, `WildBehavior` com temperamento sorteado,
  `IndividualValues`, `CreatureLevel` por `rollWildLevel`, `Vitals`,
  `WanderState`, corpo físico ou placeholder etc.).
- **Biomas com tags** (047): `tags` em cada `core/data/biomes/<id>` (ex.:
  floresta `forest`, planície e savana `grassland`), `BIOMES.HIDDEN` para os
  que não aparecem na beta.
- **Horário e clima** (048): `dayPhaseOf(time)` (`dawn`/`day`/`dusk`/
  `night`) e `weatherAt(x, z, time)` (`clear`/`sun`/`rain`/`storm`/`snow`),
  feitos já pensando no spawn.
- **Água** (057): `waterDepthAt`; **cidade** (056): bioma `city`.
- **Itens no mundo** (055): molde de "ponto livre no chunk" (`findFreeSpot`:
  folga da borda, inclinação, fora dos sólidos) e de domínio no save.
- **Câmera**: `OrbitCamera.yaw` no core — dá para saber para onde ela olha
  sem o frustum do Three.
- **Desmaio** (031): o selvagem desmaiado acorda quando o tempo acaba.
- **Save** (044/055): `SAVE_VERSION` com migrações, domínios `trainer`,
  `pokemon` e `worldItems` (este numa coluna `Json` da tabela `trainer`).

---

## Decisões (com o usuário)

1. **Tabela de spawn das 7 espécies** (aprovada):

   | Espécie | Biomas | Horário | Clima | Raridade |
   |---|---|---|---|---|
   | Caterpie | floresta | dia | qualquer | comum |
   | Weedle | floresta | dia | qualquer | comum |
   | Pidgey | floresta, planície | dia | sem tempestade | comum |
   | Rattata | planície, savana | qualquer, mais à noite | qualquer | comum |
   | Spearow | savana | dia | qualquer | incomum |
   | Ekans | savana | qualquer | seco/sol (sem chuva) | incomum |
   | Pikachu | floresta, planície | qualquer | mais na tempestade | raro |

2. **Nível pelas cidades** (mudou depois do primeiro teste — ver "Ajustes
   depois do primeiro teste"). No começo era a faixa global
   (`GAME_CONFIG.EXPERIENCE.WILD_LEVEL_MIN/MAX`).
3. **Condições no arquivo da espécie** (campo `spawn`, estilo Cobblemon).
4. **Teto, raios e intervalos** ficam a critério do desenvolvimento
   (config `GAME_CONFIG.WILD_SPAWN`), ajustados no teste.
5. **Fora da vista** = distância mínima **e** (fora do cone da câmera **ou**
   além da distância de visão). Calculado no core pelo `yaw` da câmera — sem
   frustum, o core continua headless. O "ou além da distância de visão"
   evita que a frente do jogador nunca receba spawn.
6. **Despawn em três faixas** de distância do jogador:
   - **perto**: nunca some, seja qual for a idade;
   - **meio**: some se estiver velho **e** fora da vista — quanto mais
     velho, maior a chance a cada verificação, até certeza na idade máxima;
   - **longe**: some.
   Única exceção: **captura em andamento** (dentro da bola) nunca some. A
   bola ainda em voo não protege: se o selvagem sumir antes, ela só erra.
   Combate não protege: fugir para longe acaba a luta e ele some.
7. **Desmaiado segue as regras comuns** (sem proteção): perto, não some e
   acorda quando o tempo acaba (como hoje); afastou, some pela distância ou
   pela idade fora da vista.
8. **Selvagens entram no save**: os vivos no momento do save, com espécie,
   posição, nível, IV, HP, temperamento, desmaio, condições e idade. Ao
   abrir, voltam como estavam e o spawn só completa até o teto. Quem sumiu
   ou foi capturado não volta.
9. **Sem spawn** na cidade, na água e nos biomas escondidos.
10. **Debug no F2**: raios, cone, contagem/teto e o motivo de cada spawn e
    despawn.

---

## Arquitetura (proposta)

### Dados por espécie (`core/data/species/*`)

Campo `spawn` nas 7 selvagens (e documentado no `_template`). Sem `spawn`,
a espécie nunca nasce no mundo (os iniciais e o `boy`).

```js
// Exemplo fictício
spawn: {
  biomes: ['forest', 'plains'], // ou/e
  tags: [],                     // casa se o bioma tiver alguma das tags
  rarity: 'common',             // faixa de GAME_CONFIG.WILD_SPAWN.RARITY_CHANCES
  phases: { night: 1.5 },       // multiplicador por fase do dia (falta = 1, 0 = não nasce)
  weather: { storm: 0 },        // multiplicador por clima (falta = 1, 0 = não nasce)
},
```

Peso de uma espécie dentro da faixa dela = multiplicador da fase ×
multiplicador do clima. Peso zero = não entra no sorteio. (A primeira
versão multiplicava também por um peso da raridade; ver "Ajustes depois do
primeiro teste".)

### Regras puras (`core/wildSpawn/`)

Funções sem world, testáveis isoladas e prontas para o servidor (077):

- `spawnWeightOf(species, { biomeId, biome, phase, weather })` — o peso
  (zero se o bioma não casa, se está em `BIOMES.HIDDEN`, se é `city`).
- `pickSpawnSpecies(rng, candidates)` — sorteio ponderado.
- `isOutOfView(point, viewer, params)` — distância mínima e (fora do cone
  pelo `yaw` ou além da distância de visão).
- `findSpawnPoint(rng, viewer, sampleGround, params)` — tenta pontos no
  anel entre o raio mínimo e o máximo: chunk carregado, fora da vista, terra
  firme (sem água), inclinação aceitável, fora dos sólidos.
- `despawnBand(distance, params)` → `'near' | 'mid' | 'far'` e
  `shouldDespawn({ band, age, visible, protected }, rng, params)`.

"Jogador" (o `viewer`) é o treinador; a distância usa o mais perto entre o
treinador e a criatura controlada, para não sumir com o que está do lado da
criatura quando o controle é trocado (018).

### Estado (traits)

- `WildSpawnInfo { age }` — idade do selvagem em segundos de jogo. Dono de
  escrita: `wildDespawnSystem` (soma o `delta`); o save lê e restaura.
- `WildSpawnState` (no world) — temporizador da próxima tentativa de spawn
  e o registro de debug (últimos motivos). Dono: `wildSpawnSystem`.

### Actions (`core/actions/wildSpawn.js`)

- `nascerSelvagem(world, events, { speciesId, position, ...individuo })` —
  monta o selvagem (o conjunto de traits que hoje está no spawn system, mais
  `WildSpawnInfo`). Usada pelo spawn e pelo restore do save; aceita IV,
  nível, HP etc. já prontos (restore) ou sorteia (spawn novo).
- `despawnarSelvagem(world, events, entity, reason)` — destrói o corpo
  físico e a entidade, emite o evento.

### Systems (passo fixo, fase simulation)

- `wildSpawnSystem` (substitui o `wildCreatureSpawnSystem`): a cada
  intervalo, para cada jogador ativo, conta os selvagens dentro do raio de
  despawn longe; abaixo do teto, faz algumas tentativas de ponto e nasce um
  selvagem por tentativa que der certo.
- `wildDespawnSystem`: soma a idade, classifica a faixa e decide o despawn
  (a verificação da faixa do meio é periódica, não a cada passo).

O raio "longe" fica **dentro** do raio de carga dos chunks — o selvagem
some antes de o chão dele descarregar.

### Eventos

`wildSpawned({ entity, speciesId, reason })` e
`wildDespawned({ speciesId, reason })` (`far`, `aged`) — para o debug agora
e para a rede no 077.

### Save

- Domínio novo `wildCreatures` (lista), `SAVE_VERSION` sobe para 4 com
  migração (save antigo → lista vazia).
- Cada entrada: espécie, posição e rotação, nível e XP, IV, `Vitals`,
  temperamento, desmaio (tempo restante), condições e idade. Estado de luta,
  caminho e alvo não vão: volta vagando.
- Restore: saem os selvagens que já nasceram antes do save chegar, entram os
  salvos (pela `nascerSelvagem`).
- Banco: coluna `wildCreatures Json?` na tabela `trainer` — migração do
  Prisma aplicada pelo usuário.

### Limpeza

- Saem `TEST_LEVEL.wildCreatures`, `generateWildCreatures`,
  `WILD_CREATURE_SPECIES` e `WILD_AREA_HALF_SIZE` de `testLevel.js`.
- O atraso inicial do `WanderState` hoje usa `Math.random()`: passa para o
  `gameplayRng` (regra 3.5), já que o trecho muda de lugar.

### View / debug (F2)

Anel de spawn (mínimo e máximo), as três faixas de despawn, o cone da
câmera, contagem/teto e a lista dos últimos spawns e despawns com o motivo.

### Config (`GAME_CONFIG.WILD_SPAWN`)

Teto por jogador, intervalo e tentativas do spawn, raios do anel, distância
de visão e meia-abertura do cone, as três faixas, idade mínima e máxima do
despawn do meio, intervalo da verificação e as chances por raridade.

### Pronto para o multiplayer (077)

Regras puras recebendo a lista de jogadores; teto contado por jogador;
spawn e despawn por eventos. O 077 só move os systems para o servidor.

### Testes (regras, sem fixar valores)

- Espécie sem `spawn` nunca é candidata; bioma escondido, cidade e água
  nunca recebem spawn.
- Fase ou clima com multiplicador zero tiram a espécie; maior que um
  aumenta o peso (comparação relativa, derivada dos dados da espécie).
- Ponto de spawn sempre dentro do anel, fora da vista, em terra firme.
- Teto: nunca passa do teto em volta do jogador.
- Faixas: perto nunca some; longe sempre; meio só velho e fora da vista.
- Captura em andamento nunca some; desmaiado segue as faixas.
- Save: ida e volta preserva o selvagem; save da versão 3 migra com lista
  vazia.

---

## Etapas

- [x] Decisões com o usuário.
- [x] Bump `package.json` → `0.0.62` e doc.
- [x] Revisão do doc pelo usuário.
- [x] Campo `spawn` nas 7 espécies e no `_template`.
- [x] Regras puras `core/wildSpawn/` (+ testes).
- [x] Traits, actions e eventos (+ testes).
- [x] `wildSpawnSystem` e `wildDespawnSystem`, saída do spawn provisório e
      limpeza do `testLevel.js` (+ testes).
- [x] Save: domínio `wildCreatures`, versão 4 e migração (+ testes).
- [x] Migração do banco (`wildCreatures` na tabela `trainer`) aplicada pelo
      usuário.
- [x] Debug no F2.
- [x] Teste no jogo pelo usuário e ajustes (teto, raios, idades, pesos).
- [x] Desempenho na Intel UHD (selvagens nascendo e sumindo não pesam):
      A/B de produção contra a 0.0.61, 3 rodadas intercaladas (ABBAAB),
      1920 × 1080, entrando no jogo sem save (origem), 15 s parado e 40 s
      andando e correndo. FPS e GPU no mesmo nível ou melhores; parado, a 062
      desenha menos (o spawn provisório saiu). A primeira rodada da 0.0.61
      pegou a GPU ainda fria e puxa a média dela para baixo.

      | Cena | FPS 0.0.61 → 0.0.62 | GPU média (ms) | Desenhos/quadro |
      |---|---|---|---|
      | Origem, parado | 45,4 → 59,5 | 13,1 → 12,0 | 424 → 375 |
      | Origem, andando | 40,6 → 42,5 | 15,4 → 14,7 | 492 → 479 |
- [x] Wiki: onde encontrar cada espécie (bioma, horário, clima, raridade).
      Página nova "Onde encontrar" (Criaturas selvagens): como aparecem e
      vão embora, raridade, horas do dia, tabela por espécie, o que volta ao
      abrir o jogo e o nível das selvagens; seção "Onde encontrar" na página
      de cada criatura do catálogo (os iniciais: não aparecem na natureza);
      teto de nível da versão em "Experiência e nível".
- [x] Roadmap: 062 para "Já feito" (título `0.0.1 – 0.0.62`); pendência dos gritos dos iniciais no Marco 5 (095).
- [x] Gates: `npm test` inteiro (3029 passando; na primeira rodada, com o
      `next dev` ligado, 5 testes pesados de terreno e física estouraram o
      tempo e passaram sozinhos — com metade dos núcleos, a suíte passou
      inteira), `npm run lint` e build de produção numa cópia.

---

## Como ficou (implementação)

- **Dados**: `spawn` nas 7 selvagens (`biomes`, `rarity`, `phases`,
  `weather`) e documentado no `_template` (com `tags`).
- **Regras puras** (`core/wildSpawn/wildSpawn.js`): `spawnWeightOf`,
  `listSpawnCandidates`, `pickSpawnSpecies`, `isOutOfView`,
  `isSpawnableGround`, `rollSpawnPoint` (uma tentativa por chamada),
  `despawnBand`, `despawnChanceByAge` e `despawnReason`. A inclinação sai
  da altura em volta do ponto (`heightAt`), sem precisar do chunk.
  `spawnPlayers.js` acha os jogadores (quem tem `Party`), os pontos deles
  (treinador e controlada) e a câmera (`CameraTarget` + `OrbitCamera.yaw`).
- **Actions** (`core/actions/wildSpawn.js`): `nascerSelvagem` (o conjunto
  de traits que era do spawn provisório, mais `WildSpawnInfo`; o atraso
  inicial do vagar saiu do `Math.random()` para o `gameplayRng`),
  `despawnarSelvagem`, `removerSelvagem` (sem aviso, para o restore) e
  `registrarSpawnNoLog`.
- **Systems**: `wildDespawnSystem` e, logo depois, `wildSpawnSystem`, no
  lugar do `wildCreatureSpawnSystem` (removido com o teste dele). Saíram
  de `testLevel.js` a lista fixa e o sorteio provisório.
- **Proteção do despawn**: só quem está **dentro** da Pokébola
  (`BeingCaptured`). A bola ainda em voo não protege — sem alvo preso, ela
  só erraria; e quem a bola alcança já está perto o bastante para a faixa
  perto ou para não estar velha e fora da vista.
- **Fora da vista no despawn**: fora da vista de todas as câmeras (offline,
  a única).
- **Save**: `wildCreaturesSave.js`, `SAVE_VERSION` 4 com a migração 3 → 4
  (lista vazia), coluna `wildCreatures` na tabela `trainer`
  (`prisma/migrations/20261026120000_selvagens_no_save`). Volta vida,
  fôlego, desmaio (com o tempo que faltava), condições que ficam na bola,
  temperamento, IV, nível e idade.
- **Debug (F2)**: `WildSpawnDebugView` (anel do spawn, faixas perto e
  longe e o cone da câmera em volta de quem ela segue) e, no painel, a
  contagem com o teto e os últimos spawns e despawns com o motivo.

---

## Ajustes depois do primeiro teste (pedido do usuário)

### Raridade por faixa, como no Cobblemon

- **O problema**: apareceram 4 Pikachus de uma vez. A raridade era um peso
  relativo **entre quem podia nascer ali**: na floresta à noite (Caterpie,
  Weedle e Pidgey só de dia), o Pikachu era o único candidato e saía em
  toda tentativa; na tempestade, o peso dele triplicava.
- **Decisão**: cada tentativa sorteia primeiro a **faixa** (comum, incomum,
  raro) pela chance fixa dela (`WILD_SPAWN.RARITY_CHANCES`) e depois a
  espécie dentro da faixa, pelo peso da fase e do clima. Faixa sem ninguém
  ali = a tentativa não nasce nada. O raro é raro em qualquer lugar; a
  floresta à noite fica quase vazia (só o Pikachu, raro).
- `rollRarity` e `pickSpawnSpecies` (`wildSpawn.js`); sai o
  `RARITY_WEIGHTS`.

### Nível pelas cidades

- **Decisão**: a progressão de nível é a que a 058 deixou preparada (todo
  ponto pertence à cidade mais próxima). **Cada cidade tem um nível
  sorteado pela seed**, que **não** cresce com a distância da origem — a
  vizinha pode ser mais fraca ou mais forte. A primeira (a da origem, onde
  o treinador nasce) é a **mais fraca**, com o nível fixo do começo; as
  outras sorteiam entre ela e o **teto das selvagens** (`LEVEL.MAX`, hoje
  bem abaixo do teto do jogo), que também limita cada indivíduo.
- Perto de uma cidade, a selvagem fica perto do nível dela; no caminho até
  a outra, o nível base muda aos poucos (as duas cidades mais próximas,
  cada uma pesando pela proximidade). Cada indivíduo varia um pouco em
  volta do nível base.
- Saíram a faixa global (`WILD_LEVEL_MIN/MAX`) e o `rollWildLevel`; a
  action sem `level` usa o nível da primeira cidade.
- `core/wildSpawn/wildLevel.js` (`cityLevel`, `baseLevelAt`,
  `rollLevelAround`), config `WILD_SPAWN.LEVEL` (nível da primeira cidade,
  teto das selvagens e variação). `nearestCities(x, z, count)` novo em
  `citySites.js` e no relevo (`terrainChunkSet.js`), fora do caminho quente
  do relevo (que segue com o `nearestCity`).
- **Teto da versão**: a beta só deixa subir até um teto próprio
  (`EXPERIENCE.LEVEL_CAP`), para todos — time e selvagens. O teto oficial
  (`MAX_LEVEL`) continua a escala do jogo (curva de XP, fórmulas,
  learnsets) e volta a valer quando o da versão chegar nele. Quem já está
  no teto (ou acima, de um save de antes) não ganha mais XP; ninguém nasce
  acima dele (`createLevelState`). As cidades sorteiam o nível entre o da
  primeira e esse teto. O laboratório de golpes fica livre até o oficial.
- O nível de cada cidade sai da seed só para o spawn: não muda o mundo
  gerado (nem a `GENERATION_VERSION`).
- Debug (F2): a linha da cidade mostra o nível dela e o nível base das
  selvagens onde o jogador está.

### Som por proximidade e nameplate (pedido do usuário)

- **Som**: dava para ouvir as selvagens do mundo inteiro — o modelo de
  distância padrão do Three (inverso) nunca zera. Agora todo som
  posicional passa por `view/audio/spatialAudio.js`: atenuação que zera
  (volume cheio até `refDistance`, some de vez em `maxDistance`, com
  padrão por tipo de som — voz, passo, ação/golpe, sons do mundo — e
  `maxDistance` opcional no config de cada som) e pan `equalpower`, que
  põe o som na esquerda ou na direita conforme a selvagem está em relação
  à câmera.
- **Nameplate**: ficava visível no horizonte. Agora só aparece até um
  alcance da câmera (`NAMEPLATE_SHOW_DISTANCE`, `NameplateView.jsx`),
  sumindo aos poucos perto do limite (e, como antes, com a névoa).
- **Estalo no som** (relatado jogando): o Three só atualiza a posição do
  panner com o som tocando, e em rampa. Parado, ele guarda onde tocou por
  último (ou a origem do mundo, se nunca tocou), e o som começa lá. O caso
  medido é o primeiro som de cada selvagem com o jogador perto da origem: o
  começo vazava mesmo com ela fora do alcance. Agora o panner vai para o
  lugar antes de cada `play` (`WorldPositionalAudio`, em `spatialAudio.js`),
  em todo som posicional, inclusive os do mundo. Longe da origem, esse caso
  não acontece: um estalo lá teria outra causa.
- **Queda gradual** (relatado no lab): a atenuação linear soava quase igual
  por boa parte do alcance e então emudecia de uma vez perto do fim — o
  ouvido mede volume por razão, e a reta só perde muito em proporção no
  final. Agora o panner só faz o pan (não atenua) e a queda é um ganho
  próprio antes dele (`fadeToDistance`, em `spatialAudio.js`), pela curva de
  `distanceGain` (`soundRanges.js`): o que falta do caminho elevado a um
  expoente (`SOUND_FALLOFF.CURVE`), que cai desde perto e chega ao fim
  baixinho. Mesmos `refDistance`/`maxDistance`. Medido no lab, a queda do
  grito ficou contínua do começo ao fim; o expoente se ajusta ao vivo lá.
- **Esquerda/direita** (validado no lab): o pan funciona — de frente sai
  igual nos dois lados, de lado quase tudo de um lado, e acompanha a câmera
  girando. A medição achou outro problema: com grito estéreo (todas as
  selvagens que nascem hoje), o panner somava os dois canais no ouvido do
  lado da fonte, e o som de lado saía mais alto que de frente. Agora o
  panner recebe tudo em mono (`applySpatialAudio`), e o volume total é o
  mesmo em qualquer direção. De frente, o grito estéreo ficou um pouco mais
  baixo que antes (igual aos mono).
- **Piscada do nameplate** (relatado jogando): a etiqueta nascia visível e só
  o `useFrame` a escondia. Às vezes o conteúdo chegava à tela antes disso, e
  quem nasceu longe aparecia um quadro inteiro. Agora ela nasce escondida.

### Laboratório de alcance (pedido do usuário)

No jogo, testar isso dependia de spawn e não dava para saber a distância.
`/tools/lab-alcance` (`tools/rangeLab/`) põe uma selvagem de verdade numa
distância exata da câmera, que fica parada na origem e só gira:

- **Limites à vista**: anéis no chão e um mapa de cima com o alcance da voz,
  dos passos e da etiqueta e o spawn mais perto; leitura ao vivo da distância
  e do volume esperado.
- **Queda do volume**: gráfico do volume por distância (voz e passos, com a
  reta antiga tracejada) e o expoente da curva ajustável ao vivo; o lab
  devolve o padrão ao sair.
- **Movimentos**: parada, ir e voltar (com atalho para atravessar cada
  limite), dar a volta em torno da câmera e nascer em loop, em qualquer
  ângulo (frente, lados, atrás).
- **Esquerda/direita**: de onde a selvagem vem, vista da câmera; o que sai
  em cada canal (medido) ao lado da conta do pan; mapa no sentido da
  câmera.
- **Medidor**: lê a saída real do áudio; o registro mostra o pico de cada
  grito e acusa "ESTALO" quando sai som de quem ficou fora do alcance do
  começo ao fim. O botão de teste faz o caso do primeiro som.
- **Comparar gritos**: dois Pokémon (qualquer um com grito, inclusive os
  iniciais) gritam alternados no mesmo ponto, pelo mesmo caminho de som da
  voz no jogo, cada um com um volume ajustável; o lab lista o que ficou
  diferente do config, para copiar. Pedido depois de Ekans e Rattata
  parecerem mais altos: medidos nos arquivos (sonoridade ITU-R BS.1770, no
  mono que o jogo toca), os gritos das selvagens estão praticamente iguais;
  o que muda é o timbre (Ekans é quase só chiado agudo; Rattata tem muita
  energia onde o ouvido é mais sensível e fica forte o grito inteiro), que
  a medida não pesa bem — por isso o ajuste é de ouvido. Os iniciais saíram
  bem mais altos que as selvagens nos arquivos.
- **Volume das vozes** (pedido do usuário): todas as espécies e o padrão
  baixaram para o mesmo valor, abaixo do de antes; o ajuste fino por espécie
  sai do comparador. Os iniciais mais altos ficaram para o Marco 5 (095).

### Energia voltando no meio do golpe (relatado pelo usuário)

O golpe zerava o relógio da regeneração da energia (`staminaRegenDelay`) só
no disparo, e o `vitalsRegenSystem` contava dali: golpe mais longo que o
delay voltava a regenerar antes de acabar. Agora o golpe conta como uso do
começo ao fim — com a ação em `'attack'`, o delay fica parado no valor
cheio e só começa a contar quando o golpe acaba (cancelado, interrompido ou
no fim natural). Os gastos de energia dos golpes foram ajustados pelo
usuário.
- Os limites saíram para arquivos próprios, para o lab ler os valores reais:
  `view/audio/soundRanges.js` (com os volumes padrão) e
  `view/scene/nameplateRange.js`.

### Spawn andando: sem nada na frente, depois um monte (pedido do usuário)

- **O que acontecia** (simulado: jogador andando em linha reta com os
  systems de spawn e despawn de verdade): quase nada nascia na frente. Na
  frente, só valia nascer além da distância de visão, e o anel mal passava
  dela; o resto nascia atrás e dos lados (fora do cone) e ocupava vaga até
  ficar longe. Parando ou virando a câmera, aparecia tudo de uma vez. E o
  teto enchia numa leva só: as selvagens envelheciam juntas, sumiam juntas e
  a leva seguinte nascia junto.
- **Distância de visão errada**: estava fixa, e menor que a névoa da tela —
  dava para ver selvagem nascendo na frente. Agora é onde a névoa fecha
  (`loadedFogRange`, que saiu de `view/terrain/` para `core/terrain/
  fogRange.js`: o spawn usa a mesma conta da tela).
- **Andando, parte nasce na frente**: uma fração das tentativas
  (`AHEAD_CHANCE`) vai para um leque em volta da direção do movimento
  (velocidade de quem está no controle), logo além da névoa
  (`AHEAD_DEPTH`): a selvagem aparece saindo da névoa no caminho. O raio
  longe passou para além dessa faixa.
- **Quem ficou para trás libera a vaga antes**: idade mínima e máxima do
  despawn da faixa do meio bem menores.
- **Poucas de cada vez** (`SPAWNS_PER_INTERVAL`): o teto enche aos poucos e
  as idades ficam espalhadas, sem ondas.
- Resultado na simulação: andando ou correndo, sempre algumas na frente, o
  total estável perto do teto.
- **Floresta à noite** continua quase vazia (decisão do usuário): à noite
  só o Pikachu nasce lá, e ele é raro.

---

## Critérios de Conclusão

- [x] Só as 7 espécies selvagens nascem no mundo; os iniciais nunca.
- [x] Cada espécie só nasce no bioma, horário e clima dela, com a
      raridade da tabela (rara é rara em qualquer lugar).
- [x] O nível das selvagens segue as cidades: perto de uma, o nível dela;
      entre duas, a transição.
- [x] Nada nasce na cidade, na água ou em bioma escondido.
- [x] Nenhum selvagem nasce à vista do jogador.
- [x] O número de selvagens em volta do jogador nunca passa do teto e é
      reposto quando cai.
- [x] Perto nunca some; longe some; no meio, só os velhos fora da vista.
- [x] Captura em andamento nunca é interrompida pelo despawn.
- [x] Fechar e abrir o jogo traz os selvagens vivos como estavam.
- [x] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- Bando (selvagens da mesma espécie entrando juntas na luta) — 077.
- Spawn no servidor e por vários jogadores de verdade — 077.
- Spawn de espécies de biomas escondidos, cavernas e água (nado).
