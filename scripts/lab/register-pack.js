import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

/**
 * Põe um pacote na lista do laboratório de biomas
 * (docs/features/066-revisao-dos-biomas.md): `public/assets/lab/packs.json`
 * é a lista dos pacotes (pastas com `manifest.json` no formato do LGPE) que
 * o lab carrega ao abrir. `--remove` tira.
 *
 * Uso: node scripts/lab/register-pack.js <id> [--remove] [--out <pasta>]
 */

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'public/assets/lab' },
    remove: { type: 'boolean', default: false },
  },
})
const [id] = positionals
if (!id) throw new Error('faltou o id do pacote')
if (!args.remove && !existsSync(join(args.out, id, 'manifest.json'))) {
  throw new Error(`não há ${join(args.out, id, 'manifest.json')}`)
}

const listPath = join(args.out, 'packs.json')
const list = existsSync(listPath)
  ? JSON.parse(readFileSync(listPath, 'utf8'))
  : []
const next = args.remove
  ? list.filter((entry) => entry !== id)
  : [...new Set([...list, id])]
writeFileSync(listPath, `${JSON.stringify(next, null, 2)}\n`)
console.log(`pacotes do lab: ${next.join(', ') || '(nenhum)'}`)
