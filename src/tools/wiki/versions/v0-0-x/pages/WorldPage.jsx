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
          O mundo <strong>não tem fim</strong>: dá pra andar em qualquer direção
          sem bater numa borda. O que está longe fica escondido por uma névoa no
          horizonte e vai aparecendo conforme você chega perto.
        </p>
        <ul>
          <li>
            Criaturas que ficaram muito longe param onde estão e continuam de lá
            quando você volta.
          </li>
          <li>
            Coisas largadas no chão (comida derrubada, Pokébola caída) somem de
            vez quando você se afasta muito delas.
          </li>
        </ul>
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
