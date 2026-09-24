# 028 — Status de combate, animação por duração e velocidade de ataque

## Resumo

Nasceu de "quero uma janela que exiba os status do pokemon" (tecla `P`)
e cresceu pra cobrir quatro frentes interligadas: uma janela de status
de batalha em estilo Pokédex (`StatsPanel.jsx`, radar de atributos,
CP); as fórmulas clássicas de Pokémon que alimentam esses status
(`core/data/species/stats.js`); a migração do sistema de vida/stamina
pra ler desses status em vez do `vitals` antigo; e, por pedido do
usuário pensando na feature de status `speed` afetando velocidade de
ataque, a eliminação da calibração manual entre duração de ação e
velocidade de animação — que virou o alicerce sobre o qual o próprio
usuário já implementou um primeiro uso real: o intervalo de ataque
básico de `bulbasaur`/`charmander`/`squirtle` agora sai direto do
status `speed` de cada um.

## `core/data/species/stats.js` — fórmulas de status

Objeto literal não tem escopo próprio pra um campo (`stat`) referenciar
um irmão (`base`/`iv`/`ev`) durante a própria criação — por isso as
fórmulas viraram funções, calculadas FORA do objeto de espécie, com
variáveis de verdade, e só depois usadas pra montar `stats: {...}`.

- **`calculateHpStat({ base, iv, ev, level })`** — fórmula clássica de
  HP: `trunc((2*base+iv+trunc(ev/4))*level/100) + level + 10`.
- **`calculateStat({ base, iv, ev, level, nature = 1 })`** — fórmula
  dos demais status (ataque/defesa/sp. atk/sp. def/velocidade):
  `trunc((trunc((2*base+iv+trunc(ev/4))*level/100) + 5) * nature)`.
- **`calculateEnergyStat({ hp, defense, sp_def })`** — fórmula própria
  do usuário pro novo status `energy` (substituto da stamina): média de
  HP/defesa/defesa especial.
- **`calculateCP({ SomaStatus, SomaIV, SomaEV, level })`** — fórmula
  própria do usuário pro CP (não é a fórmula real de Pokémon GO, que
  usa raiz quadrada e tabela de multiplicador por nível), agregando os
  `stat` dos seis status de combate + soma de IV/EV, com teto de
  10000. Com números realistas de nível baixo o resultado sai
  NEGATIVO (a soma dos IVs — cada um de 20 a 31 — costuma ser maior que
  a soma de status ainda pequenos em nível baixo) — sinalizado ao
  usuário, fórmula não alterada por ser decisão de design dele, não
  erro de transcrição.
- **`calculateAttackInterval(speed)`** — mapeia o status `speed` (raiz
  quadrada, interpolado entre `speed: 5` e `speed: 400`) pro intervalo
  entre ataques em segundos, de `0.75s` (lento) a `0.15s` (rápido).
  Usada por `bulbasaur`/`charmander`/`squirtle` pra calcular
  `attacks.primary.overrides.duration` (e `effectAt`, 40% da duração)
  a partir do próprio `speed` da espécie — o primeiro uso real do
  status `speed` afetando velocidade de ataque, viabilizado pela
  vinculação ação↔animação abaixo.

Só `boy`/`bulbasaur`/`charmander`/`squirtle` migraram pro novo formato
de `stats`; `fox`/`wolf` ainda têm `stats: {}` (sistema de batalha em
si ainda não foi desenhado pra eles, ver `_template/index.js`). IV/EV
hoje são sorteados uma vez quando o módulo da espécie carrega (não por
criatura individual) — limitação conhecida, documentada no arquivo,
ainda não resolvida.

## `Vitals`/stamina lendo de `species.stats.hp`/`.energy`

Pedido do usuário: "agora tenho energy no stats tb que vai substituir
a stamina... adeque o sistema de hp e stamina pra ler esse stats".

