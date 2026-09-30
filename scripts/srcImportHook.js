/**
 * `src/` é escrito assumindo o resolvedor do bundler (Next/webpack, via
 * `next dev`/`next build`, e o do Vite, via `vitest`): um import sem
 * extensão (`from '../math'`) resolve pro `index.js` do diretório — Node
 * PURO não faz isso, ESM exige especificador exato, com extensão. Sem
 * este hook, importar um módulo de `src/core/` num script Node comum (ex.:
 * `extract-glb-animation.js`) quebra na primeira dependência que usa esse
 * padrão — que é a convenção do projeto inteiro, todo `index.js` de
 * dentro de `core/`.
 *
 * Registrado via `node:module`'s `register()` (API estável — ver quem usa
 * este arquivo, `extract-glb-animation.js`), roda como hook de resolução
 * do próprio Node: duas regras, na ordem, a MESMA coisa que o bundler já
 * faz, nada de mágica nova — tenta o especificador como veio; falhou por
 * ser um DIRETÓRIO, tenta `<dir>/index.js`; falhou por não existir e não
 * tinha `.js` no fim, tenta com `.js` no fim.
 *
 * Só usado por scripts de dentro de `scripts/` — nunca pelo app de
 * verdade (`next build`/`next dev`), que já resolve isso sozinho pelo
 * próprio bundler.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      const dirUrl = err.url ?? specifier
      const base = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`
      return nextResolve(new URL('index.js', base).href, context)
    }
    if (err.code === 'ERR_MODULE_NOT_FOUND' && !specifier.endsWith('.js')) {
      try {
        return await nextResolve(`${specifier}.js`, context)
      } catch {
        // Nenhuma das duas bateu — cai pro erro original abaixo, mais
        // claro (o especificador de VERDADE, não o `.js` que tentamos).
      }
    }
    throw err
  }
}
