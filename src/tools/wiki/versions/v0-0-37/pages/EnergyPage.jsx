import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMeters,
  formatNumber,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

export function EnergyPage({ data, version }) {
  const { cost, dash, skills } = data

  return (
    <>
      <Section id="energia" title="Energia">
        <p>
          A energia é o fôlego da criatura: golpes, corrida, dash e pulo gastam
          energia, e ela volta sozinha depois de um tempo sem gastar (
          <WikiLink version={version} to="criaturas/vida-e-energia">
            Vida e energia
          </WikiLink>
          ). Sem energia suficiente, o golpe não sai, e a criatura anda em vez
          de correr.
        </p>
      </Section>

      <Section id="peso" title="Peso do golpe">
        <p>
          Quanto um golpe custa e quanto tempo demora pra voltar dependem do{' '}
          <strong>peso</strong> dele — uma medida de quão forte e vantajoso ele
          é:
        </p>
        <Formula>
          <p>
            <strong>Peso</strong> = poder + valor dos efeitos
          </p>
          <p>
            × {formatNumber(cost.coneBonus)} se pega uma área em cone (pode
            acertar mais de um)
          </p>
          <p>
            × {formatNumber(cost.rangedBonus)} se alcança{' '}
            {formatMeters(cost.rangedMinRange, 0)} ou mais (atacar de longe é
            mais seguro)
          </p>
          <p className="text-muted-foreground">
            Cada nível de atributo que o golpe sobe ou baixa vale{' '}
            {formatNumber(cost.stageWeight)}; roubar vida vale{' '}
            {formatNumber(cost.drainWeight)}.
          </p>
        </Formula>
        <p>O peso só define o preço: não muda o dano.</p>
      </Section>

      <Section id="custo" title="Custo e recarga">
        <Formula>
          <p>
            <strong>Custo de energia</strong> = (N × 2 ÷ 5 + 2) × peso ÷{' '}
            {formatNumber(cost.divisor)}
          </p>
          <p className="text-muted-foreground">
            N é o{' '}
            <WikiLink
              version={version}
              to="criaturas/experiencia-e-nivel#nivel-de-calculo"
            >
              nível de cálculo
            </WikiLink>{' '}
            de quem usa. Na tabela abaixo, o nível é o normal.
          </p>
          <p>
            <strong>Recarga</strong> = peso ×{' '}
            {formatSeconds(cost.cooldownPerWeight, 3)} × tempo da criatura
          </p>
        </Formula>
        <ul>
          <li>
            O custo cresce com o nível, mas a energia máxima também — a
            proporção se mantém.
          </li>
          <li>
            O “tempo da criatura” vem da{' '}
            <WikiLink version={version} to="criaturas/status#velocidade">
              Velocidade
            </WikiLink>
            : criaturas rápidas recarregam mais depressa.
          </li>
          <li>A recarga começa a contar quando o golpe termina.</li>
          <li>O ataque básico não tem recarga.</li>
        </ul>
        <DataTable
          head={[
            'Golpe',
            'Peso',
            'Recarga',
            ...cost.exampleLevels.map((level) => `Custo nv. ${level}`),
          ]}
          align={[
            null,
            'right',
            'right',
            ...cost.exampleLevels.map(() => 'right'),
          ]}
          rows={skills.map((skill) => [
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/golpes/${skill.id}`}
            >
              {skill.name}
            </WikiLink>,
            formatNumber(skill.weight, 1),
            formatSeconds(skill.baseCooldown, 1),
            ...skill.costByLevel.map((entry) => formatNumber(entry.cost, 1)),
          ])}
          caption="Recarga de uma criatura de velocidade média. Os níveis são só exemplos; o custo de cada criatura está na página dela."
        />
      </Section>

      <Section id="movimento" title="Correr, dash e pulo">
        <p>
          Movimento também custa energia, pela mesma conta, com peso{' '}
          {formatNumber(cost.runWeight)} por segundo de corrida,{' '}
          {formatNumber(cost.dashWeight)} por dash e{' '}
          {formatNumber(cost.jumpWeight)} por pulo. Com a vida baixa, correr e
          dar dash custam mais (
          <WikiLink version={version} to="criaturas/vida-e-energia#vida-baixa">
            Vida baixa
          </WikiLink>
          ).
        </p>
        <p>
          O <strong>dash</strong> é um impulso rápido de{' '}
          {formatSeconds(dash.duration, 1)}, igual pra todos, que só pode ser
          usado de novo depois de {formatSeconds(dash.cooldown, 1)}.
        </p>
      </Section>
    </>
  )
}
