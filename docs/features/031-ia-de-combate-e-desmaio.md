# 031 — IA de combate e desmaio

## Resumo

Continuação direta da 030 (dano dos ataques, já na `develop`): as
criaturas passam a lutar sozinhas e a sair da luta. Feita em rodadas,
com o usuário testando ao vivo:

1. **Comportamento das selvagens** — temperamento hostil/pacífico por
   indivíduo (chance por espécie), perseguir/fugir/vagar, reação ao
   apanhar, e debug F2 com o estado de cada uma.
2. **Selvagens atacando** pelo mesmo caminho do golpe do jogador, e a
   corrida pelo pathfinding passando a gastar stamina (selvagens e time).
3. **Desmaio** — selvagem e criatura do time a 0 de HP: intangível, sem
   regenerar, animação/olho de desmaio, sem piscar/falar/fogo; acorda
   depois de `FAINT.DURATION_MINUTES` com `REVIVE_HP_FRACTION` do HP. A
   do time é recolhida sozinha e não pode ser invocada até reanimar.
4. **Vida e energia guardadas na bola** — recolher não reseta mais; na
   bola regenera como fora.
5. **Correções pedidas no caminho** — o corpo desmaiado (e o personagem
   parado) não é mais empurrado; o debug de pathfinding não aponta mais
   pro jogador.
6. **IA do time (sempre defensiva) + ameaça das selvagens** — a criatura
   do time fora do controle defende o grupo, só com o ataque básico; a
   selvagem mira quem mais causou dano nela ou quem está mais perto.

Também no mesmo working tree, feito pelo usuário fora das rodadas
documentadas: clipes de desmaio (`clips/faint.json` de bulbasaur,
charmander e squirtle), `eyeStates.faint` (as três e o `boy`),
`FAINT` ajustado pra 15 min / 15%, balanceamento em
`core/data/species/stats.js` (HP +75, energia +50, intervalo do ataque
básico entre 0.05s e 0.5s), a grade no chão (`GameScene.jsx`) e o
`tools/proceduralAnimation/roster.js`.

Versão: `0.0.31` (`package.json`).

## Comportamento das selvagens (hostil / pacífica)

Primeiro passo do sistema de batalha das selvagens, pedido pelo usuário:
hostil persegue quem chega perto e desiste quando a pessoa sai do limite;
pacífica só vaga, e se apanhar revida ou foge (por enquanto sorteado).
Decisões do usuário: o alvo é quem estiver no controle (treinador ou
criatura do time); nesta etapa é só comportamento, sem golpe (perto do
alvo ela só encara); temperamento sorteado por indivíduo, com a chance
configurável por espécie.

- **`WildBehavior { temperament, state, provoked }`** (trait novo):
  `temperament` `'hostile'|'peaceful'`, sorteado no spawn
  (`rollTemperament` — `species.wild.hostileChance`, ou
  `WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE`, com `gameplayRng`); `state`
  `'wander'|'chase'|'flee'` (um campo só, nunca dois juntos); `provoked`
  = persegue porque apanhou (limite maior).
- **Actions** (`core/actions/wildBehavior.js`): `perseguirJogador`,
  `fugirDoJogador`, `voltarAVagar` (vaga a partir de onde está — o `home`
  do vagar passa a ser ali, sem voltar andando até o spawn).
- **`wildBehaviorSystem.js`** (simulation, antes do vagar):
  - hostil vagando entra em perseguição dentro de `AGGRO_RADIUS` (8m) e
    desiste além de `AGGRO_RADIUS + AGGRO_EXIT_MARGIN` (a folga evita
    ficar alternando parado na borda); provocada só desiste além de
    `RETALIATE_LEASH_RADIUS` (14m);
  - perseguindo: corre (`runSpeed`) até sobrar `CHASE_STOP_GAP` (0.8m)
    entre as bordas dos corpos, aí para e encara o alvo; e fica em modo
    combate (`entrarEmCombate` — olho bravo) enquanto persegue;
  - fugindo: corre pra um ponto `FLEE_STEP` à frente, no sentido oposto
    ao jogador, até `FLEE_SAFE_DISTANCE` (14m), e volta a vagar ali;
  - sem ninguém no controle, quem perseguia/fugia volta a vagar.
  Duas passadas: decide as trocas lendo, aplica depois (as actions
  escrevem em `WildBehavior`), e depois move.
