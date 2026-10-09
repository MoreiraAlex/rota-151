# 🚀 Versão 0.0.48 — Dia, noite e clima

## Resumo

Quarta feature do Marco 2 (mundo procedural). O mundo ganha um **relógio**
e um **clima**:

- **Dia e noite**: o horário corre só com o jogo aberto, num ciclo de alguns
  minutos, e vai no save. Céu, sol, lua, luz e névoa acompanham o horário.
  A noite é escura, mas dá para jogar: luz azulada fraca, lua e estrelas.
- **Clima por bioma, pela seed**: o mundo é dividido em regiões e o tempo em
  períodos. Em cada região, a cada período, o clima sai de um sorteio da
  seed, com as chances do bioma (o deserto quase nunca tem chuva e a tundra
  neva). Tipos: **limpo, sol forte, chuva, tempestade e neve**.
- **Partículas e som**: chuva, neve, relâmpago com trovão e vento forte.
- **Condições de spawn**: o horário e o clima ficam disponíveis para a 055
  (spawn) consultar.
- **Debug (F2)**: mostra o horário e o clima, e deixa mudar a hora, a
  velocidade do relógio e forçar um clima.

Versão: `0.0.48` (`package.json`). Branch: `feature/048-dia-noite-e-clima`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config).

---

## O que já existe (ponto de partida)

- **Luz fixa** (`view/scene/GameScene.jsx`): uma `ambientLight` e uma
  `directionalLight` com sombra, ambas paradas.
- **Céu e névoa** (`view/scene/FogView.jsx`, 046): o céu é um degradê fixo
  (`FOG.SKY_TOP_COLOR` → `FOG.COLOR`), e a névoa, na cor do horizonte, esconde
  a borda do mundo carregado. A distância da névoa vem de `fogRange`.
- **Som ambiente** (`view/audio/AmbientAudio.jsx` +
  `view/systems/ambientAudioSystem.js`): rajadas curtas de vento, tocadas de
  vez em quando (não é loop).
- **Biomas** (047): `biomeAt(x, z)` no conjunto de chunks e um registro em
  `core/data/biomes/`. O doc da 047 deixou o clima de cada bioma para esta
  feature.
- **Save** (044): o treinador salva a posição e o resto. Campos novos entram
  como opcionais (como a `position`), sem subir o `SAVE_VERSION`.
- **Pausa** (regras, 5.6): pausado, o passo fixo não roda.
- **Material toon** (`view/materials/toonMaterial.js`): é afetado pela luz
  da cena.

---

## Decisões (com o usuário)

1. **O horário corre só com o jogo aberto e vai no save.** Ao voltar, o jogo
   continua da hora em que parou. Pausado, o relógio para. No multiplayer
   (067), o servidor passa a ser o dono do relógio.
2. **O clima é escolhido pela seed, por região e período.** É determinístico:
   com a mesma seed, região e período, o clima é o mesmo. Assim o multiplayer
   só precisa da seed e do horário. Cada bioma tem as próprias chances.
3. **A troca de clima é gradual.** Ao mudar de período ou atravessar a
   fronteira de uma região, a intensidade sobe e desce aos poucos (sem corte).
4. **A noite é escura, mas jogável.** Fica uma luz azulada fraca, com lua e
   estrelas no céu, e dá para ver o caminho e os Pokémon sem lanterna.
5. **Áudio:**
   - **Chuva**: "Rain (loopable)", do Ylmir (OpenGameArt, CC0), aprovado
     pelo usuário.
   - **Vento forte** (tempestade e nevasca): `wind_loop_stereo.ogg`, do
     Cobblemon (`sounds/ride/loop/`).
   - **Trovão**: `thunder_target.ogg`, do golpe Thunder do Cobblemon. Fica em
     teste: o usuário decide no jogo e, se não servir, trocamos.
   - As rajadas de vento esporádicas de hoje continuam.
6. **A luz no estilo BotW não entra aqui.** Esta feature só faz a luz variar
   com o horário, com cores simples por fase do dia. O ajuste fino (sol
   quente, sombra azulada) é da 049, que mexe nas mesmas cores.