`core/traits/components/vitals.js` ganhou `resolveMaxHp(species)` /
`resolveMaxStamina(species)`, e `vitalsFromSpecies` mudou de assinatura
(`(speciesVitals)` → `(species)`) pra usá-las: resolvem
`stats.hp.stat`/`stats.energy.stat` PRIMEIRO, caindo pro
`vitals.maxHp`/`.maxStamina` antigo se a espécie não tiver migrado, e
por fim pro default do trait (100/100). Mesma resolução reaproveitada
em `tools/hud/PartyHud.jsx` (card estático de criatura equipada mas
não invocada), pra não discordar do valor de verdade. O trait/campo
continuam se chamando `stamina`/`maxStamina` internamente — só a FONTE
do número mudou, sem rename de terminologia no motor.

Achado ao implementar: koota trata um `key: undefined` explícito num
objeto de override do trait como uma escrita de verdade (sobrescreve o
default do schema) — confirmado lendo `createSoASetFunction` em
`node_modules/koota`. Por isso toda cadeia de fallback em
`vitalsFromSpecies` termina num literal de verdade, nunca deixando
`undefined` chegar em `Vitals({...})`.

Call sites atualizados pra passar a espécie inteira, não só `.vitals`:
`core/systems/summonBallSystem.js`, `wildCreatureSpawnSystem.js`,
`core/world/world.js`, `src/test/makeWorld.js`.

## `StatsPanel.jsx` — janela de status (tecla `P`)

Subtela do `PauseMenu.jsx` (mesmo padrão de `InventoryPanel.jsx`),
aberta pela tecla `P` (`src/app/(auth)/page.js`, mesma técnica de `I`
pro Inventário) ou pelo botão "Status" no menu — uma aba por criatura
EQUIPADA no time (`Party.slot1-3`).

Cada aba mostra: retrato (`SpritePortrait`, mesmo componente do
`StatusHud.jsx`/`PartyHud.jsx`), nível, CP (`stats.cp`, lido direto —
NUNCA recalculado; uma tentativa inicial de recalcular por agregação
genérica quebrou assim que `cp` virou um campo irmão dos seis status
dentro do mesmo `stats`, gerando `NaN`), radar SVG dos seis status de
combate clássicos (HP/ATK/DEF/SpA/SpD/SPD — `energy` fica de fora, não
é um deles, é o substituto da stamina) e tabela base/IV/EV/stat. Sem
`stats` configurado (espécie ainda não migrada), a aba mostra uma
mensagem em vez de tabela vazia, e CP nem aparece.

**Radar** — SVG puro (mesma técnica sem canvas/lib nova que `XpRing`
já usa pro anel de XP), hexágono com escala DINÂMICA por criatura
(maior status dela × 1.15, não um teto fixo) — o sistema de batalha
ainda não tem teto definido. Consultado o skill de dataviz do ambiente
antes de implementar: grade/eixos recessivos, polígono + vértices numa
única cor de destaque (série única = uma criatura de cada vez, sem
precisar de paleta categórica nem validador CVD), rótulo direto em
cada ponta em vez de exigir hover.

**Estilo "Pokédex"** — moldura vermelha + tira de "luzes" no topo, abas
viram botões de dispositivo (`PokedexFrame`, componente interno,
escopo limitado ao `StatsPanel.jsx` — não em `PauseMenu.jsx`/
`MenuView`, compartilhados com Inventário/Configurações).

## Velocidade de animação vinculada à duração da ação

Antes, cada clipe de ação (dash, arremesso, consumo, invocar, recolher,
ataque) tinha um `speed` autorado à mão no próprio JSON do clipe
(`clips/<id>.json`), que precisava ser calibrado manualmente pra bater
com a `duration` configurada daquela ação — dois números independentes,
fáceis de desalinhar (caso real encontrado: `boy/clips/throw.json`
tinha `speed: 1.8`, `actions.throw.duration` era `0.3`, e nem o
comentário ao lado do `duration` batia com nenhum dos dois). Pedido do
usuário, pensando à frente na feature de status `speed`: "antes de
colocar o sistema de speed, a gente não consegue vincular as ações
direto ao tempo da animação?".

