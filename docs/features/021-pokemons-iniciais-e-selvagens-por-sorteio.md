# 🚀 Versão 0.0.21 — Pokémon iniciais reais e sorteio de espécie selvagem

Primeiro conteúdo de Pokémon de verdade no registro de espécies —
Bulbasaur/Charmander/Squirtle, com model/textura/clipes/voz próprios —
substituindo os placeholders (`fox`) no time inicial do jogador. A lista de
criaturas selvagens também deixou de ser posições fixas escritas a mão e
passou a ser gerada por sorteio, a partir de um pool de espécies.

> **Nota de transparência**: `001-bulbasaur/`, `004-charmander/` e
> `007-squirtle/` trazem model (`.glb`), texturas (`pm000N_00_*.png`) e
> áudio de grito extraídos de um jogo comercial da franquia Pokémon — não
> foi este assistente quem gerou/autorou esse conteúdo (decisão e arquivos
> são do usuário). Mesma ressalva já registrada em
> `docs/features/019-som-ambiente-e-passos.md` pro banco de som de passo:
> vale confirmar direitos de uso antes de considerar isso definitivo ou
> publicável.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## 1. Três espécies novas, seguindo o molde de `_template/`

`core/data/species/001-bulbasaur/`, `004-charmander/`, `007-squirtle/` —
pasta com prefixo de dex number (convenção de `_template/index.js`), cada
uma com `index.js` + `clips/{idle,walk,run}.json` (animação procedural,
mesmo motor de `fox`/`bot`) e `sounds.voice` com 2-3 variações de grito
reais (`public/assets/audio/voices/<pasta>/cry-0N.wav`). Registradas em
`core/data/species/index.js` (import + entrada em `SPECIES_REGISTRY`,
mesmo passo a passo documentado no topo do arquivo).

Essas três são as PRIMEIRAS espécies a de fato precisar de **textura por
material** (`species.model.texture` como `{ [materialIndex]: { path,
... } }`, não uma string só) — mecanismo que já existia desde a 0.0.20
(`useAnimatedModel.js`), mas só tinha sido exercitado pela forma simples
(`fox`/`wolf`, um material só). Um Pokémon de verdade vem com o modelo
dividido em vários materiais (corpo, olhos, íris, chama, etc.), cada um
com seu próprio diffuse — daí cada entrada do objeto poder incluir, além
de `path`, ajustes de UV por material: `flipY`, `center`, `repeat`, `pan`
(offset) e `rotation` (graus), usados quando a textura de verdade é um
atlas/sheet maior que a região que aquele material deveria mostrar (ex.:
`Eye1_Merged.png` do Bulbasaur, com `repeat: {x: 1/4, y: 1/4}` pra recortar
1 dos 16 quadrantes da folha). `materialIndex` é a ORDEM DE ENCONTRO dos
meshes em `cloned.traverse` — não vem de metadado do `.glb` — então é
sensível à estrutura do modelo (documentado na docstring do hook).

### Pontos de atenção encontrados (não corrigidos, só documentados)

- **`_template/index.js` está com o exemplo errado**: mostra `texture: {
  0: '/assets/textures/nome/body.png', ... }` (valor STRING por índice),
  mas `useAnimatedModel.js` sempre lê `obj.path` de cada entrada — copiar o
  template literalmente pra uma espécie nova resulta em textura nunca
  aplicada (silenciosa, sem erro no console, mesmo fallback gracioso de
  "sem textura" do resto do mecanismo). O formato real, em uso pelas três
  espécies desta versão, é `{ 0: { path: '...' }, ... }`.
