# 🚀 Versão 0.0.60 — Ajustes por espécie

## Resumo

A 059 fechou as 10 espécies contra uma checklist comum. O que é de uma
espécie só e ficou faltando no jogo entra aqui, um Pokémon por vez — o
usuário mapeia no jogo e cada item vira uma parte deste doc.

Mapeado até agora:

- **Charmander** — a luz do fogo da cauda.
- **Aves (Pidgey e Spearow)** — o voo livre, começando pelo Spearow.
- **Spearow** — andar e correr no chão, com o voo rasante só no voo livre.
- **Todos** — o deslize ao andar em encosta (física do controller).

Fora daqui: as skills (VFX, som, forma, efeitos) são da 061, logo depois
desta; o spawn é da 062.

Versão: `0.0.60` (`package.json`). Branch: `feature/060-ajustes-por-especie`.

> **Renumeração do roadmap:** a 060 (ajustes por espécie) e a 061 (revisão
> das skills) entraram no Marco 2, antes do spawn, que virou a 062. A HUD
> (era a 061) foi para o Marco 3 como 068, antes do tutorial (069). Do
> Marco 3 em diante tudo andou: as antigas 062–066 viraram 063–067, e da
> 068 em diante, +2 (o refino dos golpes, era 088, agora é 090). Os docs das
> features antigas ficam com os números da época; os comentários do código
> que apontavam pro roadmap foram atualizados.

---

## Como está hoje

- **Fogo da cauda** (022): partículas e luz presas no osso da cauda pelo
  `view/systems/tailFireSystem.js`, configuradas em `vfx.tailFire` da
  espécie. Já estava desligado (o osso do Charmander comentado e as
  texturas da chama de partícula fora de `public/`); a chama que aparece é
  a malha do próprio modelo.
- **Voo**: só o Spearow tem — voo rasante, o modelo sobe até
  `body.flightHeight` andando ou correndo e volta ao chão nos outros
  estados (`view/systems/flightLiftSystem.js`, 059 Parte 16). A cápsula, a
  colisão e os golpes não sobem. O Pidgey anda no chão; as animações de voo
  do dump do Z-A (`2xxxx`) ficaram de fora do `.glb`.

---

## Parte 1 — Luz do fogo da cauda do Charmander

Decisão do usuário: a chama do modelo já atende — o fogo de partícula da
022 sai de vez, junto do laboratório da fogueira. A única coisa que entra
é a **luz** do fogo.

- **Saiu**: o laboratório da fogueira (`/tools/teste-fogueira`,
  `tools/fireDemo/Campfire.jsx`), o motor de partícula
  (`view/vfx/flameParticles.js`), o `tailFireSystem` e o
  `tailFireRegistry` (com os testes), o `vfx.tailFire` do molde da espécie
  e o `TAIL_BONE_BY_SPECIES` do `useAnimatedModel.js`.
- **Entrou**: `vfx.fireLight` na espécie — uma `THREE.PointLight` presa num
  osso do rig (`bone`; no Charmander, `feeler_01`, a ponta da cauda onde
  fica a malha da chama). Cor, brilho, alcance, queda, deslocamento e
  tremor são da espécie; o que ela não declarar cai em
  `GAME_CONFIG.FIRE_LIGHT`. Ao desmaiar a luz fica fraca, não apaga
  (pedido do usuário): desce suave até `faintedIntensity` (fração do
  brilho) e volta ao acordar (`FAINT_FADE_DURATION`). O nome do osso passou a ser dado da espécie,
  como as mãos do `vfx.eatFood`.
- `view/systems/fireLightSystem.js` (tremor, desmaio, deslocamento em
  metros corrigido pela escala do rig) e `view/registry/
  fireLightRegistry.js`, com teste das funções puras.
- Sem sombra (a de luz pontual custa 6 passes por luz). Cada Charmander na
  tela soma uma luz pontual a todos os materiais iluminados — hoje só o do
  time e os do nível de teste (os iniciais não nascem no mundo).

