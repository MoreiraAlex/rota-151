# Golpes dos 151

Referência pra definir os padrões dos golpes (docs/features/061-revisao-das-skills.md):
todo golpe que os 151 aprendem **por nível**, agrupado pelo jeito de acertar.

- **Fonte:** dados do Pokémon Showdown (golpes e learnsets). Learnset por nível do
  Scarlet/Violet; sem a espécie lá, o da geração mais recente que a tiver (a mesma
  regra da 059). Scarlet/Violet: 99 espécies, Sword/Shield: 40 espécies, Ultra Sun/Moon: 12 espécies.
- **Fora da lista:** golpes só de TM, ovo ou tutor.
- **Tipo, poder e precisão** são os da série atual. O jogo usa a tabela de tipos da
  Gen 1 (sem Sombrio, Aço e Fada): golpe desses tipos precisa de decisão (o Bite e o
  Assurance entraram como Normal).
- **Grupos** (decisão do usuário, 061): quatro, valendo pra dano e status, cada um
  com `range`, forma e largura fixos (o `range` conta da borda do corpo).
  Classificação pelo alvo do golpe na série e pela marca de contato:
  - **Corpo a corpo** — um alvo, com contato: cápsula, `range` 1.4, `radius` 0.5.
  - **Distância** — um alvo, sem contato: cápsula, `range` 6, `radius` 0.35.
  - **Área** — inimigos em volta: cone, `range` 3, `radius` 3.5; todos em volta,
    aliados e armadilha no lado inimigo: círculo em volta de quem usa, `range` 4.
  - **Em si mesmo** — só quem usa: círculo nos pés, do tamanho do anel do tempo da ação.
  - A cápsula acerta só o primeiro alvo; cone e círculo, todos dentro.
  - **Execução** (alterável golpe a golpe): `instant` (aperta e sai), `charge` (segura até o
    efeito) ou `channel` (segura o tempo todo). Padrão: `charge` em si mesmo e em aliados,
    `instant` no resto. Só o `charge` é interrompido por dano (antes do efeito).
  - **`aim`** da IA: corpo a corpo `melee`, o resto `ranged`.
  - Campo inteiro (clima, terreno) conta como si mesmo — marcado na coluna Obs.
- **No jogo:** ✅ = já existe em `core/data/skills/`.
- **Nível 0** = aprende ao evoluir.

**395 golpes** no total.

## Resumo por grupo

| Grupo | `range` | Golpes | Já no jogo |
|---|---|---|---|
| Corpo a corpo | 1.4 | 134 | 11 |
| Distância | 6 | 151 | 14 |
| Área | 3 (cone) / 4 (círculo) | 46 | 5 |
| Em si mesmo | 0 | 64 | 4 |

Marcas dos golpes (pra padrões de visual, som e animação dentro dos grupos):

| Marca | Golpes |
|---|---|
| contato | 134 |
| mordida | 7 |
| soco | 13 |
| corte | 13 |
| som | 15 |
| projétil | 10 |
| pulso | 5 |
| vento | 11 |
| pó | 5 |
| dança | 6 |
| carrega 1 turno | 4 |
| descansa 1 turno | 2 |

## Corpo a corpo — `range` 1.4 (134)

| Golpe | Forma | Tipo | Cat. | Poder | Prec. | Alvo | Marcas | Mecânica | Aprendem | Menor nível | No jogo | Obs. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bug Bite | cápsula | Inseto | Físico | 60 | 100% | um alvo | contato |  | 4 | 1 | ✅ |  |
| Fell Stinger | cápsula | Inseto | Físico | 50 | 100% | um alvo | contato |  | 1 | 44 |  |  |
| Fury Cutter | cápsula | Inseto | Físico | 40 | 95% | um alvo | contato, corte |  | 6 | 4 |  |  |
| Leech Life | cápsula | Inseto | Físico | 80 | 100% | um alvo | contato | drena vida | 6 | 35 |  |  |
| Megahorn | cápsula | Inseto | Físico | 120 | 85% | um alvo | contato |  | 6 | 0 |  |  |
| X-Scissor | cápsula | Inseto | Físico | 80 | 100% | um alvo | contato, corte |  | 4 | 32 |  |  |
| Assurance | cápsula | Sombrio | Físico | 60 | 100% | um alvo | contato |  | 12 | 15 | ✅ |  |
| Bite | cápsula | Sombrio | Físico | 60 | 100% | um alvo | contato, mordida | 30% recuo | 24 | 0 | ✅ |  |
| Crunch | cápsula | Sombrio | Físico | 80 | 100% | um alvo | contato, mordida | 20% atributo | 13 | 0 |  |  |
| Knock Off | cápsula | Sombrio | Físico | 65 | 100% | um alvo | contato |  | 8 | 16 |  |  |
| Night Slash | cápsula | Sombrio | Físico | 70 | 100% | um alvo | contato, corte | crítico alto | 2 | 1 |  |  |
| Payback | cápsula | Sombrio | Físico | 50 | 100% | um alvo | contato |  | 4 | 10 |  |  |
| Pursuit | cápsula | Sombrio | Físico | 40 | 100% | um alvo | contato |  | 5 | 1 |  |  |
| Sucker Punch | cápsula | Sombrio | Físico | 70 | 100% | um alvo | contato | prioridade +1 | 10 | 16 |  |  |
| Dragon Claw | cápsula | Dragão | Físico | 80 | 100% | um alvo | contato |  | 1 | 1 |  |  |
| Dragon Rush | cápsula | Dragão | Físico | 100 | 75% | um alvo | contato | 20% recuo | 3 | 35 |  |  |
| Dragon Tail | cápsula | Dragão | Físico | 60 | 90% | um alvo | contato | prioridade -6 | 3 | 15 |  |  |
| Dual Chop | cápsula | Dragão | Físico | 40 | 90% | um alvo | contato | vários acertos | 3 | 32 |  |  |
| Outrage | cápsula | Dragão | Físico | 120 | 100% | alvo aleatório | contato |  | 6 | 41 |  |  |
| Nuzzle | cápsula | Elétrico | Físico | 20 | 100% | um alvo | contato | 100% paralisar | 2 | 1 |  |  |
| Spark | cápsula | Elétrico | Físico | 65 | 100% | um alvo | contato | 30% paralisar | 6 | 1 |  |  |
| Thunder Fang | cápsula | Elétrico | Físico | 65 | 95% | um alvo | contato, mordida | 10% paralisar, 10% recuo | 2 | 1 |  |  |
| Thunder Punch | cápsula | Elétrico | Físico | 75 | 100% | um alvo | contato, soco | 10% paralisar | 4 | 0 |  |  |
| Play Rough | cápsula | Fada | Físico | 90 | 90% | um alvo | contato | 10% atributo | 5 | 1 |  |  |
| Axe Kick | cápsula | Lutador | Físico | 120 | 90% | um alvo | contato | dano de volta, 30% confundir | 1 | 50 |  |  |
| Brick Break | cápsula | Lutador | Físico | 75 | 100% | um alvo | contato |  | 1 | 0 |  |  |
| Circle Throw | cápsula | Lutador | Físico | 60 | 90% | um alvo | contato | prioridade -6 | 1 | 1 |  |  |
| Close Combat | cápsula | Lutador | Físico | 120 | 100% | um alvo | contato | muda atributo próprio | 4 | 33 |  |  |
| Counter | cápsula | Lutador | Físico | — | 100% | reação | contato | prioridade -5 | 1 | 40 |  | reação a golpe recebido |
| Cross Chop | cápsula | Lutador | Físico | 100 | 80% | um alvo | contato | crítico alto | 5 | 22 |  |  |
| Double Kick | cápsula | Lutador | Físico | 30 | 100% | um alvo | contato | vários acertos | 8 | 1 |  |  |
| Drain Punch | cápsula | Lutador | Físico | 75 | 100% | um alvo | contato, soco | drena vida | 1 | 0 |  |  |
| Dynamic Punch | cápsula | Lutador | Físico | 100 | 50% | um alvo | contato, soco | 100% confundir | 4 | 0 |  |  |
| Focus Punch | cápsula | Lutador | Físico | 150 | 100% | um alvo | contato, soco | prioridade -3 | 1 | 44 |  |  |
| Hammer Arm | cápsula | Lutador | Físico | 100 | 90% | um alvo | contato, soco | muda atributo próprio | 3 | 0 |  |  |
| High Jump Kick | cápsula | Lutador | Físico | 130 | 90% | um alvo | contato | dano de volta | 1 | 44 |  |  |
| Low Kick | cápsula | Lutador | Físico | — | 100% | um alvo | contato |  | 8 | 1 |  |  |
| Low Sweep | cápsula | Lutador | Físico | 65 | 100% | um alvo | contato | 100% atributo | 4 | 1 |  |  |
| Mach Punch | cápsula | Lutador | Físico | 40 | 100% | um alvo | contato, soco | prioridade +1 | 1 | 4 |  |  |
| Revenge | cápsula | Lutador | Físico | 60 | 100% | um alvo | contato | prioridade -4 | 3 | 1 |  |  |
| Reversal | cápsula | Lutador | Físico | — | 100% | um alvo | contato |  | 4 | 1 |  |  |
| Seismic Toss | cápsula | Lutador | Físico | — | 100% | um alvo | contato | dano fixo | 6 | 12 |  |  |
| Storm Throw | cápsula | Lutador | Físico | 60 | 100% | um alvo | contato |  | 1 | 20 |  |  |
| Submission | cápsula | Lutador | Físico | 80 | 80% | um alvo | contato | dano de volta | 1 | 44 |  |  |
| Superpower | cápsula | Lutador | Físico | 120 | 100% | um alvo | contato | muda atributo próprio | 2 | 0 |  |  |
| Vital Throw | cápsula | Lutador | Físico | 70 | sempre | um alvo | contato | prioridade -1 | 4 | 24 |  |  |
| Blaze Kick | cápsula | Fogo | Físico | 85 | 90% | um alvo | contato | crítico alto, 10% queimar | 1 | 24 |  |  |
| Fire Fang | cápsula | Fogo | Físico | 65 | 95% | um alvo | contato, mordida | 10% queimar, 10% recuo | 7 | 1 |  |  |
| Fire Punch | cápsula | Fogo | Físico | 75 | 100% | um alvo | contato, soco | 10% queimar | 3 | 1 |  |  |
| Flame Charge | cápsula | Fogo | Físico | 50 | 100% | um alvo | contato | 100% atributo | 2 | 15 |  |  |
| Flame Wheel | cápsula | Fogo | Físico | 60 | 100% | um alvo | contato | 10% queimar | 5 | 1 |  |  |
| Flare Blitz | cápsula | Fogo | Físico | 120 | 100% | um alvo | contato | dano de volta, 10% queimar | 8 | 1 |  |  |
| Aerial Ace | cápsula | Voador | Físico | 60 | sempre | um alvo (qualquer distância) | contato, corte |  | 3 | 15 |  |  |
| Brave Bird | cápsula | Voador | Físico | 120 | 100% | um alvo (qualquer distância) | contato | dano de volta | 1 | 65 |  |  |
| Drill Peck | cápsula | Voador | Físico | 80 | 100% | um alvo (qualquer distância) | contato |  | 5 | 35 |  |  |
| Peck | cápsula | Voador | Físico | 35 | 100% | um alvo (qualquer distância) | contato |  | 11 | 1 | ✅ |  |
| Pluck | cápsula | Voador | Físico | 60 | 100% | um alvo (qualquer distância) | contato |  | 4 | 1 |  |  |
| Wing Attack | cápsula | Voador | Físico | 60 | 100% | um alvo (qualquer distância) | contato |  | 7 | 1 |  |  |
| Astonish | cápsula | Fantasma | Físico | 30 | 100% | um alvo | contato | 30% recuo | 4 | 1 |  |  |
| Lick | cápsula | Fantasma | Físico | 30 | 100% | um alvo | contato | 30% paralisar | 6 | 1 |  |  |
| Rage Fist | cápsula | Fantasma | Físico | 50 | 100% | um alvo | contato, soco |  | 1 | 35 |  |  |
| Shadow Punch | cápsula | Fantasma | Físico | 60 | sempre | um alvo | contato, soco |  | 2 | 0 |  |  |
| Leaf Blade | cápsula | Planta | Físico | 90 | 100% | um alvo | contato, corte | crítico alto | 2 | 44 |  |  |
| Petal Dance | cápsula | Planta | Especial | 120 | 100% | alvo aleatório | contato, dança |  | 4 | 1 |  |  |
| Power Whip | cápsula | Planta | Físico | 120 | 85% | um alvo | contato |  | 8 | 1 |  |  |
| Vine Whip | cápsula | Planta | Físico | 45 | 100% | um alvo | contato |  | 7 | 1 | ✅ |  |
| Wood Hammer | cápsula | Planta | Físico | 120 | 100% | um alvo | contato | dano de volta | 1 | 1 |  |  |
| Dig | cápsula | Terrestre | Físico | 80 | 100% | um alvo | contato, carrega 1 turno |  | 5 | 32 |  |  |
| Drill Run | cápsula | Terrestre | Físico | 80 | 95% | um alvo | contato | crítico alto | 3 | 1 |  |  |
| High Horsepower | cápsula | Terrestre | Físico | 95 | 95% | um alvo | contato |  | 1 | 40 |  |  |
| Stomping Tantrum | cápsula | Terrestre | Físico | 75 | 100% | um alvo | contato |  | 4 | 24 |  |  |
| Ice Fang | cápsula | Gelo | Físico | 65 | 95% | um alvo | contato, mordida | 10% congelar, 10% recuo | 2 | 1 |  |  |
| Ice Punch | cápsula | Gelo | Físico | 75 | 100% | um alvo | contato, soco | 10% congelar | 2 | 24 |  |  |
| Bind | cápsula | Normal | Físico | 15 | 85% | um alvo | contato | prender | 5 | 1 |  |  |
| Body Slam | cápsula | Normal | Físico | 85 | 100% | um alvo | contato | 30% paralisar | 7 | 1 |  |  |
| Covet | cápsula | Normal | Físico | 60 | 100% | um alvo | contato |  | 10 | 1 |  |  |
| Crush Claw | cápsula | Normal | Físico | 75 | 95% | um alvo | contato | 50% atributo | 1 | 1 |  |  |
| Cut | cápsula | Normal | Físico | 50 | 95% | um alvo | contato, corte |  | 1 | 15 |  |  |
| Double Hit | cápsula | Normal | Físico | 35 | 90% | um alvo | contato | vários acertos | 6 | 0 |  |  |
| Double-Edge | cápsula | Normal | Físico | 120 | 100% | um alvo | contato | dano de volta | 23 | 1 |  |  |
| Endeavor | cápsula | Normal | Físico | — | 100% | um alvo | contato |  | 7 | 34 |  |  |
| Extreme Speed | cápsula | Normal | Físico | 80 | 100% | um alvo | contato | prioridade +2 | 2 | 0 |  |  |
| Fake Out | cápsula | Normal | Físico | 40 | 100% | um alvo | contato | prioridade +3, 100% recuo | 5 | 1 |  |  |
| False Swipe | cápsula | Normal | Físico | 40 | 100% | um alvo | contato |  | 4 | 1 |  |  |
| Flail | cápsula | Normal | Físico | — | 100% | um alvo | contato |  | 7 | 1 |  |  |
| Fury Attack | cápsula | Normal | Físico | 15 | 85% | um alvo | contato | vários acertos | 8 | 1 | ✅ |  |
| Fury Swipes | cápsula | Normal | Físico | 18 | 80% | um alvo | contato | vários acertos | 11 | 1 |  |  |
| Giga Impact | cápsula | Normal | Físico | 150 | 90% | um alvo | contato, descansa 1 turno |  | 4 | 56 |  |  |
| Guillotine | cápsula | Normal | Físico | — | 30% | um alvo | contato | nocaute em 1 golpe | 3 | 48 |  |  |
| Headbutt | cápsula | Normal | Físico | 70 | 100% | um alvo | contato | 30% recuo | 9 | 1 |  |  |
| Horn Attack | cápsula | Normal | Físico | 65 | 100% | um alvo | contato |  | 8 | 1 |  |  |
| Horn Drill | cápsula | Normal | Físico | — | 30% | um alvo | contato | nocaute em 1 golpe | 4 | 50 |  |  |
| Hyper Fang | cápsula | Normal | Físico | 80 | 90% | um alvo | contato, mordida | 10% recuo | 2 | 16 |  |  |
| Last Resort | cápsula | Normal | Físico | 140 | 100% | um alvo | contato |  | 7 | 1 |  |  |
| Mega Kick | cápsula | Normal | Físico | 120 | 75% | um alvo | contato |  | 1 | 32 |  |  |
| Mega Punch | cápsula | Normal | Físico | 80 | 85% | um alvo | contato, soco |  | 1 | 32 |  |  |
| Pound | cápsula | Normal | Físico | 40 | 100% | um alvo | contato |  | 16 | 1 |  |  |
| Quick Attack | cápsula | Normal | Físico | 40 | 100% | um alvo | contato | prioridade +1 | 18 | 1 | ✅ |  |
| Rage | cápsula | Normal | Físico | 20 | 100% | um alvo | contato |  | 1 | 14 |  |  |
| Raging Bull | cápsula | Normal | Físico | 90 | 100% | um alvo | contato |  | 1 | 35 |  |  |
| Rapid Spin | cápsula | Normal | Físico | 50 | 100% | um alvo | contato | 100% atributo | 7 | 1 | ✅ |  |
| Retaliate | cápsula | Normal | Físico | 70 | 100% | um alvo | contato |  | 4 | 1 |  |  |
| Scratch | cápsula | Normal | Físico | 40 | 100% | um alvo | contato |  | 20 | 1 | ✅ |  |
| Slam | cápsula | Normal | Físico | 80 | 75% | um alvo | contato |  | 10 | 25 |  |  |
| Slash | cápsula | Normal | Físico | 70 | 100% | um alvo | contato, corte | crítico alto | 14 | 0 |  |  |
| Stomp | cápsula | Normal | Físico | 65 | 100% | um alvo | contato | 30% recuo | 9 | 0 |  |  |
| Strength | cápsula | Normal | Físico | 80 | 100% | um alvo | contato |  | 4 | 29 |  |  |
| Super Fang | cápsula | Normal | Físico | — | 90% | um alvo | contato |  | 2 | 28 |  |  |
| Tackle | cápsula | Normal | Físico | 40 | 100% | um alvo | contato |  | 46 | 1 | ✅ |  |
| Take Down | cápsula | Normal | Físico | 90 | 85% | um alvo | contato | dano de volta | 17 | 1 |  |  |
| Thrash | cápsula | Normal | Físico | 120 | 100% | alvo aleatório | contato |  | 8 | 29 |  |  |
| Vise Grip | cápsula | Normal | Físico | 55 | 100% | um alvo | contato |  | 1 | 1 |  |  |
| Wrap | cápsula | Normal | Físico | 15 | 90% | um alvo | contato | prender | 10 | 1 | ✅ |  |
| Cross Poison | cápsula | Venenoso | Físico | 70 | 100% | um alvo | contato, corte | crítico alto, 10% envenenar | 1 | 1 |  |  |
| Poison Fang | cápsula | Venenoso | Físico | 50 | 100% | um alvo | contato, mordida | 50% envenenar forte | 4 | 15 |  |  |
| Poison Jab | cápsula | Venenoso | Físico | 80 | 100% | um alvo | contato | 30% envenenar | 9 | 1 |  |  |
| Zen Headbutt | cápsula | Psíquico | Físico | 80 | 90% | um alvo | contato | 20% recuo | 9 | 18 |  |  |
| Rollout | cápsula | Pedra | Físico | 30 | 90% | um alvo | contato |  | 9 | 1 |  |  |
| Bullet Punch | cápsula | Aço | Físico | 40 | 100% | um alvo | contato, soco | prioridade +1 | 1 | 16 |  |  |
| Gyro Ball | cápsula | Aço | Físico | — | 100% | um alvo | contato, projétil |  | 8 | 1 |  |  |
| Heavy Slam | cápsula | Aço | Físico | — | 100% | um alvo | contato |  | 2 | 1 |  |  |
| Iron Head | cápsula | Aço | Físico | 80 | 100% | um alvo | contato | 30% recuo | 1 | 35 |  |  |
| Iron Tail | cápsula | Aço | Físico | 100 | 75% | um alvo | contato | 30% atributo | 3 | 1 |  |  |
| Metal Claw | cápsula | Aço | Físico | 50 | 95% | um alvo | contato | 10% atributo | 2 | 1 |  |  |
| Meteor Mash | cápsula | Aço | Físico | 90 | 90% | um alvo | contato, soco | 20% atributo | 2 | 1 |  |  |
| Smart Strike | cápsula | Aço | Físico | 70 | sempre | um alvo | contato |  | 1 | 0 |  |  |
| Aqua Jet | cápsula | Água | Físico | 40 | 100% | um alvo | contato | prioridade +1 | 5 | 1 |  |  |
| Aqua Tail | cápsula | Água | Físico | 90 | 90% | um alvo | contato |  | 11 | 24 |  |  |
| Crabhammer | cápsula | Água | Físico | 100 | 90% | um alvo | contato | crítico alto | 2 | 44 |  |  |
| Dive | cápsula | Água | Físico | 80 | 100% | um alvo | contato, carrega 1 turno |  | 2 | 41 |  |  |
| Liquidation | cápsula | Água | Físico | 85 | 100% | um alvo | contato | 20% atributo | 2 | 50 |  |  |
| Razor Shell | cápsula | Água | Físico | 75 | 95% | um alvo | contato, corte | 50% atributo | 4 | 5 |  |  |
| Waterfall | cápsula | Água | Físico | 80 | 100% | um alvo | contato | 20% recuo | 3 | 21 |  |  |
| Wave Crash | cápsula | Água | Físico | 120 | 100% | um alvo | contato | dano de volta | 3 | 36 |  |  |

