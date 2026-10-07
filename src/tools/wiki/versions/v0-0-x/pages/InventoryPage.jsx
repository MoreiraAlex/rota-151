import { Section } from '@/tools/wiki/components/Article'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'

export function InventoryPage({ version }) {
  return (
    <>
      <Section id="o-que-tem" title="O que fica no inventário">
        <p>
          O inventário guarda tudo o que o treinador carrega: os{' '}
          <strong>itens</strong>, com a quantidade de cada um, e as{' '}
          <strong>criaturas que não estão no time</strong>. Não há limite de
          espaço nem de quantidade.
        </p>
        <p>
          Ele só abre enquanto você controla o treinador — controlando uma
          criatura, não.
        </p>
        <Notice tone="soon">
          <p>
            Por enquanto o jogo começa com a Pokédex e uma criatura de cada
            espécie. O kit de início e as formas de conseguir itens e criaturas
            novas vão entrar aqui quando estiverem definidos.
          </p>
        </Notice>
      </Section>

      <Section id="arrumar" title="Arrumando do seu jeito">
        <ul>
          <li>
            Cada item e cada criatura ocupa um espaço da grade.{' '}
            <strong>Arraste</strong> pra qualquer espaço — pode deixar espaços
            vazios no meio.
          </li>
          <li>Soltando sobre um espaço ocupado, os dois trocam de lugar.</li>
          <li>O que chega no inventário entra no primeiro espaço livre.</li>
          <li>
            <strong>Organizar</strong> junta tudo sem espaços vazios: primeiro
            os itens, agrupados por tipo, depois as criaturas, pela ordem da
            Pokédex (da mesma espécie, a de nível mais alto primeiro).
          </li>
        </ul>
      </Section>

      <Section id="mao" title="Item em mãos">
        <p>
          O treinador usa o item que está <strong>na mão</strong>. Arraste um
          item da grade pra mão pra equipar; tirando da mão, ele volta pra
          grade. Se só existe uma unidade, ela fica na mão e sai da grade
          enquanto estiver equipada.
        </p>
      </Section>

      <Section id="time" title="Montando o time">
        <ul>
          <li>
            Arraste uma criatura da grade pra um dos{' '}
            <strong>três lugares do time</strong>. Se o lugar já tem outra, a
            que estava lá volta pro inventário, no espaço que a nova deixou.
          </li>
          <li>
            Arrastando de um lugar do time pra outro, as duas trocam de lugar.
          </li>
          <li>
            Arrastando do time pra grade, a criatura sai do time. Soltando sobre
            outra criatura da grade, as duas trocam.
          </li>
          <li>
            O time pode ficar vazio. A criatura que sai do lugar enquanto está
            em campo é recolhida sozinha.
          </li>
        </ul>
        <p>
          Sair do time não cura: a criatura continua com a vida e o desmaio que
          tinha (
          <WikiLink version={version} to="criaturas/seu-time#na-bola">
            Seu time
          </WikiLink>
          ).
        </p>
      </Section>

      <Section id="detalhes" title="Detalhes">
        <p>
          Tocando num item ou numa criatura — na grade, no time ou na mão —
          aparecem os detalhes: do item, a descrição, a quantidade e o que ele
          faz; da criatura, o nível, os tipos, a vida, a energia e os golpes.
          Passando por cima, aparece só o nome.
        </p>
      </Section>
    </>
  )
}
