#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodeBntx } from './bntx.js'
import { parseGfbmdl } from './gfbmdl.js'
import { encodePng } from './image.js'

/**
 * Prepara as texturas de um Pokémon do Let's Go para o conversor do Blender
 * (`scripts/blender/convert-pokemon-lgpe.py`, docs/features/059-as-10-
 * especies.md — Caterpie, Rattata e Spearow, que só existem no LGPE). O
 * Blender não lê o `.bntx` (layout da GPU do Switch, BC7), então aqui cada
 * textura de cor usada vira PNG, e os parâmetros do material que o Blender
 * precisa para montar a cor final vão num `materials.json`: a textura de cor
 * (`Col0Tex`) e a da camada 1 (`LyCol0Tex`, a íris do Rattata), cada uma com
 * escala/deslocamento de UV e o modo de repetição.
 *
 * Entrada: a pasta `bin/pokemon/pm<dex>_00/` extraída do `LGPE-Poke.zip`
 * (guardado em `.exemple/ambient/LGPE/`).
 *
 * Uso:
 *   node scripts/lgpe/unpack-pokemon.js --src <pasta>/bin/pokemon/pm0010_00 --out <pasta>
 *
 * Grava em `<out>`: `<textura>.png` e `materials.json`.
 */

const { values: args } = parseArgs({
  options: {
    src: { type: 'string' },
    out: { type: 'string' },
  },
})
if (!args.src || !args.out) {
  throw new Error('uso: --src <pasta pm<dex>_00> --out <pasta de trabalho>')
}

// `wrapX`/`wrapY` do sampler.
const WRAP = { 0: 'repeat', 1: 'clamp', 2: 'mirror' }

const folder = args.src.replace(/\/$/, '')
const pm = folder.split('/').pop()
const model = parseGfbmdl(readFileSync(join(folder, 'mdl', `${pm}.gfbmdl`)))
mkdirSync(args.out, { recursive: true })

const used = new Set()
function layerOf(material, sampler, prefix) {
  const slot = material.textures.find((t) => t.sampler === sampler)
  const texture = model.textureNames[slot.index]
  used.add(texture)
  const value = (name, fallback) => material.values[prefix + name] ?? fallback
  return {
    texture,
    wrap: [WRAP[slot.wrapX], WRAP[slot.wrapY]],
    scale: [value('UVScaleU', 1), value('UVScaleV', 1)],
    translate: [value('UVTranslateU', 0), value('UVTranslateV', 0)],
    base: [value('BaseU', 0), value('BaseV', 0)],
  }
}

const materials = model.materials.map((material) => ({
  name: material.name,
  color: layerOf(material, 'Col0Tex', 'Color'),
  layer: material.switches.Layer1Enable
    ? layerOf(material, 'LyCol0Tex', 'Layer1')
    : null,
}))

for (const texture of used) {
  const image = decodeBntx(readFileSync(join(folder, 'mdl', `${texture}.bntx`)))
  writeFileSync(join(args.out, `${texture}.png`), encodePng(image))
  console.log(`${texture}: ${image.format} ${image.width}×${image.height}`)
}
writeFileSync(
  join(args.out, 'materials.json'),
  `${JSON.stringify(materials, null, 2)}\n`,
)
console.log(`materials.json: ${materials.map((m) => m.name).join(', ')}`)
