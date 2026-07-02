import { Card, CardContent } from '@/components/ui/card'
import Logout from '@/components/button/logout'

export default function Unauthorized() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8 space-y-4">
          <div className="text-5xl font-bold">403</div>

          <h1 className="text-xl font-semibold">Acesso não autorizado</h1>

          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página. Se acredita que
            isso é um erro, entre em contato com o administrador.
          </p>

          <Logout className="w-full py-4" variant="default" />
        </CardContent>
      </Card>
    </div>
  )
}