## Distância — `range` 6 (151)

| Golpe | Forma | Tipo | Cat. | Poder | Prec. | Alvo | Marcas | Mecânica | Aprendem | Menor nível | No jogo | Obs. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bug Buzz | cápsula | Inseto | Especial | 90 | 100% | um alvo | som | 10% atributo | 3 | 25 |  |  |
| Pin Missile | cápsula | Inseto | Físico | 25 | 95% | um alvo |  | vários acertos | 2 | 32 |  |  |
| Twineedle | cápsula | Inseto | Físico | 25 | 100% | um alvo |  | vários acertos, 20% envenenar | 1 | 1 |  |  |
| Dark Pulse | cápsula | Sombrio | Especial | 80 | 100% | um alvo (qualquer distância) | pulso | 20% recuo | 3 | 36 |  |  |
| Fake Tears | cápsula | Sombrio | Status | — | 100% | um alvo |  | muda atributo do alvo | 1 | 24 |  |  |
| Flatter | cápsula | Sombrio | Status | — | 100% | um alvo |  | confundir, muda atributo do alvo | 6 | 1 |  |  |
| Fling | cápsula | Sombrio | Físico | — | 100% | um alvo |  |  | 5 | 1 |  |  |
| Memento | cápsula | Sombrio | Status | — | 100% | um alvo |  | desmaia quem usa, muda atributo do alvo | 4 | 48 |  |  |
| Switcheroo | cápsula | Sombrio | Status | — | 100% | um alvo |  |  | 2 | 1 |  |  |
| Taunt | cápsula | Sombrio | Status | — | 100% | um alvo |  | provocar | 2 | 20 |  |  |
| Dragon Breath | cápsula | Dragão | Especial | 60 | 100% | um alvo |  | 30% paralisar | 6 | 12 | ✅ |  |
| Dragon Pulse | cápsula | Dragão | Especial | 85 | 100% | um alvo (qualquer distância) | pulso |  | 2 | 40 |  |  |
| Charge Beam | cápsula | Elétrico | Especial | 50 | 90% | um alvo |  | 70% atributo | 2 | 16 |  |  |
| Eerie Impulse | cápsula | Elétrico | Status | — | 100% | um alvo |  | muda atributo do alvo | 2 | 1 |  |  |
| Electro Ball | cápsula | Elétrico | Especial | — | 100% | um alvo | projétil |  | 6 | 1 | ✅ |  |
| Shock Wave | cápsula | Elétrico | Especial | 60 | sempre | um alvo |  |  | 1 | 16 |  |  |
| Thunder | cápsula | Elétrico | Especial | 110 | 70% | um alvo |  | 30% paralisar | 5 | 1 |  |  |
| Thunder Shock | cápsula | Elétrico | Especial | 40 | 100% | um alvo |  | 10% paralisar | 10 | 0 | ✅ |  |
| Thunder Wave | cápsula | Elétrico | Status | — | 90% | um alvo |  | paralisar | 10 | 1 | ✅ |  |
| Thunderbolt | cápsula | Elétrico | Especial | 90 | 100% | um alvo |  | 10% paralisar | 3 | 5 |  |  |
| Zap Cannon | cápsula | Elétrico | Especial | 120 | 50% | um alvo | projétil | 100% paralisar | 4 | 52 |  |  |
| Baby-Doll Eyes | cápsula | Fada | Status | — | 100% | um alvo |  | prioridade +1, muda atributo do alvo | 4 | 15 |  |  |
| Charm | cápsula | Fada | Status | — | 100% | um alvo |  | muda atributo do alvo | 12 | 1 |  |  |
| Moonblast | cápsula | Fada | Especial | 95 | 100% | um alvo |  | 30% atributo | 5 | 1 |  |  |
| Sweet Kiss | cápsula | Fada | Status | — | 75% | um alvo |  | confundir | 8 | 1 |  |  |
| Aura Sphere | cápsula | Lutador | Especial | 80 | sempre | um alvo (qualquer distância) | projétil, pulso |  | 2 | 40 |  |  |
| Final Gambit | cápsula | Lutador | Especial | — | 100% | um alvo |  | desmaia quem usa | 2 | 48 |  |  |
| Vacuum Wave | cápsula | Lutador | Especial | 40 | 100% | um alvo |  | prioridade +1 | 1 | 8 |  |  |
| Ember | cápsula | Fogo | Especial | 40 | 100% | um alvo |  | 10% queimar | 12 | 0 | ✅ |  |
| Fire Blast | cápsula | Fogo | Especial | 110 | 85% | um alvo |  | 10% queimar | 5 | 1 |  |  |
| Fire Spin | cápsula | Fogo | Especial | 35 | 85% | um alvo |  | prender | 7 | 1 |  |  |
| Flamethrower | cápsula | Fogo | Especial | 90 | 100% | um alvo |  | 10% queimar | 8 | 1 | ✅ |  |
| Inferno | cápsula | Fogo | Especial | 100 | 50% | um alvo |  | 100% queimar | 7 | 1 |  |  |
| Overheat | cápsula | Fogo | Especial | 130 | 90% | um alvo |  | muda atributo próprio | 1 | 65 |  |  |
| Will-O-Wisp | cápsula | Fogo | Status | — | 85% | um alvo |  | queimar | 2 | 1 |  |  |
| Air Slash | cápsula | Voador | Especial | 75 | 95% | um alvo (qualquer distância) | corte | 30% recuo | 11 | 0 |  |  |
| Feather Dance | cápsula | Voador | Status | — | 100% | um alvo | dança | muda atributo do alvo | 3 | 25 |  |  |
| Gust | cápsula | Voador | Especial | 40 | 100% | um alvo (qualquer distância) | vento |  | 6 | 0 | ✅ |  |
| Hurricane | cápsula | Voador | Especial | 110 | 70% | um alvo (qualquer distância) | vento | 30% confundir | 7 | 0 |  |  |
| Mirror Move | cápsula | Voador | Status | — | sempre | um alvo |  |  | 5 | 18 |  |  |
| Sky Attack | cápsula | Voador | Físico | 140 | 90% | um alvo (qualquer distância) | carrega 1 turno | crítico alto, 30% recuo | 1 | 70 |  |  |
| Confuse Ray | cápsula | Fantasma | Status | — | 100% | um alvo |  | confundir | 11 | 1 |  |  |
| Curse | cápsula | Fantasma | Status | — | sempre | um alvo |  | maldição | 6 | 1 |  |  |
| Hex | cápsula | Fantasma | Especial | 65 | 100% | um alvo |  |  | 5 | 24 |  |  |
| Night Shade | cápsula | Fantasma | Especial | — | 100% | um alvo |  | dano fixo | 3 | 28 |  |  |
| Shadow Ball | cápsula | Fantasma | Especial | 80 | 100% | um alvo | projétil | 20% atributo | 3 | 40 |  |  |
| Spite | cápsula | Fantasma | Status | — | 100% | um alvo |  |  | 5 | 1 |  |  |
| Absorb | cápsula | Planta | Especial | 20 | 100% | um alvo |  | drena vida | 12 | 1 |  |  |
| Bullet Seed | cápsula | Planta | Físico | 25 | 100% | um alvo | projétil | vários acertos | 2 | 1 |  |  |
| Giga Drain | cápsula | Planta | Especial | 75 | 100% | um alvo |  | drena vida | 8 | 1 |  |  |
| Leaf Storm | cápsula | Planta | Especial | 130 | 90% | um alvo |  | muda atributo próprio | 2 | 0 |  |  |
| Leech Seed | cápsula | Planta | Status | — | 90% | um alvo |  | semente | 5 | 1 | ✅ |  |
| Mega Drain | cápsula | Planta | Especial | 40 | 100% | um alvo |  | drena vida | 6 | 1 |  |  |
| Seed Bomb | cápsula | Planta | Físico | 80 | 100% | um alvo | projétil |  | 4 | 1 |  |  |
| Sleep Powder | cápsula | Planta | Status | — | 75% | um alvo | pó | dormir | 13 | 1 |  |  |
| Solar Beam | cápsula | Planta | Especial | 120 | 100% | um alvo | carrega 1 turno |  | 5 | 1 |  |  |
| Spore | cápsula | Planta | Status | — | 100% | um alvo | pó | dormir | 2 | 22 |  |  |
| Stun Spore | cápsula | Planta | Status | — | 75% | um alvo | pó | paralisar | 11 | 1 |  |  |
| Worry Seed | cápsula | Planta | Status | — | 100% | um alvo |  |  | 5 | 1 |  |  |
| Bone Rush | cápsula | Terrestre | Físico | 25 | 90% | um alvo |  | vários acertos | 2 | 29 |  |  |
| Bonemerang | cápsula | Terrestre | Físico | 50 | 90% | um alvo |  | vários acertos | 2 | 40 |  |  |
| Earth Power | cápsula | Terrestre | Especial | 90 | 100% | um alvo |  | 10% atributo | 11 | 1 |  |  |
| Fissure | cápsula | Terrestre | Físico | — | 30% | um alvo |  | nocaute em 1 golpe | 2 | 44 |  |  |
| Mud Shot | cápsula | Terrestre | Especial | 55 | 95% | um alvo |  | 100% atributo | 11 | 1 |  |  |
| Mud-Slap | cápsula | Terrestre | Especial | 20 | 100% | um alvo |  | 100% atributo | 6 | 1 |  |  |
| Sand Attack | cápsula | Terrestre | Status | — | 100% | um alvo |  | muda atributo do alvo | 16 | 1 | ✅ |  |
| Sand Tomb | cápsula | Terrestre | Físico | 35 | 85% | um alvo |  | prender | 3 | 0 |  |  |
| Aurora Beam | cápsula | Gelo | Especial | 65 | 100% | um alvo |  | 10% atributo | 5 | 1 |  |  |
| Freeze-Dry | cápsula | Gelo | Especial | 70 | 100% | um alvo |  | 10% congelar | 1 | 35 |  |  |
| Ice Beam | cápsula | Gelo | Especial | 90 | 100% | um alvo |  | 10% congelar | 6 | 1 |  |  |
| Ice Shard | cápsula | Gelo | Físico | 40 | 100% | um alvo |  | prioridade +1 | 6 | 1 |  |  |
| Icicle Crash | cápsula | Gelo | Físico | 85 | 90% | um alvo |  | 30% recuo | 1 | 1 |  |  |
| Icicle Spear | cápsula | Gelo | Físico | 25 | 100% | um alvo |  | vários acertos | 1 | 0 |  |  |
| Sheer Cold | cápsula | Gelo | Especial | — | 30% | um alvo |  | nocaute em 1 golpe | 3 | 0 |  |  |
| After You | cápsula | Normal | Status | — | sempre | um alvo |  |  | 2 | 1 |  |  |
| Block | cápsula | Normal | Status | — | sempre | um alvo |  |  | 1 | 1 |  |  |
| Conversion 2 | cápsula | Normal | Status | — | sempre | um alvo |  |  | 1 | 25 |  |  |
| Disable | cápsula | Normal | Status | — | 100% | um alvo |  | trava golpe | 18 | 1 |  |  |
| Echoed Voice | cápsula | Normal | Especial | 40 | 100% | um alvo | som |  | 3 | 1 |  |  |
| Encore | cápsula | Normal | Status | — | 100% | um alvo |  | repetir golpe | 5 | 1 |  |  |
| Feint | cápsula | Normal | Físico | 30 | 100% | um alvo |  | prioridade +2 | 7 | 1 |  |  |
| Glare | cápsula | Normal | Status | — | 100% | um alvo |  | paralisar | 2 | 12 | ✅ |  |
| Hyper Beam | cápsula | Normal | Especial | 150 | 90% | um alvo | descansa 1 turno |  | 6 | 52 |  |  |
| Lock-On | cápsula | Normal | Status | — | sempre | um alvo |  |  | 3 | 48 |  |  |
| Lovely Kiss | cápsula | Normal | Status | — | 75% | um alvo |  | dormir | 1 | 40 |  |  |
| Mean Look | cápsula | Normal | Status | — | sempre | um alvo |  |  | 6 | 1 |  |  |
| Mimic | cápsula | Normal | Status | — | sempre | um alvo |  |  | 3 | 1 |  |  |
| Pay Day | cápsula | Normal | Físico | 40 | 100% | um alvo |  |  | 2 | 12 |  |  |
| Play Nice | cápsula | Normal | Status | — | sempre | um alvo |  | muda atributo do alvo | 2 | 1 |  |  |
| Psych Up | cápsula | Normal | Status | — | sempre | um alvo |  |  | 6 | 25 |  |  |
| Reflect Type | cápsula | Normal | Status | — | sempre | um alvo |  |  | 3 | 1 |  |  |
| Roar | cápsula | Normal | Status | — | sempre | um alvo | som | prioridade -6 | 3 | 1 |  |  |
| Round | cápsula | Normal | Especial | 60 | 100% | um alvo | som |  | 2 | 1 |  |  |
| Scary Face | cápsula | Normal | Status | — | 100% | um alvo |  | muda atributo do alvo | 14 | 1 |  |  |
| Screech | cápsula | Normal | Status | — | 85% | um alvo | som | muda atributo do alvo | 21 | 1 |  |  |
| Sing | cápsula | Normal | Status | — | 55% | um alvo | som | dormir | 7 | 1 |  |  |
| Smokescreen | cápsula | Normal | Status | — | 100% | um alvo |  | muda atributo do alvo | 8 | 1 | ✅ |  |
| Snore | cápsula | Normal | Especial | 50 | 100% | um alvo | som | 30% recuo | 1 | 20 |  |  |
| Spit Up | cápsula | Normal | Especial | — | 100% | um alvo |  |  | 5 | 1 |  |  |
| Supersonic | cápsula | Normal | Status | — | 55% | um alvo | som | confundir | 15 | 1 |  |  |
| Swagger | cápsula | Normal | Status | — | 85% | um alvo |  | confundir, muda atributo do alvo | 5 | 17 |  |  |
| Tickle | cápsula | Normal | Status | — | 100% | um alvo |  | muda atributo do alvo | 1 | 44 |  |  |
| Transform | cápsula | Normal | Status | — | sempre | um alvo |  |  | 2 | 1 |  |  |
| Tri Attack | cápsula | Normal | Especial | 80 | 100% | um alvo |  |  | 4 | 0 |  |  |
| Uproar | cápsula | Normal | Especial | 90 | 100% | alvo aleatório | som |  | 4 | 1 |  |  |
| Whirlwind | cápsula | Normal | Status | — | sempre | um alvo | vento | prioridade -6 | 4 | 17 |  |  |
| Yawn | cápsula | Normal | Status | — | sempre | um alvo |  | sonolência | 3 | 9 |  |  |
| Acid Spray | cápsula | Venenoso | Especial | 40 | 100% | um alvo | projétil | 100% atributo | 2 | 28 |  |  |
| Belch | cápsula | Venenoso | Especial | 120 | 90% | um alvo |  |  | 7 | 38 |  |  |
| Clear Smog | cápsula | Venenoso | Especial | 50 | sempre | um alvo |  |  | 3 | 12 |  |  |
| Gastro Acid | cápsula | Venenoso | Status | — | 100% | um alvo |  | gastroacid | 5 | 1 |  |  |
| Gunk Shot | cápsula | Venenoso | Físico | 120 | 80% | um alvo |  | 30% envenenar | 4 | 40 |  |  |
| Poison Powder | cápsula | Venenoso | Status | — | 75% | um alvo | pó | envenenar | 14 | 1 |  |  |
| Poison Sting | cápsula | Venenoso | Físico | 15 | 100% | um alvo |  | 30% envenenar | 13 | 1 | ✅ |  |
| Sludge | cápsula | Venenoso | Especial | 65 | 100% | um alvo |  | 30% envenenar | 4 | 15 |  |  |
| Sludge Bomb | cápsula | Venenoso | Especial | 90 | 100% | um alvo | projétil | 30% envenenar | 6 | 29 |  |  |
| Smog | cápsula | Venenoso | Especial | 30 | 70% | um alvo |  | 40% envenenar | 4 | 1 |  |  |
| Toxic | cápsula | Venenoso | Status | — | 90% | um alvo |  | envenenar forte | 13 | 1 |  |  |
| Venoshock | cápsula | Venenoso | Especial | 65 | 100% | um alvo |  |  | 3 | 23 |  |  |
| Confusion | cápsula | Psíquico | Especial | 50 | 100% | um alvo |  | 10% confundir | 16 | 0 |  |  |
| Dream Eater | cápsula | Psíquico | Especial | 100 | 100% | um alvo |  | drena vida | 3 | 48 |  |  |
| Extrasensory | cápsula | Psíquico | Especial | 80 | 100% | um alvo |  | 10% recuo | 4 | 1 |  |  |
| Future Sight | cápsula | Psíquico | Especial | 120 | 100% | um alvo |  |  | 6 | 1 |  |  |
| Guard Swap | cápsula | Psíquico | Status | — | sempre | um alvo |  |  | 2 | 1 |  |  |
| Heal Pulse | cápsula | Psíquico | Status | — | sempre | um alvo (qualquer distância) | pulso |  | 3 | 28 |  |  |
| Hypnosis | cápsula | Psíquico | Status | — | 60% | um alvo |  | dormir | 10 | 1 |  |  |
| Kinesis | cápsula | Psíquico | Status | — | 80% | um alvo |  | muda atributo do alvo | 2 | 1 |  |  |
| Mirror Coat | cápsula | Psíquico | Especial | — | 100% | reação |  | prioridade -5 | 2 | 50 |  | reação a golpe recebido |
| Power Swap | cápsula | Psíquico | Status | — | sempre | um alvo |  |  | 2 | 1 |  |  |
| Psybeam | cápsula | Psíquico | Especial | 65 | 100% | um alvo |  | 10% confundir | 11 | 1 |  |  |
| Psychic | cápsula | Psíquico | Especial | 90 | 100% | um alvo |  | 10% atributo | 14 | 1 |  |  |
| Psycho Cut | cápsula | Psíquico | Físico | 70 | 100% | um alvo | corte | crítico alto | 3 | 16 |  |  |
| Psyshock | cápsula | Psíquico | Especial | 80 | 100% | um alvo |  |  | 5 | 1 |  |  |
| Psystrike | cápsula | Psíquico | Especial | 100 | 100% | um alvo |  |  | 1 | 72 |  |  |
| Role Play | cápsula | Psíquico | Status | — | sempre | um alvo |  |  | 3 | 16 |  |  |
| Stored Power | cápsula | Psíquico | Especial | 20 | 100% | um alvo |  |  | 2 | 1 |  |  |
| Ancient Power | cápsula | Pedra | Especial | 60 | 100% | um alvo |  | 10% atributo | 11 | 1 |  |  |
| Power Gem | cápsula | Pedra | Especial | 80 | 100% | um alvo |  |  | 3 | 0 |  |  |
| Rock Blast | cápsula | Pedra | Físico | 25 | 90% | um alvo | projétil | vários acertos | 7 | 30 |  |  |
| Rock Throw | cápsula | Pedra | Físico | 50 | 90% | um alvo |  |  | 4 | 1 |  |  |
| Smack Down | cápsula | Pedra | Físico | 50 | 100% | um alvo |  | derrubar | 6 | 1 |  |  |
| Stone Edge | cápsula | Pedra | Físico | 100 | 80% | um alvo |  | crítico alto | 9 | 42 |  |  |
| Flash Cannon | cápsula | Aço | Especial | 80 | 100% | um alvo |  | 10% atributo | 3 | 0 |  |  |
| Metal Sound | cápsula | Aço | Status | — | 85% | um alvo | som | muda atributo do alvo | 4 | 40 |  |  |
| Brine | cápsula | Água | Especial | 65 | 100% | um alvo |  |  | 10 | 1 |  |  |
| Bubble Beam | cápsula | Água | Especial | 65 | 100% | um alvo |  | 10% atributo | 9 | 1 |  |  |
| Hydro Pump | cápsula | Água | Especial | 110 | 80% | um alvo |  |  | 20 | 1 |  |  |
| Soak | cápsula | Água | Status | — | 100% | um alvo |  |  | 4 | 27 |  |  |
| Water Gun | cápsula | Água | Especial | 40 | 100% | um alvo |  |  | 24 | 0 | ✅ |  |
| Water Pulse | cápsula | Água | Especial | 60 | 100% | um alvo (qualquer distância) | pulso | 20% confundir | 15 | 1 |  |  |
| Whirlpool | cápsula | Água | Especial | 35 | 85% | um alvo |  | prender | 3 | 1 | ✅ |  |