- **`wildReactionSystem.js`** (fase `events` — primeiro uso dela): lê
  `attackResolved` com hit. Hostil → persegue provocada (mesmo atingida
  de longe). Pacífica vagando → `rollAttackReaction` (`RETALIATE_CHANCE`,
  50%): revida (persegue provocada) ou foge. Já fugindo/perseguindo,
  mantém.
- **Eventos pra gameplay**: a fila ganhou `beginStep()`/`stepEvents()`
  — o `GameLoop` chama `beginStep()` antes de cada passo fixo; systems da
  fase `events` leem só o que saiu naquele passo (sem reler quando o
  frame roda vários passos). A apresentação continua com o `drain()` do
  frame.
- **Navegação compartilhada** (`core/steering.js`, `steerTowards`): o
  trecho de pathfinding/desvio/giro do `wildWanderSystem.js` virou função,
  usada por vagar, perseguir e fugir (com velocidade por parâmetro). O
  vagar não mudou (os 5 testes antigos passam) e agora ignora quem está
  perseguindo/fugindo.
- Config em `GAME_CONFIG.WILD_BEHAVIOR`; `wild.hostileChance` documentado
  no `_template` de espécie.
- **Debug (F2)** — `tools/debug/WildBehaviorDebugView.jsx`: em cada
  selvagem, etiqueta no chão (embaixo dela, sem brigar com a etiqueta de
  nome) com temperamento e estado (`HOSTIL · perseguindo (provocada)`), e
  um círculo no chão com o limite que vale agora — laranja = raio de
  aggro, vermelho = onde desiste da perseguição, azul = distância segura
  da fuga; pacífica vagando não tem círculo. O limite vem de
  `resolveBehaviorRadius` (`core/battle/wildBehavior.js`), a MESMA regra
  que o `wildBehaviorSystem.js` usa pra decidir — o debug não tem cópia
  própria da conta.

Testes: sorteios (temperamento pela chance da espécie/default, reação);
spawn (toda selvagem nasce vagando, com temperamento); comportamento
(hostil fora do raio vaga, dentro persegue correndo e fica com olho
bravo, folga na borda, vaga dali ao desistir, para e encara perto,
provocada tem limite maior, sem ninguém no controle desiste; pacífica
não persegue, foge pra longe, volta a vagar na distância segura);
reação (hostil persegue provocada, pacífica revida ou foge — nunca
continua vagando, já fugindo continua, miss não reage, evento de passo
anterior não é relido); fila (eventos por passo); vagar não mexe em quem
persegue/foge.

## Selvagens atacando + corrida gastando stamina

Pedido do usuário: as selvagens executarem os ataques de fato, gastando a
energia delas; e a corrida pelo pathfinding gastar stamina (não gastava —
nem nas selvagens nem nas criaturas do time seguindo o treinador).

**Corrida** — `tentarCorrer` (`core/actions/stamina.js`), regra ÚNICA de
correr pagando fôlego (`runStaminaDrainPerSecond * delta`; sem fôlego,
anda), usada pelo jogador (`movementSystem.js` — antes com a conta
inline, mesmo resultado), pela criatura do time seguindo
(`creatureFollowSystem.js` — antes corria de graça, só pela distância) e
pela selvagem perseguindo/fugindo (`wildBehaviorSystem.js`).

**Ataque das selvagens** — sem sistema de ataque paralelo:
- `creatureAttackSystem.js` virou quatro passadas: (1) cooldowns de
  TODO atacante; (2) disparo pelo input (como antes); (3) disparo da IA;
  (4) avanço do golpe de TODO atacante (impacto, dano, evento, VFX, som).
  Antes, o avanço e os cooldowns só rodavam pra criatura controlada.
- A selvagem perseguindo chega até `ATTACK_REACH_FRACTION` (80%) do
  alcance do próprio ataque básico (`range + radius + raio do corpo do
  alvo`, a mesma conta da detecção de acerto), para virada pro alvo e,
  com o alvo ao alcance, pede golpe (`WantsToAttack`, pulso de um tick)
  a cada `ATTACK_INTERVAL` (1.2s, `WildBehavior.attackTimer`). Com golpe
  em andamento, fica parada. Sem ataque básico na espécie, para por
  `CHASE_STOP_GAP` como antes.
