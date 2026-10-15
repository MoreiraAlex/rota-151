import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatTypeName,
} from '@/tools/wiki/wikiFormat'

const WEATHER_NAMES = {
  clear: 'Limpo',
  sun: 'Sol forte',
  rain: 'Chuva',
  storm: 'Tempestade',
  snow: 'Neve',
}

const STAT_NAMES = { defense: 'Defesa', sp_def: 'Defesa especial' }

export function WorldPage({ data, version }) {
  const world = data?.world
  return (
    <>
      <Section id="relevo" title="O relevo">
        <p>
          O mundo não é plano: tem <strong>campos</strong>,{' '}
          <strong>morros</strong> e <strong>vales</strong>. Ele é gerado a
          partir de uma semente, então é sempre o mesmo a cada vez que você
          entra.
        </p>
        <ul>
          <li>Treinador e criaturas sobem e descem os morros andando.</li>
          <li>
            Encosta muito inclinada não dá pra subir: as criaturas procuram
            outro caminho em volta dela.
          </li>
          <li>
            Os vales mais fundos ficam cheios de água: são os{' '}
            <a href="#lagos-e-rios">lagos e rios</a>.
          </li>
        </ul>
      </Section>

      <Section id="biomas" title="Biomas">
        <p>
          O mundo é dividido em <strong>biomas</strong>, cada um com o próprio
          chão, cores, plantas e formato de terreno. Por enquanto existem
          quatro:
        </p>
        <ul>
          <li>
            <strong>Floresta</strong>: mata de clima ameno, com colinas médias.
          </li>
          <li>
            <strong>Planície</strong>: campo aberto e quase plano, de clima
            ameno.
          </li>
          <li>
            <strong>Savana</strong>: campo seco e quente, com ondulações largas.
          </li>
          <li>
            <strong>Cidade</strong>: chão quase plano, com ruas e casas. Cada
            pedaço do mundo tem a sua, ligada às vizinhas por estradas (veja{' '}
            <a href="#cidades">As cidades</a>).
          </li>
        </ul>
        <p>
          Entre um bioma e outro a passagem é aos poucos: a mata vai rareando
          até virar campo. Você começa o jogo no meio de uma vila.
        </p>
        <p>
          Quando uma árvore, uma pedra ou uma planta fica entre a câmera e você,
          ela fica <strong>transparente</strong> e você continua se vendo. Só o
          chão e as montanhas fazem a câmera chegar mais perto.
        </p>
      </Section>

      <Section id="floresta" title="A floresta">
        <p>
          A floresta é uma mata fechada, com <strong>clareiras</strong> abertas
          no meio dela. Ela tem o visual dos jogos de Pokémon: árvores redondas,
          cores vivas e sombras suaves.
        </p>
        <ul>
          <li>
            <strong>Árvores</strong> de vários tipos: árvores redondas, algumas
            enormes de copa alta, pinheiros em bosques e, de vez em quando, uma
            árvore jovem.
          </li>
          <li>
            Por baixo das árvores: samambaias, moitas redondas, trevos e tufos
            de folhas.
          </li>
          <li>
            <strong>Flores</strong> só nas clareiras.
          </li>
          <li>
            <strong>Mato alto</strong> no meio das moitas de grama, com grama
            baixa entre elas.
          </li>
          <li>
            <strong>Trilhas</strong> de terra batida cortam a mata, com
            pedrinhas no caminho. As trilhas que chegam num lago terminam na
            margem.
          </li>
          <li>Pedras grandes espalhadas pelo chão.</li>
        </ul>
        <p>
          Árvores e pedras bloqueiam a passagem do jeito que você as vê: o
          tronco e a pedra param você, a copa não. As criaturas desviam deles.
          Arbustos, plantas e mato dá pra atravessar.
        </p>
        <p>
          O <strong>vento</strong> balança o mato, as plantas e as copas das
          árvores. Ele fica mais forte com chuva e mais ainda com tempestade e
          neve — quanto mais forte o clima, mais vento: uma chuva fraca venta
          pouco.
        </p>
        <p>
          O mato e as plantas <strong>abrem</strong> quando você ou uma criatura
          passa por eles: deitam devagar para os lados e, depois que vocês
          passam, voltam a ficar de pé aos poucos — dá pra ver o caminho que
          você fez no mato. Os arbustos abrem menos. As árvores não se mexem;
          pulando, você passa por cima sem abrir nada.
        </p>
      </Section>

      <Section id="planicie" title="A planície">
        <p>
          Um campo aberto de grama verde, como as rotas dos jogos de Pokémon.
        </p>
        <ul>
          <li>
            Muito <strong>mato alto</strong> em moitas, com chão de grama baixa
            entre elas.
          </li>
          <li>
            <strong>Árvores redondas</strong> em pequenos bosques, de alguns
            tons de verde.
          </li>
          <li>
            Moitas redondas, arbustos (alguns com flores) e tufos de grama
            espalhados.
          </li>
          <li>
            Umas poucas <strong>flores</strong> e, de vez em quando, uma pedra.
          </li>
        </ul>
        <p>
          A planície não tem trilhas. Como na floresta, árvores e pedras
          bloqueiam a passagem, e o resto dá pra atravessar.
        </p>
      </Section>

      <Section id="savana" title="A savana">
        <p>
          Um campo seco, como as rotas de terra de Kanto: chão de terra batida
          com manchas de grama, e as plantas em tons de amarelo e palha.
        </p>
        <ul>
          <li>
            <strong>Capim alto</strong> amarelado nas manchas de grama, com o
            mato alto no meio.
          </li>
          <li>Árvores redondas espalhadas pelo campo, arbustos e tufos.</li>
          <li>Pedras na terra.</li>
          <li>
            <strong>Trilhas</strong> de terra batida, com pedrinhas no caminho.
          </li>
          <li>
            <strong>Lagoas</strong> pequenas nos pontos mais baixos, com a
            margem de areia.
          </li>
        </ul>
        <p>
          Como na floresta, árvores e pedras bloqueiam a passagem e as criaturas
          desviam delas; arbustos e mato dá pra atravessar. O vento balança o
          capim e as copas do mesmo jeito.
        </p>
      </Section>

      <Section id="lagos-e-rios" title="Lagos e rios">
        <p>
          A floresta, a planície e a savana têm <strong>lagos</strong> e{' '}
          <strong>rios</strong> que atravessam o campo. As cidades ficam secas,
          e o lugar onde você começa o jogo também.
        </p>
        <ul>
          <li>
            A beira é rasa: dá pra entrar andando, cada vez mais devagar
            conforme a água fica mais funda. Cada criatura entra até uma parte
            da própria altura — o treinador vai mais longe que uma criatura
            pequena. Mais fundo que isso, a água barra a passagem.
          </li>
          <li>
            As criaturas selvagens e as do time ficam só na beirada e contornam
            a água para chegar do outro lado.
          </li>
          <li>
            Andando, pulando ou correndo na água, ela respinga e faz marolinhas.
          </li>
          <li>
            O que é arremessado e cai na parte funda afunda e some. A esfera de
            invocar não abre: o Pokémon continua no time.
          </li>
          <li>
            A água dos rios corre, e na beira dos lagos e rios as ondas vão e
            voltam na areia.
          </li>
          <li>
            Se você sair do jogo dentro da água mais funda do que consegue
            ficar, volta na margem mais perto.
          </li>
        </ul>
      </Section>

      <Section id="cidades" title="As cidades">
        <p>
          O mundo é dividido em áreas, e cada área tem uma{' '}
          <strong>cidade</strong>. Entre uma cidade e a vizinha são uns 10 a 15
          minutos andando pela estrada. Em volta delas ficam a floresta, a
          planície e a savana.
        </p>
        <p>
          Toda cidade tem ruas calçadas em quadras, postes nas esquinas e casas
          de frente para a rua, com jardim, flores e algumas árvores. Ela segue
          o jeito de uma cidade de Kanto — as casas, o calçamento da rua e, nas
          maiores, um prédio que só ela tem:
        </p>
        <ul>
          <li>
            <strong>Pewter</strong>: casas de pedra, ruas de lajota e o museu.
          </li>
          <li>
            <strong>Cerulean</strong>: casas de telhado azul e a loja de
            bicicleta.
          </li>
          <li>
            <strong>Vermilion</strong>: casas de telhado laranja, ruas de
            ladrilho e o fã-clube.
          </li>
          <li>
            <strong>Lavender</strong>: casas roxas, ruas de asfalto e a Torre
            Pokémon.
          </li>
        </ul>
        <p>As cidades têm três tamanhos:</p>
        <ul>
          <li>
            <strong>Vila</strong>: pequena, com o <strong>Pokécenter</strong> e
            casas. Você começa o jogo numa vila.
          </li>
          <li>
            <strong>Cidade</strong>: maior, com o Pokécenter e uma{' '}
            <strong>loja</strong>.
          </li>
          <li>
            <strong>Cidade grande</strong>: a maior e mais rara, com o
            Pokécenter, a loja, um <strong>ginásio</strong> com a cor da cidade
            e o prédio especial dela.
          </li>
        </ul>
        <ul>
          <li>
            Os prédios são sólidos: dá pra contornar, mas ainda não dá pra
            entrar.
          </li>
          <li>
            Na cidade não aparecem itens no chão, e as plantas do jardim não dão
            fruta.
          </li>
        </ul>
      </Section>

      <Section id="estradas" title="Estradas">
        <p>
          <strong>Estradas</strong> de terra ligam as cidades, como as rotas de
          Kanto: seguindo por elas você chega a qualquer cidade do mundo.
        </p>
        <ul>
          <li>
            Cada cidade liga a pelo menos uma vizinha, e algumas ligam a mais de
            uma — tem voltas e atalhos.
          </li>
          <li>A estrada faz curvas pelo campo e nada cresce em cima dela.</li>
          <li>
            Onde ela cruza um rio ou um lago, a água fica rasa: dá pra
            atravessar a pé, e as criaturas também passam.
          </li>
          <li>Chegando na cidade, a estrada vira as ruas dela.</li>
        </ul>
      </Section>

      <Section id="itens" title="Itens pelo mundo">
        <p>Além dos itens com que você começa, o mundo tem itens pra achar.</p>
        <ul>
          <li>
            <strong>Pokébolas no chão</strong>: de vez em quando aparece uma
            Pokébola caída por aí — às vezes uma Grande Bola ou, mais rara, uma
            Ultra Bola. Chegue perto pra pegar.
          </li>
          <li>
            Com o tempo, novas Pokébolas aparecem, nunca bem do seu lado. Sair
            de um lugar e voltar logo não faz aparecer mais.
          </li>
          <li>
            <strong>Frutas na vegetação</strong>: qualquer arbusto e qualquer
            árvore podem ser vasculhados. Nem todos têm fruta, e nada mostra
            quais têm — é procurar.
          </li>
          <li>
            Cada arbusto e cada árvore sorteia de novo a cada dia do jogo se tem
            fruta. Depois de colhido, ele não dá mais nada até o dia seguinte.
          </li>
          <li>
            Com o inventário cheio, você não consegue pegar: abra espaço
            primeiro.
          </li>
          <li>
            O que você pegou e colheu fica guardado no seu progresso: ao voltar,
            o item pego não está mais lá.
          </li>
        </ul>
        {world ? (
          <DataTable
            head={['Bioma', 'Fruta da vegetação']}
            rows={world.biomes.map(({ name, berry }) => [name, berry ?? '—'])}
            caption="A fruta que os arbustos e as árvores de cada bioma dão."
          />
        ) : null}
      </Section>

      <Section id="tamanho" title="Tamanho">
        <p>
          O mundo <strong>não tem fim</strong>: dá pra andar em qualquer direção
          sem bater numa borda. Ao longe o mundo some numa{' '}
          <strong>névoa</strong>, com serras no horizonte; até onde a névoa
          começa, tudo aparece inteiro — árvores, prédios, mato e sombras.
        </p>
        <ul>
          <li>
            Criaturas que ficaram muito longe param onde estão e continuam de lá
            quando você volta.
          </li>
          <li>
            Coisas largadas no chão (comida derrubada, a Pokébola com uma
            criatura capturada quando o inventário estava cheio) somem de vez
            quando você se afasta muito delas. As Pokébolas achadas pelo mundo,
            não: ficam no lugar.
          </li>
        </ul>
      </Section>

      {world ? (
        <Section id="dia-e-noite" title="Dia e noite">
          <p>
            O mundo tem um relógio: um dia inteiro dura{' '}
            <strong>{formatNumber(world.dayMinutes, 0)} minutos</strong> de
            jogo. O tempo só passa com o jogo aberto e para quando você pausa;
            ao voltar, o jogo continua na hora em que você saiu.
          </p>
          <ul>
            <li>
              O sol nasce, cruza o céu e se põe; à noite aparecem a lua e as
              estrelas.
            </li>
            <li>
              O céu, a luz, a névoa e as serras do horizonte mudam de cor com a
              hora: alaranjados no amanhecer e no pôr do sol, azul-escuro à
              noite.
            </li>
            <li>
              A noite é escura, mas dá pra enxergar o caminho e as criaturas. Só
              o sol faz sombra; a luz da lua não.
            </li>
            <li>Nuvens andam pelo céu, com a cor da luz da hora.</li>
          </ul>
        </Section>
      ) : null}

      {world ? (
        <Section id="clima" title="Clima">
          <p>
            Cada lugar do mundo tem o próprio clima, e ele muda mais ou menos a
            cada {formatNumber(world.weatherMinutes, 0)} minutos. Andando, você
            pode sair da chuva e entrar num lugar de céu limpo. A troca é aos
            poucos: a chuva começa fraca e vai engrossando.
          </p>
          <ul>
            <li>
              <strong>Limpo</strong>: céu aberto, com algumas nuvens.
            </li>
            <li>
              <strong>Sol forte</strong>: luz mais forte e quente, céu quase sem
              nuvens. Só acontece de dia: à noite, o lugar fica limpo.
            </li>
            <li>
              <strong>Chuva</strong>: céu cinza, gotas caindo e som de chuva.
            </li>
            <li>
              <strong>Tempestade</strong>: chuva forte com vento, relâmpagos e
              trovões.
            </li>
            <li>
              <strong>Neve</strong>: céu fechado, flocos caindo e vento.
            </li>
          </ul>
          <p>Cada bioma tem as próprias chances de clima.</p>
          <DataTable
            head={['Bioma', ...world.weatherTypes.map((t) => WEATHER_NAMES[t])]}
            align={[null, ...world.weatherTypes.map(() => 'right')]}
            rows={world.biomes.map(({ name, chances }) => [
              name,
              ...world.weatherTypes.map((type) =>
                chances[type] > 0 ? formatPercent(chances[type], 0) : '—',
              ),
            ])}
            caption="Chance de cada clima em cada bioma."
          />
        </Section>
      ) : null}

      {world ? (
        <Section id="clima-na-batalha" title="Clima na batalha">
          <p>
            O clima do lugar onde está quem ataca muda o dano (veja{' '}
            <WikiLink version={version} to="batalha/dano">
              Dano
            </WikiLink>
            ):
          </p>
          <ul>
            {world.moveEffects.map(({ weather, type, multiplier }) => (
              <li key={`${weather}-${type}`}>
                <strong>{WEATHER_NAMES[weather]}</strong>: golpe de{' '}
                {formatTypeName(data, type)} causa{' '}
                {formatMultiplier(multiplier)} de dano.
              </li>
            ))}
            {world.defenseEffects.map(({ weather, type, stat, multiplier }) => (
              <li key={`${weather}-${type}-${stat}`}>
                <strong>{WEATHER_NAMES[weather]}</strong>: criatura do tipo{' '}
                {formatTypeName(data, type)} tem a {STAT_NAMES[stat] ?? stat}{' '}
                {formatMultiplier(multiplier)}.
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Notice tone="soon">
        <p>
          Ainda vão chegar ao mundo: nadar, entrar nos prédios das cidades e o
          Pokécenter curando o time. Os Pokémon de cada bioma, horário e clima
          também chegam depois. A montanha e as cavernas ficam para depois desta
          versão.
        </p>
      </Notice>
    </>
  )
}
