import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  CATEGORY_LABELS,
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatRange,
} from '@/tools/wiki/wikiFormat'

export function DamagePage({ data, version }) {
  const { battle, damageExamples } = data
  const oneDecimal = (value) => formatNumber(value, 1)

  return (
    <>
      <Section id="conta" title="A conta do dano">
        <p>
          O Rota 151 usa a fórmula clássica de Pokémon. A diferença é que o jogo
          é em tempo real: a conta acontece a cada golpe que acerta, não a cada
          turno.
        </p>
        <Formula>
          <p>
            <strong>Dano</strong> = ((nível × 2 ÷ 5 + 2) × poder × ataque ÷
            defesa ÷ 50 + 2) × variação
          </p>
        </Formula>
        <ul>
          <li>
            <strong>nível</strong> — o{' '}
            <WikiLink
              version={version}
              to="criaturas/experiencia-e-nivel#nivel-de-calculo"
            >
              nível de cálculo
            </WikiLink>{' '}
            de quem ataca (o nível ×{' '}
            {formatNumber(data.experience.formulaScale)}
            ).
          </li>
          <li>
            <strong>poder</strong> — a força do golpe (no catálogo de golpes).
          </li>
          <li>
            <strong>ataque ÷ defesa</strong> — golpe físico compara o Ataque de
            quem ataca com a Defesa do alvo; golpe especial compara o Ataque
            especial com a Defesa especial. Os dois já contam os efeitos ativos
            (
            <WikiLink version={version} to="batalha/efeitos">
              Efeitos em batalha
            </WikiLink>
            ).
          </li>
          <li>
            <strong>variação</strong> — um sorteio entre{' '}
            {formatPercent(battle.randomMin, 0)} e{' '}
            {formatPercent(battle.randomMax, 0)}, pra o mesmo golpe nunca dar
            sempre o mesmo número.
          </li>
        </ul>
      </Section>

      <Section id="critico" title="Golpe crítico">
        <p>
          Todo golpe tem {formatPercent(battle.criticalChance, 2)} de chance de
          ser <strong>crítico</strong>. No crítico, o nível conta{' '}
          {formatMultiplier(battle.criticalMultiplier)} dentro da conta — o dano
          sobe bastante, mas fica um pouco abaixo do dobro.
        </p>
      </Section>

      <Section id="tipos" title="Tipos">
        <Notice tone="missing">
          <p>
            As criaturas e os golpes ainda não têm tipo (fogo, água, planta…).
            Quando tiverem, golpe do mesmo tipo de quem ataca vai valer{' '}
            {formatMultiplier(battle.stabMultiplier)}, e fraquezas e
            resistências vão multiplicar o dano.
          </p>
        </Notice>
      </Section>

      {damageExamples ? (
        <Section id="exemplos" title="Exemplos">
          <p>
            Quanto cada golpe de dano tira de uma criatura. Pra testar outras
            combinações, use a{' '}
            <WikiLink version={version} to="calculadora">
              calculadora de dano
            </WikiLink>
            .
          </p>
          <DataTable
            head={[
              'Atacante',
              'Golpe',
              'Categoria',
              'Poder',
              'Dano',
              '% da vida',
            ]}
            align={[null, null, null, 'right', 'right', 'right']}
            rows={damageExamples.rows.map((row) => [
              row.attackerName,
              row.attackName,
              CATEGORY_LABELS[row.category],
              row.power ?? '—',
              row.channel
                ? `${oneDecimal(row.max)} (canal inteiro)`
                : formatRange(row.min, row.max, oneDecimal),
              formatRange(row.minPercent, row.maxPercent, formatPercent),
            ])}
            caption={`Alvo: ${damageExamples.defenderName}. Todos com IV ${damageExamples.iv}, sem crítico e sem efeitos.`}
          />
        </Section>
      ) : null}
    </>
  )
}
