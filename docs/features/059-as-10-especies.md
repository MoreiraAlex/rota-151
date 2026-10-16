# 🚀 Versão 0.0.59 — As 10 espécies

## Resumo

Deixar as 10 espécies da beta completas: os 3 iniciais (Bulbasaur,
Charmander, Squirtle), que já existem e só vêm no kit inicial, e as 7
selvagens novas (Caterpie, Weedle, Pidgey, Rattata, Spearow, Ekans e
Pikachu), com modelo, status, golpes, sons e animações.

Primeiro passo: montar uma **checklist comum** a partir do que os iniciais
já têm, conferir os próprios iniciais contra ela e só então replicar nas
outras 7. A checklist só tem o que vale para toda espécie; o que é de uma
espécie só (fogo de cauda, voo, rastejar...) fica fora dela e é tratado na
parte da espécie.

Versão: `0.0.59` (`package.json`). Branch: `feature/059-as-10-especies`.

---

## Checklist comum de uma espécie

Quase tudo mora em `core/data/species/<NNN>-<id>/index.js` (molde em
`_template/`; o Weedle, `013-weedle/`, é o exemplo mais recente). Os campos
abaixo seguem a ordem do arquivo. Uma espécie por vez: fecha uma (o usuário
confere no jogo e nos laboratórios) antes de começar a próxima.

### Passo a passo de uma espécie nova

1. **Modelo** — Weedle, Pidgey, Ekans e Pikachu vêm do dump do Legends: Z-A
   (`.exemple/RawAssets/Legends/pm<dex>`), pelo conversor dos iniciais
   (Blender do Windows, headless, saída num scratchpad e depois copiada):
   `blender.exe --background --python scripts/blender/convert-pokemon.py --
   --dex <n> --src <Legends> --out <pasta> --name <id>` (caminhos em
   formato Windows, `wslpath -w`). Sai o `.glb` com as mesmas animações dos
   iniciais e as texturas `pm<dex>_00_00_<material>_alb.png`. Caterpie,
   Rattata e Spearow só existem no LGPE: `node scripts/lgpe/unpack-pokemon.js
   --src <bin/pokemon/pm<dex>_00> --out <trabalho>` (texturas em PNG e
   `materials.json`) e depois `blender.exe --background --python
   scripts/blender/convert-pokemon-lgpe.py -- --src <mesma pasta> --textures
   <trabalho> --out <pasta> --name <id>` (`.glb` e texturas assadas; ver
   Partes 14 e 15).
2. **Dados da série** — status, tipos, XP base, curva e captura na PokeAPI
   (`pokemon/<id>` e `pokemon-species/<id>`; a Bulbapedia bloqueia acesso
   automático). Learnset por nível até o 12 (teto da beta): o do
   Scarlet/Violet; sem a espécie lá, o da geração mais recente que a tiver.
   No kit, os golpes até o nível inicial; o resto no `moves`.
3. **Golpes que faltarem** — entram em `core/data/skills/<id>/` com os dados
   da série e VFX/som emprestados de um golpe parecido (impacto genérico do
   tipo com `audio.group: 'impact'`); efeito que o jogo não tem fica de fora
   e vai pra 088. A tabela de tipos é a da Gen 1 (sem Sombrio, Aço, Fada).
4. **Grito** — `.exemple/P3D Real Cries/Sounds/Cries/<dex>.wav` →
   `public/assets/audio/voices/<NNN>-<id>/cry-01.wav`.
5. **Registrar** no `SPECIES_REGISTRY` e pôr na lista provisória de
   selvagens (`WILD_CREATURE_SPECIES`, `core/data/testLevel.js`) até a 060.
   Ela entra sozinha no inventário do usuário ao carregar o save (Parte 6).
6. **Valores de partida** de corpo, câmera e comer pelo tamanho do modelo;
   o usuário acerta no laboratório de corpo (`/tools/lab-corpo`) e no jogo.
   O grito animado (`clips.cry`) é revisado no laboratório de animação
   (`/tools/lab-animacao`).
7. **Fechar** — anotar a parte da espécie neste doc e marcar como fechada
   quando o usuário aprovar.

### 1. Registro e identidade
- [ ] Pasta `species/<NNN>-<id>/` com `index.js` (e `clips/` se tiver `cry`)
- [ ] Import e linha no `SPECIES_REGISTRY` (`species/index.js`)
- [ ] `id`, `dexNumber`, `kind: 'pokemon'`
- [ ] `types` (1 ou 2)

### 2. Progressão e captura
- [ ] `level` inicial
- [ ] `baseXp`
- [ ] `growthRate`
- [ ] `capture.rate`
- [ ] `stats`: `base` e `ev` de hp, attack, defense, sp_atk, sp_def e speed
      (`ev` é o treino da criatura; fica zerado até o treino existir)
- [ ] `stats.hp.regenPercent`/`regenDelay` e `stats.energy.regenPercent`/`regenDelay`

### 3. Retrato
- [ ] `sprite.path` (retrato da HUD, Pokédex e wiki; o GIF do Showdown serve)

### 4. Modelo
- [ ] `.glb` em `public/assets/models/<NNN>-<id>.glb`, com as animações embutidas
- [ ] Texturas em `public/assets/textures/<NNN>-<id>/default/`
- [ ] `model.path`, `model.scale`
- [ ] `model.texture` por índice de material (conferido no navegador)

### 5. Corpo, câmera e movimento
- [ ] `body`: `capsuleRadius`, `capsuleHalfHeight`, `capsuleAxis`, `modelOffset`
- [ ] `camera`: `targetHeight`, `shoulderOffset`
- [ ] `movement`: `walkSpeed`, `runSpeed`, `turnSpeed`, `jumpSpeed`
- [ ] `vitals`: `runStaminaDrainPerSecond`, `jumpStaminaCost`

### 6. Animações (`nativeAnimations`)
- [ ] Locomoção: `idle`, `walk`, `run`, `jump`, `fall`, `dash`
- [ ] Estados: `battleIdle`, `rest` (start/loop/end), `eat` (start/loop/end), `faint` (start/loop/end)
- [ ] Reações: `hit`, `appeal` (+ `actions.appeal.duration`)
- [ ] Variações de ataque: `attack`, `attackAlt`, `attackRanged`, `attackRangedAlt`, `roar`
      (todas mapeadas; cada golpe escolhe a sua pelo `animation.clipKey`)
- [ ] `nativeBlink` (piscar)
- [ ] `clips.cry` (boca sincronizada com o grito) — opcional: sem boca ou
      pequena demais pra notar (ex.: Weedle), fica sem

