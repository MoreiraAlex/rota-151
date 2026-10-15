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
            Os vales mais fundos ficam cheios de água. Por enquanto dá pra
            atravessar os lagos andando pelo fundo.
          </li>
        </ul>
      </Section>

      <Section id="biomas" title="Biomas">
        <p>
          O mundo é dividido em <strong>biomas</strong>, cada um com o próprio
          chão, cores, plantas e formato de terreno. Por enquanto existem três:
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
        </ul>
        <p>
          Entre um bioma e outro a passagem é aos poucos: a mata vai rareando
          até virar campo. Você sempre começa em terra firme.
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
          neve.
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
          Um campo aberto de grama verde, como as rotas dos jogos de Pokémon. É
          onde você começa.
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

      <Section id="tamanho" title="Tamanho">
        <p>
          O mundo <strong>não tem fim</strong>: dá pra andar em qualquer direção
          sem bater numa borda. No horizonte dá pra ver o relevo distante
          (morros e montanhas lá longe) atrás de uma bruma leve; as plantas e os
          detalhes vão aparecendo conforme você chega perto.
        </p>
        <ul>
          <li>
            Criaturas que ficaram muito longe param onde estão e continuam de lá
            quando você volta.
          </li>
          <li>
            Coisas largadas no chão (comida derrubada, Pokébola caída) somem de
            vez quando você se afasta muito delas.
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
              O céu, a luz e a névoa do horizonte mudam de cor com a hora:
              alaranjados no amanhecer e no pôr do sol, azul-escuro à noite.
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
          Ainda vão chegar ao mundo: água de verdade em lagos e rios, itens pelo
          chão e o Pokécenter. Os Pokémon de cada bioma, horário e clima também
          chegam depois. A montanha e as cavernas ficam para depois desta
          versão.
        </p>
      </Notice>
    </>
  )
}