- A passada (3) consome o pedido e lança pelo MESMO `tryStartAttack` do
  jogador (stamina, cooldown, modo combate), com a direção pronta até o
  alvo em vez da câmera. Sem stamina/ocupada/cooldown, o pedido é
  descartado.
- `resolveAttackTarget` ganhou `targetSide`: golpe de criatura do time →
  `'wild'` (selvagens); golpe de selvagem → `'player'` (criaturas do time
  e o treinador, quem tem `Party`). Nunca o próprio lado. A espécie do
  alvo sai da criatura ou, no treinador, de `getPlayerSpecies()`.
- Selvagens nascem com `AttackCooldowns` (`wildCreatureSpawnSystem.js`).
- Número de dano e brilho no alvo já funcionam pro golpe da selvagem (o
  evento é o mesmo). Sem desmaio ainda: HP só trava em 0 (desmaio veio
  na rodada seguinte, abaixo).

Testes: `tentarCorrer`; follow gasta stamina correndo e anda sem ela;
selvagem pede golpe ao alcance respeitando o intervalo, não pede fora do
alcance, fica parada no golpe, persegue/foge gastando stamina e anda sem
ela; o pedido lança o ataque básico mirando no alvo (stamina, modo
combate), acerta a criatura do jogador com evento, é descartado sem
stamina; cooldown corre pra selvagem; alvo do lado do jogador (criatura
do time e treinador, nunca outra selvagem); spawn com `AttackCooldowns`;
e um de ponta a ponta — selvagem hostil perto do treinador no controle
tira vida dele com os dois systems rodando juntos.

## Desmaio

Pedido do usuário: selvagem que desmaia fica intangível por X minutos
(configurável), com a animação preparada pra ser criada depois, e acorda
com 10% da vida voltando ao comportamento normal (e a regenerar). A do
time faz o mesmo, mas pouco depois é recolhida pelo treinador, conta o
mesmo tempo pra reanimar e não pode ser invocada enquanto isso.

Config `GAME_CONFIG.FAINT`: `DURATION_MINUTES` (2), `REVIVE_HP_FRACTION`
(0.1), `PARTY_RECALL_DELAY` (2s no chão antes de ser recolhida).

**Estado** — trait `Fainted { timeLeft, elapsed }` (presença =
desmaiada). `faintSystem.js` (simulation, logo depois do
`creatureAttackSystem`): quem tem `WildCreature` ou `SummonedCreature` e
chegou a 0 de HP desmaia no mesmo tick do golpe; a contagem corre e quem
zera acorda. O treinador não desmaia (fora do escopo desta rodada).

**Actions** (`core/actions/faint.js`):
- `desmaiar(world, entity)` — começa a contagem, cancela o golpe em
  andamento (`ActionState`), a mira (`AttackAim`), o pedido de golpe
  (`WantsToAttack`) e o modo combate; zera a velocidade; olho em
  `'faint'` (`eyeStates.faint` da espécie — ver abaixo); desliga o
  collider (intangível). Se era quem estava no
  controle, o controle volta pro treinador.
- `acordar(entity)` — HP = `resolveReviveHp(maxHp)` (10%, arredondado pra
  cima, nunca 0), sem o atraso de regeneração do último golpe (já acorda
  regenerando), olho `'awake'`, collider de volta; a selvagem volta a
  vagar a partir de onde caiu (`voltarAVagar`) — daí, comportamento
  normal (hostil volta a perseguir quem chegar perto).

**Olho** — `Mood` `'faint'`, lido do `eyeStates.faint` que o usuário
declarou em bulbasaur/charmander/squirtle. Espécie sem `faint` usa o olho
de `sleeping` e, sem ele, o primeiro estado declarado. Essa regra virou
uma função só (`resolveEyeState`, `view/shared/eyeState.js`), usada no
olho inicial ao carregar o modelo (`useAnimatedModel.js`) e no piscar
(`eyeBlinkSystem.js`) — antes eram duas cópias mantidas em sincronia na
mão.

