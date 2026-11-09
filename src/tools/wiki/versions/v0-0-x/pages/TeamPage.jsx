import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMeters,
  formatNumber,
  formatPercent,
  formatSeconds,
} from '@/tools/wiki/wikiFormat'
import { POSTURE_TEXT } from '@/view/shared/postureText'

export function TeamPage({ data, version }) {
  const { party, partyAi, faint, flight, species } = data
  const defaultPosture = POSTURE_TEXT[party.defaultPosture].name.toLowerCase()
  const flyers = species
    .filter((entry) => entry.movement.flight)
    .map((entry) => entry.name)

  return (
    <>
      <Section id="time" title="O time">
        <p>
          O treinador leva até <strong>três criaturas</strong>, cada uma num
          lugar do time. Elas ficam guardadas na bola até serem chamadas. As
          outras ficam no{' '}
          <WikiLink version={version} to="inventario">
            Inventário
          </WikiLink>
          , que é onde se monta e se reordena o time. Cada criatura é única:
          tirando do time e pondo de volta, ela continua com o mesmo nível,
          golpes e vida.
        </p>
        <Notice tone="soon">
          <p>
            Como conseguir criaturas novas e com qual você começa o jogo vão
            entrar aqui quando estiverem definidos.
          </p>
        </Notice>
      </Section>

      <Section id="invocar" title="Invocar e recolher">
        <ul>
          <li>
            <strong>Invocar</strong>: o treinador arremessa a bola da criatura
            (a mesma em que ela foi capturada) pra onde está olhando. A bola
            abre e um feixe de luz solta a criatura onde ela cair — ao bater em
            algo no caminho, ou no ponto mais longe que ela alcança. Ao sair, a
            criatura faz uma pose de apresentação e só depois se mexe.
          </li>
          <li>
            <strong>Recolher</strong>: o treinador abre a bola na mão e um feixe
            de luz puxa a criatura de volta pra ela.
          </li>
          <li>
            Uma criatura que sai do time, ou é trocada por outra, enquanto está
            fora da bola é recolhida sozinha.
          </li>
          <li>
            Uma criatura <strong>desmaiada</strong> não sai da bola até acordar
            (
            <WikiLink version={version} to="batalha/desmaio">
              Desmaio
            </WikiLink>
            ).
          </li>
        </ul>
      </Section>

      <Section id="menu-de-acoes" title="Menu de ações">
        <p>
          Segurando o comando de invocar ou recolher uma criatura (em vez de só
          tocar), abre o <strong>menu de ações</strong> dela. Por enquanto ele
          tem quatro ações:
        </p>
        <ul>
          <li>
            <strong>Treino</strong> — treinar um golpe novo perto de um objeto
            de treino (
            <WikiLink version={version} to="criaturas/golpes-e-treino#treino">
              Golpes e treino
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Golpes</strong> — trocar a ordem dos três golpes dela.
          </li>
          <li>
            <strong>Itens</strong> — dar uma fruta pra ela, se estiver em campo
            (
            <WikiLink version={version} to="catalogo/itens#como-usar">
              Itens
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Postura</strong> — escolher como ela luta quando você não
            está no controle (
            <WikiLink version={version} to="criaturas/seu-time#posturas">
              Posturas
            </WikiLink>
            ).
          </li>
        </ul>
        <p>Com o menu aberto, o treinador e o time não fazem outras ações.</p>
      </Section>

      <Section id="na-bola" title="Vida e energia na bola">
        <p>
          A criatura volta pra bola do jeito que estava: se foi recolhida
          machucada, sai machucada da próxima vez. Guardada — no time ou no
          inventário — ela continua se recuperando no mesmo ritmo de fora (
          <WikiLink version={version} to="criaturas/vida-e-energia">
            Vida e energia
          </WikiLink>
          ). Desmaiada, não se recupera, mas o tempo pra acordar continua
          correndo. As <strong>condições de status</strong> também continuam
          dentro da bola, pelo tempo que faltava — e podem fazê-la desmaiar lá
          dentro.
        </p>
        <p>
          O nível e a experiência também ficam guardados: a criatura sai da bola
          no nível em que estava, e ganha experiência mesmo guardada se tiver
          lutado (
          <WikiLink version={version} to="criaturas/experiencia-e-nivel">
            Experiência e nível
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="seguindo" title="Seguindo">
        <p>Fora da bola, a criatura que você não está controlando:</p>
        <ul>
          <li>
            <strong>Segue</strong> quem está no controle, contornando paredes e
            obstáculos.
          </li>
          <li>
            Entra na luta conforme a <strong>postura</strong> dela (abaixo).
          </li>
          <li>
            Ataca com calma de propósito — um golpe a cada{' '}
            {formatSeconds(partyAi.attackInterval, 1)} no máximo. Quem decide a
            luta é quem joga.
          </li>
          <li>
            Se ficar a mais de {formatMeters(party.leashRadius, 0)} de quem está
            no controle, larga a luta e volta a seguir.
          </li>
          <li>
            Desmaiada em campo, volta pra bola sozinha depois de{' '}
            {formatSeconds(faint.recallDelay, 1)}.
          </li>
        </ul>
        <p>
          Como ela escolhe golpes e se movimenta na luta está em{' '}
          <WikiLink version={version} to="selvagens/como-lutam">
            Como as criaturas lutam
          </WikiLink>
          .
        </p>
      </Section>

      <Section id="posturas" title="Posturas">
        <p>
          Cada criatura tem uma <strong>postura</strong>, que diz quando ela
          entra numa luta sozinha. Você escolhe no menu de ações, e a escolha
          fica guardada com ela. Toda criatura começa na {defaultPosture}.
          Trocar vale na hora, até no meio de uma luta.
        </p>
        <ul>
          <li>
            <strong>Agressiva</strong> — ataca toda selvagem que vê, mesmo as
            tranquilas: à frente dela até {formatMeters(party.viewDistance, 0)}{' '}
            (num ângulo de {formatNumber(party.viewAngle, 0)}°), ou a até{' '}
            {formatMeters(party.nearRadius, 0)} em qualquer direção. Também faz
            tudo o que a defensiva faz.
          </li>
          <li>
            <strong>Defensiva</strong> — entra quando uma selvagem acerta alguém
            do time ou parte pra cima do grupo (a selvagem brava; o alerta ainda
            não conta). Se uma selvagem mira no treinador, vai pra cima dela
            primeiro.
          </li>
          <li>
            <strong>Neutra</strong> — só luta se ela mesma for acertada (golpe
            que erra não conta), e só contra quem a acertou. Não protege o
            treinador; quando essas selvagens saem da luta, volta a seguir.
          </li>
        </ul>
        <p>
          Nenhuma postura ataca uma selvagem que está sendo capturada, fugindo
          ou desmaiada — a agressiva não estraga a sua captura. Elas só valem
          perto de quem está no controle (os mesmos{' '}
          {formatMeters(party.leashRadius, 0)} de cima) e não valem pra criatura
          que você está controlando.
        </p>
      </Section>

      <Section id="longe-demais" title="Quem fica para trás">
        <ul>
          <li>
            A criatura que fica a mais de{' '}
            {formatMeters(party.recallDistance, 0)} de quem está no controle, ou
            presa (tentando seguir sem sair do lugar) por{' '}
            {formatSeconds(party.stuckTime, 0)}, volta sozinha pra bola.
          </li>
          <li>
            Antes, um aviso no topo da tela e uma Pokébola piscando em cima dela
            contam {formatSeconds(party.warningTime, 0)}. Se nesse tempo ela
            voltar pra perto ou se soltar, nada acontece.
          </li>
          <li>
            A distância só conta depois que ela chega perto do grupo uma vez:
            quem acabou de ser invocada longe tem tempo de chegar.
          </li>
          <li>
            <strong>Ao contrário</strong>: controlando uma criatura, se você
            deixar o treinador para trás, passando de{' '}
            {formatMeters(party.warnDistance, 0)} aparece o aviso &quot;Longe
            demais do treinador&quot;. Passando de{' '}
            {formatMeters(party.recallDistance, 0)}, ou com o treinador preso,
            começa a contagem — no fim, você é puxado pra bola e o controle
            volta pro treinador.
          </li>
        </ul>
      </Section>

      <Section id="qual-e-o-seu" title="Qual é o seu">
        <ul>
          <li>
            Toda criatura do seu time tem um <strong>anel azul</strong> no chão,
            embaixo dela, o tempo todo — inclusive a que você controla. As
            selvagens não têm.
          </li>
          <li>
            Na etiqueta acima da cabeça, o nome dela fica azul, com o atalho do
            lugar dela no time ao lado.
          </li>
          <li>
            <strong>Cores do dano</strong>: o dano que você causa aparece branco
            (o crítico, dourado), e o que o seu time toma, vermelho. O brilho no
            corpo de quem apanhou tem a mesma cor. Atributo baixando fica
            laranja na selvagem e violeta no seu time; subindo, verde na
            selvagem e azul no seu time.
          </li>
        </ul>
      </Section>

      <Section id="controle" title="Assumir o controle">
        <p>
          Você pode passar a controlar uma criatura do time que esteja fora da
          bola, e voltar pro treinador quando quiser. Controlando a criatura,
          você usa os golpes dela (
          <WikiLink version={version} to="batalha/golpes">
            Golpes
          </WikiLink>
          ), e o treinador passa a agir sozinho.
        </p>
      </Section>

      <Section id="voo" title="Voar">
        <p>
          As criaturas que voam ({flyers.join(', ')}) levantam voo quando você
          está no controle delas. No ar elas vão pra onde a câmera olha, sobem e
          descem, voam devagar ou rápido e, sem nenhum comando, ficam pairando.
          Encostando no chão, pousam.
        </p>
        <ul>
          <li>
            <strong>Energia</strong>: voar gasta energia o tempo todo, mais no
            voo rápido, e no ar ela não volta. Pra decolar precisa de pelo menos{' '}
            {formatPercent(flight.minTakeoffStamina)} da energia.
          </li>
          <li>
            <strong>Altura</strong>: com a energia cheia, a ave sobe até{' '}
            {formatMeters(flight.maxHeight)} acima do chão. A altura máxima cai
            junto com a energia, empurrando a ave pra baixo aos poucos; sem
            energia, ela pousa.
          </li>
          <li>
            <strong>Luta</strong>: no ar ela não usa golpes (pra lutar, pousa),
            mas ainda dá dash e pode ser atingida. Os selvagens deixam de lado
            quem voa alto demais pra alcançar e voltam quando ela desce.
          </li>
          <li>
            <strong>Água funda</strong>: dá pra passar por cima, mas a ave não
            pousa nela: fica rente à água até chegar na margem.
          </li>
          <li>
            Voltando o controle pro treinador com a ave no ar, ela desce sozinha
            e volta a seguir.
          </li>
        </ul>
        <p>
          A velocidade e o gasto do voo de cada ave estão na ficha dela no{' '}
          <WikiLink version={version} to="catalogo/criaturas">
            Catálogo
          </WikiLink>
          .
        </p>
      </Section>
    </>
  )
}
