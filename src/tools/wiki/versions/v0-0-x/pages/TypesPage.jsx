import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Notice } from '@/tools/wiki/components/Notice'
import { TypeTag } from '@/tools/wiki/components/TypeTag'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { formatMultiplier } from '@/tools/wiki/wikiFormat'

// Os tipos de defensor com um multiplicador, pra uma linha da tabela.
function defendersWith(chart, attack, test) {
  return chart
    .filter((entry) => entry.attack === attack && test(entry.multiplier))
    .map((entry) => entry.defender)
}

function TagList({ data, types }) {
  if (types.length === 0) return '—'
  return (
    <span className="inline-flex flex-wrap gap-1">
      {types.map((type) => (
        <TypeTag key={type} data={data} type={type} />
      ))}
    </span>
  )
}

export function TypesPage({ data, version }) {
  const { battle, types } = data
  const multiplierOf = (test) =>
    types.chart.find((entry) => test(entry.multiplier))?.multiplier
  const superValue = multiplierOf((value) => value > 1)
  const weakValue = multiplierOf((value) => value > 0 && value < 1)

  return (
    <>
      <Section id="tipos" title="O que é o tipo">
        <p>
          Toda criatura tem <strong>um ou dois tipos</strong>, e todo golpe tem{' '}
          <strong>um tipo</strong> — inclusive os de status. A tabela é a dos
          primeiros jogos, com {types.list.length} tipos:
        </p>
        <p className="flex flex-wrap gap-1">
          {types.list.map((type) => (
            <TypeTag key={type.id} data={data} type={type.id} />
          ))}
        </p>
        <p>
          O tipo das suas criaturas aparece no painel do time e na Pokédex. O de
          uma criatura selvagem não aparece em cima dela: pra descobrir,
          escaneie com a{' '}
          <WikiLink version={version} to="pokedex">
            Pokédex
          </WikiLink>
          .
        </p>
      </Section>

      <Section id="mesmo-tipo" title="Golpe do mesmo tipo">
        <p>
          Um golpe do mesmo tipo de quem o usa causa{' '}
          {formatMultiplier(battle.stabMultiplier)} do dano — um Pokémon de Fogo
          usando um golpe de Fogo, por exemplo.
        </p>
      </Section>

      <Section id="efetividade" title="Forte, fraco e imune">
        <p>
          Cada tipo de golpe é forte ou fraco contra certos tipos de criatura.
          {superValue ? (
            <>
              {' '}
              Golpe <strong>super efetivo</strong> causa{' '}
              {formatMultiplier(superValue, 0)} do dano
            </>
          ) : null}
          {weakValue ? (
            <>
              ; <strong>pouco efetivo</strong>, {formatMultiplier(weakValue, 1)}
            </>
          ) : null}
          ; e um golpe que <strong>não afeta</strong> o tipo do alvo não causa
          dano nenhum.
        </p>
        <ul>
          <li>
            Contra uma criatura de <strong>dois tipos</strong>, os dois contam:
            os multiplicadores se multiplicam. Duas fraquezas viram uma fraqueza
            enorme; uma fraqueza e uma resistência se anulam.
          </li>
          <li>
            Golpe que não afeta não causa dano, não aplica efeitos e não conta
            pra experiência — mas a energia e a recarga são gastas do mesmo
            jeito.
          </li>
          <li>
            Golpes de <strong>status</strong> ignoram a tabela. Alguns, porém,
            não pegam em certos tipos — está na ficha do golpe, no{' '}
            <WikiLink version={version} to="catalogo/golpes">
              catálogo
            </WikiLink>
            .
          </li>
          <li>
            No acerto, aparece <strong>“Super efetivo!”</strong>,{' '}
            <strong>“Pouco efetivo…”</strong> ou <strong>“Não afeta…”</strong>{' '}
            sobre o alvo e no registro da batalha.
          </li>
        </ul>
        <DataTable
          head={[
            'Golpe do tipo',
            'Super efetivo contra',
            'Pouco efetivo contra',
            'Não afeta',
          ]}
          rows={types.list.map((type) => [
            <TypeTag key="type" data={data} type={type.id} />,
            <TagList
              key="super"
              data={data}
              types={defendersWith(types.chart, type.id, (value) => value > 1)}
            />,
            <TagList
              key="weak"
              data={data}
              types={defendersWith(
                types.chart,
                type.id,
                (value) => value > 0 && value < 1,
              )}
            />,
            <TagList
              key="immune"
              data={data}
              types={defendersWith(
                types.chart,
                type.id,
                (value) => value === 0,
              )}
            />,
          ])}
          caption="Tipo de criatura que não aparece numa linha leva o dano normal daquele tipo de golpe."
        />
        <Notice tone="tip">
          <p>
            Antes de mandar uma criatura pra luta, confira o tipo do adversário:
            um golpe super efetivo resolve a briga bem mais rápido.
          </p>
        </Notice>
      </Section>
    </>
  )
}