### 7. Som
- [ ] Grito do P3D (`.exemple/P3D Real Cries/Sounds/Cries/<dex>.wav`) em
      `public/assets/audio/voices/<NNN>-<id>/cry-01.wav`
- [ ] `sounds.voice` (clips + volume, alcance e intervalo)
- [ ] `sounds.footstepGroup` (`light`, `medium`, `crawl` — sem pernas/corpo
      no chão — ou `bird` — aves)
- [ ] `sounds.dashGroup`, `sounds.jumpGroup`

### 8. Golpes
- [ ] `skills` 1, 2 e 3 (Q/E/R), com os overrides de cada um
- [ ] `moves` (learnset), com `requires.level`
- [ ] `visual.positionOffset` de cada golpe (de onde ele sai: boca, cauda...),
      por override na espécie quando precisar — ajustado no jogo
- [ ] Cada golpe novo: dado em `core/data/skills/<id>/`, VFX em
      `view/scene/attackEffects/` e sons `attack/<id>-actor|target`

### 9. Comer
- [ ] `vfx.eatFood` (`hands` ou `ground`, posição, rotação e escala)

### 10. Selvagem
- [ ] `wild.hostileChance` — pelo temperamento da espécie na série (a
      Pokédex: se ataca ou só se defende)
- [ ] Condições de spawn (bioma, horário, clima, nível, raridade) — fica para a 060

A wiki, a Pokédex e a tela de status se montam a partir do registro: não
há item para elas.

---

## Os iniciais contra a checklist

✅ completo · ⚠️ existe, mas falta algo · ❌ falta

| Item | Bulbasaur | Charmander | Squirtle |
|---|---|---|---|
| 1. Registro e identidade | ✅ | ✅ | ✅ |
| 2. Progressão e captura | ✅ | ✅ | ✅ |
| 3. Retrato | ✅ | ✅ | ✅ |
| 4. Modelo | ✅ | ✅ | ✅ |
| 5. Resto do corpo, câmera e movimento | ✅ | ✅ | ✅ |
| 6. Locomoção, estados e reações | ✅ | ✅ | ✅ |
| 6. Variações de ataque | ✅ | ✅ | ✅ |
| 6. Piscar e grito (`cry`) | ✅ | ✅ | ✅ |
| 7. Som | ✅ | ✅ | ✅ |
| 8. Kit (`skills`) | ✅ | ✅ | ✅ |
| 8. Learnset (`moves`) | ✅ | ✅ | ✅ |
| 9. Comer | ✅ | ✅ | ✅ |
| 10. `wild.hostileChance` | — não se aplica | — não se aplica | — não se aplica |

Notas:
- O `whirlpool` existe no registro de golpes, mas nenhuma espécie usa
  (candidato ao learnset do Squirtle).
- `wild.hostileChance` só importa para quem nasce selvagem. Na beta os
  iniciais não nascem (vêm só no kit inicial), então o item não se aplica
  a eles.

### Pendências dos iniciais (entram nesta feature)

Uma espécie por vez, começando pelo Bulbasaur. Corpo, câmera e movimento
iguais nos três está correto.

- [x] **Variações de ataque do Bulbasaur**: mapear `attack` e
      `attackRangedAlt` (e tirar o `attackBasic`, que nada usa)
- [x] **Golpes até o nível 12** (o teto da beta 0.1), seguindo o learnset
      do Scarlet/Violet na Bulbapedia: kit + `moves` com `requires.level`

> **Golpes nesta feature:** golpe que faltar entra no registro com valores
> padrão (dados da série, VFX e som emprestados de um golpe parecido). O
> refino de cada golpe (VFX, som, forma, animação) fica para outra feature
> (Marco 5, 088).

---

## Parte 1 — Bulbasaur

Golpes até o nível 12 (Scarlet/Violet). Os níveis abaixo são os da série;
o valor de verdade é o do `requires.level` em `001-bulbasaur/index.js`.

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Tackle | kit | ✅ |
| 1 | Growl | kit | ✅ |
| 3 | Vine Whip | kit | ✅ |
| 6 | Growth | learnset | ✅ |
| 9 | Leech Seed | learnset | ✅ |
| 12 | Razor Leaf | learnset | ✅ |

- [x] `requires.level` no Growth e no Leech Seed; Razor Leaf entrou no
      learnset
- [x] `accuracy` do Razor Leaf (o único da lista sem o valor da série)
- [x] Variações de ataque conferidas pelo usuário; o Tackle segue na
      variação extra `attackBasicAlt`, só do Bulbasaur
- [x] **Fechado.** O `positionOffset` de cada golpe e os golpes do learnset
      no jogo (ex.: Razor Leaf no nível 12) ficam pra 088

## Parte 2 — Charmander

Golpes até o nível 12 (Scarlet/Violet, conferido na PokeAPI — a
Bulbapedia bloqueia acesso automático). Os níveis abaixo são os da série;
o valor de verdade é o do `requires.level` em `004-charmander/index.js`.

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Scratch | kit (no lugar do Tackle) | ✅ novo, valores padrão |
| 1 | Growl | kit | ✅ |
| 4 | Ember | kit | ✅ |
| 8 | Smokescreen | learnset | ✅ |
| 12 | Dragon Breath | learnset | ✅ novo, valores padrão |
| 24 | Flamethrower | learnset | ✅ fica com o nível da série (fora do alcance da beta) |

- [x] Scratch (`core/data/skills/scratch/`): VFX do grupo `scratch`, som de
      impacto, mesma variação de ataque do Tackle
- [x] Dragon Breath (`core/data/skills/dragon-breath/`): VFX e som da Brasa;
      a chance de paralisar fica de fora até existir paralisia
- [x] **Fechado.** O `positionOffset` dos golpes (Ember, Smokescreen e
      Flamethrower saem à frente do corpo desde a Parte 3) e os golpes novos
      no jogo ficam pra 088

## Parte 4 — Squirtle

Golpes até o nível 12 (Scarlet/Violet, conferido na PokeAPI). Os níveis
abaixo são os da série; o valor de verdade é o do `requires.level` em
`007-squirtle/index.js`.

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Tackle | kit | ✅ |
| 1 | Tail Whip | kit | ✅ |
| 3 | Water Gun | kit | ✅ |
| 6 | Withdraw | learnset | ✅ novo, valores padrão |
| 9 | Rapid Spin | learnset | ✅ novo, valores padrão |
| 12 | Bite | learnset | ✅ novo, valores padrão |

- [x] Withdraw (`core/data/skills/withdraw/`): sobe a Defesa de quem usa,
      no formato do Growth (`area: 'self'`), VFX e som do "atributo subiu"
- [x] Rapid Spin (`core/data/skills/rapid-spin/`): forma, VFX e som do
      Tackle; a subida de Velocidade de quem usa fica de fora (golpe com dano
      ainda não mexe no próprio atributo)