Desmaiada não pisca nem vocaliza (relatado jogando: o bulbasaur
desmaiado continuava piscando e falando — os dois rodam na view, com
timer próprio por entidade, sem olhar o estado): `eyeBlinkSystem` deixa
o olho parado no "aberto" do humor (`'faint'`) e para o relógio do
piscar; `voiceAudioSystem` corta a vocalização em andamento e para o
timer. Os dois continuam de onde estavam ao acordar. Testes em
`eyeBlinkSystem.test.js` e `voiceAudioSystem.test.js` (novo), com
controle sem `Fainted`.

O fogo da cauda (charmander, `species.vfx.tailFire`) também apaga:
`tailFireSystem` leva a `intensity` da chama a 0 em 0.4s
(`FAINT_FADE_DURATION` — some a opacidade das partículas e a luz), aí
deixa o grupo invisível e para de simular; ao acordar, reacende do mesmo
jeito. O quanto está aceso fica em `fade`, na entrada do
`tailFireRegistry`. Testes em `tailFireSystem.test.js` (novo).

**Intangível** — `setCharacterColliderEnabled` (`core/physics/
colliders.js`, `collider.setEnabled`). Conferido isolado no Rapier: com o
collider desligado, `castRay` não acerta mais a cápsula, outro personagem
atravessa, e o `computeColliderMovement` da própria criatura continua
pisando no chão (por isso o `characterPhysicsSystem` segue rodando pra
ela — cai com gravidade, sem andar).

Relatado jogando depois: correr contra a desmaiada ficava EMPURRANDO o
corpo. O collider desligado tira ela da colisão dos OUTROS, mas o
controlador da própria desmaiada continuava enxergando quem entrava nela
e a tirava "de dentro" — arrastada metros (8,7m no teste, 200 ticks
correndo contra). Correção: o movimento dela usa `terrainOnlyFilterFlags`
(`core/physics/physicsWorld.js`, só a geometria fixa do nível — o mesmo
filtro do raycast de terreno, que passou a usar esta função) em
`characterPhysicsSystem`. Resultado: quem corre passa por cima e ela
não sai do lugar, mas continua caindo e pisando no chão. Decisão: corpo
desmaiado sem colisão com personagens (padrão de action RPG — deitado no
chão, atravessar parece natural), em vez de corpo sólido (parede) ou
empurrável.

Testes em `characterPhysicsSystem.test.js` ("criatura desmaiada no
caminho"): o jogador passa e ela não sai do lugar (tolerância de 5cm —
a cápsula deitada assenta ~1cm sozinha, acordada ou não); ela cai e
pisa no chão. Os dois pedaços conferidos: sem o filtro ela é arrastada;
sem desligar o collider o jogador é barrado. Achado no caminho: um
personagem criado com corpo na mão ANTES do 1º tick ganha um segundo
corpo do `physicsBootstrapSystem` (o primeiro fica órfão, uma parede) —
os testes novos montam o nível antes.

Na sequência (pedido do usuário, "pode fazer as correções"):
- **Criatura viva parada também não é mais empurrada** — mesmo
  mecanismo: o controlador de quem estava parado o tirava "de dentro" de
  quem encostasse. Agora, parado no chão (deslocamento horizontal pedido
  abaixo de `STILL_REQUEST_EPSILON`), o movimento do personagem só
  enxerga o terreno; quem ANDA contra ele continua barrado — a colisão
  fica do lado de quem se move, ninguém atravessa ninguém.
- **Teste antigo "personagens colidem entre si" corrigido** — criava a
  criatura antes do 1º tick (dois corpos: o órfão barrava o jogador, o de
  verdade era empurrado ~6cm). Com o nível montado antes e a regra acima,
  passa; sem a regra, o jogador vai até x≈6 empurrando a criatura. Saiu
  da lista de falhas pré-existentes (agora 19 em 4 arquivos).

**Quem ignora a desmaiada** — `vitalsRegenSystem` (não regenera HP nem
stamina), `wildBehaviorSystem` (as duas passadas), `wildWanderSystem`,
`wildReactionSystem` (o golpe que derrubou não provoca reação),
`creatureFollowSystem` (não segue, e sai da evasão dos outros — é
intangível), `controlSwitchSystem` (não dá pra pilotar) e
`resolveAttackTarget` (não é alvo).