## Área — `range` 3 (cone) / 4 (círculo) (46)

| Golpe | Forma | Tipo | Cat. | Poder | Prec. | Alvo | Marcas | Mecânica | Aprendem | Menor nível | No jogo | Obs. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| String Shot | cone | Inseto | Status | — | 95% | inimigos em volta |  | muda atributo do alvo | 3 | 1 | ✅ |  |
| Twister | cone | Dragão | Especial | 40 | 100% | inimigos em volta | vento | 20% recuo | 9 | 1 |  |  |
| Discharge | círculo | Elétrico | Especial | 80 | 100% | todos em volta |  | 30% paralisar | 10 | 1 |  |  |
| Magnetic Flux | círculo (aliados) | Elétrico | Status | — | sempre | lado aliado |  |  | 2 | 1 |  |  |
| Dazzling Gleam | cone | Fada | Especial | 80 | 100% | inimigos em volta |  |  | 1 | 44 |  |  |
| Disarming Voice | cone | Fada | Especial | 40 | sempre | inimigos em volta | som |  | 5 | 1 |  |  |
| Quick Guard | círculo (aliados) | Lutador | Status | — | sempre | lado aliado |  | prioridade +3 | 4 | 1 |  |  |
| Heat Wave | cone | Fogo | Especial | 95 | 90% | inimigos em volta | vento | 10% queimar | 3 | 1 |  |  |
| Incinerate | cone | Fogo | Especial | 60 | 100% | inimigos em volta |  |  | 3 | 1 |  |  |
| Lava Plume | círculo | Fogo | Especial | 80 | 100% | todos em volta |  | 30% queimar | 2 | 34 |  |  |
| Air Cutter | cone | Voador | Especial | 60 | 95% | inimigos em volta | corte, vento | crítico alto | 3 | 25 |  |  |
| Tailwind | círculo (aliados) | Voador | Status | — | sempre | lado aliado | vento |  | 5 | 30 |  |  |
| Aromatherapy | círculo (aliados) | Planta | Status | — | sempre | time |  |  | 2 | 43 |  |  |
| Petal Blizzard | círculo | Planta | Físico | 90 | 100% | todos em volta | vento |  | 2 | 0 |  |  |
| Razor Leaf | cone | Planta | Físico | 55 | 95% | inimigos em volta | corte | crítico alto | 6 | 1 | ✅ |  |
| Bulldoze | círculo | Terrestre | Físico | 60 | 100% | todos em volta |  | 100% atributo | 9 | 1 |  |  |
| Earthquake | círculo | Terrestre | Físico | 100 | 100% | todos em volta |  |  | 9 | 34 |  |  |
| Spikes | círculo | Terrestre | Status | — | sempre | lado inimigo |  |  | 1 | 1 |  | armadilha no lado inimigo: conta como área |
| Blizzard | cone | Gelo | Especial | 110 | 70% | inimigos em volta | vento | 10% congelar | 2 | 58 |  |  |
| Icy Wind | cone | Gelo | Especial | 55 | 95% | inimigos em volta | vento | 100% atributo | 2 | 1 |  |  |
| Mist | círculo (aliados) | Gelo | Status | — | sempre | lado aliado |  |  | 3 | 1 |  |  |
| Powder Snow | cone | Gelo | Especial | 40 | 100% | inimigos em volta |  | 10% congelar | 2 | 1 |  |  |
| Explosion | círculo | Normal | Físico | 250 | 100% | todos em volta |  | desmaia quem usa | 7 | 36 |  |  |
| Growl | cone | Normal | Status | — | 100% | inimigos em volta | som | muda atributo do alvo | 35 | 1 | ✅ |  |
| Helping Hand | círculo (aliados) | Normal | Status | — | sempre | um aliado |  | prioridade +5, ajudar | 15 | 1 |  |  |
| Howl | círculo (aliados) | Normal | Status | — | sempre | aliados | som | muda atributo do alvo | 2 | 1 |  |  |
| Hyper Voice | cone | Normal | Especial | 90 | 100% | inimigos em volta | som |  | 2 | 1 |  |  |
| Leer | cone | Normal | Status | — | 100% | inimigos em volta |  | muda atributo do alvo | 33 | 1 | ✅ |  |
| Safeguard | círculo (aliados) | Normal | Status | — | sempre | lado aliado |  |  | 11 | 1 |  |  |
| Self-Destruct | círculo | Normal | Físico | 200 | 100% | todos em volta |  | desmaia quem usa | 7 | 24 |  |  |
| Sweet Scent | cone | Normal | Status | — | 100% | inimigos em volta |  | muda atributo do alvo | 9 | 1 |  |  |
| Swift | cone | Normal | Especial | 60 | sempre | inimigos em volta |  |  | 12 | 1 |  |  |
| Tail Whip | cone | Normal | Status | — | 100% | inimigos em volta |  | muda atributo do alvo | 29 | 1 | ✅ |  |
| Teeter Dance | círculo | Normal | Status | — | 100% | todos em volta | dança | confundir | 1 | 52 |  |  |
| Acid | cone | Venenoso | Especial | 40 | 100% | inimigos em volta |  | 10% atributo | 9 | 1 |  |  |
| Poison Gas | cone | Venenoso | Status | — | 90% | inimigos em volta |  | envenenar | 6 | 1 |  |  |
| Sludge Wave | círculo | Venenoso | Especial | 95 | 100% | todos em volta |  | 10% envenenar | 4 | 32 |  |  |
| Toxic Spikes | círculo | Venenoso | Status | — | sempre | lado inimigo |  |  | 8 | 1 |  | armadilha no lado inimigo: conta como área |
| Light Screen | círculo (aliados) | Psíquico | Status | — | sempre | lado aliado |  |  | 12 | 1 |  |  |
| Reflect | círculo (aliados) | Psíquico | Status | — | sempre | lado aliado |  |  | 6 | 1 |  |  |
| Rock Slide | cone | Pedra | Físico | 75 | 90% | inimigos em volta |  | 30% recuo | 2 | 20 |  |  |
| Stealth Rock | círculo | Pedra | Status | — | sempre | lado inimigo |  |  | 4 | 28 |  | armadilha no lado inimigo: conta como área |
| Wide Guard | círculo (aliados) | Pedra | Status | — | sempre | lado aliado |  | prioridade +3 | 4 | 1 |  |  |
| Life Dew | círculo (aliados) | Água | Status | — | sempre | aliados |  | cura | 6 | 1 |  |  |
| Muddy Water | cone | Água | Especial | 90 | 85% | inimigos em volta |  | 30% atributo | 1 | 40 |  |  |
| Surf | círculo | Água | Especial | 90 | 100% | todos em volta |  |  | 8 | 1 |  |  |

