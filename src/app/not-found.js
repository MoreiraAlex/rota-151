'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8 space-y-4">
          <div className="text-5xl font-bold">404</div>

          <h1 className="text-xl font-semibold">Página não encontrada</h1>

          <p className="text-sm text-muted-foreground">
            A página que você tentou acessar não existe ou foi movida.
          </p>

          <Button asChild className="w-full">
            <Link href="/">Voltar ao sistema</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
