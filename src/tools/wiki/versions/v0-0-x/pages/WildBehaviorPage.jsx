import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMeters,
  formatNumber,
  formatPercent,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

export function WildBehaviorPage({ data, version }) {
  const { wild } = data

  return (
    <>
      <Section id="vagando" title="Vagando">
        <p>
          Fora de luta, as criaturas selvagens andam sem rumo pela região onde
          apareceram, parando de vez em quando. Onde cada espécie aparece, e
          quando elas surgem e somem, está em{' '}
          <WikiLink version={version} to="selvagens/onde-encontrar">
            Onde encontrar
          </WikiLink>
          .
        </p>
        <p>
          Cada selvagem nasce com o próprio nível, que depende de onde ela
          aparece: cada cidade tem um nível, as selvagens em volta ficam perto
          dele e, no caminho entre duas cidades, ele muda aos poucos (
          <WikiLink version={version} to="selvagens/onde-encontrar#nivel">
            nível das selvagens
          </WikiLink>
          ). Derrotá-la dá experiência pras criaturas do time que lutaram (
          <WikiLink version={version} to="criaturas/experiencia-e-nivel">
            Experiência e nível
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="percepcao" title="Quando ela te percebe">
        <p>
          A selvagem enxerga à frente, num ângulo de cerca de{' '}
          {formatNumber(wild.viewAngle, 0)}°, até{' '}
          {formatMeters(wild.viewDistance, 0)}. De costas, ela só sente quem
          chega bem perto, a {formatMeters(wild.nearRadius, 0)}. Chegando por
          trás, dá pra se aproximar bem mais sem ser notado.
        </p>
        <p>
          Quando te percebe, aparece uma <strong>exclamação branca</strong> em
          cima da cabeça dela, e ela para e fica te encarando por{' '}
          {formatSeconds(wild.alertTime, 1)}. Depois decide o que fazer, pelo
          temperamento. Isso vale pra você e pras criaturas do seu time.
        </p>
      </Section>

      <Section id="temperamento" title="Hostil ou pacífica">
        <p>
          Cada selvagem nasce com um temperamento. Em geral, a chance de ser
          hostil é de {formatPercent(wild.hostileChance, 0)}, mas cada espécie
          tem a sua (
          <WikiLink
            version={version}
            to="selvagens/onde-encontrar#temperamento"
          >
            tabela por espécie
          </WikiLink>
          ).
        </p>
        <ul>
          <li>
            <strong>Hostil</strong> — a exclamação vira uma{' '}
            <strong>veia de raiva</strong> vermelha e ela parte pra cima. Se
            você chegar a {formatMeters(wild.aggroRadius, 0)} dela enquanto ela
            te encara, ela ataca na hora. Só desiste se você se afastar um pouco
            além disso (mais {formatMeters(wild.exitMargin, 0)}).
          </li>
          <li>
            <strong>Pacífica</strong> — pode fugir (veja abaixo). Se ficar, a
            exclamação some e ela volta a vagar. Quando apanha, ela sempre
            revida.
          </li>
          <li>
            Quem foi atacada persegue o agressor por mais tempo: só desiste a
            mais de {formatMeters(wild.leashRadius, 0)}.
          </li>
          <li>
            Depois de decidir, ela não mostra a exclamação de novo até todo
            mundo do seu lado se afastar a mais de{' '}
            {formatMeters(wild.forgetRadius, 0)}. Até lá, a hostil que desistiu
            volta pra cima de quem chegar a {formatMeters(wild.aggroRadius, 0)}{' '}
            dela.
          </li>
        </ul>
      </Section>

      <Section id="ameaca" title="Quem ela persegue">
        <p>
          Na luta, a selvagem mira em quem mais causou dano a ela. Essa “raiva”
          vai passando: cai pela metade a cada{' '}
          {formatSeconds(wild.threatHalfLife, 0)}. Um alvo quase desmaiando
          também atrai a atenção dela (
          <WikiLink version={version} to="selvagens/como-lutam#alvo">
            Como as criaturas lutam
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="fuga" title="Fuga">
        <p>
          Fugir é sumir: a selvagem corre por um instante, com uma{' '}
          <strong>gota de suor</strong> em cima da cabeça, e desaparece numa
          nuvem de poeira. Enquanto corre, não dá pra acertar nem capturar. Ela
          só foge em duas situações:
        </p>
        <ul>
          <li>
            <strong>Pacífica que te percebe</strong> — no fim do tempo
            encarando, ela pode fugir. A chance é de cada espécie (em geral,{' '}
            {formatPercent(wild.fleeChance, 0)};{' '}
            <WikiLink
              version={version}
              to="selvagens/onde-encontrar#temperamento"
            >
              tabela por espécie
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Escapou da Pokébola</strong> — ela pode partir pra cima ou
            fugir (
            <WikiLink version={version} to="selvagens/captura">
              Captura
            </WikiLink>
            ).
          </li>
        </ul>
        <p>Numa luta ninguém foge: ela vai até desmaiar.</p>
        <Notice tone="tip">
          <p>
            Acertar um golpe ou jogar a Pokébola enquanto ela ainda te encara
            impede a fuga. Chegando por trás sem ser visto, ela nem tem chance
            de fugir.
          </p>
        </Notice>
        <Notice tone="missing">
          <p>
            Selvagens da mesma espécie ainda não se ajudam: cada uma luta
            sozinha.
          </p>
        </Notice>
      </Section>
    </>
  )
}
