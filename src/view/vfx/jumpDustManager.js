/**
 * Decide QUANDO sai poeira de pulo e com que força — a lógica de
 * `JumpDustView.jsx`, separada do React/WebGL pra ser testável (`createSystem`
 * é injetado). Só olha a transição de "no chão" de cada criatura, a cada frame:
 *
 * - **Decolagem**: sai do chão com velocidade vertical pra CIMA (`vy > 0`) = pulo.
 *   Sair de uma borda caindo (`vy <= 0`) não solta poeira.
 * - **Aterrissagem**: volta ao chão depois de estar no ar, venha de pulo ou de
 *   queda. A força vem da MAIOR velocidade de queda (`-vy`) vista no ar, entre
 *   `minSpeed` (abaixo disso não solta nada — degrau, rampa) e `maxSpeed`
 *   (força total).
 *
 * `creatures` (um por criatura, a cada frame): `{ entity, grounded, vy,
 * position: [x, y, z] }` — `position` nos PÉS. Criatura vista pela primeira vez
 * só registra o estado (não solta nada). `createSystem({ strength, kind })`
 * devolve um sistema de partículas que `{ group, update(delta), isDone(),
 * dispose() }`; a posição dos pés é posta em `group.position`. `root` é o
 * grupo da cena (espaço do mundo).
 */
export function createJumpDustManager({
  createSystem,
  root,
  minSpeed = 2,
  maxSpeed = 10,
}) {
  // criatura → { grounded, fall (maior velocidade de queda no ar) }
  const states = new Map()
  const systems = new Set()

  function burst(kind, strength, position) {
    const system = createSystem({ kind, strength })
    system.group.position.set(position[0], position[1], position[2])
    root.add(system.group)
    systems.add(system)
  }

  return {
    update(creatures, delta) {
      const seen = new Set()

      for (const { entity, grounded, vy, position } of creatures) {
        seen.add(entity)
        const state = states.get(entity)
        if (!state) {
          states.set(entity, { grounded, fall: 0 })
          continue
        }

        if (state.grounded && !grounded && vy > 0) {
          burst('takeoff', 0.5, position)
        }
        if (!grounded) state.fall = Math.max(state.fall, -vy)
        if (!state.grounded && grounded) {
          if (state.fall >= minSpeed) {
            const strength = Math.min(
              (state.fall - minSpeed) / (maxSpeed - minSpeed),
              1,
            )
            burst('landing', strength, position)
          }
          state.fall = 0
        }
        state.grounded = grounded
      }

      // criatura que sumiu (recolhida, destruída)
      for (const entity of [...states.keys()]) {
        if (!seen.has(entity)) states.delete(entity)
      }

      for (const system of [...systems]) {
        system.update(delta)
        if (system.isDone()) {
          root.remove(system.group)
          system.dispose()
          systems.delete(system)
        }
      }
    },

    /** Quantos sistemas de poeira existem agora. */
    get activeCount() {
      return systems.size
    },

    dispose() {
      for (const system of systems) {
        root.remove(system.group)
        system.dispose()
      }
      systems.clear()
      states.clear()
    },
  }
}
