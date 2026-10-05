import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMeters,
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
          apareceram, parando de vez em quando.
        </p>
        <p>
          Cada selvagem nasce com o próprio nível, sorteado entre{' '}
          {data.experience.wildLevelMin} e {data.experience.wildLevelMax}.
          Derrotá-la dá experiência pras criaturas do time que lutaram (
          <WikiLink version={version} to="criaturas/experiencia-e-nivel">
            Experiência e nível
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="temperamento" title="Hostil ou pacífica">
        <p>
          Cada selvagem nasce com um temperamento. Em geral, a chance de ser
          hostil é de {formatPercent(wild.hostileChance, 0)}, mas algumas
          espécies podem ser mais ou menos agressivas.
        </p>
        <ul>
          <li>
            <strong>Hostil</strong> — persegue quem chegar a{' '}
            {formatMeters(wild.aggroRadius, 0)} dela. Só desiste se você se
            afastar um pouco além disso (mais {formatMeters(wild.exitMargin, 0)}
            ).
          </li>
          <li>
            <strong>Pacífica</strong> — não incomoda ninguém. Quando apanha,
            decide se <strong>revida</strong> ou <strong>foge</strong>.
          </li>
          <li>
            Quem foi atacada persegue o agressor por mais tempo: só desiste a
            mais de {formatMeters(wild.leashRadius, 0)}.
          </li>
        </ul>
      </Section>

      <Section id="coragem" title="Coragem: revidar ou fugir">
        <p>
          A chance de uma pacífica revidar começa em{' '}
          {formatPercent(wild.retaliateChance, 0)} e muda com a situação:
        </p>
        <ul>
          <li>Sobe quando ela está com bastante vida.</li>
          <li>Cai quando o golpe que levou foi forte.</li>
          <li>Sobe quando ela está mais inteira que quem bateu.</li>
        </ul>
        <p>
          A chance fica sempre entre {formatPercent(wild.courageMin, 0)} e{' '}
          {formatPercent(wild.courageMax, 0)} — sempre sobra surpresa.
        </p>
        <DataTable
          head={[
            'Vida dela',
            'Golpe que levou',
            'Vida de quem bateu',
            'Chance de revidar',
          ]}
          align={['right', 'right', 'right', 'right']}
          rows={wild.courageRows.map((row) => [
            formatPercent(row.own, 0),
            `${formatPercent(row.hit, 0)} da vida`,
            formatPercent(row.attacker, 0),
            formatPercent(row.chance, 0),
          ])}
          caption="Situações de exemplo. A vida dela já é a de depois do golpe."
        />
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

      <Section id="fuga" title="Fugindo com a vida baixa">
        <p>
          Lutando, quando a vida chega a {formatPercent(wild.lowHpFlee, 0)}, a
          selvagem decide uma vez se foge (
          {formatPercent(wild.lowHpFleeChance, 0)} de chance). Fugindo, ela
          corre pra longe de quem a persegue e não ataca ninguém até a vida
          voltar a {formatPercent(wild.lowHpRecover, 0)}. A{' '}
          {formatMeters(wild.fleeSafeDistance, 0)} de distância ela se sente
          segura e volta a vagar.
        </p>
        <Notice tone="tip">
          <p>
            Selvagem fugindo machucada fica mais lenta e cansa mais rápido (
            <WikiLink
              version={version}
              to="criaturas/vida-e-energia#vida-baixa"
            >
              Vida baixa
            </WikiLink>
            ) — dá pra alcançar.
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