- [x] Bite (`core/data/skills/bite/`): forma e VFX do Scratch; tipo Normal,
      como na Gen 1 (a tabela de tipos do jogo não tem Sombrio); a chance de
      fazer recuar fica de fora
- O Whirlpool continua no registro sem espécie que use.
- [x] **Fechado.** O `positionOffset` do Water Gun (sai à frente do corpo
      desde a Parte 3) e os golpes novos no jogo ficam pra 088

## Parte 3 — De onde o golpe sai (por golpe, não por espécie)

O `body.attackOriginHeight` (altura por espécie) saiu: ele valia pra todos os
golpes da espécie (a mordida e a rabada de um Onix sairiam da mesma altura).
Agora o `visual.positionOffset` de cada golpe é a origem do golpe no jogo
todo, não só no desenho:

- **Core** (`resolveAttackOrigin`, `core/battle/attackGeometry.js`): centro
  do corpo + `positionOffset` no referencial do golpe. Dano, alvos (golpe
  normal, de efeito, cone e canalizado) partem daí.
- **Alcance** (`resolveAttackReach`): o `range` continua contado do centro
  do corpo — empurrar a saída pra frente não aumenta o alcance. Decisão do
  usuário.
- **View**: o aviso no chão, o VFX do impacto e o jato contínuo usam a mesma
  origem; o VFX não aplica mais o offset por conta própria.
- **`rotationOffset`** continua só visual (corrige a orientação da malha do
  VFX; não gira a trajetória). Decisão do usuário.
- O efeito da AÇÃO (Tail Whip) não muda: o `positionOffset` dele já era o
  pivô à frente do corpo.

- [x] Origem e alcance no core; impacto, canalizado e alvos de efeito usando
- [x] Aviso no chão e jato contínuo usando a mesma origem
- [x] `attackOriginHeight` removido (código, moldes e iniciais)
- [x] Testes da origem/alcance e do golpe com `positionOffset`

## Fontes dos modelos das 7 selvagens

Achadas em `.exemple/RawAssets/` (não só no LGPE, como o roadmap previa):

| Espécies | Fonte | Caminho |
|---|---|---|
| Weedle, Pidgey, Ekans, Pikachu | `Legends/` — dump do Legends: Z-A, o mesmo dos iniciais | `scripts/blender/convert-pokemon.py --dex <n>`: mesmas animações, a checklist fecha inteira |
| Caterpie, Rattata, Spearow | só o LGPE (`.exemple/ambient/LGPE/`) | conversor novo: texturas `.bntx`, ~20 animações (sem `rest`, `appeal`, `roar` e com 1–2 de ataque); o addon do Blender importa `.gfbmdl`/`.gfbanm` |

Ordem combinada: primeiro as 4 do Z-A, as 3 do LGPE no fim.

## Parte 5 — Weedle

- **Modelo**: `public/assets/models/013-weedle.glb` (53 animações, só falta
  `staticPose`, que os iniciais também não usam) e texturas em
  `public/assets/textures/013-weedle/default/` (corpo e olho). Escala igual
  à dos iniciais: o Weedle fica pequeno, como na série.
- **Grito**: um só, do P3D (`.exemple/P3D Real Cries/Sounds/Cries/13.wav`
  → `cry-01.wav`). Sem grito animado (`clips.cry`): não tem boca e é
  pequeno demais pra notar — decisão do usuário.
- **Status, captura e XP** da série (PokeAPI).
- **Golpes** (o Weedle não está no Scarlet/Violet; learnset da Gen 6 em
  diante, igual no Brilliant Diamond/Shining Pearl):

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Poison Sting | kit | ✅ novo, valores padrão (impacto do tipo) |
| 1 | String Shot | kit | ⚠️ novo, sem efeito: o jogo não tem estágio de Velocidade |
| 9 | Bug Bite | learnset | ✅ novo, valores padrão (forma e VFX do Scratch) |

- O kit tem só 2 golpes (o 3º slot fica vazio): o Bug Bite só vem no 9.
- **Comer**: do chão, embaixo da cabeça (sem mãos).
- **Selvagem**: `wild.hostileChance` baixo — na série ele usa o ferrão pra
  se defender (o agressivo é o Beedrill): a maioria nasce pacífica.
- **Corpo e câmera**: cápsula deitada, valores de partida pelo tamanho do
  modelo — ajustar no jogo.
- Entrou na lista provisória de selvagens do nível de teste
  (`testLevel.js`) pra aparecer no jogo até o spawn da 060.