**Animação** — estado `'faint'` em `core/data/animationStates.js`, o
primeiro da tabela (nada mais decide a animação enquanto dura), via
`fainted` no contexto (`animationStateSystem`). Nenhuma espécie tem
`clips.faint` ainda: cai no fallback de clipe ausente (pose de descanso)
até o clipe existir em `core/data/species/<id>/clips/faint.json`. É
cíclico (sem `oneShot`): fica deitada por tempo variável, sem duração de
ação por trás; a entrada é suavizada pelo crossfade.

**Time** — a criatura recolhida deixa de existir como entidade, então a
contagem continua no treinador, por slot: trait `PartyFaint { slot1,
slot2, slot3 }` (mesmo formato de `PartyIndividualValues`) — `null`
não desmaiada, `{ timeLeft }` desmaiada. (Na primeira versão havia um
terceiro estado, `{ timeLeft: 0 }` = reanimada esperando sair; saiu com
a vida guardada na bola, seção seguinte.)
- `partySummonSystem`: o recolhimento automático (que já existia pra slot
  esvaziado) também recolhe a desmaiada há `PARTY_RECALL_DELAY`
  (`needsAutoRecall`), com o treinador livre. Apertar a tecla do slot com
  ela desmaiada no chão recolhe na hora. `applyRecall` copia o que falta
  (`Fainted.timeLeft`) pra `PartyFaint[slot]`.
- `faintSystem` desconta `PartyFaint` a cada tick; ao zerar, reanima na
  bola: o slot volta a `null` e a vida guardada (`PartyVitals`) vira o HP
  de quem acorda, sem atraso de regeneração.
- Invocar é bloqueado enquanto `PartyFaint[slot].timeLeft > 0`
  (`isPartySlotFainted`).
- Reanimada sai da bola com a vida guardada (o HP de quem acorda, mais o
  que regenerou lá dentro) — ver seção seguinte.
- `equiparCriatura` limpa o slot — criatura nova no slot não herda o
  desmaio (mesma regra que já sorteia IV novo a cada troca).
- Se a contagem acabar com ela ainda em campo (treinador ocupado o tempo
  todo), ela acorda ali mesmo, pelo mesmo `acordar`.

**HUD** — `PartyHud`: card do slot mostra `desmaiada · m:ss` (da
criatura em campo ou do slot no treinador), tecla de invocar apagada
enquanto conta, troca de controle apagada; fora de campo a vida aparece
a vida guardada na bola (ver seção seguinte).
Debug F2 (`WildBehaviorDebugView`): selvagem desmaiada mostra
`desmaiada (Ns)` e fica sem círculo.

Testes (`faintSystem.test.js`): desmaia com 0 de HP largando golpe/mira/
pedido/combate e parando; não desmaia com HP; não regenera; acorda no
tempo com 10% e vagando de onde caiu, e regenera depois; HP de acordar
nunca 0; treinador não desmaia; desmaiada no meio da perseguição não
pede golpe nem anda (e acordada volta a perseguir); o golpe que derrubou
não provoca reação; animação `'faint'` acima de qualquer ação; raycast
ignora a desmaiada e volta a acertar ao acordar (Rapier real); controle
volta pro treinador e não dá pra pilotá-la; recolhida sozinha depois do
atraso e contagem no treinador; invocação bloqueada, reanima na bola com
10% e sai assim; saudável sai cheia; tecla recolhe na hora; desmaiada
não segue o treinador. Cada regra conferida desligando-a e vendo o teste
correspondente falhar.

## Vida e energia guardadas na bola

Relatado pelo usuário: recolher a criatura resetava a vida e a energia
dela — "tem que funcionar da mesma forma como se ele estivesse fora".
Não era regressão desta feature: desde a esfera de invocar (024), toda
invocação montava o `Vitals` do zero (`vitalsFromSpecies`, cheio), e
nada guardava o `Vitals` da criatura ao ser destruída no recolhimento.

- Trait `PartyVitals { slot1, slot2, slot3 }` no treinador (mesmo
  formato de `PartyIndividualValues`): `null` = cheia (nunca saiu, ou
  criatura nova no slot); senão, cópia do `Vitals` de quando foi
  recolhida.
- `applyRecall` (`partySummonSystem.js`) guarda o `Vitals` antes de
  destruir a entidade.
