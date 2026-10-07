import { Section } from '@/tools/wiki/components/Article'
import { DataTable } from '@/tools/wiki/components/DataTable'
import { Formula } from '@/tools/wiki/components/Formula'
import { Notice } from '@/tools/wiki/components/Notice'
import { WikiLink } from '@/tools/wiki/components/WikiLink'
import {
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatSeconds,
  formatMeters,
} from '@/tools/wiki/wikiFormat'

export function MoveTrainingPage({ data, version }) {
  const { moves } = data

  return (
    <>
      <Section id="tres-golpes" title="Três golpes por criatura">
        <p>
          Cada criatura do time tem <strong>{moves.slots} golpes</strong> — são
          os únicos ataques dela. Eles são <strong>dela</strong>: duas criaturas
          da mesma espécie podem ter golpes diferentes. Toda criatura começa com
          os golpes iniciais da espécie (no{' '}
          <WikiLink version={version} to="catalogo/criaturas">
            catálogo
          </WikiLink>
          ), já dominados.
        </p>
        <p>
          Não dá pra trocar de golpe à vontade: pra ter um golpe novo, a
          criatura precisa <strong>aprender</strong> — e, com os {moves.slots}{' '}
          ocupados, <strong>esquecer</strong> um dos que sabe. A ordem dos{' '}
          {moves.slots} golpes pode ser trocada a qualquer momento.
        </p>
      </Section>

      <Section id="ciclo" title="Do bloqueado ao dominado">
        <DataTable
          head={['Etapa', 'O que significa']}
          rows={[
            [
              'Bloqueado',
              'A criatura ainda não cumpre a condição do golpe (hoje, o nível). Aparece como “???”.',
            ],
            [
              'Apto',
              'Cumpriu a condição: já pode treinar o golpe. Ela não aprende sozinha.',
            ],
            [
              'Em treino',
              'Treinando perto de um objeto de treino, a barra de treino enche.',
            ],
            [
              'Aprendido',
              'Está entre os golpes dela, mas ainda sem domínio total.',
            ],
            [
              'Dominado',
              'Domínio no máximo: o golpe funciona como nos jogos clássicos.',
            ],
          ]}
        />
        <p>
          Ao subir de nível, a criatura avisa quando fica apta pra um golpe
          novo.
        </p>
      </Section>

      <Section id="treino" title="Treino">
        <p>
          O treino é feito pelo <strong>menu de ações</strong> da criatura: é só
          segurar o comando de invocar ou recolher aquela criatura, em vez de
          apenas tocar. Lá, a ação <strong>Treino</strong> lista todos os golpes
          que ela pode ter.
        </p>
        <ul>
          <li>
            Só dá pra treinar com a criatura em campo, fora de combate e a até{' '}
            {formatMeters(moves.trainingRadius)} de um{' '}
            <strong>objeto de treino</strong> (troncos e pedras marcados no
            mapa).
          </li>
          <li>
            A criatura vai até o objeto e repete o golpe sozinha, com uma pausa
            de {formatSeconds(moves.repetitionInterval)} entre as repetições. O
            treino conta o <strong>tempo</strong> que ela passa no objeto
            (repetindo, esperando ou descansando) — quanto tempo cada golpe pede
            está logo abaixo.
          </li>
          <li>
            Cada repetição gasta energia, como um golpe normal. Sem energia, ela
            descansa até recuperar {formatPercent(moves.restFraction, 0)} da
            energia máxima e volta a treinar.
          </li>
          <li>
            Treinando, ela só para se você assumir o controle dela, recolher
            ela, mandar parar, ou se alguém atacá-la (mesmo errando) — aí ela
            entra na luta. Você pode se afastar, e o resto do time pode lutar à
            vontade: ela continua treinando. O progresso fica guardado.
          </li>
          <li>
            O jogo só avança com ele aberto na tela: com a janela minimizada ou
            em outra aba, o treino fica parado.
          </li>
        </ul>
        <Notice tone="missing">
          <p>
            Salvar o jogo ainda não existe: recarregar ou fechar o jogo perde o
            progresso de treino.
          </p>
        </Notice>
      </Section>

      <Section id="tempo" title="Quanto tempo">
        <p>
          Trocar de golpe é um compromisso: golpes fortes pedem muitas horas de
          treino. A conta usa o mesmo <strong>peso</strong> do custo de energia
          (ver{' '}
          <WikiLink version={version} to="batalha/energia-e-recarga#peso">
            Peso do golpe
          </WikiLink>
          ):
        </p>
        <Formula>
          <p>
            <strong>Horas pra aprender</strong> = peso ÷ 100 ×{' '}
            {formatNumber(moves.learnHoursPer100Weight)} — nunca menos que{' '}
            {formatNumber(moves.minLearnHours)} h
          </p>
          <p>
            <strong>Horas pra dominar</strong> (de zero ao máximo, só treinando)
            = horas pra aprender × {formatNumber(moves.masteryHoursMultiplier)}
          </p>
          <p className="text-muted-foreground">
            Alguns golpes têm um tempo próprio, fora da conta.
          </p>
        </Formula>
        <DataTable
          head={['Golpe', 'Peso', 'Aprender', 'Dominar']}
          align={[null, 'right', 'right', 'right']}
          rows={data.skills.map((skill) => [
            <WikiLink
              key="name"
              version={version}
              to={`catalogo/golpes/${skill.id}`}
            >
              {skill.name}
            </WikiLink>,
            formatNumber(skill.weight, 1),
            `${formatNumber(skill.trainingHours.learn, 1)} h`,
            `${formatNumber(skill.trainingHours.mastery, 1)} h`,
          ])}
          caption="Tempo de treino no objeto. O progresso fica guardado entre uma sessão e outra."
        />
      </Section>

      <Section id="esquecer" title="Aprender e esquecer">
        <p>
          Quando a barra de treino enche, a criatura aprende o golpe. Se ela já
          sabe {moves.slots} golpes, você escolhe <strong>qual esquecer</strong>{' '}
          — ou deixa pra depois: o golpe fica pronto pra aprender no menu de
          treino.
        </p>
        <p>
          Esquecer não apaga tudo: o golpe esquecido volta a ficar apto e guarda{' '}
          {formatPercent(moves.forgetRetained, 0)} do treino, então reaprender é
          mais rápido.
        </p>
      </Section>

      <Section id="dominio" title="Domínio">
        <p>
          Um golpe recém-aprendido começa com{' '}
          {formatPercent(moves.initialMastery, 0)} de domínio. Com pouco
          domínio, ele:
        </p>
        <ul>
          <li>
            <strong>erra mais</strong> — a chance de acerto é multiplicada pelo
            fator de precisão (ver{' '}
            <WikiLink version={version} to="batalha/acerto-e-erro">
              Acerto e erro
            </WikiLink>
            );
          </li>
          <li>
            golpes que nunca erram (em si mesmo, contínuos ou sem precisão)
            podem <strong>falhar</strong>, com a mesma chance;
          </li>
          <li>
            <strong>gasta mais energia</strong> e <strong>demora mais</strong>{' '}
            pra recarregar (ver{' '}
            <WikiLink version={version} to="batalha/energia-e-recarga">
              Energia e recarga
            </WikiLink>
            ).
          </li>
        </ul>
        <DataTable
          head={['Domínio', 'Precisão', 'Energia', 'Recarga']}
          align={[null, 'right', 'right', 'right']}
          rows={moves.masteryRows.map((row) => [
            `${formatPercent(row.mastery, 0)}${row.initial ? ' (ao aprender)' : ''}`,
            formatMultiplier(row.accuracy),
            formatMultiplier(row.cost),
            formatMultiplier(row.cooldown),
          ])}
          caption="Multiplicadores sobre os valores normais do golpe."
        />
        <p>
          O domínio sobe de dois jeitos. <strong>Treinando</strong> o golpe
          equipado num objeto de treino (pela ação Treino, como pra aprender),
          devagar e sempre igual — veja as horas pra dominar na tabela acima. E{' '}
          <strong>usando o golpe em combate</strong>, bem mais rápido — com uma
          criatura selvagem lutando a até {formatMeters(moves.opponentRadius)}.
          Usar no vazio não conta. Acertar rende mais que errar, e quanto mais
          perto do máximo, mais devagar sobe: do domínio inicial ao máximo são
          cerca de {formatNumber(moves.usesToMasterHitting, 0)} usos acertando
          (ou {formatNumber(moves.usesToMasterMissing, 0)} errando). O domínio
          nunca cai.
        </p>
      </Section>

      <Notice tone="tip">
        <p>
          Criaturas selvagens já nascem com os golpes da espécie, dominados.
        </p>
      </Notice>

      <Notice tone="missing">
        <p>
          Lugares ou pessoas que ensinam golpes mais rápido, e condições além do
          nível pra ficar apto, ainda não existem.
        </p>
      </Notice>
    </>
  )
}
