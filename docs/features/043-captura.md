# 🚀 Versão 0.0.43 — Captura

## Resumo

A Pokébola passa a funcionar. O treinador mira e arremessa a bola **em arco,
como no Legends Arceus**. Se ela acerta um selvagem, ele vira luz e entra na
bola, a bola cai e balança, e no fim ou captura ou ele escapa.

- **Chance** pela taxa de captura da espécie, pelo HP restante, pela bola e
  pelas condições do alvo. Selvagem **desmaiado também pode ser capturado**.
- **Capturado**: vai para um slot vazio do time; sem slot, para o
  inventário; com o inventário cheio, a bola fica no chão (pegar do chão é
  depois). Mantém nível, XP, IV, golpes, vida e condições, e grava a bola
  usada. O time ganha **metade** do XP de derrotá-lo.
- **Escapou**: pelo temperamento, ele foge ou parte para a briga. Se estava
  desmaiado, acorda com parte da vida.
- **Errou**: a bola quica, rola um instante no chão, quebra e some.
- Retorno visual de "Capturado!" / "Escapou!" (texto flutuante, log de
  batalha e efeitos).

Versão: `0.0.43` (`package.json`). Branch: `feature/043-captura`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (dados da espécie/do item/config).

---

## O que já existe (ponto de partida)

- **Pokébolas no catálogo** (042): `poke-ball`, `great-ball`, `ultra-ball`,
  categoria `pokeball`, com `pokeball.captureMultiplier` e `model` (`.glb`
  + textura). Na mão, o clique primário não faz nada.
- **Mira e arremesso** (016): segurar o botão direito mira (retículo, câmera
  de ombro, lock-on); o clique primário mirando arremessa um `Projectile` em
  **linha reta, sem gravidade** (`resolveThrowLaunch`), da mão aproximada
  (`resolveHandOrigin`). O `projectileSystem` colide com o mundo por
  raycast varrido. A categoria `throwable` está sem item (guardada para cá).
- **Esfera de invocar** (024): voo da bola, `SummonFlash`/`SummonPulse` e o
  feixe de recolher (`RecallBeam`) — base para o "virar luz e entrar na
  bola".
- **Registro do Pokémon** (041): `criarPokemon(world, trainer, speciesId,
  { ballId })` cria no inventário; `Pokemon.ballId` guarda a bola;
  `colocarNoTime`, `findFreeCell`.
- **Selvagem** (020/034): `WildCreature` com `CreatureLevel`,
  `IndividualValues`, `CreatureMoves` e `Vitals` próprios; `WildBehavior`
  com `temperament` (`'hostile'`/`'peaceful'`), `perseguirJogador`,
  `fugirDoJogador`, `voltarAVagar`.
- **XP** (037): `registrarParticipante` e `distribuirExperiencia` (dividido
  entre quem lutou).
- **Comida caída** (042): física cosmética de quicar/rolar com o
  `cosmeticRng` (`droppedFoodSystem`) — o mesmo jeito serve para a bola que
  errou.
- **Sons**: nenhum som de bola/captura em `public/assets/audio/`.

---

## Decisões (com o usuário)

1. **Arremesso como no Legends Arceus**: a bola sai em **arco, com
   gravidade** (não reta como o arremesso da 016).
2. **Errou**: a bola quica, rola no chão por um instante, quebra e some. Só
   visual; não dá para pegar de volta.
3. **Só selvagem**, a qualquer momento, **inclusive desmaiado**.
4. **Chance no estilo Gen 3**: taxa base da espécie × fator do HP × bola ×
   bônus de condição. Desmaiado conta como **HP 0** (o fator de HP no
   máximo).
5. **3 balançadas**, cada uma com o seu teste (pode escapar em qualquer
   uma). A refinar depois.
6. **Escapou**: rola entre **fugir e batalhar**, com o **temperamento**
   pesando (hostil tende a brigar, pacífico tende a fugir). Se estava
   **desmaiado**, acorda com uma parte da vida.
   - A revisão geral da batalha e da IA (ofensiva/fuga) foi para o Marco 5
     (075).
7. **Capturado**:
   1. vai para o **primeiro slot vazio do time**; sem slot, para o
      **inventário**; com o inventário cheio, **fica no chão** (pegar do
      chão é futuro);
   2. **mantém as condições** (ex.: queimadura), além de nível, XP, IV,
      golpes e vida.
8. **XP**: o mesmo cálculo de derrotar, **pela metade**.
9. **Retorno**: texto flutuante "Capturado!" / "Escapou!", linha no log de
   batalha, a criatura vira luz entrando na bola (reaproveitando a 024).
10. **Ataque pelas costas** (Legends Arceus) entra: acertar pelas costas um
    selvagem que não percebeu o treinador dá bônus de captura.
11. **Condições continuam dentro da bola**: uma criatura queimada, recolhida
    ou capturada, continua queimando pelo tempo que falta, e pode desmaiar
    já dentro da bola. Vale para o recolher do time também (hoje a
    queimadura some ao recolher).