- Na bola continua regenerando pela MESMA regra de fora: a conta de
  `vitalsRegenSystem.js` virou a função `regenerateVitals` (HP e stamina,
  cada um depois do próprio delay), usada nas criaturas em campo e em
  cada slot de `PartyVitals`. Desmaiada não regenera, nem em campo nem na
  bola (`PartyFaint`).
- `summonBallSystem.js` devolve a vida, a energia e os delays guardados
  (limitados ao máximo recalculado agora — mesma espécie/IV, mesmo
  valor) e limpa o slot: em campo vale o `Vitals` da criatura.
- `equiparCriatura` limpa o slot (criatura nova sai cheia).
- `PartyHud`: fora de campo, o card mostra a vida/energia guardadas
  (subindo enquanto regenera), não mais o máximo fixo.

Testes (`partyVitals.test.js`): recolher e invocar de novo mantém vida,
energia e delays e limpa o slot; nunca invocada sai cheia; na bola
regenera igual à regra de fora (mesma conta, delays inclusive);
desmaiada na bola não regenera; trocar a criatura do slot limpa. Cada
regra conferida desligando-a e vendo o teste falhar.

## Debug de pathfinding apontando pro jogador

Relatado pelo usuário (segunda vez): no debug, a linha do caminho de uma
selvagem vagando apontava pra quem está no controle entre um recálculo
de caminho e outro. Causa: `PathfindingDebugView.jsx`, sem waypoint
sobrando (caminho reto, ou já passou do último), desenhava até quem está
no controle — certo só pra criatura do time seguindo; a selvagem (vagar/
perseguir/fugir via `steerTowards`, que passou a usar o mesmo `PathState`
nesta feature) vai pra outro lugar.

Correção: o destino deixa de ser adivinhado no debug. `PathState.target`
(`{x, z}` ou `null`) é gravado por quem navega — `steerTowards` (o
destino pedido: ponto de vagar, alvo da perseguição, ponto de fuga) e
`creatureFollowSystem` (quem está no controle; `null` quando só desvia
de alguém) — e zerado pelas actions de troca de estado da selvagem. O
debug desenha só isso (`resolvePathDebugPoints`, `tools/debug/
pathDebugPoints.js`): posição → waypoints restantes, ou → destino; parado
ou sem destino, nada (antes ficava um caminho velho congelado).

Testes (`tools/debug/pathDebugPoints.test.js`): a regra do desenho
(waypoints, reto até o destino gravado, nada parado/sem destino) e a
gravação por quem navega (`steerTowards`, reset ao trocar de estado,
follow grava quem está no controle), cada gravação conferida
desligando-a.

## IA do time (sempre defensiva) e ameaça das selvagens

