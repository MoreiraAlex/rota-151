import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { GROWTH_RATE_LABELS, formatNumber } from '@/tools/wiki/wikiFormat'

export function ExperiencePage({ data, version }) {
  const { experience } = data
  const { example } = experience

  return (
    <>
      <Section id="nivel" title="Nível">
        <p>
          Cada criatura tem o <strong>próprio nível</strong>: duas criaturas da
          mesma espécie podem estar em níveis diferentes. O nível vai até{' '}
          <strong>{experience.maxLevel}</strong> e sobe com{' '}
          <strong>experiência (XP)</strong>, ganha derrotando criaturas
          selvagens.
        </p>
        <ul>
          <li>
            As criaturas do time começam no nível inicial da espécie (no{' '}
            <WikiLink version={version} to="catalogo/criaturas">
              catálogo
            </WikiLink>
            ) e guardam o nível e o XP mesmo dentro da bola.
          </li>
          <li>
            As selvagens nascem com um nível sorteado, hoje entre{' '}
            {experience.wildLevelMin} e {experience.wildLevelMax}.
          </li>
        </ul>
      </Section>

      <Section id="quem-ganha" title="Quem ganha XP">
        <p>Quando uma selvagem desmaia, ganham XP as criaturas do time que:</p>
        <ul>
          <li>
            causaram dano nela durante a luta — com golpe, golpe contínuo ou
            roubo de vida;
          </li>
          <li>
            não estão desmaiadas nesse momento (pode estar em campo ou já dentro
            da bola).
          </li>
        </ul>
        <p>
          Se mais de uma criatura lutou, o XP é <strong>dividido</strong> entre
          elas.
        </p>
      </Section>

      <Section id="quanto" title="Quanto XP">
        <p>
          Cada espécie tem um <strong>XP base</strong> (no catálogo). O ganho
          depende dele, do nível de quem foi derrotada e do nível de quem ganha:
        </p>
        <Formula>
          <p>
            <strong>XP</strong> = (XP base × nível dela ÷{' '}
            {formatNumber(experience.baseDivisor)} ÷ quantas lutaram) × fator de
            nível + 1
          </p>
          <p>
            <strong>Fator de nível</strong> = ((2 × nível dela + 10) ÷ (nível
            dela + seu nível + 10)) elevado a{' '}
            {formatNumber(experience.scalingExponent)}
          </p>
          <p className="text-muted-foreground">
            O resultado descarta as casas decimais.
          </p>
        </Formula>
        <p>
          O fator de nível premia enfrentar quem é mais forte: vencer uma
          selvagem de nível maior que o seu rende mais, e vencer uma mais fraca
          rende cada vez menos.
        </p>
        {example ? (
          <DataTable
            head={[
              'Sua criatura',
              'Derrotada',
              'Lutaram',
              'XP ganho',
              'Vitórias pra subir 1 nível',
            ]}
            align={[null, null, 'right', 'right', 'right']}
            rows={example.duels.map((duel) => [
              `Nível ${duel.winner}`,
              `${example.speciesName} nível ${duel.defeated}`,
              duel.participants,
              duel.gain,
              duel.winsToLevel === null
                ? '—'
                : formatNumber(duel.winsToLevel, 1),
            ])}
            caption={`Exemplos: ${example.speciesName} tem XP base ${example.baseXp}; as vitórias são pra uma criatura do grupo ${GROWTH_RATE_LABELS[example.growthRate] ?? example.growthRate}.`}
          />
        ) : null}
      </Section>

      <Section id="curva" title="Quanto XP cada nível pede">
        <p>
          Cada espécie tem um <strong>grupo de crescimento</strong> que diz
          quanto XP total ela precisa ter pra chegar em cada nível. O XP só
          soma: subir de nível não zera nada. Os primeiros níveis vêm rápido; os
          últimos pedem muito mais.
        </p>
        <DataTable
          head={[
            'Grupo',
            ...experience.growthLevels.map((level) => `Nível ${level}`),
          ]}
          align={[null, ...experience.growthLevels.map(() => 'right')]}
          rows={experience.growthRows.map((row) => [
            GROWTH_RATE_LABELS[row.rate] ?? row.rate,
            ...row.totals.map((total) => formatNumber(total, 0)),
          ])}
          caption="XP total pra estar em cada nível."
        />
      </Section>

      <Section id="subindo" title="Ao subir de nível">
        <ul>
          <li>
            Todos os{' '}
            <WikiLink version={version} to="criaturas/status">
              status
            </WikiLink>{' '}
            são recalculados pro nível novo.
          </li>
          <li>
            A vida e a energia atuais sobem o mesmo tanto que a vida e a energia
            máximas subiram — subir de nível não enche a barra, mas também não
            deixa ninguém pra trás.
          </li>
          <li>Uma criatura desmaiada não acorda por subir de nível.</li>
          <li>Dá pra subir mais de um nível de uma vez.</li>
          <li>
            Golpes que pedem o nível novo ficam <strong>aptos</strong> — a
            criatura avisa, mas ainda precisa treinar pra aprender (
            <WikiLink version={version} to="criaturas/golpes-e-treino">
              Golpes e treino
            </WikiLink>
            ).
          </li>
        </ul>
      </Section>

      <Section id="nivel-de-calculo" title="Nível de cálculo">
        <p>
          As contas de status, dano e energia vêm dos jogos clássicos, feitos
          pra um nível máximo de {experience.formulaMaxLevel}. Pra elas
          continuarem equilibradas com o máximo de {experience.maxLevel}, elas
          usam o <strong>nível de cálculo</strong>:
        </p>
        <Formula>
          <p>
            <strong>Nível de cálculo</strong> = nível ×{' '}
            {experience.formulaMaxLevel} ÷ {experience.maxLevel}
          </p>
        </Formula>
        <p>
          Ou seja, cada nível conta como {formatNumber(experience.formulaScale)}{' '}
          nas contas, e uma criatura no nível {experience.maxLevel} tem os
          status de uma nível {experience.formulaMaxLevel} dos jogos clássicos.
          O nível que aparece no jogo e o XP continuam no nível normal.
        </p>
      </Section>

      <Notice tone="missing">
        <p>Evolução e itens de experiência ainda não existem.</p>
      </Notice>
    </>
  )
}
