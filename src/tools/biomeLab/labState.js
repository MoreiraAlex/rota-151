/**
 * O estado do laboratório de biomas (docs/features/066-revisao-dos-
 * biomas.md) que o painel muda e a cena lê a cada quadro: o ponto escolhido
 * e a volta da câmera em torno do treinador. Só desta página.
 */
export const labState = {
  point: 'forest',
  orbit: false,
  // Radianos por segundo.
  orbitSpeed: 0.15,
}
