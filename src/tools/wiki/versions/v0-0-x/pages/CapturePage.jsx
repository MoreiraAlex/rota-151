import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMultiplier,
  formatNumber,
  formatPercent,
} from '@/tools/wiki/wikiFormat'

function hpLabel(hp) {
  return hp === 0 ? 'Desmaiada' : `${formatPercent(hp, 0)} da vida`
}

export function CapturePage({ data, version }) {
  const { capture } = data
  const { example } = capture

  return (
    <>
      <Section id="mirar" title="Mirar e arremessar">
        <p>
          Com uma Pokébola na mão, o treinador entra no modo{' '}
          <strong>mira</strong>: a câmera chega mais perto, por cima do ombro, e
          ele anda (sem correr) de frente pra onde está mirando. A bola só é
          arremessada mirando, e sai em <strong>arco</strong> até o ponto
          marcado.
        </p>
        <ul>
          <li>
            O retículo fica <strong>vermelho</strong> e trava quando a bola vai
            pegar uma criatura selvagem.
          </li>
          <li>
            Fica <strong>apagado</strong> quando a bola não chega a bater em
            nada (longe demais).
          </li>
          <li>Cada arremesso gasta uma Pokébola, acertando ou não.</li>
          <li>
            Bola que erra quica, rola um pouco e quebra — não dá pra pegar de
            volta.
          </li>
        </ul>
      </Section>

      <Section id="na-bola" title="Dentro da bola">
        <p>
          Acertou, a criatura vira luz e entra na bola, que cai no chão e
          balança até <strong>{capture.shakeCount} vezes</strong>. Cada
          balançada pode falhar: se todas passam, ela foi capturada. Dá pra
          capturar <strong>qualquer selvagem</strong>, a qualquer hora —
          inclusive desmaiada.
        </p>
        <p>
          Enquanto está na bola ela não luta nem é alvo, mas as condições de
          status continuam correndo — e podem fazê-la desmaiar ali dentro.
        </p>
      </Section>

      <Section id="como-funciona" title="Como a captura é decidida">
        <p>
          A captura é decidida em três passos: uma <strong>conta</strong> no
          instante em que a bola acerta, que vira a{' '}
          <strong>chance de cada balançada</strong>, e um{' '}
          <strong>sorteio</strong> em cada balançada.
        </p>
        {example ? <WorkedExample capture={capture} example={example} /> : null}
      </Section>

      <Section id="modificadores" title="Modificadores">
        <p>Tudo o que multiplica o valor da conta:</p>
        <ul>
          <li>
            <strong>A Pokébola</strong> — cada uma tem o seu multiplicador (
            <WikiLink version={version} to="catalogo/itens#pokebolas">
              Itens
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Condições da criatura</strong> — algumas condições de status
            facilitam a captura; cada uma diz o quanto na descrição dela (
            <WikiLink version={version} to="batalha/efeitos">
              Efeitos em batalha
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Pelas costas</strong> —{' '}
            {formatMultiplier(capture.backStrikeBonus)}: acertar uma criatura
            que ainda não percebeu você, vindo de trás dela.
          </li>
        </ul>
      </Section>

      <Section id="exemplos" title="Exemplos">
        <p>
          Chance de capturar uma criatura de taxa {capture.defaultRate}, sem
          nenhum outro modificador além da bola:
        </p>
        <DataTable
          head={['Vida', ...capture.balls.map((ball) => ball.name)]}
          align={[null, ...capture.balls.map(() => 'right')]}
          rows={capture.rows.map((row) => [
            hpLabel(row.hp),
            ...row.chances.map((chance) => formatPercent(chance, 0)),
          ])}
        />
        <p>A taxa de cada espécie:</p>
        <DataTable
          head={['Espécie', 'Taxa de captura']}
          align={[null, 'right']}
          rows={capture.speciesRates.map((entry) => [
            entry.name,
            formatNumber(entry.rate, 0),
          ])}
        />
      </Section>

      <Section id="capturou" title="Capturou">
        <ul>
          <li>
            A criatura vai pro primeiro lugar vazio do time; com o time cheio,
            pro inventário (
            <WikiLink version={version} to="inventario">
              Inventário
            </WikiLink>
            ); com o inventário cheio também, ela fica na bola, no chão.
          </li>
          <li>
            Ela continua do jeito que estava: nível, experiência, golpes, vida e
            condições de status. E fica guardada na bola em que foi capturada.
          </li>
          <li>
            Quem lutou contra ela ganha {formatPercent(capture.xpFraction, 0)}{' '}
            da experiência de derrotá-la (
            <WikiLink version={version} to="criaturas/experiencia-e-nivel">
              Experiência e nível
            </WikiLink>
            ). Capturada desmaiada, não: essa experiência já veio no desmaio.
          </li>
        </ul>
      </Section>

      <Section id="escapou" title="Escapou">
        <ul>
          <li>
            A bola estoura e a criatura sai onde ela estava. Aí ela foge ou
            parte pra cima de você: as hostis partem pra briga{' '}
            {formatPercent(capture.escapeFightHostile, 0)} das vezes, as
            pacíficas {formatPercent(capture.escapeFightPeaceful, 0)} (
            <WikiLink version={version} to="selvagens/comportamento">
              Comportamento
            </WikiLink>
            ).
          </li>
          <li>
            Desmaiada que escapa acorda na hora, com{' '}
            {formatPercent(capture.escapeWakeFraction, 0)} da vida.
          </li>
        </ul>
        <Notice tone="soon">
          <p>Pegar Pokébolas do chão ainda não está no jogo.</p>
        </Notice>
      </Section>
    </>
  )
}

// Sorteios de exemplo (só ilustração): os mesmos números contra duas linhas
// de corte diferentes.
const SAMPLE_ROLLS = [0.31, 0.12, 0.77, 0.65, 0.9]

const fmt = (value, digits = 2) => formatNumber(value, digits)

/** O exemplo resolvido, passo a passo, com os números do jogo. */
function WorkedExample({ capture, example }) {
  const { base, better, maxHp, rate, speciesName, level } = example
  const ratio = base.value / capture.maxRate
  const firstRoot = Math.sqrt(ratio)
  const passes = (roll, chance) => roll < chance

  return (
    <>
      <p>
        Exemplo: um <strong>{speciesName}</strong> selvagem de nível {level},
        com <strong>{fmt(maxHp, 0)} de vida máxima</strong>, de{' '}
        <strong>vida cheia</strong>, e uma <strong>{base.ballName}</strong> (
        {formatMultiplier(base.multiplier)}), sem nenhum outro modificador. A
        taxa de captura da espécie é <strong>{rate}</strong>.
      </p>

      <h3 className="pt-3 text-lg font-semibold">1. O valor</h3>
      <p>Calculado uma vez, quando a bola acerta:</p>
      <Formula>
        <p>
          <strong>valor</strong> = (3 × vida máxima − 2 × vida atual) × taxa ×
          modificadores ÷ (3 × vida máxima)
        </p>
        <p>
          = (3 × {fmt(maxHp, 0)} − 2 × {fmt(base.hp, 0)}) × {rate} ×{' '}
          {fmt(base.multiplier)} ÷ (3 × {fmt(maxHp, 0)})
        </p>
        <p>
          = {fmt(3 * maxHp - 2 * base.hp, 0)} × {rate} × {fmt(base.multiplier)}{' '}
          ÷ {fmt(3 * maxHp, 0)} = <strong>{fmt(base.value)}</strong>
        </p>
      </Formula>
      <ul>
        <li>
          A parte da vida vai de ⅓ (vida cheia) até 1 (sem vida, ou desmaiada):
          quanto mais machucada, maior o valor.
        </li>
        <li>
          Os <strong>modificadores</strong> (abaixo) multiplicam o valor —
          vários juntos se multiplicam entre si.
        </li>
      </ul>

      <h3 className="pt-3 text-lg font-semibold">
        2. A chance de cada balançada
      </h3>
      <Formula>
        <p>
          <strong>chance por balançada</strong> = (valor ÷ {capture.maxRate})
          <sup>¼</sup>
        </p>
        <p>
          = ({fmt(base.value)} ÷ {capture.maxRate})<sup>¼</sup> ={' '}
          {fmt(ratio, 4)}
          <sup>¼</sup> → √{fmt(ratio, 4)} = {fmt(firstRoot, 4)} → √
          {fmt(firstRoot, 4)} = <strong>{fmt(base.shakeChance, 4)}</strong> (
          {formatPercent(base.shakeChance, 1)})
        </p>
      </Formula>
      <p>
        (A raiz quarta é tirar a raiz quadrada duas vezes.) Com valor{' '}
        {capture.maxRate} ou mais, a chance é 100%: a captura é certa.
      </p>

      <h3 className="pt-3 text-lg font-semibold">3. Os sorteios</h3>
      <p>
        A bola cai e balança até <strong>{capture.shakeCount} vezes</strong>. Em
        cada balançada o jogo sorteia um número entre 0 e 1 — todos com a mesma
        chance de sair. A balançada <strong>passa</strong> se o número sair{' '}
        <strong>menor</strong> que a chance do passo 2; se não, a criatura
        escapa na hora. Passando todas, ela foi capturada.
      </p>
      <p>
        O sorteio é sempre o mesmo; o que o valor muda é a{' '}
        <strong>linha de corte</strong>. Pense numa régua de 0 a 1: a parte
        verde é onde o sorteio precisa cair pra passar.
      </p>
      <Ruler label={`${base.ballName}, vida cheia`} chance={base.shakeChance} />
      <Ruler
        label={`${better.ballName}, metade da vida`}
        chance={better.shakeChance}
      />
      <p>Os mesmos sorteios, contra as duas linhas:</p>
      <DataTable
        head={[
          'Sorteio',
          `Linha ${fmt(base.shakeChance)}`,
          `Linha ${fmt(better.shakeChance)}`,
        ]}
        align={['right', null, null]}
        rows={SAMPLE_ROLLS.map((roll) => [
          fmt(roll),
          passes(roll, base.shakeChance) ? 'passa' : 'falha',
          passes(roll, better.shakeChance) ? 'passa' : 'falha',
        ])}
      />

      <h3 className="pt-3 text-lg font-semibold">A chance de capturar</h3>
      <p>
        Como todas as {capture.shakeCount} balançadas precisam passar, a chance
        total é a de uma multiplicada por ela mesma {capture.shakeCount} vezes:
      </p>
      <Formula>
        <p>
          <strong>captura</strong> = chance por balançada
          <sup>{capture.shakeCount}</sup> = {fmt(base.shakeChance, 4)}
          <sup>{capture.shakeCount}</sup> ={' '}
          <strong>{formatPercent(base.total, 1)}</strong>
        </p>
      </Formula>
      <p>
        Ou seja: com a {base.ballName} e a vida cheia, cerca de{' '}
        <strong>{Math.round(base.total * 100)} em 100</strong> tentativas
        capturam. Com a {better.ballName} ({formatMultiplier(better.multiplier)}
        ) e a vida pela metade, o valor vai pra {fmt(better.value)}, a chance
        por balançada pra {formatPercent(better.shakeChance, 1)} e a de capturar
        pra <strong>{formatPercent(better.total, 1)}</strong> — cerca de{' '}
        {Math.round(better.total * 100)} em 100.
      </p>
    </>
  )
}

/** A régua de 0 a 1: verde até a linha de corte (passa), o resto falha. */
function Ruler({ label, chance }) {
  const percent = Math.min(100, Math.max(0, chance * 100))
  return (
    <div className="my-3">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>passa abaixo de {fmt(chance)}</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded border border-border">
        <div
          className="bg-emerald-500/70"
          style={{ width: `${percent}%` }}
          title={`passa: ${formatPercent(chance, 0)}`}
        />
        <div
          className="flex-1 bg-red-500/30"
          title={`falha: ${formatPercent(1 - chance, 0)}`}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>1</span>
      </div>
    </div>
  )
}