- [x] Conferido pelo usuário: corpo (no laboratório), movimento, câmera,
      comer, passo `crawl`, volume e intervalo do grito
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset`, o
      envenenamento do Poison Sting e o String Shot sem efeito) fica pra 088;
      o spawn, pra 060

## Parte 6 — Espécie nova no inventário (kit de teste)

Pedido do usuário: toda espécie nova vai pro inventário dele, pra testar os
controles. O kit de teste já dava um Pokémon de cada espécie, mas só pra quem
não tinha save. Agora, ao carregar um save, cada espécie `kind: 'pokemon'`
que o treinador ainda não tem entra no inventário (enquanto houver célula
livre) e o jogo pede um save (`completarEspeciesDeTeste`,
`core/actions/startingKit.js`). Sai junto do kit de teste na 066.

- [x] `completarEspeciesDeTeste` chamado no `prepararTreinador` com save
- [x] Teste: save sem uma espécie → ela entra no inventário e pede save

## Parte 7 — Gritos do P3D e laboratório de animação

- **Gritos**: decisão do usuário — o grito de toda espécie nova vem de
  `.exemple/P3D Real Cries/Sounds/Cries/<dex>.wav` (um por número da
  Pokédex), copiado como `cry-01.wav`. Os 3 iniciais ficam com os deles.
  Item 7 da checklist: o grito sai daí.
- **Laboratório de animação** (`/tools/lab-animacao`, `tools/animationLab/`,
  fora do jogo): escolhe a espécie e uma animação do `.glb` (com a legenda
  das chaves do jogo que a tocam), que roda em loop com velocidade
  ajustável. O grito (`clips.cry`) toca por cima do mesmo jeito que no jogo
  (`mouthSyncSystem.js`), em loop ou junto do som (com pausa entre uma vez e
  outra). O clipe é editável ao vivo: trilhas por osso/propriedade/eixo,
  termos (constante, senos) com slider e número, o desvio máximo de cada
  trilha na tela, e "Copiar JSON" pra levar ao `cry.json`.

- [x] Grito do Weedle trocado pelo do P3D
- [x] Laboratório, com teste das funções de edição do clipe
- [x] `cry.json` do Weedle revisado: saiu (sem boca, pequeno demais)

## Parte 8 — Passo de rastejar

Grupo de passo novo `crawl` (`core/data/audio/footstepGroups.js`), pra
criatura sem pernas ou de corpo no chão: a biblioteca `.exemple/Steps/` não
tem som de rastejar, então saiu do arrastado macio em carpete
(`CarpetFootstepsScuff` andando, `CarpetFootstepsScrape` correndo), com
volume e alcance do `light`. O Weedle passou a usar.

- [x] Grupo `crawl` em `public/assets/audio/footsteps/crawl/`
- [ ] Usuário ouvir no jogo com o Weedle (alternativas na biblioteca:
      `JacknifeFootstepsScuffSoft`, `ConcreteFootStepSneak`)

## Parte 9 — Limiar de andar pra correr por espécie

A animação passava de andar pra correr num limiar global
(`GAME_CONFIG.ANIMATION.RUN_MIN_SPEED`), mas cada espécie tem as próprias
velocidades. Primeiro virou um campo por espécie (`movement.runMinSpeed`);
depois, a pedido do usuário, saiu de vez: o limiar é o meio entre o
`walkSpeed` e o `runSpeed` da criatura (`resolveRunMinSpeed`,
`core/data/animationStates.js`), lido do `MovementStats` pelo
`animationStateSystem`. Acompanha as velocidades de cada espécie sem número
próprio; o global saiu do `GAME_CONFIG`.

- [x] `resolveRunMinSpeed` no `animationStateSystem`; campo e global removidos
- [x] Teste: o limiar fica entre andar e correr; sem velocidades, não corre

## Parte 10 — Laboratório de corpo

Pedido do usuário: um laboratório como o de animação, pra definir o `body`.
Página `/tools/lab-corpo` (`tools/bodyLab/`, fora do jogo): o modelo da
espécie com a cápsula de colisão por cima, no chão, montados como no jogo
(centro da cápsula acima do chão o quanto ela desce + a folga do character
controller; modelo no centro + `modelOffset`), com uma animação da espécie
em loop e giro. Ajusta ao vivo o eixo, o raio e a meia altura da cápsula, o
`modelOffset` e o `model.scale`; mostra as medidas (cápsula, pé do modelo em
relação ao chão na pose atual, altura/comprimento/largura do modelo); o
botão "Encostar o modelo no chão" acerta o `modelOffset.y`; "Copiar body"
leva o trecho pro `index.js`.

O carregamento do modelo (texturas, toon, animação em loop) saiu do lab de
animação pra um hook comum (`tools/animationLab/useSpeciesModel.js`).

- [x] Laboratório de corpo, com teste das contas
- [x] Lab de animação usando o hook comum
- [x] `body` do Weedle acertado pelo usuário

## Parte 11 — Pidgey

- **Modelo**: `public/assets/models/016-pidgey.glb` (52 animações; faltam
  `battleIdleAlt` e `staticPose`, que nada usa) e texturas em
  `public/assets/textures/016-pidgey/default/` (dois materiais de corpo em
  duas partes cada, e o olho). Escala igual à dos iniciais.
- **Asas**: o dump tem as asas abertas (no corpo) e as fechadas (malhas à
  parte, com a textura do corpo). A aberta some pela escala dos ossos, que
  já vem no `.tranm`; a fechada só some pela trilha de visibilidade de
  malha do `.tracm`, que o addon não importa — no jogo as duas apareciam
  juntas. O conversor (`convert-pokemon.py`) passou a ler o `.tracm`
  (valor fixo, um bit por quadro ou quadros-chave) e, como o glTF não tem
  visibilidade animada, esconde a malha com escala quase zero em todos os
  ossos que só ela usa (no Pidgey, o ramo `wing_b`). Todos, não só o do
  topo: com só o pai encolhido, o exportador compensava o filho com a
  escala inversa e o Three, interpolando os dois em separado, deixava a asa
  gigante na frente da câmera nas transições. O piscar fica de fora (toca
  por cima). Sobra 1–2 quadros sem asa nenhuma no fim de alguns clipes: o dump
  recolhe a aberta um pouco antes de mostrar a fechada.
- O dump também tem um conjunto de animações de voo (`2xxxx`), que fica de
  fora: o jogo não tem voo.
- **Grito**: um só, do P3D (`16.wav` → `cry-01.wav`). Grito animado
  (`clips.cry`) no bico (`lower_jaw`), com a curva do Charmander como ponto
  de partida — revisar no laboratório de animação.
- **Status, captura e XP** da série (PokeAPI).
- **Golpes** (o Pidgey não está no Scarlet/Violet; learnset da Gen 6 em
  diante, igual no Brilliant Diamond/Shining Pearl):

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Tackle | kit | ✅ |
| 5 | Sand Attack | kit | ✅ novo, valores padrão (forma, VFX e som do Smokescreen; baixa a precisão) |
| 9 | Gust | learnset | ✅ novo, valores padrão (forma da Brasa, impacto do tipo) |

- O kit tem só 2 golpes (o 3º slot fica vazio): o Gust só vem no 9.
- **Comer**: do chão, embaixo do bico (sem mãos).
- **Selvagem**: `wild.hostileChance` baixo — na série ele é dócil e, atacado,
  joga areia pra se proteger em vez de revidar.
- **Corpo, câmera e movimento**: cápsula em pé, valores de partida pelo
  tamanho do modelo (entre o Weedle e os iniciais) — ajustar no laboratório
  e no jogo. Passo `bird` (grupo novo, de ave: unha batendo, saiu do
  `PipeThickHandstep` — o `light`, de metal, não combinou).
- Entrou na lista provisória de selvagens do nível de teste.
- **Grito animado preso**: a boca ficava aberta depois do grito até trocar
  de animação. O `mouthSyncSystem` contava com a animação de base pra
  devolver o bico, mas o mixer do Three só reescreve um osso quando o valor
  da trilha muda — e o bico do Pidgey fica parado no idle (a mandíbula do
  Charmander se mexe, por isso lá não aparecia). Agora a pose dos ossos do
  grito é fotografada quando ele começa e devolvida quando acaba
  (`capturePose`/`restorePose`), no jogo e no laboratório de animação.

- [x] Texturas por índice de material conferidas no navegador
- [x] Conferido pelo usuário: corpo (no laboratório), movimento, câmera,
      comer, passo `bird`, volume e intervalo do grito, `cry.json`
- [x] Boca volta pra pose da animação depois do grito (teste no
      `mouthSyncSystem`)
- [x] Usuário conferiu as asas com o `.glb` novo e a boca depois do grito
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset`) fica pra
      088; o spawn, pra 060