- **Laboratório de luz** (`/tools/lab-luz`, `tools/fireLightLab/`), pedido
  do usuário pra não ter que recarregar o jogo a cada ajuste: o modelo em pé
  num chão iluminado, com a luz do dia da hora escolhida (`lightingAt`, a
  do jogo, sem clima), animação e giro como no laboratório de corpo, e
  todos os campos do `fireLight` ao vivo — osso (lista do rig), cor,
  brilho, alcance, queda, brilho desmaiado, deslocamento e tremor —, mais
  "desmaiado" e um
  ponto marcando onde a luz está. A luz anda pela mesma conta do jogo
  (`applyFireLight`, separada do `fireLightSystem`). "Copiar fireLight"
  leva o bloco pro `index.js` (`formatFireLightSnippet`, com teste de ida
  e volta). O controle deslizante dos laboratórios foi para
  `tools/shared/Slider.jsx`.
- A luz nunca fica invisível (nem com `faintedIntensity` zero): tirar a
  luz da cena muda a contagem de luzes e o Three recompila os materiais
  (engasgo).
- Valores do Charmander ajustados pelo usuário no laboratório.

- [x] Remover o fogo de partícula e o laboratório da fogueira
- [x] Laboratório de luz
- [x] Desmaiado: luz fraca (`faintedIntensity`), não apagada
- [x] `vfx.fireLight` no Charmander, com padrões no `GAME_CONFIG`
- [x] Teste do `fireLightSystem`
- [x] Conferido pelo usuário no jogo (cor, brilho, alcance, tremor, de dia
      e de noite)

## Parte 2 — Voo livre (começando pelo Spearow)

Além do voo rasante do andar e do correr, um voo de verdade, sem limite
fixo de altura. Começa pelo Spearow, que já tem as animações de voo; o
Pidgey vem depois (as de voo dele, do Z-A, ainda não estão no `.glb`).

Decisões do usuário (com as ressalvas discutidas):

- **Controle pela câmera**: `V` decola (no chão; o Espaço continua sendo o
  pulo) e, no ar, pousa. W voa pra onde a câmera olha, inclusive pra cima
  e pra baixo; S volta; A/D vão de lado; Shift é o voo rápido. Sem tecla
  nenhuma, paira. O ângulo normal da câmera (que já olha um pouco pra
  baixo) conta como voo reto — `FLIGHT.NEUTRAL_PITCH`. Encostar no chão
  descendo pousa.
- **Stamina**: voar gasta como andar e correr — pelo nível, na mesma conta
  da corrida (`ACTION_COST.FLY_WEIGHT_PER_SECOND` pairando ou devagar,
  `FLY_FAST_WEIGHT_PER_SECOND` rápido), com o custo extra da vida baixa. A
  espécie só define as velocidades (`flight.speed`, `flight.fastSpeed`). No
  ar a stamina não regenera.
- **Teto pela stamina**: a altura máxima acima do chão logo abaixo é a
  fração de stamina × `FLIGHT.MAX_HEIGHT`. A stamina caindo baixa o teto e
  empurra o pássaro pra baixo devagar; zerada, ele pousa. Pra decolar de
  novo precisa de `FLIGHT.MIN_TAKEOFF_STAMINA` (fração). O teto é um
  parâmetro grande, não infinito: os chunks, a vegetação e a névoa são
  feitos pra quem está no chão.
- **Água funda**: no ar ele passa por cima; descendo, não afunda abaixo da
  superfície e não pousa — fica rente à água até a margem, e lá pousa.
- **Combate**: no ar não ataca nem dá dash (pra lutar, pousa). Pode
  apanhar: contra quem voa vale a distância de verdade em 3D — o golpe
  acerta se a trajetória passa na altura do corpo dele. A IA dos selvagens
  ignora quem voa alto demais pra alcançar e volta quando ele desce.
- **Quem voa**: só a criatura que o jogador controla. Devolvendo o
  controle pro treinador com ela no ar, ela desce sozinha e volta a seguir.
- **Animações**: pairar é o `fi01_wait01` do dump (entra no `.glb`), voar
  devagar e rápido reaproveitam o walk e o run. Sem decolagem e pouso
  próprios. No chão, o andar segue sendo o voo rasante.

Como ficou:

- `core/actions/flight.js` — as regras puras: direção pela câmera
  (`resolveFlightDirection`), teto (`resolveFlightCeiling`), decolagem
  (`canTakeOff`), limites da velocidade vertical (`limitFlightVerticalSpeed`:
  teto e superfície da água) e o gasto (`gastarStaminaDeVoo`). O chão do
  voo é o relevo do nível (`flightGroundY`), sem raio — o raio do combate só
  alcança alguns metros.
- `core/systems/flightSystem.js` — decolar (`V`), voar, pousar, controle
  devolvido e desmaio; registrado logo antes do `characterPhysicsSystem`.
  Traits `FlightStats` (da espécie, posto no spawn da criatura invocada) e
  `Flying` (`takeoff`, `landing`).
- `characterPhysicsSystem`: quem voa não tem gravidade, não pula e a água
  não barra nem freia. `movementSystem` deixa quem voa pro `flightSystem`;
  dash (`playerActionSystem`) e golpes (`creatureAttackSystem`, do jogador
  e da IA) não saem no ar.
- Combate: `isWithinFlyingTargetHeight` no acerto (golpe e cone) contra
  quem voa; `listPlayerSide` tira da IA quem voa acima de
  `MAX_COMBAT_HEIGHT_DIFF`.
- Animação: estados `flyIdle`, `fly` e `flyFast` (sem animação própria, a
  de andar/correr); som de asa nesses estados, sem água nos pés. O
  conversor do LGPE (`convert-pokemon-lgpe.py`) ganhou o `flyIdle` do
  Spearow (`fi01_wait01`), descido até o chão como o walk e o run; o
  `.glb` foi reconvertido (texturas iguais às de antes).
- Tecla `V` (`fly`) no teclado, bloqueada no modo Scan.

- [x] Movimento, decolar/pousar, stamina e teto (`flightSystem`)
- [x] Física no ar (sem gravidade, sobre a água funda)
- [x] Sem ataque e sem dash no ar
- [x] Acerto em 3D contra quem voa; IA ignora quem está alto demais
- [x] Estados de animação de voo e som de asa
- [x] `flyIdle` (`fi01_wait01`) no `.glb` do Spearow
- [x] Testes: regras puras, o system com a física de verdade, estados de
      animação, acerto e alvo da IA

Ajustes depois do primeiro teste do usuário:

- **Espaço sobe e C desce**, somando por cima da câmera (W com Espaço vai
  pra frente subindo; Espaço sozinho sobe reto), sempre na velocidade do
  voo. O Espaço continua sendo o pulo no chão. Descer não ficou no Ctrl
  (pedido inicial): Ctrl+W fecha a aba e a página não consegue impedir —
  decisão do usuário pelo C.
- **Dash no ar** (pra testar): mesmo custo e recarga do chão, na direção do
  voo (câmera + Espaço/C) ou, sem intenção, pra frente do corpo
  (`resolveFlightDashDirection`; o `avancarDash` leva o `dirY` no ar). No
  Spearow toca o `jumpLoop`, como o dash do chão.
- **Animação tremendo na descida pela stamina**: o teto que caía fazia o
  pássaro passar dele num tick e voltar no outro, e a velocidade vertical
  oscilava entre pairar e voar. Agora a descida para em cima do teto, sem
  passar, e a animação escolhe pela velocidade que o jogador pediu
  (`Flying.intentSpeed`), não pela que o teto força — descendo sem tecla,
  continua pairando.

- [x] Espaço/C no voo, dash no ar, descida sem tremer (com testes)

Segunda rodada de ajustes:

- **Animação própria do dash no ar**: estado `flyDash` (antes do `dash`;
  sem animação, cai na do `dash`). No Spearow o usuário mapeou o `run`.
- **Efeito do dash no ar**: sem poeira nem respingo — só as linhas de
  velocidade, agora inclinadas na direção do dash (o quadro das partículas
  ganhou `pitch`, `rotatePitch` em `particleSimulation.js`), mais ondas de
  ar que estouram pra trás na arrancada (o arco do Growl, em tom claro;
  `DASH_EFFECT.AIR_WAVES`, 0 desliga).