---

## Arquitetura

### Relógio do mundo (`core/`)

- **Trait `WorldClock`** (singleton do mundo): `time`, em dias de jogo
  (0 a 1 = um dia; 0.25 = 6h, 0.5 = meio-dia). Fica contínuo, sem voltar a
  zero, porque o período do clima usa o tempo total.
  - Dono de escrita: `worldClockSystem.js`, mais a action `definirHorario`
    (save e debug).
- **`worldClockSystem`** (passo fixo): soma `delta / DAY_LENGTH` × a
  velocidade. Como fica no passo fixo, para quando o jogo pausa.
- **`core/time/dayCycle.js`** (funções puras):
  - `hourOf(time)` → a hora do dia (0–24).
  - `dayPhaseOf(time)` → `dawn` | `day` | `dusk` | `night`, com os limites
    no config.
  - `sunDirection(time)` e `moonDirection(time)` → o vetor do sol e o da lua
    (o sol nasce a leste e se põe a oeste, num arco inclinado).
  - `lightingAt(time)` → cor e intensidade do sol, da luz ambiente, do alto
    do céu, do horizonte e da névoa, interpoladas entre as fases do dia
    (cores no `GAME_CONFIG.DAY_CYCLE`). Fica no core porque é só dado e
    conta; a view só aplica.

### Clima (`core/weather/`, headless e determinístico)

- **Dados por bioma**: cada `core/data/biomes/<id>/index.js` ganha
  `weather`, com pesos `{ clear, rain, storm, snow }` (ex.: deserto quase
  todo `clear`, tundra quase toda `snow`, selva muita `rain`). O
  `_template` documenta o campo.
- **`weatherMap.js`**, `createWeatherSampler(seed, biomeSampler, params)`:
  - **Região**: uma grade de `WEATHER.REGION_SIZE` (m). O bioma da região é
    o do centro dela (pelo sampler de bioma, sem chunk carregado).
  - **Período**: `floor(time / WEATHER.PERIOD)`, com `PERIOD` em dias de
    jogo.
  - **Sorteio**: um PRNG com a sub-seed
    `deriveSeed(WORLD.SEED, 'weather', regiãoX, regiãoZ, período)` escolhe o
    tipo pelos pesos do bioma, mais uma `intensity` (0 a 1).
  - `weatherAt(x, z, time)` → `{ type, intensity }`.
  - Regra: o clima nunca depende do jogador nem de estado (só seed, posição
    e tempo).
- **Trait `LocalWeather`** (singleton): o clima onde está a entidade
  controlada (treinador ou criatura).
  - Campos: `type`, `intensity` (a atual, que muda aos poucos), `target`
    (o sorteado) e `flash` (o relâmpago, para a view).
  - Dono de escrita: `weatherSystem.js`.
- **`weatherSystem`** (passo fixo): lê `weatherAt` na posição controlada.
  - Quando o tipo muda, a intensidade do tipo antigo desce até 0 e a do novo
    sobe, em `WEATHER.TRANSITION` segundos.
  - Na tempestade, sorteia relâmpagos com o RNG cosmético nomeado
    (`weatherFx`) e emite o evento `relampago`.
- **Para o spawn (055)**: `dayPhaseOf(time)` e `weatherAt(x, z, time)` já
  são a consulta. A 055 só lê.

### Save

- `trainerSaveSchema` ganha o campo opcional `worldTime` (número ≥ 0). Um
  save sem o campo começa de manhã (`DAY_CYCLE.START_TIME`). Na carga,
  `definirHorario(world, worldTime)`. O save novo grava o `WorldClock.time`.
- Por enquanto o horário mora no save do treinador porque o jogo é offline.
  Na 067 ele passa para o servidor.

### View

- **`SkyView.jsx`** (substitui o céu do `FogView`): uma esfera grande presa à
  câmera, com um shader simples de degradê (alto → horizonte), o disco do sol,
  o disco da lua e as estrelas (pontos fixos no shader, que aparecem só à
  noite).
  - Os uniforms vêm de `lightingAt` e do `LocalWeather`: com chuva ou
    tempestade, o céu fica mais cinza e as estrelas somem.
  - O `FogView` continua dono da distância da névoa; a cor passa a vir de
    `lightingAt`.
