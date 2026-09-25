import { getItem } from '../data/items'
import { InputState, InputControlled, HeldItem } from '../traits'

// Flags de AÇÃO bloqueadas no modo Scan — pedido do usuário: "durante o
// modo Scan, o jogador deve poder somente andar... não quero criar
// vários if (scan) espalhados pelo código... use esse sistema para
// definir quais ações são permitidas no Scan" (ver docs/features/
// 033-*.md). `primary` fica FORA de propósito: é o que confirma o scan
// (clique esquerdo enquanto segura o direito, `scannerModeSystem.js`)
// — bloqueá-lo quebraria o próprio Scan. Câmera/movimento
// (forward/back/left/right, cameraYaw/cameraPitch/zoom,
// secondaryHeld/secondaryReleased) também ficam de fora — são
// exatamente o "só andar + olhar" que continua permitido.
const SCAN_BLOCKED_FLAGS = [
  'run', // corrida/sprint
  'jump', // pulo
  'dash', // esquiva
  'secondary1', // Q — skill/invocar/recolher
  'secondary2', // E
  'secondary3', // R
]

/**
 * Converte o snapshot de input bruto (context.input) em um vetor de intenção
 * no plano do mundo, escrito no trait InputState das entidades controladas.
 *
 * **Bloqueio de ações no modo Scan** (docs/features/033-*.md) — único
 * lugar do projeto que já tem a responsabilidade de "traduzir/filtrar
 * input bruto" (é literalmente o que este system faz pra movimento);
 * estender essa mesma responsabilidade pras flags de ação, em vez de
 * espalhar `if (scan)` em `movementSystem.js`/`playerActionSystem.js`/
 * `creatureAttackSystem.js`/`partySummonSystem.js`/
 * `characterPhysicsSystem.js`, é o pedido explícito do usuário. Com o
 * item categoria `scanner` equipado e o botão direito segurado
 * (`input.secondaryHeld`), zera `SCAN_BLOCKED_FLAGS` direto em
 * `context.input` — o MESMO objeto que todo system da fase `simulation`
 * lê no resto deste tick (`core/systems/pipeline.js`, mesma referência
 * o tempo todo) — antes de qualquer um deles rodar. Nenhum desses cinco
 * arquivos precisa saber que o modo Scan existe.
 *
 * Deriva "está escaneando" direto do input bruto (categoria do item +
 * `secondaryHeld`), não do trait `ScanMode.active` — `ScanMode.active`
 * só fica atualizado depois que `scannerModeSystem.js` roda, que vem
 * DEPOIS de vários dos systems de ação na fila (`movementSystem`,
 * `playerActionSystem`); ler o input bruto aqui, o primeiro system do
 * tick, já dá o valor certo pra todo mundo, sem depender de ordem
 * nenhuma entre systems.
 *
 * Headless: lê apenas context.input; nunca acessa o teclado ou o DOM.
 * Fase: input.
 *
 * Eixos: forward = -z, back = +z, left = -x, right = +x.
 */
export function inputSystem(context) {
  const { world } = context
  const input = context.input ?? {}

  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let z = (input.back ? 1 : 0) - (input.forward ? 1 : 0)

  const magnitude = Math.hypot(x, z)
  if (magnitude > 1) {
    x /= magnitude
    z /= magnitude
  }

  world
    .query(InputControlled, HeldItem, InputState)
    .updateEach(([heldItem, state]) => {
      const item = heldItem.itemId ? getItem(heldItem.itemId) : null
      const scanning = item?.category === 'scanner' && !!input.secondaryHeld

      if (scanning) {
        for (const flag of SCAN_BLOCKED_FLAGS) input[flag] = false
      }

      state.x = x
      state.z = z
      state.run = !!input.run
    })
}
