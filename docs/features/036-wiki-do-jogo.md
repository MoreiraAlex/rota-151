# 🚀 Versão 0.0.36 — Wiki do jogo

## Resumo

Uma wiki do Rota 151 dentro do próprio app (`/wiki`), no espírito da
Bulbapedia, **feita pra jogador**: explica como o jogo funciona por dentro —
status, dano, energia, comportamento das criaturas — com os números do jogo,
separada por **versão do jogo**.

Versão: `0.0.36` (`package.json`).

> **Números deste doc são fictícios (ilustrativos).** A wiki nunca repete um
> número: lê do jogo (versão atual) ou do retrato congelado da versão.

---

## Decisões

1. **Pública** — `src/app/wiki/`, fora do grupo `(auth)`; o botão "Jogar" do
   topo leva pro jogo (que continua pedindo login).
2. **Público-alvo é o jogador, não o dev** — nenhum trecho de código, nome de
   variável, campo de config ou caminho de arquivo nas páginas. Contas escritas
   em português ("Dano = (nível × 2 ÷ 5 + 2) × poder × …").
3. **Sem teclas** — o jogo vai ter teclado/mouse, celular e controle; as
   páginas falam da ação ("usar uma habilidade", "invocar"), nunca do botão.
4. **Versionada** — caixa "Versão do jogo" no topo. Cada versão da wiki tem o
   próprio texto, menu e números. Versões anteriores à 0.0.36 não são
   resgatadas; daqui pra frente, mudança de mecânica que precise entrar na
   wiki entra na versão em que aconteceu.
5. **Mecânica sem definição fica de fora com aviso "Em breve"**; mecânica que
   o jogador esperaria e não existe ganha aviso "Ainda não existe no jogo".
6. **Calculadora de dano** só na versão atual (usa as regras de hoje).
7. **Visual** — layout de enciclopédia (menu lateral, infobox, barras de
   status) com os tokens do tema do app (claro/escuro).

### Primeira rodada (descartada)

A primeira versão cobria só o motor de batalha, organizada como o código
(páginas por módulo, nomes de campos, fórmulas com nomes de função, teclas).
O usuário achou confusa e técnica demais; foi refeita a partir de um
levantamento das mecânicas do jogo inteiro, agrupadas como o jogador procura.

---

## Conteúdo (versão 0.0.36)

| Grupo | Páginas |
|---|---|
| Começando | Início · Controles *(em breve)* · O treinador *(em breve)* |
| Criaturas | Status · Vida e energia · Seu time |
| Batalha | Golpes · Dano · Acerto e erro · Efeitos em batalha · Energia e recarga · Alcance e área · Desmaio |
| Criaturas selvagens | Comportamento · Como as criaturas lutam |
| Pokédex | Scanner e registro |
| Catálogo | Criaturas (lista + ficha) · Golpes (lista + ficha) · Itens *(em breve)* |
| Ferramentas | Calculadora de dano |

**Em standby (decisão do usuário, ficam fora ou como "em breve"):**
controles; treinador (itens, arremesso, comportamento na luta); time inicial;
captura; quantidade/posição das selvagens (ainda é teste); morte do treinador.
Golpes específicos não ganham página de mecânica (ex.: Leech Seed) — a
mecânica genérica sim ("roubo de vida"); a skill aparece só no catálogo.

---

## Como as versões funcionam

> **Mudança (feature 038):** a wiki passou a ter **uma versão por beta**
> (MINOR do semver: `0.0.x`, `0.1.x`, ...), não uma por feature — com uma por
> feature a lista de versões ficaria imensa pra pouca diferença entre elas. As
> versões 0.0.36 e 0.0.37 foram juntadas na `0.0.x` (o conteúdo atual); as
> pastas antigas saíram (recuperáveis pelo git). Durante um beta, a versão
> atual é atualizada no lugar, e só no fim de cada feature.

- **Retrato de números** — `buildWikiData()` (`src/tools/wiki/wikiData.js`)
  monta um objeto simples (só número/texto/lista, sobrevive a JSON) com tudo
  que as páginas mostram, tirado do jogo pelas funções dele. As páginas só
  leem esse retrato, nunca o jogo direto.
- **Versão atual** (`data: null` no `meta.js`) monta o retrato ao vivo.
- **Versão antiga** (de um beta anterior) tem `data.json` congelado e mostra
  os números da época pra sempre.