Agora `duration` é a única fonte de verdade tanto pra quanto tempo a
ação trava a entidade quanto pra velocidade de playback do clipe: novo
campo `ActionState.animationSpeed` (`core/traits/components/action.js`,
default `1`), gravado como `1 / duration` no exato instante em que cada
ação é disparada (`playerActionSystem.js` — dash/arremesso/consumo;
`partySummonSystem.js` — invocar/recolher; `creatureAttackSystem.js` —
ataque). `view/systems/animationSystem.js` lê esse valor pra estados
`oneShot` (`isOneShotAnimationState`) em vez do `speed` do JSON do
clipe. Estados cíclicos (andar/correr/parado/cair) não mudam,
continuam em `clip.speed || 1` — por isso removidos os campos `speed`
(agora sem uso) dos clipes `oneShot` do `boy` (`fall`/`idle`/`recall`/
`roll`/`run`/`throw`/`walk` tiveram o campo tirado do JSON, edição do
próprio usuário depois da implementação).

A curva sempre toca INTEIRA, não importa a `duration` — as curvas de
osso são periódicas por construção (senoidais, fecham na pose inicial);
mudar a velocidade só reescala o tempo (`freq = speed * TWO_PI`, em
`core/animation/applyAnimationClip.js`), nunca corta o gesto no meio, só
comprime ou estica pra caber exatamente em `duration` segundos.

Com essa fonte única no lugar, o próprio usuário já usou o mecanismo
pra implementar o primeiro caso real de status `speed` afetando ataque:
`bulbasaur`/`charmander`/`squirtle` calculam `attacks.primary.overrides
.duration` via `calculateAttackInterval(speed)` (ver seção de
`stats.js` acima) — o `duration` configurado já é, por si só, tudo que
`ActionState.animationSpeed` precisa pra tocar a animação de ataque na
velocidade certa, sem nenhum código novo no sistema de ataque.

## Outros ajustes de configuração (mesma leva de mudanças)

- **`core/data/attacks/vine-whip/index.js`** — `duration` `0.5s` →
  `0.2s`, `effectAt` `0.25s` → `0.1s` (retunado, sem relação direta com
  o mecanismo acima).
- **`wolf/index.js`** — `vitals.jumpStaminaCost` `10` → `3`.
- **`007-squirtle/index.js`** — migrado pro novo formato de `stats`
  (mesmo padrão de `bulbasaur`/`charmander`: `LEVEL`/`*_IV`/`*_EV`
  extraídos como consts, `stats.hp`/`.energy`/`.cp`/demais status via
  `core/data/species/stats.js`), `vitals` reduzido a
  `runStaminaDrainPerSecond`/`jumpStaminaCost` (`10` → `3`), e
  `attacks.primary` ganhou `duration`/`effectAt` calculados por
  `calculateAttackInterval` a partir do `speed` da espécie.

## Decisões de design

- **CP lido, nunca recalculado** — `StatsPanel.jsx` confia no valor já
  computado e guardado em `species.stats.cp`, evitando duas fontes de
  verdade pro mesmo número.
- **`animationSpeed` gravado no disparo, não recalculado a cada
  frame** — quem inicia a ação já resolveu `duration` (inclusive
  overrides por criatura) naquele instante; gravar uma vez evita
  duplicar essa resolução na view.
- **`speed` do JSON de clipe não apagado por padrão, só ignorado** — os
  arquivos continuam válidos mesmo sem o campo; remover era opcional,
  cabendo ao usuário limpar quando quisesse (o que ele fez pros clipes
  `oneShot` do `boy`).

## Bugs corrigidos