- ~~Giro no ar próprio (`flight.turnSpeed`)~~: entrou e saiu — não era o
  que estranhava; o voo volta a usar o `movement.turnSpeed`.

- [x] `flyDash` e efeito do dash no ar (com testes)

Terceira rodada — o movimento livre estranho (não era o giro, nem falta de
clipe de curva: o dump não tem um):

- **Embalo no ar**: a velocidade vai até a pedida aos poucos em vez de
  pular pra ela (`approachFlightVelocity`; `FLIGHT.ACCELERATION` com tecla,
  `FLIGHT.BRAKE` sem) — curva em arco e, soltando, desliza até parar. O
  dash continua seco; ao fim dele, o embalo leva de volta à velocidade do
  voo.
- **Inclinação do corpo**, só no modelo (`view/systems/flightTiltSystem.js`,
  `FLIGHT.TILT`): deita pro lado da curva pela rapidez do giro (a asa de
  dentro desce) e levanta/abaixa o bico na subida/descida, pesado pela
  velocidade no plano (subir reto com o Espaço ou descer pairado pelo teto
  não aponta o bico). Aplicado no grupo da entidade (pivô no centro do
  corpo), na ordem 'YXZ'; fora do voo volta a nivelar, suave.

- [x] Embalo e inclinação no voo (com testes)

- **Queda pela stamina suave**: o teto era um corte seco (passou dele, a
  descida cheia na hora; subindo, parava de uma vez; e um dash, gastando um
  pedaço da stamina, derrubava o teto metros num tick). Agora é macio
  (`resolveCeilingSpeed`): a velocidade vertical máxima é a distância até o
  teto × `FLIGHT.CEILING_RESPONSE` — desce tanto mais rápido quanto mais
  longe (até `CEILING_DESCENT_SPEED`), freia chegando nele e nunca passa;
  subindo, freia perto dele. No voo normal esse limite entra no embalo como
  alvo, então até a queda de uma vez começa aos poucos. Sem stamina, toca o
  chão devagar (`TOUCHDOWN_SPEED`).

- [x] Teto macio na queda pela stamina (com testes)

- **Tremor da câmera na queda pela stamina** (relatado): não reproduzido.
  No jogo (Playwright, Spearow a ~15 m, stamina baixada) a descida e a
  câmera saíram lisas — parado e segurando W, até pousar. Suspeitas pra
  quando voltar: a colisão da câmera com o relevo rente ao chão, ou queda
  de FPS ao descer pra perto da vegetação. Ficou assim por decisão do
  usuário.

### Pidgey

- O dump do Z-A tem o conjunto de voo inteiro (2xxxx). O conversor
  (`convert-pokemon.py`) ganhou os clipes de voo como **opcionais e sem o
  fallback** pro terrestre (espécie sem voo não ganha cópia):
  `flyIdle` (`20000`), `fly` (`20030`), `flyFast` (`20100`) e a arrancada
  `flyDashStart/flyDash/flyDashEnd` (`20140–20142`, a mesma sequência que o
  dash do chão usa). A descida até o chão do idle (`lower_flight_to_ground`,
  como no LGPE) existe, mas no Pidgey não precisou: o voo do Z-A sobe o
  corpo só alguns centímetros. As asas fechadas somem pela visibilidade,
  como nos outros clipes. `.glb` reconvertido (52 → 58 animações); as
  texturas ficaram as de antes (o bake novo variou nos pixels).
- `flight` (`speed`, `fastSpeed`) e `nativeAnimations` de voo no Pidgey;
  o `flyDash` é a arrancada do voo.
- **Som do voo** (`sounds.flightGroup`, `resolveFlightSound`): no chão o
  Pidgey bate a unha (`bird`); no ar, a asa (`wing`). Sem o campo, o voo
  toca o passo normal (o Spearow, que já anda voando).

- **Altura só no Espaço/C** (teste do usuário): chave
  `FLIGHT.CAMERA_PITCH_CONTROL`, desligada agora — a câmera só dá a direção
  no plano e olhar pra cima/baixo não sobe nem desce; ligada, volta o W pra
  onde a câmera olha. O dash no ar segue a mesma regra.

