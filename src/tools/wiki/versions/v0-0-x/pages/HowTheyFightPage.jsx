import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMeters,
  formatMultiplier,
  formatPercent,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'

export function HowTheyFightPage({ data, version }) {
  const { ai } = data

  return (
    <>
      <Section>
        <p>
          As selvagens e as criaturas do seu time que você não está controlando
          lutam sozinhas, seguindo as mesmas regras.
        </p>
      </Section>

      <Section id="golpe" title="Qual golpe usar">
        <p>
          A cada momento, a criatura olha os golpes que pode usar (com energia e
          sem recarga) e dá uma nota pra cada um:
        </p>
        <ul>
          <li>
            Golpes fortes valem mais, e golpes em área valem mais quando pegam
            vários inimigos.
          </li>
          <li>
            Golpes que <strong>já alcançam</strong> o alvo ganham{' '}
            {formatMultiplier(ai.inReachBonus)}: ela prefere atacar logo a
            correr atrás de outro golpe.
          </li>
          <li>
            Baixar os atributos do inimigo ou subir os próprios vale a pena no
            começo, mas cada nível já acumulado vale menos — depois de um tempo
            ela prefere bater.
          </li>
          <li>
            Golpes ainda não dominados valem menos, na proporção da chance de
            dar certo.
          </li>
          <li>
            Ela renova efeitos que estão perto de acabar (faltando{' '}
            {formatSeconds(ai.refreshTime, 0)} ou menos).
          </li>
          <li>
            Só usa golpes em si mesma quando não há inimigo a{' '}
            {formatMeters(ai.selfSafeDistance, 0)} dela, pra não ser
            interrompida.
          </li>
        </ul>
        <p>
          Depois ela sorteia entre os golpes com nota de pelo menos{' '}
          {formatPercent(ai.nearBest, 0)} da melhor — os melhores saem mais, mas
          ela não fica previsível.
        </p>
      </Section>

      <Section id="energia" title="Cuidando da energia">
        <ul>
          <li>
            Ela nunca gasta toda a energia em habilidades: só usa uma se sobrar
            pelo menos {formatPercent(ai.skillReserve, 0)} depois.
          </li>
          <li>
            Com {formatPercent(ai.restEnter, 0)} de energia ou menos, ela{' '}
            <strong>descansa</strong>: para de atacar e de correr até voltar a{' '}
            {formatPercent(ai.restExit, 0)}.
          </li>
        </ul>
        <Notice tone="tip">
          <p>
            Uma criatura parada no meio da luta está recuperando energia — boa
            hora pra atacar.
          </p>
        </Notice>
      </Section>

      <Section id="movimento" title="Movimento na luta">
        <ul>
          <li>
            <strong>Desvio</strong> — quando vê um golpe vindo, tem{' '}
            {formatPercent(ai.dodgeChance, 0)} de chance de tentar sair da área.
            Ela precisa de {formatSeconds(ai.dodgeReaction, 1)} pra reagir:
            golpes rápidos pegam.
          </li>
          <li>
            <strong>Distância</strong> — com um golpe de longe planejado, ela
            recua se você chegar perto demais.
          </li>
          <li>
            <strong>Rodear</strong> — dentro do alcance, anda em volta do alvo
            trocando de lado, e para pra mirar antes de atacar.
          </li>
          <li>
            <strong>Dash</strong> — usa pra encurtar caminho quando ainda falta
            mais de {formatMeters(ai.dashCloseDistance, 0)} até o alcance.
          </li>
          <li>
            <strong>Feixe</strong> — quando usa um golpe em feixe, ela vira
            devagar pra acompanhar o alvo: correndo de lado, dá pra escapar.
          </li>
        </ul>
      </Section>

      <Section id="alvo" title="Em quem ela mira">
        <p>
          Um alvo com {formatPercent(ai.finishHp, 0)} da vida ou menos chama a
          atenção: ela tenta terminar a luta com ele. As selvagens contam isso
          junto com quem causou mais dano (
          <WikiLink version={version} to="selvagens/comportamento#ameaca">
            Comportamento
          </WikiLink>
          ); as criaturas do time, ao trocar de alvo, escolhem a selvagem com
          menos vida.
        </p>
      </Section>
    </>
  )
}
