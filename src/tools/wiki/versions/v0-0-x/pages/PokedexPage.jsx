import { Section } from '@/tools/wiki/components/Article'
import { formatMeters } from '@/tools/wiki/wikiFormat'

export function PokedexPage({ data }) {
  const { pokedex } = data

  return (
    <>
      <Section id="scanner" title="Escaneando criaturas">
        <p>
          Com a Pokédex em mãos, o treinador pode entrar no{' '}
          <strong>modo scanner</strong>: a câmera vai pra primeira pessoa,
          aparece o visor da Pokédex e ele só pode andar. Mirando numa criatura
          {pokedex.scanRange
            ? ` a até ${formatMeters(pokedex.scanRange, 0)}`
            : ''}{' '}
          e confirmando, ela é registrada.
        </p>
        <p>
          Dá pra escanear selvagens e criaturas do próprio time. Ao registrar, a
          Pokédex abre direto na ficha da criatura escaneada.
        </p>
      </Section>

      <Section id="menu" title="O que a Pokédex mostra">
        <ul>
          <li>
            <strong>Pokémons</strong> — a lista completa, com uma vaga por
            número. Só as espécies já escaneadas podem ser abertas, mostrando o
            tipo e os status base delas — é assim que se descobre o tipo de uma
            criatura selvagem.
          </li>
          <li>
            <strong>Time</strong> — as criaturas do seu time, com os status
            reais de cada uma (incluindo IV, energia e CP) e o tipo de cada
            golpe.
          </li>
          <li>
            <strong>Histórico</strong> — as últimas {pokedex.historyLimit}{' '}
            criaturas escaneadas, com os status daquela criatura específica.
            Escanear de novo uma espécie que já está na lista leva ela pro topo.
          </li>
        </ul>
      </Section>
    </>
  )
}