- Endereços: `/wiki/<versão>/<página>` (ex.: `/wiki/0.0.x/batalha/dano`);
  `/wiki` vai pra mais nova. Trocar de versão na caixa mantém a página quando
  ela existe na outra versão.

**Passo a passo quando um beta novo sair** (ex.: 0.1.0):

1. Com o jogo ainda nas regras do beta anterior:
   `npm run wiki:freeze -- 0.0.x` → grava
   `src/tools/wiki/versions/v0-0-x/data.json`; no `meta.js` dela, troca
   `data: null` por `data: DATA` (`import DATA from './data.json'`).
2. Copia `versions/v0-0-x/` pra `versions/v0-1-x/`, troca o `id` (`0.1.x`) no
   `meta.js` e volta `data` pra `null`.
3. Adiciona a nova no **começo** de `WIKI_VERSIONS` (`versions/index.js`) e em
   `WIKI_PAGES` (`versions/pages.js`).

O teste `versions.test.js` garante que só a mais nova lê ao vivo.

---

## Arquitetura

- **Rotas** (`src/app/wiki/`): `page.js` (redireciona pra mais nova),
  `[version]/layout.js` (topo com a caixa de versão + menu da versão),
  `[version]/[[...slug]]/page.js` (resolve a página). Tudo estático no build.
- **`src/tools/wiki/`**:
  - `wikiData.js` — o retrato de números.
  - `speciesEntry.js` / `skillEntry.js` / `damageCalculator.js` — leitura de
    espécies, golpes e a prévia de dano pelas funções do jogo.
  - `wikiFormat.js` — formatação pt-BR e rótulos de jogador.
  - `versions/` — `index.js` (registro de versões), `pages.js` (componentes
    por versão), `v0-0-36/` (`meta.js` com o menu, `pages.js` com o mapa de
    endereços, `pages/*.jsx` com o texto).
  - `components/` — peças visuais compartilhadas (Article/Section,
    DataTable, Formula, Notice, Infobox, StatBars, SpeciesSprite, WikiLink,
    WikiNav, VersionSelect, DamageCalculator).
- **`scripts/freeze-wiki.js`** (`npm run wiki:freeze`) — carrega o código do
  jogo pelo Vite e grava o retrato em JSON.
- **Mudanças no core**: `computeDamage` exportada
  (`core/battle/calculateDamage.js`) e o limite do histórico de scans
  exportado (`MAX_ENTRIES`, `core/traits/components/scanHistory.js`) — só pra
  wiki ler em vez de repetir.

### Carregamento entre páginas

Medido no `next dev`: a primeira visita compila a rota da wiki (~11 s, quase
tudo módulo do próprio Next); depois cada página responde em ~0,2 s. Em
produção as páginas já saem prontas do build. Pra a tela não parecer
congelada, `WikiShell.jsx` intercepta os cliques em links internos da wiki
(menu, páginas, topo, caixa de versão) e troca o conteúdo NA HORA por uma
página falsa (`PageSkeleton.jsx`), já marcando o destino no menu, até a página
nova chegar (`useTransition` + `router.push`). O `loading.js` do segmento usa
o mesmo placeholder (é o que o Next mostra em produção — no dev ele não
pré-carrega rotas, por isso a interceptação).

---

## Etapas

- [x] Bump da versão para `0.0.36` no `package.json`.
- [x] Levantamento das mecânicas do jogo inteiro e revisão com o usuário.
- [x] Retrato de números (`wikiData.js`) e registro de versões.
- [x] Rotas versionadas, caixa de versão e menu por versão.
- [x] Páginas da 0.0.36 em linguagem de jogador (sem código, sem teclas).
- [x] Catálogo de criaturas e golpes a partir do retrato.
- [x] Calculadora de dano (só na versão atual).
- [x] Script de congelar versão (`npm run wiki:freeze`).
- [x] Placeholder imediato ao navegar entre páginas (`WikiShell` + `loading.js`).

---

## Critérios de Conclusão

- [x] `/wiki` pública e navegável, sem carregar nada do jogo 3D.
- [x] Nenhum código, variável, caminho de arquivo ou tecla nas páginas.
- [x] Caixa de versão funcionando; versão atual lê do jogo, antigas do JSON.
- [x] Nenhum número digitado nas páginas (exceto entradas de exemplo das
      tabelas ilustrativas — níveis, frações de vida, situações de coragem —
      e a escala visual das barras de status).
- [x] Toda criatura e todo golpe do jogo aparece no catálogo sozinho.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      127 arquivos, 1372 testes; build feito numa cópia, por causa do `next dev`).