## Parte 12 — Ekans

- **Modelo**: `public/assets/models/023-ekans.glb` (53 animações, só falta
  `staticPose`) e texturas em `public/assets/textures/023-ekans/default/`
  (dois materiais de corpo e o olho). Escala igual à dos iniciais. A pose de
  repouso do `.glb` é a cobra esticada; no idle ela fica enrolada.
- **Grito**: um só, do P3D (`23.wav` → `cry-01.wav`). Grito animado
  (`clips.cry`) na mandíbula (`lower_jaw`, mesmo eixo do Pidgey), com a
  curva do Pidgey como ponto de partida e a abertura reduzida: no Ekans a
  boca fechada fica bem abaixo da pose de repouso, e a do Pidgey
  escancarava.
- **Status, captura e XP** da série (PokeAPI; o grupo "medium" da PokeAPI é
  o `medium-fast` do jogo).
- **Golpes** (learnset do Scarlet/Violet):

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Wrap | kit | ✅ novo, valores padrão (forma, VFX e som do Tackle; prender o alvo fica de fora) |
| 1 | Leer | kit | ✅ novo, valores padrão (forma e VFX do Growl; baixa a Defesa como o Tail Whip) |
| 4 | Poison Sting | kit | ✅ |
| 9 | Bite | learnset | ✅ |
| 12 | Glare | learnset | ⚠️ novo, sem efeito: o jogo não tem paralisia |

- **Comer**: do chão, embaixo da boca (sem mãos).
- **Selvagem**: `wild.hostileChance` médio — na série ele caça em silêncio e
  dá o bote; mais agressivo que o Weedle e o Pidgey.
- **Corpo, câmera e movimento**: cápsula deitada ao longo do corpo,
  acertada pelo usuário no laboratório e no jogo. Passo `crawl`, como o
  Weedle.
- Entrou na lista provisória de selvagens do nível de teste.

- [x] Texturas por índice de material conferidas no navegador
- [x] Conferido pelo usuário: corpo (no laboratório), movimento, câmera,
      comer, passo `crawl`, volume e intervalo do grito, `cry.json`
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset`, prender
      do Wrap, o olhar do Leer e o Glare sem efeito) fica pra 088; o spawn,
      pra 060

## Parte 13 — Pikachu

- **Modelo**: `public/assets/models/025-pikachu.glb` (52 animações; faltam
  `battleIdle` e `staticPose`) e texturas em
  `public/assets/textures/025-pikachu/default/` (quatro materiais de corpo e
  o olho). Forma macho do dump (`pm0025_00_00`; a fêmea, de cauda em
  coração, é a `01_00`). Escala igual à dos iniciais. Cada olho, a ponta da
  cauda e a língua são malhas à parte, com as texturas do corpo (9 entradas
  no `model.texture`).
- **Espera de batalha**: o dump não tem a principal; o `battleIdle` usa a
  outra (`battleIdleAlt`).
- **Grito**: um só, do P3D (`25.wav` → `cry-01.wav`). Grito animado
  (`clips.cry`) na mandíbula (`lower_jaw`, mesmo eixo do Pidgey); no
  Pikachu a pose de repouso já é a boca fechada do idle, então a curva do
  Pidgey entrou com a abertura reduzida — revisar no laboratório de
  animação.
- **Status, captura e XP** da série (PokeAPI).
- **Golpes** (learnset do Scarlet/Violet). Lá ele nasce com 9 golpes de
  nível 1 (herança do Pichu); decisão do usuário: o kit fica com Thunder
  Shock, Quick Attack e Tail Whip, e os outros de nível 1 (Growl, Charm,
  Nasty Plot, Nuzzle, Play Nice, Sweet Kiss) ficam de fora.

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Thunder Shock | kit | ✅ novo, valores padrão (forma da Brasa, impacto do tipo; paralisar fica de fora) |
| 1 | Quick Attack | kit | ✅ novo, valores padrão (forma, VFX e som do Tackle; a prioridade não tem equivalente) |
| 1 | Tail Whip | kit | ✅ |
| 4 | Thunder Wave | learnset | ⚠️ novo, sem efeito: o jogo não tem paralisia |
| 8 | Double Team | learnset | ⚠️ novo, sem efeito: o jogo não tem estágio de Evasão |
| 12 | Electro Ball | learnset | ✅ novo, valores padrão (forma da Brasa; poder fixo, não pela Velocidade) |

- **Comer**: com as mãos, como o Charmander.
- **Selvagem**: `wild.hostileChance` entre o Pidgey e o Ekans — na série
  ele é arisco e dá choque quando se sente ameaçado.
- **Corpo, câmera e movimento**: cápsula em pé, valores de partida pelo
  tamanho do modelo (um pouco menor que o Charmander); mais rápido que os
  iniciais, como na série. Passo `medium`, como os iniciais.
- Entrou na lista provisória de selvagens do nível de teste.

- [x] Texturas por índice de material conferidas no navegador
- [x] Conferido pelo usuário: corpo (no laboratório), movimento, câmera,
      comer, passo, volume e intervalo do grito, `cry.json`
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset`, a
      paralisia do Thunder Shock e do Thunder Wave, a Evasão do Double Team
      e o poder do Electro Ball pela Velocidade) fica pra 088; o spawn, pra
      060

## Parte 14 — Caterpie (o primeiro do LGPE)

O Caterpie não está no dump do Z-A: modelo, animações e texturas vêm do
Let's Go (`LGPE-Poke.zip` e `LGPE-PokeAnim.zip`, pasta
`bin/pokemon/pm0010_00/`, extraída num scratchpad). O caminho vale para o
Rattata e o Spearow.

- **Modelo e animações** (`scripts/blender/convert-pokemon-lgpe.py`): o addon
  do Blender importa o `.gfbmdl` (malha e rig) e os `.gfbanm`, mas não as
  texturas. O conversor:
  - passa tudo de centímetros para metros com a escala aplicada (malha, rig
    e a translação dos ossos nas animações) — com a escala só no nó raiz, a
    matriz de bind ficava multiplicada e o Three encolheria o modelo; o
    `.glb` sai com a mesma estrutura dos do Z-A (só a rotação na raiz);
  - descarta o deslocamento do osso `Origin` (andar e correr trazem o passo
    embutido; no jogo quem anda é o corpo físico);
  - leva todos os clipes para o mesmo fps (andar e correr vêm num, o resto
    em outro, e o addon troca o fps da cena a cada import);
  - junta os materiais que usam a mesma textura (`Body00`/`Body01` → `body`)
    e tira o segundo UV e a cor por vértice (dado do shader no LGPE).
