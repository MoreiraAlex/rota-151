import { Section } from '@/tools/wiki/components/Article'
import { Formula } from '@/tools/wiki/components/Formula'
import { WikiLink } from '@/tools/wiki/components/WikiLink'

export function AccuracyPage({ data, version }) {
  const { battle } = data

  return (
    <>
      <Section id="precisao" title="Precisão">
        <p>
          Cada golpe tem uma <strong>precisão</strong>, em porcentagem: a chance
          de acertar. A maioria tem {battle.defaultAccuracy}%; alguns têm menos,
          e alguns nunca erram (veja no{' '}
          <WikiLink version={version} to="catalogo/golpes">
            catálogo de golpes
          </WikiLink>
          ).
        </p>
        <Formula>
          <p>
            <strong>Chance de acertar</strong> = precisão do golpe ×
            multiplicador da Precisão de quem ataca
          </p>
          <p className="text-muted-foreground">Nunca passa de 100%.</p>
        </Formula>
        <p>
          A Precisão de quem ataca começa normal e pode ser baixada por golpes
          de status (
          <WikiLink version={version} to="batalha/efeitos">
            Efeitos em batalha
          </WikiLink>
          ). Com ela baixa, até golpes de {battle.defaultAccuracy}% passam a
          errar.
        </p>
      </Section>

      <Section id="regras" title="O que nunca erra">
        <ul>
          <li>Golpes que agem só em quem usou.</li>
          <li>As partes de um golpe canalizado.</li>
        </ul>
        <p>
          Não existe esquiva: só a Precisão de quem ataca conta. Quando um golpe
          erra, aparece <strong>“Errou!”</strong> e nada acontece com o alvo.
        </p>
      </Section>
    </>
  )
}
