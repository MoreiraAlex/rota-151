import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatRange,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

function formatRegen(percent) {
  return percent === null ? '—' : `${formatNumber(percent)}% por segundo`
}

export function VitalsPage({ data, version }) {
  const { species, lowHp } = data

  return (
    <>
      <Section id="regeneracao" title="Regeneração">
        <p>
          Vida e energia voltam sozinhas. Depois de um tempo sem tomar dano, a
          vida começa a voltar aos poucos; depois de um tempo sem gastar, a
          energia também.
        </p>
        <ul>
          <li>
            <strong>Tomar dano</strong> zera a espera da vida.
          </li>
          <li>
            <strong>Gastar energia</strong> (golpe, corrida, dash, pulo) zera a
            espera da energia. Gastando um pouco o tempo todo, ela nunca volta.
          </li>
          <li>
            Cada espécie tem o próprio ritmo. A volta é uma porcentagem da vida
            ou energia <em>máxima</em> por segundo.
          </li>
        </ul>
        <DataTable
          head={[
            'Criatura',
            'Vida',
            'Volta da vida',
            'Espera',
            'Energia',
            'Volta da energia',
            'Espera',
          ]}
          align={[null, 'right', 'right', 'right', 'right', 'right', 'right']}
          rows={species.map((entry) => [
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/criaturas/${entry.id}`}
            >
              {entry.name}
            </WikiLink>,
            formatRange(entry.stats.hp.min, entry.stats.hp.max),
            formatRegen(entry.hpRegen.regenPercent),
            entry.hpRegen.regenDelay === null
              ? '—'
              : formatSeconds(entry.hpRegen.regenDelay, 1),
            entry.energy
              ? formatRange(entry.energy.min, entry.energy.max)
              : '—',
            formatRegen(entry.energy?.regenPercent ?? null),
            entry.energy?.regenDelay == null
              ? '—'
              : formatSeconds(entry.energy.regenDelay, 1),
          ])}
          caption="Vida e energia máximas do IV mais baixo ao mais alto, no nível de cada criatura."
        />
        <p>
          Criaturas do time continuam se recuperando mesmo guardadas na bola (
          <WikiLink version={version} to="criaturas/seu-time">
            Seu time
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="vida-baixa" title="Vida baixa">
        <p>
          Machucada, a criatura fica <strong>mais lenta</strong> pra andar e
          correr, e <strong>cansa mais</strong>: correr e dar dash custam mais
          energia. O efeito é pequeno com arranhões e forte perto de desmaiar —
          com a vida zerada, a velocidade cai pra{' '}
          {formatMultiplier(lowHp.speedMin)} e o custo sobe pra{' '}
          {formatMultiplier(lowHp.costMax)}.
        </p>
        <p>
          Por isso dá pra alcançar quem foge machucado. O dash não fica mais
          lento, só mais caro.
        </p>
        <DataTable
          head={['Vida', 'Velocidade', 'Custo de correr e dash']}
          align={['right', 'right', 'right']}
          rows={lowHp.rows.map((row) => [
            formatPercent(row.hp, 0),
            formatMultiplier(row.speed),
            formatMultiplier(row.cost),
          ])}
        />
      </Section>
    </>
  )
}
