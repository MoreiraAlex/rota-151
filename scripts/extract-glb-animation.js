#!/usr/bin/env node
import { register } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

// ANTES de qualquer import de `src/core/` — ver docstring do hook.
register(new URL('./srcImportHook.js', import.meta.url), import.meta.url)

const { parseGlb, listGltfAnimations, convertGltfAnimationToClip } =
  await import('../src/core/animation/gltfAnimation.js')

/**
 * CLI pra converter uma animação embutida num `.glb` (`GLTFLoader`/
 * `AnimationClip`, exportada de outra ferramenta — Blender, um asset
 * ripado, etc.) pro formato de clipe de keyframes do motor (`type:
 * "keyframes"`, ver `core/animation/applyAnimationClip.js`) — o mecanismo
 * de leitura já existe e é testado (`gltfAnimation.js`); este script é só
 * a ponta prática: apontar pro `.glb`, ver o que tem dentro, tirar uma
 * animação como arquivo JSON pronto pra colar em `species.clips`.
 *
 * Uso:
 *   node scripts/extract-glb-animation.js --file <model.glb> --list
 *   node scripts/extract-glb-animation.js --file <model.glb> \
 *     --animation <nome-ou-índice> --out <clip.json> [--fps 30]
 *
 * `--list` só imprime nome/índice/duração de toda animação embutida, sem
 * converter nada — o arquivo costuma ter dezenas (ex.: um rig ripado de
 * Pokémon tem idle/walk/run/ataque/dano/sono/etc. tudo junto), então vale
 * olhar antes de escolher qual extrair.
 */
function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      list: { type: 'boolean', default: false },
      animation: { type: 'string' },
      out: { type: 'string' },
      fps: { type: 'string', default: '30' },
    },
  })

  if (!values.file) {
    console.error(
      'uso: --file <model.glb> [--list | --animation <nome-ou-índice> --out <clip.json>] [--fps 30]',
    )
    process.exitCode = 1
    return
  }

  const fixture = parseGlb(readFileSync(values.file))

  if (values.list) {
    for (const { index, name, duration, frames } of listGltfAnimations(
      fixture,
    )) {
      console.log(`${index}\t${duration.toFixed(3)}s\t${frames}f\t${name}`)
    }
    return
  }

  if (!values.animation || !values.out) {
    console.error(
      'faltou --animation <nome-ou-índice> e/ou --out <clip.json> (ou use --list)',
    )
    process.exitCode = 1
    return
  }

  // Índice numérico vem como string do CLI — número puro vira number,
  // senão é o NOME da animação (glTF permite índice ou nome, ver
  // `convertGltfAnimationToClip`).
  const animationRef = /^\d+$/.test(values.animation)
    ? Number(values.animation)
    : values.animation

  const clip = convertGltfAnimationToClip(fixture, animationRef, {
    fps: Number(values.fps),
  })
  writeFileSync(values.out, JSON.stringify(clip, null, 2))
  const frameCount = Object.values(clip.bones)[0]
    ? Math.max(
        ...Object.values(clip.bones).map(
          (t) =>
            t.quaternion?.length ?? t.position?.length ?? t.scale?.length ?? 0,
        ),
      )
    : 0
  console.log(
    `"${clip.name}" → ${values.out} (${Object.keys(clip.bones).length} ossos, ${frameCount} frames, ${clip.fps}fps)`,
  )
}

main()