- **Texturas** (`bntx.js` e `bc7.js` em `scripts/lgpe/`): o `.bntx` vem no
  layout de blocos da GPU do Switch e em BC7; os dois agora são lidos em
  Node, sem dependência (o BC7 também serve para os `.dds` dos mapas). O
  material do LGPE repete a textura espelhada em U. No Caterpie a primeira
  versão gravou a textura com as duas metades lado a lado; a partir do
  Rattata (Parte 15) as texturas saem do bake no Blender, que cobre os
  olhos — a do Caterpie foi refeita pelo bake como conferência e bateu com
  a aprovada, e ficou a aprovada.
- **Animações** (decisão do usuário, mapeamento do dump):

| Jogo | LGPE |
|---|---|
| `idle` / `walk` / `run` | `fi01_wait01` / `fi20_walk01` / `fi21_run01` |
| `battleIdle` | `ba10_waitA01` |
| `jump` / `fall` | `ba01_landA01` (subindo) / `ba01_landB01` (no ar) |
| `attack`, `attackAlt`, `attackRanged`, `attackRangedAlt` | `ba21_tokusyu01` (o único ataque) |
| `hit` | `ba30_damageS01` |
| `faint` | `ba41_down01`, só o `start` (segura o último quadro) |
| `rest` start/loop/end | `kw20_drowseA/B/C01` |
| `eat` start/loop/end | `kw50_eatA/B/C01` |
| `appeal` / `roar` | `kw32_happyB01` / `kw30_hate01` |
| `dash` | `ba01_landA01`, o mesmo do `jump` (o dump não tem dash; escolha do usuário no jogo) |

  Também ficam no `.glb`, para o laboratório: `idleAlt` (`kw33_moveC01`),
  `jumpStart` (`ba01_jump01`) e `land` (`ba01_landC01`).
- **Piscar**: não se aplica — o Caterpie não pisca no LGPE (sem material
  nem animação de olho; o olho é pintado na textura do corpo — ver
  Parte 17).
- **Grito**: um só, do P3D (`10.wav` → `cry-01.wav`). Sem grito animado
  (`clips.cry`): boca pequena demais pra notar, como o Weedle.
- **Status, captura e XP** da série (PokeAPI; o grupo "medium" é o
  `medium-fast` do jogo).
- **Golpes** (o Caterpie não está no learnset do Scarlet/Violet da PokeAPI;
  o do Sword/Shield, igual no Brilliant Diamond/Shining Pearl). Todos já
  existem no jogo:

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Tackle | kit | ✅ |
| 1 | String Shot | kit | ⚠️ sem efeito: o jogo não tem estágio de Velocidade |
| 9 | Bug Bite | learnset | ✅ |

- O kit tem só 2 golpes (o 3º slot fica vazio): o Bug Bite só vem no 9.
- **Comer**: do chão, embaixo da boca (`EffMouth01`, o ponto da boca do rig
  do LGPE).
- **Selvagem**: `wild.hostileChance` baixo — na série ele só se defende,
  soltando um cheiro ruim pelas antenas.
- **Corpo, câmera e movimento**: valores de partida do Weedle (mesmo
  tamanho) — ajustar no laboratório e no jogo. Passo `crawl`.
- Entrou na lista provisória de selvagens do nível de teste.

- [x] Leitor de `.bntx` + BC7 e o script das texturas
- [x] Conversor do Blender para o LGPE (escala, `Origin`, fps, materiais)
- [x] Espécie registrada, grito, lista de selvagens
- [x] Conferido pelo usuário: textura (orientação e espelho), frente do
      modelo, animações, corpo, movimento, câmera, comer, passo e grito
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset` e o
      String Shot sem efeito) fica pra 088; o spawn, pra 060

## Parte 15 — Rattata

- **Texturas pelo bake**: os olhos do Rattata usam UV fora de 0..1 e um
  atlas de expressões (aberto, piscando, fechado), com buracos onde a íris
  (`Iris_col`, uma segunda camada do material, com outra escala de UV)
  aparece por baixo. Esticar a textura em Node não dá conta disso, então o
  caminho passou a ser o do Z-A: o `scripts/lgpe/unpack-pokemon.js` só
  converte os `.bntx` usados em PNG e grava os parâmetros de cada material
  (`materials.json`: textura de cor e da camada, escala e deslocamento de
  UV, repetição por eixo); o conversor do Blender monta um material com a
  mesma conta de UV do jogo original (repetir/espelhar por eixo), põe a
  camada por baixo onde a cor é transparente e assa a cor final num UV
  novo: o original com cada face deslocada para dentro de 0..1. Fica a
  expressão padrão (olho aberto). O deslocamento `base` da íris é ignorado
  (o olhar sai natural sem ele).
- **Modelo**: `public/assets/models/019-rattata.glb` e texturas em
  `public/assets/textures/019-rattata/default/` (corpo e olho; os bigodes
  são uma malha à parte com a textura do corpo). Escala igual à dos outros.
- **Animações**: o mesmo mapeamento do Caterpie, com duas diferenças do
  dump: tem ataque físico (`ba20_buturi01` → `attack`; o especial
  `ba21_tokusyu01` → `attackRanged`) e não tem as de dormir (o `rest` cai
  no idle) nem a `kw33_moveC01`. O `dash` usa o `jumpLoop`, como o
  Caterpie. Também entra o clipe `mouth` (`mouth01`, boca abrindo e
  fechando), que não toca no jogo: é a referência do grito animado.
- **Piscar**: por textura, como no LGPE (Parte 17).
- **Grito**: um só, do P3D (`19.wav` → `cry-01.wav`). Grito animado
  (`clips.cry`) na mandíbula (`Jaw`): pelo `mouth01`, ela gira no eixo Y
  local, fechada bem longe da pose de repouso e aberta perto dela; a curva
  parte do formato do Pidgey com a boca meio aberta — revisar no
  laboratório de animação.
- **Status, captura e XP** da série (PokeAPI).
- **Golpes** (o Rattata não está no learnset do Scarlet/Violet nem do
  Sword/Shield da PokeAPI; o do Brilliant Diamond/Shining Pearl):

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Tackle | kit | ✅ |
| 1 | Tail Whip | kit | ✅ |
| 4 | Quick Attack | kit | ✅ |
| 7 | Focus Energy | learnset | ⚠️ novo, sem efeito: o crítico do jogo tem chance fixa, sem estágio |
| 10 | Bite | learnset | ✅ |

- **Comer**: do chão, embaixo da boca (`EffMouth01`).
- **Selvagem**: `wild.hostileChance` médio — na série ele morde qualquer
  coisa e vive em bando; mais agressivo que o Caterpie e o Weedle.
- **Corpo, câmera e movimento**: cápsula deitada ao longo do corpo, valores
  de partida do Ekans; rápido, como o Pikachu — ajustar no laboratório e no
  jogo. Passo `medium`.
- Entrou na lista provisória de selvagens do nível de teste.

- [x] Bake das texturas no conversor (camada da íris, UV fora de 0..1),
      conferido contra a textura aprovada do Caterpie
- [x] Espécie registrada, Focus Energy, grito, `cry.json`, lista de
      selvagens
- [x] Conferido pelo usuário: textura e olhos, animações, corpo, movimento,
      câmera, comer, passo, grito e `cry.json`
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset` e o
      Focus Energy sem efeito) fica pra 088; o spawn, pra 060

