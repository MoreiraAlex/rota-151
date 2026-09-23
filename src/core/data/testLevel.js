/**
 * Nível de teste da física.
 *
 * Fonte única: os colliders (core/physics), a grade de pathfinding
 * (core/pathfinding.js) e os meshes (view/scene/GameScene) são gerados a
 * partir daqui, então o visível bate com o colidível/andável.
 *
 * - size: dimensões completas [largura(x), altura(y), profundidade(z)], em unidades.
 * - rotation (opcional): giro em um eixo — { axis: 'x' | 'y' | 'z', angle } (rad).
 * - ambientSound (opcional): som ambiente ESPORÁDICO do nível — toca uma
 *   variação aleatória de `clips` de vez em quando (intervalo também
 *   aleatório, entre `minInterval`/`maxInterval`), não uma faixa em loop
 *   contínuo (ver `core/data/audio/ambientSound.js`/`view/audio/
 *   AmbientAudio.jsx`/docs/features/019-som-ambiente-e-passos.md pro
 *   porquê). Sem este campo, o jogo fica em silêncio ambiente (mesmo
 *   fallback gracioso de qualquer conteúdo que ainda não existe).
 * - wildCreatures (opcional): criaturas selvagens spawnadas UMA VEZ pelo
 *   `wildCreatureSpawnSystem.js` no início do jogo — `{ id, speciesId,
 *   position: [x,y,z] }`. Vagam sozinhas (`wildWanderSystem.js`), sem
 *   pertencer ao time do treinador. Ver docs/features/020-fox-selvagens-
 *   cena-e-texturas.md.
 */

// const WILD_CREATURE_COUNT = 30
const WILD_CREATURE_COUNT = 0

const WILD_CREATURE_SPECIES = [
  'bulbasaur',
  'charmander',
  'squirtle',
  // 'fox',
  // 'wolf',
]

const generateWildCreatures = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `wild-${index + 1}`,
    speciesId:
      WILD_CREATURE_SPECIES[
        Math.floor(Math.random() * WILD_CREATURE_SPECIES.length)
      ],
    position: [
      Math.random() * 120 - 60,
      1,
      Math.random() * 120 - 60,
    ],
  }))


