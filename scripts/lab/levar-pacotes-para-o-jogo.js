import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

/**
 * Leva para o jogo os modelos dos pacotes do laboratório de biomas
 * (docs/features/066-revisao-dos-biomas.md) que os biomas usam: procura nos
 * dados dos biomas (`src/core/data/biomes/*\/index.js`) os ids de modelo
 * que existem nos pacotes do lab (`public/assets/lab/<pacote>/`) e copia só
 * esses — o `.glb`, as texturas que ele cita e o manifesto enxuto — para a
 * pasta do jogo (`public/assets/vegetation/packs/<pacote>/`, no git), com a
 * lista `packs.json`. Rodar de novo refaz a pasta do jogo inteira.
 *
 * Uso: node scripts/lab/levar-pacotes-para-o-jogo.js [--lab <pasta>]
 *   [--out <pasta>] [--biomes <pasta>]
 */

const { values: args } = parseArgs({
  options: {
    lab: { type: 'string', default: 'public/assets/lab' },
    out: { type: 'string', default: 'public/assets/vegetation/packs' },
    biomes: { type: 'string', default: 'src/core/data/biomes' },
  },
})

// Os textos entre aspas dos dados dos biomas (os ids de modelo estão entre
// eles).
const quoted = new Set()
for (const entry of readdirSync(args.biomes, { withFileTypes: true })) {
  const file = join(args.biomes, entry.name, 'index.js')
  if (!entry.isDirectory() || !existsSync(file)) continue
  for (const [, text] of readFileSync(file, 'utf8').matchAll(/'([^'\n]+)'/g)) {
    quoted.add(text)
  }
}

const labList = JSON.parse(readFileSync(join(args.lab, 'packs.json'), 'utf8'))
rmSync(args.out, { recursive: true, force: true })
const taken = []
for (const pack of labList) {
  const from = join(args.lab, pack)
  const manifest = JSON.parse(readFileSync(join(from, 'manifest.json'), 'utf8'))
  const ids = Object.keys(manifest.props ?? {}).filter((id) => quoted.has(id))
  if (ids.length === 0) continue
  const to = join(args.out, pack)
  const props = {}
  const textures = {}
  const copy = (file) => {
    mkdirSync(dirname(join(to, file)), { recursive: true })
    copyFileSync(join(from, file), join(to, file))
  }
  for (const id of ids) {
    const prop = manifest.props[id]
    props[id] = prop
    copy(prop.file)
    for (const material of Object.values(prop.materials ?? {})) {
      for (const name of Object.values(material.maps ?? {})) {
        if (textures[name] || !manifest.textures?.[name]) continue
        textures[name] = manifest.textures[name]
        copy(textures[name].file)
      }
    }
  }
  writeFileSync(
    join(to, 'manifest.json'),
    `${JSON.stringify({ source: manifest.source, props, textures }, null, 2)}\n`,
  )
  taken.push(pack)
  console.log(
    `${pack}: ${ids.length} modelos, ${Object.keys(textures).length} texturas`,
  )
}
mkdirSync(args.out, { recursive: true })
writeFileSync(
  join(args.out, 'packs.json'),
  `${JSON.stringify(taken, null, 2)}\n`,
)
console.log(`pacotes do jogo: ${taken.join(', ') || '(nenhum)'}`)
