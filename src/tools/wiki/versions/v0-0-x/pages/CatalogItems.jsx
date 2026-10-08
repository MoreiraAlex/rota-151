import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { SpeciesSprite } from '@/tools/wiki/components/SpeciesSprite'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { formatNumber, formatSeconds } from '@/tools/wiki/wikiFormat'

function ItemName({ item }) {
  return (
    <span className="flex items-center gap-2 font-medium">
      <SpeciesSprite src={item.sprite} alt="" size={24} />
      {item.name}
    </span>
  )
}

function itemsOf(data, category) {
  return data.items.filter((item) => item.category === category)
}

export function ItemsPage({ data, version }) {
  const balls = itemsOf(data, 'pokeball')
  const potions = itemsOf(data, 'consumable')
  const berries = itemsOf(data, 'berry')

  return (
    <>
      <Section id="como-usar" title="Como usar">
        <p>
          Os itens ficam no{' '}
          <WikiLink version={version} to="inventario">
            inventário
          </WikiLink>
          . Pra usar um item no treinador, coloque ele <strong>na mão</strong> e
          use. Pra usar numa criatura do time, abra o{' '}
          <WikiLink version={version} to="criaturas/seu-time#menu-de-acoes">
            menu de ações
          </WikiLink>{' '}
          dela e escolha o item na aba <strong>Itens</strong>.
        </p>
        <ul>
          <li>
            Só dá pra usar item numa criatura que está <strong>em campo</strong>{' '}
            e acordada — na bola ou desmaiada, não.
          </li>
          <li>Com a vida cheia o item não é usado, pra não ser gasto à toa.</li>
          <li>
            Criaturas não seguram itens: quem usa é sempre o treinador, nele
            mesmo ou numa criatura.
          </li>
        </ul>
      </Section>

      <Section id="pokebolas" title="Pokébolas">
        <p>
          As Pokébolas servem pra capturar criaturas selvagens. Quanto maior a
          chance de captura, mais fácil a criatura fica na bola.
        </p>
        <p>
          Como mirar, arremessar e a chance de cada bola:{' '}
          <WikiLink version={version} to="selvagens/captura">
            Captura
          </WikiLink>
          . Cada criatura aparece no inventário e no time com a Pokébola em que
          foi capturada — as iniciais, com a Poké Bola — e sai e volta nela.
        </p>
        <DataTable
          head={['Pokébola', 'Chance de captura', 'Descrição']}
          align={[null, 'right', null]}
          rows={balls.map((item) => [
            <ItemName key="name" item={item} />,
            `×${formatNumber(item.captureMultiplier)}`,
            item.description ?? '—',
          ])}
        />
      </Section>

      <Section id="pocoes" title="Poções">
        <p>
          A poção cura <strong>na hora</strong>: o treinador, com ela na mão, ou
          a criatura em campo, pelo menu de ações. Poção não reanima criatura
          desmaiada.
        </p>
        <DataTable
          head={['Poção', 'Cura', 'Descrição']}
          align={[null, 'right', null]}
          rows={potions.map((item) => [
            <ItemName key="name" item={item} />,
            `${formatNumber(item.heal, 0)} de vida`,
            item.description ?? '—',
          ])}
        />
      </Section>

      <Section id="frutas" title="Frutas">
        <p>
          A fruta cura <strong>aos poucos, enquanto é comida</strong>. O
          treinador come a fruta da mão; a criatura em campo come a que o
          treinador der pelo menu de ações.
        </p>
        <ul>
          <li>
            Enquanto come, quem come <strong>fica parado</strong>: não anda, não
            ataca, não pula, não usa outro item e não troca o controle — o
            comando é ignorado até acabar de comer. Uma fruta por vez.
          </li>
          <li>
            O treinador comendo não invoca nem recolhe criaturas. Controlando
            uma criatura que está comendo, ainda dá pra voltar pro treinador.
          </li>
          <li>
            Se quem come <strong>toma dano</strong>, desmaia ou (a criatura) é
            recolhida, a fruta <strong>cai no chão</strong> e o resto da cura se
            perde. A fruta caída não pode ser pega de volta.
          </li>
          <li>A fruta já sai do inventário quando a pessoa começa a comer.</li>
        </ul>
        <DataTable
          head={['Fruta', 'Cura total', 'Tempo pra comer', 'Por segundo']}
          align={[null, 'right', 'right', 'right']}
          rows={berries.map((item) => [
            <ItemName key="name" item={item} />,
            `${formatNumber(item.berryHeal, 0)} de vida`,
            formatSeconds(item.berryDuration, 1),
            formatNumber(item.berryHeal / item.berryDuration, 1),
          ])}
        />
      </Section>

      <Section id="pokedex" title="Pokédex">
        <p>
          A Pokédex escaneia criaturas — tem a{' '}
          <WikiLink version={version} to="pokedex">
            própria página
          </WikiLink>
          .
        </p>
      </Section>
    </>
  )
}