12. **XP só para quem lutou.** Se ninguém lutou, ninguém ganha (no futuro o
    treinador terá XP e, nesse caso, só ele ganharia).
13. **Só o treinador arremessa** a Pokébola (não a criatura pilotada).
14. **Arremesso exatamente como no Legends Arceus**: sem carregar força e
    sem linha de trajetória; lock-on mira no selvagem.

---

## Arquitetura

### Arremesso em arco (`playerActionSystem.js`)

- Clique primário **mirando** com uma `pokeball` na mão dispara a ação
  `throw` (mesma ação, mesmo clipe e mesmo custo de stamina da 016). A
  bola é gasta **no arremesso** (`gastarItem`), acertando ou não.
- No `effectAt`, nasce uma **`CaptureBall`** (entidade nova, não o
  `Projectile` genérico): `{ itemId, thrower, state }`, com `Position`,
  `Velocity` e `OwnedBy(thrower)`.
- **Trajetória**: velocidade de lançamento fixa por bola
  (`GAME_CONFIG.CAPTURE.THROW_SPEED`, ex.: 14 m/s) e gravidade própria
  (`CAPTURE.GRAVITY`). O ângulo é resolvido para o arco **passar pelo ponto
  de mira** (`resolveArcLaunch`, solução balística do ângulo mais baixo).
  Fora do alcance, sai no ângulo de alcance máximo, na direção da mira.
  - Com lock-on num selvagem, o ponto de mira é o centro do corpo dele (o
    "auto-aim" do Legends Arceus).
  - Sem linha de trajetória na tela (como no Legends Arceus).
- Arremessos seguidos são permitidos (cada um respeita a duração da ação).

### Voo e acerto (`captureBallSystem.js`, passo fixo)

- Integra posição com gravidade; colisão por **raycast varrido** (como o
  `projectileSystem`), excluindo a cápsula de quem arremessou.
- O raycast precisa dizer **qual entidade** o collider é (mapa
  collider → entidade, no `core/physics/`).
- **Bateu num selvagem** (`WildCreature`, não sendo capturado) → começa a
  captura (abaixo).
- **Bateu em outra coisa** (chão, parede, criatura do time, treinador) →
  vira bola perdida: quica e rola com a física cosmética (mesmo esquema da
  comida caída, ajustes em `CAPTURE.MISS_PHYSICS`), e depois de
  `CAPTURE.MISS_LIFETIME` **quebra** (partículas + som) e some.

### Captura em andamento

- Trait **`BeingCaptured`** no selvagem: `{ ball }`. Enquanto existe:
  - ele some da cena (vira luz entrando na bola), a IA, o movimento, o
    ataque e o vitals regen **param**, e ele não pode ser acertado nem
    alvo de ninguém (fica fora das queries de combate);
  - a **queimadura continua** (decisão 11): se a vida zerar dentro da bola,
    ele desmaia ali mesmo e a captura segue (desmaiado também é
    capturável). A chance é calculada uma vez, no acerto;
  - outra bola que bater onde ele estava passa direto (já está sendo
    capturado).
- A `CaptureBall` passa por estados (fase em tag traits ou campo `state`,
  com timer no `Timer`):
  1. `absorbing` — a bola para no ar, abre, o selvagem vira luz e entra
     (`CAPTURE.ABSORB_DURATION`);
  2. `falling` — cai até o chão embaixo dela;
  3. `shaking` — **3 balançadas** (`CAPTURE.SHAKE_COUNT`, intervalo
     `CAPTURE.SHAKE_INTERVAL`); em cada uma, um teste: falhou → `escaped`;
  4. `caught` — "clique", estrelinhas, a bola some → **capturado**;
  5. `escaped` — a bola estoura e some, o selvagem reaparece onde a bola
     estava → **escapou**.
- Se quem arremessou sumir no meio (não deve acontecer offline), a captura
  termina como `escaped`.

### Chance (`core/battle/capture.js`, puro)

Fórmula no estilo Gen 3, com os nomes do jogo:

- `a = ((3 × hpMax − 2 × hp) × taxaDaEspecie × multiplicadorDaBola) /
  (3 × hpMax) × bonusDeCondicao`
- desmaiado: `hp = 0`;
- `a ≥ 255` → captura direto (sem teste nas balançadas, mas balança igual);
- senão, chance de **cada** balançada passar:
  `b = 65536 / (255 / a)^(1/4)`, testado contra `0..65535` com o
  `gameplayRng`.

Onde mora cada número:

- `species.capture.rate` (novo, nos dados da espécie, escala 0–255 da série;
  ex.: Charmander 45). Espécie sem o campo usa `CAPTURE.DEFAULT_RATE`.
- `item.pokeball.captureMultiplier` (já existe).
- `CAPTURE.CONDITION_BONUS` por condição (ex.: queimado × 1,5; sem condição
  × 1). Hoje só existe a queimadura; as outras entram quando existirem.
