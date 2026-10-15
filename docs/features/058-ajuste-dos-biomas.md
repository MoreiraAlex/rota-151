# 🚀 Versão 0.0.58 — Ajuste dos biomas

## Resumo

Fechar os biomas visíveis da beta (**floresta**, **planície**, **savana** e
**cidade**) antes de as espécies entrarem (059) e de o spawn passar a
depender do bioma (060). Os biomas já existem e cada um foi refinado na
própria feature (047, 049–056), mas o conjunto ainda não ficou alinhado:

- **Tamanho e distribuição**: quanto do mundo é de cada bioma, o tamanho
  típico de cada mancha, quem fica vizinho de quem e como é a transição
  entre eles.
- **Névoa**: distância, cor e densidade, no mundo inteiro e por bioma.
- **Desenho dos objetos do bioma**: até onde cada tipo aparece, densidade,
  LOD e o "pop-in" ao andar.
- **Detalhes que ainda não ficaram bem alinhados** (lista a fechar com o
  usuário na abertura).

Vem depois da água (057): lagos e rios entram na distribuição e no
desenho dos biomas que serão ajustados aqui.

Versão: `0.0.58` (`package.json`, sobe quando a feature começar — depois
da 057). Branch: `feature/058-ajuste-dos-biomas`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Mapa de biomas** (`core/terrain/biomeMap.js`, 047): clima por ruído
  (temperatura, umidade, continentalidade) decide a faixa; dentro do mesmo
  clima, as manchas próprias de cada bioma (do tamanho do `size` dele)
  decidem — o menor fica por cima. Números globais em
  `GAME_CONFIG.BIOMES` (`CLIMATE_SIZE`, `CONTINENT_SIZE`,
  `CLIMATE_SHARPNESS`, `PRESENCE_STRENGTH`, `PATCH_COVERAGE`, `PATCH_EDGE`,
  `BLEND`, `BLEND_CELL`); `coverage` opcional por bioma (a cidade usa, 056).
- **Biomas escondidos** (`BIOMES.HIDDEN`): os escondidos saem da disputa e
  os visíveis ocupam o lugar deles — então o tamanho real de cada bioma
  visível hoje depende de quem está escondido, não só do `size` dele.
- **Origem em terra** (`SPAWN_CONTINENT`, `SPAWN_LAND_RADIUS`).
- **Névoa** (`view/terrain/fogRange.js`, `GAME_CONFIG.FOG`): fecha antes da
  borda do mundo carregado (`TERRAIN.LOAD_RADIUS`) e, com o relevo distante
  (`FAR_TERRAIN`, 051), vira bruma (`HAZE_*`). A cor vem do ciclo de dia
  (`DAY_CYCLE`, 048). Não há névoa por bioma.
- **Vegetação e props** (049–054): colocação pela seed no core, por bloco de
  sólidos; malhas instanciadas por modelo, LOD das árvores
  (`TREES.LOD_DISTANCE`), configs por tipo (`GRASS`, `FLOWERS`, `TREES`,
  `BUSHES`, `ROCKS`...), qualidade baixa cortando parte.
- **Cidade** (056): manchas raras (`size`, `coverage`), quarteirões em
  grade, temas.
- **Painel F2**: bioma atual, chão colorido por bioma, parâmetros de cada
  bioma e "Copiar valores" (sem o `town`).

---

## Decisões (com o usuário — a fechar na abertura)

1. **Tamanho e proporção** — que fração do mundo cada bioma visível deve
   ter, e quanto tempo andando para atravessar uma mancha típica de cada.
2. **Vizinhança** — regras de quem encosta em quem (ex. fictício: savana
   nunca direto na floresta sem planície no meio?) ou deixar só o clima
   decidir.
3. **Transição** — largura da borda entre biomas (relevo, chão e
   vegetação) — curta e marcada ou longa e gradual.
4. **Névoa** — o que está errado hoje (distância, cor, densidade, pop-in na
   borda) e se cada bioma ganha a própria (ex.: mata mais fechada). Ver a
   sobreposição com o Marco 5 abaixo.
5. **Objetos do bioma** — quais tipos aparecem tarde demais, somem cedo,
   piscam ou pesam; até onde cada um deve ir.
6. **Outros detalhes** — lista do usuário.

> **Sobreposição com o Marco 5** (decidir se entra aqui ou continua lá):
> 083 (luz e névoa por hora), 084 (desempenho no celular), 085 (névoa mais
> fechada e ambiente da floresta), 086 (detalhes da floresta).

---

## Arquitetura (proposta)

*(detalhar depois das decisões)*

---

## Etapas

- [x] Doc e roadmap (água para 057, esta como 058, o resto renumerado).
- [ ] Bump `package.json` → `0.0.58` (ao começar, depois da 057).
- [ ] Decisões com o usuário e revisão do doc.
- [ ] Tamanho e distribuição dos biomas (+ testes).
- [ ] Névoa.
- [ ] Desenho dos objetos do bioma.
- [ ] Detalhes levantados na abertura.
- [ ] Desempenho na Intel UHD (antes e depois).
- [ ] Wiki: página "O mundo".
- [ ] Roadmap: 058 para "Já feito".
- [ ] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Critérios de Conclusão

- [ ] Cada bioma visível ocupa a fração do mundo e o tamanho de mancha
      combinados, com a vizinhança e a transição decididas.
- [ ] Névoa sem borda visível do mundo carregado e no tom combinado.
- [ ] Objetos do bioma sem pop-in incômodo, na distância combinada.
- [ ] Mesma seed, mesmo mapa.
- [ ] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [ ] `npm run build`, `npm run lint` e `npm test` passando.
- [ ] Wiki atualizada.

---

## Fora de escopo

- Biomas escondidos (oceano, praia, selva, pântano, deserto, vulcânico,
  tundra e montanha) — depois da beta.
- Água (lagos, rios) — 057.
- Spawn por bioma — 060.