- **CP como `NaN`** — uma primeira tentativa de agregador genérico
  (`calculateTotalCP`, somando `Object.values(stats)`) quebrou assim
  que `cp` virou um campo irmão NÚMERO dentro do mesmo `stats` objeto
  (os outros são `{base,iv,ev,stat}`) — removida, `StatsPanel.jsx`
  passou a ler `stats.cp` direto.
- **Self-reference em objeto literal** — a primeira tentativa de
  `bulbasaur.stats` referenciava `base`/`iv` irmãos dentro do próprio
  objeto (`ReferenceError`); corrigido extraindo `LEVEL`/`*_IV` como
  consts antes do literal e criando as funções de `stats.js`.
- **Fórmula de status sem o `+5`** — a fórmula original do usuário pros
  status não-HP não tinha o `+5` da fórmula real de Pokémon; adicionado
  e sinalizado como mudança de valor, não silencioso.

## Fora de escopo

- Sistema de nível/XP de verdade — os campos existem só como número de
  exibição.
- IV/EV sorteados por criatura individual (hoje é por módulo/espécie,
  uma vez só).
- Aplicar `calculateAttackInterval`/migração de `stats` em `fox`/`wolf`
  — sistema de batalha delas ainda não foi desenhado.
- Calibração fina do radar/Pokédex (cores, proporção do hexágono) e do
  balanceamento de `calculateAttackInterval`/`calculateCP` — pontos de
  partida, não validados visualmente nem jogando (sandbox sem
  navegador durante toda a sessão).

## Arquivos principais

- `tools/menu/StatsPanel.jsx` — janela de status por aba (retrato + CP
  + radar SVG + tabela base/IV/EV/stat, moldura "Pokédex" própria).
- `core/data/species/stats.js` — `calculateHpStat`/`calculateStat`/
  `calculateEnergyStat`/`calculateCP`/`calculateAttackInterval`.
- `core/traits/components/vitals.js` — `resolveMaxHp`/`resolveMaxStamina`
  (novas, exportadas) e `vitalsFromSpecies` lendo de `species.stats`.
- `core/traits/components/action.js` — `ActionState.animationSpeed`.
- `core/systems/playerActionSystem.js`, `partySummonSystem.js`,
  `creatureAttackSystem.js` — gravam `animationSpeed` no disparo de
  cada ação.
- `view/systems/animationSystem.js` — lê `animationSpeed` em vez de
  `clip.speed` pra estados `oneShot`.
- `src/app/(auth)/page.js` — tecla `P` abre `StatsPanel` direto.
- `tools/menu/PauseMenu.jsx` — botão "Status" + subtela nova.
- `core/data/species/001-bulbasaur`, `004-charmander`, `007-squirtle`,
  `boy` — migrados pro novo formato de `stats`; `squirtle` também
  ganhou `attacks.primary` calculado por `speed`.
- `core/data/attacks/vine-whip/index.js`, `core/data/species/
  wolf/index.js` — retunagem pontual, sem relação direta com o
  mecanismo principal.

## Testes

Suíte completa (`nvm exec 20.20.2 npx vitest run` — Node local
incompatível com o `rolldown` instalado, `nvm` resolve): 435 passando,
10 falhas — todas pré-existentes, sem relação com esta feature (não
tocadas, baseline estável do início ao fim). Rodada focada nos quatro
arquivos diretamente afetados pela vinculação ação↔animação
(`partySummonSystem.test.js`, `playerActionSystem.test.js`,
`animationStateSystem.test.js`, `creatureAttackSystem.test.js`):
80/80 passando, 0 falhas. Lint (`nvm exec 20.20.2 npx eslint`)
conferido a cada mudança — erros remanescentes são formatação
preexistente em edições do próprio usuário, não tocados.

**Não verificado visualmente** — sandbox sem navegador durante toda a
sessão. `StatsPanel`/radar/Pokédex e o resultado em jogo do ataque por
`speed` dependem do usuário conferir.