- **Pelas costas** (decisão 10): `CAPTURE.BACK_STRIKE_BONUS` multiplica `a`
  quando o selvagem **não percebeu** o treinador (`WildBehavior.state`
  vagando, sem ameaça) e a bola chega **por trás** (ângulo entre a frente
  dele e a direção de onde a bola veio maior que
  `CAPTURE.BACK_STRIKE_ANGLE`). Texto "Pelas costas!" no acerto.
  `isBackStrike` é puro e testado.

Funções puras e testáveis: `resolveCaptureValue`, `resolveShakeChance`,
`rollShake(rng, chance)`.

### Capturado (`capturarSelvagem`, `core/actions/capture.js`)

- Cria o registro a partir do selvagem, **sem sortear nada**: espécie,
  `CreatureLevel` (nível e XP), `IndividualValues`, `CreatureMoves`
  (clonados), vida atual em `StoredVitals`, condições guardadas e
  `ballId` da bola usada. Se estava desmaiado, entra com `StoredFaint` (o
  mesmo desmaio fora de campo do time, que reanima com o tempo).
  - `criarPokemon` ganha a variante "a partir de um estado pronto" (ou uma
    action irmã), em vez de duplicar a montagem do registro.
- **Destino**:
  1. primeiro slot vazio do time (`colocarNoTime`);
  2. senão, primeira célula livre do inventário (`findFreeCell`);
  3. senão, **no chão**: o registro fica com `DroppedBall { x, y, z }` (sem
     slot e sem célula) e a bola fechada aparece parada onde caiu. Ninguém
     pega ainda. As listas do inventário/time ignoram quem tem
     `DroppedBall`.
- Destrói a entidade do selvagem (e a física dela).
- **XP**: `distribuirExperiencia` com o fator `CAPTURE.XP_FRACTION`
  (metade), **só para quem lutou** com ele (os participantes da derrota).
  Sem participantes, ninguém ganha (decisão 12).
- Atualiza a Pokédex (capturado), se a Pokédex tiver esse registro.
- Emite o evento `pokemonCaptured` (log, texto flutuante, som).

### Condições guardadas no registro

Hoje o registro do Pokémon guarda só a vida (`StoredVitals`) e o desmaio
(`StoredFaint`); a queimadura **não** sobrevive ao recolher. Pela decisão 11,
a condição continua correndo dentro da bola:

- Trait **`StoredConditions`** no registro (`{ burn: { ... } | null }`,
  extensível), com o tempo que falta de cada condição. Escrito na
  **captura** e no **recolher** (`applyRecall`, `partySummonSystem.js`).
- **`storedConditionSystem`** (passo fixo): continua o tick da queimadura
  nos registros que estão na bola (time, inventário ou chão), tirando da
  vida guardada (`StoredVitals`) com a mesma regra do `burnSystem` (a
  conta do dano fica num lugar só, usada pelos dois). Acabou o tempo, a
  condição sai. Vida guardada em 0 → **desmaia na bola** (`StoredFaint`,
  o mesmo desmaio fora de campo, que reanima com o tempo).
- Ao **invocar**, o `summonBallSystem` devolve as condições com o tempo que
  falta para a criatura e limpa o trait.

### Escapou (`selvagemEscapou`, `core/actions/capture.js`)

- Tira o `BeingCaptured`; o selvagem reaparece no ponto da bola.
- Se estava **desmaiado**: sai do desmaio com
  `CAPTURE.ESCAPE_WAKE_HP_FRACTION` da vida máxima (ex.: 30%).
- **Reação** pelo temperamento: chance de brigar em
  `CAPTURE.ESCAPE_FIGHT_CHANCE[temperament]` (ex.: hostil 0,8; pacífico
  0,25), rolada com o `gameplayRng`:
  - brigar → `perseguirJogador(entity, { provoked: true })`, com quem
    arremessou na tabela de ameaça;
  - fugir → `fugirDoJogador(entity)`.
- Emite o evento `captureEscaped`.

### Eventos

| evento | quem emite | quem consome | fase |
|---|---|---|---|
| `captureStarted` | `captureBallSystem` | view (luz, som de abrir) | eventos do passo fixo |
| `captureShook` | `captureBallSystem` | view (som de balançar) | idem |
| `pokemonCaptured` | `capturarSelvagem` | log, texto flutuante, som, XP já aplicado | idem |
| `captureEscaped` | `selvagemEscapou` | log, texto flutuante, som | idem |
| `captureBallBroke` | `captureBallSystem` | view (partículas, som) | idem |

Sem consumidor, nada acontece (são só retorno).

### View

- **`CaptureBallView`**: o `.glb` da bola em voo (girando), parada no ar
  abrindo, caindo e balançando. A balançada é **procedural**
  (inclinação de um lado pro outro com mola), com **preview de parâmetros
  ajustáveis** antes de entrar.
