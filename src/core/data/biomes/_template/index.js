/**
 * Molde de um bioma (docs/features/047-biomas.md). Copia esta pasta pra
 * `<id>/` e registra em `../index.js`. Mudar qualquer número de `size`,
 * `climate` ou `relief` muda o mundo da seed — subir
 * `GAME_CONFIG.TERRAIN.GENERATION_VERSION` junto.
 */
export const BIOME_TEMPLATE = {
  id: 'nome-em-minusculo',
  // Nome pro jogador (wiki) e pro debug.
  name: 'Nome do bioma',
  // Largura típica (m) de uma mancha deste bioma — entre biomas do mesmo
  // clima, o de `size` maior ocupa manchas maiores.
  size: 600,
  // Faixa de cada eixo do clima (0 a 1, a fração do mundo abaixo daquele
  // valor — ver `GAME_CONFIG.BIOMES`) em que o bioma vive. Eixo omitido =
  // qualquer valor. Fora da faixa ele perde a disputa aos poucos
  // (`CLIMATE_SHARPNESS`), por isso a fronteira não é um corte seco.
  // - temperature: frio → quente
  // - humidity: seco → úmido
  // - continent: mar aberto → costa → interior (oceano e praia vivem só
  //   pela continentalidade; os de terra ficam acima da faixa da praia)
  // - relief: plano → onde o terreno sobe (montanha, vulcânico)
  climate: {
    temperature: [0, 1],
    humidity: [0, 1],
    continent: [0, 1],
    relief: [0, 1],
  },
  // Forma do chão (core/terrain/terrainHeight.js). Alturas em metros a
  // partir do nível da água (`TERRAIN.WATER_LEVEL`).
  relief: {
    // Altura do chão médio.
    baseHeight: 3,
    // Quanto os morros sobem e os vales descem a partir do chão médio.
    hillHeight: 6,
    // Largura (m) dos morros — a distância de um topo ao próximo.
    hillSize: 120,
    // Detalhe miúdo sobre os morros (0 a 1): 0 = morros lisos.
    roughness: 0.25,
    // 1 = relevo natural; acima disso, mais campo plano e morros mais
    // marcados; abaixo, morros arredondados (dunas).
    flatness: 1.2,
  },
  // Cores do chão (view/terrain/terrainGeometry.js).
  palette: {
    // Abaixo da água.
    bed: '#6b5a3e',
    // Margem (até `TERRAIN_COLOR.SHORE_HEIGHT` acima da água).
    shore: '#c2b280',
    // Chão: de `low` (logo acima da margem) até `high` em `highHeight` (m)
    // acima da água.
    low: '#4f8a3c',
    high: '#7a9a4a',
    highHeight: 8,
    // Encosta íngreme.
    slope: '#7d6a52',
    // Opcional: cor do alto (neve, cratera) a partir de `peakHeight` (m)
    // acima da água.
    // peak: '#f2f4f7',
    // peakHeight: 30,
    // Cor chapada do bioma no modo "chão por bioma" do debug (F2).
    debug: '#ff00ff',
  },
  // Desenho do chão (view/terrain/terrainMaterial.js): o claro e escuro e o
  // relevo de luz de uma textura sobre a cor da paleta. Os nomes são as
  // camadas de `view/terrain/terrainLayers.js`.
  ground: {
    // Chão plano.
    texture: 'grass',
    // Encosta íngreme (onde a cor vira `palette.slope`).
    slopeTexture: 'rock',
    // Opcional: margem e fundo da água (sem ele, `texture`).
    shoreTexture: 'sand',
    // Opcional: o alto (com `palette.peak`; sem ele, `texture`).
    // peakTexture: 'snow',
    // Força do desenho (0 a 1): 0 = só a cor da paleta.
    detail: 0.6,
  },
  // O que nasce aqui (colocado pela 051 — vegetação e objetos). `kind` é o
  // tipo do objeto; `density` (0 a 1) é relativa entre os biomas.
  vegetation: [{ kind: 'tall-grass', density: 0.5 }],
  // Tags que o spawn (055) usa nas condições de cada espécie.
  tags: ['grassland'],
}
