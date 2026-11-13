/**
 * Viridian City, a cidade inicial (docs/features/069-revisao-do-bioma-
 * cidade.md): o chão do mapa do Let's Go (`area02/town002_00`), montado à
 * mão com os nossos platôs. A grade saiu do chão do
 * mapa original (uma célula por metro, a altura média dela) e daqui em
 * diante é editada à mão.
 *
 * Tudo em metros do original (antes da escala do jogo), com `x` para o
 * leste e `z` para o sul a partir do canto de cima à esquerda da grade.
 */
export const VIRIDIAN = {
  id: 'viridian',
  name: 'Viridian',
  // Uma linha por metro, do norte (em cima) para o sul; um caractere por
  // metro, do oeste para o leste. `-` um degrau abaixo do chão da cidade,
  // `.` o chão, `:` um degrau acima, `+` dois acima, `#` montanha e `~`
  // lago (nenhum dos dois em Viridian: o laguinho e o paredão do oeste do
  // original saíram, a pedido do usuário). Fora do miolo da cidade, os
  // platôs têm a borda recortada, não a reta do original, e o oeste tem
  // dois morrinhos baixos nos cantos.
  rows: [
    '::::::::::::::::::......:::::::::+++++::::::++++++++:::+++++',
    ':::::::::::::::::.......:::::+++++++++++++++++++++++++++++++',
    ':::::::..:::::..........:::::+++++++++++++++++++++++++++++++',
    ':::::...................:::::+++:::::::+++++++++++++++++++++',
    ':::.....................:::::+++:::::::+++++++++++++++++++++',
    '..............................++:::::::+++++++++++++++++++++',
    '..............................++:::::::+++++++++++++++++++++',
    '..........::::::::............++:::::::+++++++++++++++++++++',
    '..........::::::::............:::::::::::+++++++++++++++++++',
    '..........::::::::...........::::::::::::+++++++++++++++++++',
    '..........::::::::............:::::::::::++++++++++++++++::+',
    '..........::::::::.............::::::::::::+++:::::::+++::::',
    '..........::::::::..............::::::::::::::::::::::::::::',
    '..........::::::::........................::::::::::::::::::',
    '..........::::::::........................::::::::::::::::::',
    '..........::::::::.......................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '..........................................::::::::::::::::::',
    '..........................................::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '.........................................:::::::::::::::::::',
    '..........................................::::::::::::::::::',
    '..........................................::::::::::::::::::',
    '...........................................:::::::::::::::::',
    '...........................................:::::::::::::::::',
    '..........................................::::::::::::::::::',
    '..........................................::::::::::::::::::',
    '...........................................:::::::::::::::::',
    '....................---.....................::::::::::::::::',
    '.......----------------------------------.....::::::::::::::',
    '.......----------------------------------.................::',
    '.......----------------------------------...................',
    '..............---------------------------...................',
    '::............---------------------------...................',
    ':::...................----..................................',
    '::::..................----..................................',
    ':::::.................----..................................',
    '::::::................----..................................',
  ],
  // O que cobre o chão, célula por célula (a mesma grade): `g` grama, `t`
  // terra batida, `a` asfalto, `p` pedras de pisar, `m` manchas de terra
  // (os remendos em volta das pedras e na frente do ginásio). Saiu do mapa original
  // (`scripts/lgpe/city-layout.js`) e daqui em diante é editada à mão.
  ground: [
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggatggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggpmmmpgggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggtmmmpgggggggggggggggggggggg',
    'ggggggggggggggggggggaaagggggggggggtttpgggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggaaaggggggggggggggggggggggggggggggggggggg',
    'ttpmmmmtpggggtaaaaaaaaaggggggggggggggggggggggggggggggggggggg',
    'pttmmmmttggggaaaaaaaaaaggttggggggggttgggggggttttttttttgggggg',
    'pttttttgggggggaaaaaaaaatttttttttttttttttggggttttttttttgggggg',
    'ggggggggggggggggggggaaaaaaaaaaaaaaaaaaaaattttttggggggggggggg',
    'ggggggggggggggggggggaaaaaaaaaaaaaaaaaaaaatttttttttttttttgggg',
    'ggggggggggggggggggggaaaaaaaaaaaaaaaaaaaaatttttttttttttttgggg',
    'ggggggggggggggggggggaaagggggggaaagggggaaagggttttttttttttgggg',
    'ggggggggggggggggggggaaagggggggaaagggggaaagggttttttttttttgggg',
    'ggggggggggggggggggggaaagggggggaaagggggaaagggttttttttttttgggg',
    'gggggggtptpgggggggggaaagggggggaaagggggaaagggttttttttttttgggg',
    'gggggggptttgggggggggaaaggtttggaaagggggaaagggttttttttttttgggg',
    'gggggggptttgggggggggaaaaaaaaaaaaaaaaaaaaaggggggtttttttttgggg',
    'gggggggggtpgggggggggaaaaaaaaaaaaaaaaaaaaaggggggtttttttttgggg',
    'gggggggggggggggggggggaaaaaaaaaaaaaaaaaaagggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    'ggggggggggggggpptttppmmmtptmmmttpptmmmttgggggggggggggggggggg',
    'ggggggggggggggtttttttmmmmtmmmmtpttmmmmttgggggggggggggggggggg',
    'gggggggggggggggggttgggmmmttttttptttttttggggggggggggggggggggg',
    'ggggggggggggggggggggggptmtgggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggggptmtgggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggggtmmtgggggggggggggggggggggggggggggggggg',
    'ggggggggggggggggggggggtmmtgggggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
  ],
  // As texturas do chão (as camadas de cor do relevo, `view/terrain/
  // terrainLayers.js`): a de cada letra de `ground`, a do barranco dos
  // degraus e as da montanha, de baixo para cima. Escolhidas pelo usuário
  // no laboratório da cidade (no original os barrancos são de rocha; aqui
  // ficaram de terra).
  paint: {
    ground: {
      g: 'lgpe-grass',
      t: 'lgpe-soil',
      a: 'lgpe-asphalt',
      p: 'lgpe-path-stone',
      m: 'lgpe-patch-soil',
    },
    steps: 'lgpe-trail-soil',
    mountain: ['lgpe-trail-soil', 'lgpe-trail-soil'],
    // A borda de terra da beira da rua (a camada de cima dos lotes no
    // original).
    curb: 'lgpe-soil',
  },
  // A rua com guia (a letra dela em `ground`): a beira é desenhada por
  // pixel, com a borda de terra do lado do lote e a guia do lado da rua —
  // as duas máscaras do original (`core/town/cityLayout.js`).
  road: 'a',
  // O gramado (a letra dele em `ground`): onde a grama em fios e as flores
  // do mundo nascem (`FIRST_TOWN.GROWS`).
  lawn: 'g',
  // Onde o treinador chega (à frente do Pokécenter), virado para o sul.
  arrival: { x: 26.5, z: 30.8, yaw: 0 },
  // Os vãos da borda por onde saem as rotas (o meio de cada um).
  exits: [
    { side: 'north', road: 'route-2', x: 21.8, z: 0 },
    { side: 'south', road: 'route-1', x: 24, z: 42 },
    { side: 'west', road: 'route-22', x: 0, z: 18.5 },
  ],
  // Os objetos da cidade (modelos do pacote do Let's Go,
  // `public/assets/vegetation/lgpe/`), no tamanho da cidade: o meio da base
  // em `(x, z)`, onde ficava no original (a `origin` do manifesto), e a
  // frente (a porta) para o sul. `kind`: o prédio (`building`) e o objeto
  // de rua (`street-prop`) colidem pelo casco e têm pegada, e o prédio com
  // sala tem porta (`core/interior/`); sem ele, enfeite. A base fica `y` m
  // a partir do chão da cidade ou, sem `y`, no chão do layout debaixo dele
  // (o ponto mais baixo da pegada; com `rest: 'center'`, o do meio), no
  // tamanho da cidade vezes `scale`. As células debaixo de cada prédio e
  // de cada trecho de cerca ficam num nível só.
  props: [
    // O Pokécenter, a loja e o ginásio são os mesmos de Pewter; o ginásio
    // fica no patamar do nordeste.
    { kind: 'building', model: 'pokecenter', x: 26.55, z: 27.72 },
    { kind: 'building', model: 'poke-mart', x: 36.05, z: 18.27 },
    { kind: 'building', model: 'gym', x: 35.55, z: 5.73 },
    // As duas casas iguais, a do norte e a do sul.
    { kind: 'building', model: 'viridian-house', x: 26.55, z: 7.25 },
    { kind: 'building', model: 'viridian-house', x: 26.55, z: 18.25 },
    // A cerca (`scripts/lgpe/city-props.js`, `city-props/viridian.json`):
    // um módulo do kit por trilho do original, de poste a poste, e o poste
    // de cada ponta.
    { kind: 'street-prop', model: 'viridian-fence-3', x: 9.5, z: 4.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 12.5, z: 4.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 15.5, z: 4.25 },
    { kind: 'street-prop', model: 'viridian-fence-2', x: 18, z: 4.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 10.5, z: 6.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 13.5, z: 6.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 16.5, z: 6.25 },
    { kind: 'street-prop', model: 'viridian-fence-1', x: 18.51, z: 6.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 30.25, z: 16.75 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 33.25, z: 16.75 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 36.25, z: 16.75 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 39.25, z: 16.75 },
    { kind: 'street-prop', model: 'viridian-fence-1', x: 9.51, z: 17.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 11.5, z: 17.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 14.5, z: 17.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 17.5, z: 17.25 },
    { kind: 'street-prop', model: 'viridian-fence-2-4', x: 39.55, z: 19.5 },
    {
      kind: 'street-prop',
      model: 'viridian-fence-2',
      x: 9.05,
      z: 7.2,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 9.05,
      z: 9.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 9.05,
      z: 12.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 9.05,
      z: 15.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-2',
      x: 19.05,
      z: 0.2,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 19.05,
      z: 2.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 19.05,
      z: 7.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 19.05,
      z: 10.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 19.05,
      z: 13.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-2',
      x: 19.05,
      z: 16.2,
      yaw: -Math.PI / 2,
    },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 40.8, z: 19.5 },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 19.05, z: 17.25 },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 40.8, z: 16.75 },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 19.05, z: 4.25 },
    // As cercas-vivas: a fila a oeste da rua do norte e as das casas.
    { kind: 'street-prop', model: 'viridian-hedge-2', x: 23.54, z: 7.2 },
    { kind: 'street-prop', model: 'viridian-hedge', x: 19.56, z: 8.24 },
    {
      kind: 'street-prop',
      model: 'viridian-hedge',
      x: 19.57,
      z: 10.28,
      yaw: -Math.PI / 2,
    },
    { kind: 'street-prop', model: 'viridian-hedge', x: 19.55, z: 12.22 },
    { kind: 'street-prop', model: 'viridian-hedge-4', x: 26.03, z: 12.27 },
    { kind: 'street-prop', model: 'viridian-hedge', x: 19.56, z: 14.26 },
    {
      kind: 'street-prop',
      model: 'viridian-hedge',
      x: 19.55,
      z: 16.23,
      yaw: -Math.PI / 2,
    },
    { kind: 'street-prop', model: 'viridian-hedge', x: 23.59, z: 17.24 },
    {
      kind: 'street-prop',
      model: 'viridian-hedge',
      x: 23.58,
      z: 19.25,
      yaw: -Math.PI / 2,
    },
    // As moitas redondas: assentam pelo meio (as do barranco afundam do
    // lado de cima).
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 32.6,
      z: 7.73,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 38.49,
      z: 7.77,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 17.57,
      z: 8.01,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 10.53,
      z: 8.09,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 14.05,
      z: 8.09,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 40.04,
      z: 9.35,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 40.04,
      z: 11.68,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 29.63,
      z: 17.85,
      scale: 0.87,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 31.03,
      z: 17.85,
      scale: 0.87,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 18.81,
      z: 22.01,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 8.12,
      z: 23.78,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 10.07,
      z: 23.78,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 23.94,
      z: 24.93,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 25.64,
      z: 24.93,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 27.34,
      z: 24.93,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 29,
      z: 24.93,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 43.24,
      z: 28.3,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 31.51,
      z: 33.03,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 35.79,
      z: 33.03,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 40.31,
      z: 33.03,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 8.51,
      z: 37.48,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 35.5,
      z: 38.78,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 13.11,
      z: 38.93,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 20.87,
      z: 39.19,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 27.13,
      z: 39.19,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 15.3,
      z: 40.72,
      scale: 0.8,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 37.24,
      z: 40.83,
      rest: 'center',
    },
    {
      kind: 'street-prop',
      model: 'viridian-bush',
      x: 40.79,
      z: 41.02,
      scale: 0.8,
      rest: 'center',
    },
    // Os objetos de rua: os postes (o vidro acende à noite), os bancos, o
    // canteiro de tronco, os vasos e as placas (a da cidade, a do ginásio,
    // a da casa do sul e a da rua de baixo).
    { kind: 'street-prop', model: 'viridian-lamp', x: 38.77, z: 9 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 17.51, z: 17.6 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 23.53, z: 20 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 19.73, z: 26.74 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 29.56, z: 28.19 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 40.51, z: 31.9 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 7.61, z: 35.29 },
    { kind: 'street-prop', model: 'viridian-bench', x: 32.83, z: 17.45 },
    { kind: 'street-prop', model: 'viridian-bench', x: 16.07, z: 26.25 },
    { kind: 'street-prop', model: 'log-flower-bed', x: 35.53, z: 26.54 },
    { kind: 'street-prop', model: 'viridian-pot', x: 26.52, z: 19.85 },
    { kind: 'street-prop', model: 'viridian-pot', x: 27.39, z: 19.85 },
    { kind: 'street-prop', model: 'viridian-pot', x: 28.26, z: 19.85 },
    { kind: 'street-prop', model: 'viridian-pot-long', x: 23.53, z: 27.23 },
    { kind: 'street-prop', model: 'viridian-sign-town', x: 18.84, z: 17.67 },
    { kind: 'street-prop', model: 'viridian-sign-gym', x: 32.52, z: 8.9 },
    { kind: 'street-prop', model: 'viridian-sign', x: 24.44, z: 19.94 },
    { kind: 'street-prop', model: 'viridian-sign-glass', x: 23.67, z: 33.19 },
    // O que a cidade original não tem, no platô do leste (o original ali é
    // só mata, então não precisa ser fiel): o laboratório (o de Pallet), de
    // frente para o sul, e a cerca do campo de treino (`trainingField`,
    // abaixo), com a entrada no lado oeste, de frente para a rampa.
    { kind: 'building', model: 'house-lab', x: 52.5, z: 16.5 },
    // Os postes do platô do leste: no alto da rampa, ao lado da porta do
    // laboratório e na entrada do campo.
    { kind: 'street-prop', model: 'viridian-lamp', x: 43.6, z: 19.6 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 56.2, z: 19.2 },
    { kind: 'street-prop', model: 'viridian-lamp', x: 45.8, z: 24.4 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 48.4, z: 21.95 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 48.4, z: 31.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 51.5, z: 21.95 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 51.5, z: 31.25 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 54.6, z: 21.95 },
    { kind: 'street-prop', model: 'viridian-fence-3', x: 54.6, z: 31.25 },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 46.85,
      z: 23.5,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 46.85,
      z: 29.7,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 56.15,
      z: 23.5,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 56.15,
      z: 26.6,
      yaw: -Math.PI / 2,
    },
    {
      kind: 'street-prop',
      model: 'viridian-fence-3',
      x: 56.15,
      z: 29.7,
      yaw: -Math.PI / 2,
    },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 46.85, z: 25.05 },
    { kind: 'street-prop', model: 'viridian-fence-post', x: 56.15, z: 31.25 },
  ],
  // As árvores (`scripts/lgpe/city-props.js`): onde cada uma ficava no
  // original (o meio do tronco) e o tamanho dela, desenhadas com a folhosa
  // do bioma da cidade (a do mundo) — a mata grande do leste com as
  // maiores. Só uma parte das do original, a pedido do usuário: as que
  // ficaram são as mais espalhadas (cada uma a mais longe das já
  // escolhidas).
  trees: [
    { x: 16.28, z: 1.89 },
    { x: 40.56, z: 6.38 },
    { x: 16.61, z: 15.27 },
    { x: 39.74, z: 18.1 },
    { x: 39.41, z: 41.13 },
    { x: 25.35, z: 4.69, scale: 0.7 },
    { x: 40.33, z: -1.89, scale: 1.65 },
    { x: 47.61, z: 8.59, scale: 1.65 },
    { x: 58, z: 19.5, scale: 1.65 },
    { x: 47.49, z: 36.48, scale: 1.65 },
    { x: 7.53, z: 40.3 },
    { x: 14.09, z: 26.81, scale: 0.6 },
    { x: 16.9, z: 41, scale: 0.7 },
    { x: 28.32, z: 42.7 },
    { x: 7.24, z: 3.87, scale: 0.5 },
    // No lugar do paredão do oeste (que saiu): umas poucas, longe da saída
    // da Rota 22.
    { x: 3, z: 8.5, scale: 1.3 },
    { x: 5.5, z: 13 },
    { x: 2.5, z: 27.5 },
    { x: 4.5, z: 32, scale: 1.3 },
  ],
  // O campo de treino (docs/features/067-campo-de-treino-e-avisos-de-
  // nivel.md), que a cidade original não tem: o meio dele e o lado da
  // entrada. Os bonecos são os do campo das cidades procedurais
  // (`town.trainingField` do bioma da cidade), em grade no meio, virados
  // para a entrada; a cerca fica em `props` e o chão de terra em `ground`.
  // `size` (m do layout): o lado da cerca, onde o chão fica no nível dele.
  trainingField: { x: 51.5, z: 26.6, facing: 'west', size: 9.3 },
  // As rampas entre os degraus, onde o caminho passa (no original os
  // degraus são meio-fio, sobe-se andando): de `from` (no nível de lá) a
  // `to` (no de cá), com a largura `width`.
  ramps: [
    // Do chão da cidade para a rua de baixo, ao lado do lago.
    { from: [21.5, 30.5], to: [21.5, 34], width: 3 },
    // Da ponta leste da rua de baixo para o chão do sudeste.
    { from: [39.5, 35], to: [43, 35], width: 4 },
    // Da rua para o patamar do ginásio, na frente dele.
    { from: [35.5, 14], to: [35.5, 10.5], width: 5 },
    // Da ponta leste da rua da loja para o platô do leste (o laboratório e
    // o campo de treino).
    { from: [39.5, 22], to: [43.5, 22], width: 3 },
  ],
}