- **`DayLightView.jsx`** (substitui as duas luzes fixas do `GameScene`):
  - A `directionalLight` segue `sunDirection` de dia e `moonDirection` à
    noite, mais fraca e azulada.
  - A sombra acompanha o treinador (o alvo da luz anda com ele).
  - A `ambientLight` (ou uma `hemisphereLight`) usa a cor e a intensidade
    de `lightingAt`.
  - O relâmpago acende a luz ambiente por um instante.
- **`WeatherView.jsx`**, com as partículas presas à câmera, que a
  acompanham:
  - **Chuva**: gotas em linha (`InstancedMesh` ou `LineSegments`) num volume
    em volta da câmera, caindo com o vento. A quantidade segue a
    `intensity`.
  - **Neve**: `Points` caindo devagar, com balanço.
  - **Tempestade**: chuva mais forte e inclinada, mais o relâmpago.
  - As partículas só animam no visual. Fica um único `useFrame` comentado
    (exceção das regras, 3.4) ou entram num system de view do loop, como o
    resto.
- **Áudio** (`view/audio/WeatherAudio.jsx` + `weatherAudioSystem.js`):
  - Os loops de chuva e de vento forte têm o volume pela intensidade, com
    fade.
  - O trovão toca com um atraso sorteado depois do relâmpago.
  - Usa o mesmo `AudioListener` e o mesmo desbloqueio de autoplay.

### Debug (F2)

- `DebugPanel`: as linhas `hora: 14:30 (dia)` e `clima: chuva 0.7`.
- O painel novo **"Dia e clima"** tem:
  - um controle para escolher a hora;
  - a velocidade do relógio (parado, 1×, 10×, 60×);
  - a opção de forçar um clima (automático, limpo, sol forte, chuva, tempestade, neve),
    para testar sem esperar.

### Constantes (`GAME_CONFIG`)

- `DAY_CYCLE`:
  - `DAY_LENGTH`: segundos reais por dia de jogo (ex.: 20 min, número
    fictício);
  - `START_TIME`: a hora de início de um save novo;
  - os limites das fases (`DAWN`, `DAY`, `DUSK`, `NIGHT`);
  - as cores e intensidades por fase (sol, ambiente, alto do céu,
    horizonte e névoa).
  - A `FOG.COLOR` e a `FOG.SKY_TOP_COLOR` saem e viram as cores do dia.
- `WEATHER`:
  - `REGION_SIZE`, `PERIOD` e `TRANSITION`;
  - a densidade máxima de chuva e de neve e o volume das partículas;
  - o intervalo dos relâmpagos e o atraso do trovão;
  - os volumes dos loops.

### Testes (regras, sem fixar valores)

- **Relógio**: o tempo avança proporcional ao `delta` e ao `DAY_LENGTH` e
  não avança sem rodar o system (pausa).
- **`dayCycle`**:
  - as fases cobrem as 24h sem buraco e em ordem;
  - o sol fica acima do horizonte de dia e abaixo à noite;
  - a luz é contínua (sem salto entre minutos vizinhos), inclusive na
    virada da meia-noite.
- **Clima**:
  - com a mesma seed, região e período, o clima é o mesmo, e com seeds
    diferentes ele varia;
  - um tipo com peso 0 no bioma nunca sai (ex.: neve no deserto, se o peso
    for 0);
  - numa amostra grande, a frequência acompanha os pesos do bioma;
  - dentro de uma região e de um período, o clima é o mesmo em qualquer
    ponto.
- **Transição**: a intensidade muda no máximo `delta / TRANSITION` por tick.
- **Save**: um save sem `worldTime` é válido e começa no `START_TIME`; o
  horário vai e volta do save.
- **Registro**: todo bioma tem `weather` com os quatro tipos, pesos ≥ 0 e
  soma > 0.

---

## Etapas

