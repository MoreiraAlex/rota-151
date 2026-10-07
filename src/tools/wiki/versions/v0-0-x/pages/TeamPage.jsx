import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { formatMeters, formatSeconds } from '@/tools/wiki/wikiFormat'

export function TeamPage({ data, version }) {
  const { party, faint } = data

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
            <strong>Invocar</strong>: o treinador arremessa a bola pra onde está
            olhando. A criatura sai onde a bola cair — ao bater em algo no
            caminho, ou no ponto mais longe que ela alcança. Ao sair, a criatura
            faz uma pose de apresentação e só depois se mexe.
          </li>
          <li>
            <strong>Recolher</strong>: um feixe de luz puxa a criatura de volta
            pra bola.
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
          tem três ações:
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
            <strong>Itens</strong> — dar uma poção ou uma fruta pra ela, se
            estiver em campo (
            <WikiLink version={version} to="catalogo/itens#como-usar">
              Itens
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
          correndo.
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

      <Section id="seguindo" title="Seguindo e defendendo">
        <p>Fora da bola, a criatura que você não está controlando:</p>
        <ul>
          <li>
            <strong>Segue</strong> quem está no controle, contornando paredes e
            obstáculos.
          </li>
          <li>
            <strong>Defende o grupo</strong>: quando uma selvagem acerta alguém
            do time, ela entra na luta contra essa selvagem. Ela não começa
            briga sozinha.
          </li>
          <li>
            Ataca com calma de propósito — um golpe a cada{' '}
            {formatSeconds(party.attackInterval, 1)} no máximo. Quem decide a
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
    </>
  )
}