## Em si mesmo — `range` 0 (64)

| Golpe | Forma | Tipo | Cat. | Poder | Prec. | Alvo | Marcas | Mecânica | Aprendem | Menor nível | No jogo | Obs. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Quiver Dance | círculo (nos pés) | Inseto | Status | — | sempre | si mesmo | dança | muda atributo do alvo | 2 | 1 |  |  |
| Rage Powder | círculo (nos pés) | Inseto | Status | — | sempre | si mesmo | pó | prioridade +2, ragepowder | 3 | 40 |  |  |
| Nasty Plot | círculo (nos pés) | Sombrio | Status | — | sempre | si mesmo |  | muda atributo do alvo | 8 | 1 |  |  |
| Dragon Dance | círculo (nos pés) | Dragão | Status | — | sempre | si mesmo | dança | muda atributo do alvo | 6 | 36 |  |  |
| Charge | círculo (nos pés) | Elétrico | Status | — | sempre | si mesmo |  | carregar, muda atributo do alvo | 4 | 1 |  |  |
| Electric Terrain | círculo (nos pés) | Elétrico | Status | — | sempre | campo inteiro |  | terreno | 1 | 1 |  | campo (clima/terreno): conta como si mesmo |
| Magnet Rise | círculo (nos pés) | Elétrico | Status | — | sempre | si mesmo |  | levitar | 5 | 10 |  |  |
| Moonlight | círculo (nos pés) | Fada | Status | — | sempre | si mesmo |  |  | 5 | 1 |  |  |
| Bulk Up | círculo (nos pés) | Lutador | Status | — | sempre | si mesmo |  | muda atributo do alvo | 3 | 36 |  |  |
| Detect | círculo (nos pés) | Lutador | Status | — | sempre | si mesmo |  | prioridade +4, proteção | 2 | 12 |  |  |
| Sunny Day | círculo (nos pés) | Fogo | Status | — | sempre | campo inteiro |  | clima | 2 | 50 |  | campo (clima/terreno): conta como si mesmo |
| Roost | círculo (nos pés) | Voador | Status | — | sempre | si mesmo |  | cura | 9 | 1 |  |  |
| Destiny Bond | círculo (nos pés) | Fantasma | Status | — | sempre | si mesmo |  | leva junto | 5 | 44 |  |  |
| Grassy Terrain | círculo (nos pés) | Planta | Status | — | sempre | campo inteiro |  | terreno | 4 | 1 |  | campo (clima/terreno): conta como si mesmo |
| Ingrain | círculo (nos pés) | Planta | Status | — | sempre | si mesmo |  | enraizar | 1 | 52 |  |  |
| Synthesis | círculo (nos pés) | Planta | Status | — | sempre | si mesmo |  |  | 5 | 1 |  |  |
| Haze | círculo (nos pés) | Gelo | Status | — | sempre | campo inteiro |  |  | 8 | 20 |  | campo (clima/terreno): conta como si mesmo |
| Snowscape | círculo (nos pés) | Gelo | Status | — | sempre | campo inteiro |  | clima | 3 | 50 |  | campo (clima/terreno): conta como si mesmo |
| Acupressure | círculo (nos pés) | Normal | Status | — | sempre | si ou um aliado |  |  | 2 | 30 |  | si mesmo ou um aliado: conta como si mesmo |
| Baton Pass | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 6 | 1 |  |  |
| Belly Drum | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 5 | 1 |  |  |
| Conversion | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 1 | 1 |  |  |
| Copycat | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 11 | 1 |  |  |
| Defense Curl | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | enrolar, muda atributo do alvo | 12 | 1 |  |  |
| Double Team | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | muda atributo do alvo | 3 | 1 | ✅ |  |
| Endure | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | prioridade +4, aguentar | 3 | 12 |  |  |
| Focus Energy | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | foco (crítico) | 22 | 1 | ✅ |  |
| Follow Me | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | prioridade +2, atrair golpes | 2 | 1 |  |  |
| Growth | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | muda atributo do alvo | 12 | 1 | ✅ |  |
| Harden | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | muda atributo do alvo | 13 | 0 |  |  |
| Metronome | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 4 | 1 |  |  |
| Minimize | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | encolher, muda atributo do alvo | 4 | 1 |  |  |
| Perish Song | círculo (nos pés) | Normal | Status | — | sempre | campo inteiro | som |  | 3 | 1 |  | campo (clima/terreno): conta como si mesmo |
| Protect | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | prioridade +4, proteção | 12 | 1 |  |  |
| Recover | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | cura | 6 | 1 |  |  |
| Recycle | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 3 | 1 |  |  |
| Shell Smash | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | muda atributo do alvo | 7 | 1 |  |  |
| Slack Off | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | cura | 2 | 33 |  |  |
| Sleep Talk | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 1 | 20 |  |  |
| Soft-Boiled | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | cura | 1 | 44 |  |  |
| Splash | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 4 | 1 |  |  |
| Stockpile | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | acumular | 6 | 1 |  |  |
| Swallow | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  |  | 6 | 1 |  |  |
| Swords Dance | círculo (nos pés) | Normal | Status | — | sempre | si mesmo | dança | muda atributo do alvo | 10 | 1 |  |  |
| Work Up | círculo (nos pés) | Normal | Status | — | sempre | si mesmo |  | muda atributo do alvo | 1 | 5 |  |  |
| Acid Armor | círculo (nos pés) | Venenoso | Status | — | sempre | si mesmo |  | muda atributo do alvo | 5 | 32 |  |  |
| Coil | círculo (nos pés) | Venenoso | Status | — | sempre | si mesmo |  | muda atributo do alvo | 2 | 44 |  |  |
| Agility | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | muda atributo do alvo | 31 | 1 |  |  |
| Ally Switch | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | prioridade +2 | 2 | 15 |  |  |
| Amnesia | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | muda atributo do alvo | 7 | 10 |  |  |
| Calm Mind | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | muda atributo do alvo | 2 | 50 |  |  |
| Cosmic Power | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | muda atributo do alvo | 4 | 1 |  |  |
| Gravity | círculo (nos pés) | Psíquico | Status | — | sempre | campo inteiro |  |  | 2 | 1 |  | campo (clima/terreno): conta como si mesmo |
| Healing Wish | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | desmaia quem usa | 3 | 1 |  |  |
| Imprison | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | imprison | 3 | 1 |  |  |
| Rest | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  |  | 6 | 1 |  |  |
| Teleport | círculo (nos pés) | Psíquico | Status | — | sempre | si mesmo |  | prioridade -6 | 3 | 1 |  |  |
| Wonder Room | círculo (nos pés) | Psíquico | Status | — | sempre | campo inteiro |  |  | 2 | 39 |  | campo (clima/terreno): conta como si mesmo |
| Rock Polish | círculo (nos pés) | Pedra | Status | — | sempre | si mesmo |  | muda atributo do alvo | 4 | 1 |  |  |
| Sandstorm | círculo (nos pés) | Pedra | Status | — | sempre | campo inteiro | vento | clima | 5 | 28 |  | campo (clima/terreno): conta como si mesmo |
| Iron Defense | círculo (nos pés) | Aço | Status | — | sempre | si mesmo |  | muda atributo do alvo | 5 | 1 |  |  |
| Aqua Ring | círculo (nos pés) | Água | Status | — | sempre | si mesmo |  | anel de água | 5 | 23 |  |  |
| Rain Dance | círculo (nos pés) | Água | Status | — | sempre | campo inteiro |  | clima | 16 | 1 |  | campo (clima/terreno): conta como si mesmo |
| Withdraw | círculo (nos pés) | Água | Status | — | sempre | si mesmo |  | muda atributo do alvo | 8 | 1 | ✅ |  |

