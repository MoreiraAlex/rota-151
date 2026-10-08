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

      <Section id="biomas" title="Biomas">
        <p>
          O mundo é dividido em <strong>biomas</strong>, cada um com o próprio
          chão, cores e formato de terreno. Um bioma vira o outro aos poucos, e
          biomas de clima parecido ficam perto uns dos outros: o deserto perto
          da savana, a tundra perto das montanhas.
        </p>
        <ul>
          <li>
            <strong>Oceano</strong>: mar aberto, com o fundo bem abaixo da água.
          </li>
          <li>
            <strong>Praia</strong>: a faixa de areia entre o mar e a terra.
          </li>
          <li>
            <strong>Planície</strong>: campo aberto de grama, com colinas
            baixas.
          </li>
          <li>
            <strong>Savana</strong>: campo seco e quente, de terra e grama
            amarelada.
          </li>
          <li>
            <strong>Floresta</strong>: mata de clima ameno, com colinas médias.
          </li>
          <li>
            <strong>Selva</strong>: mata quente e úmida, de relevo irregular.
          </li>
          <li>
            <strong>Pântano</strong>: terra encharcada e plana, cheia de poças.
          </li>
          <li>
            <strong>Deserto</strong>: areia quente, em dunas largas.
          </li>
          <li>
            <strong>Montanha</strong>: morros altos de rocha, com neve no alto.
          </li>
          <li>
            <strong>Vulcânico</strong>: rocha escura e íngreme. Raro.
          </li>
          <li>
            <strong>Tundra</strong>: campo gelado, coberto de neve.
          </li>
        </ul>
        <p>
          Você sempre começa em terra firme. Por enquanto dá pra entrar no mar e
          nos lagos andando pelo fundo.
        </p>
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
          Ainda vão chegar ao mundo: água de verdade em lagos, rios e no mar,
          cavernas, dia e noite, clima, árvores, pedras e grama alta, itens pelo
          chão e o Pokécenter. Os Pokémon de cada bioma também chegam depois.
        </p>
      </Notice>
    </>
  )
}
