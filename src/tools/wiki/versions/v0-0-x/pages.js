import { HomePage } from './pages/HomePage'
import { ControlsPage, TrainerPage } from './pages/SoonPages'
import { ItemsPage } from './pages/CatalogItems'
import { StatusPage } from './pages/StatusPage'
import { VitalsPage } from './pages/VitalsPage'
import { TeamPage } from './pages/TeamPage'
import { InventoryPage } from './pages/InventoryPage'
import { ExperiencePage } from './pages/ExperiencePage'
import { MoveTrainingPage } from './pages/MoveTrainingPage'
import { MovesPage } from './pages/MovesPage'
import { DamagePage } from './pages/DamagePage'
import { TypesPage } from './pages/TypesPage'
import { AccuracyPage } from './pages/AccuracyPage'
import { EffectsPage } from './pages/EffectsPage'
import { EnergyPage } from './pages/EnergyPage'
import { ReachPage } from './pages/ReachPage'
import { FaintPage } from './pages/FaintPage'
import { WildBehaviorPage } from './pages/WildBehaviorPage'
import { HowTheyFightPage } from './pages/HowTheyFightPage'
import { CapturePage } from './pages/CapturePage'
import { PokedexPage } from './pages/PokedexPage'
import { CreatureDetailPage, CreatureListPage } from './pages/CatalogCreatures'
import { MoveDetailPage, MoveListPage } from './pages/CatalogMoves'
import { CalculatorPage } from './pages/CalculatorPage'
import { WorldPage } from './pages/WorldPage'

/**
 * Páginas da wiki 0.0.x, pelo endereço (o mesmo `slug` do menu em
 * `meta.js`). As do catálogo com uma criatura/golpe específico são
 * resolvidas a partir dos números da versão (`resolvePage`).
 */
const PAGES = {
  '': {
    title: 'Wiki do Rota 151',
    summary: 'Como o jogo funciona por dentro, com os números da versão.',
    Component: HomePage,
  },
  controles: { title: 'Controles', Component: ControlsPage },
  treinador: { title: 'O treinador', Component: TrainerPage },
  inventario: {
    title: 'Inventário',
    summary: 'Itens e criaturas fora do time, arrumação e como montar o time.',
    Component: InventoryPage,
  },
  mundo: {
    title: 'O mundo',
    summary: 'Relevo, tamanho do mundo e o que ainda vai chegar.',
    Component: WorldPage,
  },
  'criaturas/status': {
    title: 'Status',
    summary: 'De onde vêm os números de cada criatura.',
    Component: StatusPage,
  },
  'criaturas/vida-e-energia': {
    title: 'Vida e energia',
    summary: 'Como vida e energia se recuperam, e o que muda com a vida baixa.',
    Component: VitalsPage,
  },
  'criaturas/seu-time': {
    title: 'Seu time',
    summary: 'Invocar, recolher, seguir, defender e assumir o controle.',
    Component: TeamPage,
  },
  'criaturas/experiencia-e-nivel': {
    title: 'Experiência e nível',
    summary: 'Como as criaturas ganham XP, sobem de nível e até onde vão.',
    Component: ExperiencePage,
  },
  'criaturas/golpes-e-treino': {
    title: 'Golpes e treino',
    summary:
      'Os três golpes de cada criatura, como aprender um novo e o domínio.',
    Component: MoveTrainingPage,
  },
  'batalha/golpes': {
    title: 'Golpes',
    summary:
      'Categorias de golpe, como lançar, aviso no chão, canalizados e o registro da batalha.',
    Component: MovesPage,
  },
  'batalha/dano': {
    title: 'Dano',
    summary: 'A conta do dano, golpe crítico e exemplos.',
    Component: DamagePage,
  },
  'batalha/tipos': {
    title: 'Tipos',
    summary: 'Golpe do mesmo tipo, forte, fraco e imune — a tabela de tipos.',
    Component: TypesPage,
  },
  'batalha/acerto-e-erro': {
    title: 'Acerto e erro',
    summary: 'Precisão e a chance de errar um golpe.',
    Component: AccuracyPage,
  },
  'batalha/efeitos': {
    title: 'Efeitos em batalha',
    summary: 'Subir e baixar atributos, roubo de vida e queimadura.',
    Component: EffectsPage,
  },
  'batalha/energia-e-recarga': {
    title: 'Energia e recarga',
    summary: 'Quanto cada golpe custa e quanto demora pra voltar.',
    Component: EnergyPage,
  },
  'batalha/alcance-e-area': {
    title: 'Alcance e área',
    summary: 'Até onde os golpes vão e quem eles acertam.',
    Component: ReachPage,
  },
  'batalha/desmaio': {
    title: 'Desmaio',
    summary: 'O que acontece quando a vida zera.',
    Component: FaintPage,
  },
  'selvagens/comportamento': {
    title: 'Comportamento das selvagens',
    summary: 'Hostis e pacíficas, coragem, perseguição e fuga.',
    Component: WildBehaviorPage,
  },
  'selvagens/como-lutam': {
    title: 'Como as criaturas lutam',
    summary:
      'Como selvagens e criaturas do time escolhem golpes, alvos e se movem.',
    Component: HowTheyFightPage,
  },
  'selvagens/captura': {
    title: 'Captura',
    summary:
      'Mirar, arremessar a Pokébola, a chance de capturar e o que acontece depois.',
    Component: CapturePage,
  },
  pokedex: {
    title: 'Pokédex',
    summary: 'Escanear criaturas e o que fica registrado.',
    Component: PokedexPage,
  },
  'catalogo/criaturas': { title: 'Criaturas', Component: CreatureListPage },
  'catalogo/golpes': { title: 'Golpes', Component: MoveListPage },
  'catalogo/itens': {
    title: 'Itens',
    summary: 'Pokébolas, poções e frutas: como usar e o que cada uma faz.',
    Component: ItemsPage,
  },
  calculadora: {
    title: 'Calculadora de dano',
    Component: CalculatorPage,
  },
}

/** Página do endereço (`['batalha', 'dano']`), ou `null` se não existir. */
export function resolvePage(slugParts, data) {
  const slug = slugParts.join('/')
  if (PAGES[slug]) return PAGES[slug]

  const [section, kind, id] = slugParts
  if (section !== 'catalogo' || slugParts.length !== 3) return null

  if (kind === 'criaturas') {
    const species = data.species.find((entry) => entry.id === id)
    return species
      ? { title: species.name, Component: CreatureDetailPage, id }
      : null
  }
  if (kind === 'golpes') {
    const skill = data.skills.find((entry) => entry.id === id)
    return skill ? { title: skill.name, Component: MoveDetailPage, id } : null
  }
  return null
}

/** Todos os endereços da versão — pra gerar as páginas no build. */
export function listPagePaths(data) {
  return [
    ...Object.keys(PAGES),
    ...data.species.map((entry) => `catalogo/criaturas/${entry.id}`),
    ...data.skills.map((entry) => `catalogo/golpes/${entry.id}`),
  ]
}
