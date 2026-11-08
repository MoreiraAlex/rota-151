/**
 * Mede o que sai de verdade no som do jogo: analisadores em paralelo na
 * saída do `AudioListener`, um por canal (esquerda e direita), sem mexer no
 * caminho do áudio.
 */
export function createLevelMeter(listener) {
  const { context } = listener
  const input = listener.getInput()
  const splitter = context.createChannelSplitter(2)
  const channels = [0, 1].map((index) => {
    const analyser = context.createAnalyser()
    // Maior que um quadro: nada entre dois quadros escapa da leitura.
    analyser.fftSize = 2048
    splitter.connect(analyser, index)
    return { analyser, samples: new Float32Array(analyser.fftSize) }
  })
  input.connect(splitter)

  const peakOf = ({ analyser, samples }) => {
    analyser.getFloatTimeDomainData(samples)
    let peak = 0
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
    return peak
  }

  return {
    /**
     * O maior valor absoluto no trecho mais recente (0–1), de cada canal e
     * dos dois juntos.
     */
    readPeaks() {
      const left = peakOf(channels[0])
      const right = peakOf(channels[1])
      return { left, right, peak: Math.max(left, right) }
    },
    dispose() {
      input.disconnect(splitter)
    },
  }
}
