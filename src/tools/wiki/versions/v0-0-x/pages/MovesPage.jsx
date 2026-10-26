import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import { formatSeconds } from '@/tools/wiki/wikiFormat'

export function MovesPage({ data, version }) {
  const { battle } = data

  return (
    <>
      <Section id="golpes" title="Os golpes de uma criatura">
        <p>
          Controlando uma criatura, você luta com os <strong>golpes</strong>{' '}
          dela — até três, como nos jogos clássicos não existe um ataque comum.
          Os golpes podem ser compartilhados entre espécies (veja o{' '}
          <WikiLink version={version} to="catalogo/golpes">
            catálogo de golpes
          </WikiLink>
          ).
        </p>
        <ul>
          <li>
            Todo golpe gasta energia e precisa de um tempo pra poder ser usado
            de novo (
            <WikiLink version={version} to="batalha/energia-e-recarga">
              Energia e recarga
            </WikiLink>
            ).
          </li>
          <li>
            Todo golpe tem um <strong>tipo</strong> (Fogo, Água, Planta…), que
            muda o dano conforme os tipos do alvo (
            <WikiLink version={version} to="batalha/tipos">
              Tipos
            </WikiLink>
            ).
          </li>
        </ul>
      </Section>

      <Section id="tipos" title="Categorias de golpe">
        <ul>
          <li>
            <strong>Físico</strong> — causa dano usando Ataque contra Defesa.
          </li>
          <li>
            <strong>Especial</strong> — causa dano usando Ataque especial contra
            Defesa especial.
          </li>
          <li>
            <strong>Status</strong> — não causa dano: muda os atributos do alvo
            ou de quem usou (
            <WikiLink version={version} to="batalha/efeitos">
              Efeitos em batalha
            </WikiLink>
            ).
          </li>
          <li>
            <strong>Em si mesmo</strong> — um golpe de status que age só em quem
            usou, sem precisar mirar.
          </li>
          <li>
            <strong>Canalizado</strong> — um golpe de dano que você mantém ativo
            enquanto continua usando (veja abaixo).
          </li>
        </ul>
      </Section>

      <Section id="lancando" title="Lançando um golpe">
        <ul>
          <li>
            O golpe sai pra onde você está olhando, sempre na horizontal — não
            existe mira automática: quem acerta é você.
          </li>
          <li>
            Criaturas mais rápidas fazem o golpe mais depressa (
            <WikiLink version={version} to="criaturas/status#velocidade">
              Velocidade
            </WikiLink>
            ).
          </li>
          <li>
            Alguns golpes mostram a área antes de sair, pra você conferir onde
            vão pegar. Nesse momento ainda dá pra cancelar.
          </li>
          {battle.windupSteering ? (
            <li>
              Entre lançar e o golpe acontecer existe um pequeno{' '}
              <strong>preparo</strong>. Durante ele, a direção ainda acompanha a
              sua mira — só trava no instante do golpe.
            </li>
          ) : null}
        </ul>
      </Section>

      <Section id="aviso" title="Aviso no chão">
        <p>
          Durante o preparo, um <strong>aviso aparece no chão</strong> com a
          área do golpe, enchendo até o instante em que ele acontece. Vale pros
          dois lados: dá pra ver o golpe da selvagem chegando e sair da área.
        </p>
        <p>
          Golpes que <strong>carregam</strong> — os que agem em quem usou —
          podem ser <strong>interrompidos</strong>: se quem está carregando
          tomar dano antes do golpe acontecer, o golpe é cancelado e a criatura
          fica atordoada por {formatSeconds(battle.hitStun)}. Os outros golpes
          não são interrompidos.
        </p>
      </Section>

      <Section id="canalizados" title="Golpes canalizados">
        <p>
          Um golpe canalizado continua causando dano em pequenas partes enquanto
          você o mantém ativo, até o fim da duração. Parar antes encerra o
          golpe, e a recarga começa ali.
        </p>
        <ul>
          <li>
            O canal inteiro vale o dano de <strong>um</strong> golpe normal,
            dividido entre as partes. Segurando até o fim com o alvo dentro da
            área, ele leva o dano completo.
          </li>
          <li>
            Cada parte pode ser crítica por conta própria, e as partes nunca
            erram.
          </li>
          <li>
            Em <strong>cone</strong>, cada parte acerta todos os inimigos à
            frente. Em <strong>feixe</strong>, só o primeiro na linha — e você
            continua mirando enquanto o golpe dura.
          </li>
        </ul>
      </Section>

      <Section id="especiais" title="Golpes com regras próprias">
        <ul>
          <li>
            <strong>Vários acertos</strong> — alguns golpes acertam mais de uma
            vez seguida no mesmo alvo; quantas vezes é sorteado a cada uso. Só o
            primeiro acerto pode errar, e cada um tem o próprio dano.
          </li>
          <li>
            <strong>Poder que muda</strong> — alguns golpes ficam mais fortes
            conforme a luta: pela Velocidade de quem usa comparada à do alvo, ou
            contra quem levou dano há pouco.
          </li>
          <li>
            <strong>Arrancada</strong> — alguns golpes avançam até o alvo antes
            de acertar, alcançando mais longe que o corpo a corpo comum.
          </li>
        </ul>
        <p>
          A página de cada golpe, no{' '}
          <WikiLink version={version} to="catalogo/golpes">
            catálogo
          </WikiLink>
          , mostra os números.
        </p>
      </Section>

      <Section id="combate" title="Em combate">
        <p>
          Atacar coloca a criatura em <strong>modo combate</strong> — dá pra ver
          pelo olhar bravo dela. Ela sai do modo combate depois de{' '}
          {formatSeconds(battle.combatModeTimeout, 0)} sem atacar. O dano
          causado aparece em números sobre quem apanhou, e golpes que erram
          mostram <strong>“Errou!”</strong>. Golpes fortes ou fracos contra o
          tipo do alvo avisam <strong>“Super efetivo!”</strong>,{' '}
          <strong>“Pouco efetivo…”</strong> ou <strong>“Não afeta…”</strong>.
        </p>
        <Notice tone="tip">
          <p>
            Fique de olho no aviso no chão: sair da área antes do golpe
            acontecer é a melhor defesa.
          </p>
        </Notice>
      </Section>

      <Section id="registro" title="Registro da batalha">
        <p>
          Durante a luta, um quadro no canto da tela conta o que aconteceu, como
          nos jogos de turno: quem usou qual golpe, quanto de vida cada um
          perdeu, golpes críticos, a efetividade do tipo, atributos que subiram
          ou caíram, queimaduras, desmaios e a experiência ganha. As mensagens
          mais antigas saem conforme chegam novas, e o quadro some depois de um
          tempo sem novidade.
        </p>
      </Section>
    </>
  )
}