- **Absorver**: a criatura encolhe para a bola com o brilho vermelho/branco
  (reaproveita `SummonFlash`/`RecallBeam` invertidos).
- **Capturado**: estrelinhas e o "clique"; **escapou**: a bola estoura em
  luz e o selvagem aparece.
- **Bola perdida**: rola, quebra em pedaços/partículas e some.
- **Bola no chão** (inventário cheio): a bola fechada, parada.
- Texto flutuante "Capturado!" / "Escapou!" (cores em `GAME_CONFIG.FEEDBACK`)
  e linha no log de batalha.

### Sons (assets pendentes)

Arremesso, bola abrindo/absorvendo, cada balançada, "clique" de capturado,
estouro de escape e bola quebrando. Sem os arquivos, o som fica pendente
(como o de comer na 042); a fila de som já fica preparada pelos eventos.

### Constantes (`GAME_CONFIG.CAPTURE`)

`THROW_SPEED`, `GRAVITY`, `MAX_RANGE`, `ABSORB_DURATION`, `SHAKE_COUNT`,
`SHAKE_INTERVAL`, `MISS_LIFETIME`, `MISS_PHYSICS`, `DEFAULT_RATE`,
`CONDITION_BONUS`, `XP_FRACTION`, `ESCAPE_WAKE_HP_FRACTION`,
`ESCAPE_FIGHT_CHANCE`.

### Testes

- Chance: HP menor → chance maior; desmaiado = HP 0; bola melhor → chance
  maior; condição → chance maior; `a` no teto captura direto (valores
  derivados da config/espécie, sem fixar números).
- Arco: o lançamento resolvido passa pelo ponto de mira dentro do alcance;
  fora do alcance, sai no ângulo de alcance máximo.
- Arremessar gasta a bola; sem bola/sem mirar/sem stamina não arremessa.
- Bola acerta selvagem → `BeingCaptured`; acerta outra coisa → bola perdida
  que some depois do tempo; não captura criatura do time nem o treinador.
- Selvagem sendo capturado: não age, não é acertado, não é alvo.
- Capturado: registro com o mesmo nível/XP/IV/golpes/vida/condições do
  selvagem e o `ballId` da bola; destino slot → inventário → chão; desmaiado
  entra desmaiado; o selvagem some; XP = metade do de derrotar.
- Escapou: volta a existir e agir; desmaiado acorda com a fração da vida;
  reação briga/foge pelo temperamento (RNG injetado).
- Pelas costas: bônus só com o selvagem desatento e a bola vindo de trás.
- Condições na bola: recolher e capturar guardam a queimadura com o tempo
  que falta; ela continua tirando vida guardada; zerou → desmaia na bola;
  acabou o tempo → sai; invocar devolve com o tempo que falta.
- XP: sem participantes, ninguém ganha.
- Criatura pilotada com Pokébola na mão não arremessa.

---

## Ajustes durante a implementação

- **O selvagem continua existindo dentro da bola** (`BeingCaptured`), sem
  colisão, fora da cena e sem agir, em vez de virar um "retrato" guardado
  na bola. Assim a queimadura, o desmaio e o XP do desmaio seguem o
  caminho de sempre (`burnSystem`, `faintSystem`). Quem ignora quem está na
  bola: `isActiveCombatant` (alvo da IA do time/do treinador/selvagens),
  os candidatos de acerto dos golpes (`attackTargets.js`), a IA do selvagem
  (`wildBehaviorSystem`, `wildWanderSystem`), a regeneração e a contagem
  do desmaio (não acorda dentro da bola; o escape acorda). Na view, o
  modelo, a etiqueta e o fogo da queimadura somem.
- **Lock-on não existe mais** (saiu na 029): o ponto de mira é o que o
  retículo acerta (`resolveAimPoint`). Mirando no selvagem, o raio acerta a
  cápsula dele e o arco vai até lá. Sem linha de trajetória.
- **Arremesso**: mesma ação `throw` (clipe, duração, stamina) do
  arremesso reto; a velocidade sai de `resolveArcLaunch` (`core/aim.js`)
  com `CAPTURE.THROW_SPEED`/`CAPTURE.GRAVITY`. A bola é gasta no instante
  em que sai da mão. Só quem tem `Party` (o treinador) arremessa Pokébola.
  Na mão, a Pokébola aparece como uma esfera no tamanho da bola até ser
  solta (o modelo dela na mão fica pra depois).
- **Acerto**: além do raycast (que bate na cápsula com collider), um teste
  geométrico do caminho da bola contra a cápsula de cada selvagem
  (`findWildHit`, raio da bola `CAPTURE.BALL_RADIUS`) — funciona sem física
  e não deixa a bola passar "de raspão".
- **Desmaiado já deu XP no desmaio**: capturar um selvagem desmaiado não dá
  XP de novo (o `FoughtBy` já foi zerado no desmaio). Vivo, quem lutou ganha
  `CAPTURE.XP_FRACTION` do XP de derrotar (`distribuirExperiencia` ganhou o
  parâmetro `fraction`).