- **Direção do `flipY` default parece invertida**: `useAnimatedModel.js`
  aplica `loaded.flipY = obj.flipY ?? true` pra cada material — ou seja,
  vira `true` pra QUALQUER material que não declare `flipY` explicitamente
  na espécie, mesmo `loadTexture` (`textureCache.js`) já vindo com
  `flipY = false` por padrão (convenção de textura extraída de `.glb`,
  ver docstring de lá). O comentário logo acima dessa linha, no próprio
  hook, descreve o oposto ("só sobrescreve quando a espécie pedir
  explicitamente outra coisa"). Na prática, das entradas das três espécies
  novas, só as de olho declaram `flipY: false` — todo o resto (corpo,
  chama, casco) fica em `true`. Vale conferir visualmente se as texturas de
  corpo estão saindo invertidas.
- **`007-squirtle/index.js` tem `dexNumber: 4`** (deveria ser `7`, como o
  nome da própria pasta e o Squirtle de verdade) — cópia de
  `004-charmander/index.js` sem ajustar o número.

## 2. Time inicial do jogador vira os 3 iniciais

`core/world/world.js`: `Party` do treinador foi de um único placeholder
(`{ slot1: 'fox' }`) pra `{ slot1: 'bulbasaur', slot2: 'charmander',
slot3: 'squirtle' }` — os 3 iniciais clássicos, um por slot secundário
(`docs/features/011-slots-de-acao.md`). Nessa mesma rodada, corrigido um
bug real: `Party(...)` tinha sido chamado com TRÊS objetos separados
(`Party({slot1:...}, {slot2:...}, {slot3:...})`) — como toda outra
chamada de trait no arquivo, `Party` (fábrica de trait do koota) só aceita
UM objeto de override; os argumentos extras eram silenciosamente
ignorados, então só `slot1` de fato era aplicado e `slot2`/`slot3` ficavam
no default (`null`) mesmo depois de "preenchidos" no código. Fix: um
único objeto com os três campos.

## 3. Criaturas selvagens por sorteio, não mais posição fixa

`core/data/testLevel.js`: `TEST_LEVEL.wildCreatures` (antes um array
escrito à mão, 6 entradas fixas de fox/wolf) virou o resultado de
`generateWildCreatures(WILD_CREATURE_COUNT)` — sorteia `speciesId` de
`WILD_CREATURE_SPECIES` (hoje `['bulbasaur', 'charmander', 'squirtle']`,
fox/wolf comentados no pool) e uma posição `[x, 1, z]` com `x`/`z`
uniformes em `[-60, 60]` (dentro da área nova de 0.0.20, `ground.size:
150`, com folga da parede em `±75`) — pra cada uma das `count` entradas.

`WILD_CREATURE_COUNT` está em `0` agora — spawn de selvagem efetivamente
DESLIGADO (`wildCreatureSpawnSystem` não tem o que spawnar). Trade-off
notado: como a posição é sorteada em toda a área (não mais escolhida à
mão como em 0.0.20, que evitava de propósito a trilha de teste/corredor
perto da origem), ligar `WILD_CREATURE_COUNT` de novo pode ocasionalmente
posicionar uma criatura perto de obstáculo existente ou do spawn do
jogador — `wildWanderSystem`/evasão local (`MovementBlocked`) ainda
resolvem isso sozinhas se acontecer, mas vale saber que não há mais
garantia de "longe de tudo" como antes.

## 4. `InventoryPanel.jsx` — guarda extra no filtro de espécie

`CREATURE_SPECIES` (lista de espécies `kind: 'pokemon'` mostrada no
inventário) ganhou `&& species.id` no filtro, além do `resolveSpeciesKind`
já existente — defesa contra uma entrada sem `id` aparecer na lista (visto
durante o próprio trabalho de renomear pastas/trocar imports de espécie,
onde um Fast Refresh do Next em transição podia deixar `SPECIES_REGISTRY`
com um valor momentaneamente incompleto).

## Testes

Nenhum teste novo nesta versão — mudança é essencialmente dado
(`species/`, `testLevel.js`) e um bugfix de uma linha (`world.js`), já
coberta pela suíte existente de `core/data/species/index.test.js`
(registro/`listSpecies`) sem precisar de caso novo. `npm run lint`/`npx
vitest run` seguem na mesma baseline pré-existente (`items`/`world`, sem
relação com esta versão).
