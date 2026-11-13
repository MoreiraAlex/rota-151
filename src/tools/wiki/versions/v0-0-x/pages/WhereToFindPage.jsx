import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  DAY_PHASE_NAMES,
  RARITY_NAMES,
  describeSpeciesSpawn,
  formatHour,
  formatMeters,
  formatNumber,
  formatPercent,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

const PHASE_ORDER = ['dawn', 'day', 'dusk', 'night']

// "A, B e C".
function listNames(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
}

function formatAge(seconds) {
  return seconds >= 60
    ? `${formatNumber(seconds / 60, 1)} min`
    : formatSeconds(seconds, 0)
}

export function WhereToFindPage({ data, version }) {
  const { wildSpawn } = data
  const wild = data.species.filter((entry) => entry.spawn)
  const notWild = data.species.filter((entry) => !entry.spawn)
  const phases = PHASE_ORDER.filter((phase) => phase in wildSpawn.phaseStarts)

  return (
    <>
      <Section id="aparecem" title="Como aparecem">
        <p>
          As criaturas selvagens aparecem em volta de você enquanto você anda
          pelo mundo, entre {formatMeters(wildSpawn.minRadius, 0)} e{' '}
          {formatMeters(wildSpawn.maxRadius, 0)} de distância — nunca onde você
          está olhando: elas surgem atrás de você, dos lados ou além da névoa.
          Andando, muitas vezes aparecem logo além da névoa, no caminho à sua
          frente.
        </p>
        <ul>
          <li>
            Em volta de você há no máximo{' '}
            <strong>{wildSpawn.maxPerPlayer} selvagens</strong>. Quando uma vai
            embora ou é capturada, outra aparece — aos poucos, uma de cada vez,
            nunca um bando de uma vez só.
          </li>
          <li>
            Nunca aparecem nas cidades, na água, em encostas íngremes ou em cima
            de árvores e pedras.
          </li>
          <li>
            Cada espécie só aparece no bioma dela, e a hora do dia e o clima
            mudam quem aparece (<a href="#especies">tabela abaixo</a>; biomas,
            dia e noite e clima em{' '}
            <WikiLink version={version} to="mundo">
              O mundo
            </WikiLink>
            ).
          </li>
        </ul>
      </Section>

      <Section id="raridade" title="Raridade">
        <p>
          Toda vez que uma selvagem vai aparecer, primeiro se sorteia a{' '}
          <strong>raridade</strong> e depois a espécie, entre as daquela
          raridade que podem aparecer ali naquela hora e naquele clima. Se
          nenhuma daquela raridade pode aparecer ali, não aparece nada — por
          isso uma espécie rara é rara em qualquer lugar, mesmo onde ela é a
          única.
        </p>
        <DataTable
          head={['Raridade', 'Chance a cada vez']}
          align={[null, 'right']}
          rows={Object.entries(wildSpawn.rarityChances).map(
            ([rarity, chance]) => [
              RARITY_NAMES[rarity] ?? rarity,
              formatPercent(chance, 0),
            ],
          )}
        />
        <p>
          Dentro da mesma raridade, a hora do dia e o clima pesam: uma espécie
          com “mais chance” numa hora aparece mais vezes que as outras da mesma
          raridade.
        </p>
      </Section>

      <Section id="horario" title="Horas do dia">
        <DataTable
          head={['Parte do dia', 'Começa às']}
          align={[null, 'right']}
          rows={phases.map((phase) => [
            DAY_PHASE_NAMES[phase],
            formatHour(wildSpawn.phaseStarts[phase]),
          ])}
          caption="Cada parte vai até o começo da seguinte."
        />
      </Section>

      <Section id="especies" title="Onde cada espécie aparece">
        <DataTable
          head={['Criatura', 'Biomas', 'Raridade', 'Hora do dia', 'Clima']}
          rows={wild.map((entry) => {
            const text = describeSpeciesSpawn(entry.spawn)
            return [
              <WikiLink
                key={entry.id}
                version={version}
                to={`catalogo/criaturas/${entry.id}`}
              >
                {entry.name}
              </WikiLink>,
              text.biomes,
              text.rarity,
              text.phases,
              text.weather,
            ]
          })}
        />
        {notWild.length > 0 && (
          <Notice tone="missing">
            <p>
              {listNames(notWild.map((entry) => entry.name))} não aparecem na
              natureza nesta versão.
            </p>
          </Notice>
        )}
      </Section>

      <Section id="temperamento" title="Hostis ou pacíficas">
        <p>
          Cada espécie tem a própria chance de nascer hostil e, quando nasce
          pacífica, de fugir ao te perceber (
          <WikiLink version={version} to="selvagens/comportamento#temperamento">
            Comportamento das selvagens
          </WikiLink>
          ).
        </p>
        <DataTable
          head={[
            'Criatura',
            'Chance de ser hostil',
            'Pacífica: chance de fugir',
          ]}
          align={[null, 'right', 'right']}
          rows={wild.map((entry) => [
            <WikiLink
              key={entry.id}
              version={version}
              to={`catalogo/criaturas/${entry.id}`}
            >
              {entry.name}
            </WikiLink>,
            formatPercent(entry.temperament.hostileChance, 0),
            formatPercent(entry.temperament.fleeChance, 0),
          ])}
        />
      </Section>

      <Section id="somem" title="Quando vão embora">
        <p>A distância até você decide se uma selvagem fica ou vai embora:</p>
        <ul>
          <li>
            Até {formatMeters(wildSpawn.nearRadius, 0)}: <strong>nunca</strong>{' '}
            vai embora.
          </li>
          <li>
            Mais longe que {formatMeters(wildSpawn.farRadius, 0)}: vai embora.
          </li>
          <li>
            No meio: só vai embora quem está fora da sua vista e já está há um
            tempo no mundo. A chance começa depois de{' '}
            {formatAge(wildSpawn.minAge)} e, com {formatAge(wildSpawn.maxAge)},
            ela vai embora com certeza. Quem ficou para trás libera a vaga para
            outra aparecer.
          </li>
          <li>
            Uma selvagem dentro de uma Pokébola, sendo capturada, nunca vai
            embora no meio da captura.
          </li>
        </ul>
        <Notice tone="tip">
          <p>
            Fechou o jogo? As selvagens em volta ficam guardadas e voltam onde
            estavam, com o nível, a vida, a energia e o temperamento que tinham.
            Só não volta quem estava dentro de uma Pokébola na hora.
          </p>
        </Notice>
      </Section>

      <Section id="nivel" title="Nível das selvagens">
        <p>
          O nível depende de onde a selvagem aparece. Em volta de Viridian, onde
          a aventura começa, elas ficam perto do nível{' '}
          {wildSpawn.firstCityLevel}, o mais baixo. Quanto mais longe da cidade,
          mais fortes: o nível sobe aos poucos até o teto da versão, que chega a
          uns {wildSpawn.levelCapDistance} metros da borda dela. Cada selvagem
          ainda varia até {wildSpawn.levelSpread} para mais ou para menos.
        </p>
        <p>
          Nenhuma selvagem passa do nível {wildSpawn.levelCap}, o teto desta
          versão (
          <WikiLink version={version} to="criaturas/experiencia-e-nivel">
            Experiência e nível
          </WikiLink>
          ).
        </p>
      </Section>
    </>
  )
}