- **Limite do inventário = a grade** (pedido do usuário ao fechar a
  feature): a grade do inventário não cresce mais; tem o tamanho de
  `GAME_CONFIG.INVENTORY` (colunas × linhas, as que ela já mostrava) e esse é
  o limite (`resolveInventoryCapacity`). Cheio, o capturado fica numa bola
  no chão (`BallOnGround`, `GroundBallsView`); mover pra fora da grade e
  tirar do time sem lugar são recusados. Item novo com a grade cheia ainda
  ganha posição fora dela (não aparece) — revisar quando houver itens no
  mundo (052).
- **Condições**: `StoredConditions` no registro, escrito no recolher e na
  captura; `storedConditionSystem` queima a vida guardada com a mesma conta
  do `burnSystem` (`avancarQueimaduraGuardada`) e, zerando, desmaia na bola
  (log "desmaiou dentro da Pokébola!"). O invocar devolve a queimadura com
  o tempo que falta (sem o crédito de quem queimou).
- **Efeitos reaproveitados**: o feixe vermelho do recolher (`RecallBeam`)
  da bola até o selvagem na absorção e o clarão do invocar (`SummonFlash`)
  onde ele reaparece no escape.
- **Visual da bola** (`captureBallViewSystem`, `captureBallMotion.js`,
  ajustes em `GAME_CONFIG.FEEDBACK.CAPTURE_BALL`): gira em voo; em pé
  virada pra quem arremessou com o brilho crescendo e sumindo na absorção;
  inclina de lado e volta a cada balançada; no "Capturado!", o clique e as
  estrelinhas; no escape, estoura com um clarão; a que errou rola e quebra
  em pedaços no fim.
- **Textos e log**: "Pelas costas!" na bola, "Capturado!" no ponto dela,
  "Escapou!" em cima de quem escapou; no log, "Pegou! X foi capturado!" +
  pra onde foi, "X selvagem escapou da Pokébola e fugiu!/e partiu pra
  cima!".

## Mira da Pokébola (pedido depois do teste no jogo)

O arremesso direto, sem nenhum retorno de onde a bola ia, não parecia o
Legends Arceus. Decisões com o usuário:

- **Só arremessa mirando**: segurar o botão direito com uma Pokébola na mão
  entra no modo mira; o clique só arremessa enquanto mira.
- **Duas variantes pra testar**, trocadas em `GAME_CONFIG.CAPTURE.AIM.MODE`
  ou no seletor do painel de debug (F2):
  - `'arc'` — pontinhos ao longo do arco previsto e um círculo no chão onde
    a bola bate (em volta dos pés do selvagem, quando ela pega um); o
    retículo é só um ponto;
  - `'reticle'` (fiel ao Arceus) — sem linha; o retículo é um círculo que
    fica vermelho e "trava" (cantos e ponto no meio) quando a bola pegaria
    um selvagem, e apagado quando ela não chega a bater em nada.
  - Cores nos dois: branco normal, vermelho pegando um selvagem, cinza fora
    do alcance (`FEEDBACK.AIM_*`).
- **Mirando**: a câmera chega mais perto e mais pro ombro, com transição
  (`CAPTURE.AIM.CAMERA_DISTANCE`, `SHOULDER_OFFSET`, `BLEND_SPEED`); o
  treinador não corre e fica de frente pra onde a câmera mostra, andando de
  lado se precisar.

Como funciona:

- **`captureAimSystem`** (simulation, logo depois do controle da câmera):
  resolve o ponto de mira no enquadramento da mira
  (`resolveCaptureAimFraming`, `core/aim.js` — a câmera renderizada usa o
  mesmo), o lançamento em arco até ele e o voo previsto
  (`traceCaptureFlight`, `core/battle/captureFlight.js`, o mesmo teste de
  acerto do voo de verdade). Escreve `CaptureAim` (todo tick),
  `CaptureAimStatus` (o resumo pra HUD, só quando muda) e a relação
  `CaptureAimTarget` (o selvagem que a bola pegaria).
- O arremesso usa exatamente a velocidade da mira: a bola cai onde o arco
  mostrou.
- View: `CaptureAimView.jsx` + `captureAimViewSystem.js` (arco e círculo),
  `tools/hud/CaptureAimHud.jsx` (retículo, só mirando).

### Correções depois do teste da mira

- **A bola não ia pro retículo** (mais visível no modo retículo): o raio da
  mira (`computeAimRay`, `core/camera/orbitCamera.js`) saía da posição da
  câmera SEM o desvio de ombro, mas apontava pro ponto deslocado — cruzava o
  centro da tela em ângulo, e a câmera da mira (mais perto e mais no ombro)
  aumentava o erro. Agora ele sai da mesma posição da câmera renderizada e
  segue exatamente o centro da tela. Vale pra todo mundo que mira pela
  câmera (arremesso, esfera de invocar, golpes).
