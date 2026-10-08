import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'

export function WorldPage() {
  return (
    <>
      <Section id="relevo" title="O relevo">
        <p>
          O mundo não é plano: tem <strong>campos</strong>,{' '}
          <strong>morros</strong> e <strong>vales</strong>. Ele é gerado a
          partir de uma semente, então é sempre o mesmo a cada vez que você
          entra.
        </p>
        <ul>
          <li>Treinador e criaturas sobem e descem os morros andando.</li>
          <li>
            Encosta muito inclinada não dá pra subir: as criaturas procuram
            outro caminho em volta dela.
          </li>
          <li>
            Os vales mais fundos vão virar lagos quando a água chegar ao jogo.
          </li>
        </ul>
      </Section>

      <Section id="tamanho" title="Tamanho">
        <p>
          Por enquanto o mundo é uma área fechada, cercada por muros. Ele vai
          crescer sozinho conforme você anda.
        </p>
      </Section>

      <Notice tone="soon">
        <p>
          Ainda vão chegar ao mundo: lagos e rios, biomas, dia e noite, clima,
          árvores, pedras e grama alta, itens pelo chão e o Pokécenter.
        </p>
      </Notice>
    </>
  )
}