## Por espécie

Golpe e nível em que aprende.

- **#001 Bulbasaur** (Scarlet/Violet): Growl 1, Tackle 1, Vine Whip 3, Growth 6, Leech Seed 9, Razor Leaf 12, Poison Powder 15, Sleep Powder 15, Seed Bomb 18, Take Down 21, Sweet Scent 24, Synthesis 27, Worry Seed 30, Power Whip 33, Solar Beam 36
- **#002 Ivysaur** (Scarlet/Violet): Growl 1, Growth 1, Tackle 1, Vine Whip 1, Leech Seed 9, Razor Leaf 12, Poison Powder 15, Sleep Powder 15, Seed Bomb 20, Take Down 25, Sweet Scent 30, Synthesis 35, Worry Seed 40, Power Whip 45, Solar Beam 50
- **#003 Venusaur** (Scarlet/Violet): Petal Blizzard 0, Growl 1, Growth 1, Petal Dance 1, Tackle 1, Vine Whip 1, Leech Seed 9, Razor Leaf 12, Poison Powder 15, Sleep Powder 15, Seed Bomb 20, Take Down 25, Sweet Scent 30, Synthesis 37, Worry Seed 44, Power Whip 51, Solar Beam 58
- **#004 Charmander** (Scarlet/Violet): Growl 1, Scratch 1, Ember 4, Smokescreen 8, Dragon Breath 12, Fire Fang 17, Slash 20, Flamethrower 24, Scary Face 28, Fire Spin 32, Inferno 36, Flare Blitz 40
- **#005 Charmeleon** (Scarlet/Violet): Ember 1, Growl 1, Scratch 1, Smokescreen 1, Dragon Breath 12, Fire Fang 19, Slash 24, Flamethrower 30, Scary Face 37, Inferno 48, Flare Blitz 54
- **#006 Charizard** (Scarlet/Violet): Air Slash 0, Dragon Claw 1, Ember 1, Growl 1, Heat Wave 1, Scratch 1, Smokescreen 1, Dragon Breath 12, Fire Fang 19, Slash 24, Flamethrower 30, Scary Face 39, Fire Spin 46, Inferno 54, Flare Blitz 62
- **#007 Squirtle** (Scarlet/Violet): Tackle 1, Tail Whip 1, Water Gun 3, Withdraw 6, Rapid Spin 9, Bite 12, Water Pulse 15, Protect 18, Rain Dance 21, Aqua Tail 24, Shell Smash 27, Iron Defense 30, Hydro Pump 33, Wave Crash 36
- **#008 Wartortle** (Scarlet/Violet): Tackle 1, Tail Whip 1, Water Gun 1, Withdraw 1, Rapid Spin 9, Bite 12, Water Pulse 15, Protect 20, Rain Dance 25, Aqua Tail 30, Shell Smash 35, Iron Defense 40, Hydro Pump 45, Wave Crash 50
- **#009 Blastoise** (Scarlet/Violet): Flash Cannon 0, Tackle 1, Tail Whip 1, Water Gun 1, Withdraw 1, Rapid Spin 9, Bite 12, Water Pulse 15, Protect 20, Rain Dance 25, Aqua Tail 30, Shell Smash 35, Iron Defense 42, Hydro Pump 49, Wave Crash 56
- **#010 Caterpie** (Sword/Shield): String Shot 1, Tackle 1, Bug Bite 9
- **#011 Metapod** (Sword/Shield): Harden 0
- **#012 Butterfree** (Sword/Shield): Gust 0, Bug Bite 1, Harden 1, String Shot 1, Tackle 1, Supersonic 4, Confusion 8, Poison Powder 12, Sleep Powder 12, Stun Spore 12, Psybeam 16, Whirlwind 20, Air Slash 24, Safeguard 28, Bug Buzz 32, Tailwind 36, Rage Powder 40, Quiver Dance 44
- **#013 Weedle** (Ultra Sun/Moon): Poison Sting 1, String Shot 1, Bug Bite 9
- **#014 Kakuna** (Ultra Sun/Moon): Harden 1
- **#015 Beedrill** (Ultra Sun/Moon): Fury Attack 1, Twineedle 1, Rage 14, Pursuit 17, Focus Energy 20, Venoshock 23, Assurance 26, Toxic Spikes 29, Pin Missile 32, Poison Jab 35, Agility 38, Endeavor 41, Fell Stinger 44
- **#016 Pidgey** (Ultra Sun/Moon): Tackle 1, Sand Attack 5, Gust 9, Quick Attack 13, Whirlwind 17, Twister 21, Feather Dance 25, Agility 29, Wing Attack 33, Roost 37, Tailwind 41, Mirror Move 45, Air Slash 49, Hurricane 53
- **#017 Pidgeotto** (Ultra Sun/Moon): Gust 1, Sand Attack 1, Tackle 1, Quick Attack 13, Whirlwind 17, Twister 22, Feather Dance 27, Agility 32, Wing Attack 37, Roost 42, Tailwind 47, Mirror Move 52, Air Slash 57, Hurricane 62
- **#018 Pidgeot** (Ultra Sun/Moon): Gust 1, Hurricane 1, Quick Attack 1, Sand Attack 1, Tackle 1, Whirlwind 17, Twister 22, Feather Dance 27, Agility 32, Wing Attack 38, Roost 44, Tailwind 50, Mirror Move 56, Air Slash 62
- **#019 Rattata** (Ultra Sun/Moon): Tackle 1, Tail Whip 1, Quick Attack 4, Focus Energy 7, Bite 10, Pursuit 13, Hyper Fang 16, Assurance 19, Crunch 22, Sucker Punch 25, Super Fang 28, Double-Edge 31, Endeavor 34
- **#020 Raticate** (Ultra Sun/Moon): Focus Energy 1, Quick Attack 1, Scary Face 1, Swords Dance 1, Tackle 1, Tail Whip 1, Bite 10, Pursuit 13, Hyper Fang 16, Assurance 19, Crunch 24, Sucker Punch 29, Super Fang 34, Double-Edge 39, Endeavor 44
- **#021 Spearow** (Ultra Sun/Moon): Growl 1, Peck 1, Leer 4, Pursuit 8, Fury Attack 11, Aerial Ace 15, Mirror Move 18, Assurance 22, Agility 25, Focus Energy 29, Roost 32, Drill Peck 36
- **#022 Fearow** (Ultra Sun/Moon): Drill Run 1, Growl 1, Leer 1, Peck 1, Pluck 1, Pursuit 1, Fury Attack 11, Aerial Ace 15, Mirror Move 18, Assurance 23, Agility 27, Focus Energy 32, Roost 36, Drill Peck 41
- **#023 Ekans** (Scarlet/Violet): Leer 1, Wrap 1, Poison Sting 4, Bite 9, Glare 12, Screech 17, Acid 20, Spit Up 25, Stockpile 25, Swallow 25, Acid Spray 28, Sludge Bomb 33, Gastro Acid 36, Belch 38, Haze 41, Coil 44, Gunk Shot 49
- **#024 Arbok** (Scarlet/Violet): Crunch 0, Bite 1, Fire Fang 1, Ice Fang 1, Leer 1, Poison Sting 1, Thunder Fang 1, Wrap 1, Glare 12, Screech 17, Acid 20, Spit Up 27, Stockpile 27, Swallow 27, Acid Spray 32, Sludge Bomb 39, Gastro Acid 44, Belch 48, Haze 51, Coil 56, Gunk Shot 63
- **#025 Pikachu** (Scarlet/Violet): Charm 1, Growl 1, Nasty Plot 1, Nuzzle 1, Play Nice 1, Quick Attack 1, Sweet Kiss 1, Tail Whip 1, Thunder Shock 1, Thunder Wave 4, Double Team 8, Electro Ball 12, Feint 16, Spark 20, Agility 24, Iron Tail 28, Discharge 32, Thunderbolt 36, Light Screen 40, Thunder 44
- **#026 Raichu** (Scarlet/Violet): Thunder Punch 0, Agility 1, Charm 1, Discharge 1, Double Team 1, Electro Ball 1, Feint 1, Growl 1, Iron Tail 1, Light Screen 1, Nasty Plot 1, Nuzzle 1, Play Nice 1, Quick Attack 1, Spark 1, Sweet Kiss 1, Tail Whip 1, Thunder 1, Thunder Shock 1, Thunder Wave 1, Thunderbolt 5
- **#027 Sandshrew** (Scarlet/Violet): Defense Curl 1, Scratch 1, Poison Sting 3, Sand Attack 6, Rollout 9, Fury Cutter 12, Rapid Spin 15, Bulldoze 18, Swift 21, Fury Swipes 24, Agility 27, Slash 30, Dig 33, Gyro Ball 36, Swords Dance 39, Sandstorm 42, Earthquake 45
- **#028 Sandslash** (Scarlet/Violet): Crush Claw 1, Defense Curl 1, Poison Sting 1, Sand Attack 1, Scratch 1, Rollout 9, Fury Cutter 12, Rapid Spin 15, Bulldoze 18, Swift 21, Fury Swipes 26, Sand Tomb 31, Slash 36, Dig 41, Gyro Ball 46, Swords Dance 51, Sandstorm 56, Earthquake 61
- **#029 Nidoran-F** (Sword/Shield): Growl 1, Poison Sting 1, Scratch 5, Tail Whip 10, Fury Swipes 15, Toxic Spikes 20, Double Kick 25, Bite 30, Helping Hand 35, Toxic 40, Flatter 45, Crunch 50, Earth Power 55
- **#030 Nidorina** (Sword/Shield): Growl 1, Poison Sting 1, Scratch 1, Tail Whip 1, Fury Swipes 15, Toxic Spikes 22, Double Kick 29, Bite 36, Helping Hand 43, Toxic 50, Flatter 57, Crunch 64, Earth Power 71
- **#031 Nidoqueen** (Sword/Shield): Superpower 0, Bite 1, Crunch 1, Double Kick 1, Earth Power 1, Flatter 1, Fury Swipes 1, Growl 1, Helping Hand 1, Poison Sting 1, Scratch 1, Tail Whip 1, Toxic 1, Toxic Spikes 1
- **#032 Nidoran-M** (Sword/Shield): Leer 1, Poison Sting 1, Peck 5, Focus Energy 10, Fury Attack 15, Toxic Spikes 20, Double Kick 25, Horn Attack 30, Helping Hand 35, Toxic 40, Flatter 45, Poison Jab 50, Earth Power 55
- **#033 Nidorino** (Sword/Shield): Focus Energy 1, Leer 1, Peck 1, Poison Sting 1, Fury Attack 15, Toxic Spikes 22, Double Kick 29, Horn Attack 36, Helping Hand 43, Toxic 50, Flatter 57, Poison Jab 64, Earth Power 71
- **#034 Nidoking** (Sword/Shield): Megahorn 0, Double Kick 1, Earth Power 1, Flatter 1, Focus Energy 1, Fury Attack 1, Helping Hand 1, Horn Attack 1, Leer 1, Peck 1, Poison Jab 1, Poison Sting 1, Toxic 1, Toxic Spikes 1
- **#035 Clefairy** (Scarlet/Violet): Charm 1, Copycat 1, Defense Curl 1, Disarming Voice 1, Growl 1, Pound 1, Sing 1, Splash 1, Sweet Kiss 1, Stored Power 4, Encore 8, After You 12, Life Dew 16, Metronome 20, Moonlight 24, Gravity 28, Meteor Mash 32, Follow Me 36, Cosmic Power 40, Moonblast 44, Healing Wish 48
- **#036 Clefable** (Scarlet/Violet): After You 1, Charm 1, Copycat 1, Cosmic Power 1, Defense Curl 1, Disarming Voice 1, Encore 1, Follow Me 1, Gravity 1, Growl 1, Healing Wish 1, Life Dew 1, Meteor Mash 1, Metronome 1, Moonblast 1, Moonlight 1, Pound 1, Sing 1, Splash 1, Stored Power 1, Sweet Kiss 1
- **#037 Vulpix** (Scarlet/Violet): Ember 1, Tail Whip 1, Disable 4, Quick Attack 8, Spite 12, Incinerate 16, Confuse Ray 20, Will-O-Wisp 24, Extrasensory 28, Flamethrower 32, Imprison 36, Fire Spin 40, Safeguard 44, Inferno 48, Fire Blast 52
- **#038 Ninetales** (Scarlet/Violet): Confuse Ray 1, Disable 1, Ember 1, Extrasensory 1, Fire Blast 1, Fire Spin 1, Flamethrower 1, Imprison 1, Incinerate 1, Inferno 1, Nasty Plot 1, Quick Attack 1, Safeguard 1, Spite 1, Tail Whip 1, Will-O-Wisp 1
- **#039 Jigglypuff** (Scarlet/Violet): Charm 1, Copycat 1, Defense Curl 1, Disable 1, Disarming Voice 1, Pound 1, Sing 1, Sweet Kiss 1, Echoed Voice 4, Covet 8, Spit Up 12, Stockpile 12, Swallow 12, Round 16, Rest 20, Body Slam 24, Mimic 28, Gyro Ball 32, Hyper Voice 36, Double-Edge 44
- **#040 Wigglytuff** (Scarlet/Violet): Body Slam 1, Charm 1, Copycat 1, Covet 1, Defense Curl 1, Disable 1, Disarming Voice 1, Double-Edge 1, Echoed Voice 1, Gyro Ball 1, Hyper Voice 1, Mimic 1, Pound 1, Rest 1, Round 1, Sing 1, Spit Up 1, Stockpile 1, Swallow 1, Sweet Kiss 1, Play Rough 5
- **#041 Zubat** (Sword/Shield): Absorb 1, Supersonic 1, Astonish 5, Mean Look 10, Poison Fang 15, Quick Guard 20, Air Cutter 25, Bite 30, Haze 35, Venoshock 40, Confuse Ray 45, Air Slash 50, Leech Life 55
- **#042 Golbat** (Sword/Shield): Absorb 1, Astonish 1, Mean Look 1, Screech 1, Supersonic 1, Poison Fang 15, Quick Guard 20, Air Cutter 27, Bite 34, Haze 41, Venoshock 48, Confuse Ray 55, Air Slash 62, Leech Life 69
- **#043 Oddish** (Scarlet/Violet): Absorb 1, Growth 1, Acid 4, Sweet Scent 8, Mega Drain 12, Poison Powder 14, Stun Spore 16, Sleep Powder 18, Giga Drain 20, Toxic 24, Moonblast 28, Grassy Terrain 32, Moonlight 36, Petal Dance 40
- **#044 Gloom** (Scarlet/Violet): Absorb 1, Acid 1, Growth 1, Sweet Scent 1, Mega Drain 12, Poison Powder 14, Stun Spore 16, Sleep Powder 18, Giga Drain 20, Toxic 26, Moonblast 32, Grassy Terrain 38, Moonlight 44, Petal Dance 50
- **#045 Vileplume** (Scarlet/Violet): Petal Blizzard 0, Absorb 1, Acid 1, Giga Drain 1, Grassy Terrain 1, Growth 1, Mega Drain 1, Moonblast 1, Moonlight 1, Petal Dance 1, Poison Powder 1, Sleep Powder 1, Stun Spore 1, Sweet Scent 1, Toxic 1
- **#046 Paras** (Ultra Sun/Moon): Scratch 1, Poison Powder 6, Stun Spore 6, Absorb 11, Fury Cutter 17, Spore 22, Slash 27, Growth 33, Giga Drain 38, Aromatherapy 43, Rage Powder 49, X-Scissor 54
- **#047 Parasect** (Ultra Sun/Moon): Absorb 1, Cross Poison 1, Poison Powder 1, Scratch 1, Stun Spore 1, Fury Cutter 17, Spore 22, Slash 29, Growth 37, Giga Drain 44, Aromatherapy 51, Rage Powder 59, X-Scissor 66
- **#048 Venonat** (Scarlet/Violet): Disable 1, Tackle 1, Supersonic 5, Confusion 11, Poison Powder 13, Psybeam 17, Stun Spore 23, Bug Buzz 25, Sleep Powder 29, Leech Life 35, Zen Headbutt 37, Poison Fang 41, Psychic 47
- **#049 Venomoth** (Scarlet/Violet): Air Slash 0, Disable 1, Quiver Dance 1, Supersonic 1, Tackle 1, Confusion 11, Poison Powder 13, Psybeam 17, Stun Spore 23, Bug Buzz 25, Sleep Powder 29, Leech Life 37, Zen Headbutt 41, Poison Fang 47, Psychic 55
- **#050 Diglett** (Scarlet/Violet): Sand Attack 1, Scratch 1, Growl 4, Astonish 8, Mud-Slap 12, Bulldoze 16, Sucker Punch 20, Slash 24, Sandstorm 28, Dig 32, Earth Power 36, Earthquake 40, Fissure 44
- **#051 Dugtrio** (Scarlet/Violet): Sand Tomb 0, Astonish 1, Growl 1, Night Slash 1, Sand Attack 1, Scratch 1, Tri Attack 1, Mud-Slap 12, Bulldoze 16, Sucker Punch 20, Slash 24, Sandstorm 30, Dig 36, Earth Power 42, Earthquake 48, Fissure 54
- **#052 Meowth** (Scarlet/Violet): Fake Out 1, Growl 1, Feint 4, Scratch 8, Pay Day 12, Bite 16, Taunt 20, Assurance 24, Fury Swipes 29, Screech 32, Slash 36, Nasty Plot 40, Play Rough 44
- **#053 Persian** (Scarlet/Violet): Power Gem 0, Fake Out 1, Feint 1, Growl 1, Scratch 1, Switcheroo 1, Pay Day 12, Bite 16, Taunt 20, Assurance 24, Fury Swipes 31, Screech 36, Slash 42, Nasty Plot 48, Play Rough 54
- **#054 Psyduck** (Scarlet/Violet): Scratch 1, Tail Whip 1, Water Gun 3, Confusion 6, Fury Swipes 9, Water Pulse 12, Disable 15, Zen Headbutt 18, Screech 21, Aqua Tail 24, Soak 27, Psych Up 30, Amnesia 34, Wonder Room 39
- **#055 Golduck** (Scarlet/Violet): Aqua Jet 1, Confusion 1, Scratch 1, Tail Whip 1, Water Gun 1, Fury Swipes 9, Water Pulse 12, Disable 15, Zen Headbutt 18, Screech 21, Aqua Tail 24, Soak 27, Psych Up 30, Amnesia 36, Hydro Pump 40, Wonder Room 45
- **#056 Mankey** (Scarlet/Violet): Covet 1, Focus Energy 1, Leer 1, Scratch 1, Fury Swipes 5, Low Kick 8, Seismic Toss 12, Swagger 17, Cross Chop 22, Assurance 26, Thrash 29, Close Combat 33, Screech 36, Stomping Tantrum 40, Outrage 44, Final Gambit 48
- **#057 Primeape** (Scarlet/Violet): Fling 1, Focus Energy 1, Leer 1, Scratch 1, Fury Swipes 5, Low Kick 8, Seismic Toss 15, Swagger 17, Cross Chop 22, Assurance 26, Thrash 30, Rage Fist 35, Close Combat 39, Screech 44, Stomping Tantrum 48, Outrage 53, Final Gambit 57
- **#058 Growlithe** (Scarlet/Violet): Ember 1, Leer 1, Howl 4, Bite 8, Flame Wheel 12, Helping Hand 16, Agility 20, Fire Fang 24, Retaliate 28, Crunch 32, Take Down 36, Flamethrower 40, Roar 44, Play Rough 48, Reversal 52, Flare Blitz 56
- **#059 Arcanine** (Scarlet/Violet): Extreme Speed 0, Agility 1, Bite 1, Crunch 1, Ember 1, Fire Fang 1, Flame Wheel 1, Flare Blitz 1, Helping Hand 1, Howl 1, Leer 1, Play Rough 1, Retaliate 1, Reversal 1, Roar 1, Take Down 1, Flamethrower 5
- **#060 Poliwag** (Scarlet/Violet): Hypnosis 1, Water Gun 1, Pound 6, Mud Shot 12, Bubble Beam 18, Rain Dance 24, Body Slam 30, Earth Power 36, Hydro Pump 42, Belly Drum 48, Double-Edge 54
- **#061 Poliwhirl** (Scarlet/Violet): Hypnosis 1, Mud Shot 1, Pound 1, Water Gun 1, Bubble Beam 18, Rain Dance 24, Body Slam 32, Earth Power 40, Hydro Pump 48, Belly Drum 56, Double-Edge 66
- **#062 Poliwrath** (Scarlet/Violet): Dynamic Punch 0, Belly Drum 1, Body Slam 1, Bubble Beam 1, Circle Throw 1, Double-Edge 1, Earth Power 1, Hydro Pump 1, Hypnosis 1, Mud Shot 1, Pound 1, Rain Dance 1, Water Gun 1
- **#063 Abra** (Sword/Shield): Teleport 1
- **#064 Kadabra** (Sword/Shield): Confusion 0, Disable 1, Kinesis 1, Teleport 1, Psybeam 5, Reflect 10, Ally Switch 15, Psycho Cut 20, Recover 25, Psyshock 30, Psychic 35, Role Play 40, Future Sight 45, Calm Mind 50
- **#065 Alakazam** (Sword/Shield): Confusion 1, Disable 1, Kinesis 1, Teleport 1, Psybeam 5, Reflect 10, Ally Switch 15, Psycho Cut 20, Recover 25, Psyshock 30, Psychic 35, Role Play 40, Future Sight 45, Calm Mind 50
- **#066 Machop** (Sword/Shield): Leer 1, Low Kick 1, Focus Energy 4, Revenge 8, Low Sweep 12, Knock Off 16, Scary Face 20, Vital Throw 24, Strength 29, Dual Chop 32, Bulk Up 36, Seismic Toss 40, Dynamic Punch 44, Cross Chop 48, Double-Edge 52
- **#067 Machoke** (Sword/Shield): Focus Energy 1, Leer 1, Low Kick 1, Revenge 1, Low Sweep 12, Knock Off 16, Scary Face 20, Vital Throw 24, Strength 31, Dual Chop 36, Bulk Up 42, Seismic Toss 48, Dynamic Punch 54, Cross Chop 60, Double-Edge 66
- **#068 Machamp** (Sword/Shield): Focus Energy 1, Leer 1, Low Kick 1, Revenge 1, Wide Guard 1, Low Sweep 12, Knock Off 16, Scary Face 20, Vital Throw 24, Strength 31, Dual Chop 36, Bulk Up 42, Seismic Toss 48, Dynamic Punch 54, Cross Chop 60, Double-Edge 66
- **#069 Bellsprout** (Scarlet/Violet): Vine Whip 1, Growth 7, Wrap 11, Sleep Powder 13, Poison Powder 15, Stun Spore 17, Acid 23, Knock Off 27, Sweet Scent 29, Gastro Acid 35, Razor Leaf 39, Poison Jab 41, Slam 47, Power Whip 52
- **#070 Weepinbell** (Scarlet/Violet): Growth 1, Vine Whip 1, Wrap 1, Sleep Powder 13, Poison Powder 15, Stun Spore 17, Acid 24, Knock Off 29, Sweet Scent 32, Gastro Acid 39, Razor Leaf 44, Poison Jab 47, Slam 54, Power Whip 58
- **#071 Victreebel** (Scarlet/Violet): Leaf Storm 0, Gastro Acid 1, Power Whip 1, Razor Leaf 1, Sleep Powder 1, Spit Up 1, Stockpile 1, Swallow 1, Sweet Scent 1, Vine Whip 1, Leaf Blade 44
- **#072 Tentacool** (Scarlet/Violet): Poison Sting 1, Water Gun 1, Acid 4, Wrap 8, Supersonic 12, Water Pulse 16, Screech 20, Bubble Beam 24, Hex 28, Acid Armor 32, Poison Jab 36, Surf 40, Sludge Wave 44, Hydro Pump 48
- **#073 Tentacruel** (Scarlet/Violet): Acid 1, Poison Sting 1, Reflect Type 1, Water Gun 1, Wrap 1, Supersonic 12, Water Pulse 16, Screech 20, Bubble Beam 24, Hex 28, Acid Armor 34, Poison Jab 40, Surf 46, Sludge Wave 52, Hydro Pump 58
- **#074 Geodude** (Scarlet/Violet): Defense Curl 1, Tackle 1, Rock Polish 6, Rollout 10, Bulldoze 12, Rock Throw 16, Smack Down 18, Self-Destruct 24, Stealth Rock 28, Rock Blast 30, Earthquake 34, Explosion 36, Double-Edge 40, Stone Edge 42
- **#075 Graveler** (Scarlet/Violet): Defense Curl 1, Rock Polish 1, Tackle 1, Rollout 10, Bulldoze 12, Rock Throw 16, Smack Down 18, Self-Destruct 24, Stealth Rock 30, Rock Blast 34, Earthquake 40, Explosion 44, Double-Edge 50, Stone Edge 54
- **#076 Golem** (Scarlet/Violet): Defense Curl 1, Heavy Slam 1, Rock Polish 1, Tackle 1, Rock Throw 16, Smack Down 18, Bulldoze 22, Self-Destruct 24, Stealth Rock 30, Rock Blast 34, Earthquake 40, Explosion 44, Double-Edge 50, Stone Edge 54
- **#077 Ponyta** (Sword/Shield): Growl 1, Tackle 1, Tail Whip 5, Ember 10, Flame Charge 15, Agility 20, Flame Wheel 25, Stomp 30, Fire Spin 35, Take Down 41, Inferno 45, Fire Blast 50, Flare Blitz 55
- **#078 Rapidash** (Sword/Shield): Smart Strike 0, Ember 1, Growl 1, Megahorn 1, Poison Jab 1, Quick Attack 1, Tackle 1, Tail Whip 1, Flame Charge 15, Agility 20, Flame Wheel 25, Stomp 30, Fire Spin 35, Take Down 43, Inferno 49, Fire Blast 56, Flare Blitz 63
- **#079 Slowpoke** (Scarlet/Violet): Curse 1, Tackle 1, Growl 3, Water Gun 6, Yawn 9, Confusion 12, Disable 15, Water Pulse 18, Headbutt 21, Zen Headbutt 24, Amnesia 27, Surf 30, Slack Off 33, Psychic 36, Psych Up 39, Rain Dance 42, Heal Pulse 45
- **#080 Slowbro** (Scarlet/Violet): Curse 1, Future Sight 1, Growl 1, Tackle 1, Water Gun 1, Withdraw 1, Yawn 9, Confusion 12, Disable 15, Water Pulse 18, Headbutt 21, Zen Headbutt 24, Amnesia 27, Surf 30, Slack Off 33, Psychic 36, Psych Up 41, Rain Dance 46, Heal Pulse 51
- **#081 Magnemite** (Scarlet/Violet): Tackle 1, Thunder Shock 1, Supersonic 4, Thunder Wave 8, Electro Ball 12, Gyro Ball 16, Spark 20, Screech 24, Magnet Rise 28, Flash Cannon 32, Discharge 36, Metal Sound 40, Light Screen 44, Lock-On 48, Zap Cannon 52
- **#082 Magneton** (Scarlet/Violet): Tri Attack 0, Electric Terrain 1, Supersonic 1, Tackle 1, Thunder Shock 1, Thunder Wave 1, Electro Ball 12, Gyro Ball 16, Spark 20, Screech 24, Magnet Rise 28, Flash Cannon 34, Discharge 40, Metal Sound 46, Light Screen 52, Lock-On 58, Zap Cannon 64
- **#083 Farfetch’d** (Sword/Shield): Peck 1, Sand Attack 1, Leer 5, Fury Cutter 10, Cut 15, Aerial Ace 20, Air Cutter 25, Knock Off 30, False Swipe 35, Slash 40, Swords Dance 45, Air Slash 50, Leaf Blade 55, Agility 60, Brave Bird 65
- **#084 Doduo** (Scarlet/Violet): Growl 1, Peck 1, Quick Attack 5, Fury Attack 9, Pluck 14, Double Hit 19, Agility 23, Uproar 27, Acupressure 30, Swords Dance 33, Drill Peck 36, Endeavor 39, Thrash 43
- **#085 Dodrio** (Scarlet/Violet): Tri Attack 0, Growl 1, Peck 1, Quick Attack 1, Fury Attack 12, Pluck 15, Double Hit 19, Agility 23, Uproar 26, Acupressure 30, Swords Dance 34, Drill Peck 38, Endeavor 43, Thrash 50
- **#086 Seel** (Scarlet/Violet): Headbutt 1, Growl 3, Charm 7, Icy Wind 11, Encore 13, Ice Shard 17, Rest 21, Aqua Ring 23, Aurora Beam 27, Aqua Jet 31, Brine 33, Take Down 37, Dive 41, Aqua Tail 43, Ice Beam 47, Safeguard 51, Snowscape 53
- **#087 Dewgong** (Scarlet/Violet): Sheer Cold 0, Growl 1, Headbutt 1, Icy Wind 1, Encore 13, Ice Shard 17, Rest 21, Aqua Ring 23, Aurora Beam 27, Aqua Jet 31, Brine 33, Take Down 39, Dive 45, Aqua Tail 49, Ice Beam 55, Safeguard 61, Snowscape 65
- **#088 Grimer** (Scarlet/Violet): Poison Gas 1, Pound 1, Harden 4, Mud-Slap 7, Disable 12, Sludge 15, Mud Shot 18, Minimize 21, Toxic 26, Sludge Bomb 29, Sludge Wave 32, Screech 37, Gunk Shot 40, Acid Armor 43, Belch 46, Memento 48
- **#089 Muk** (Scarlet/Violet): Harden 1, Mud-Slap 1, Poison Gas 1, Pound 1, Disable 12, Sludge 15, Mud Shot 18, Minimize 21, Toxic 26, Sludge Bomb 29, Sludge Wave 32, Screech 37, Gunk Shot 40, Acid Armor 46, Belch 52, Memento 57
- **#090 Shellder** (Scarlet/Violet): Tackle 1, Water Gun 1, Withdraw 4, Ice Shard 8, Leer 12, Whirlpool 16, Supersonic 20, Aurora Beam 24, Protect 28, Razor Shell 32, Iron Defense 36, Ice Beam 40, Shell Smash 44, Hydro Pump 48
- **#091 Cloyster** (Scarlet/Violet): Icicle Spear 0, Aurora Beam 1, Hydro Pump 1, Ice Beam 1, Ice Shard 1, Icicle Crash 1, Iron Defense 1, Leer 1, Protect 1, Shell Smash 1, Spikes 1, Supersonic 1, Tackle 1, Toxic Spikes 1, Water Gun 1, Whirlpool 1, Withdraw 1, Razor Shell 5
- **#092 Gastly** (Scarlet/Violet): Confuse Ray 1, Lick 1, Hypnosis 4, Mean Look 8, Payback 12, Spite 16, Curse 20, Hex 24, Night Shade 28, Sucker Punch 32, Dark Pulse 36, Shadow Ball 40, Destiny Bond 44, Dream Eater 48
- **#093 Haunter** (Scarlet/Violet): Shadow Punch 0, Confuse Ray 1, Hypnosis 1, Lick 1, Mean Look 1, Payback 12, Spite 16, Curse 20, Hex 24, Night Shade 30, Sucker Punch 36, Dark Pulse 42, Shadow Ball 48, Destiny Bond 54, Dream Eater 60
- **#094 Gengar** (Scarlet/Violet): Confuse Ray 1, Hypnosis 1, Lick 1, Mean Look 1, Perish Song 1, Reflect Type 1, Shadow Punch 1, Payback 12, Spite 16, Curse 20, Hex 24, Night Shade 30, Sucker Punch 36, Dark Pulse 42, Shadow Ball 48, Destiny Bond 54, Dream Eater 60
- **#095 Onix** (Sword/Shield): Bind 1, Harden 1, Rock Throw 1, Tackle 1, Smack Down 4, Rock Polish 8, Dragon Breath 12, Curse 16, Rock Slide 20, Screech 24, Sand Tomb 28, Stealth Rock 32, Slam 36, Sandstorm 40, Dig 44, Iron Tail 48, Stone Edge 52, Double-Edge 56
- **#096 Drowzee** (Scarlet/Violet): Hypnosis 1, Pound 1, Disable 5, Confusion 9, Headbutt 13, Poison Gas 17, Psybeam 21, Psych Up 25, Zen Headbutt 29, Swagger 33, Psychic 37, Nasty Plot 41, Psyshock 45, Future Sight 49
- **#097 Hypno** (Scarlet/Violet): Confusion 1, Disable 1, Hypnosis 1, Pound 1, Switcheroo 1, Headbutt 13, Poison Gas 17, Psybeam 21, Psych Up 25, Zen Headbutt 32, Swagger 37, Psychic 42, Nasty Plot 47, Psyshock 51, Future Sight 56
- **#098 Krabby** (Sword/Shield): Leer 1, Water Gun 1, Harden 4, Metal Claw 8, Mud Shot 12, Protect 16, Bubble Beam 20, Stomp 24, Flail 29, Razor Shell 32, Slam 36, Swords Dance 40, Crabhammer 44, Guillotine 48
- **#099 Kingler** (Sword/Shield): Hammer Arm 1, Harden 1, Leer 1, Metal Claw 1, Water Gun 1, Wide Guard 1, Mud Shot 12, Protect 16, Bubble Beam 20, Stomp 24, Flail 31, Razor Shell 36, Slam 42, Swords Dance 48, Crabhammer 54, Guillotine 60
- **#100 Voltorb** (Scarlet/Violet): Charge 1, Tackle 1, Thunder Shock 4, Eerie Impulse 6, Spark 9, Rollout 11, Screech 13, Charge Beam 16, Swift 20, Electro Ball 22, Self-Destruct 26, Light Screen 29, Magnet Rise 34, Discharge 37, Explosion 41, Gyro Ball 46, Mirror Coat 50
- **#101 Electrode** (Scarlet/Violet): Charge 1, Eerie Impulse 1, Magnetic Flux 1, Tackle 1, Thunder Shock 1, Spark 9, Rollout 11, Screech 13, Charge Beam 16, Swift 20, Electro Ball 22, Self-Destruct 26, Light Screen 29, Magnet Rise 36, Discharge 41, Explosion 47, Gyro Ball 54, Mirror Coat 58
- **#102 Exeggcute** (Scarlet/Violet): Absorb 1, Hypnosis 1, Reflect 5, Leech Seed 10, Mega Drain 15, Confusion 20, Synthesis 25, Bullet Seed 30, Giga Drain 35, Extrasensory 40, Uproar 45, Worry Seed 50, Solar Beam 55
- **#103 Exeggutor** (Scarlet/Violet): Stomp 0, Absorb 1, Bullet Seed 1, Confusion 1, Extrasensory 1, Giga Drain 1, Growth 1, Hypnosis 1, Leaf Storm 1, Leech Seed 1, Mega Drain 1, Psyshock 1, Reflect 1, Seed Bomb 1, Solar Beam 1, Synthesis 1, Uproar 1, Wood Hammer 1, Worry Seed 1
- **#104 Cubone** (Sword/Shield): Growl 1, Mud-Slap 1, Tail Whip 4, False Swipe 8, Headbutt 12, Retaliate 16, Fling 20, Stomping Tantrum 24, Bone Rush 29, Focus Energy 32, Endeavor 36, Bonemerang 40, Thrash 44, Double-Edge 48
- **#105 Marowak** (Sword/Shield): False Swipe 1, Growl 1, Mud-Slap 1, Tail Whip 1, Headbutt 12, Retaliate 16, Fling 20, Stomping Tantrum 24, Bone Rush 31, Focus Energy 36, Endeavor 42, Bonemerang 48, Thrash 54, Double-Edge 60
- **#106 Hitmonlee** (Scarlet/Violet): Brick Break 0, Fake Out 1, Focus Energy 1, Helping Hand 1, Low Sweep 1, Tackle 1, Double Kick 4, Low Kick 8, Endure 12, Sucker Punch 16, Wide Guard 21, Blaze Kick 24, Feint 28, Mega Kick 32, Close Combat 36, Reversal 40, High Jump Kick 44, Axe Kick 50
- **#107 Hitmonchan** (Scarlet/Violet): Drain Punch 0, Fake Out 1, Feint 1, Focus Energy 1, Helping Hand 1, Tackle 1, Mach Punch 4, Vacuum Wave 8, Detect 12, Bullet Punch 16, Quick Guard 21, Fire Punch 24, Ice Punch 24, Thunder Punch 24, Agility 28, Mega Punch 32, Close Combat 36, Counter 40, Focus Punch 44
- **#108 Lickitung** (Sword/Shield): Defense Curl 1, Lick 1, Rollout 6, Supersonic 12, Wrap 18, Disable 24, Stomp 30, Knock Off 36, Screech 42, Slam 48, Power Whip 54, Belly Drum 60
- **#109 Koffing** (Scarlet/Violet): Poison Gas 1, Tackle 1, Smog 4, Smokescreen 8, Clear Smog 12, Assurance 16, Sludge 20, Haze 24, Self-Destruct 28, Sludge Bomb 32, Toxic 36, Belch 40, Explosion 44, Memento 48, Destiny Bond 52
- **#110 Weezing** (Scarlet/Violet): Double Hit 0, Heat Wave 1, Poison Gas 1, Smog 1, Smokescreen 1, Tackle 1, Clear Smog 12, Assurance 16, Sludge 20, Haze 24, Self-Destruct 28, Sludge Bomb 32, Toxic 38, Belch 44, Explosion 50, Memento 56, Destiny Bond 62
- **#111 Rhyhorn** (Scarlet/Violet): Tackle 1, Tail Whip 1, Smack Down 5, Bulldoze 10, Horn Attack 15, Scary Face 20, Stomp 25, Rock Blast 30, Drill Run 35, Take Down 40, Earthquake 45, Stone Edge 50, Megahorn 55, Horn Drill 60
- **#112 Rhydon** (Scarlet/Violet): Hammer Arm 0, Bulldoze 1, Smack Down 1, Tackle 1, Tail Whip 1, Horn Attack 15, Scary Face 20, Stomp 25, Rock Blast 30, Drill Run 35, Take Down 40, Earthquake 47, Stone Edge 54, Megahorn 61, Horn Drill 68
- **#113 Chansey** (Scarlet/Violet): Charm 1, Copycat 1, Covet 1, Defense Curl 1, Disarming Voice 1, Pound 1, Sweet Kiss 1, Tail Whip 4, Echoed Voice 8, Life Dew 12, Sing 16, Fling 20, Take Down 24, Heal Pulse 28, Helping Hand 32, Light Screen 36, Double-Edge 40, Soft-Boiled 44, Last Resort 48, Healing Wish 52
- **#114 Tangela** (Sword/Shield): Absorb 1, Bind 1, Stun Spore 4, Growth 8, Mega Drain 12, Vine Whip 16, Poison Powder 20, Ancient Power 24, Knock Off 28, Giga Drain 32, Sleep Powder 36, Slam 40, Tickle 44, Power Whip 48, Ingrain 52, Grassy Terrain 56
- **#115 Kangaskhan** (Sword/Shield): Pound 1, Tail Whip 1, Growl 4, Fake Out 8, Bite 12, Stomp 16, Focus Energy 20, Headbutt 24, Sucker Punch 28, Double Hit 32, Crunch 36, Endure 40, Reversal 44, Outrage 48, Last Resort 52
- **#116 Horsea** (Scarlet/Violet): Leer 1, Water Gun 1, Smokescreen 5, Twister 10, Focus Energy 15, Dragon Breath 20, Bubble Beam 25, Agility 30, Water Pulse 35, Dragon Pulse 40, Hydro Pump 45, Dragon Dance 50, Rain Dance 55
- **#117 Seadra** (Scarlet/Violet): Leer 1, Smokescreen 1, Twister 1, Water Gun 1, Focus Energy 15, Dragon Breath 20, Bubble Beam 25, Agility 30, Water Pulse 37, Dragon Pulse 44, Hydro Pump 51, Dragon Dance 58, Rain Dance 65
- **#118 Goldeen** (Sword/Shield): Peck 1, Tail Whip 1, Supersonic 5, Water Pulse 10, Horn Attack 15, Agility 20, Aqua Ring 25, Flail 30, Waterfall 35, Soak 40, Megahorn 45, Horn Drill 50
- **#119 Seaking** (Sword/Shield): Peck 1, Supersonic 1, Tail Whip 1, Water Pulse 1, Horn Attack 15, Agility 20, Aqua Ring 25, Flail 30, Waterfall 37, Soak 44, Megahorn 51, Horn Drill 58
- **#120 Staryu** (Sword/Shield): Harden 1, Tackle 1, Water Gun 4, Confuse Ray 8, Rapid Spin 12, Minimize 16, Swift 20, Psybeam 24, Brine 28, Light Screen 32, Power Gem 36, Psychic 40, Surf 44, Recover 48, Cosmic Power 52, Hydro Pump 56
- **#121 Starmie** (Sword/Shield): Brine 1, Confuse Ray 1, Cosmic Power 1, Harden 1, Hydro Pump 1, Light Screen 1, Minimize 1, Power Gem 1, Psybeam 1, Psychic 1, Rapid Spin 1, Recover 1, Surf 1, Swift 1, Tackle 1, Water Gun 1
- **#122 Mr. Mime** (Sword/Shield): Baton Pass 1, Copycat 1, Encore 1, Guard Swap 1, Pound 1, Power Swap 1, Quick Guard 1, Wide Guard 1, Confusion 12, Role Play 16, Protect 20, Recycle 24, Psybeam 28, Mimic 32, Light Screen 36, Reflect 36, Safeguard 36, Sucker Punch 40, Dazzling Gleam 44, Psychic 48, Teeter Dance 52
- **#123 Scyther** (Scarlet/Violet): Leer 1, Quick Attack 1, Fury Cutter 4, False Swipe 8, Wing Attack 12, Double Team 16, Double Hit 20, Slash 24, Focus Energy 28, Agility 32, Air Slash 36, X-Scissor 40, Swords Dance 44
- **#124 Jynx** (Sword/Shield): Copycat 1, Lick 1, Pound 1, Powder Snow 1, Sweet Kiss 1, Confusion 12, Covet 16, Sing 20, Fake Tears 24, Ice Punch 28, Psychic 34, Lovely Kiss 40, Mean Look 46, Perish Song 52, Blizzard 58
- **#125 Electabuzz** (Scarlet/Violet): Charge 1, Leer 1, Quick Attack 1, Thunder Shock 1, Swift 12, Shock Wave 16, Thunder Wave 20, Screech 24, Thunder Punch 28, Discharge 34, Low Kick 40, Thunderbolt 46, Light Screen 52, Thunder 58, Giga Impact 64
- **#126 Magmar** (Scarlet/Violet): Ember 1, Leer 1, Smog 1, Smokescreen 1, Clear Smog 12, Flame Wheel 16, Confuse Ray 20, Scary Face 24, Fire Punch 28, Lava Plume 34, Low Kick 40, Flamethrower 46, Sunny Day 52, Fire Blast 58, Hyper Beam 64
- **#127 Pinsir** (Sword/Shield): Harden 1, Vise Grip 1, Focus Energy 4, Bind 8, Seismic Toss 12, Bug Bite 16, Storm Throw 20, Double Hit 24, Vital Throw 28, X-Scissor 32, Strength 36, Swords Dance 40, Submission 44, Guillotine 48, Superpower 52
- **#128 Tauros** (Scarlet/Violet): Tackle 1, Tail Whip 1, Work Up 5, Payback 10, Assurance 15, Horn Attack 20, Scary Face 25, Zen Headbutt 30, Raging Bull 35, Rest 40, Swagger 45, Thrash 50, Double-Edge 55, Giga Impact 60
- **#129 Magikarp** (Scarlet/Violet): Splash 1, Tackle 15, Flail 25
- **#130 Gyarados** (Scarlet/Violet): Bite 0, Flail 1, Leer 1, Splash 1, Tackle 1, Twister 1, Whirlpool 4, Ice Fang 8, Brine 12, Scary Face 16, Waterfall 21, Crunch 24, Rain Dance 28, Aqua Tail 32, Dragon Dance 36, Hydro Pump 40, Hurricane 44, Thrash 48, Hyper Beam 52
- **#131 Lapras** (Scarlet/Violet): Growl 1, Water Gun 1, Sing 5, Mist 10, Life Dew 15, Ice Shard 20, Confuse Ray 25, Water Pulse 30, Brine 35, Body Slam 40, Ice Beam 45, Rain Dance 50, Hydro Pump 55, Perish Song 60, Sheer Cold 65
- **#132 Ditto** (Scarlet/Violet): Transform 1
- **#133 Eevee** (Scarlet/Violet): Covet 1, Growl 1, Helping Hand 1, Tackle 1, Tail Whip 1, Sand Attack 5, Quick Attack 10, Baby-Doll Eyes 15, Swift 20, Bite 25, Copycat 30, Baton Pass 35, Take Down 40, Charm 45, Double-Edge 50, Last Resort 55
- **#134 Vaporeon** (Scarlet/Violet): Water Gun 0, Baton Pass 1, Bite 1, Charm 1, Copycat 1, Covet 1, Double-Edge 1, Growl 1, Helping Hand 1, Swift 1, Tackle 1, Tail Whip 1, Take Down 1, Sand Attack 5, Quick Attack 10, Baby-Doll Eyes 15, Haze 20, Water Pulse 25, Aurora Beam 30, Aqua Ring 35, Muddy Water 40, Acid Armor 45, Hydro Pump 50, Last Resort 55
- **#135 Jolteon** (Scarlet/Violet): Thunder Shock 0, Baton Pass 1, Bite 1, Charm 1, Copycat 1, Covet 1, Double-Edge 1, Growl 1, Helping Hand 1, Swift 1, Tackle 1, Tail Whip 1, Take Down 1, Sand Attack 5, Quick Attack 10, Baby-Doll Eyes 15, Thunder Wave 20, Double Kick 25, Thunder Fang 30, Pin Missile 35, Discharge 40, Agility 45, Thunder 50, Last Resort 55
- **#136 Flareon** (Scarlet/Violet): Ember 0, Baton Pass 1, Charm 1, Copycat 1, Covet 1, Double-Edge 1, Growl 1, Helping Hand 1, Swift 1, Tackle 1, Tail Whip 1, Take Down 1, Sand Attack 5, Quick Attack 10, Baby-Doll Eyes 15, Smog 20, Bite 25, Fire Fang 30, Fire Spin 35, Lava Plume 40, Scary Face 45, Flare Blitz 50, Last Resort 55
- **#137 Porygon** (Scarlet/Violet): Conversion 1, Tackle 1, Recycle 5, Magnet Rise 10, Thunder Shock 15, Psybeam 20, Conversion 2 25, Agility 30, Recover 35, Discharge 40, Tri Attack 45, Double-Edge 50, Lock-On 55, Zap Cannon 60
- **#138 Omanyte** (Sword/Shield): Bind 1, Withdraw 1, Rollout 5, Sand Attack 10, Water Gun 15, Leer 20, Mud Shot 25, Ancient Power 30, Brine 35, Protect 41, Rock Blast 45, Surf 50, Shell Smash 55, Hydro Pump 60
- **#139 Omastar** (Sword/Shield): Crunch 0, Bind 1, Rollout 1, Sand Attack 1, Withdraw 1, Water Gun 15, Leer 20, Mud Shot 25, Ancient Power 30, Brine 35, Protect 43, Rock Blast 49, Surf 56, Shell Smash 63, Hydro Pump 70
- **#140 Kabuto** (Sword/Shield): Absorb 1, Harden 1, Scratch 5, Sand Attack 10, Aqua Jet 15, Leer 20, Mud Shot 25, Ancient Power 30, Brine 35, Protect 41, Leech Life 45, Liquidation 50, Metal Sound 55, Stone Edge 60
- **#141 Kabutops** (Sword/Shield): Slash 0, Absorb 1, Feint 1, Harden 1, Night Slash 1, Sand Attack 1, Scratch 1, Aqua Jet 15, Leer 20, Mud Shot 25, Ancient Power 30, Brine 35, Protect 43, Leech Life 49, Liquidation 56, Metal Sound 63, Stone Edge 70
- **#142 Aerodactyl** (Sword/Shield): Ancient Power 1, Bite 1, Supersonic 5, Wing Attack 10, Scary Face 15, Rock Slide 20, Roar 25, Crunch 30, Iron Head 35, Take Down 40, Stone Edge 45, Agility 50, Hyper Beam 55, Giga Impact 60
- **#143 Snorlax** (Scarlet/Violet): Block 1, Covet 1, Defense Curl 1, Flail 1, Fling 1, Last Resort 1, Lick 1, Metronome 1, Recycle 1, Screech 1, Stockpile 1, Swallow 1, Tackle 1, Yawn 12, Bite 16, Rest 20, Sleep Talk 20, Snore 20, Crunch 24, Body Slam 28, Heavy Slam 32, Amnesia 36, High Horsepower 40, Hammer Arm 44, Belly Drum 48, Belch 52, Giga Impact 56
- **#144 Articuno** (Scarlet/Violet): Gust 1, Mist 1, Powder Snow 5, Reflect 10, Ice Shard 15, Agility 20, Ancient Power 25, Tailwind 30, Freeze-Dry 35, Roost 40, Ice Beam 45, Snowscape 50, Hurricane 55, Haze 60, Blizzard 65, Sheer Cold 70
- **#145 Zapdos** (Scarlet/Violet): Peck 1, Thunder Wave 1, Thunder Shock 5, Light Screen 10, Pluck 15, Agility 20, Ancient Power 25, Charge 30, Drill Peck 35, Roost 40, Discharge 45, Rain Dance 50, Thunder 55, Detect 60, Magnetic Flux 65, Zap Cannon 70
- **#146 Moltres** (Scarlet/Violet): Gust 1, Leer 1, Ember 5, Safeguard 10, Wing Attack 15, Agility 20, Ancient Power 25, Incinerate 30, Air Slash 35, Roost 40, Heat Wave 45, Sunny Day 50, Hurricane 55, Endure 60, Overheat 65, Sky Attack 70
- **#147 Dratini** (Scarlet/Violet): Leer 1, Wrap 1, Twister 5, Thunder Wave 10, Dragon Tail 15, Agility 20, Slam 25, Aqua Tail 31, Dragon Rush 35, Safeguard 40, Rain Dance 45, Dragon Dance 50, Outrage 55, Hyper Beam 60
- **#148 Dragonair** (Scarlet/Violet): Leer 1, Thunder Wave 1, Twister 1, Wrap 1, Dragon Tail 15, Agility 20, Slam 25, Aqua Tail 33, Dragon Rush 39, Safeguard 46, Rain Dance 53, Dragon Dance 60, Outrage 67, Hyper Beam 74
- **#149 Dragonite** (Scarlet/Violet): Hurricane 0, Extreme Speed 1, Fire Punch 1, Leer 1, Roost 1, Thunder Punch 1, Thunder Wave 1, Twister 1, Wing Attack 1, Wrap 1, Dragon Tail 15, Agility 20, Slam 25, Aqua Tail 33, Dragon Rush 39, Outrage 41, Safeguard 46, Rain Dance 53, Dragon Dance 62, Hyper Beam 80
- **#150 Mewtwo** (Scarlet/Violet): Confusion 1, Disable 1, Life Dew 1, Swift 1, Ancient Power 8, Psycho Cut 16, Safeguard 24, Amnesia 32, Aura Sphere 40, Psychic 48, Guard Swap 56, Power Swap 56, Mist 64, Psystrike 72, Recover 80, Future Sight 88
- **#151 Mew** (Scarlet/Violet): Pound 1, Reflect Type 1, Amnesia 10, Baton Pass 20, Ancient Power 30, Life Dew 40, Nasty Plot 50, Metronome 60, Imprison 70, Transform 80, Aura Sphere 90, Psychic 100
