/**
 * Clipes de `.glb` de item com o fim corrompido (docs/features/043-
 * captura.md): o `poke-ball.glb` veio com todo quadro depois de um certo
 * ponto ZERADO (escala 0 e posição 0) nos clipes mais longos — tocando, a
 * bola sumia nesse trecho. `trimDeadTail` corta o clipe onde começa essa
 * "cauda morta": o primeiro instante a partir do qual alguma trilha de
 * escala fica em zero até o fim. Escala zero que não vai até o fim (a bola
 * nascendo de tamanho 0, por exemplo) não conta.
 *
 * Mexe no próprio clipe (passe uma cópia — `clip.clone()`). Devolve ele.
 */
export function trimDeadTail(clip) {
  const cut = findDeadTailStart(clip.tracks)
  if (cut == null || cut <= 0) return clip

  let duration = 0
  for (const track of clip.tracks) {
    const keep = countKeysBefore(track.times, cut)
    if (keep === 0) continue
    const stride = track.values.length / track.times.length
    track.times = track.times.slice(0, keep)
    track.values = track.values.slice(0, keep * stride)
    duration = Math.max(duration, track.times[keep - 1])
  }
  clip.duration = duration
  return clip
}

/** O instante em que começa a cauda morta, ou `null` sem ela. */
export function findDeadTailStart(tracks) {
  let cut = null
  for (const track of tracks) {
    if (!track.name.endsWith('.scale')) continue
    const { times, values } = track
    const stride = values.length / times.length
    let first = times.length
    for (let key = times.length - 1; key >= 0; key--) {
      if (!isZero(values, key * stride, stride)) break
      first = key
    }
    if (first < times.length && first > 0) {
      cut = cut == null ? times[first] : Math.min(cut, times[first])
    }
  }
  return cut
}

function isZero(values, start, length) {
  for (let i = start; i < start + length; i++) {
    if (Math.abs(values[i]) > 1e-6) return false
  }
  return true
}

function countKeysBefore(times, cut) {
  let count = 0
  while (count < times.length && times[count] < cut - 1e-6) count++
  return count
}

/**
 * Tira dos clipes o movimento da RAIZ do item (as trilhas de posição dos nós
 * do topo da cena do `.glb`, `rootNames`): onde a bola está é do jogo
 * (`CaptureBall`/`Position`), o clipe só mexe nas peças. Sem isso, o pulo
 * embutido no `capture_absorb` ficava preso e a bola "teleportava" quando
 * outro clipe zerava a posição. Mexe no próprio clipe; devolve ele.
 */
export function stripRootMotion(clip, rootNames) {
  const roots = new Set(rootNames)
  clip.tracks = clip.tracks.filter((track) => {
    const dot = track.name.lastIndexOf('.')
    const node = track.name.slice(0, dot)
    const property = track.name.slice(dot + 1)
    return !(property === 'position' && roots.has(node))
  })
  return clip
}