## Parte 16 — Spearow

- **Asas**: como no Pidgey, as asas abertas estão no corpo e as fechadas
  são malhas à parte (`LWingSkin`/`RWingSkin`), escondidas por trilhas de
  visibilidade que o addon não importa. No LGPE elas vêm dentro do próprio
  `.gfbanm` (bloco `Visibility`), no mesmo formato do `.tracm` do Z-A (valor
  fixo, um bit por quadro ou quadros-chave). O conversor lê esse bloco pelas
  classes do addon e esconde a malha com escala quase zero nos ossos que só
  ela usa (`LFeeler`/`RFeeler`), quadro a quadro. Todas as animações têm
  trilha de escala nesses ossos, então a asa fechada sempre volta.
- **Voo rasante** (decisão do usuário): no mapa do LGPE o Spearow voa, e o
  dump não tem andar nem correr no chão — o `fi20_walk01`/`fi21_run01` são
  voo, bem acima do chão. O conversor desce o `walk` e o `run` até o chão do
  idle (pelo osso `Origin`) quando o ponto mais baixo do esqueleto passa do
  do idle além de uma tolerância — regra geral, que no Caterpie e no
  Rattata não muda nada. A altura do voo é um parâmetro do jogo,
  `body.flightHeight` (metros, só no modelo — a cápsula, a colisão e os
  golpes não mudam): andando ou correndo, o modelo sobe suave até ela e,
  nos outros estados, volta ao chão (`view/systems/flightLiftSystem.js`,
  rapidez em `GAME_CONFIG.ANIMATION.FLIGHT_LIFT_SPEED`). Pedido do usuário,
  pra acertar no jogo sem reconverter o modelo; o "Copiar body" do
  laboratório de corpo mantém o campo. Parado, o `idle` é o `kw01_wait01` (de pé, asa fechada; o
  `fi01_wait01` é pairando) — exceção por espécie no conversor
  (`OVERRIDES`).
- **Modelo**: `public/assets/models/021-spearow.glb` e texturas em
  `public/assets/textures/021-spearow/default/` (corpo A, corpo B — as penas
  das asas, com UV entre 1 e 2, que o bake leva para 0..1 — e o olho).
  Escala igual à dos outros. As asas fechadas são malhas à parte e cada uma
  conta como um índice no `model.texture` (o jogo numera pela ordem das
  malhas): entraram nos índices depois do olho, com a textura das penas —
  sem eles ficavam brancas. O mesmo valia pros bigodes do Rattata, que
  ganharam a textura do corpo.
- **Animações**: as mesmas do Rattata (ataque físico e especial, sem
  dormir), com o `dash` no `jumpLoop`.
- **Piscar**: por textura, como no LGPE (Parte 17).
- **Grito**: um só, do P3D (`21.wav` → `cry-01.wav`). Grito animado
  (`clips.cry`) no bico (`LowerBeak`): pelo `mouth01`, fechado é a pose de
  repouso e ele abre girando no eixo Y negativo; a curva parte do formato do
  Pidgey — revisar no laboratório de animação.
- **Status, captura e XP** da série (PokeAPI).
- **Golpes** (o Spearow não está no learnset do Scarlet/Violet nem do
  Sword/Shield da PokeAPI; o do Brilliant Diamond/Shining Pearl):

| Nível | Golpe | Onde | Estado |
|---|---|---|---|
| 1 | Peck | kit | ✅ novo, valores padrão (forma e VFX do Scratch, impacto) |
| 1 | Growl | kit | ✅ |
| 4 | Leer | kit | ✅ |
| 8 | Assurance | learnset | ✅ novo, valores padrão (forma e VFX do Scratch; tipo Normal, como o Bite; dobrar o poder fica de fora) |
| 11 | Fury Attack | learnset | ✅ novo, valores padrão (forma e VFX do Scratch; um acerto só) |

- **Comer**: do chão, embaixo do bico (`LowerBeak`).
- **Selvagem**: `wild.hostileChance` alto — na série ele é territorial e
  agressivo, ao contrário do Pidgey.
- **Corpo, câmera e movimento**: valores de partida do Pidgey (mesmo
  tamanho), um pouco mais rápido — ajustar no laboratório e no jogo.
- **Som de "passo"**: grupo novo `wing` (pedido do usuário) — ele anda e
  corre voando, então toca batida de asa de penas, do Cobblemon
  (`sounds/animation/wings/plumage_wing_flap_*`: a pequena andando, a média
  correndo), em `public/assets/audio/footsteps/wing/`. Volume e alcance de
  partida iguais aos do `bird`.
- Entrou na lista provisória de selvagens do nível de teste.

- [x] Visibilidade de malha do `.gfbanm` no conversor (asas fechadas)
- [x] Voo rasante: `walk`/`run` descidos até o chão, `idle` de pé
- [x] `body.flightHeight` (altura do voo no jogo), com teste do sistema e do
      trecho do laboratório
- [x] Grupo de passo `wing` (batida de asa) no Spearow
- [x] Textura das asas fechadas (e dos bigodes do Rattata) por índice de
      malha
- [x] Espécie registrada, Peck, Assurance, Fury Attack, grito, `cry.json`,
      lista de selvagens
- [x] Conferido pelo usuário: texturas, asas nas transições, voo rasante,
      animações, corpo, movimento, câmera, comer, passo, grito e `cry.json`
- [x] **Fechado.** O refino dos golpes (VFX, som, `positionOffset`, o poder
      dobrado do Assurance e os vários acertos do Fury Attack) fica pra 088;
      o spawn, pra 060

## Parte 17 — Piscar das espécies do LGPE

Pedido do usuário. No LGPE o piscar não é por osso: a textura do olho é um
atlas de expressões e as animações trocam a célula pelo deslocamento de UV
da cor do material (`ColorUVTranslateU/V`), lido do bloco de material dos
`.gfbanm` (`eye01` é o piscar solto; ataque, dano, desmaio, comer e os gestos
também mexem no olho).