export const TEST_LEVEL = {
  ambientSound: {
    clips: [
      '/assets/audio/ambient/wind-01.wav',
      '/assets/audio/ambient/wind-02.wav',
    ],
    volume: 0.02,
    minInterval: 2,
    maxInterval: 5,
  },
  // 150 (era 60) — espaço pra fox selvagens vagarem longe de tudo que já
  // existia perto da origem (ver docs/features/020-fox-selvagens-cena-e-
  // texturas.md). A grade de pathfinding cresce em células (60/CELL_SIZE →
  // 150/CELL_SIZE por eixo), mas é lazy/cacheada uma vez só
  // (`core/pathfinding.js`), sem custo por tick.
  ground: { size: 150, thickness: 1 },
  obstacles: [
    // Muro de contorno — sem ele, sair da borda do chão é queda livre pro
    // limbo (nada segura isso hoje, ver characterPhysicsSystem.js). Altura
    // bem acima do pulo máximo de qualquer espécie (~0,9m com
    // movement.jumpSpeed/PHYSICS.GRAVITY atuais), posicionado exatamente na
    // borda de `ground.size` (±75). `type: 'box'` normal — sem mecanismo
    // novo em TestLevelView/colliders.js/pathfinding.js.
    {
      id: 'boundary-north',
      type: 'box',
      position: [0, 2, -75],
      size: [151, 4, 1],
    },
    {
      id: 'boundary-south',
      type: 'box',
      position: [0, 2, 75],
      size: [151, 4, 1],
    },
    {
      id: 'boundary-east',
      type: 'box',
      position: [75, 2, 0],
      size: [1, 4, 151],
    },
    {
      id: 'boundary-west',
      type: 'box',
      position: [-75, 2, 0],
      size: [1, 4, 151],
    },

    // Pedras espalhadas pela área nova (fora do raio de tudo que já existia
    // perto da origem) — o que os fox selvagens (`wildWanderSystem.js`)
    // desviarem ao vagar.
    { id: 'rock-1', type: 'box', position: [30, 0.75, 40], size: [2, 1.5, 2] },
    { id: 'rock-2', type: 'box', position: [45, 1, -20], size: [3, 2, 2.5] },
    {
      id: 'rock-3',
      type: 'box',
      position: [-40, 0.6, -35],
      size: [1.8, 1.2, 1.8],
    },
    {
      id: 'rock-4',
      type: 'box',
      position: [-55, 1.1, 30],
      size: [2.5, 2.2, 2],
    },
    { id: 'rock-5', type: 'box', position: [20, 0.9, -50], size: [2, 1.8, 3] },
    {
      id: 'rock-6',
      type: 'box',
      position: [-25, 0.7, 55],
      size: [2.2, 1.4, 2.2],
    },
    {
      id: 'rock-7',
      type: 'box',
      position: [55, 0.8, 55],
      size: [1.6, 1.6, 1.6],
    },
    {
      id: 'rock-8',
      type: 'box',
      position: [-60, 0.9, -55],
      size: [2.8, 1.8, 2],
    },

    // Parede para esbarrar e deslizar.
    { id: 'wall', type: 'box', position: [0, 1, -7], size: [10, 2, 0.5] },
    // Degrau baixo — transposto sozinho pelo auto-step.
    { id: 'step-low', type: 'box', position: [-6, 0.15, 1], size: [3, 0.3, 3] },
    // Bloco alto — exige pulo.
    {
      id: 'block-high',
      type: 'box',
      position: [-6, 0.75, 5],
      size: [3, 1.5, 3],
    },
    // Toda rampa é uma caixa FINA (0.3 de espessura) tombada — sobra um vão
    // físico em cunha embaixo dela (cresce conforme a rampa sobe, até quase
    // a altura do topo na ponta alta), sem collider nenhum ali. Uma
    // criatura consegue fisicamente entrar nesse vão e ficar presa lá — o
    // pathfinding nem enxerga isso, já que a grade só sabe da elevação NO
    // TOPO da rampa, não do vazio por baixo (bug real, jogando contra a
    // trilha de teste). Cada rampa ganha uma "backing" — cópia mais grossa
    // dela mesma (mesma rotação/posição X,Z), deslocada pra baixo até a
    // própria face de baixo encostar na face de baixo da rampa fina,
    // preenchendo o vão com collider sólido. `type: 'ramp'` (não 'box') de
    // propósito: sempre processada ANTES da rampa fina de verdade no bake
    // de elevação (`core/pathfinding.js`), que sobrescreve com o valor
    // certo — a backing nunca contribui elevação nem bloqueia, é só
    // reforço físico, invisível pro pathfinding.
    // {
    //   id: 'ramp-backing',
    //   type: 'ramp',
    //   position: [6, -0.7789, 0],
    //   size: [5, 2.5, 3],
    //   rotation: { axis: 'z', angle: 0.32 },
    // },
    // Rampa subível (~18°): a extremidade -x encosta no chão, a +x sobe.
    {
      id: 'ramp',
      type: 'ramp',
      position: [6, 0.55, 0],
      size: [5, 0.3, 3],
      rotation: { axis: 'z', angle: 0.32 },
    },
    // Plataforma elevada, alcançável pela rampa. `type: 'floor'` — terreno
    // andável (contribui elevação pro pathfinding, ver core/pathfinding.js),
    // não parede — sem isso a criatura nunca conseguiria subir nela sozinha.
    {
      id: 'platform',
      type: 'floor',
      position: [10.5, 0.9, 0],
      size: [4, 1.8, 3],
    },
    // Pilar isolado perto do spawn — fácil de esbarrar a câmera nele só
    // virando o olhar por perto, pra testar a colisão da órbita
    // (docs/backlog.md → "Câmera orbital com colisão").
    { id: 'pillar', type: 'box', position: [3, 1.5, -1], size: [1, 3, 1] },
    // Corredor estreito (4m de vão) — a distância padrão da câmera não
    // cabe atrás do jogador aqui dentro sem atravessar uma das paredes,
    // então força a colisão da órbita a puxar a distância pra dentro o
    // tempo todo enquanto o jogador atravessa.
    {
      id: 'corridor-wall-left',
      type: 'box',
      position: [-2, 1.25, -14],
      size: [0.5, 2.5, 8],
    },
    {
      id: 'corridor-wall-right',
      type: 'box',
      position: [2, 1.25, -14],
      size: [0.5, 5, 8],
    },

    // Trilha de 4 terraços ("andares") subindo ao longo de +X, longe de
    // tudo acima (que ocupa x∈[-8,12.5], z∈[-14,5]) — testa o pathfinding
    // com elevação de verdade (ver "Elevação (heightmap)" em
    // docs/features/017-locomocao-e-recolhimento-de-criaturas.md). Cada terraço
    // (`type: 'floor'`) sobe 1.8m sobre o anterior; cada transição tem DUAS
    // rampas paralelas (lanes em z:[13,17] e z:[23,27]) — pelo menos 2
    // caminhos pra alcançar cada terraço — separadas por uma "espinha" de
    // rocha sólida (`type: 'box'`) no meio (z:[17,23]): sem ela, o vão
    // entre as duas lanes ficaria sem collider (buraco) e sem elevação
    // definida (cairia pro chão nível 0 por padrão, no meio da subida).
    // Cada rampa também ganha sua própria "backing" (`ramp{n}-{a,b}-
    // backing`) — mesma ideia da rampa original acima, fecha o vão em
    // cunha por baixo.
    //
    // Ângulo de rampa 0.45 rad (~26°, abaixo de MIN_SLOPE_SLIDE — sobe
    // inteiro sem escorregar). Rise 1.8m por terraço → LENGTH =
    // 1.8/sin(0.45) ≈ 4.138 (vai em size[0]); RUN = LENGTH*cos(0.45) ≈
    // 3.726 é só o espaço horizontal consumido, usado pra centralizar cada
    // peça — não é o `size` da caixa.
    // {
    //   id: 'ramp0-a-backing',
    //   type: 'ramp',
    //   position: [-26.137, -0.3606, 15],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp0-a',
      type: 'ramp',
      position: [-26.137, 0.9, 15],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    // {
    //   id: 'ramp0-b-backing',
    //   type: 'ramp',
    //   position: [-26.137, -0.3606, 25],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp0-b',
      type: 'ramp',
      position: [-26.137, 0.9, 25],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    {
      id: 'spine0',
      type: 'box',
      position: [-26.137, 4, 20],
      size: [3.726, 8, 6],
    },
    {
      id: 'tier1',
      type: 'floor',
      position: [-21.774, 0.9, 20],
      size: [5, 1.8, 14],
    },

    // {
    //   id: 'ramp1-a-backing',
    //   type: 'ramp',
    //   position: [-17.411, 1.4394, 15],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp1-a',
      type: 'ramp',
      position: [-17.411, 2.7, 15],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    // {
    //   id: 'ramp1-b-backing',
    //   type: 'ramp',
    //   position: [-17.411, 1.4394, 25],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp1-b',
      type: 'ramp',
      position: [-17.411, 2.7, 25],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    {
      id: 'spine1',
      type: 'box',
      position: [-17.411, 4, 20],
      size: [3.726, 8, 6],
    },
    {
      id: 'tier2',
      type: 'floor',
      position: [-13.047, 1.8, 20],
      size: [5, 3.6, 14],
    },

    // {
    //   id: 'ramp2-a-backing',
    //   type: 'ramp',
    //   position: [-8.684, 3.2394, 15],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp2-a',
      type: 'ramp',
      position: [-8.684, 4.5, 15],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    // {
    //   id: 'ramp2-b-backing',
    //   type: 'ramp',
    //   position: [-8.684, 3.2394, 25],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp2-b',
      type: 'ramp',
      position: [-8.684, 4.5, 25],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    {
      id: 'spine2',
      type: 'box',
      position: [-8.684, 4, 20],
      size: [3.726, 8, 6],
    },
    {
      id: 'tier3',
      type: 'floor',
      position: [-4.321, 2.7, 20],
      size: [5, 5.4, 14],
    },

    // {
    //   id: 'ramp3-a-backing',
    //   type: 'ramp',
    //   position: [0.042, 5.0394, 15],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp3-a',
      type: 'ramp',
      position: [0.042, 6.3, 15],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    // {
    //   id: 'ramp3-b-backing',
    //   type: 'ramp',
    //   position: [0.042, 5.0394, 25],
    //   size: [4.138, 2.5, 4],
    //   rotation: { axis: 'z', angle: 0.45 },
    // },
    {
      id: 'ramp3-b',
      type: 'ramp',
      position: [0.042, 6.3, 25],
      size: [4.138, 0.3, 4],
      rotation: { axis: 'z', angle: 0.45 },
    },
    {
      id: 'spine3',
      type: 'box',
      position: [0.042, 4, 20],
      size: [3.726, 8, 6],
    },
    // Topo da trilha (4º terraço).
    {
      id: 'tier4',
      type: 'floor',
      position: [4.405, 3.6, 20],
      size: [5, 7.2, 14],
    },
  ],
  // Espalhadas pela área nova, longe do spawn do jogador (perto da origem)
  // e da trilha de teste — ver docstring do campo lá em cima.
  // wildCreatures: [
  //   // { id: 'wolf-1', speciesId: 'wolf', position: [35, 1, 35] },
  //   // { id: 'wild-fox-2', speciesId: 'fox-red', position: [-35, 1, -30] },
  //   // { id: 'wild-fox-3', speciesId: 'fox-green', position: [40, 1, -45] },
  //   // { id: 'wild-fox-4', speciesId: 'fox-blue', position: [-50, 1, 40] },
  //   // { id: 'wild-fox-5', speciesId: 'fox', position: [50, 1, 50] },
  //   // { id: 'wild-fox-6', speciesId: 'fox-red', position: [-55, 1, -50] },
  //   { id: 'wild-bulbasaur-1', speciesId: 'bulbasaur', position: [-50, 1, 40] },
  //   { id: 'wild-bulbasaur-2', speciesId: 'bulbasaur', position: [50, 1, 50] },
  //   { id: 'wild-charmander-1', speciesId: 'charmander', position: [-35, 1, -30] },
  //   { id: 'wild-charmander-2', speciesId: 'charmander', position: [40, 1, -45] },
  //   { id: 'wild-squirtle-1', speciesId: 'squirtle', position: [-55, 1, -50] },
  //   { id: 'wild-squirtle-2', speciesId: 'squirtle', position: [-40, 1, -50] },
  // ],
  wildCreatures: generateWildCreatures(WILD_CREATURE_COUNT),
}


