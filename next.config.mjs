/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [{
            protocol: 'https',
            hostname: 'play.pokemonshowdown.com',
        }],
    },
}

export default nextConfig