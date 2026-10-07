import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { TypeTags } from '@/tools/wiki/components/TypeTag'
import {
  formatMultiplier,
  formatPercent,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

export function EffectsPage({ data, version }) {
  const { stages, burn } = data

  return (
    <>
      <Section id="atributos" title="Subir e baixar atributos">
        <p>
          Golpes de status podem subir ou baixar o <strong>Ataque</strong>, a{' '}
          <strong>Defesa</strong>, o <strong>Ataque especial</strong>, a{' '}
          <strong>Defesa especial</strong> ou a <strong>Precisão</strong> de uma
          criatura, em níveis de −{stages.limit} a +{stages.limit}. Cada nível
          multiplica o atributo:
        </p>
        <DataTable
          head={['Nível', 'Ataque, Defesa e especiais', 'Precisão']}
          align={['right', 'right', 'right']}
          rows={stages.rows.map((row) => [
            row.stage > 0 ? `+${row.stage}` : row.stage,
            formatMultiplier(row.stat),
            formatMultiplier(row.accuracy),
          ])}
        />
        <ul>
          <li>
            <strong>Acumula</strong>: usar o mesmo efeito de novo soma mais um
            nível (até o limite).
          </li>
          <li>
            <strong>Dura um tempo</strong>: cada efeito tem a própria duração, e
            usar de novo renova o tempo — mesmo já no limite.
          </li>
          <li>
            Ataque, Defesa e especiais mudam o{' '}
            <WikiLink version={version} to="batalha/dano">
              dano
            </WikiLink>
            ; a Precisão muda a{' '}
            <WikiLink version={version} to="batalha/acerto-e-erro">
              chance de acertar
            </WikiLink>
            .
          </li>
        </ul>
      </Section>

      <Section id="roubo-de-vida" title="Roubo de vida">
        <p>
          Alguns golpes deixam um efeito que <strong>rouba vida</strong> do alvo
          aos poucos: de tempos em tempos, tiram uma parte da vida máxima dele e
          curam quem usou o golpe no mesmo valor, até o efeito acabar. Usar de
          novo renova a duração.
        </p>
      </Section>

      {burn ? (
        <Section id="queimadura" title="Queimadura">
          <p>
            Alguns golpes de fogo têm{' '}
            <strong>{formatPercent(burn.chance, 0)} de chance</strong> de deixar
            o alvo <strong>queimado</strong> — a chance é sorteada uma vez por
            golpe que acerta (num golpe canalizado, uma vez por alvo).
          </p>
          <ul>
            <li>
              A cada {formatSeconds(burn.interval, 0)}, a queimadura tira{' '}
              {formatPercent(burn.fraction, 2)} da vida máxima, por{' '}
              {formatSeconds(burn.duration, 0)}. Queimar de novo renova o tempo.
            </li>
            <li>
              Enquanto queima, o Ataque da criatura nos golpes{' '}
              <strong>físicos</strong> cai pra{' '}
              {formatPercent(burn.attackMultiplier, 0)} (
              <WikiLink version={version} to="batalha/dano">
                Dano
              </WikiLink>
              ). Golpes especiais não mudam.
            </li>
            {burn.immuneTypes.length ? (
              <li>
                Não queima: <TypeTags data={data} types={burn.immuneTypes} />.
              </li>
            ) : null}
            <li>
              A criatura queimada solta fogo e ganha o selo{' '}
              <strong>Queimado</strong>; a queimadura acaba se ela desmaiar.
            </li>
          </ul>
        </Section>
      ) : null}
    </>
  )
}
