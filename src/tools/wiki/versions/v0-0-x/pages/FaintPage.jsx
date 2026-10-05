import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { formatPercent, formatSeconds } from '@/tools/wiki/wikiFormat'

export function FaintPage({ data, version }) {
  const { faint } = data

  return (
    <>
      <Section id="desmaio" title="Quando a vida zera">
        <p>
          Uma criatura — selvagem ou do time — que chega a 0 de vida{' '}
          <strong>desmaia</strong>:
        </p>
        <ul>
          <li>Fica caída e não pode ser acertada.</li>
          <li>Não se recupera enquanto estiver desmaiada.</li>
          <li>
            Acorda depois de <strong>{faint.minutes} minutos</strong>, com{' '}
            {formatPercent(faint.reviveFraction, 0)} da vida máxima.
          </li>
        </ul>
      </Section>

      <Section id="time" title="Criaturas do time">
        <ul>
          <li>
            Desmaiada em campo, ela volta pra bola sozinha depois de{' '}
            {formatSeconds(faint.recallDelay, 1)}.
          </li>
          <li>O tempo pra acordar continua contando dentro da bola.</li>
          <li>
            Enquanto não acordar, ela não pode ser invocada (
            <WikiLink version={version} to="criaturas/seu-time">
              Seu time
            </WikiLink>
            ).
          </li>
        </ul>
        <Notice tone="soon">
          <p>
            O que acontece quando o treinador fica sem vida vai entrar aqui
            quando estiver definido.
          </p>
        </Notice>
      </Section>
    </>
  )
}