- [x] Bump `package.json` → `0.0.48`.
- [x] `GAME_CONFIG.DAY_CYCLE` e `GAME_CONFIG.WEATHER`; tirar `FOG.COLOR` e
      `FOG.SKY_TOP_COLOR`.
- [x] `core/time/dayCycle.js` + testes.
- [x] `WorldClock`, `worldClockSystem`, `definirHorario` + testes.
- [x] `weather` em cada bioma e no `_template`, mais um teste de registro.
- [x] `core/weather/weatherMap.js` + testes.
- [x] `LocalWeather`, `weatherSystem` (transição e relâmpago) + testes.
- [x] Save: `worldTime` opcional, gravar e carregar + testes; coluna
      `worldTime` no banco (migração `horario_do_mundo`).
- [x] Céu (degradê, sol, lua, estrelas, céu fechado com chuva) e a cor da
      névoa — `DayNightView`.
- [x] Luz do sol e da lua, sombra que acompanha, ambiente e relâmpago —
      `DayNightView`.
- [x] `WeatherView` (chuva, neve e tempestade).
- [x] Áudio: chuva baixada, vento e trovão copiados do Cobblemon para
      `public/assets/audio/ambient/`, `WeatherAudio` e os systems.
- [x] Debug F2: as linhas no `DebugPanel` e o painel "Dia e clima".
- [x] Aplicar a migração no banco (`npm run db:dev`) — usuário.
- [x] Teste no jogo pelo usuário.
- [x] Nuvens, sem sombra à noite, clima no combate e sol forte (pedidos no
      teste).
- [x] Wiki: página "O mundo" ("Dia e noite", "Clima", "Clima na batalha") e
      o termo "clima" na conta do dano.
- [x] Roadmap: a 048 vai para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build (numa cópia).

---

## Como ficou (implementação)

- **Relógio e clima são traits do MUNDO** (`world.add(WorldClock,
  LocalWeather)` em `core/world/world.js` e no `makeWorld` dos testes), não
  de uma entidade: `world.get`/`world.set`. O `WorldClock` tem também a
  `speed` (o debug acelera ou para o relógio).
- **Força por tipo**: o `LocalWeather` guarda a força de cada um dos quatro
  tipos (`clear`, `rain`, `storm`, `snow`); na troca, um desce enquanto o
  outro sobe (`core/weather/weatherLevels.js`). `type` é o mais forte agora.
- **Consulta para o spawn (055)**: `weatherAt(x, z, time)` em
  `core/weather/worldWeather.js` (seed do mundo + bioma do relevo) e
  `dayPhaseOf(time)` em `core/time/dayCycle.js`.
- **Relâmpago**: o `weatherSystem` emite `lightningStruck` (RNG cosmético);
  o `view/systems/lightningSystem.js` acende o clarão e toca o trovão
  depois do atraso.
- **Um componente só para céu e luz** — o plano tinha `SkyView` e
  `DayLightView`; virou `view/scene/DayNightView.jsx`, com um `useFrame` só
  (esfera do céu presa à câmera, luz direta com a área de sombra seguindo
  quem está no controle, luz ambiente e cor da névoa). A conta do céu
  fechado e do clarão é pura (`view/weather/skyLook.js`, testada).
- **Nuvens** (pedido do usuário no teste): desenhadas no próprio shader do
  céu, como as estrelas — ruído projetado num teto plano, andando com o
  vento (`GAME_CONFIG.CLOUDS`). A cobertura sobe com o céu fechado, e a cor
  segue a luz da hora (brancas de dia, laranja no pôr do sol, escuras à
  noite). Ficam por cima do sol, da lua e das estrelas. Ajuste no painel
  "Dia e clima" (F2), pasta "Nuvens", com "Copiar valores".
- **Sem sombra à noite** (pedido do usuário no teste): só o sol faz sombra
  (`shadowIntensity`, que também cai com o céu fechado). Sem sombra, o mapa
  de sombra nem é refeito (`shadow.autoUpdate`), e o `castShadow` fica
  ligado — desligar recompilaria todos os materiais no pôr do sol.
