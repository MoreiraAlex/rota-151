# 🚀 Versão 0.0.9 — Rotação de Ossos por Quaternion

O objetivo desta versão é corrigir como `core/animation/applyAnimationClip.js`
aplica a curva de **rotação** num osso — hoje soma escalar direto no
componente de Euler, o que só reproduz corretamente a intenção do clipe
quando o osso descansa perto da identidade nos outros dois eixos. Rigs com
pose de descanso torta (Mixamo, entre outros) saem errados — parte do corpo
girando no eixo errado, às vezes com o sinal invertido.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- O clipe `core/data/species/bot/clips/walk.json` (rig Mixamo, 41 ossos,
  curvas `sum` de offset + 3 harmônicos) foi gerado e validado num preview
  externo, mas no jogo o resultado saía diferente — partes do corpo corretas,
  partes "destruídas" ou girando na direção errada.
- Motor e gerador usam convenções diferentes pra rotação: o motor soma
  `rest.rotation[eixo] + delta` (escalar, componente de Euler); o gerador
  extrai cada delta como `q_delta = q_rest⁻¹ · q_total` — uma rotação local
  **pós-multiplicada** em quaternion.
- Com a ordem Euler padrão do three.js (`XYZ`, ou seja `q_total =
  qx·qy·qz`), as duas convenções só coincidem exatamente no eixo **Z** — é
  matematicamente demonstrável: somar `d` só no componente Z de um Euler
  `(x,y,z)` produz `q_new = qx(x)·qy(y)·qz(z)·qz(d) = q_rest·qz(d)`, que bate
  com o gerador. Somar `d` no componente X produz `q_new =
  qx(x)·qx(d)·qy(y)·qz(z)`, que só é igual a `q_rest·qx(d)` quando `y` e `z`
  do resto são ~0 (produto de quaternion não comuta). Y fica no meio,
  sanduichado, com o mesmo problema.
- Por isso os clipes do Fox sempre funcionaram: animam quase só
  `rotation.z`, e o resto do rig do Fox é ~identidade. O clipe do bot anima
  X, Y e Z em 41 ossos, com pose de descanso real (não identidade) — ex.: a
  coxa (`mixamorig_RightUpLeg`) descansa a 180° em Z. Nesse caso,
  `Rz(π)·Rx(d)·Rz(π)⁻¹ = Rx(−d)`: o motor antigo aplicava a curva de X com o
  **sinal invertido**.
- O crossfade (`applyBlendedAnimationClip`) tinha um problema relacionado:
  `lerpBoneValues` interpolava Euler componente a componente, sem slerp e
  sem correção de sinal. Um osso com resto em `z = +π` pode ter uma pose
  vizinha representada em `−π` (mesma rotação) — o lerp ingênuo giraria
  ~360° atravessando essa borda, em vez do caminho curto.

## Decisões

- **`core/math/quaternion.js` (novo)** — funções puras sobre `{x,y,z,w}`,
  sem depender de `three` (core continua headless):
  - `quaternionFromAxisAngle(axis, angle)` — rotação pura num eixo local.
  - `multiplyQuaternions(a, b)` — produto de Hamilton (`a` aplicado depois
    de `b`, mesma convenção do `Quaternion.multiply` do three.js).
  - `slerpQuaternions(a, b, alpha)` — com correção de sinal (`dot < 0` →
    nega `b`), que é o que evita o giro de 360° no crossfade.
  - Consolidou a duplicata que já existia em `core/physics/colliders.js`
    (`axisQuaternion`, usada pra rotação de obstáculo e pro tilt da cápsula)
    — uma função só, um lugar só.
- **`resolveBones.js` guarda também `restQuaternion`** — cópia de
  `bone.quaternion` no momento da resolução, ao lado do `rest` (Euler) que
  já existia. `rest.rotation` continua existindo pra diagnóstico, mas deixa
  de ser usado pra montar a pose de rotação — quem decide isso agora é
  `restQuaternion`.
- **`applyAnimationClip.js` — rotação vira composição de quaternion**: pra
  cada eixo com curva no clipe, `q = multiplyQuaternions(q,
  quaternionFromAxisAngle(eixo, delta))`, partindo de `restQuaternion`, numa
  ordem fixa `x, y, z` (determinística, independente da ordem das chaves no
  JSON). `position`/`scale` continuam soma escalar direta — não têm esse
  problema, um vetor de deslocamento soma igual não importa a orientação de
  descanso.
- **Crossfade usa slerp pra rotação** (`slerpQuaternions`) e lerp linear só
  pra `position`/`scale` — não há mais lerp de Euler em lugar nenhum.
- **`writePose` escreve `bone.quaternion.set(...)`** em vez de
  `bone.rotation.x/y/z` — o three.js sincroniza `rotation`/Euler sozinho a
  partir do quaternion (callback interno), então nada mais no projeto
  precisa mudar pra continuar lendo `bone.rotation` se algum dia precisar.

## Objetivos

- `applyAnimationClip` produz o mesmo resultado do preview externo pro
  clipe do bot, incluindo ossos com pose de descanso longe da identidade.
