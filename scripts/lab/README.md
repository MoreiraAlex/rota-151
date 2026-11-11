# Pacotes do laboratório de biomas

Modelos de fora do jogo para testar no laboratório de biomas
(`/tools/lab-bioma`, `docs/features/066-revisao-dos-biomas.md`). Cada pacote
é uma pasta em `public/assets/lab/<id>/` no formato do LGPE (`props/*.glb`,
`textures/*.png`, `manifest.json`), e `public/assets/lab/packs.json` é a
lista que o lab carrega ao abrir. A pasta `public/assets/lab/` fica fora do
git: cada um gera os seus.

No lab, os modelos aparecem em **F2 → Vegetação → (tipo) → No bioma →
Modelos**, junto com os do Let's Go, na categoria escolhida ao converter.

## FBX, GLB/glTF ou OBJ (pelo Blender)

```bash
blender --background --python scripts/lab/pack-lab.py -- \
  --src <arquivo ou pasta> --pack <id> --category <categoria> \
  [--match <trecho do nome>] [--height <m> | --scale <x>] \
  [--label <nome>] [--textures <pasta>]
```

- `--category`: `tree`, `bush`, `plant`, `tuft`, `tall-grass`, `flower` ou
  `rock` (em que tipos de vegetação o modelo pode entrar e como o vento
  mexe nele).
- `--height`: põe cada modelo nessa altura (m) — o mais fácil para árvores.
- `--textures`: onde estão as imagens, se o modelo cita texturas que não
  estão junto dele.
- `--recolor "Leaves=#4a7a32:0.9,Bark=#5a4c40:0.6"`: puxa a textura dos
  materiais cujo nome tem o trecho para a cor (força 0 a 1), mantendo o
  claro e escuro — folhas de outono verdes, casca avermelhada marrom.
- Material sem textura ligada (comum nos FBX da Quaternius) usa a imagem
  com o nome dele (ou o nome no plural: `Rock` → `Rocks.png`), achada nas
  pastas de textura.
- Cada arquivo vira um modelo. Rodar de novo com o mesmo `--pack` junta ao
  pacote. O script já põe o pacote na lista.

## Os pacotes de natureza da 066

`scripts/lab/pack-natureza.sh <pasta temporária>` refaz os pacotes `usn`
(Ultimate Stylized Nature) e `megakit` (MegaKit), da Quaternius, a partir
dos zips do depósito pessoal: as árvores com tronco à vista, arbustos e
pedras que o botão "Árvores dos pacotes" do lab usa.

No WSL o Blender é o do Windows: chame o `.exe` e passe os caminhos no
formato do Windows.

```bash
B="/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" --background --python "$(wslpath -w scripts/lab/pack-lab.py)" -- \
  --src "$(wslpath -w <pasta>)" --pack megakit --category tree \
  --match CommonTree --height 6 --out "$(wslpath -w public/assets/lab)"
```

## Modelos do Let's Go que o jogo não usa (ex.: cenários de batalha)

O empacotador do LGPE faz um pacote só com os objetos de uma lista
(`--only-extra`), com as texturas prefixadas (`--prefix`):

```bash
node scripts/lgpe/pack-lgpe.js --field <pasta background/ extraída> \
  --extra scripts/lab/lgpe-batalha.json --only-extra \
  --prefix lgpe-batalha- --out public/assets/lab/lgpe-batalha
node scripts/lab/register-pack.js lgpe-batalha
```

`lgpe-batalha.json` traz a folhosa grande do cenário de batalha da
floresta (`btl_N_wood`, do `LGPE-BattleMaps.7z`), na metade do tamanho.
Para extrair só ela:
`7z x LGPE-BattleMaps.7z 'background/btl_N_wood/*' -o<pasta>`.

## Levar para o jogo

Quando um bioma passa a usar modelos de um pacote (`models` nos dados
dele), copie para a pasta do jogo (`public/assets/vegetation/packs/`, no
git) só os modelos citados e refaça os colisores:

```bash
node scripts/lab/levar-pacotes-para-o-jogo.js
node scripts/lgpe/colliders.js
```

## Tirar um pacote da lista

```bash
node scripts/lab/register-pack.js <id> --remove
```

## Árvores gigantes (galhos de árvore seca + folhas)

`compor-arvore-gigante.py` monta árvores velhas, cheias de galhos: pega os
galhos de cada árvore seca (`DeadTree`), engrossa o pé do tronco e põe um
tufo das folhas da `NormalTree` em cada ponta de galho. Sai um `.glb` por
árvore, com os materiais `NormalTree_Bark` e `NormalTree_Leaves` — o
`pack-lab.py` acha as texturas pelo nome e o jogo troca as folhas pelas do
Let's Go. Os zips são os do depósito pessoal (extraia `DeadTree_*`,
`NormalTree_1` e as texturas).

```bash
B="/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
U="<pasta>/Ultimate Stylized Nature - May 2022"
"$B" --background --python "$(wslpath -w scripts/lab/compor-arvore-gigante.py)" -- \
  --dead "$(wslpath -w "$U/FBX/DeadTree_4.fbx"),$(wslpath -w "$U/FBX/DeadTree_8.fbx")" \
  --leaves "$(wslpath -w "$U/FBX/NormalTree_1.fbx")" --out "$(wslpath -w <saída>)"
"$B" --background --python "$(wslpath -w scripts/lab/pack-lab.py)" -- \
  --src "$(wslpath -w <saída>)" --pack usn --label "Ultimate Nature" --category tree \
  --height 8 --textures "$(wslpath -w "$U/Textures")" \
  --recolor "Leaves=#4a8034:0.7,Bark=#5a4c40:0.7" --out "$(wslpath -w public/assets/lab)"
```

Opções: `--clumps` (tufos por árvore), `--clump-size` (fração da altura),
`--trunk` (quanto o pé do tronco engrossa), `--seed`.