- **Bola batendo em parede "subia" pro topo do objeto**: o raio que
  procurava o chão nascia dentro do obstáculo. Agora a bola é uma esfera de
  verdade (`sweepBall`, `core/battle/captureFlight.js`): o raio do caminho
  devolve a normal da superfície (`castRayWithNormal`), ela encosta a um
  raio dela, quica refletindo pela normal (`RESTITUTION`), desliza no resto
  do trecho ao longo da superfície e rola com atrito até parar. O voo, a
  bola perdida e a previsão da mira usam o mesmo `sweepBall`.
- **Item na mão**: era sempre uma esfera; agora é o modelo do próprio item
  (`HeldItemView.jsx` + `ItemModel`, sem modelo cai na esfera genérica),
  posto no osso da mão a cada frame (`heldItemViewSystem`). A Pokébola só
  aparece na mão **mirando** (e no gesto de arremesso, até soltar);
  `throwable` continua aparecendo sempre que equipado.
- O usuário preferiu o modo **retículo** (Arceus), que virou o padrão
  (`CAPTURE.AIM.MODE`); o arco continua no seletor do debug por enquanto.

### Bola na mão e animações do `.glb`

- **Ajuste na mão**: `item.model.hand` (`position` em m, `rotation` em
  graus, `scale`), no espaço do osso da mão (`RHand` do treinador,
  `view/handBoneBySpecies.js`) — documentado no `_template/` dos itens.
- **Hora de soltar**: é a do arremesso do treinador
  (`boy/index.js`, `actions.throw.duration` e `effectAt`); a bola de
  verdade nasce na mão aproximada do core (`handForwardOffset`,
  `handSideOffset`, `handHeightOffset`, mesma ação).
- **Clipes da Poké Bola** (`item.model.animations`): `flying` → `spin`
  (repete), `absorb` → `capture_absorb` (encaixado em
  `CAPTURE.ABSORB_DURATION`), `shake` → `capture_wobble` (cada balançada;
  acelerado só se passar do `CAPTURE.SHAKE_INTERVAL`), `caught` →
  `capture_success`, `escaped` → `capture_fail`. Tocados pelo
  `captureBallViewSystem` num `AnimationMixer` por bola
  (`resolveBallClip`/`resolveClipTimeScale`, `view/captureBallMotion.js`).
  Fase sem clipe (a bola perdida rolando; Grande e Ultra Bola, que não têm
  clipes) usa o procedural. `summon`, `recall`, `open` e `close` ainda não
  são usados.
- **Bola sumindo ao balançar**: o `poke-ball.glb` veio com todos os quadros
  a partir de 0,8 s (quadro 48) zerados — escala e posição 0 — em todo clipe
  mais longo que isso (`summon`, `recall`, `capture_absorb`,
  `capture_wobble`, `capture_fail`). Na balançada, a bola ficava de tamanho
  zero no fim de cada `capture_wobble`. O jogo agora corta essa "cauda
  morta" ao carregar (`trimDeadTail`, `view/itemClipCleanup.js`): os clipes
  passam a terminar em 0,8 s (ficou bom assim no jogo).
- **Bola travada aberta no ar e "teleportando" pro chão**: o
  `capture_absorb` move a RAIZ da bola (sobe ~0,28 m) e o trecho que fecha
  ela estava na cauda zerada. A subida ficava presa e sumia de uma vez
  quando o `capture_wobble` começava. Agora:
  - o movimento da raiz sai dos clipes ao carregar (`stripRootMotion`,
    `view/itemClipCleanup.js`) — a posição é do jogo, o clipe só mexe nas
    peças (tampa, corpo, dobradiça);
  - o pulinho depois do acerto é do jogo: a bola sobe
    `CAPTURE.ABSORB_HOP_HEIGHT` em `ABSORB_HOP_TIME`, desacelerando
    (`resolveAbsorbHop`), e flutua enquanto absorve (`CaptureBall.hitY`);
  - caindo, toca o `close` (`item.model.animations.close`) e chega fechada
    no chão; fica fechada até a 1ª balançada.
- **As outras Pokébolas usam as animações da Poké Bola** (pedido do
  usuário: "vão ser sempre as mesmas"): `item.model.clipsFrom: 'poke-ball'`
  na Grande e na Ultra Bola. Os `.glb` delas só têm `top` e `bottom` soltos
  (e vêm ~40× maiores e deitados, Z pra cima); ao carregar, o mesmo
  esqueleto de nós da Poké Bola (`rock > body > [bottom, hinge > top]`) é
  montado em volta dessas peças, na escala delas (`rigLikeSource`,
  `view/itemRig.js`), e os clipes da Poké Bola tocam ali com as posições
  reescaladas (`scalePositionTracks`). `item.model.rig.rotation` endireita
  o modelo (`x: -90` nas duas) — de quebra, elas deixam de aparecer
  deitadas na mão, voando e no chão. O mapa de clipes também é herdado
  (`resolveItemAnimations`). Bola nova: basta ter as peças com os mesmos
  nomes e apontar `clipsFrom`.

