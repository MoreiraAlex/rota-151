import { Section } from '@/tools/wiki/components/Article'
import { DamageCalculator } from '@/tools/wiki/components/DamageCalculator'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'

export function CalculatorPage({ version, isLatest }) {
  if (!isLatest) {
    return (
      <Notice tone="tip" title="Só na versão atual">
        <p>
          A calculadora usa as regras do jogo de hoje. Pra calcular, escolha a
          versão atual na caixa do topo.
        </p>
      </Notice>
    )
  }

  return (
    <Section>
      <p>
        Escolha quem ataca, quem apanha e o golpe. A conta é a mesma do jogo, só
        que sem sorteio: você vê o menor e o maior dano possível.
      </p>
      <DamageCalculator />
      <Notice tone="tip">
        <p>
          O IV vale pra todos os status do lado escolhido. Os níveis de efeito
          são os de golpes de status ativos naquele momento (
          <WikiLink version={version} to="batalha/efeitos">
            Efeitos em batalha
          </WikiLink>
          ).
        </p>
      </Notice>
    </Section>
  )
}