Pedido do usuário: pensar a IA das criaturas do time quando ele não
controla — "3 contra 1 fica injusto, mas é estranho os outros não fazerem
nada enquanto eu luto". Proposta aceita com três decisões: postura
**sempre defensiva** (nunca outra — sem parâmetro de postura), **ameaça**
nas selvagens ("mira quem mais causou dano nela ou quem está mais
perto"), e **só o ataque básico** na IA por enquanto.

**Ameaça (selvagens)** — antes a selvagem só mirava quem está no
controle. Agora:
- `Threat { entries: [{ entity, amount }] }` na selvagem: todo golpe que
  ela leva soma o dano de quem bateu (`registrarAmeaca`, pelo
  `wildReactionSystem`); zerada quando ela volta a vagar
  (`voltarAVagar` — a luta acabou).
- Candidatos: TODO o lado do jogador ativo — treinador e criaturas do
  time, controladas ou não (`listPlayerSide`, `core/battle/
  combatTargets.js`); fora quem desmaiou ou está a 0 de HP.
- Vagando (hostil): aggro pelo MAIS PERTO. Perseguindo: o topo da ameaça
  ainda na luta ou, sem ameaça, o mais perto (`resolveWildTarget`).
  Fugindo: foge do mais perto. O alvo do tick fica em
  `WildBehavior.target`; limites (aggro/leash/fuga) medidos até ele.
- Efeito no equilíbrio: lutar em grupo custa — as criaturas do time
  também apanham (e podem desmaiar).

**IA do time** — `PartyBehavior { state: 'follow' | 'fight', target,
attackTimer }`, posto em toda criatura invocada (`summonBallSystem`):
- **Entra na luta** (`partyReactionSystem`, fase events): quando uma
  SELVAGEM acerta alguém do grupo (treinador ou criatura do time), toda
  criatura do time que está só seguindo passa a lutar contra ela
  (`defenderGrupo`). A controlada e a desmaiada não entram; quem já
  luta mantém o alvo. Golpe do lado do jogador numa selvagem não põe
  ninguém na luta (é defensiva).
- **Luta** (`partyBehaviorSystem`, antes do `creatureFollowSystem`, que
  pula quem está lutando): corre até `ATTACK_REACH_FRACTION` do alcance
  do próprio ataque básico, para virada pro alvo e pede golpe a cada
  `PARTY_BEHAVIOR.ATTACK_INTERVAL` (1.5s — mais lento que o jogador de
  propósito). Correr gasta stamina; lutando fica em modo combate.
- **Sai da luta** (`voltarASeguir`): alvo saiu da luta → troca pra
  selvagem mais perto que ainda está lutando com o grupo
  (`listWildsFightingParty`); nenhuma → volta a seguir. Também volta a
  seguir se passar de `LEASH_RADIUS` (15m) de quem segue, se virar a
  controlada, ou ao desmaiar.

**Disparo** — um caminho só pros dois lados: `WantsToAttack` virou
trait com `target` (o pedido leva o alvo). A passada 3 do
`creatureAttackSystem` atende qualquer criatura com o pedido (selvagem
ou do time), mirando no alvo; alvo fora da luta → pedido descartado.
`resolveAttackReach` saiu do `wildBehaviorSystem` pra
`combatTargets.js` (usado pelos dois comportamentos).

**Debug F2** — a etiqueta da selvagem mostra o alvo (`→ treinador`,
`→ Bulbasaur`); a criatura do time ganhou etiqueta própria
(`PartyBehaviorDebugView.jsx`: "DEFENSIVA · seguindo / lutando →
alvo").

Config: `GAME_CONFIG.PARTY_BEHAVIOR { ATTACK_INTERVAL, ATTACK_REACH_FRACTION,
LEASH_RADIUS }`.

Testes: `partyBehaviorSystem.test.js` (novo — entra na luta quando o
treinador ou outra criatura do time apanha, não entra por golpe do lado
do jogador nem por agressor que não é selvagem, controlada/desmaiada não
entram, mantém alvo; corre até o alvo sem o follow puxar de volta, pede
golpe no intervalo, troca de alvo, volta a seguir sem ninguém lutando,
pela coleira, ao virar controlada, ao desmaiar; e um de ponta a ponta —
selvagem bate no treinador, a do time entra e tira vida dela);
`wildBehaviorSystem.test.js` (alvo mais perto entre todo o lado do
jogador, topo da ameaça mesmo mais longe e troca quando outro passa,
desmaiado não é alvo, voltar a vagar zera a ameaça, pedido leva o alvo,
treinador a 0 de HP deixa de ser alvo); `wildReactionSystem.test.js`
(ameaça somada por atacante); `creatureAttackSystem.test.js` (lança no
alvo do pedido, descarta alvo desmaiado, criatura do time pela IA).
Cada regra conferida desligando-a e vendo o teste correspondente falhar.

## Piscar do treinador (um olho só, textura sumindo)

Relatado pelo usuário: o treinador piscava só com um olho e às vezes a
textura do olho sumia. Investigado pelo `.glb` (malhas, materiais e UVs
de cada primitiva) e pelo atlas `tr0001_00_eye_col_99.png` (o rosto
inteiro numa célula de 1/2 x 1/4, variações bravo/aberto/fechado nas
linhas da metade esquerda; o resto é pele).

Na config (`core/data/species/boy/index.js`):
- Material 1 é o olho ESQUERDO (`Leye`) e o 2 o DIREITO (`Reye`) — só o
  1 tinha `eyeStates`; o 2 ficava parado. Pelos UVs, a mesma config serve
  pros dois (o recorte cai no olho certo de cada lado): agora os dois usam
  `EYE_TEXTURE`.
- `blink` estava DENTRO de `eyeStates` (virava um "humor" e o intervalo
  configurado era ignorado) — virou irmão de `eyeStates`.
- `sleep` → `sleeping` (o nome do humor em `Mood`).

No código (`view/systems/eyeBlinkSystem.js`):
- Um relógio de piscar por ENTIDADE (o da 1ª unidade), aplicado em todas
  as unidades — cada textura de olho tinha o próprio relógio sorteado, e
  os dois olhos piscariam em momentos diferentes.
- `applyPan` não marca mais `needsUpdate`: o `offset` chega no shader
  pela matriz de UV, e `needsUpdate` reenviava a imagem inteira do atlas
  pra GPU a cada piscada (compartilhada entre as cópias — a de todo mundo
  que usa o arquivo). Suspeito mais provável do sumiço; não reproduzível
  sem navegador.

Testes (`eyeBlinkSystem.test.js`): dois olhos da mesma entidade piscam
juntos mesmo com relógios iniciais diferentes; piscar não muda a
`version` da textura (não reenvia). Os dois falham com o
`eyeBlinkSystem` anterior.

## Indicador de alcance por cima da criatura (teste)

Pedido do usuário, pra testar: o leque de alcance do ataque
(`AttackIndicatorView.jsx`) aparecer mesmo com a criatura na frente.
`GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR.ALWAYS_ON_TOP` (ligado) desliga o
teste de profundidade dos dois materiais do leque — desenhado por cima de
tudo, inclusive através de parede/obstáculo. `false` volta ao
comportamento anterior.

## Testes

Arquivos novos: `faintSystem.test.js`, `partyVitals.test.js`,
`partyBehaviorSystem.test.js`, `wildBehaviorSystem.test.js`,
`wildReactionSystem.test.js`, `core/battle/wildBehavior.test.js`,
`core/actions/stamina.test.js`, `view/shared/eyeState.test.js`,
`view/systems/tailFireSystem.test.js`,
`view/systems/voiceAudioSystem.test.js`,
`tools/debug/pathDebugPoints.test.js`. Ampliados:
`creatureAttackSystem`, `creatureFollowSystem`, `characterPhysicsSystem`
(inclusive o teste antigo "personagens colidem entre si", corrigido),
`wildCreatureSpawnSystem`, `wildWanderSystem`, `eventQueue`,
`eyeBlinkSystem`, `tailFireRegistry`. O detalhe de cada rodada está na
seção dela.

## Fora de escopo (consciente)

- Desmaio do TREINADOR — só criaturas desmaiam; o treinador a 0 de HP só
  deixa de ser alvo (as selvagens desistem dele).
- Posturas da IA do time — descartadas pelo usuário: sempre defensiva.
- Skills na IA (time e selvagens) — só o ataque básico por enquanto.
- Decaimento da ameaça com o tempo — só zera quando a selvagem volta a
  vagar.
- Critério de verdade pra pacífica revidar ou fugir — ainda sorteio
  (`RETALIATE_CHANCE`).

## Gates

- `npm test` — 671 passam, 20 falham, todos em arquivos não tocados por
  esta feature ou por mudança do usuário: `world.test.js` (3),
  `data/items/index.test.js` (1), `applyAnimationClip.test.js` (5)
  — pré-existentes; `orbitCamera.test.js` (10) — `CAMERA.TARGET_HEIGHT`/
  `SHOULDER_OFFSET` comentados pelo usuário; `stats.test.js` (1) —
  espera a fórmula de energia antiga, antes do balanceamento do usuário
  em `stats.js`. `characterPhysicsSystem.test.js` saiu da lista
  (corrigido nesta feature).
- Lint — limpo em todos os arquivos desta feature.
- `npm run build` — a compilação passa (`✓ Compiled successfully`); o
  comando falha só no lint, em arquivos não tocados por esta feature
  (`core/data/species/001-bulbasaur`, `004-charmander`, `007-squirtle`,
  `bot`, `boy`, `core/data/species/stats.js`, `testLevel.js`,
  `ActionSlotHud.jsx`, `StatusHud.jsx`, `PokemonsTab.jsx`,
  `roster.js`, `StatsScreen.jsx`, `CreatureView.jsx`,
  `PunchAttackEffect.jsx`, `VineWhipAttackEffect.jsx`,
  `statusDisplay.jsx`).
