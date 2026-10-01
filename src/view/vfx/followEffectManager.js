/**
 * Liga um efeito de partículas a cada coisa que fica ATIVA por um tempo e
 * pode se mover nesse meio-tempo — a criatura dando dash (`DashEffectsView.jsx`),
 * a criatura carregando um golpe (`ChargeEffectsView.jsx`): nasce quando fica
 * ativo, acompanha enquanto dura, para de emitir quando acaba (ou some) e é
 * descartado quando as últimas partículas morrem. Separado do componente
 * React pra ser testável sem WebGL — `createSystem` é injetado.
 *
 * `followers` (todos os candidatos, a cada frame): `{ key, active, origin:
 * [x, y, z], yaw, height, ... }` — `key` identifica o seguidor entre frames
 * (a entidade), `origin` é de onde as partículas saem, `yaw` pra onde ele vai
 * e `height` a altura do corpo (os specs leem em `ctx.height`). O seguidor
 * inteiro vai pro `createSystem(follower)` quando o efeito nasce — campos a
 * mais (ex.: o grupo e o raio da carga) servem pra montar o sistema certo.
 * `root` é o grupo da cena (espaço do mundo) onde os sistemas são pendurados.
 *
 * Um efeito novo logo depois de outro ganha um sistema novo; o antigo termina
 * sozinho ao lado.
 */
export function createFollowEffectManager({ createSystem, root }) {
  // chave → sistema em andamento
  const following = new Map()
  // todo sistema vivo (em andamento + os que só esperam as partículas morrerem)
  const systems = new Set()

  function begin(follower) {
    const system = createSystem(follower)
    root.add(system.group)
    systems.add(system)
    following.set(follower.key, system)
    return system
  }

  function end(key) {
    following.get(key)?.endEmission()
    following.delete(key)
  }

  return {
    update(followers, delta, cameraPosition) {
      const seen = new Set()

      for (const follower of followers) {
        const { key, active, origin, yaw, height } = follower
        seen.add(key)
        if (!active) {
          end(key)
          continue
        }
        const system = following.get(key) ?? begin(follower)
        system.setFrame({ origin, yaw, height })
      }

      // seguidor que sumiu (criatura recolhida, destruída) no meio do efeito
      for (const key of [...following.keys()]) {
        if (!seen.has(key)) end(key)
      }

      for (const system of [...systems]) {
        system.setCameraPosition(cameraPosition)
        system.update(delta)
        if (system.emissionEnded && system.isDone()) {
          root.remove(system.group)
          system.dispose()
          systems.delete(system)
        }
      }
    },

    /** Quantos sistemas existem agora (em andamento + terminando). */
    get activeCount() {
      return systems.size
    },

    dispose() {
      for (const system of systems) {
        root.remove(system.group)
        system.dispose()
      }
      systems.clear()
      following.clear()
    },
  }
}