- Nenhuma regressão nos clipes do Fox (que só usam Z com resto ~identidade
  — o caso em que soma de Euler e quaternion sempre coincidiram).
- Crossfade sem giro de 360° em ossos com resto perto de ±π.
- `core/` continua headless — toda a matemática nova é `{x,y,z,w}` puro,
  sem importar `three`.

---

## Etapas

### 1. `core/math/quaternion.js`

- [X] `quaternionFromAxisAngle`, `multiplyQuaternions`, `slerpQuaternions` +
      export no `index.js` + `quaternion.test.js`
- [X] `core/physics/colliders.js` — remove a `axisQuaternion` duplicada,
      importa `quaternionFromAxisAngle` de `core/math`
- [X] `core/systems/characterPhysicsSystem.js` (+ teste) — mesma troca de
      import (girava o corpo físico com essa mesma função)

### 2. `resolveBones.js`

- [X] Captura e devolve `restQuaternion` ao lado de `rest`
- [X] `resolveBones.test.js` — cobre `restQuaternion` (captura e
      independência de mutação depois da resolução)

### 3. `applyAnimationClip.js`

- [X] `sampleAnimationClip` — pose de rotação vira `quaternion`, composto a
      partir de `restQuaternion` + curvas por eixo, ordem fixa x/y/z
- [X] `capturePose` — fotografa `bone.quaternion`, não mais a tripla de Euler
- [X] `applyBlendedAnimationClip`/`lerpBoneValues` — `slerpQuaternions` pra
      rotação, lerp linear só pra `position`/`scale`
- [X] `writePose` — escreve `bone.quaternion.set(x,y,z,w)`

### 4. Testes

- [X] `applyAnimationClip.test.js` — reescrito pra fixtures baseadas em
      quaternion; casos de rotação usam ângulo assinado extraído do
      quaternion (`2·atan2(componente, w)`) pra continuar tão precisos
      quanto os testes antigos de Euler
- [X] **Novo caso**: osso com rest longe da identidade (180° em Z, como a
      coxa do Mixamo) — confirma que uma curva em X gira no eixo local
      certo, não invertida, comparando com a composição de quaternion
      esperada (e explicitamente contra o resultado que a soma de Euler
      antiga daria, pra provar que são diferentes)
- [X] Verificação manual (fora da suíte, descartada depois): clipe real do
      bot contra o motor, com a coxa em rest 180° Z — aplica sem erro em
      todos os 41 ossos e todos os frames, e o resultado bate com a
      composição de quaternion esperada, não com a soma de Euler antiga

### 5. Gate e documentação

- [X] `package.json`: bump de versão `0.0.8` → `0.0.9`
- [X] `npm run lint` limpo e `npm test` (123/123) verdes (`npm run build`
      segue sujeito ao lint pré-existente em arquivos de conteúdo do
      usuário — `bot/index.js`, `roster.js` —, fora do escopo desta versão)

---

## Critérios de Conclusão

- `applyAnimationClip` compõe rotação por quaternion (`restQuaternion` +
  deltas por eixo, ordem fixa x/y/z), não mais soma escalar de Euler.
- Crossfade de rotação usa `slerpQuaternions`, nunca lerp linear de Euler.
- Osso com pose de descanso longe da identidade anima corretamente numa
  curva de qualquer eixo (coberto por teste com rest a 180° em Z).
- Nenhuma duplicata de matemática de quaternion no projeto — uma
  implementação em `core/math/quaternion.js`, usada por física e animação.
- `core/` continua sem importar `three` em lugar nenhum.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **`idle.json`/`run.json` do bot** — ainda usam nomes de osso do Fox
  (`b_Spine01_02` etc.), nenhum existe no rig Mixamo; o bot fica em pose de
  descanso animando esses dois estados. Decidido explicitamente deixar de
  fora desta versão — a correção do motor não depende disso, e é trabalho
  de conteúdo (gerar clipes novos pro rig do bot), não de engine.
- **Cadência fixa / pé deslizando** — `clip.speed` vem do clipe, nunca da
  velocidade real do personagem; fora da velocidade nominal do clipe, o pé
  desliza. Mudança de design à parte, não é sobre a matemática de rotação.
- **`clip.speed || 1` vs `?? 1`** — `speed: 0` cairia pra 1 em silêncio;
  bug pequeno, pré-existente, não tocado aqui.
- **Ferramenta de preview** (`app/tools/teste-animations/page.js`) ignora
  `clip.speed` e usa um slider próprio — preview e jogo podem divergir de
  cadência mesmo depois desta correção. Arquivo de ferramenta do usuário,
  fora do escopo.
- **Ordem de composição entre eixos do mesmo osso** fixada em x/y/z; na
  prática os deltas são pequenos e a ordem importa pouco, mas não é
  garantidamente idêntica à ordem que o gerador usou internamente pra
  decompor multi-eixo. Se algum osso sair sutilmente errado nesse aspecto
  (não no sinal/eixo, que é o bug corrigido aqui), é o próximo lugar a
  olhar.