- **O atlas do LGPE**: duas colunas (a expressão normal e a brava) e quatro
  linhas. Na coluna normal, de cima para baixo: aberto, meio fechado,
  fechado e apertado — o piscar é aberto → meio → fechado → meio → aberto,
  o dano usa o apertado e o desmaio termina fechado. A coluna brava aparece
  nos ataques e no "não gostei".
- **Correção da conta de UV**: o LGPE soma o deslocamento ANTES da escala,
  `(uv + deslocamento) × escala` (antes o bake fazia `uv × escala +
  deslocamento`). No corpo o deslocamento é zero e nada muda; no olho, a
  conta antiga pegava a coluna brava como padrão — por isso o olho do
  Rattata saía bravo. O deslocamento em V anda de cima para baixo na
  imagem, ao contrário do V do Blender.
- **Atlas do jogo**: o conversor assa o olho uma vez por célula (somando o
  deslocamento da célula ao do material) e monta um atlas com a mesma
  grade, cada célula com a textura de olho inteira; nas passadas das
  células, o corpo assa numa imagem descartável. Só para espécie com
  `eye01` (Rattata e Spearow).
- **No jogo**: o mecanismo de olho por atlas que já existia (`eyeStates`,
  docs/features/023 — `eyeBlinkSystem`), com a grade em
  `core/data/species/lgpeEyeAtlas.js`, comum às duas espécies: acordado
  pisca na coluna normal (aberto ↔ fechado), dormindo fica fechado, bravo
  usa a coluna brava; desmaiado cai em dormindo (regra que já existia). O
  meio fechado e o apertado ficam no atlas, sem uso por enquanto (o piscar
  do jogo só tem aberto e fechado).
- **Laboratórios**: o carregamento de modelo dos laboratórios
  (`useSpeciesModel`) passou a recortar a célula de olho aberto — antes
  mostrava o atlas inteiro no olho.
- **Caterpie**: não se aplica (ver Parte 14).

- [x] Conta de UV `(uv + deslocamento) × escala` no bake
- [x] Atlas do olho no conversor; Rattata e Spearow com `eyeStates`
- [x] Teste do atlas (células dentro da textura, acordado e bravo piscam,
      dormindo fechado)
- [x] Recorte do atlas nos laboratórios
- [ ] Conferido pelo usuário: olho padrão, piscar e humor (seletor do
      painel de debug) no Rattata e no Spearow

---

## Etapas

- [x] Montar a checklist comum a partir dos iniciais
- [x] Fechar com o usuário os ⚠️/❌ dos iniciais
- [x] Resolver as pendências dos iniciais (Partes 1, 2 e 4)
- [x] Replicar a checklist nas 7 selvagens (uma parte por espécie), na ordem:
  - [x] Weedle (Parte 5)
  - [x] Pidgey (Parte 11)
  - [x] Ekans (Parte 12)
  - [x] Pikachu (Parte 13)
  - [x] Caterpie (Parte 14, primeiro do LGPE: conversor novo)
  - [x] Rattata (Parte 15)
  - [x] Spearow (Parte 16)
- [x] Ferramentas do caminho: espécie nova no inventário (Parte 6),
      laboratório de animação (Parte 7) e de corpo (Parte 10), passo
      `crawl` (Parte 8), limiar de correr por espécie (Parte 9), piscar das
      espécies do LGPE (Parte 17)
- [x] Bump do `package.json` para `0.0.59`
- [x] Fechamento: suíte inteira (`npm test`), `npm run lint` (formatação dos
      laboratórios e um aviso de ref no de animação acertados) e
      `npm run build` (numa cópia, com o `next dev` rodando)
- [x] Desempenho: A/B de produção na Intel UHD (A = 0.0.58, B = 0.0.59,
      rodadas intercaladas, na origem com as selvagens do nível de teste),
      parado e andando. B não ficou pior: FPS, tempo de GPU e desenhos por
      quadro iguais ou melhores (a variação entre rodadas, das duas versões,
      vem do que nasce em volta). A memória JS subiu um pouco: agora as 10
      espécies podem nascer no nível de teste (antes, só os iniciais), então
      há mais modelos carregados — os do LGPE são leves; os do Z-A, maiores.
- [x] Wiki (0.0.x, no lugar): o catálogo de criaturas e o de golpes já
      montam as espécies e golpes novos pelo registro; golpe de status sem
      efeito ganhou o aviso "ainda não existe no jogo" (tabela e página do
      golpe); a página de alcance explica que o golpe sai de uma parte do
      corpo, mas o alcance conta do centro (Parte 3)
- [x] Roadmap: a 059 saiu do Marco 2 para "Já feito"; os efeitos que ficaram
      de fora (Wrap, Glare, Focus Energy, Assurance, Fury Attack) entraram
      na 088 (Marco 5)

## As 7 selvagens contra a checklist

✅ completo · ⚠️ existe, mas falta algo · — não se aplica

| Item | Caterpie | Weedle | Pidgey | Rattata | Spearow | Ekans | Pikachu |
|---|---|---|---|---|---|---|---|
| 1. Registro e identidade | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Progressão e captura | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. Retrato | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4. Modelo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5. Corpo, câmera e movimento | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6. Locomoção, estados e reações | ✅ ¹ | ✅ | ✅ | ✅ ¹ | ✅ ¹ | ✅ | ✅ |
| 6. Variações de ataque | ✅ ¹ | ✅ | ✅ | ✅ ¹ | ✅ ¹ | ✅ | ✅ |
| 6. Piscar | — ² | ✅ | ✅ | ✅ ³ | ✅ ³ | ✅ | ✅ |
| 6. Grito animado (`cry`) | — ⁴ | — ⁴ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7. Som | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8. Golpes | ⚠️ ⁵ | ⚠️ ⁵ | ✅ | ⚠️ ⁵ | ✅ | ⚠️ ⁵ | ⚠️ ⁵ |
| 9. Comer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10. `wild.hostileChance` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

1. Do LGPE: menos animações que o Z-A — um ataque (Caterpie) ou dois, desmaio
   sem "levantar", dash no `jumpLoop`, sem dormir no Rattata e no Spearow (o
   `rest` cai no idle).
2. O Caterpie não pisca no LGPE (olho pintado na textura do corpo).
3. Por textura (`eyeStates`), não por osso (Parte 17).
4. Sem boca ou pequena demais pra notar (decisão do usuário).
5. Golpes novos sem o efeito da série (String Shot, Focus Energy, Glare,
   Thunder Wave, Double Team): ficam pra 088, como os outros refinos.

## Critérios de Conclusão

- As 10 espécies com todos os itens da checklist ✅ (ou marcados como "não
  se aplica", com o motivo).
- `npm run build`, `npm run lint` e `npm test` passando.