### Invocar e recolher com a Pokébola de verdade (pedido do usuário)

A esfera de invocar (024) era uma bola vermelha simples, e o recolher só
tinha o feixe. Agora usam o modelo da bola em que o Pokémon foi capturado
(`Pokemon.ballId`) e os clipes do `.glb` (`summon`, `recall` no mapa
`item.model.animations`, herdado pelas outras bolas):

- **Invocar**: a bola do Pokémon aparece na mão durante o gesto até soltar
  (`summon.effectAt`); voa com o modelo e o clipe de voo (`spin`), virada
  pra onde vai; ao pousar, além do clarão, nasce a **`SummonBallOpen`**
  (só visual, `summonBallSystem` → `summonEffectsSystem`): a bola em cima
  da cabeça da criatura (`SUMMON_BALL.ABOVE_HEAD`), virada pro treinador,
  dá um pulinho (`HOP_*`), toca o `summon` encaixado em
  `SUMMON_BALL.OPEN_DURATION` (abre e fecha) e some encolhendo
  (`VANISH_DURATION`).
- **Recolher**: a bola do Pokémon na mão o gesto inteiro, tocando o
  `recall` encaixado em `recall.duration` do treinador (aparece, abre, o
  feixe puxa, fecha). A bola é lida no começo do gesto (a criatura some no
  meio). O item segurado esconde nesses gestos.
- View: `SummonBallView.jsx` (voo e abrindo), `summonBallViewSystem`,
  `HandBallView.jsx` (uma bola de cada tipo, montada uma vez) +
  `handBallViewSystem`. O tocador de clipe virou compartilhado
  (`view/ballClipPlayer.js`) entre captura, invocar e mão.

### Sons, feixe e partículas do Cobblemon (pedido do usuário)

Material de `.exemple/Coblemon/` (o feixe original era "inventado" em outra
sessão; o Cobblemon tem o dele):

- **Sons** (`public/assets/audio/pokeball/`, volumes do `sounds.json` do
  Cobblemon, em `core/data/audio/pokeballSounds.js`): sair da mão (4
  variações), acertar, abrir, fechar, bater no chão, balançar (4), capturado,
  estourar/quebrar, abrir ao invocar e recolher. Tocados num ponto do mundo
  (`view/audio/worldSounds.js` — vozes `PositionalAudio` em rodízio,
  `WorldSoundsView.jsx`) pelo `pokeballFeedbackSystem`, que compara o que
  viu da bola com o estado dela (`resolveBallSoundMoments`). Os sons de
  invocar/recolher do treinador (023) continuam; volume 0 num momento
  desliga ele.
- **Feixe** (`RecallBeamView.jsx`): no estilo do Cobblemon — cilindro com a
  textura `phase_beam.png` correndo ao longo dele, miolo + brilho, tingido
  com a cor da bola (`item.pokeball.beamColor`; ajustes em
  `FEEDBACK.PHASE_BEAM`). O `RecallBeam` ganhou `mode` (`'recall'`,
  `'capture'`, `'sendOut'`) e `itemId`: recolhendo/capturando, o envelope de
  luz encolhe e vai até a bola; invocando (feixe novo, da bola aberta até a
  criatura, `SUMMON_BALL.BEAM_DURATION`), ele cresce no lugar dela
  (`resolveBeamPhase`, `view/phaseBeam.js`). Saíram o raio deformado e a
  esfera na mão (`beamThickness`/`beamJitter` do treinador).
- **Partículas** (`view/vfx/pokeballVfx.js`, tradução dos `.particle.json`
  com as texturas em `public/assets/effects/pokeball/`): a bola abrindo
  (clarão, brilhos e faíscas, com textura e cor por bola — invocar e o
  selvagem escapando) e o "Capturado!" (estrelinhas, faíscas e o brilho que
  fica, no lugar das estrelinhas procedurais, que viram reserva com as
  partículas desligadas). `PokeballVfxView.jsx` + `pokeballVfxQueue.js`;
  `FEEDBACK.POKEBALL_VFX` liga/desliga e escala.

- **Coisas aparecendo na origem ao invocar** (correção depois do teste): o
  objeto de toda view registrada (`registerView`) ficava na origem da cena
  até o próximo `syncTransformSystem`, e o registro era num `useEffect`, que
  roda depois de o R3F já ter desenhado um quadro. No invocar, o feixe de
  saída e a luz no formato da criatura (o envelope) apareciam um instante na
  origem e "teleportavam". Agora o `registerView` já põe o objeto na
  posição/giro da entidade, e as views se registram num `useLayoutEffect`
  (antes do primeiro quadro): feixe, bolas, clarão, projétil, comida caída,
  efeitos de golpe. Nas criaturas/treinador (`useAnimatedModel`), só o
  posicionamento inicial é no `useLayoutEffect` (`placeAtEntity`): o
  registro e o esqueleto/animações seguem no `useEffect` de sempre —
  adiantar eles mudava a ordem com o toon/textura e misturava as animações. (Uma 1ª
  tentativa escondia o modelo até a textura carregar — não era a causa e
  fazia o treinador sumir; foi desfeita.)

