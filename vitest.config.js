import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      // Informativo apenas — não é gate. `all: true` faz arquivos sem nenhum
      // teste aparecerem como 0%, em vez de somem do relatório: é o radar
      // "o que ninguém está testando", não uma meta de porcentagem.
      provider: 'v8',
      all: true,
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.test.js', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
