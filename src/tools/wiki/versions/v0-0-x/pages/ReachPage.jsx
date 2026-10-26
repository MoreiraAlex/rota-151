import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { AREA_LABELS, formatMeters } from '@/tools/wiki/wikiFormat'

export function ReachPage({ data, version }) {
  const { battle, skills } = data

  return (
    <>
      <Section id="no-chao" title="O combate acontece no chão">
        <p>
          O mundo é 3D, mas as distâncias da luta são medidas{' '}
          <strong>no chão</strong>. A altura só importa pra saber se dois corpos
          estão no mesmo plano: quem está mais de{' '}
          {formatMeters(battle.maxCombatHeight, 1)} acima ou abaixo do outro
          (pulando alto, por exemplo) não é acertado.
        </p>
        <p>
          A exceção é quem está{' '}
          <WikiLink version={version} to="criaturas/seu-time">
            voando
          </WikiLink>
          : contra ele vale a distância de verdade, no ar. O golpe acerta se
          passar na altura do corpo dele.
        </p>
      </Section>

      <Section id="alcance" title="Alcance e raio">
        <p>Todo golpe tem duas medidas:</p>
        <ul>
          <li>
            <strong>Alcance</strong> — até onde o golpe vai, contado a partir da{' '}
            <strong>frente do corpo</strong> de quem ataca. Ele acompanha
            rampas, mas para antes se bater numa parede ou num desnível.
          </li>
          <li>
            <strong>Raio</strong> — a “grossura” do golpe ao longo de todo o
            caminho.
          </li>
        </ul>
        <p>
          A área do golpe começa na frente do corpo de quem ataca e vai até o
          alcance. Como o alcance conta dessa borda, ele é o mesmo pra criaturas
          grandes e pequenas: uma criatura grande alcança mais longe só porque o
          corpo dela já ocupa mais espaço.
        </p>
        <p>
          O golpe acerta quando a área encosta no corpo do alvo. Criaturas
          maiores têm corpo maior, então são mais fáceis de acertar.
        </p>
        <p>
          Cada golpe sai de uma parte do corpo de quem ataca (a boca, a cauda, a
          frente do corpo...), e é dali que o visual parte. Isso não muda até
          onde ele vai.
        </p>
      </Section>

      <Section id="areas" title="Formas de área">
        <ul>
          <li>
            <strong>Alvo único</strong> — acerta o primeiro corpo no caminho.
          </li>
          <li>
            <strong>Cone</strong> — acerta todos os inimigos dentro de um leque
            à frente.
          </li>
          <li>
            <strong>Em volta</strong> — acerta todos os inimigos num círculo em
            volta de quem usa, sem precisar mirar.
          </li>
          <li>
            <strong>Feixe</strong> — usado por golpes canalizados: uma linha que
            acerta o primeiro corpo e acompanha a sua mira.
          </li>
          <li>
            <strong>Em si mesmo</strong> — não mira em ninguém, age em quem
            usou.
          </li>
        </ul>
      </Section>

      <Section id="golpes" title="Área de cada golpe">
        <DataTable
          head={['Golpe', 'Área', 'Alcance', 'Raio']}
          align={[null, null, 'right', 'right']}
          rows={skills.map((skill) => [
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/golpes/${skill.id}`}
            >
              {skill.name}
            </WikiLink>,
            AREA_LABELS[skill.area],
            skill.area === 'self' ? '—' : formatMeters(skill.range, 1),
            formatMeters(skill.radius, 2),
          ])}
          caption="O alcance e o raio vêm do jeito do golpe (corpo a corpo, à distância, em área ou em si mesmo) e são iguais pra todas as espécies."
        />
      </Section>
    </>
  )
}
