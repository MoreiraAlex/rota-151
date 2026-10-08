/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Sprites pequenos (e GIFs, que o Next nem otimiza): servidos direto,
    // sem converter na primeira vez — o pré-carregamento do jogo deixa
    // eles no cache (docs/features/044-salvar-o-jogo.md).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'play.pokemonshowdown.com',
      },
    ],
  },
}

export default nextConfig
