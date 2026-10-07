import Link from 'next/link'
import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Infobox } from '@/tools/wiki/components/Infobox'
import { TypeTag, TypeTags } from '@/tools/wiki/components/TypeTag'
import { WikiLink, wikiHref } from '@/tools/wiki/components/WikiLink'
import {
  AREA_LABELS,
  CATEGORY_LABELS,
  SLOT_LABELS,
  formatMeters,
  formatNumber,
  formatRange,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

function formatAccuracy(skill) {
  if (skill.area === 'self' || skill.channel) return 'não erra'
  return skill.accuracy === null ? 'nunca erra' : `${skill.accuracy}%`
}

function formatArea(skill) {
  return `${AREA_LABELS[skill.area]}${skill.channel ? ' (canalizado)' : ''}`
}

export function MoveListPage({ data, version }) {
  return (
    <Section>
      <p>Os golpes que as criaturas podem usar nesta versão.</p>
      <DataTable
        head={[
          'Golpe',
          'Tipo',
          'Categoria',
          'Poder',
          'Precisão',
          'Área',
          'Alcance',
          'Efeitos',
        ]}
        align={[null, null, null, 'right', 'right', null, 'right', null]}
        rows={data.skills.map((skill) => [
          <Link
            key="name"
            href={wikiHref(version, `catalogo/golpes/${skill.id}`)}
            className="font-medium text-primary hover:underline"
          >
            {skill.name}
          </Link>,
          <TypeTag key="type" data={data} type={skill.type} />,
          CATEGORY_LABELS[skill.category],
          skill.power ?? '—',
          formatAccuracy(skill),
          formatArea(skill),
          skill.area === 'self' ? '—' : formatMeters(skill.range, 1),
          skill.effects.join('; ') || '—',
        ])}
      />
    </Section>
  )
}

export function MoveDetailPage({ data, version, id }) {
  const skill = data.skills.find((entry) => entry.id === id)
  const seconds = (value) => formatSeconds(value)

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row-reverse md:items-start">
        <Infobox
          title={skill.name}
          subtitle={CATEGORY_LABELS[skill.category]}
          rows={[
            ['Tipo', <TypeTag key="type" data={data} type={skill.type} />],
            ['Poder', skill.power ?? '—'],
            ['Precisão', formatAccuracy(skill)],
            ['Área', formatArea(skill)],
            [
              'Alcance',
              skill.area === 'self' ? '—' : formatMeters(skill.range, 1),
            ],
            ['Raio', formatMeters(skill.radius, 2)],
            ['Duração', formatSeconds(skill.duration, 2)],
            ['Peso', formatNumber(skill.weight, 1)],
            ['Treino pra aprender', formatHours(skill.trainingHours.learn)],
            ['Treino pra dominar', formatHours(skill.trainingHours.mastery)],
          ]}
        />
        <div className="min-w-0 flex-1">
          <Section id="como-funciona" title="Como funciona">
            <ul>
              <li>
                {skill.category === 'status'
                  ? 'Não causa dano.'
                  : skill.category === 'special'
                    ? 'Golpe especial: usa Ataque especial contra Defesa especial.'
                    : 'Golpe físico: usa Ataque contra Defesa.'}
              </li>
              {skill.channel ? (
                <li>
                  Canalizado: o dano vem em {skill.channel.ticks} partes
                  enquanto o golpe é mantido (
                  <WikiLink version={version} to="batalha/golpes#canalizados">
                    como funciona
                  </WikiLink>
                  ).
                </li>
              ) : null}
              {skill.effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
              {skill.category !== 'status' ? (
                <li>
                  Golpe do tipo <TypeTag data={data} type={skill.type} />: vale
                  mais usado por uma criatura do mesmo tipo, e o dano muda
                  conforme os tipos do alvo (
                  <WikiLink version={version} to="batalha/tipos">
                    Tipos
                  </WikiLink>
                  ).
                </li>
              ) : null}
              {skill.immuneTypes.length ? (
                <li>
                  Não pega em:{' '}
                  <TypeTags data={data} types={skill.immuneTypes} />.
                </li>
              ) : null}
              <li>
                Acontece {formatSeconds(skill.effectAt, 2)} depois de lançado
                {skill.category === 'status'
                  ? '; até lá, tomar dano interrompe o golpe'
                  : ''}
                .
              </li>
            </ul>
          </Section>
        </div>
      </div>

      <Section id="quem-usa" title="Quem usa">
        {skill.users.length === 0 ? (
          <p>Nenhuma criatura usa este golpe nesta versão.</p>
        ) : (
          <DataTable
            head={[
              'Criatura',
              'Como',
              'Nível',
              'Energia',
              'Recarga',
              'Duração',
            ]}
            align={[null, null, 'right', 'right', 'right', 'right']}
            rows={skill.users.map((user) => [
              <WikiLink
                key="name"
                version={version}
                to={`catalogo/criaturas/${user.speciesId}`}
              >
                {user.speciesName}
              </WikiLink>,
              user.slot ? SLOT_LABELS[user.slot] : 'Conhece, mas não usa',
              user.level,
              user.slot ? formatNumber(user.cost) : '—',
              user.slot
                ? formatRange(user.cooldown.min, user.cooldown.max, seconds)
                : '—',
              user.slot
                ? formatRange(user.duration.min, user.duration.max, seconds)
                : '—',
            ])}
            caption="Recarga varia com o IV de Velocidade de cada criatura."
          />
        )}
      </Section>
    </>
  )
}

function formatHours(hours) {
  return `${formatNumber(hours, 1)} h`
}
