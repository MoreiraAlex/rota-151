import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  STAT_LABELS,
  formatMultiplier,
  formatNumber,
  formatRange,
} from '@/tools/wiki/wikiFormat'

export function StatusPage({ data, version }) {
  const { battle, experience, ivExample, species } = data

  return (
    <>
      <Section id="os-status" title="Os status">
        <p>Toda criatura tem seis status:</p>
        <ul>
          <li>
            <strong>Vida</strong> — quanto dano aguenta antes de desmaiar.
          </li>
          <li>
            <strong>Ataque</strong> e <strong>Defesa</strong> — usados nos
            golpes físicos.
          </li>
          <li>
            <strong>Ataque especial</strong> e <strong>Defesa especial</strong>{' '}
            — usados nos golpes especiais.
          </li>
          <li>
            <strong>Velocidade</strong> — deixa os golpes mais rápidos (veja
            abaixo).
          </li>
        </ul>
        <p>
          Desses seis saem mais dois: a <strong>Energia</strong>, que paga
          golpes e movimento, e o <strong>CP</strong>, um número que resume o
          poder da criatura.
        </p>
      </Section>

      <Section id="de-onde-vem" title="De onde vêm os números">
        <p>Cada status depende de três coisas:</p>
        <ul>
          <li>
            <strong>Status base</strong> — igual pra todas as criaturas da mesma
            espécie. É o que mostra o quanto a espécie é forte em cada status
            (veja no{' '}
            <WikiLink version={version} to="catalogo/criaturas">
              catálogo de criaturas
            </WikiLink>
            ).
          </li>
          <li>
            <strong>IV (valor individual)</strong> — sorteado pra cada criatura,
            de {battle.ivMin} a {battle.ivMax}, um por status. É por isso que
            duas criaturas da mesma espécie e do mesmo nível podem ter status
            diferentes. O IV nunca muda depois de sorteado.
          </li>
          <li>
            <strong>Nível</strong> — quanto maior, maiores todos os status. Cada
            criatura tem o próprio nível e sobe ganhando experiência (
            <WikiLink version={version} to="criaturas/experiencia-e-nivel">
              Experiência e nível
            </WikiLink>
            ).
          </li>
        </ul>
        <Formula>
          <p>
            <strong>Vida</strong> = (2 × base + IV) × N ÷ 100 + N + 10
          </p>
          <p>
            <strong>Outros status</strong> = (2 × base + IV) × N ÷ 100 + 5
          </p>
          <p>
            <strong>Energia</strong> = média de Vida, Defesa e Defesa especial +
            10
          </p>
          <p className="text-muted-foreground">
            N é o{' '}
            <WikiLink
              version={version}
              to="criaturas/experiencia-e-nivel#nivel-de-calculo"
            >
              nível de cálculo
            </WikiLink>{' '}
            (o nível × {formatNumber(experience.formulaScale)}). As divisões
            descartam as casas decimais.
          </p>
        </Formula>
        <p>
          O <strong>CP</strong> junta a soma dos status com a soma dos IVs:
          criaturas com IV alto têm CP bem maior, mesmo no mesmo nível.
        </p>
        <Notice tone="missing">
          <p>Tipos, natureza e treino de status ainda não existem.</p>
        </Notice>
      </Section>

      {ivExample ? (
        <Section id="iv" title="Quanto o IV pesa">
          <p>
            A mesma criatura com o IV mais baixo, no meio e o mais alto em todos
            os status:
          </p>
          <DataTable
            head={['Status', ...ivExample.columns.map((iv) => `IV ${iv}`)]}
            align={[null, ...ivExample.columns.map(() => 'right')]}
            rows={ivExample.rows.map((row) => [
              STAT_LABELS[row.stat],
              ...row.values.map((value) => value ?? '—'),
            ])}
            caption={`${ivExample.speciesName}, nível ${ivExample.level}.`}
          />
        </Section>
      ) : null}

      <Section id="velocidade" title="Velocidade">
        <p>
          A Velocidade não muda o dano. Ela muda o <strong>tempo</strong>:
          criaturas rápidas fazem os golpes mais depressa e esperam menos pra
          usar de novo. Criaturas lentas, o contrário.
        </p>
        <p>
          O efeito é suave e tem limite: o tempo fica entre{' '}
          {formatMultiplier(battle.speedFactorMin)} e{' '}
          {formatMultiplier(battle.speedFactorMax)} do normal.
        </p>
        <DataTable
          head={['Criatura', 'Velocidade', 'Tempo dos golpes']}
          align={[null, 'right', 'right']}
          rows={species.map((entry) => [
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/criaturas/${entry.id}`}
            >
              {entry.name}
            </WikiLink>,
            formatRange(entry.stats.speed.min, entry.stats.speed.max),
            formatRange(
              entry.speedFactor.fast,
              entry.speedFactor.slow,
              formatMultiplier,
            ),
          ])}
          caption="Os valores variam com o IV de Velocidade de cada criatura. Tempo menor que ×1 = golpes mais rápidos."
        />
      </Section>
    </>
  )
}