- [x] Pidgey voando (conversor, dados, som do voo; com testes)
- [x] Conferido pelo usuário no jogo (Pidgey)
- [x] Conferido pelo usuário no jogo

## Parte 3 — Spearow andando no chão

Com o voo livre, o voo rasante do andar e do correr ficou repetido: o
usuário quis o Spearow andando a pé no chão, como o Pidgey, e o voo
rasante só no sistema de voo.

O dump do LGPE do Spearow não tem andar no chão (o `fi20_walk01` e o
`fi21_run01` são voo, e o do Pidgey do LGPE também). A referência foi o
andar e o correr do Pidgey do Z-A. Entre refazer no Blender (o conversor
do LGPE passaria a depender do dump do Z-A de outra espécie, e cada ajuste
seria uma reconversão) e a animação procedural, ficou a procedural, no
formato dos clipes do `boy` (`core/animation/curves.js`).

Como foi feito (scripts no scratchpad da sessão, nada no projeto):

- **Redirecionamento**: quadro a quadro, a rotação de cada osso do Pidgey
  no mundo, como diferença a partir do parado dele, aplicada no osso
  equivalente do Spearow a partir do parado deste (os dois em pé com a asa
  fechada). Assim os eixos locais diferentes dos dois esqueletos (Z-A e
  LGPE) não importam. O deslocamento da raiz do Pidgey (`origin`) sai: no
  jogo quem anda é a cápsula. O quadril leva o sobe-e-desce na proporção
  da altura dos dois.
- **Joelho como dobradiça**: o joelho dobra além de 90° no eixo do meio
  da ordem XYZ do motor (`rest · Rx · Ry · Rz`) e travava a decomposição
  (gimbal). Ele fica só com a dobra no eixo dele; o pé, filho, compensa e
  mantém a orientação do Pidgey.
- **Curvas**: cada eixo vira constante + harmônicos (série de Fourier) por
  cima da pose de descanso do `.glb`. Os ossos que o parado tira do
  descanso (asa aberta dobrada, penacho) entram como constante.
- **Preview** (Artifact, fora do projeto) com o Spearow ao lado do Pidgey
  na mesma fase, multiplicadores por parte do corpo, andar de verdade e
  medidas ao vivo (pé mais baixo, altura do passo, passada, velocidade sem
  escorregar, erro do ajuste). O usuário aprovou os valores medidos, sem
  ajuste.

Medido na época (ilustrativo; o que vale é o clipe): correndo, o pé
acompanha a velocidade de corrida da espécie; andando, escorrega como o
andar do Pidgey no jogo (a passada dele é curta pra velocidade de andar).
Dá pra corrigir com o `speed` do clipe ou refazendo com mais passada.

No jogo:

- `clips/walk.json` e `clips/run.json` no Spearow; `walk`/`run` saíram do
  `nativeAnimations` (a embutida tocaria no lugar). `fly`, `flyFast` e
  `flyDash` continuam no `walk`/`run` do `.glb` — o voo rasante.
- É a primeira espécie que mistura animação do `.glb` com clipe
  procedural. A ida pro procedural mistura pela fotografia da pose; a
  volta pro `.glb` usa o `fadeIn` do mixer, que parte da pose em que os
  ossos estão quando a ação liga.
- Saiu o `body.flightHeight` (o modelo não sobe mais andando) e, sem
  espécie que usasse, o voo rasante do modelo inteiro (pedido do
  usuário): `view/systems/flightLiftSystem.js` (com o teste),
  `view/registry/flightLiftRegistry.js`, o efeito no `useAnimatedModel.js`,
  o registro no laço, `ANIMATION.FLIGHT_LIFT_SPEED` e o `flightHeight` do
  laboratório de corpo.
- **Asa aberta aparecendo** (teste do usuário, como a asa fechada no
  Pidgey antes da visibilidade): no parado do `.glb` a asa aberta some por
  escala pequena no `LArm`/`RArm` (os filhos herdam), e o clipe procedural
  volta todo osso ao descanso, escala inclusive. O redirecionamento passou
  a levar a escala do parado do Spearow, e os clipes ganharam `scale`
  constante no `LArm`/`RArm` — só isso mudou nos JSONs; o `speed` ajustado
  pelo usuário ficou.