- **Clima no combate** (pedido do usuário no teste — estava fora de
  escopo): os modificadores clássicos entram na fórmula de dano
  (`modificadores = weather × stab × type1 × type2 × random`). Com chuva e
  tempestade, golpe de Água mais forte e de Fogo mais fraco; com neve, a
  Defesa do Pokémon de Gelo sobe. Os números ficam em
  `WEATHER.MOVE_TYPE_MULTIPLIER` e `WEATHER.DEFENSE_MULTIPLIER`
  (`core/weather/weatherModifiers.js`). Vale o clima onde está quem ataca
  (`combatWeatherAt`: o do mapa, ou o forçado pelo debug), inclusive nos
  ticks do golpe canalizado. Os mundos de teste (`makeWorld`) nascem com o clima fixo em
  limpo, para o dano dos testes não depender do lugar.
- **Sol forte** (pedido do usuário no teste): quinto tipo de clima
  (`sun`), com chance por bioma (alta no deserto e na savana, zero na
  tundra). Só vale de dia: à noite, a região sorteada com sol forte fica
  limpa (`weatherAt`, pelo `isDaytime`). No combate, Fogo mais forte e Água
  mais fraca; no céu, luz do sol mais forte e mais quente e quase sem
  nuvens (`WEATHER.SUN_*`), sumindo no pôr do sol.
- **Partículas** (`view/scene/WeatherView.jsx`): a posição de cada gota e
  floco é calculada no shader, presa ao mundo e repetida numa caixa em volta
  da câmera; a CPU só passa quanto já caiu.
- **Sons** (`core/data/audio/weatherSounds.js`): carregados na hora, como
  os outros sons do jogo — não entraram no pré-carregamento.
- **Save**: `worldTime` vai dentro de `trainer` no save e numa coluna
  própria da tabela `trainer`.

## Critérios de conclusão

- O dia passa sozinho: amanhecer, dia, entardecer e noite, com o céu, o sol,
  a lua, as estrelas, a luz e a névoa acompanhando, sem saltos.
- À noite o jogo fica escuro, mas dá para jogar.
- Pausado, o relógio para; fechar e abrir o jogo volta na mesma hora.
- Cada bioma tem o clima dele: neve na tundra, chuva na selva, quase sempre
  limpo no deserto. O clima muda com o tempo e entre regiões, aos poucos.
- Chuva, neve e tempestade têm partículas e som; a tempestade tem relâmpago
  e trovão.
- Com a mesma seed, o clima é o mesmo no mesmo lugar e na mesma hora.
- O F2 mostra e controla a hora e o clima.
- Os gates passam.

---

## Fora de escopo

- O clima afetar o movimento (chão escorregadio, neve acumulando).
- Tempestade de areia e neblina como tipos de clima.
- A luz no estilo BotW e o ajuste das cores por bioma: ficam para a 049.
- Nuvens 3D e sombra de nuvem no chão.
- Usar o horário e o clima no spawn: fica para a 055.
- O relógio no servidor: fica para a 067.
- Mostrar a hora e o clima na HUD: fica para a 058.

---

## Fechamento

- **Teste no jogo pelo usuário**: aprovado. No teste ele pediu nuvens, sem
  sombra à noite, os modificadores do clima nos golpes e o sol forte — tudo
  entrou nesta feature (ver "Como ficou").
- **Trovão**: ficou o som do golpe Thunder do Cobblemon.
- **Wiki**: página "O mundo" ganhou "Dia e noite", "Clima" (com a chance de
  cada clima por bioma) e "Clima na batalha"; a conta do dano em "Dano"
  ganhou o termo "clima". A calculadora de dano continua sem clima.
- **Roadmap**: 048 no "Já feito" (grupo "Pokémon e mundo"); a 049 cita que a
  luz no estilo BotW parte das cores por hora daqui. Backlog sem mudança.
- **Gates**: `npm test` inteiro (203 arquivos, 2065 testes, 9 pulados de
  antes, com `--maxWorkers=2`), `npm run lint` e build (numa cópia, com o
  `next dev` rodando).