## Pendências com o usuário

- ~~**Sons**~~: resolvido com os do Cobblemon.
- ~~**Licença dos assets do Cobblemon**~~: não precisa — o jogo é de
  estudo, o deploy é só pra jogar em família.
- ~~**Reexportar o `poke-ball.glb`**~~: o corte em 0,8 s ficou bom no jogo
  e fica assim. Até chegarem, o áudio
  fica pendente.

---

## Fora de escopo

- Pegar do chão (bola perdida e bola com Pokémon) — depois.
- Arremesso furtivo/agachado e grama alta (stealth do Legends Arceus) — depois.
- Bolas de peso diferente (Pesada/Pena) e outras bolas.
- Revisão da batalha e da IA (ofensiva/fuga) — 075, Marco 5.
- XP do treinador (backlog).
- Salvar — 044 (precisa guardar `ballId`, condições guardadas e a bola no
  chão).
- Captura no servidor — 070.
- Sons, se os arquivos não vierem.

---

## Etapas

- [x] Bump da versão para `0.0.43` e doc da feature.
- [x] Revisão do doc pelo usuário.
- [x] `species.capture.rate` e `GAME_CONFIG.CAPTURE`; chance pura
      (`core/battle/capture.js`) + testes.
- [x] Arremesso em arco da Pokébola (`resolveArcLaunch`, `CaptureBall`) +
      testes.
- [x] Acerto (raycast + cápsula); `captureBallSystem` (voo, acerto, bola
      perdida) + testes.
- [x] `BeingCaptured` e as exclusões (IA, combate, regen, desmaio).
- [x] Estados da bola (absorver, cair, balançar, capturar/escapar) + testes.
- [x] `capturarSelvagem` (registro a partir do selvagem, destino, XP pela
      metade, `StoredConditions`, `BallOnGround`) + testes.
- [x] `selvagemEscapou` (acordar, brigar/fugir pelo temperamento) + testes.
- [x] Pelas costas (`isBackStrike`, bônus, texto) + testes.
- [x] `StoredConditions` no recolher e na captura, `storedConditionSystem`
      (queima e desmaia na bola) e invocar devolvendo + testes.
- [x] View: bola em voo, absorver, balançada procedural, capturado/escapou,
      bola perdida quebrando, bola no chão.
- [x] Preview da balançada com parâmetros ajustáveis (Artifact "Balançada da Pokébola").
- [x] Texto flutuante e log de batalha.
- [x] Mira (modos arco e retículo), correções da física da bola e do raio
      de mira, modelo na mão.
- [x] Animações do `.glb` da Poké Bola (e reaproveitadas nas outras bolas).
- [x] Invocar/recolher com a Pokébola de verdade.
- [x] Sons, feixe e partículas do Cobblemon.
- [x] Teste no jogo pelo usuário.
- [x] Roadmap e wiki.

---

## Critérios de Conclusão

- [x] Mirando com uma Pokébola na mão, o clique arremessa a bola em arco
      até o ponto de mira; a bola é gasta.
- [x] Bola que erra quica, rola, quebra e some.
- [x] Bola que acerta um selvagem (inclusive desmaiado) faz ele entrar na
      bola, que balança até 3 vezes e captura ou deixa escapar, com a
      chance pela espécie, HP, bola e condição (e pelas costas).
- [x] Capturado vai para o slot vazio, o inventário ou, cheio, o chão,
      com o mesmo nível, IV, golpes,
      vida, condições e a bola usada; quem lutou ganha metade do XP.
- [x] Escapou: foge ou briga pelo temperamento; desmaiado acorda com parte
      da vida.
- [x] "Capturado!" / "Escapou!" na tela e no log.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      170 arquivos, 1721 testes, com `--maxWorkers=2`; build feito numa
      cópia, por causa do `next dev` rodando).
- [x] Wiki atualizada: página nova "Captura" (Criaturas selvagens — mirar,
      dentro da bola, "Como a captura é decidida" — os 3 passos (valor →
      chance por balançada → sorteios) num exemplo resolvido com os números
      do jogo, a régua da linha de corte e os mesmos sorteios contra duas
      linhas —, os modificadores em geral, exemplos por vida e bola e a taxa
      de cada espécie, capturou,
      escapou); o bônus de captura de cada condição fica na descrição dela
      (efeito do golpe e "Efeitos em batalha"); "Itens", "Seu time" e
      "Inventário" (o limite da grade). Revisão geral da wiki: 076.
