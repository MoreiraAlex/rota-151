import './globals.css'
import { Toaster } from '@/shared/components/ui/sonner'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata = {
  title: {
    default: 'Rota 151',
    template: '%s | Rota 151',
  },
  description:
    'Rota 151 é um jogo inspirado no universo dos monstros de bolso, com exploração, batalhas, captura de criaturas e aventuras em um mundo 3D.',
  applicationName: 'Rota 151',
  authors: [
    {
      name: 'Alex Moreira',
      url: 'https://github.com/MoreiraAlex',
    },
  ],
  keywords: [
    'Rota 151',
    'pokemon',
    'monster catching',
    'RPG',
    'aventura',
    'exploração',
    'batalhas',
    'criaturas',
    'Next.js',
    'Three.js',
    'React Three Fiber',
    'Koota ECS',
    'jogo 3D',
    'indie game',
  ],
  metadataBase: new URL('https://rota151.moreiracode.com'),
}

export default async function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={`antialiased`} suppressHydrationWarning={true}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