- Som como o do Pidgey: `footstepGroup: 'bird'` no chão e
  `flightGroup: 'wing'` no voo.
- Teste novo (`core/data/species/speciesAnimations.test.js`), para todas
  as espécies: os ossos dos clipes procedurais existem no rig do `.glb`;
  estado com clipe procedural não tem animação embutida; toda animação
  embutida citada existe no `.glb`; no Spearow o chão é procedural e o voo
  é embutido.

- [x] Andar e correr procedurais do Spearow (clipes, dados, som; com teste)
- [x] Conferido pelo usuário no jogo (andar, correr, troca com o parado e
      com o voo, som do passo)

## Parte 4 — Deslize nas encostas

Relato do usuário: andando em lugar íngreme o movimento parece deslizar,
mais visível quanto menor o Pokémon (Weedle e Caterpie nas bordas da
trilha, as aves na lateral de um morro).

Causa, medida numa simulação com o Rapier do projeto e a mesma
configuração do controller (números da época, ilustrativos):

- No chão, o `characterPhysicsSystem` mantinha a velocidade vertical em
  `GROUNDED_STICK` (negativa) para ajudar o snap. Andando de lado numa
  encosta, o controller do Rapier projeta esse empurrão na rampa: a
  criatura anda e desce de lado ao mesmo tempo (dezenas de cm/s já em
  encosta moderada; parada, não). Acima de `MIN_SLOPE_SLIDE` ela escorrega
  de vez, andando ou parada.
- A deriva é a mesma em m/s para todo tamanho; o que muda é o peso dela
  perto da velocidade de andar — no Caterpie é metade da velocidade, no
  treinador quase não aparece. Nas bordas da trilha a inclinação muda de
  repente e a criatura entra e sai dos dois regimes.
- Sem o empurrão a deriva some, e o snap do controller sozinho mantém a
  criatura no chão descendo morro (inclusive correndo em rampa forte).

Ajuste feito pelo usuário: `GROUNDED_STICK` zerado e `MIN_SLOPE_SLIDE`
igual ao `MAX_SLOPE_CLIMB` (quem sobe a rampa não escorrega nela). Os
comentários do `gameConfig` explicam os dois.

Fica como está (pode voltar depois): o modelo continua reto na encosta (é
a 084, no Marco 5), e o controller é um só pra todos, com o degrau
automático e a cola no chão em metros — maiores que o corpo inteiro das
criaturas pequenas.

- [x] Empurrão no chão e escorregão nas encostas (config, pelo usuário)

## Wiki

Na 0.0.x, no lugar: o voo em "Seu time" (quem voa sai dos dados, energia,
altura pela energia, luta e água funda), a exceção do voo em "Alcance e
área", o voo em "Vida e energia" e, na ficha das criaturas que voam, as
velocidades e o gasto do voo (`resolveSpeciesFlight`, com teste; o
retrato ganhou `flight`). A luz da cauda e o andar do Spearow são só
visuais.

---

## Etapas

- [x] Roadmap: 060 e 061 no Marco 2, HUD para o Marco 3 (068), renumeração
- [x] Bump do `package.json` para `0.0.60`
- [x] Parte 1 — luz do fogo da cauda do Charmander
- [x] Parte 2 — voo livre (Spearow)
- [x] Parte 3 — Spearow andando no chão
- [x] Parte 4 — deslize nas encostas
- [x] Outras espécies, conforme o usuário mapear (o que ficou de fora volta numa feature futura)
- [x] Fechamento: suíte inteira (`npm test`), `npm run lint`,
      `npm run build` (numa cópia, com o `next dev` rodando)
- [x] Wiki (0.0.x, no lugar), se algo mudar para o jogador
- [x] Roadmap: a 060 sai do Marco 2 para "Já feito"

## Critérios de Conclusão

- Cada ajuste mapeado pelo usuário implementado e conferido no jogo.
- `npm run build`, `npm run lint` e `npm test` passando.
