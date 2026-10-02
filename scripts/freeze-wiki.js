/**
 * Congela os números de uma versão da wiki (docs/features/036-wiki-do-jogo.md):
 * grava o retrato atual do jogo (`buildWikiData`, `src/tools/wiki/wikiData.js`)
 * em `src/tools/wiki/versions/v<versão>/data.json`. Rodar ANTES de abrir a
 * versão nova da wiki, enquanto o jogo ainda está com as regras da versão que
 * vai ser congelada; depois, apontar o `data` do `meta.js` dela pro arquivo.
 *
 *   npm run wiki:freeze -- 0.0.36
 *   npm run wiki:freeze -- 0.0.36 --out /outro/caminho/data.json
 *
 * Usa o Vite pra carregar o código do jogo (resolve o atalho `@/` e os JSON
 * das espécies, como o build faz) — Node puro não carrega `src/` direto.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' } },
})
const [version] = positionals
if (!version) {
  console.error('Uso: npm run wiki:freeze -- <versão> [--out caminho]')
  process.exit(1)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const out =
  values.out ??
  `${root}src/tools/wiki/versions/v${version.replaceAll('.', '-')}/data.json`

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { '@': `${root}src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
})

try {
  const { buildWikiData } = await server.ssrLoadModule(
    '/src/tools/wiki/wikiData.js',
  )
  writeFileSync(out, `${JSON.stringify(buildWikiData(), null, 2)}\n`)
  console.log(`Wiki ${version} congelada em ${out}`)
} finally {
  await server.close()
}
