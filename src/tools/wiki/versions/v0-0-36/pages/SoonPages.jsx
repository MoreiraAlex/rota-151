import { Notice } from '@/tools/wiki/components/Notice'

export function ControlsPage() {
  return (
    <Notice tone="soon">
      <p>
        Os controles vão aparecer aqui quando estiverem definidos. O jogo vai
        ter suporte a teclado e mouse, celular e controle, então as páginas da
        wiki falam das ações (atacar, usar uma habilidade, invocar uma criatura)
        e não de botões.
      </p>
    </Notice>
  )
}

export function TrainerPage() {
  return (
    <Notice tone="soon">
      <p>
        O papel do treinador — itens, arremesso, o que ele faz durante uma luta
        — ainda está em definição. Esta página entra quando essas mecânicas
        estiverem prontas.
      </p>
    </Notice>
  )
}

export function ItemsPage() {
  return (
    <Notice tone="soon">
      <p>
        Os itens do jogo ainda estão em definição. A Pokédex, que já funciona,
        tem a <strong>própria página</strong> no menu.
      </p>
    </Notice>
  )
}
