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
      </Section>

      <Section id="alcance" title="Alcance e raio">
        <p>Todo golpe tem duas medidas:</p>
        <ul>
          <li>
            <strong>Alcance</strong> — até onde o golpe vai, a partir de quem
            ataca. Ele acompanha rampas, mas para antes se bater numa parede ou
            num desnível.
          </li>
          <li>
            <strong>Raio</strong> — a “grossura” do golpe ao longo de todo o
            caminho.
          </li>
        </ul>
        <p>
          O golpe acerta quando encosta no corpo do alvo. Criaturas maiores têm
          corpo maior, então são mais fáceis de acertar.
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
          caption="Medidas padrão de cada golpe. Uma espécie pode usar um golpe com medidas diferentes — veja a página da criatura."
        />
      </Section>
    </>
  )
}
