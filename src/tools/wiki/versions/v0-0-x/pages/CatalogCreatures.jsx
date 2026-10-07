import Link from 'next/link'
import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Infobox } from '@/tools/wiki/components/Infobox'
import { SpeciesSprite } from '@/tools/wiki/components/SpeciesSprite'
import { StatBars } from '@/tools/wiki/components/StatBars'
import { TypeTag, TypeTags } from '@/tools/wiki/components/TypeTag'
import { WikiLink, wikiHref } from '@/tools/wiki/components/WikiLink'
import { COMBAT_STAT_KEYS } from '@/tools/wiki/speciesEntry'
import {
  GROWTH_RATE_LABELS,
  AREA_LABELS,
  CATEGORY_LABELS,
  SLOT_LABELS,
  STAT_LABELS,
  formatName,
  formatNumber,
  formatRange,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

function dexLabel(dexNumber) {
  return `Nº ${String(dexNumber ?? '—').padStart(3, '0')}`
}

export function CreatureListPage({ data, version }) {
  return (
    <Section>
      <p>
        As criaturas que existem no jogo nesta versão e os status base de cada
        espécie. Abra uma criatura pra ver os golpes e os números no nível dela.
      </p>
      <DataTable
        head={[
          'Nº',
          '',
          'Criatura',
          'Tipo',
          ...COMBAT_STAT_KEYS.map((key) => STAT_LABELS[key]),
          'Total',
        ]}
        align={[
          'right',
          null,
          null,
          null,
          ...COMBAT_STAT_KEYS.map(() => 'right'),
          'right',
        ]}
        rows={data.species.map((entry) => {
          const bases = COMBAT_STAT_KEYS.map(
            (key) => entry.stats[key]?.base ?? 0,
          )
          return [
            String(entry.dexNumber ?? '—').padStart(3, '0'),
            <SpeciesSprite
              key="sprite"
              src={entry.sprite}
              alt={entry.name}
              size={40}
            />,
            <Link
              key="name"
              href={wikiHref(version, `catalogo/criaturas/${entry.id}`)}
              className="font-medium text-primary hover:underline"
            >
              {entry.name}
            </Link>,
            <TypeTags key="types" data={data} types={entry.types} />,
            ...bases,
            <strong key="total">
              {bases.reduce((sum, value) => sum + value, 0)}
            </strong>,
          ]
        })}
      />
    </Section>
  )
}

function attackDetails(attack) {
  const parts = [AREA_LABELS[attack.area]]
  if (attack.channel) parts.unshift('Canalizado')
  return [...parts, ...attack.effects].join(' · ')
}

export function CreatureDetailPage({ data, version, id }) {
  const entry = data.species.find((species) => species.id === id)
  const seconds = (value) => formatSeconds(value)

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row-reverse md:items-start">
        <Infobox
          title={entry.name}
          subtitle={dexLabel(entry.dexNumber)}
          image={
            <SpeciesSprite src={entry.sprite} alt={entry.name} size={96} />
          }
          rows={[
            ['Tipo', <TypeTags key="types" data={data} types={entry.types} />],
            ['Nível inicial (no time)', entry.level],
            ['XP base', entry.baseXp],
            [
              'Crescimento',
              GROWTH_RATE_LABELS[entry.growthRate] ?? entry.growthRate,
            ],
            ['CP', entry.cp ? formatRange(entry.cp.min, entry.cp.max) : '—'],
            [
              'Energia',
              entry.energy
                ? formatRange(entry.energy.min, entry.energy.max)
                : '—',
            ],
            ['Andar', `${formatNumber(entry.movement.walkSpeed)} m/s`],
            ['Correr', `${formatNumber(entry.movement.runSpeed)} m/s`],
          ]}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <Section id="status" title="Status">
            <StatBars range={entry} />
            <p className="text-sm text-muted-foreground">
              À direita, o status no nível {entry.level}: do IV mais baixo ao
              mais alto (
              <WikiLink version={version} to="criaturas/status">
                como é calculado
              </WikiLink>
              ).
            </p>
          </Section>
        </div>
      </div>

      <Section id="golpes" title="Golpes">
        <DataTable
          head={[
            '',
            'Golpe',
            'Tipo',
            'Categoria',
            'Poder',
            'Energia',
            'Recarga',
            'Duração',
            'Detalhes',
          ]}
          align={[
            null,
            null,
            null,
            null,
            'right',
            'right',
            'right',
            'right',
            null,
          ]}
          rows={entry.attacks.map((attack) => [
            SLOT_LABELS[attack.slot],
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/golpes/${attack.skillId}`}
            >
              {attack.name}
            </WikiLink>,
            <TypeTag key="type" data={data} type={attack.type} />,
            CATEGORY_LABELS[attack.category],
            attack.power ?? '—',
            formatNumber(attack.cost),
            formatRange(attack.cooldown.min, attack.cooldown.max, seconds),
            formatRange(attack.duration.min, attack.duration.max, seconds),
            attackDetails(attack),
          ])}
          caption="Golpes iniciais (todo membro da espécie começa com eles, dominados). Recarga e duração variam com o IV de Velocidade."
        />
        {entry.learnset?.length ? (
          <DataTable
            head={['Pode aprender', 'Condição']}
            rows={entry.learnset.map((move) => [
              <WikiLink
                key="name"
                version={version}
                to={`catalogo/golpes/${move.id}`}
              >
                {formatName(move.id)}
              </WikiLink>,
              learnCondition(move),
            ])}
            caption="Golpes que a criatura pode treinar pra aprender (Golpes e treino)."
          />
        ) : null}
      </Section>

      <Section id="vida-e-energia" title="Vida e energia">
        <DataTable
          head={['', 'Máximo', 'Volta por segundo', 'Espera']}
          align={[null, 'right', 'right', 'right']}
          rows={[
            [
              'Vida',
              formatRange(entry.stats.hp.min, entry.stats.hp.max),
              entry.hpRegen.regenPercent === null
                ? '—'
                : `${formatNumber(entry.hpRegen.regenPercent)}%`,
              entry.hpRegen.regenDelay === null
                ? '—'
                : formatSeconds(entry.hpRegen.regenDelay, 1),
            ],
            [
              'Energia',
              entry.energy
                ? formatRange(entry.energy.min, entry.energy.max)
                : '—',
              entry.energy?.regenPercent == null
                ? '—'
                : `${formatNumber(entry.energy.regenPercent)}%`,
              entry.energy?.regenDelay == null
                ? '—'
                : formatSeconds(entry.energy.regenDelay, 1),
            ],
          ]}
        />
        <DataTable
          head={['Correr (por segundo)', 'Dash', 'Pulo']}
          align={['right', 'right', 'right']}
          rows={[
            [
              formatNumber(entry.movement.runStaminaDrainPerSecond),
              formatNumber(entry.movement.dashStaminaCost),
              formatNumber(entry.movement.jumpStaminaCost),
            ],
          ]}
          caption="Energia gasta com movimento, com a vida cheia."
        />
      </Section>
    </>
  )
}

function learnCondition(move) {
  const parts = []
  if (move.level !== null) parts.push(`nível ${move.level}`)
  if (move.otherCondition) parts.push('outra condição (em breve)')
  return parts.length ? parts.join(' + ') : 'sem condição'
}
